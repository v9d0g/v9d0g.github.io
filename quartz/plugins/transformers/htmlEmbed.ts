import { QuartzTransformerPlugin } from "../types"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import { slugifyFilePath, FilePath } from "../../util/path"
import path from "path"
import fs from "fs"

// 客户端运行时：懒加载注入 iframe 并按需自动撑高。
// Quartz 是 SPA（micromorph），每次 `nav` 事件后重新扫描；已注入的 iframe 用 data 标记防止重复。
const htmlEmbedScript = `(function () {
  var EMBED_CSS = \`
/* 嵌入块占满正文列宽（自适应各种屏幕），并以视口为中心适度加宽、不溢出屏幕 */
.local-html-embed-wrapper{
  width:100%;
  max-width:100%;
  margin:12px 0 20px;
  border:1px solid var(--lightgray);
  border-radius:14px;
  overflow:hidden;
  background:var(--light);
  box-shadow:0 4px 18px rgba(0,0,0,0.06);
  box-sizing:border-box;
}
/* 宽屏桌面：在左右侧栏之间利用空白适度加宽，相对正文列水平居中、永不溢出视口 */
@media (min-width:1200px){
  .local-html-embed-wrapper{
    width:calc(100vw - 320px * 2 - 4rem); /* 视口减去左右侧栏与留白 */
    max-width:1400px;
    margin-left:50%;
    transform:translateX(-50%);
  }
}
/* 可折叠容器 */
.local-html-embed-details{display:block;}
/* 突出的标题栏：可点击折叠/展开，带圆点图标 + 右侧折叠箭头 */
.local-html-embed-meta{
  display:flex;
  align-items:center;
  gap:8px;
  padding:10px 16px;
  font-size:13px;
  font-weight:600;
  letter-spacing:0.01em;
  color:var(--secondary);
  background:var(--highlight);
  cursor:pointer;
  user-select:none;
  list-style:none;
}
.local-html-embed-meta::-webkit-details-marker{display:none;}
.local-html-embed-details[open] > .local-html-embed-meta{border-bottom:1px solid var(--lightgray);}
.local-html-embed-meta:hover{color:var(--dark);}
.local-html-embed-meta::before{
  content:"";
  width:8px;
  height:8px;
  border-radius:50%;
  background:var(--secondary);
  flex:none;
  box-shadow:0 0 0 3px color-mix(in srgb, var(--secondary) 25%, transparent);
}
.local-html-embed-meta-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.local-html-embed-chevron{
  flex:none;
  font-size:12px;
  color:var(--gray);
  transition:transform 0.2s ease;
}
.local-html-embed-details[open] > .local-html-embed-meta > .local-html-embed-chevron{transform:rotate(180deg);}
.local-html-embed-iframe{width:100%;border:0;display:block;background:var(--light);}
.local-html-embed-message{margin:8px 0 16px;padding:12px 14px;border-radius:12px;border:1px solid var(--lightgray);background:var(--lightgray);}
.local-html-embed-message.is-error{border-color:#b91c1c55;}
.local-html-embed-message-title{font-weight:600;margin-bottom:6px;}
.local-html-embed-message-detail{font-size:12px;color:var(--gray);white-space:pre-wrap;}
\`;
  // 不依赖闭包缓存：每次扫描都确认 <style> 真实存在于 <head>，避免 SPA/水合时序导致漏注
  function ensureCss() {
    if (document.getElementById("local-html-embed-style")) return;
    var s = document.createElement("style");
    s.id = "local-html-embed-style";
    s.textContent = EMBED_CSS;
    document.head.appendChild(s);
  }

  function resize(iframe) {
    if (iframe.getAttribute("data-auto-height") !== "true") return;
    var doc = iframe.contentDocument;
    if (!doc) return;
    try {
      var panels = Array.prototype.slice.call(doc.querySelectorAll(".panel"));
      var target = 0;
      if (panels.length) {
        var tabs = doc.querySelector(".tabs");
        var tabsH = tabs ? tabs.getBoundingClientRect().height : 0;
        var actives = panels.map(function (p) { return p.classList.contains("active"); });
        var maxP = 0;
        panels.forEach(function (p) {
          p.classList.add("active");
          maxP = Math.max(maxP, p.scrollHeight, p.getBoundingClientRect().height);
          p.classList.remove("active");
        });
        panels.forEach(function (p, i) { p.classList.toggle("active", actives[i]); });
        target = tabsH + maxP;
      } else {
        target = Math.max(
          doc.body ? doc.body.scrollHeight : 0,
          doc.documentElement ? doc.documentElement.scrollHeight : 0,
          doc.body ? doc.body.offsetHeight : 0
        );
      }
      var bs = doc.defaultView ? doc.defaultView.getComputedStyle(doc.body) : null;
      var pad = bs ? parseFloat(bs.paddingTop) + parseFloat(bs.paddingBottom) : 0;
      var next = Math.ceil(target + pad + 16);
      // 只增不减的抖动太大；这里直接设置，但配合下面的稳定重测避免首次偏窄
      if (next > 0) iframe.style.height = next + "px";
    } catch (e) {}
  }

  // 等 iframe 内容真正稳定后再测量：字体加载完成 + 下一帧重绘 + 持续跟踪尺寸变化。
  // 解决首次访问时因 CSS/字体/图片未就绪导致测出的高度偏小（刷新有缓存所以正常）的问题。
  function stabilizeHeight(iframe) {
    var doc = iframe.contentDocument;
    if (!doc) return;
    var win = doc.defaultView;
    var doResize = function () { resize(iframe); };

    // 立即测一次（兜底）
    doResize();

    // 字体就绪后重测（字体加载会改变内容高度）
    try {
      if (doc.fonts && doc.fonts.ready) { doc.fonts.ready.then(doResize).catch(function () {}); }
    } catch (e) {}

    // 等几帧再测一次，确保首帧渲染完成
    if (win && win.requestAnimationFrame) {
      win.requestAnimationFrame(function () { win.requestAnimationFrame(doResize); });
    }

    // 持续跟踪内容尺寸变化（图片/脚本异步撑开内容时自动跟随）
    try {
      if (win && win.ResizeObserver) {
        var ro = new win.ResizeObserver(doResize);
        if (doc.body) ro.observe(doc.body);
        if (doc.documentElement) ro.observe(doc.documentElement);
      }
    } catch (e) {}
  }

  function setup(iframe) {
    if (iframe.getAttribute("data-embed-init") === "1") return;
    iframe.setAttribute("data-embed-init", "1");
    var applySrc = function () {
      if (iframe.getAttribute("data-loaded") === "1") return;
      var src = iframe.getAttribute("data-src");
      if (!src) return;
      iframe.setAttribute("data-loaded", "1");
      iframe.src = src;
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { applySrc(); io.disconnect(); }
        });
      }, { rootMargin: "200px" });
      io.observe(iframe);
    } else {
      applySrc();
    }
    iframe.addEventListener("load", function () {
      stabilizeHeight(iframe);
      var doc = iframe.contentDocument;
      if (doc && iframe.getAttribute("data-auto-height") === "true") {
        Array.prototype.forEach.call(doc.querySelectorAll("details"), function (d) {
          d.addEventListener("toggle", function () { resize(iframe); });
        });
        Array.prototype.forEach.call(doc.querySelectorAll(".tab"), function (t) {
          t.addEventListener("click", function () { resize(iframe); });
        });
      }
    });
  }

  function scan() {
    ensureCss();
    Array.prototype.forEach.call(
      document.querySelectorAll("iframe.local-html-embed-iframe"),
      setup
    );
  }

  document.addEventListener("nav", scan);
  scan();
})();
`

