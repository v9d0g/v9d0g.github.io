// @ts-ignore
import darkmodeScript from "./scripts/darkmode.inline"
import styles from "./styles/darkmode.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import { PxlKitInlineIcon } from "./PxlKitInlineIcon"
import { Sun, Moon } from "@pxlkit/weather"

const Darkmode: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
  return (
    <button
      className={classNames(displayClass, "darkmode")}
      aria-label={i18n(cfg.locale).components.themeToggle.darkMode}
    >
      <PxlKitInlineIcon
        icon={Sun}
        size={20}
        className="dayIcon"
        aria-label={i18n(cfg.locale).components.themeToggle.darkMode}
      />
      <PxlKitInlineIcon
        icon={Moon}
        size={20}
        className="nightIcon"
        aria-label={i18n(cfg.locale).components.themeToggle.lightMode}
      />
    </button>
  )
}

Darkmode.beforeDOMLoaded = darkmodeScript
Darkmode.css = styles

export default (() => Darkmode) satisfies QuartzComponentConstructor
