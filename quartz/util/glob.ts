import path from "path"
import { FilePath } from "./path"
import { globby } from "globby"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  const fps = (
    await globby(pattern, {
      cwd,
      ignore: ignorePatterns,
      // 不参考 .gitignore：让 git 忽略 content/ 的同时，build 仍能读到 content 下的文件。
      // 发布过滤由 cfg.configuration.ignorePatterns（private/templates/.obsidian）负责。
      gitignore: false,
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
