---
date: 2025-12-17
tags:
  - 代码审计
  - "#CodeQL"
  - 分享
  - LLM
---
# 前言
最近看到了一篇今年black hat上的议题——[Finding The Needle In The Haystack Of CodeQL Using LLMs](https://blackhat.com/eu-25/briefings/schedule/#flaw-and-order-finding-the-needle-in-the-haystack-of-codeql-using-llms-49247)

这个议题的方向刚好是我最近在学习和研究的内容，如何结合着大模型来辅助静态应用安全测试。

要使用大模型来挖掘漏洞，下面的问题是必须找到解决方案的：
- 大模型是预测而非理解
- 代码的`哪里`（代码哪里存在漏洞）以及`什么`（什么类型的漏洞）问题，提供的需要大模型选择的信息越多，大模型的幻觉越严重
![[Pasted image 20251218175001.png]]

CodeQL的确是一个很强大的工具，但是学习成本较高，辅助漏洞挖掘的能力和QL编写者的水平强相关

但大模型具有十分强大的推理和预测能力，那么使用CodeQL来协助大模型会有不一样的效果

议题中提出了一种大模型和CodeQL来辅助排查误报以及挖掘漏洞的方法：
对源代码进行静态的扫描，生成[SARIF](https://docs.github.com/zh/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)文件，针对这个告警文件，让大模型对其代码切片进行分析，并按需自己查找细节部分
# 分析
具体过程可以简单抽分成下面步骤：
## 数据库构建
这里仍然以webgoat靶场为例
## 上下文索引生成
首先通过CodeQL生成所有相关函数定义索引，以**java**为例：
```sql
import java
from 
Method callee
where 
callee.getLocation().getStartLine()>0
and
callee.getLocation().getNumberOfLinesOfCode()>0
select
callee as method,
callee.getFile().getAbsolutePath() as filePath,
callee.getLocation().getStartLine() as startLine,
callee.getLocation().getStartLine()+callee.getLocation().getNumberOfLinesOfCode() as endLine
```
我们需要的只是
函数名|文件绝对路径|开始行|结束行
![[Pasted image 20251217170418.png]]

*这里可以继续优化一下，因为出现了`<obinit>`这种非需要的数据*

将其导出为`csv`文件
```sh
codeql query run context.ql --database <database> --output=./test1.bqrs

codeql bqrs decode ./test1.bqrs --format=csv --output=./context.csv
```
可以获得形如以下图中的索引示例：
![[Pasted image 20251217111214.png]]
## 告警生成
随后获取源代码`src`的告警文件`results.sarif`
同样是使用CodeQL来生成
```sh
codeql database analyze <src> <rules> --format=sarif-latest --output=results.sarif
```
其中
- `<src>`为源代码路径 
- `<rules>`为ql的扫描规则，例如官方[SDK](https://github.com/github/codeql)中 **/java/ql/src/Security/CWE/**

SARIF文件提示在`xxx.java`的`yy`行有`qqq`的问题（该消息来源于文件中`results`对象的值中）
![[Pasted image 20251217110101.png]]

议题中指出，这种扫描会得到巨量的告警，其中真实的问题可能只是极少极少的一部分（个人感觉甚至有可能全是误报），如果人工审查，需要耗费相当久的时间
![[Pasted image 20251217110317.png]]
## 大模型筛选
而接下来，为了提升效率便引入了大模型的初筛模式

因为sarif文件提供了具体的问题和代码位置(`fileURI`、`startLine`)，那么可以根据索引文件，让大模型自己去找对应的切片
```json
"results":[
	{
	"locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "fileURI"
                },
                "region": {
                  "startLine": 2,
                  "startColumn": 7,
                  "endColumn": 10
                }
              }
            }
          ]
	}
]
```

LLM根据sarif提供的告警信息，利用索引文件查找对应切片->根据片段中出现的函数（变量）按需利用索引文件查找切片

（索引文件中包含了切片的范围）
![[Pasted image 20251217111926.png]]
这里可以使用MCP来实现，让大模型思考需要哪些详细的信息，然后自行查找详细信息
### 模型引导式提问（Guided Questions Prompt）
由于问题的类型是客户端提出的（即sarif文件），大模型可能会建立在这个问题存在的基础上，所以需要对提示词进行优化，让大模型判断：“这个问题是否真实存在？原因是什么？”
![[Pasted image 20251217112333.png]]
- 它们在哪里声明？大小是多少？大小是否会变化？
- 若值来自其他变量，那些变量在哪里声明、大小多少？
- 是否存在任何边界检查、sanitization、条件分支约束？
- 还有哪些操作会影响这些变量？

最终格式化输出大模型的分析结果，提高人工复查的效率
# 简单实现
sarif文件的质量与CodeQL提供的规则的质量有很大的联系

换句话说，如果扫描的1000个告警里面，有一个是真实漏洞，那么这个告警信息可以说是可用的。但就算扫描出10000个告警，0个真实漏洞，那也只是无用信息。

如果使用开源的规则示例来扫描java靶场，几乎是不会出现有价值的信息，而且全部扫描一遍十分耗时

所以这里demo实现通过人工提供告警信息，省略了对sarif文件获取的编排处理，让大模型筛选，架构简略图如下
![[Pasted image 20251218085618.png]]
`WorkSpace`定义了一些列行为，分别是：
- 修改、查看当前工作区配置（CodeQL数据库位置，源码语言环境，索引文件位置）
- 根据文件位置和起始行，获取对应内容
- 根据函数名，在索引文件中查找定义的局部切片
- 通过文件位置和告警行数，确定具体函数局部切片范围

## CVE分析
为了更进一步的测试，根据议题中通过这种方式实际挖掘出来的漏洞（CVE-2025-27151）作为案例，再次分析
![[Pasted image 20251217152659.png]]

该漏洞的影响范围是`>=7.0.0`
最新修复在版本`8.0.2`，修改[信息](https://github.com/redis/redis/releases/tag/8.0.2)，[漏洞通告](https://nvd.nist.gov/vuln/detail/CVE-2025-27151)

查看commit[修改部分](https://github.com/redis/redis/commit/643b5db235cb82508e72f11c7b4bbfc7dc39be56)
![[Pasted image 20251217153049.png]]
可以定位到关键点，`memcpy`函数也是经常告警的点之一

redis在windows上貌似编译很麻烦
直接切换到wsl上创建CodeQL数据库

确认一下wsl的编译环境
```sh
make -v
GNU Make 4.3
Built for x86_64-pc-linux-gnu
Copyright (C) 1988-2020 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

gcc -v
...
gcc version 13.3.0 (Ubuntu 13.3.0-6ubuntu2~24.04)
```
### 生成数据库
```sh
./codeql database create /home/v9d0g-l/codeql/codeql-db/redis --language="c" --command="make" --source-root /home/v9d0g-l/coding-review/redis-7.0.0
```
### 索引生成
可以通过以下的ql来生成对所有函数定义的切片索引
```cpp
import cpp

from Function callee
where 
callee.getLocation().getStartLine()>0
and 
callee.getDefinition().getNumberOfLines()>0
select
callee as method,
callee.getFile().getAbsolutePath() as filePath,
callee.getDefinitionLocation().getStartLine() as startLine,
callee.getDefinitionLocation().getStartLine() + callee.getDefinition().getNumberOfLines() as endLine
```
生成的查询结果是可用的
![[Pasted image 20251217171445.png]]

*QL还需要改进，仍会命中非源码部分，比如依赖库*

由于我是在wsl上生成的codeql数据库，所以数据库中文件路径是wsl的镜像中的，不过这里可以先导出csv文件，然后跑个脚本把路径前缀改成windows主机上的就行

首先是从wsl上导出csv索引
```sh
./codeql query run /home/v9d0g-l/codeql/codeql-db/redis/codeql-custom-queries-cpp/example.ql --database /home/v9d0g-l/codeql/codeql-db/redis --output=/home/v9d0g-l/codeql/codeql-db/redis/context.bqrs


./codeql bqrs decode /home/v9d0g-l/codeql/codeql-db/redis/context.bqrs --format=csv --output=/home/v9d0g-l/codeql/codeql-db/redis/context.csv
```

然后将csv文件中wsl上的路径修改为windows上的源码路径
![[Pasted image 20251217172701.png]]

`/home/v9d0g-l/coding-review/redis-7.0.0`-->`W:\coding-review\redis-7.0.0`
### LLM筛选
为了让大模型的推理过程可以有理可据，联动知识库文件作为参考
这里我提供了常用编程语言的安全编码规范
![[Pasted image 20251218150223.png]]
提供上一级调用的告警信息，但不指明漏洞类型
![[Pasted image 20251218102624.png]]
```txt
设置工作区
数据库路径 W:\coding-review\redis-7.0.0
语言类型 c
csv文件路径 W:\coding\ql\output\context.csv

告警
W:/coding-review/redis-7.0.0/src/server.c 
6933行
```
这里并没有分析到`memcpy`函数上，但给我提供了一条另外的分析信息
但官方应该不认可这是个漏洞，个人也比较倾向于这是一个bug，不过已经提交给官方
在将告警信息下移一个调用层，就有了对应的信息
![[Pasted image 20251218174644.png]]
并且信息中也提到了关键问题——`filepath`参数没有校验
## 疑问
上面是针对静态扫描的结果来进行误报排查，由于是简单实现，肯定有很多地方有待改进：
- 效率问题
- 提示词和llm本身能力
- 告警的质量

想要做出工程化的工具是比较难的，特别是融入到整个项目代码的workflow里面（我也没那么多高质量的codeql扫描规则）

并且如果要让大模型输出可信度极高的信息，仅仅是一个函数定义的切片索引是完全不够的

一个有效的漏洞应该是从可控数据->函数的不安全调用方式，这条路径是有向且可达才行

- 对函数切片的有效分析（`良好的代码设计模式会让函数入参在函数体内校验有效性，所以关注定义切片往往是有效的`）
- 给模型的提示词的质量
- 模型本身的能力
- 本地检索的知识库的质量
- Agent拓展的能力

> [!NOTE] 函数切片有效分析：
> 1.函数入参外部是否可达
> 2.入参的sanitizer
> 3.函数内的跟参数有关所有函数调用（语言内置函数、重写的语言内置函数、新定义的函数）
> 3.返回值

# 一点想法
拓展工具的功能，让其不仅仅是针对静态扫描结果来分析，还能辅助工程师进行代码审计：
用户提供一个**Suspicious point**（这个可以是某个函数名称、某个文件的某一行），根据这个point，llm按需获取需要的信息，比如对应的函数切片上下文、宏定义，随后联系整个窗口信息，分析问题

初始化一个工作区，包含
- CodeQL数据库路径
- 语言类型
- 需求信息的索引
其中索引文件包含函数定义、宏定义
可以根据这个索引准确获取信息或者代码切片

根据知识星球中大佬的交流记录
![[Pasted image 20251222093125.png]]

大模型无法理解代码仍然是一个问题，所有的回答都是基于已有的统计
*`大模型无法做到从0到1 也无法做到从80到100`*

现在针对大模型回答的不够专业的问题，也有RAG和上下文工程来解决，所以让分析更具有说服力可以让专业知识覆盖面广，单一问题场景更有深度

并且其推理是通过一个固定的上下文窗口（貌似现在大部分是128K token）
但一个函数的调用链有时会比较长，或者调用链中涉及到的函数定义片段，会十分长

这里如果让大模型来收集信息并分析信息，上下文必然会很臃肿，为了解决这个问题，分而治之是一个比较好的方案——用多个agent做不同的事

**Director**：和用户交互，分析用户需求，调用其他agent
- 用户读写工作区、创建索引
- 分析问题需要哪些信息
- 将当前问题所需的关键信息传输给Secretary

**Secretary**：对每个问题保存其关键信息

**Analyst**：清洗信息，获取Secretary中的当前问题所有信息，只关注当前分析的问题和提供的信息，单个问题单个上下文窗口

**Copilot**：作为Analyst的知识库？目的是辅助让Analyst的分析具有更高的专业性，符合CWE

![[Pasted image 20251223161814.png]]

# Reference

[Finding The Needle In The Haystack Of CodeQL Using LLMs](https://blackhat.com/eu-25/briefings/schedule/#flaw-and-order-finding-the-needle-in-the-haystack-of-codeql-using-llms-49247)

[From Naptime to Big Sleep: Using Large Language Models To Catch Vulnerabilities In Real-World Code](https://projectzero.google/2024/10/from-naptime-to-big-sleep.html)

[Fenrir 是一个基于 MCP 协议与 AST 技术的代码审计工具](https://github.com/ChangeYourWay/Fenrir-CodeAuditTool)

[基于RAG与领域微调的CodeQL漏洞检测框架](https://mp.weixin.qq.com/s/6CDjSGnwaZv_mAVRF_QTpA)

[AI代码审计的探索实践](https://mp.weixin.qq.com/s/IQNrm3TdntOsPw0cISjGrg)

[当Agent有了“长情”的大脑：深度拆解与对比Mem0/Graphiti/Cognee三大开源Memory方案](https://mp.weixin.qq.com/s/sdi3rgDRiRWhsmbDWc-w-g)

[LLM 提高 SAST 的代审效率的思考方向](https://mp.weixin.qq.com/s/yBebaXDsNVQVNNwmlzDE8g)

[System Prompts and Models of AI Tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools)

[codeql standard libraries](https://codeql.github.com/codeql-standard-libraries)

[Hi，我是 OceanBase PowerMem，了解一下？](https://mp.weixin.qq.com/s/Hl7x2fLK0nh1raTBPm-nHw)