import { PixelBox } from "@pxlkit/ui-kit"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"

interface Options {
  links: Record<string, string>
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const links = opts?.links ?? []

    return (
      <PixelBox
        as="footer"
        variant="outline"
        border
        tone="neutral"
        className={`${displayClass ?? ""}`}
      >
        <div
          className="utterances"
          dangerouslySetInnerHTML={{
            __html:
              '<script src="https://utteranc.es/client.js" ' +
              'repo="v9d0g/v9d0g.github.io" ' +
              'issue-term="og:title" ' +
              'theme="github-light" ' +
              'crossorigin="anonymous" ' +
              "async></script>",
          }}
        />

        <div className="footer-row">
          <p>
            {i18n(cfg.locale).components.footer.createdWith}{" "}
            <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
          </p>
          <ul>
            {Object.entries(links).map(([text, link]) => (
              <li key={text}>
                <a href={link}>{text}</a>
              </li>
            ))}
          </ul>
        </div>
      </PixelBox>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
