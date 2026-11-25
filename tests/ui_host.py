"""Exercise the MCP Apps iframe in Chromium with a minimal host protocol bridge."""
from playwright.sync_api import sync_playwright


def verify(d,html,call):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium')
        page=browser.new_page()
        page.expose_function('invoke',lambda name,args:call(name,args))
        page.set_content("""<iframe sandbox="allow-scripts"></iframe><script>
          const frame=document.querySelector('iframe');
          addEventListener('message',async e=>{
            if(e.source!==frame.contentWindow)return;
            const {id,method,params}=e.data;
            const send=(body)=>frame.contentWindow.postMessage({jsonrpc:'2.0',...body},'*');
            if(method==='ui/initialize')send({id,result:{protocolVersion:params.protocolVersion,
              hostInfo:{name:'pilot-browser',version:'1'},hostCapabilities:{serverTools:{}},hostContext:{}}});
            if(method==='ui/notifications/initialized')send({method:'ui/notifications/tool-result',
              params:{content:[],structuredContent:await invoke('list_hosts',{})}});
            if(method==='tools/call')send({id,result:{content:[],structuredContent:await invoke(params.name,params.arguments)}});
          });
        </script>""")
        page.locator('iframe').evaluate('(frame,html)=>frame.srcdoc=html',html)
        frame=page.frame_locator('iframe')
        frame.get_by_role('heading',name='pilot · 在线').wait_for(timeout=10000)
        frame.get_by_role('button',name='主机告警').click()
        frame.get_by_role('button',name='查看事件').first.click()
        frame.get_by_role('heading',name='事件发生时间',exact=False).wait_for()
        assert 'hello world' in frame.locator('pre').first.inner_text()
        job=call('newbox_exec',dict(host_id='pilot',argv=['echo','browser']))
        page.evaluate("""(id)=>document.querySelector('iframe').contentWindow.postMessage({
          jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{content:[],structuredContent:{execution_id:id}}},'*')""",job['execution_id'])
        from time import sleep
        for _ in range(20):
            frame.get_by_role('button',name='刷新调查结果').click()
            if frame.get_by_role('heading',name='现场采集时间',exact=False).count():break
            sleep(.2)
        assert 'browser' in frame.locator('pre').first.inner_text()
        browser.close()
        print('PASS Chromium MCP Apps handshake, host list, alert timeline and execution view',flush=True)
