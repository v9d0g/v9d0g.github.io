---
date: 2026-05-07
tags:
  - 代码审计
  - 分享
---
# 简述

简单分析和分享一下BH Asia 2026上一些关注的议题的有意思内容

## Cast Attack: A New Threat Posed by Ghost Bits in Java
### 简介
幽灵比特简单来说就是**某些语言**在对**字符串编码**的时候进行的一些处理并不合理 存在一定的缺陷导致的编码问题
这里以java的工具 burpsuite为例:
![[Pasted image 20260508104906.png]]
`阮`对应的unicode是 `\u962e`
![[Pasted image 20260508104940.png]]
但通过bp自带的中文解码之后
![[Pasted image 20260508105023.png]]
`阮`变成了`.` 其对应的unicode 为`\u002e`
![[Pasted image 20260508105056.png]]
也就是说 bp在处理中文unicode的时候 会丢弃高八位数据 即

`bin:1001 0110 0010 1110 --> unicode:\u962e`

`bin:0000 0000 0010 1110 --> unicode:\u002e`

通过类比这个情况 可以挖掘出一些新的攻击面来绕过waf或者触发某些漏洞
### 真实情况下的幽灵bit
#### CVE-2025-41242
相关代码如下
```java
public static String uriDecode(String source, Charset charset) {
    int length = source.length();
    if (length == 0) {
        return source;
    }
    Assert.notNull(charset, "Charset must not be null");

    ByteArrayOutputStream baos = new ByteArrayOutputStream(length);
    boolean changed = false;
    for (int i = 0; i < length; i++) {
        int ch = source.charAt(i);
        if (ch == '%') {
            if (i + 2 < length) {
                char hex1 = source.charAt(i + 1);
                char hex2 = source.charAt(i + 2);
                int u = Character.digit(hex1, 16);
                int l = Character.digit(hex2, 16);
                if (u == -1 || l == -1) {
                    throw new IllegalArgumentException("Invalid encoded sequence \"" + source.substring(i) + "\"");
                }
                baos.write((char) ((u << 4) + l));
                i += 2;
                changed = true;
            }
            else {
                throw new IllegalArgumentException("Invalid encoded sequence \"" + source.substring(i) + "\"");
            }
        }
        else {
            baos.write(ch);   // ← BUG
        }
    }
    return (changed ? StreamUtils.copyToString(baos, charset) : source);
}
```
这段代码就是将高位数据截断的罪魁祸首

