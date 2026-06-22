import { PixelTextLink } from "@pxlkit/ui-kit"
import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  const iconSrc = joinSegments(baseDir, "static/icon_pixel_art.png")
  return (
    <h2 className={classNames(displayClass, "page-title")}>
      <img
        src={iconSrc}
        alt=""
        className="page-title-icon"
        width={32}
        height={32}
      />
      <PixelTextLink href={baseDir} tone="cyan">
        {title}
      </PixelTextLink>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-title-icon {
  width: 2rem;
  height: 2rem;
  image-rendering: pixelated;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
