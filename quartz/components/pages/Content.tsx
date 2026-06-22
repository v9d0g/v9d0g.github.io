import { ReactNode } from "react"
import { PixelBox } from "@pxlkit/ui-kit"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const content = htmlToJsx(fileData.filePath!, tree) as ReactNode
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  return (
    <PixelBox
      as="article"
      variant="outline"
      border
      tone="neutral"
      padding="md"
      className={classString}
    >
      {content}
    </PixelBox>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
