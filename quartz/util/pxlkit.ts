import { PxlKitData, gridToSvg } from "@pxlkit/core"
import { fromHtml } from "hast-util-from-html"
import { Element } from "hast"

export function pxlKitIconToHast(icon: PxlKitData, size: number = 16): Element {
  const svg = gridToSvg(icon, { mode: "colorful" })
  const tree = fromHtml(svg, { fragment: true })
  const svgElement = tree.children.find((child): child is Element => child.type === "element")!
  svgElement.properties = {
    ...svgElement.properties,
    width: size,
    height: size,
    role: "img",
    "aria-hidden": "true",
  }
  return svgElement
}
