"""Verify the management page, enrollment and MCP credentials from the installed archive."""
import hashlib
import json
import re
import secrets
import urllib.error
from playwright.sync_api import sync_playwright


def verify(d,url,password,config,start,tool,eventually):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium')
        page=browser.new_page(ignore_https_errors=True)
        page.goto(url+'/admin')
        page.get_by_label('密码').fill(password)
        page.get_by_role('button',name='登录',exact=True).click()
        page.get_by_role('button',name='生成 MCP Key').click()
        field=page.get_by_label('MCP Key',exact=True)
        field.wait_for()
        key=field.input_value()
        assert tool('list_hosts',{},key)['structuredContent']['hosts']
        page.get_by_label('主机名').fill('paired-01')
        page.get_by_role('button',name='生成配对命令').click()
        cmd=page.get_by_label('探针安装命令')
        cmd.wait_for()
        invite=re.search(r"'([a-f0-9]{64})'\)$",cmd.input_value()).group(1)
        endpoint=secrets.token_hex(32)
        payload=dict(host='paired-01',invite=invite,device=endpoint)
        assert page.request.post(url+'/v1/pair',data=payload).status==204
        assert page.request.post(url+'/v1/pair',data=payload).status==403
        a=page.request.get(url+'/downloads/client.tar.gz').body()
        digest=page.request.get(url+'/downloads/client.tar.gz.sha256').text().split()[0]
        assert hashlib.sha256(a).hexdigest()==digest
        assert page.request.get(url+'/downloads/install-client.sh').text().startswith('#!/usr/bin/env bash')
        cfg=config('paired-worker',dict(server=url,token=endpoint,newbox=str(d/'client/newbox'),
                   policy=dict(mounts=[],system_info=False,timeout_seconds=2,output_bytes=1024)))
        start([d/'client/newids-client','worker',cfg])
        def live():
            return any(h['host_id']=='paired-01' and h['online'] for h in tool('list_hosts',{},key)['structuredContent']['hosts'])
        eventually(live)
        page.get_by_role('button',name='刷新',exact=True).click()
        page.get_by_role('row').filter(has_text='paired-01').get_by_text('在线',exact=True).wait_for()
        page.once('dialog',lambda dialog:dialog.accept())
        page.get_by_role('button',name='轮换 MCP Key').click()
        eventually(lambda:field.input_value()!=key)
        try:tool('list_hosts',{},key)
        except urllib.error.HTTPError as e:assert e.code==401
        else:raise AssertionError('old key accepted')
        assert tool('list_hosts',{},field.input_value())['structuredContent']['hosts']
        page.get_by_role('button',name='退出登录').click()
        page.get_by_role('button',name='登录',exact=True).wait_for()
        assert page.request.get(url+'/admin/api/status').status==401
        browser.close()
    print('PASS browser login, key rotation, one-use enrollment, online probe, logout and downloads',flush=True)
