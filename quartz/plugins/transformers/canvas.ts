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

                const iframeNode: Element = {
                  type: "element",
                  tagName: "iframe",
                  properties: {
                    // 直接传递可访问的 canvas 文件路径
                    src: `/static/canvas-view?data=${encodeURIComponent(canvasPath)}`,
                    className: ["quartz-canvas-iframe"],
                    style:
                      "width: 100%; height: 600px; border: 1px solid var(--lightgray); border-radius: 12px; background: #161618;",
                    frameBorder: "0",
                    allow: "fullscreen",
                    loading: "lazy",
                  },
                  children: [],
                }

                if (parent && index !== undefined) {
                  parent.children[index] = iframeNode
                }
              }
            })
          }
        },
      ]
    },
  }
}
