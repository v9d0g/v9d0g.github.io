import { PixelBox } from "@pxlkit/ui-kit"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  if (title) {
    return (
      <PixelBox variant="ghost" padding="sm" className={classNames(displayClass, "article-title")}>
        <h1>{title}</h1>
      </PixelBox>
    )
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}

.article-title h1 {
  margin: 0;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
