import { PixelCard, PixelButton } from "@pxlkit/ui-kit"
import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  // If baseUrl contains a pathname after the domain, use this as the home link
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  return (
    <article className="popover-hint">
      <PixelCard tone="red" title="404">
        <p>{i18n(cfg.locale).pages.error.notFound}</p>
        <PixelButton asChild>
          <a href={baseDir}>{i18n(cfg.locale).pages.error.home}</a>
        </PixelButton>
      </PixelCard>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
