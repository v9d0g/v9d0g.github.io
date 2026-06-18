import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { PxlKitInlineIcon } from "./PxlKitInlineIcon"
import { Search as SearchIcon } from "@pxlkit/ui"

export interface SearchOptions {
  enablePreview: boolean
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
}

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts }
    const searchPlaceholder = i18n(cfg.locale).components.search.searchBarPlaceholder
    return (
      <div className={classNames(displayClass, "search")}>
        <button className="search-button">
          <PxlKitInlineIcon icon={SearchIcon} size={18} className="search-icon" />
          <span>{i18n(cfg.locale).components.search.title}</span>
        </button>
        <div className="search-container">
          <div className="search-space">
            <input
              autoComplete="off"
              className="search-bar"
              name="search"
              type="text"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
            />
            <div className="search-layout" data-preview={opts.enablePreview}></div>
          </div>
        </div>
      </div>
    )
  }

  Search.afterDOMLoaded = script
  Search.css = style

  return Search
}) satisfies QuartzComponentConstructor
