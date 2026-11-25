# NewIDS

在使用 systemd 的 Linux x86_64 服务器上，替换域名、证书链和私钥路径后执行：

```bash
curl -fsSL https://raw.githubusercontent.com/ohmydevelop/newids/main/install.sh | sudo bash -s -- https://ids.example.com:8443 /path/to/fullchain.pem /path/to/privkey.pem
```

安装完成后，终端会显示 Web 地址、账号和密码。登录后即可在页面安装探针、获取 MCP Key。
