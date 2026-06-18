import { concatenateResources } from "../util/resources"
import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type FlexConfig = {
  components: {
    Component: QuartzComponent
    grow?: boolean
    shrink?: boolean
    basis?: string
    order?: number
    align?: "start" | "end" | "center" | "stretch"
    justify?: "start" | "end" | "center" | "between" | "around"
  }[]
  direction?: "row" | "row-reverse" | "column" | "column-reverse"
  wrap?: "nowrap" | "wrap" | "wrap-reverse"
  gap?: string
}

export default ((config: FlexConfig) => {
  const Flex: QuartzComponent = (props: QuartzComponentProps) => {
    const direction = config.direction ?? "row"
    const wrap = config.wrap ?? "nowrap"
    const gap = config.gap ?? "1rem"

    return (
      <div
        className={classNames(props.displayClass, "flex-component")}
        style={{
          flexDirection: direction,
          flexWrap: wrap,
          gap,
        }}
      >
        {config.components.map((c, idx) => {
          const grow = c.grow ? 1 : 0
          const shrink = (c.shrink ?? true) ? 1 : 0
          const basis = c.basis ?? "auto"
          const order = c.order ?? 0
          const align = c.align ?? "center"
          const justify = c.justify ?? "center"

          return (
            <div
              key={idx}
              style={{
                flexGrow: grow,
                flexShrink: shrink,
                flexBasis: basis,
                order,
                alignSelf: align,
                justifySelf: justify,
              }}
            >
              <c.Component {...props} />
            </div>
          )
        })}
      </div>
    )
  }

  Flex.afterDOMLoaded = concatenateResources(
    ...config.components.map((c) => c.Component.afterDOMLoaded),
  )
  Flex.beforeDOMLoaded = concatenateResources(
    ...config.components.map((c) => c.Component.beforeDOMLoaded),
  )
  Flex.css = concatenateResources(...config.components.map((c) => c.Component.css))
  return Flex
}) satisfies QuartzComponentConstructor<FlexConfig>
