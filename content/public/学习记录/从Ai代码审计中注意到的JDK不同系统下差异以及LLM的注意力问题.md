---
date: 2026-06-04
tags:
  - LLM
  - 代码审计
---
# 简述

近期开发agent的时候发现模型在对比较单一（调用链单一、漏洞类型单一）的代码审计的时候会出现一些很奇怪的问题

模型比较偏向于输出看起来是正确的答案 对于任务会很乐观的结束任务
以及模型往往不会去**考虑你没有提供的信息**，但矛盾的是如果你提供的信息过多，对模型来说又是噪声，反而有可能大大影响了模型的判断

在这个过程中，针对一条确定的链路，多个模型都判断有漏洞，但给出的POC都是无效的，但仍有模型可以给出几乎满分的答案

本文意在通过追根溯源，探索为什么其他模型不能给出这个POC、为什么其他模型都犯了同样的错误、模型识别漏洞的能力边界
## 背景
下面是测试中的一个开源项目的代码的具体片段

上传文件的controller
```java  hl:4
@PostMapping @ApiOperation("上传文件") 
@PreAuthorize("@el.check('storage:add')") 
public ResponseEntity<Object> createFile(@RequestParam String name, @RequestParam("file") MultipartFile file) { 
	this.localStorageService.create(name, file);
	return new ResponseEntity(HttpStatus.CREATED); 
}
```
跟进接口实现 这里主要有几个关键的方法
```java hl:6,7,8
   @Transactional(
      rollbackFor = {Exception.class}
   )
   public LocalStorage create(String name, MultipartFile multipartFile) {
      FileUtil.checkSize(this.properties.getMaxSize(), multipartFile.getSize());
      String suffix = FileUtil.getExtensionName(multipartFile.getOriginalFilename());
      String type = FileUtil.getFileType(suffix);
      File file = FileUtil.upload(multipartFile, this.properties.getPath().getPath() + type + File.separator);
      if (ObjectUtil.isNull(file)) {
         throw new BadRequestException("上传失败");
      } else {
         try {
            name = StringUtils.isBlank(name) ? FileUtil.getFileNameNoEx(multipartFile.getOriginalFilename()) : name;
            LocalStorage localStorage = new LocalStorage(file.getName(), name, suffix, file.getPath(), type, FileUtil.getSize(multipartFile.getSize()));
            return (LocalStorage)this.localStorageRepository.save(localStorage);
         } catch (Exception var7) {
            FileUtil.del(file);
            throw var7;
         }
      }
   }
```

# 关键代码

## getExtensionName
```java hl:4,5,8
   public static String getExtensionName(String filename) {
      if (filename != null && !filename.isEmpty()) {
         int dot = filename.lastIndexOf(46);
         if (dot > -1 && dot < filename.length() - 1) {
            return filename.substring(dot + 1);
         }
      }
      return filename;
   }
```
这个代码的作用是提取字符串`filename`的后缀
首先是提取这个字符串中最后的一个`.` 即ASCII码46
然后判断
- 文件名中存在 `.` 对应条件：`dot > -1`
- `.` 后面还有字符 对应条件：`dot < filename.length() - 1`
在上面这两个条件之下 会从dot+1的地方截取到结尾 相当于在符合这个判断下 会取后缀

