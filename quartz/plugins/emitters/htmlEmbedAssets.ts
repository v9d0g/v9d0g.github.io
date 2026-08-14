import { FilePath, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { Argv } from "../../util/ctx"
import { QuartzConfig } from "../../cfg"

// 段级 slug：与 HtmlEmbed transformer 生成 URL 的规则保持一致（空格→- 等），但保留 .html 后缀。
const segSlug = (s: string) =>
  s
    .replace(/\s/g, "-")
    .replace(/&/g, "-and-")
    .replace(/%/g, "-percent")
    .replace(/\?/g, "")
    .replace(/#/g, "")
const embedSlug = (fp: string) => fp.split("/").map(segSlug).join("/")

const filesToCopy = async (argv: Argv, cfg: QuartzConfig) => {
  // 只处理各目录 html/ 下的 .html 文件（.js/.css 等仍由 Assets 按原规则处理）
  return await glob("**/html/**/*.html", argv.directory, [...cfg.configuration.ignorePatterns])
}

const copyFile = async (argv: Argv, fp: FilePath) => {
  const src = joinSegments(argv.directory, fp) as FilePath
  const dest = joinSegments(argv.output, embedSlug(fp)) as FilePath
  await fs.promises.mkdir(path.dirname(dest) as FilePath, { recursive: true })
  await fs.promises.copyFile(src, dest)
  return dest
}

// 与 HtmlEmbed transformer 配套。
// 背景：Assets emitter 会把 .html 文件拷贝成「无扩展名」（slugifyFilePath 剥离 .html），
// 而 GitHub Pages 对 Assets 拷贝的无扩展名文件一律返回 application/octet-stream（按下载处理），
// 导致 iframe 无法渲染。这里把 html/ 下的 .html 以「保留后缀」的方式再拷一份，使 GH Pages 返回 text/html。
export const HtmlEmbedAssets: QuartzEmitterPlugin = () => {
  return {
    name: "HtmlEmbedAssets",
    async *emit({ argv, cfg }) {
      const fps = await filesToCopy(argv, cfg)
      for (const fp of fps) {
        yield copyFile(argv, fp)
      }
    },
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      for (const changeEvent of changeEvents) {
        if (!changeEvent.path.endsWith(".html")) continue
        if (!changeEvent.path.split("/").includes("html")) continue

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          yield copyFile(ctx.argv, changeEvent.path)
        } else if (changeEvent.type === "delete") {
          const dest = joinSegments(ctx.argv.output, embedSlug(changeEvent.path)) as FilePath
          await fs.promises.unlink(dest)
        }
      }
    },
  }
}
