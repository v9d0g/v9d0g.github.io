import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { Code } from "mdast"
import { Element, Root as HastRoot } from "hast"
import { slugifyFilePath, FilePath } from "../../util/path"

// ───────────────────────────────────────────────
// Obsidian Code Styler → rehype-pretty-code 适配插件
//
// 支持的参数：
//   title:xxx / title:"xxx" / title:'xxx'
//   ln:true / ln:false / ln:27
//   hl:1,3-4,foo,"bar baz",/regex/     (数字范围交给 rehype-pretty-code；文本/正则做行级匹配)
//   info:2 / warn:4-6 / error:8          (自定义高亮颜色)
//   ref:[[Note]] / ref:[Label](url)      (标题链接)
//   fold / fold:"描述"
//   {1,3-4}                              (兼容语法，原生支持)
// ───────────────────────────────────────────────

interface FoldInfo {
  collapsed: boolean
  text?: string
}

interface RefInfo {
  type: "internal" | "external"
  text: string
  href: string
}

interface FileData {
  codeStyler?: {
    folds: Map<number, FoldInfo>
    noLineNumbers: Set<number>
    textHighlights: Map<number, string[]> // index → text/regex patterns
    refs: Map<number, RefInfo> // index → link info
    total: number // code 节点总数，用于验证
  }
}

// ── hl 解析 ────────────────────────────────────

interface HlParseResult {
  numericRanges: string
  textPatterns: string[]
}

function parseHlValue(value: string): HlParseResult {
  const parts: string[] = []
  let i = 0

  while (i < value.length) {
    while (i < value.length && value[i] === " ") i++
    if (i >= value.length) break

    let part = ""

    if (value[i] === '"' || value[i] === "'") {
      const quote = value[i]
      i++
      const start = i
      while (i < value.length && value[i] !== quote) i++
      part = value.slice(start, i)
      if (i < value.length) i++
    } else if (value[i] === "/") {
      i++
      const start = i
      while (i < value.length && (value[i] !== "/" || value[i - 1] === "\\")) i++
      part = "/" + value.slice(start, i) + "/"
      if (i < value.length) i++
    } else {
      const start = i
      while (i < value.length && value[i] !== ",") i++
      part = value.slice(start, i).trim()
    }

    if (part) parts.push(part)
    if (i < value.length && value[i] === ",") i++
  }

  const numericParts: string[] = []
  const textPatterns: string[] = []

  for (const part of parts) {
    if (/^\d+(?:-\d+)?$/.test(part)) {
      numericParts.push(part)
    } else {
      textPatterns.push(part)
    }
  }

  return {
    numericRanges: numericParts.join(","),
    textPatterns,
  }
}

// ── ref 解析 ───────────────────────────────────

function parseRef(value: string): RefInfo | undefined {
  value = value.trim()

  // [[Note Title]]
  const internalMatch = value.match(/^\[\[(.*?)\]\]$/)
  if (internalMatch) {
    const text = internalMatch[1]
    const href = "/" + slugifyFilePath(text as FilePath, true)
    return { type: "internal", text, href }
  }

  // [Label](url)
  const externalMatch = value.match(/^\[(.*?)\]\((.*?)\)$/)
  if (externalMatch) {
    return { type: "external", text: externalMatch[1], href: externalMatch[2] }
  }

  return undefined
}

// ── meta 转换 ──────────────────────────────────

interface ParseResult {
  meta: string
  fold?: FoldInfo
  noLineNumbers: boolean
  textPatterns: string[]
  ref?: RefInfo
}