// 移植自 Obsidian 插件 local-html-embed：
// 将 ```html-embed 代码块替换为一个懒加载的 <iframe>，指向当前笔记目录下 html/ 里的本地 HTML 文件。
// Assets emitter 会把 content 下所有非 md 文件（含 html/ 目录里的 .html/.js/.css 等）按 slugify 规则
// 原样拷贝到输出目录，因此这里直接生成指向真实资源的根相对 URL，资源内部还能引用同目录的 js/css。
export const HtmlEmbed: QuartzTransformerPlugin = (opts) => {
  const userOpts = (opts ?? {}) as { height?: number }

  return {
    name: "HtmlEmbed",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            const curSlug = (file.data.slug ?? "") as string
            const dir = curSlug.includes("/") ? curSlug.substring(0, curSlug.lastIndexOf("/")) : ""

            visit(tree, "element", (node, index, parent) => {
              if (index === undefined || !parent) return

              // 注意：Quartz 的 HAST→JSX 约定下，data-* 属性以 camelCase 形式存在
              // （dataLanguage / dataRehypePrettyCodeFigure），且 className 为数组。
              const isHtmlEmbed = (el: Element) => {
                const cls = el.properties?.className
                if (Array.isArray(cls) && cls.includes("language-html-embed")) return true
                return (
                  el.properties?.["dataLanguage"] === "html-embed" ||
                  el.properties?.["data-language"] === "html-embed"
                )
              }

              // 两种结构都要处理：
              //  1) 未经 pretty-code 的 <pre><code class="language-html-embed">…
              //  2) pretty-code 之后的 <figure data-rehype-pretty-code-figure><pre data-language="html-embed"><code>…
              //     （此时要替换整个 figure，否则残留一个空代码块外壳）
              let code: Element | undefined
              let replaceTarget: { parent: typeof parent; index: number } | null = null

              if (node.tagName === "pre") {
                const c = node.children.find(
                  (x): x is Element => x.type === "element" && x.tagName === "code",
                )
                if (c && (isHtmlEmbed(c) || isHtmlEmbed(node))) {
                  code = c
                  // 若 pre 被 figure 包裹，则让上层 figure 分支统一处理；否则直接替换 pre
                  if (!(parent.type === "element" && (parent as Element).tagName === "figure")) {
                    replaceTarget = { parent, index }
                  }
                }
              } else if (
                node.tagName === "figure" &&
                (node.properties?.["dataRehypePrettyCodeFigure"] !== undefined ||
                  node.properties?.["data-rehype-pretty-code-figure"] !== undefined)
              ) {
                const pre = node.children.find(
                  (x): x is Element => x.type === "element" && x.tagName === "pre",
                )
                const c = pre?.children.find(
                  (x): x is Element => x.type === "element" && x.tagName === "code",
                )
                if (c && (isHtmlEmbed(c) || (pre ? isHtmlEmbed(pre) : false))) {
                  code = c
                  replaceTarget = { parent, index }
                }
              }

              if (!code || !replaceTarget) return

              // 提取代码块文本（pretty-code 可能把内容拆成多个 span/line，递归取所有文本）
              const extractText = (n: {
                type: string
                value?: string
                children?: unknown[]
              }): string => {
                if (n.type === "text") return n.value ?? ""
                if (!Array.isArray(n.children)) return ""
                return n.children.map((c) => extractText(c as never)).join("")
              }
              const text = extractText(code as never)
              const lines = text
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)

              const inputPath = lines[0] ?? ""
              const heightLine = lines[1] ?? ""
              const heightMatch = heightLine.match(/^(\d+)(px)?$/i)
              const requestedHeight = heightMatch
                ? Number(heightMatch[1])
                : userOpts.height
                  ? Number(userOpts.height)
                  : null

              // 渲染一个错误/提示占位块
              const renderMessage = (title: string, detail: string, isError = true): Element => ({
                type: "element",
                tagName: "div",
                properties: {
                  className: ["local-html-embed-message", isError ? "is-error" : "is-info"],
                },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: { className: ["local-html-embed-message-title"] },
                    children: [{ type: "text", value: title }],
                  },
                  ...(detail
                    ? [
                        {
                          type: "element" as const,
                          tagName: "div",
                          properties: { className: ["local-html-embed-message-detail"] },
                          children: [{ type: "text" as const, value: detail }],
                        },
                      ]
                    : []),
                ],
              })

              if (!inputPath) {
                replaceTarget.parent.children[replaceTarget.index] = renderMessage(
                  "html-embed 缺少文件路径",
                  "用法：第一行写 html 文件名，或写 auto 自动匹配同目录 html/ 下与笔记同名的 .html；第二行可选写高度(px)，不写则自动撑开。",
                )
                return
              }

              // 磁盘上的笔记目录（filePath 即磁盘绝对路径）
              const noteDiskPath = (file.data.filePath ?? "") as string
              const noteDiskDir = noteDiskPath ? path.dirname(noteDiskPath) : ""

              // 解析目标 HTML：
              //  - "auto" → 当前笔记目录 html/ 下与笔记同名的 .html
              //  - 以 public/ 或 / 开头 → 视为相对 vault 根的路径（兼容 Obsidian 插件的写法）
              //  - 其他（含 html/xxx.html）→ 相对当前笔记目录
              let relFromContent: string // 相对 content 根的路径（用于生成输出 URL）
              let onDisk: string // 磁盘绝对路径（用于存在性校验）
              if (inputPath.toLowerCase() === "auto") {
                const base = curSlug.includes("/")
                  ? curSlug.substring(curSlug.lastIndexOf("/") + 1)
                  : curSlug
                relFromContent = `${dir ? `${dir}/` : ""}html/${base}.html`
                onDisk = noteDiskDir ? path.join(noteDiskDir, "html", `${base}.html`) : ""
              } else {
                let p = inputPath.replace(/^[./]+/, "").replace(/^\/+/, "")
                if (p.startsWith("public/")) p = p.slice("public/".length)
                if (!p.toLowerCase().endsWith(".html")) p = `${p}.html`
                if (p.startsWith("html/")) {
                  // 相对当前笔记目录的 html/ 子目录
                  relFromContent = `${dir ? `${dir}/` : ""}${p}`
                  onDisk = noteDiskDir ? path.join(noteDiskDir, p) : ""
                } else {
                  // 已是相对 content 根的完整路径
                  relFromContent = p
                  // content 根 = 笔记磁盘目录上移 slug 目录层数
                  const contentRoot = noteDiskDir
                    ? path.join(
                        noteDiskDir,
                        ...dir
                          .split("/")
                          .filter(Boolean)
                          .map(() => ".."),
                      )
                    : ""
                  onDisk = contentRoot ? path.join(contentRoot, p) : ""
                }
              }

              // 校验文件是否存在（不存在则提示，避免线上 404）
              const exists = onDisk !== "" && fs.existsSync(onDisk)

              // 输出 URL：与 Assets emitter 完全一致的 slugify 规则（剥离 .html 扩展名）。
              // 站点以「无扩展名」提供 HTML：dev server 对 *.html 会 301 到无扩展名形式，
              // GitHub Pages 同样将无扩展名 HTML 以 text/html 提供，与全站其它页面一致。
              const fileSlug = slugifyFilePath(relFromContent as FilePath)
              const url = `/${fileSlug}`

              const displayName = relFromContent.split("/").pop() ?? relFromContent
              const meta = `HTML Embed · ${displayName} · ${requestedHeight ? `高度 ${requestedHeight}px` : "高度自动"}`

              const iframeProps: Element["properties"] = {
                className: ["local-html-embed-iframe"],
                "data-src": url,
                title: displayName,
                loading: "lazy",
                referrerpolicy: "no-referrer",
                sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
              }
              if (requestedHeight) {
                iframeProps.style = `height:${requestedHeight}px`
              } else {
                iframeProps["data-auto-height"] = "true"
                iframeProps.style = "height:120px"
              }

              const wrapper: Element = {
                type: "element",
                tagName: "div",
                properties: { className: ["local-html-embed-wrapper"] },
                children: [
                  {
                    type: "element",
                    tagName: "details",
                    properties: { className: ["local-html-embed-details"], open: true },
                    children: [
                      {
                        type: "element",
                        tagName: "summary",
                        properties: { className: ["local-html-embed-meta"] },
                        children: [
                          {
                            type: "element",
                            tagName: "span",
                            properties: { className: ["local-html-embed-meta-text"] },
                            children: [{ type: "text", value: meta }],
                          },
                          {
                            type: "element",
                            tagName: "span",
                            properties: { className: ["local-html-embed-chevron"] },
                            children: [{ type: "text", value: "▾" }],
                          },
                        ],
                      },
                      {
                        type: "element",
                        tagName: "iframe",
                        properties: iframeProps,
                        children: [],
                      },
                    ],
                  },
                ],
              }

              replaceTarget.parent.children[replaceTarget.index] = exists
                ? wrapper
                : renderMessage(
                    "找不到 HTML 文件",
                    `已尝试路径：${relFromContent}\n请确认文件位于当前笔记所在目录的 html 子目录中，或使用相对 vault 根的完整路径。`,
                  )
            })
          }
        },
      ]
    },
    externalResources() {
      return {
        js: [
          {
            loadTime: "afterDOMReady",
            contentType: "inline",
            script: htmlEmbedScript,
          },
        ],
      }
    },
  }
}
