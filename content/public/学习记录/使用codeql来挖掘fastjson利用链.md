---
date: 2025-12-11
tags:
  - 代码审计
  - "#CodeQL"
  - 分享
---
# 前言
传言道，fastjson漏洞是使用codeql挖掘出来的。本文站在模拟首次通过codeql挖掘fastjson的角度来尝试和分析，如何编写对应ql。
# Fastjson 1.2.24分析
选取一个很老的版本来进行分析
## 环境搭建
```xml
<dependency>  
    <groupId>com.alibaba</groupId>  
    <artifactId>fastjson</artifactId>  
    <version>1.2.24</version>  
</dependency>
```

```sh
git clone https://github.com/alibaba/fastjson.git

cd fastjson

git describe --tags

git checkout tags/1.2.24
```
POC:
调用`JSON.parseObject(String json)`
```json
// json

{            
"a":{            
"@type":"java.net.Inet4Address",            
"val":"1f************."            
}            
}
```
不需要这个`a`键来包裹也可以
![[Pasted image 20251205095303.png]]
## 原理分析
跟进
->`com.alibaba.fastjson.JSON#parseObject(String text)`
![[Pasted image 20251205143552.png]]
这里要使用`parse`方法创建一个对象`obj`，继续跟进
->`com.alibaba.fastjson.JSON#parse(String text)`
![[Pasted image 20251205143650.png]]
虽然只传入了`text`，但会进行方法重载，并使用默认值`DEFAULT_PARSER_FEATURE=989`，继续跟进
->`com.alibaba.fastjson.JSON#parse(String text, int features)`
![[Pasted image 20251205141138.png]]
其中，把传入的字符串`text`、默认值`features=989`以及一个新的对象`ParserConfi`作为`DefaultJSONParser`的参数，创建了一个对应的对象
继续跟进
## new DefaultJSONParser()
### ParserConfig
->`com.alibaba.fastjson.parser.ParserConfig`
`DefaultJSONParser`对象中的第二个参数是`ParserConfig.getGlobalInstance()`，通过对应源码可以知道，这是用来获取管理JSON解析过程配置的全局单例
![[Pasted image 20251205151331.png]]
#### SymbolTable
这个全局单例初始化了一个固定大小的`SymbolTable`(符号表)
![[Pasted image 20251205153149.png]]
其构造函数为
![[Pasted image 20251205142826.png]]
用于将字符串存储到一个哈希表中，以便快速查找、去重、和优化内存使用
可以看到，对我们传入的键和值进行了一个缓存，防止重复频繁的创建字符串对象
![[Pasted image 20251205142142.png]]
#### IdentityHashMap
->`com.alibaba.fastjson.util.IdentityHashMap`
![[Pasted image 20251205153249.png]]
`ParserConfig`在反序列化的过程维护了常用类型和反序列化器(`ObjectDeserializer`)的对应关系，并将该对应关系存放至`IdentityHashMap`，同时维护了一个黑名单`denyList`
![[Pasted image 20251205153316.png]]
当解析JSON数据时，会根据`Type`查找合适的反序列化器。并且：
如果 JSON 中有@type字段，会根据该类型动态选择反序列化器
```java
JSON.parseObject(String json);
```
->`getDeserializer(Type type)`
![[Pasted image 20251205154744.png]]
如果没有@type 字段，则会根据 JSON 数据结构推断类型，获取类与反序列器的对应关系，并在最后存入`IdentityHashMap`
```java
JSON.parseObject(String json, Person.class);
```
->`getDeserializer(Class<?> clazz, Type type)`
![[Pasted image 20251205155800.png]]
到这里对`ParserConfig`告一段落，从新回到`DefaultJSONParser`
### DefaultJSONParser
前面是通过
->`com.alibaba.fastjson.JSON`中
`new DefaultJSONParser(text, ParserConfig.getGlobalInstance(), features)`
来创建，但后续又会进行重载
->`com.alibaba.fastjson.parser.DefaultJSONParser#DefaultJSONParser(String input, ParserConfig config, int features)`
->
`com.alibaba.fastjson.parser.DefaultJSONParser#DefaultJSONParser(Object input, JSONLexer lexer, ParserConfig config)`
![[Pasted image 20251205161042.png]]
简单来讲，这个构造器是为JSON解析过程做准备工作，确保解析器能够正确识别JSON数据的类型，并在后续的解析过程中逐步解析出JSON的各个部分，这里的解析使用的是一种[token机制](https://blog.csdn.net/qq_45946035/article/details/122155191)

到这里就成功创建了`DefaultJSONParser`对象，随后就是调用其`parse()`方法
## DefaultJSONParser.parse()
依旧是回到
->`com.alibaba.fastjson.JSON#parse(String text, int features)`
![[Pasted image 20251205162150.png]]
`parse()`方法也会重载，最终执行
->`com.alibaba.fastjson.parser.DefaultJSONParser#parse(Object fieldName)`
其中参数是null，这里不用在意
![[Pasted image 20251205162403.png]]
根据`this.lexer.token()`的值，进行不同的解析操作：
数字、布尔值、`null`、日期、JSON 对象、数组、集合等

当`this.lexer.token`为12时候执行
```java
JSONObject object = new JSONObject(lexer.isEnabled(Feature.OrderedField));  
return this.parseObject((Map)object, fieldName);
```
进入格式校验，其中对`@type`字段的处理
![[Pasted image 20251208090913.png]]
经过格式校验，最终调用
->`ObjectDeserializer deserializer = this.config.getDeserializer(clazz);`
这个方法就是前面`ParserConfig`提到的方法了，获取了`@type`对应的类的反序列化器
这里由于是使用的`java.net.Inet4Address`，属于提前预加载的表中之一，所以直接返回了反序列化器，但其实一般利用则是走的后续逻辑
![[Pasted image 20251208091532.png]]

这里如果使用非缓存中的类，比如
```java
package com.example.demo;  
  
public class Person {  
    private String name;  
    private int age;  
  
    // 无参构造函数  
    public Person() {}  
  
    // 有参构造函数  
    public Person(String name, int age) {  
        this.name = name;  
        this.age = age;  
    }  
  
    // getter 和 setter 方法  
    public String getName() {  
        System.out.print("触发getName方法");  
        return name;  
    }  
  
    public void setName(String name) {  
        System.out.print("触发setName方法");  
        this.name = name;  
    }  
  
    public int getAge() {  
        return age;  
    }  
  
    public void setAge(int age) {  
        this.age = age;  
    }  
}
```
调用
```java
JSON.parseObject(String json, Person.class);
```

便会走到上图中的第二个判断逻辑
![[Pasted image 20251208094031.png]]
这条处理逻辑的调用链：
![[Pasted image 20251208095227.png]]
其中`JavaBeanInfo.build()`会循环获取`setter or getter`
`DefaultJSONParser#parseObject()->JavaBeanDeserializer#deserialze()`反序列化创建对象

`JavaBeanDeserializer#deserialze()->JavaBeanDeserializer#parseField()->DefaultFieldDeserializer#parseField()->FieldDeserializer#setValue()->java.lang.reflect.Method#invoke()`
调用反射

其中对于`String`->`Object`，会使用`setter`赋值，反之则使用`getter`取值

# CodeQL挖掘
假设我们是从零开始挖掘fastjson 1.2.24的漏洞，那么source是可以确定的
`source: JSON.parseObject()`
其中，在假设情况的日常使用中，肯定会逐渐发现`JSON.parseObject()`会调用`setter`
```java
System.out.print(JSON.parseObject(json2,Person.class).getAge());

// 有setter
/*
{"name":"alice","age":"20"}
触发setName方法
20
*/

// 没有setter
/*
{"name":"alice","age":"20"}
触发setName方法
0
*/
```
如果类对象缺少默认构造函数，反序列化肯定失败（不会抛异常，但是成员变量的值是 null）。

如果类对象的 private 成员变量缺少 setter，反序列化肯定失败，除非在反序列化调用 JSON.parseObject 时，加上参数 Feature.SupportNonPublicField。特殊情况是，针对 AtomicInteger/AtomicLong/AtomicBoolean/Map/Collection 类型的成员变量，如果缺少对应的 setter，也是能反序列化成功的。

同样的，如果一个类对象没有 getter，则序列化也会失败的（不会抛异常，会输出空的“{}”字符串）。

具体可以参考这篇[文章](https://xie.infoq.cn/article/dcb61126e58c23ff2cf4731c1?utm_source=chatgpt.com)
## 原理
结合上文，我们就需要找到一个类，其`setter`中有可以利用的点

比如class A中有一个可以利用的方法，使用了成员变量作为参数，同时这个可利用方式被另外一个setter触发，这就构成了一条利用链
```java
public class A{
	private String p;
	private String s;
	
	setP(String p){
		this.p=p;
	}
	
	setS(String s){
		this.s=s;
		this.utils();
	}
	
	public utils(){
		exec(this.p);
	}
}
```
通过`@type`指定class A，先设置成员p作为参数，然后设置s来触发

这就是fastjson 1.2.24中`JdbcRowSetImpl`利用链的原理

## 模拟
为了模拟1.2.24的`JdbcRowSetImpl`调用链

可以根据其逻辑写一个demo~~其实是懒得编译jdk~~

![[Pasted image 20251211161648.png]]
```java
package com.example.demo;


import java.io.IOException;

public class Evil {
    private String param;
    private Boolean safe;

    public void setParam(String param) {
        this.param = param;
    }

    public String getParam() {
        return param;
    }

    public void setSafe(Boolean safe) {
        if (safe){
            this.safe = true;
            this.Utils();
        }else{
            return;
        }
    }

    public Boolean getSafe() {
        return safe;
    }

    public void Utils(){
        try{
            Runtime.getRuntime().exec(this.getParam());
        }catch(IOException e){
            System.out.printf(String.valueOf(e));
        }
    }
}
```
而为了实现对这种调用链的匹配，可以通过编写ql来约束
```java
import java

class SetterMethod extends Method {
    SetterMethod() {
        // 名字中有set且长度大于3
        this.getName().matches("set%") and
        this.getName().length() > 3 and
        // 必须有一个参数
        this.getNumberOfParameters() = 1 and
        // 是public且非static方法
        this.isPublic() and not 
        this.isStatic()
    }
}

/** this.field */
predicate isThisFieldExpr(Expr e) {
  exists(FieldAccess fa |
    fa = e and
    fa.getQualifier() instanceof ThisAccess
  )
}

/** this.getX() */
predicate isThisGetterCall(Expr e) {
  exists(MethodCall ma |
    ma = e and
    ma.getQualifier() instanceof ThisAccess and
    ma.getMethod().getName().matches("get%")
  )
}

/** 任意嵌套访问 */
predicate exprRefersToThisField(Expr e) {
  exists(Expr part |
    e.(Expr).getAChildExpr*() = part and
    (isThisFieldExpr(part) or isThisGetterCall(part))
  )
}


from Expr arg,MethodCall methodCall1,MethodCall methodCall2, SetterMethod setter
where 
methodCall1.getArgument(0) = arg 
and 
exprRefersToThisField(arg)
and
methodCall2.getEnclosingCallable() = setter
and
methodCall1.getCaller() = methodCall2.getMethod()
select "在类:",methodCall1.getCompilationUnit(),"中的setter",setter,"调用方法:",methodCall1.getCaller(),"使用参数:",arg,"最终执行:",methodCall1.getMethod()
```

![[Pasted image 20251210143525.png]]
## 问题
但细想，这种写法还是有很多缺陷的

- 不能匹配getter的参数流具体到了能够利用的方法（例如：命令执行、远程加载等等）上，只是找到了会影响的方法（上面的例子是因为我写的是exec，但实际情况肯定会匹配到其他无害方法）
- 上面的写法是对调用的约束，但codeql比较偏向于使用node来分析数据流，使用数据流来分析确实更加合理
- codeql对像jdk这种超大型的项目代码好像并不是那么容易创建数据库，如果针对底层做静态分析，目前没有找到什么很方便的方法
