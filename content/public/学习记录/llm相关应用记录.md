---
date: 2025-12-24
tags:
  - LLM
  - 持续更新中
  - LangChain
---
# Agent
Agent 是一种以LLM为决策核心的自动化系统架构，可以进行环境感知、进行决策我、采取行动

像人类一样，如果要让一个Agent能够完整的、足够专业的完成一个任务，其任务所需的领域知识、工作流程等这一类信息都是必不可少的。并且信息的质量越高，完成的结果往往会越好。

对于Agent，这类信息往往是嵌入到prompt中，但llm对于上下文始终是有限的，而提供的信息中不可避免的有噪声信息

## ReAct
ReAct = Reasoning（推理）+  Acting（行动），本质是一种让语言模型通过与外部工具、环境动态交互完成复杂任务的智能体架构范式
![[Pasted image 20251225172807.png]]

具有可追溯的推理过程，有理有据
调用工具获取真实数据，避免幻觉
不需要微调，使用大模型自带的预测学习能力

核心过程TAO
Thought 推理
Act 行动
Observe 观察

[Agent全面爆发！一文搞懂背后的核心范式ReAct！](https://mp.weixin.qq.com/s/YQfqLoL1Z94yx9z48CE8bQ)


## Multi-agent

针对这一问题有很多解决方案，其中[Multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)可以在应对要拆解比较复杂的任务处理流程时，防止上下文中的信息膨胀

`multi-agent`是由多个agent组成的集合，最顶层作为调度者(**supervisor**)，其他称为[Subagent](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents)

`subagent`是无状态的，每次的调用都是在一个独立的上下文窗口中调用，那么该`agent`只需关注他当前处理的任务所需要的信息，避免了不必要信息的污染，对于处理完的结果直接返回给主`agent`

# LangChain & LangGraph
[官方文档](https://docs.langchain.com/oss/python/langchain/overview)
[github 教程](https://github.com/BrandPeng/Langchain1.0-Langgraph1.0-Learning)
## Chat Model
兼容OpenAI模型初始化
```python
# pip install langchain
# pip install langchain_openai

from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="deepseek-ai/DeepSeek-V3.2",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
    api_key="sk-***",
    base_url="https://api.siliconflow.cn",
)
```
### 基础使用
invoke：与Chat Model交互的最基本方式，就是聊天本身，它接收一段消息列表作为输入，并返回一段消息列表作为输出。
```python
# 同步
# 多轮对话 
messages = [ 
SystemMessage(content="你是一个Python专家"),
HumanMessage(content="如何读取文件？"),
AIMessage(content="可以使用open()函数..."), 
HumanMessage(content="那写入呢？")]

llm.invoke(message)

# 异步调用方式
llm.ainvoke(message)
```
stream：允许Chat Model在生成输出时采用流式输出的方式。

支持异步调用

batch：允许用户将多个请求批量传入Chat Model以提高处理效率。
bind_tools：允许用户将一个工具绑定给Chat Model，使模型能在执行上下文时使用这个工具。
with_structured_output：针对支持结构化输出的模型，这个方法能够自动完成将模式绑定到模型并按给定模式解析输出的过程。
## Message
![[Pasted image 20260104111853.png]]
下面三种方式等价
```python
model.invoke("Hello")  
model.invoke([{"role": "user", "content": "Hello"}])  
model.invoke([HumanMessage("Hello")])
```

SystemMessage是预设模型行为
配置全局prompt,设定角色
## Template
用于构建复杂prompt的组件
```python
from langchain_core.prompts import PromptTemplate

template = PromptTemplate( input_variables=["source_lang", "target_lang", "text"], template="请帮我将以下{source_lang}翻译成{target_lang}：\n\n{text}" )
prompt = template.format( source_lang="中文", target_lang="英文", text="你好，世界" )

from langchain_openai import ChatOpenAI
# 使用管道操作符 
llm = ChatOpenAI() chain = template | llm 
result = chain.invoke({ "source_lang": "中文", "target_lang": "英文", "text": "你好，世界" })
```
除此之外还预设了不同Message的模板
`SystemMessagePromptTemplate, HumanMessagePromptTemplate, ChatPromptTemplate`

以及其他功能
`MessagesPlaceholder`-消息占位符
`PipelinePromptTemplate`-管道组合多模块

## Tools
使用`@tool`装饰器将普通函数转化为langchain可以调用的工具
**需要明确参数类型**
```python
@tool
def func1(param1:str,param2:int) -> list:
```
可以使用`pydantic`定义参数的数据模型
使用装饰器的参数作为参数模型
```python
from pydantic import BaseModel, Field  
from typing import Literal  
  
class WeatherInput(BaseModel):  
    """Input for weather queries."""  
    location: str = Field(description="City name or coordinates")  
    units: Literal["celsius", "fahrenheit"] = Field(  
        default="celsius",  
        description="Temperature unit preference"  
    )  
    include_forecast: bool = Field(  
        default=False,  
        description="Include 5-day forecast"  
    )
    
@tool(args_schema=WeatherInput)  
def get_weather(location: str, units: str = "celsius", include_forecast: bool = False) -> str:```
总的来说
```python
from langchain_core.tools import tool

@tool(
    name: Optional[str] = None, # 工具别称
    description: Optional[str] = None, # 工具描述
    return_direct: bool = False, # 是否将结果直接返回给用户
    args_schema: Optional[Type[BaseModel]] = None, # 参数模型
    infer_schema: bool = True, # 是否从函数签名自动推断参数 schema
    parse_docstring: bool = False, # 是否解析 docstring 来提取参数描述
    error_on_invalid_docstring: bool = True,# 当 docstring 格式无效时是否抛出错误
    response_format: Literal["content", "content_and_artifact"] = "content" # 控制工具返回的格式
)
```

## LangGraph
### State
State 在 LangGraph 中是一个在图的节点之间传递和更新的数据结构。它类似于一个共享的内存空间，记录了应用程序的当前状态，包括对话历史、中间结果、用户输入等信息

定义 继承`TypedDict`的数据结构
```python
from typing import TypedDict

class XxxState(TypedDict):
	xxx: str
	yyy: int
```

[深入理解 LangGraph：构建复杂AI应用的Graph图框架 - Agent框架底层的压舱石](https://mp.weixin.qq.com/s/YSQgYWB5ZiEMnnlRdsG9EQ)

[从零开始学LangGraph](https://mp.weixin.qq.com/s/ozu0YMTXlM9yPZf5EEnvAw)