具体详情可以参考[vuln_hub](https://github.com/vulhub/vulhub/pull/773)
##### 原理简析
在spring处理**静态资源**(一般映射为下面的内容)时，会对路径进行一系列校准
```java
classpath:/static/
classpath:/public/
classpath:/resources/
classpath:/META-INF/resources/
```
而这个漏洞关注的是这些调用栈
![[Pasted image 20260518162354.png]]
为了更进一步来感受这个漏洞的原理之一(`uriDecode`),我们随机采用一个spring项目

目前有很多的spring应用都还使用的这个版本
随机抽选一个[项目](https://github.com/elunez/eladmin)
![[Pasted image 20260512152205.png]]

其默认使用的`spring-core`版本如下

- `org\springframework\spring-core\5.3.31\spring-core-5.3.31.jar!\org\springframework\util\StringUtils.class`

使用这个模块中任意一个上传文件的功能 上传一个任意文件（该项目会将上传的文件添加一个时间戳）
这里的js文件是通过前台上传的 而`logu%65.陪sp`和`logue.jsp`都是手动放在这里的文件 

**这里的文件内容都是其文件名**
![[Pasted image 20260512152428.png]]
我们通过yakit直接访问文件预览接口 可以直接获取这个文件内容
![[Pasted image 20260512152627.png]]
在`uriDecode`打下断点
![[Pasted image 20260512153033.png]]
发现会在这个地方断住**17**次 在第**17**次放行后 yakit便会有响应 并且最后一次的入参就是`url`的`path`
![[Pasted image 20260512153300.png]]

如果这里将最后一次的入参从
`/file/%E5%85%B6%E4%BB%96/log-20260512030641284.js` 修改为 
`/file/%E5%85%B6%E4%BB%96/logu%65.陪sp` 
![[Pasted image 20260512154255.png]]
一般我们会认为这指向的是`logu%65.陪sp`的文件
![[Pasted image 20260512154645.png]]
但实际返回的 是指向的`logue.jsp`
![[Pasted image 20260512154337.png]]
这里的原因就是因为`uriDecode(String source, Charset charset)`对包含 **%** 的编码处理存在缺陷
`logu%65.陪sp`中 `'%65' = urlEncode('e')`
而`陪`的unicode编码为 `\u966a`  其去除高位后为 `\u006a` 
![[Pasted image 20260512155348.png]]
在这个方法的处理中 就被识别成了`j` 导致了 `logu%65.陪sp` 被识别为 `logue.jsp`

在该项目中web容器使用的是
```xml
<artifactId>spring-boot-starter-web</artifactId>
```
默认是`tomcat` 

**但如果直接/file/%E5%85%B6%E4%BB%96/logu%65.陪sp是无法访问到logue.jsp**

针对这一点Claude老师是这样说的
![[Pasted image 20260518165142.png]]
##### 具体复现
通过搭建一个实际的jetty环境发现，确实如此
![[Pasted image 20260526101207.png]]

如果使用tomcat的web容器 会发现中文字符串根本不会到 `uriDecode` 方法
可以发现 `阮严灵丰丰甲来` 经过 `uriDecode` 后会变成 `.%u002e`

| 输入      | unicode                                    |
| ------- | ------------------------------------------ |
| 阮严灵丰丰甲来 | \u962e\u4e25\u7075\u4e30\u4e30\u7532\u6765 |
| .%u002e | \u002e\u0025\u0075\u0030\u0030\u0032\u0065 |
高位被截断

![[Pasted image 20260526101721.png]]

具体需要关注的调用栈是:
`spring-core-6.1.5.jar!\org\springframework\util\StringUtils#uriDecode`
**这个方法会对uri中每个/分割的内容进行解码 之后会对整个url path进行解码**

`spring-webmvc-6.1.5.jar!\org\springframework\web\servlet\resource\ResourceHttpRequestHandler#isInvalidEncodedPath`
**判断路径中是否有% 来进入url解码的分支 绕过第一个检查**
![[Pasted image 20260526104843.png]]
使用`URLDecoder.decode`对`path`进行解码
而其中 `isInvalidPath` 是否有跨路径检查 这里就直接通过了检查
![[Pasted image 20260526110237.png]]
随后进入
`spring-webmvc-6.1.5.jar!\org\springframework\web\servlet\resource\PathResourceResolver#getResource`来获取静态资源
![[Pasted image 20260526112239.png]]
其中`encodeOrDecodeIfNecessary`内部的解码调用的是前面提到的`uriDecode`

```java
private String encodeOrDecodeIfNecessary(String path, @Nullable HttpServletRequest request, Resource location) {  
    if (request != null) {  
        boolean usesPathPattern = ServletRequestPathUtils.hasCachedPath(request) && ServletRequestPathUtils.getCachedPath(request) instanceof PathContainer;  
        if (this.shouldDecodeRelativePath(location, usesPathPattern)) {  
            return UriUtils.decode(path, StandardCharsets.UTF_8);   // <- 这里
        }
...

// 调用的是uri
public static String decode(String source, Charset charset) {  
    return StringUtils.uriDecode(source, charset);  
}
```

**对路径进行编码**
![[Pasted image 20260526103906.png]]

最后会在 ServletContext resource 的 path 为 **/** 的时候 返回 `resource`

![[Pasted image 20260526112946.png]]

随后 **Spring** 里的 `ServletContextResource.getURL(...)` 会把一个 `ServletContextResource` 转成 `URL` 通过调用 `ServletContext.getResource(...)` 进入 jetty 的上下文
Jetty 再把这个 web 资源路径，映射到它内部的底层资源系统

![[Pasted image 20260526113801.png]]

而在其中的 `URIUtil.addPath(uri, subUriPath);`会再次解码
![[Pasted image 20260526115118.png]]
其中 针对 `%u002e` 会重新解码成 `%2e` 也就是 **.**
![[Pasted image 20260526115329.png]]
最后造成了路径穿越

整体的流程:
```txt
/阮严灵丰丰甲来/阮严灵丰丰甲来/阮严灵丰丰甲来/阮严灵丰丰甲来/阮严灵丰丰甲来/阮严灵丰丰甲来/windows/win.in%69
--->
/.%u002e/.%u002e/.%u002e/.%u002e/.%u002e/.%u002e/windows/win.ini
-->
file:///C:/Users/W1197/AppData/Local/Temp/jetty-docbase.8080.6599390763312893177/.%2E/.%2E/.%2E/.%2E/.%2E/.%2E/windows/win.ini
->
C:\Users\W1197\AppData\Local\Temp\jetty-docbase.8080.6599390763312893177\..\..\..\..\..\..\windows\win.ini
```

附上一份GPT生成的解释图：
![[ChatGPT Image 2026年5月12日 16_40_12.png]]

其他Ghost bit的产生也类似,需要结合程序具体运行流程和内部实际编码来判断是否存在
### Reference

[vulhub/pull/773](https://github.com/vulhub/vulhub/pull/773)

[Ghost Bits详解](https://mp.weixin.qq.com/s/fIvmKkT6e8d8PY5OruG4mw)

## Bad Vibes - Pwning Coding Agents 70 Times With The Same Bugs

议题分享的是对于一些code agent的命令注入绕过手法

### 简介
对于一些code agent是存在命令执行白名单的 例如claude code
![[Pasted image 20260528095241.png]]

配置之后 让cc直接执行这个命令 不会弹出需要用户确认之类的东西
![[Pasted image 20260528095339.png]]
### 关于powershell的一点小tips
议题中分享了例如`Gemini CLI`是以powershell对命令进行ast解析并于命令白名单(allow list)进行比对
```sh
$ast = [System.Management.Automation.Language.Parser]::ParseInput()
```

可以通过下面的来获取这个方法的重载
```sh
[System.Management.Automation.Language.Parser].GetMethods() |
Where-Object Name -eq ParseInput |
Select-Object Name, @{N='Parameters';E={
    ($_.GetParameters() | ForEach-Object {
        "$($_.ParameterType.Name) $($_.Name)"
    }) -join ', '
}}
```

![[Pasted image 20260528100645.png]]
通过下面这段代码把一段 PowerShell 代码解析成 AST，然后提取其中所有命令，并输出命令名和原始文本
```sh
$ast = [System.Management.Automation.Language.Parser]::ParseInput(
    "dir",
    [ref]$null,
    [ref]$null
)
$commandAsts = $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.CommandAst]
}, $true)
$commandObjects = foreach ($commandAst in $commandAsts) {
    [PSCustomObject]@{
        name = $commandAst.GetCommandName()
        text = $commandAst.Extent.Text.Trim()
    }
}

$commandObjects
```
而powershell本身是支持.NET的语法的 这意味着powershell可以使用一些.NET的特性
比如
```sh
[scriptblock]::Create('calc').Invoke()
```
这段指令是可以被powershell执行调出计算器 但AST解析里面 并不会将其解析成命令
![[Pasted image 20260528103736.png]]
这是一个不错的攻击面 如果能知道code agent对命令的识别逻辑(例如这种使用powershell进行ast解析) 那么可以利用powershell原生对.NET的支持来进行一些特性使用的绕过

### 其他绕过
这些基本都修复了

- 大小写
```json
Mcp.JsOn == mcp.json
```

- 敏感路径的后缀匹配
```sh
/.vscode/settings.json
/.cursor/mcp.json
```

- NTFS
```sh
# fsutil 8dot3name set
# 8.3（Eight-dot-Three）是 DOS / 早期 Windows 的一种文件名格式 
# 现在默认关闭
echo Hello > .\Agent~1\config.json

echo Hello > test.txt::$DATA
```

- 白名单命令利用 例如mv或者cp

- Symlink 符号链接

## Discovering React2Shell: JavaScript’s Long-Awaited Deserialization Flight-mare

议题主要是分享了 React2Shell 的挖掘过程以及一些原理

- Thenable
- RSC

这个漏洞当时在网上引起不少热度
网上的分析都十分详细 不过多赘述