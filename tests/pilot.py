"""Exercise the release archives with real tools over TLS, without modifying host audit rules."""
import contextlib
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import ssl
import subprocess
import tarfile
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = """type=SYSCALL msg=audit(1795510000.123:412): arch=c000003e syscall=59 success=yes ppid=110 pid=222 uid=1000 exe="/usr/bin/printf" key="newids_exec"
type=EXECVE msg=audit(1795510000.123:412): argc=3 a0="printf" a1="%s" a2=68656C6C6F20776F726C64
type=EOE msg=audit(1795510000.123:412):
"""


def eventually(fn, seconds=20):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        value = fn()
        if value:
            return value
        time.sleep(.15)
    raise AssertionError(f"timed out waiting for {fn}")


def main(d):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    bundle=os.environ.get('NEWIDS_TEST_BUNDLE')
    archives=[Path(bundle)] if bundle else [
        ROOT / f'release/newids-{part}-linux-x86_64.tar.gz' for part in ('client','server')]
    for artifact in archives:
        with tarfile.open(artifact) as archive:
            archive.extractall(d, filter='data')
    if bundle:
        subprocess.run(['sha256sum','-c','BINARIES.sha256'],cwd=d,check=True)
    def openssl(*args):
        subprocess.run(['openssl',*args],check=True,stderr=subprocess.DEVNULL)
    openssl('req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=NewIDS test CA',
            '-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout',d/'ca.key','-out',d/'ca')
    openssl('req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=localhost','-keyout',d/'key','-out',d/'csr')
    (d/'extensions').write_text('subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n')
    openssl('x509','-req','-in',d/'csr','-CA',d/'ca','-CAkey',d/'ca.key','-days','1','-out',d/'cert','-extfile',d/'extensions')
    device, user, other = [secrets.token_hex(32) for _ in range(3)]
    url = f'https://localhost:{port}'
    env = dict(os.environ, SSL_CERT_FILE=str(d/'ca'), CODEX_CA_CERTIFICATE=str(d/'ca'), NEWIDS_TEST_TOKEN=user)
    tls = ssl.create_default_context(cafile=d/'ca')
    db = d/'platform.sqlite'
    logs = d/'logs'
    logs.mkdir()
    (logs/'test').write_text('one\ntwo\n')

    def config(name, data):
        path = d/(name+'.json')
        path.write_text(json.dumps(data))
        return str(path)

    enable_admin=os.environ.get('NEWIDS_TEST_ADMIN')
    extra={}
    if enable_admin:
        import hashlib
        password=secrets.token_hex(20)
        salt=secrets.token_hex(16)
        digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1,dklen=32).hex()
        extra=dict(origin=url,admin=dict(id='admin',salt=salt,hash=digest))
    cfg = config('server', dict(**extra,port=port, database=str(db), tls={'cert':str(d/'cert'),'key':str(d/'key')},
                                hosts=[dict(id='pilot',token=device)],users=[
                                    dict(id='analyst',token=user,hosts=['pilot']),dict(id='other',token=other,hosts=[])]))
    base = dict(server=url,token=device)
    worker = config('worker', dict(**base,newbox=str(d/'client/newbox'),policy=dict(
        mounts=['/logs='+str(logs)], system_info=False, timeout_seconds=1, output_bytes=32)))
    collector = config('collector',dict(**base,threshold=0,spool=str(d/'spool'),shellguard=str(d/'client/shellguard')))

    def request(uri, body, token):
        req = urllib.request.Request(url+uri,json.dumps(body).encode(),
            headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token})
        with urllib.request.urlopen(req,context=tls,timeout=5) as r:
            return json.load(r)

    def mcp(method, params, token=user):
        return request('/mcp',dict(jsonrpc='2.0',id=1,method=method,params=params),token)['result']

    def tool(name, args=None, token=user):
        return mcp('tools/call',dict(name=name,arguments=args or {}),token)

    def call(name, args=None):
        r = tool(name,args)
        assert not r.get('isError'), r
        return r['structuredContent']

    def run_job(**args):
        job = call('newbox_exec',dict(host_id='pilot',**args))
        def poll():
            r = call('get_execution',dict(execution_id=job['execution_id']))
            return r['result'] if r['state']=='finished' else None
        return eventually(poll)

    with contextlib.ExitStack() as stack:
        def start(args):
            proc = subprocess.Popen(args,env=env,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            def stop():
                proc.terminate()
                try: proc.wait(timeout=5)
                except subprocess.TimeoutExpired: proc.kill();proc.wait()
                proc.stdin.close()
            stack.callback(stop)
            return proc

        server_cmd=[d/'server/runtime/node' if bundle else 'node',d/'server/dist/server.js',cfg]
        proc=start(server_cmd)
        def ready():
            try: return mcp('initialize',dict(protocolVersion='2025-11-25',capabilities={},clientInfo=dict(name='pilot-test',version='1')))
            except OSError: return None
        eventually(ready)
        assert call('newbox_exec',dict(host_id='pilot',argv=['echo','hello']))['state']=='offline'
        w=start([d/'client/newids-client','worker',worker])
        eventually(lambda:call('list_hosts')['hosts'][0]['online'])
        assert tool('list_hosts',{},other)['structuredContent']=={'hosts':[]}
        assert tool('newbox_exec',dict(host_id='pilot',argv=['echo']),other)['isError']
        for bad in [dict(argv=['--read-only-host','cat']),dict(script='echo',argv=['echo'])]:
            assert tool('newbox_exec',dict(host_id='pilot',**bad))['isError']
        assert run_job(argv=['printf','%s','hello world'])['stdout']=='hello world'
        assert run_job(script='cat /logs/test | head -n 1')['stdout']=='one\n'
        assert run_job(argv=['cat','/etc/passwd'])['exit_code']!=0
        assert run_job(script='printf "%064d" 1')['truncated']
        timed=run_job(script='while true; do :; done')
        assert timed['timed_out'] or timed['error'],timed
        print('PASS TLS, tenant ACL, offline, argv, guest pipeline, mount isolation, resource limits',flush=True)

        proc.terminate();proc.wait()
        detector=start([d/'client/newids-client','collector',collector])
        detector.stdin.write(SAMPLE.encode());detector.stdin.flush()
        detector.stdin.close()
        assert detector.wait(timeout=20)==0
        proc=start(server_cmd);eventually(ready)
        detector=start([d/'client/newids-client','collector',collector])
        item=eventually(lambda:call('list_alerts')['alerts'])[0]
        a=call('get_alert',dict(alert_id=item['alert_id']))
        assert a['argv']==['printf','%s','hello world'] and a['pid']==222 and len(a['behaviors'])==16
        assert tool('get_alert',dict(alert_id=item['alert_id']),other)['isError']
        detector.stdin.write(SAMPLE.encode());detector.stdin.flush()
        eventually(lambda:call('list_hosts')['hosts'][0]['health']['scored']>0)
        assert len(call('list_alerts')['alerts'])==1
        # Terminate the real persistent scorer between inputs. The pending event must survive the restart.
        children=Path(f'/proc/{detector.pid}/task/{detector.pid}/children')
        scorer_pids=[int(pid) for task in children.parent.parent.iterdir()
                     for pid in (task/'children').read_text().split()]
        assert len(scorer_pids)==1,scorer_pids
        import signal
        os.kill(scorer_pids[0],signal.SIGKILL)
        detector.stdin.write(SAMPLE.replace(':412)',':413)').encode());detector.stdin.flush()
        eventually(lambda:len(call('list_alerts')['alerts'])==2)
        print('PASS real scorer recovery after process loss', flush=True)
        print('PASS replayed Audit records, real ShellGuard scoring, queue restart and deduplication',flush=True)

        # Age the test clock in SQLite and verify claimed work never becomes available again.
        w.terminate();w.wait()
        request('/v1/device/heartbeat',dict(mounts=[],system_info=False,timeout_seconds=1,output_bytes=32),device)
        job=call('newbox_exec',dict(host_id='pilot',script='echo hello',alert_id=item['alert_id']))
        assert request('/v1/device/claim',{},device)['job']['id']==job['execution_id']
        with sqlite3.connect(db) as conn: conn.execute("UPDATE jobs SET claimed=0 WHERE id=?",(job['execution_id'],))
        assert call('get_execution',dict(execution_id=job['execution_id']))['state']=='unknown'
        assert request('/v1/device/claim',{},device)['job'] is None
        start([d/'client/newids-client','worker',worker])
        if enable_admin:
            from management import verify
            verify(d,url,password,config,start,tool,eventually)
        if os.environ.get('NEWIDS_TEST_CODEX'):
            from codex_host import verify
            verify(d,url,env)
        if os.environ.get('NEWIDS_TEST_UI'):
            from ui_host import verify
            resource=mcp('resources/read',{'uri':'ui://newids/investigation.html'})
            verify(d,resource['contents'][0]['text'],call)
        print('PASS lost-result handling; no automatic redispatch',flush=True)


if __name__=='__main__':
    with tempfile.TemporaryDirectory() as path:
        main(Path(path))
