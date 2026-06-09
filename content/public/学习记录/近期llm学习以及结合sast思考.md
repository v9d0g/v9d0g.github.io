---
date: 2026-01-29
tags:
  - 随记
  - LLM
  - 代码审计
---
# 前言
起初是看到cyberark在black hat上的这个议题[vulnhalla](https://www.cyberark.com/resources/threat-research-blog/vulnhalla-picking-the-true-vulnerabilities-from-the-codeql-haystack) 随后进行了一些简单的复现和拓展：
通过生成源代码的codeql数据库,再提供一个入口函数,agent可以自己根据调用链,逐层的往下获取代码片段并分析

实现的效果有可取之处,但想要落地成一个完整的应用还有很多要改进的地方

本文主要是总结在整个llm+sast的学习尝试过程中的遇到的问题、学习的心得等等
# LLM应用历程
近年llm发展迅速,从单一的聊天机器人逐渐演化成如今可以执行各种操作的智能bot(agent),其发展历程即是llm应用的落地历程

归结来看,主要还是从提示词工程和上下文工程以及模型本身进行的一系列突破,其中比较值得参考和学习的就是提示词和上下文工程了

因为不是每人都能接触到模型开发的底层工作,想要DIY一个自己的大模型应用,提示词的设计,工作流的编排,上下文工程的设计是首要学习和实现的目标

从一开始的`Function Call`到提出`MCP`规范、`Agent`的实现,再到进一步提升`Agent`能力的`Skill`,每一个阶段都解决和完善了上一个阶段的一些问题,知其然才能知其所以然
## Function Call
函数调用,顾名思义,不过融入了llm,不再是人工编写代码的call来调用,而是人工编写提供工具函数,llm通过将自然语言转化为这个工具函数的入参并调用,如下例子
```python
nlp_input="""
今天是2026年1月29日 我想查看今天的天气
"""

def get_weather(data:str):
	...
	return 
```
llm获取到文本,通过模型自身的语言理解能力,理解意图,解析出参数
最终执行`get_weather("2026/01/29")`的功能

在langchain中也有工具函数的简单实现
```python
from langchain.tools import tool

@tool
def get_weather(data:str):
	'''
	description for function.
	'''
	...
	return 
```
使用`tool`装饰器可以将某个函数标记为模型的可用工具,其中函数的`__doc__`会嵌入到提示词中,来解释该函数的作用是什么
```python
from langchain_openai import ChatOpenAI

base_tools=[get_weather]
base_llm=ChatOpenAI()
base_llm.bind_tools(base_tools)
```
通过`bind_tools()`来提供工具,但是llm并不是直接执行工具,而是在返回的消息中包含了需要调用的工具名称+工具入参

当然现在langchain也提供了可以直接调用工具的`create_agent`,但是由于真实情况的复杂性,这种方式还不能覆盖到全部使用的场景,最显著的例子就是**这种功能只能提供给支持这些功能的llm接口**

所以如果从langchain的`bind_tools`入手,需要手动解析返回的消息中的`tool_calls:list`
获取工具名和参数进行执行(由于中间过程可控 其实更推荐这种方式)

## MCP
由于在工具调用这个阶段,不同的llm应用开发基座他们对于工具的调用意图返回信息不一致,mcp是为了统一这种数据规范的一个协议

不过很多地方还是使用的diy的数据结构

## Agent
llm+tools就可以构成一个简单的agent
让llm作为大脑指挥,tools作为工具,mcp作为大脑和四肢的一个信号
便可以实现类似
```python
nlp_input="我要吃饭"
brain="目标是吃饭 需要调用吃饭函数 提供'手'+'餐具'作为输入参数"
eat('手','餐具')
```
的一套过程

不过这种方式太单一,有点像小时候被老师教训的"像个癞蛤蟆,戳一下跳一下"

所以如果要让agent能够像人类一样做事,就得模拟一套人类的做事思路工作流

在此基础上,一些agent的开发范式被提出
### ReAct
该范式分为三个部分**思考-行动-观察**

- **Thought (思考)：** 这是智能体的“内心独白”。它会分析当前情况、分解任务、制定下一步计划，或者反思上一步的结果。
- **Action (行动)：** 这是智能体决定采取的具体动作，通常是调用一个外部工具，例如 `Search['华为最新款手机']`。
- **Observation (观察)：** 这是执行`Action`后从外部工具返回的结果，例如搜索结果的摘要或API的返回值。

这种方式会在`思考`的时候调用一次对话
解析返回的内容 进行`行动`
随后将`思考`+`行动`结果作为输入,再调用一次对话进行`观察`,解析`观察`结果,判断是否再次`思考`及后续

这种方式也属于上下文工程的一种,过长的思维链会导致上下文爆炸,使用的时候需要注意这一点

不过这种方式挺适合做SAST的
一个完整的分析肯定是要逐步逐步获取信息的,一个有效利用链从source入手肯定是要多次观察才能找到sink
### Plan-and-Solve
顾名思义,规划->然后执行
由于两个阶段的职责明确,对于一些任务导向的工作,十分好用
生成一个类似于`check list`的结果,然后一步一步执行,claude的代码编写中常见的就是这种模式
![[Pasted image 20260131103906.png]]
但这种模式无法实现对于需要反复迭代才能产生结果的任务

### Reflection&Ralph Loop
这是在前面两种agent的执行范式之上的设计方式

重点是让模型在固定任务上不断修正输出直到满足完成条件。它通过外部强制控制避免了 LLM 自我评估的局限性

当agent开始执行任务并认为完成时,拦截试图退出的动作,重新注入原始任务提示,从而创建一个**自我参照的反馈循环**

也就是**执行 -> 反思 -> 优化**的loop过程

### 补充
除了agent开发范式之外，还存在对agent编排调度的一些架构
这些架构在多agent()的基础之上

例如：
[agent-teams](https://code.claude.com/docs/zh-CN/agent-teams)
[agent-swarms](https://relevanceai.com/learn/agent-swarms-orchestrating-the-future-of-ai-collaboration)

## Skill
在前面提到的工具调用中,为了让llm知道有哪些工具可以用以及怎么用,每次会话都会注入`工具说明书`,这天然的导致了对上下文窗口的挤占

如果工具库非常庞大,那么在理解用户意图之前,光是工具说明书就占了很大篇幅,会影响到需求的分析和执行

为了解决这个问题,`Skill`便诞生了
skill的关键点是**渐进式披露**,通过提供一个类似于工具说明书的目录,按需去阅读工具说明书

例如[obsidian-skills](https://github.com/kepano/obsidian-skills)
启动claude 并输入安装指令
```sh
/plugin marketplace add kepano/obsidian-skills
/plugin install obsidian@obsidian-skills
```
![[Pasted image 20260304094718.png]]

克隆skill项目在~/.claude/skills中,重启claude,输入`/skills`即可发现已经安装
![[Pasted image 20260304094932.png]]

使用skill
![[Pasted image 20260304104113.png]]
![[Pasted image 20260304104126.png]]
生成的符合obsidian语法的canvas
![[TOEIC备考学习规划.canvas]]

# LLM与SAST如何结合
在llm出来之前,各路大佬各显神通,开发了不少适合代码审计的工具
通过规则Fuzzing和静态分析是两个比较主流的方向

现在的llm对代码的理解能力已经超过了一般程序员,并且由于开放api的模型在训练时,会有大量安全相关的知识,所以对常规设计缺陷和漏洞的提示能力也比较强,通过合适的prompt,可以提高llm对漏洞和缺陷的敏感程度,进一步的识别

目前也有比较有意思的项目——[DeepAudit](https://github.com/lintsinghua/DeepAudit)
该项目的一些架构解析可以参考这篇[文章](https://mp.weixin.qq.com/s/aXhJiCHrbohMcMjUprB9lg),deepaudit几乎是完全靠大模型自己的代码理解能力来分析,所以高质量的模型对输出的结果有很强的关联

在使用`Pro/deepseek-ai/DeepSeek-V3.2`模型的情况下,针对[xxl_job](https://github.com/xuxueli/xxl-job)的扫描
![[Pasted image 20260131141633.png]]
大约耗费两块钱,遗憾的是,扫描出来的结果均不可用,当然这也是意料之中
但该项目的技术栈是非常值得学习的,这个项目也是llm用于漏洞挖掘的一个很好的尝试

 **"哪些工作可以被替代"以及"这些工作该如何让llm来完成"** 这是一个十分值得思考且必须解决的问题,llm参与到代码审计工作中,他的能力边界究竟在哪里?
## 到底该给大模型什么内容?
对于llm来说,提示词的重要性堪比大脑中的脑细胞对于大脑,一个优秀的提示词可以让大模型的注意力完全约束在你的可控范围之中,让其专注于你想让他专注的事情

不少文章里面也提到过,大模型对多类型的漏洞分辨和识别能力并没有太好,但**如果你指明漏洞类型,那大模型会更加关注这种类型,效果往往会更好**,这也是目前有部分静态扫描+llm验证的工具出发点

不过这种方式有点类似与拿着答案来讲题,如果指明的漏洞本身就是错误的不存在的,那不仅不会生成有效信息,还会造成多余的损耗,从结果上看只是把人工验证的部分替换成了llm验证,覆盖并不完全(人工在验证的过程中还有可能关联到其他的验证从而得出新的结论,llm可能很难做到这一点)

一个漏洞的产生往往不是一条简单的线性调用链
而是source->sanitizer->sink的一个数据流向,这个数据流中的调用关系很有可能是有环的 

其中,source一般很容易得出
例如:codeql官方提供的查询方式
![[Pasted image 20260225105214.png]]
IDEA对spring项目自带的映射
![[Pasted image 20260225105027.png]]
框架组件的api doc
![[Pasted image 20260226083627.png]]

而确定是否存在漏洞的工作量聚焦于**sink是否存在?sanitizer是否存在以及是否有效?路径是否可达?**

如果要让大模型参与到整个审计过程,大模型肯定是需要理解代码的对应逻辑的,也就是要提供充足的**相关**上下文,但过量的代码很容易撑爆对话上下文以及影响大模型的注意力,~~特别是java这种又臭又长的代码风格~~

回到人工审计是如何开展的,在人工审计的时候往往是通过在IDEA中函数方法的跳转来查看相关代码.而由于人工是能理解污点传播和数据流,即在一个函数体中,输入究竟经过哪些处理,最终到底到了哪里

而在agent skill中有lsp实现类似IDEA中函数定义跳转的功能
![[Pasted image 20260305111904.png]]

- 但如果代码中有非依赖项的内置函数,类似java中直接引入的库函数, 如果再次进行跳转,将会添加不必要的上下文

> [!NOTE] 解决思路：
> 在提示词中引入当前模块引入的依赖列表,显式的让llm知道有哪些依赖

- 同时,如果引入了外部依赖,大模型能否关联到这个接口的内部实现,从而判断当前的效用方式是否是安全的,这也是值得考究的问题

- 某些特定框架(mybatis)所需的上下文并非代码而是文件文本内容,不过在使用skill的情况下,其他skill可以提供读取文件的功能,但这个调用过程对审计的整个工作来说依旧有消耗

- 同时,外部可控参数可能是一个类、结构体.类有自己的各种方法,例如普通的函数方法或者setter、getter,类可以嵌套其他类 结构体也可以嵌套其他的结构体,如果要把参数的完整定义给agent,那又得增加上下文的负担

`入参结构体嵌套了其他的结构体的情况`
![[Pasted image 20260226094329.png]]

仅仅从函数方法出发的话,把跟所有相关的代码都添加到上下文,先不论能不能提供到相关性十分高的代码,本身的量就已经很大了
例如代码:
![[Pasted image 20260226092851.png]]
`粗略的调用情况`
![[Pasted image 20260226092733.png]]
给出全量代码让llm进行分析 这种效果并不会有多好 而且即有可能会撑爆上下文 所以要对内容进行裁剪

### 思路
如果维护一个不安全方法类型的规则（数据库类操作，文件类操作，网络类操作，系统类操作等等）
并以这个为sink反向找出整条单向调用链，例如使用java的字节码分析工具得到以下信息：
![[Pasted image 20260305164146.png]]
首先将这个单向调用链的代码+函数签名+涉及的依赖名称+调用的方法对应的函数签名列表提供给模型

同时提供工具 可以根据函数签名确定到唯一的代码片段 以及当前代码中 调用的其他方法 对应的签名内容

那么就可以让agent进行一个`分析<->动态扩充上下文`的循环，最终判断数据是否汇入sink

但这种方式存在一定缺陷 

首先链条本身内容可能前缀出现相同
比如
A<-B<-C<-D<-E
G<-F<-C<-D<-E
入口都是一样的 只是最终调用的不同 会出现前缀重复的代码信息

其次是速率问题 大点的项目 单向的链条会指数级上涨
一条简单的链条（即不会涉及任何动态扩充上下文）分析起步是半分钟
而复杂的链条的时间会极其不稳定

虽说可以使用多线程和多agent的方式来加快速度 但这样token消耗也是一个难以解决的问题

同时 **既然我可以得到目标调用链条的信息，为什么还要把代码信息给llm？**
完全可以根据这个链条信息 让llm在一定的例子基础上 直接编写ql或者其他静态的分析工具 判断数据流汇入是否有效

首先目前的llm生成完整可运行的ql这方面能力并不强大 完全独立生成可用的查询不大现实 就算使用模板来 也不一定能覆盖全

不过使用其他的静态工具辅助分析是一个不错的想法 实现`工具集`+`LLM`会更好的将初步结果清洗 但也存在问题——对于多语言的漏洞检测不会有那么通用

不同语言具有不同的特性 有些是在某类语言之上多出了某种特性 有些又会是存在特性差异

不过总的来说 通过一个sink规则配置筛出 `入口--??-->最终调用sink` 的这个数据
给agent结合通过其他工具进行验证
感觉是比较可靠的方式

后续计划会逐渐完善这个思路




# Refer
[Function calling | OpenAI API](https://platform.openai.com/docs/guides/function-calling)

[Tools - Docs by LangChain](https://docs.langchain.com/oss/python/langchain/tools)

[Agents - Docs by LangChain](https://docs.langchain.com/oss/python/langchain/agents)

[hello-agents](https://github.com/datawhalechina/hello-agents)

[Extend Claude with skills](https://code.claude.com/docs/en/skills)

[自动化漏洞挖掘：过去、现在与未来——AI 的上限在哪里？](https://atum.li/cn/blog/ai-vuln-discovery-evolution/)

[DeepAudit](https://github.com/lintsinghua/DeepAudit)

[拆解DeepAudit](https://mp.weixin.qq.com/s/aXhJiCHrbohMcMjUprB9lg)

[Vulnhalla: Picking the true vulnerabilities from the CodeQL haystack](https://www.cyberark.com/resources/threat-research-blog/vulnhalla-picking-the-true-vulnerabilities-from-the-codeql-haystack)

[从灵感到落地：用Claude Skills实现"一键代码审计"全过程](https://mp.weixin.qq.com/s/3Cq4ptqLFoTr03vSqE5riA?click_id=7)

[基于 Agent Team代码审计的 "五大避坑” 指南](https://mp.weixin.qq.com/s/cxGVuS6-C9ZinQBPwMR-Eg)

[obsidian-skills](https://github.com/kepano/obsidian-skills)

[agent-teams](https://code.claude.com/docs/zh-CN/agent-teams)

[agent-swarms](https://relevanceai.com/learn/agent-swarms-orchestrating-the-future-of-ai-collaboration)
