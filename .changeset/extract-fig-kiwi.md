---
"@sleekdesign/dom-to-figma": patch
---

Move the encoder, Figma Kiwi schema, and HTML clipboard envelope into a new `@sleekdesign/fig-kiwi` package, now consumed as a runtime dependency. Public API and behavior are unchanged. The direct `pako` dependency is dropped; `fflate` is used (via fig-kiwi) for the deflate path — smaller and faster.