除此之外 直接返回文件名
## getFileType
```java
   public static String getFileType(String type) {
      String documents = "txt doc pdf ppt pps xlsx xls docx";
      String music = "mp3 wav wma mpa ram ra aac aif m4a";
      String video = "avi mpg mpe mpeg asf wmv mov qt rm mp4 flv m4v webm ogv ogg";
      String image = "bmp dib pcp dif wmf gif jpg tif eps psd cdr iff tga pcd mpt png jpeg";
      if (image.contains(type)) {
         return "图片";
      } else if (documents.contains(type)) {
         return "文档";
      } else if (music.contains(type)) {
         return "音乐";
      } else {
         return video.contains(type) ? "视频" : "其他";
      }
   }

```
这段代码是针对`getExtensionNam`提取的后缀来判断具体放在哪个文件夹中
## upload
```java hl:4,5,8,9
   public static File upload(MultipartFile file, String filePath) {
      Date date = new Date();
      SimpleDateFormat format = new SimpleDateFormat("yyyyMMddhhmmssS");
      String name = getFileNameNoEx(verifyFilename(file.getOriginalFilename()));
      String suffix = getExtensionName(file.getOriginalFilename());
      String nowStr = "-" + format.format(date);
      try {
         String fileName = name + nowStr + "." + suffix;
         String path = filePath + fileName;
         File dest = (new File(path)).getCanonicalFile();
         if (!dest.getParentFile().exists() && !dest.getParentFile().mkdirs()) {
            System.out.println("was not successful.");
         }
         file.transferTo(dest);
         return dest;
      } catch (Exception var10) {
         log.error(var10.getMessage(), var10);
         return null;
      }
   }
```
随后就是上传
其中`filePath`为`this.properties.getPath().getPath() + type + File.separator` 几乎没什么影响 一个绝对的路径
然后其中又有几个判断
### getFileNameNoEx
```java
   public static String getFileNameNoEx(String filename) {
      if (filename != null && !filename.isEmpty()) {
         int dot = filename.lastIndexOf(46);
         if (dot > -1) {
            return filename.substring(0, dot);
         }
      }
      return filename;
   }
```
这个方法是用于提取一个文件名中的非扩展名
具体逻辑也是按照最后一个`.`所在的位置来的
### verifyFilename
```java
   public static String verifyFilename(String fileName) {
      fileName = fileName.replaceAll("[\\\\/:*?\"<>|~\\s]", ""); // 删除非法字符
      fileName = fileName.trim().replaceAll("^[. ]+|[. ]+$", ""); // 删除首尾的点和空格
      int maxFileNameLength = 255;
      if (System.getProperty("os.name").startsWith("Windows")) { // 设置最大长度
         maxFileNameLength = 260;
      }
      if (fileName.length() > maxFileNameLength) { // 超长截断
         fileName = fileName.substring(0, maxFileNameLength);
      }
      fileName = fileName.replaceAll("[\\p{Cntrl}]", ""); // 删除控制字符
      fileName = fileName.replaceAll("\\.{2,}", ""); // 删除连续多个点
      fileName = fileName.replaceAll("^\\.+/", ""); // 处理路径穿越
      // 这一步 保留最后一个扩展名，把扩展名前面的所有 `.` 全部删除
      fileName = fileName.replaceAll("^(.*)(\\.[^.]*)$", "$1").replaceAll("\\.", "") + fileName.replaceAll("^(.*)(\\.[^.]*)$", "$2");
      return fileName;
   }
```
而这里 就是开发者的安全约束了
主要是对http请求中 filename的约束
## 分析过程
看起来滴水不漏 特别是`verifyFilename`中 多个正则来进行过滤 但其实存在缺陷
具体看`upload`方法

首先 我们能发现最终的`path`是通过拼接的 其中`filePath` 几乎不可控（由前面的代码可知，是没有可控制的字段）

那么关键就是在 `fileName`这里了 这个参数中 `name` 和 `suffix`是用户输入过滤处理之后的值
```java hl:8,9,4,5
   public static File upload(MultipartFile file, String filePath) {
      Date date = new Date();
      SimpleDateFormat format = new SimpleDateFormat("yyyyMMddhhmmssS");
      String name = getFileNameNoEx(verifyFilename(file.getOriginalFilename()));
      String suffix = getExtensionName(file.getOriginalFilename());
      String nowStr = "-" + format.format(date);
      try {
         String fileName = name + nowStr + "." + suffix;
         String path = filePath + fileName;
         File dest = (new File(path)).getCanonicalFile();
         if (!dest.getParentFile().exists() && !dest.getParentFile().mkdirs()) {
            System.out.println("was not successful.");
         }
         file.transferTo(dest);
         return dest;
      } catch (Exception var10) {
         log.error(var10.getMessage(), var10);
         return null;
      }
   }
```

那么`getFileNameNoEx`、`verifyFilename`、`getExtensionName`就是关键

通过前文发现这两个`getXXX`方法都是通过对`.`的定位来获取前缀后缀的

一般的文件都是 `xxx.xxx` 的格式 但是如果我们这里输入的文件是 `xxx.xxx.` 的格式

