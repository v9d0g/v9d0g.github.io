import { PxlKitData, gridToSvg } from "@pxlkit/core"

type IconMode = "colorful" | "monochrome"

interface Props {
  icon: PxlKitData
  size?: number
  className?: string
  "aria-label"?: string
  mode?: IconMode
}

export const PxlKitInlineIcon = ({
  icon,
  size = 16,
  className,
  "aria-label": ariaLabel,
  mode = "colorful",
}: Props) => {
  const svgOptions =
    mode === "monochrome"
      ? { mode: "monochrome" as const, monoColor: "currentColor" }
      : { mode: "colorful" as const }
  const svg = gridToSvg(icon, svgOptions)
  return (
    <span
      className={className ? `pxlkit-inline-icon ${className}` : "pxlkit-inline-icon"}
      aria-label={ariaLabel}
      style={{
        width: size,
        height: size,
        verticalAlign: "middle",
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