function convertCodeStylerMeta(meta: string): ParseResult {
  let result = meta
  let fold: FoldInfo | undefined
  let noLineNumbers = false
  const textPatterns: string[] = []
  let ref: RefInfo | undefined

  // 收集所有数字高亮范围（hl 的数字 + info/warn/error）
  const highlightRanges: string[] = []

  // 1. 提取 fold（它可能不带冒号，会干扰 hl 的边界匹配）
  const foldMatch = result.match(/\bfold(?::(["'])(.*?)\1)?\b/)
  if (foldMatch) {
    result = result.replace(/\bfold(?::(["'])(.*?)\1)?\b/, "")
    fold = { collapsed: true, text: foldMatch[2] }
  }

  // 2. 处理 hl（必须在 title/ln 转换之前）
  result = result.replace(/\bhl:([^\s].*?)(?=\s+[a-zA-Z]+:|\s*$)/g, (_match, p1) => {
    const parsed = parseHlValue(p1)
    if (parsed.numericRanges) {
      highlightRanges.push(parsed.numericRanges)
    }
    if (parsed.textPatterns.length > 0) {
      textPatterns.push(...parsed.textPatterns)
    }
    return ""
  })

  // 3. 处理 info / warn / error
  const infoMatch = result.match(/\binfo:([^\s]+)/)
  if (infoMatch) {
    result = result.replace(/\binfo:[^\s]+/, "")
    highlightRanges.push(infoMatch[1] + "#info")
  }

  const warnMatch = result.match(/\bwarn:([^\s]+)/)
  if (warnMatch) {
    result = result.replace(/\bwarn:[^\s]+/, "")
    highlightRanges.push(warnMatch[1] + "#warn")
  }

  const errorMatch = result.match(/\berror:([^\s]+)/)
  if (errorMatch) {
    result = result.replace(/\berror:[^\s]+/, "")
    highlightRanges.push(errorMatch[1] + "#error")
  }

  // 4. 处理 ref
  const refMatch = result.match(/\bref:(.+?)(?=\s+[a-zA-Z]+:|\s*$)/)
  if (refMatch) {
    result = result.replace(/\bref:(.+?)(?=\s+[a-zA-Z]+:|\s*$)/, "")
    ref = parseRef(refMatch[1])
  }

  // 5. 处理 title
  result = result.replace(/title:([^\s"'][^\s]*)/g, 'title="$1"')
  result = result.replace(/title:"([^"]*)"/g, 'title="$1"')
  result = result.replace(/title:'([^']*)'/g, 'title="$1"')

  // 6. 如果 ref 存在但没有 title，用 ref 文本作为默认 title
  if (ref && !result.includes("title=") && !result.includes("title:")) {
    result += ` title="${ref.text}"`
  }

  // 7. 处理 ln
  result = result.replace(/\bln:true\b/g, "showLineNumbers")
  result = result.replace(/\bln:(\d+)\b/g, "showLineNumbers{$1}")
  if (/\bln:false\b/.test(meta)) {
    result = result.replace(/\bln:false\b/g, "")
    noLineNumbers = true
  }

  // 8. 合并所有数字高亮范围到 {}
  if (highlightRanges.length > 0) {
    result += " {" + highlightRanges.join(",") + "}"
  }

  // clean up
  result = result.replace(/\s+/g, " ").trim()

  return { meta: result, fold, noLineNumbers, textPatterns, ref }
}

// ── remark 插件 ────────────────────────────────

function remarkCodeStyler() {
  return (tree: any, file: any) => {
    const data = file.data as FileData
    data.codeStyler = {
      folds: new Map(),
      noLineNumbers: new Set(),
      textHighlights: new Map(),
      refs: new Map(),
      total: 0,
    }

    visit(tree, "code", (node: Code) => {
      const idx = data.codeStyler!.total++

      if (!node.meta) return

      const { meta, fold, noLineNumbers, textPatterns, ref } = convertCodeStylerMeta(node.meta)
      node.meta = meta || undefined

      if (fold) data.codeStyler!.folds.set(idx, fold)
      if (noLineNumbers) data.codeStyler!.noLineNumbers.add(idx)
      if (textPatterns.length > 0) data.codeStyler!.textHighlights.set(idx, textPatterns)
      if (ref) data.codeStyler!.refs.set(idx, ref)
    })
  }
}

// ── rehype 辅助函数 ────────────────────────────

function extractText(node: any): string {
  if (node.type === "text") return node.value
  if (node.children) return node.children.map(extractText).join("")
  return ""
}

function matchesPattern(lineText: string, pattern: string): boolean {
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      const regex = new RegExp(pattern.slice(1, -1))
      return regex.test(lineText)
    } catch {
      return false
    }
  }
  return lineText.includes(pattern)
}

function applyTextHighlights(node: Element, patterns: string[]) {
  const walk = (children: any[]) => {
    for (const child of children) {
      if (
        child.type === "element" &&
        child.tagName === "span" &&
        child.properties?.["data-line"] !== undefined
      ) {
        const lineText = extractText(child)
        for (const pattern of patterns) {
          if (matchesPattern(lineText, pattern)) {
            // 如果该行已经有自定义颜色(id)，不覆盖
            if (!child.properties?.["data-highlighted-line-id"]) {
              child.properties = child.properties || {}
              child.properties["data-highlighted-line"] = ""
            }
            break
          }
        }
      }
      if (child.children) walk(child.children)
    }
  }
  if (node.children) walk(node.children)
}

function getLanguageFromFigure(node: Element): string | undefined {
  const walk = (children: any[]): string | undefined => {
    for (const child of children) {
      if (child.type === "element" && child.tagName === "code") {
        return child.properties?.["data-language"] as string | undefined
      }
      if (child.children) {
        const found = walk(child.children)
        if (found) return found
      }
    }
    return undefined
  }
  return walk(node.children || [])
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function applyRefLink(node: Element, ref: RefInfo) {
  const figcaption = node.children?.find(
    (child: any) =>
      child.type === "element" &&
      child.tagName === "figcaption" &&
      child.properties?.["data-rehype-pretty-code-title"] !== undefined,
  ) as Element | undefined

  if (!figcaption) return

  const linkNode: Element = {
    type: "element",
    tagName: "a",
    properties: {
      href: ref.href,
      className:
        ref.type === "internal" ? ["internal", "code-styler-ref"] : ["external", "code-styler-ref"],
    },
    children: figcaption.children?.length
      ? figcaption.children
      : [{ type: "text", value: ref.text }],
  }

  figcaption.children = [linkNode]
}

// ── rehype 插件 ────────────────────────────────

function rehypeCodeStylerFold() {
  return (tree: HastRoot, file: any) => {
    const data = file.data as FileData
    const codeStyler = data.codeStyler
    if (!codeStyler) return

    let figureIndex = 0

    visit(tree, "element", (node: Element) => {
      if (
        node.tagName === "figure" &&
        node.properties?.["data-rehype-pretty-code-figure"] !== undefined
      ) {
        const idx = figureIndex++

        // ── fold ──
        const fold = codeStyler.folds.get(idx)
        if (fold) {
          node.properties = node.properties || {}
          node.properties["data-fold"] = fold.collapsed ? "collapsed" : "true"
          if (fold.text) {
            node.properties["data-fold-text"] = fold.text
          }

          const hasTitle = node.children?.some(
            (child: any) =>
              child.type === "element" &&
              child.tagName === "figcaption" &&
              child.properties?.["data-rehype-pretty-code-title"] !== undefined,
          )

          if (!hasTitle) {
            const lang = getLanguageFromFigure(node)
            const titleNode: Element = {
              type: "element",
              tagName: "figcaption",
              properties: { "data-rehype-pretty-code-title": "" },
              children: [{ type: "text", value: fold.text || (lang ? capitalize(lang) : "Code") }],
            }
            node.children = node.children || []
            node.children.unshift(titleNode)
          }
        }

        // ── text/regex 高亮 ──
        const patterns = codeStyler.textHighlights.get(idx)
        if (patterns) {
          applyTextHighlights(node, patterns)
        }

        // ── ref 链接 ──
        const ref = codeStyler.refs.get(idx)
        if (ref) {
          applyRefLink(node, ref)
        }

        // ── no-line-numbers ──
        if (codeStyler.noLineNumbers.has(idx)) {
          const applyClass = (children: any[]) => {
            for (const child of children) {
              if (child.type === "element" && child.tagName === "pre") {
                child.properties = child.properties || {}
                const existing = child.properties.className
                if (Array.isArray(existing)) {
                  child.properties.className = [...existing, "no-line-numbers"]
                } else if (existing) {
                  child.properties.className = [existing, "no-line-numbers"]
                } else {
                  child.properties.className = ["no-line-numbers"]
                }
              }
              if (child.children) applyClass(child.children)
            }
          }
          if (node.children) applyClass(node.children)
        }
      }
    })
  }
}

// ── 浏览器脚本（含动态 CSS 注入，绕过 Preact JSX 转义） ──

const codeStylerScript = `
(function() {
  const STYLE_ID = 'code-styler-dynamic-css'
  const css = \`
figure[data-rehype-pretty-code-figure]:has([data-rehype-pretty-code-title]) {
  border: 1px solid var(--lightgray);
  border-radius: 5px;
  overflow: hidden;
}
figure[data-rehype-pretty-code-figure]:has([data-rehype-pretty-code-title]) > [data-rehype-pretty-code-title] {
  display: block;
  width: 100%;
  border: none;
  border-radius: 0;
  margin: 0;
  background: color-mix(in srgb, var(--lightgray) 50%, transparent);
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  font-family: var(--codeFont);
  color: var(--darkgray);
  box-sizing: border-box;
}
figure[data-rehype-pretty-code-figure]:has([data-rehype-pretty-code-title]) > pre {
  border: none;
  border-radius: 0;
  margin: 0;
}
figure[data-rehype-pretty-code-figure][data-fold] > [data-rehype-pretty-code-title] {
  cursor: pointer;
  position: relative;
  padding-right: 1.8rem;
  user-select: none;
}
figure[data-rehype-pretty-code-figure][data-fold] > [data-rehype-pretty-code-title]::after {
  content: "▼";
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  opacity: 0.6;
  transition: transform 0.2s ease;
}
figure[data-rehype-pretty-code-figure][data-fold="collapsed"] > [data-rehype-pretty-code-title]::after {
  content: "▶";
}
figure[data-rehype-pretty-code-figure][data-fold="collapsed"] > pre {
  display: none;
}
[data-highlighted-line-id="info"] {
  background-color: rgba(59, 130, 246, 0.12) !important;
  border-left-color: #3b82f6 !important;
}
[data-highlighted-line-id="warn"] {
  background-color: rgba(245, 158, 11, 0.12) !important;
  border-left-color: #f59e0b !important;
}
[data-highlighted-line-id="error"] {
  background-color: rgba(239, 68, 68, 0.12) !important;
  border-left-color: #ef4444 !important;
}
[data-rehype-pretty-code-title] > a.code-styler-ref {
  background: none;
  padding: 0;
}
pre.no-line-numbers > code {
  counter-reset: none;
}
pre.no-line-numbers > code > [data-line]::before {
  display: none;
}
\`

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = css
    document.head.appendChild(style)
  }

  function bindFoldEvents() {
    const figures = document.querySelectorAll('figure[data-rehype-pretty-code-figure][data-fold]')
    figures.forEach(fig => {
      const title = fig.querySelector('[data-rehype-pretty-code-title]')
      if (!title || title.dataset.codeStylerBound) return
      title.dataset.codeStylerBound = 'true'
      title.title = '点击折叠/展开'
      const onClick = () => {
        const isCollapsed = fig.getAttribute('data-fold') === 'collapsed'
        fig.setAttribute('data-fold', isCollapsed ? 'true' : 'collapsed')
      }
      title.addEventListener('click', onClick)
      window.addCleanup(() => title.removeEventListener('click', onClick))
    })
  }

  document.addEventListener('nav', () => {
    injectStyle()
    bindFoldEvents()
  })
  injectStyle()
  bindFoldEvents()
})()
`

// ── 导出 ───────────────────────────────────────

export const CodeStyler: QuartzTransformerPlugin = () => {
  return {
    name: "CodeStyler",
    markdownPlugins() {
      return [remarkCodeStyler]
    },
    htmlPlugins() {
      return [rehypeCodeStylerFold]
    },
    externalResources() {
      return {
        js: [
          {
            loadTime: "afterDOMReady",
            contentType: "inline",
            script: codeStylerScript,
          },
        ],
      }
    },
  }
}
