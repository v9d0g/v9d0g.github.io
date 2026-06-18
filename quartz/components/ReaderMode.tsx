// @ts-ignore
import readerModeScript from "./scripts/readermode.inline"
import styles from "./styles/readermode.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import { PxlKitInlineIcon } from "./PxlKitInlineIcon"
import { SpellBook } from "@pxlkit/gamification"

const ReaderMode: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
  return (
    <button
      className={classNames(displayClass, "readermode")}
      aria-label={i18n(cfg.locale).components.readerMode.title}
    >
      <PxlKitInlineIcon icon={SpellBook} size={20} className="readerIcon" />
    </button>
  )
}

ReaderMode.beforeDOMLoaded = readerModeScript
ReaderMode.css = styles

export default (() => ReaderMode) satisfies QuartzComponentConstructor
