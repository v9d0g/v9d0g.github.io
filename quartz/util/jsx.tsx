import { Components, Jsx, toJsxRuntime } from "hast-util-to-jsx-runtime"
import { Node, Root } from "hast"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { trace } from "./trace"
import { type FilePath } from "./path"

const customComponents: Components = {
  table: (props) => (
    <div className="table-container">
      <table {...props} />
    </div>
  ),
}

export function htmlToJsx(fp: FilePath, tree: Node) {
  try {
    return toJsxRuntime(tree as Root, {
      Fragment,
      jsx: jsx as Jsx,
      jsxs: jsxs as Jsx,
      elementAttributeNameCase: "react",
      components: customComponents,
    })
  } catch (e) {
    trace(`Failed to parse Markdown in \`${fp}\` into JSX`, e as Error)
  }
}
