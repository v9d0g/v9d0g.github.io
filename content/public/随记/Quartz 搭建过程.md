---
date: 2025-11-25
tags:
  - 分享
  - 持续更新中
---
记录搭建过程以及美化的一些方案
# 本地搭建
## 环境安装
[git下载](https://git-scm.com/)，克隆仓库
```sh
git clone https://github.com/jackyzha0/quartz.git
cd quartz
```
[npm下载](https://nodejs.org/en/download)
版本：
![[Pasted image 20251125114359.png]]
安装依赖，初始化
```sh
npm i
npx quartz create
```
![[Pasted image 20251125114736.png]]
## 启动应用
*注意：从仓库直接clone下来的文件默认会忽略public文件夹，如果要使用`\content\public`作为公开文件夹，需要注释掉*
![[Pasted image 20251125141541.png]]
删除`docs`文件夹
创建文件夹`/content/public`文件夹，并将`index.md`文件移动到该文件夹
```sh
# --directory=content/public 只渲染content/public目录下文件
# --serve 本地热加载
# --port 本地端口 默认8080端口
# --output 指定生成html文件生成路径
npx quartz build --directory=content/public --output=docs --serve
```
本地成功启动
![[Pasted image 20251125181610.png]]
## 其他
其余设置，诸如：国际化、页面修改、插件使用......可参考[官方文档](https://github.com/jackyzha0/quartz)或者其他[笔者文档](https://quartz.songxingguo.com/)
# 对外开放
前面是本地搭建的简单流程，如果你想要对外开放，并搭建站点，我推荐使用Github Pages自带的静态网页功能。

~~绝不是因为网上的教程我没办法复现~~

## 前期工作
- [ ] 本地可以正常使用Quartz（相关环境配置完成）
- [ ] 本地能够正常使用git
## 仓库创建与本地链接
登录github，创建一个空的仓库（不需要README等）命名为==`username`.github.io==
![[Pasted image 20251125172706.png]]
[生成对应token](https://cloud.tencent.com/developer/article/1852589)（注意权限），让本地可以拉取这个仓库并提交修改，可参考下面的权限
![[Pasted image 20251125174709.png]]
进入quartz项目
```sh
cd quartz
```
修改远程仓库
```sh
git remote set-url origin https://github.com/xxx/xxx.github.io.git

# 记住token
git config --global credential.helper store
```
**使用其他方式也可（比如直接fork)，目的是要在github上有一个username.github.io的仓库，里面内容就是quartz项目，且本地可以git push等操作**

## 本地obsidian&quartz联动
使用obsidian打开`/xxx.github.io/content`作为仓库
*个人喜好设置obsidian的图片保存路径，这样删除图片的时候比较方便，会在对应md文件的文件夹中生成一个images文件夹专门存放图片*
![[Pasted image 20251125175230.png]]
本地构建quartz，生成静态文件并选择目标路径为`docs`（删除原docs文件夹中内容，该文件夹主要是一些插件介绍文档）
```sh
npx quartz build --directory=content/public --output=docs
```
提交修改
```sh
git add .
git commit -m "xxx"
# 可不选择v4分支
git push origin v4
```
## github静态托管
打开仓库->settings->Pages->Build and deployment->Source->Deploy from a branch
![[Pasted image 20251125173005.png]]
选择分支和文件夹
该文件夹就是生成的静态html文件的路径，选择docs
![[Pasted image 20251125180204.png]]
到这里，你访问`https://xxx.github.io`即可看见页面了

后续通过obsidian编写文章，写完后通过
```sh
npx quartz build --directory=content/public --output=docs

git add .
git commit -m "xxx"
git push origin v4
```
即可同步

# 其他问题
## QUE.1_重新构建不会删除遗留文件
通过使用
```sh
npx quartz build
```
后，创建的静态html并不会根据你markdown文件夹的结构进行更新，即会出现以下这种情况：

曾存在`content/public/test/test.md`文件，页面可以访问test.md的内容，且index页面有链接索引

删除`content/public/test/test.md`后，index页面仍有链接索引，但test.md已经不可访问，404错误

> [!WARNING] Temp：
> 使用一个批处理，每次push到仓库之前都点击一下
> 260319更新：使用一个批处理，完成删除以前的内容 重新构建 重新push
> 

```sh
@echo off
setlocal

echo ==============================
echo [1/3] 清理 docs 目录
echo ==============================

if exist "%cd%\docs" (
    rmdir /s /q "%cd%\docs"
    if exist "%cd%\docs" (
        echo ❌ 删除 docs 失败
        goto :end
    )
)

echo ✅ docs 已清理

echo.
echo ==============================
echo [2/3] 构建 Quartz
echo ==============================

REM ★关键：防止 npx 吃掉后续流程
call npx quartz build --directory=content/public --output=docs

if errorlevel 1 (
    echo ❌ 构建失败
    goto :end
)

echo ✅ 构建完成

echo.
echo ==============================
echo [3/3] Git 提交
echo ==============================

git add . || goto :end
git commit -m "docs:更新文章" || goto :end
git push origin v4 || goto :end

echo.
echo 🎉 全流程完成！

:end
echo.
echo 按任意键退出...
pause >nul

endlocal
```

## QUE.2_图片问题
本人编写笔记高度依赖obsidian，并且obsidian也支持很多插件，例如图片缩放插件——[image toolkit](https://github.com/obsidian-community/obsidian-image-toolkit)

但通过quartz生成的静态文件貌似不能同步obsidian的插件，网页无法通过点击图片来进行缩放图片
> [!NOTE] Resolved：
> 
> 使用[插件](https://github.com/vazome/quartz-clickable-images-zoom-plugin)可以实现简单的点击阅览

但这样的方式并不能在点击图片后进一步放大，而且图片的尺寸较小的情况，文本会围绕图片
> [!NOTE] Resolved：
> 修改图片插件`clickableImages.ts`内容，并且插件已经实现了懒加载，具体可以参考本仓库中的[代码](https://github.com/v9d0g/v9d0g.github.io/blob/v4/quartz/plugins/clickableImages.ts)
## QUE.3_github comments

想要实现类似github中的评论功能，但这样似乎仅仅靠github pages无法实现，评论是需要数据库的

> [!NOTE] Resolved：
> 使用[评论插件](https://xaoxuu.com/wiki/stellar/comments/)，本次选择的是[Utterances](https://github.com/utterance/utterances)
> 
> 安装[插件](https://github.com/apps/utterances)，获取对应js代码，将其内容插入到`quartz\components\Footer.tsx`中

![[Pasted image 20251203151035.png]]

原计划是使用中文版[utterances](https://github.com/utterance/utterances)，即[beaudar](https://github.com/beaudar/beaudar)

但不知道什么原因，beaudar-bot并不能在我初次评论的时候创建对应的issue，隧止
## QUE.4 obsidian 白板canvas适配

obsidian官方有一个插件——[json-canvas](https://github.com/obsidianmd/jsoncanvas)
可以将obsidian生成的`.canvas`的类json文件转化为一个画布
可以根据这个代码而开一个Quartz插件
使用类似图片嵌入的方式
```txt
![[ xxx.canvas ]]
```
![[test.canvas|test]]

来渲染当前目录下的canvas，内嵌到正文中

> [!NOTE] Resolved：
> 思路是创建一个插件`quartz\plugins\transformers\canvas.ts`
> 让其生成一个嵌入的iframe 并传递`文件夹/xxx.canvas`路径 由于是静态资源 在初始化的时候会在docs下备份一份`xxx.canvas` 所以可以通过访问文章的方式 直接通过url访问canvas的json数据
> 
> `quartz\static\`在该目录下编写一个`canvas-view.html`用于接收 canvas的json数据 并进行渲染

全程使用ai编写 无人工参与

1.暂时并不能随着Quartz的明暗风格切换
2.markdown语法高亮是使用外部cdn 会增加加载时间

后续有时间应该会优化

---

- 时间：260622

发现更改页面的风格后，这个canvas由于各种原因会导致页面撕裂，闪屏，经过一系列排查后发现不了具体原因，直接更改为类似于图片放大的弹出页面来查看，避免页面撕裂的情况

## QUE.5 代码框的行号、关键字高亮
- 时间：260605
想实现一个代码框的具体行号高亮的功能 而obsidian有一个[插件](https://github.com/mayurankv/Obsidian-Code-Styler)提供了类似功能

使用claude将其迁移到Quartz上即可
高亮
```python hl:1
print("hello world")
print("hello world")
print("hello world")
```

行号起始偏移
```python ln:27
print("hello world")
print("hello world")
print("hello world")
```

折叠
```python fold
print("hello world")
print("hello world")
print("hello world")
```

代码块标题
```python title:"test.py 不折叠"
print("hello world")
print("hello world")
print("hello world")
```

标题变为可点击链接
```python ref:[Label](url) 
print("hello world")
print("hello world")
print("hello world")
```


计划将该仓库清理一下 毕竟现在相对于原版 已经添了不少自己的内容