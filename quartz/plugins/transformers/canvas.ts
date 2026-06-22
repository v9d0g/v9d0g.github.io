import { QuartzTransformerPlugin } from "../types"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"

export const CanvasRenderer: QuartzTransformerPlugin = () => {
  return {
    name: "CanvasRenderer",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            // file.data.slug 通常是 "随记/Quartz-搭建过程"
            const curSlug = file.data.slug ?? ""

            visit(tree, "element", (node, index, parent) => {
              if (
                node.tagName === "blockquote" &&
                Array.isArray(node.properties?.className) &&
                node.properties.className.includes("transclude") &&
                typeof node.properties?.dataUrl === "string" &&
                node.properties.dataUrl.endsWith(".canvas")
              ) {
                const rawPath = node.properties.dataUrl

                // 获取当前 markdown 文件的目录路径（不含文件名）
                // 例如 slug="随记/Quartz-搭建过程" -> dir="随记"
                const dir = curSlug.includes("/")
                  ? curSlug.substring(0, curSlug.lastIndexOf("/"))
                  : ""

                // 构造 canvas 文件的访问路径
                // 如果 rawPath 已经是绝对路径（以/开头），直接用；否则拼接目录
                // 例如: "test.canvas" -> "/随记/test.canvas"
                const canvasPath = rawPath.startsWith("/")
                  ? rawPath
                  : (dir ? `/${dir}/` : "/") + rawPath

                const canvasSrc = `/static/canvas-view?data=${encodeURIComponent(canvasPath)}`

                // 默认显示占位卡片，点击后在全屏浮层中打开 canvas，避免 iframe 嵌入导致页面闪屏/截断
                const placeholderNode: Element = {
                  type: "element",
                  tagName: "div",
                  properties: {
                    className: ["quartz-canvas-placeholder"],
                    "data-canvas-src": canvasSrc,
                    style:
                      "width: 100%; height: 600px; border: 1px solid var(--lightgray); border-radius: 12px; background: #161618; display: flex; align-items: center; justify-content: center; cursor: pointer; box-sizing: border-box;",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "span",
                      properties: {
                        className: ["quartz-canvas-placeholder-text"],
                      },
                      children: [{ type: "text", value: "点击打开 Canvas" }],
                    },
                  ],
                }

                const scriptNode: Element = {
                  type: "element",
                  tagName: "script",
                  properties: {},
                  children: [
                    {
                      type: "text",
                      value: `(function(){document.querySelectorAll('.quartz-canvas-placeholder').forEach(function(el){if(el.dataset.canvasReady)return;el.dataset.canvasReady='1';el.addEventListener('click',function(){var s=this.dataset.canvasSrc,m=document.createElement('div');m.className='quartz-canvas-modal';m.innerHTML='<div class="quartz-canvas-modal-backdrop"></div><div class="quartz-canvas-modal-content"><button class="quartz-canvas-modal-close" aria-label="关闭">&times;</button><iframe src="'+s+'" class="quartz-canvas-iframe" frameBorder="0" allow="fullscreen" title="Obsidian Canvas"></iframe></div>';document.body.appendChild(m);m.querySelector('.quartz-canvas-modal-close').addEventListener('click',function(){m.remove();});m.querySelector('.quartz-canvas-modal-backdrop').addEventListener('click',function(){m.remove();});});});})();`,
                    },
                  ],
                }

                if (parent && index !== undefined) {
                  parent.children[index] = placeholderNode
                  parent.children.splice(index + 1, 0, scriptNode)
                }
              }
            })
          }
        },
      ]
    },
  }
}
