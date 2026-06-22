import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

function Spacer({ displayClass }: QuartzComponentProps) {
  return <div className={classNames(displayClass, "spacer")}></div>
}

export default (() => Spacer) satisfies QuartzComponentConstructor
