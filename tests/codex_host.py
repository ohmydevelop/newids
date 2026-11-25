"""Local Codex MCP integration, with an isolated profile and no model turn."""
import json
import queue
import subprocess
import threading
import time


def verify(d,url,env):
    profile=d/'codex'
    profile.mkdir()
    (profile/'config.toml').write_text(f'[mcp_servers.newids]\nurl="{url}/mcp"\nbearer_token_env_var="NEWIDS_TEST_TOKEN"\n')
    p=subprocess.Popen(['codex','app-server'],cwd=d,env=dict(env,CODEX_HOME=str(profile)),
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
    replies=queue.Queue()
    def reader():
        for line in p.stdout:
            replies.put(json.loads(line))
    threading.Thread(target=reader,daemon=True).start()
    def send(body):
        p.stdin.write(json.dumps(body)+'\n');p.stdin.flush()
    seq=0
    def rpc(method,params):
        nonlocal seq
        seq+=1
        send(dict(id=seq,method=method,params=params))
        deadline=time.monotonic()+30
        while True:
            r=replies.get(timeout=max(.1,deadline-time.monotonic()))
            if r.get('id')==seq and ('result' in r or 'error' in r):
                if 'error' in r: raise RuntimeError(r['error'])
                return r['result']
    try:
        rpc('initialize',{'clientInfo':{'name':'newids-pilot','version':'1'},'capabilities':{'experimentalApi':True}})
        send(dict(method='initialized'))
        t=rpc('thread/start',{'cwd':str(d),'ephemeral':True})['thread']['id']
        def call(name,args):
            r=rpc('mcpServer/tool/call',dict(threadId=t,server='newids',tool=name,arguments=args))
            assert not r.get('isError'),r
            return r['structuredContent']
        for _ in range(75):
            hosts=call('list_hosts',{})['hosts']
            if any(h['host_id']=='pilot' and h['online'] for h in hosts):break
            time.sleep(.2)
        else:raise AssertionError('worker heartbeat unavailable')
        job=call('newbox_exec',{'host_id':'pilot','argv':['echo','codex pilot']})
        assert job['state']=='queued',job
        for _ in range(75):
            r=call('get_execution',{'execution_id':job['execution_id']})
            if r['state']=='finished':break
            time.sleep(.2)
        assert r['result']['stdout']=='codex pilot\n',r
        print('PASS real Codex app-server discovery and Newbox execution',flush=True)
    finally:
        p.terminate()
        try:p.wait(timeout=3)
        except subprocess.TimeoutExpired:p.kill();p.wait()
