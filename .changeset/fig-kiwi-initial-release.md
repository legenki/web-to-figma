---
"@sleekdesign/fig-kiwi": patch
---

Initial release. Low-level encoder for Figma's Kiwi binary format and HTML clipboard envelope, extracted from `@sleekdesign/dom-to-figma`. Exposes `encodeFigmaData`, `composeClipboardHtml`, `toClipboardItem`, `KiwiWriter`, and the bundled Figma Kiwi schema. Ships with a `pnpm extract-schema` CLI that regenerates the schema from a fresh Figma clipboard copy.