```java
getFileNameNoEx("xxx.xxx.")="xxx.xxx" // 返回最后一个点之前的所有内容
getExtensionName("xxx.xxx.")="xxx.xxx." // 返回全量的内容
```

如果仅仅这样 那么最后的拼接是
```java
"xxx.xxx"+"-时间戳"+"."+"xxx.xxx."= "xxx.xxx-时间戳.xxx.xxx."
```
我们这里发现 因为通过`.`拼接的存在 如果能让`getExtensionName`返回类似`/../../../xx`的内容 就直接穿越过去了
同时`getExtensionName`根本没有任何限制 如果以`.`结尾 那么输入什么输出就是什么 也就是上面的`/../../`的跨目录是很容易实现的
**但由于还是会有个`.`结尾 所以即使穿了文件 貌似最终文件还是以`xxx.`的格式被保存** 这样看起来貌似没用

**但是**`(new File(path)).getCanonicalFile();`在windows上 是会将路径末尾的点给去掉

具体可以参考JDK的[文档](https://github.com/openjdk/jdk/blob/master/src/java.base/windows/native/libjava/canonicalize_md.c)

所以如果输入的文件名是 `/../../../../xxx.xxx.` 在windows下面就会被去掉最后一个点 造成危害更大的路径穿越

# JDK系统层面差异(文件方面)
针对文件处理这一块 windows系统和linux系统存在一些差异 但具体的差异应该是不止这些情况
## getCanonicalPath() & getCanonicalFile()
前文提到的针对`.`结尾的文件
![[Pasted image 20260605110503.png]]
## equals()
老生常谈的文件大小写
![[Pasted image 20260605110631.png]]

## isHidden()
也是老生常谈的隐藏文件的判断
![[Pasted image 20260605110825.png]]
# Ai分析
大部分ai都分析出来是漏洞 但POC基本都是下面 这种
![[Pasted image 20260604174704.png]]

这种完全是不行的 路径穿越有两个前提条件
- windows系统
- filename必须以`.`结尾

但貌似我尝试的很多模型（deepseek v4 pro、kimi 2.6、claude sonnet 4.6等等）都没走到这一步

于是我开始重新分析我的prompt
起初我并没有分析代码 我瞟了眼模型分析的逻辑 以为是正则绕过的问题 于是我加上了一些对**正则识别**的prompt

结果失败

后面我以为是模型并没有穷尽式的考虑各个分支的问题 于是我又加了一些**考虑分支情况**的判定

结果依旧无法让模型吐出这个结果 甚至多轮询问 模型会判定这里是安全的

随后我直接把正常payload发给模型 模型很乐观的推翻了之前的判定 并认可了我的payload

但思考内容中也没有说这里即使穿越了目录 仍有`.`结尾文件的这个硬性限制 而且也没有反应过来是系统差异导致的问题

于是我再添加了一部分**考虑系统API差异性**的prompt

GPT直接返回说没有问题（不排除Web Chat端的一些system prompt有干扰）

![[Pasted image 20260604180942.png]]

有意思的是 这个有效的特定前提可运行POC也是GPT（Web Chat端）给我的
## 纠正Ai判断

这一块我是想完全发挥ai自己的总结能力和学习能力来解决这个问题的 于是我把关键代码提取
```java fold title:"TestApp"
package com.example.demo;  
  
import dev.langchain4j.model.openai.OpenAiChatModel;  
  
import java.io.File;  
import java.io.IOException;  
import java.text.SimpleDateFormat;  
import java.util.Date;  
import java.util.HashMap;  
import java.util.Map;  
  
public class TestApp {  
    public static String verifyFilename(String fileName) {  
        fileName = fileName.replaceAll("[\\\\/:*?\"<>|~\\s]", ""); // 删除非法字符  
        fileName = fileName.trim().replaceAll("^[. ]+|[. ]+$", ""); // 删除首尾的点和空格  
        int maxFileNameLength = 255;  
        if (System.getProperty("os.name").startsWith("Windows")) { // 设置最大长度  
            maxFileNameLength = 260;  
        }  
        if (fileName.length() > maxFileNameLength) { // 超长截断  
            fileName = fileName.substring(0, maxFileNameLength);  
        }  
        fileName = fileName.replaceAll("[\\p{Cntrl}]", ""); // 删除控制字符  
        fileName = fileName.replaceAll("\\.{2,}", ""); // 删除连续多个点  
        fileName = fileName.replaceAll("^\\.+/", ""); // 处理路径穿越  
        // 这一步 保留最后一个扩展名，把扩展名前面的所有 `.` 全部删除  
        fileName = fileName.replaceAll("^(.*)(\\.[^.]*)$", "$1").replaceAll("\\.", "") + fileName.replaceAll("^(.*)(\\.[^.]*)$", "$2");  
        return fileName;  
    }  
  
    public static String getFileNameNoEx(String filename) {  
        if (filename != null && !filename.isEmpty()) {  
            int dot = filename.lastIndexOf(46);  
            if (dot > -1) {  
                return filename.substring(0, dot);  
            }  
        }  
        return filename;  
    }  
  
    public static String getExtensionName(String filename) {  
        if (filename != null && !filename.isEmpty()) {  
            int dot = filename.lastIndexOf(46);  
            if (dot > -1 && dot < filename.length() - 1) {  
                return filename.substring(dot + 1);  
            }  
        }  
        return filename;  
    }  
  
    public static void main(String[] args) throws IOException {  
        Date date = new Date();  
        SimpleDateFormat format = new SimpleDateFormat("yyyyMMddhhmmssS");  
        String filePath = "W:\\test\\其他\\";  
        String input = "../../../evil.";  
        String name = getFileNameNoEx(verifyFilename(input));  
        String suffix = getExtensionName(input);  
        String nowStr = "-" + format.format(date);  
        String fileName = name + nowStr + "." + suffix;  
        String path = filePath + fileName;  
        System.out.printf("拼接后:%s\n",path);  
        File dest = new File(path).getCanonicalFile();  
        System.out.printf("getCanonicalFile后:%s",dest);  
  
    }  
}
```

并将其喂给claude 
![[Pasted image 20260605162743.png]]并经过了两轮的对话修改：
第一轮是因为给出的提示词太特化了 并不是泛化的总结
![[Pasted image 20260605162809.png]]
第二次是因为我拿一些模型测试了下 并没有得到我想要的结果
![[Pasted image 20260605162826.png]]

### Web Chat
随后针对以下这些模型进行了单独的测试
（因为经费有限，没办法直接使用api测试，这里难免会受到web chat的system prompts和其内置的agent功能影响）
![[Pasted image 20260605162937.png]]

#### **Claude Sonnet 4.6 low**
![[Pasted image 20260605163058.png]]
失败

#### **Claude Opus 4.6 high**
借用了一下别人的key
![[Pasted image 20260605170931.png]]
满分答案 但这个消耗就有点伤不起了

#### **ChatGPT 思考模式**
![[Pasted image 20260605163254.png]]
对吗？不全对，错了吗？也不全错
```sh
# windows:
拼接后:W:\test\其他\aa-20260605043406735.a\\\\..\\\\..\\\\.
getCanonicalFile后:W:\test

# linux
拼接后:/test/user/aa-20260605043735625.a/../..
getCanonicalFile后:/test
```
不过也很令人满意了
但再次新会话 同样的内容 结果就不一样了

#### **DeepSeek 深度思考 专家模式**
![[Pasted image 20260605163925.png]]
经典的错误标准的0分

#### **GLM 5**
![[Pasted image 20260605164205.png]]
依旧0分

#### **Qwen3.7-Max**
![[Pasted image 20260605164254.png]]
意料之外几乎满分答案 甚至把这里的系统JDK差异也解释了，但是忽略了其实在linux上漏洞不成立

而且第二次Qwen也复现出来
![[Pasted image 20260605171811.png]]
但遗憾的是第三次的回答并没有如同预期一样

光靠模型**看**代码来挖掘漏洞 看来还是具有很多局限性
#### **Kimi 2.6 思考模式**
![[Pasted image 20260605164411.png]]
自己把自己给想宕机了



**上面的探索并没有踩拉任何一个模型，只是探索LLM代码审计的边界**