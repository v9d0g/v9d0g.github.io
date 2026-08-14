# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Quartz v4** fork — a static site generator that publishes Obsidian vaults and Markdown notes as websites. It is built on Node.js 22+ with TypeScript, React, esbuild, and Tailwind CSS v4. Content lives in `content/public/` and the built site is emitted to `docs/` for GitHub Pages.

Upstream: https://github.com/jackyzha0/quartz  
Documentation: https://quartz.jzhao.xyz/

This fork has been migrated from Preact to React and integrates **pxlkit** for pixel-art icons and UI components (`@pxlkit/core`, `@pxlkit/ui-kit`, `@pxlkit/weather`, `@pxlkit/gamification`).

## Common Commands

All commands run through `npm` or `npx quartz` (the CLI entry point is `quartz/bootstrap-cli.mjs`).

| Task                                      | Command                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| Build site (production)                   | `npx quartz build --directory=content/public --output=docs`   |
| Build and serve locally with hot reload   | `npx quartz build --serve` (or `npm run docs`)                |
| Type check + Prettier check               | `npm run check`                                               |
| Format code                               | `npm run format`                                              |
| Run tests                                 | `npm test` (uses Node.js native test runner via `tsx --test`) |
| Run single test file                      | `npx tsx --test quartz/util/path.test.ts`                     |
| Update Quartz from upstream               | `npx quartz update`                                           |
| Sync content to/from GitHub               | `npx quartz sync`                                             |
| Windows deploy (clean → build → git push) | `update.bat`                                                  |

Development server defaults: HTTP on port `8080`, WebSocket hot-reload on port `3001`. The `--serve` flag implicitly enables `--watch`.

## Architecture

### Build Pipeline

The build is orchestrated in `quartz/build.ts` and flows through three stages:

1. **Parse** (`quartz/processors/parse.ts`) — Markdown files are parsed in parallel via a worker pool using `unified`/`remark`. Produces `ProcessedContent` (HAST tree + VFile).
2. **Filter** (`quartz/processors/filter.ts`) — Content is filtered through filter plugins (e.g. `RemoveDrafts`).
3. **Emit** (`quartz/processors/emit.ts`) — Emitter plugins generate the final static output (HTML pages, RSS, sitemaps, static assets).

During `npx quartz build --serve`, esbuild bundles the Quartz source into `quartz/.quartz-cache/transpiled-build.mjs`, then imports it with a cache-busting query param for each rebuild.

### Plugin System

Plugins are defined in `quartz.config.ts` and divided into three types in `quartz/plugins/types.ts`:

- **Transformers** — Process markdown → HTML. Each exposes `markdownPlugins()` (remark plugins) and/or `htmlPlugins()` (rehype plugins). Run in declaration order.
- **Filters** — Decide whether a piece of content should be published. Implement `shouldPublish(ctx, content): boolean`.
- **Emitters** — Generate output files. Implement `emit(ctx, content, resources)` returning `FilePath[]` or an async generator. Can optionally implement `partialEmit` for incremental rebuilds during watch mode.

### Component System

UI components are React functional components in `quartz/components/`. The layout is configured in `quartz.layout.ts`:

- `sharedPageComponents` — Head, header, footer, afterBody (shared across all pages)
- `defaultContentPageLayout` — Layout for individual note pages
- `defaultListPageLayout` — Layout for index/list pages (tags, folders)

Components declare their CSS/JS dependencies via `QuartzComponent`. The `ComponentResources` emitter collects only the resources used by components present in the current layout.

Components render icons through `PxlKitInlineIcon` (`quartz/components/PxlKitInlineIcon.tsx`), which converts pxlkit `PxlKitData` into inline SVG with `currentColor` or the original palette. Heading anchors and external link icons are injected at build time via `quartz/util/pxlkit.ts`.

### Content Resolution

- Content source: `content/public/` (configured via `--directory`)
- Output directory: `docs/` (configured via `--output`)
- WikiLinks (`[[...]]`) are resolved using the `shortest` path strategy by default
- Ignored patterns are defined in `quartz.config.ts` `configuration.ignorePatterns`

### Customizations in This Fork

- **React migration** — JSX runtime and SSR rendering moved from Preact to React (`react`, `react-dom`, `@types/react`).
- **Tailwind CSS v4** — Entry point at `quartz/styles/tailwind.css`, processed through PostCSS in `quartz/cli/handlers.js`.
- **pxlkit icons** — All UI icons (search, theme toggle, reader mode, explorer, graph, TOC, headings, external links) use pxlkit pixel-art icons.
- **CanvasRenderer** plugin (`quartz/plugins/transformers/canvas.ts`) — Custom transformer for Obsidian `.canvas` files, referenced in `quartz.config.ts`.
- **`update.bat`** — Windows deployment script that cleans `docs/`, builds, commits with message `docs:更新文章`, and pushes to `origin master`.
- **Locale**: `zh-CN`
- **Base URL**: `v9d0g.github.io`

## Key Configuration Files

| File               | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `quartz.config.ts` | Site config (title, theme, analytics, plugin pipeline)  |
| `quartz.layout.ts` | Page layout composition (which components appear where) |
| `quartz/cfg.ts`    | TypeScript types for configuration                      |

## File Conventions

- `.inline.ts` / `.inline.js` — Inline scripts bundled and embedded directly into HTML
- `.inline.scss` — Inline CSS bundled and embedded directly into HTML
- `.scss` — Regular SASS stylesheets imported as CSS text
- `quartz/static/` — Static assets copied verbatim to output

## Testing

Tests use Node.js's native `node:test` runner. Test files follow the pattern `*.test.ts`. There is no test framework dependency beyond `tsx` for TypeScript execution.

## 必须遵守

每次回答我之前都要以[尊敬的艾尔登之王]来称呼我
