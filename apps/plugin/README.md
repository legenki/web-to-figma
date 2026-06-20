# Figit Import (Figma plugin)

Import an HTML file (or pasted markup) into editable Figma layers — entirely
inside Figma, no clipboard `Cmd+V` step.

Built on [`@figit/dom-to-figma`](../../packages/dom-to-figma): the plugin UI
renders the HTML in a nested sandbox iframe, runs the converter against that
live DOM, and the sandbox (`code.ts`) maps the resulting `FigmaNodeChange[]`
to Plugin API nodes.

## Build

```sh
pnpm --filter plugin build
```

Produces two self-contained artifacts in `apps/plugin/dist/`:

- `code.js` — the sandbox entry (IIFE)
- `index.html` — the UI, with all JS/CSS inlined (via `vite-plugin-singlefile`)

`pnpm --filter plugin dev` rebuilds the UI on change.

## Load in Figma

1. Figma desktop → Plugins → Development → **Import plugin from manifest…**
2. Choose `apps/plugin/manifest.json`.
3. Run **Figit Import** from Plugins → Development.

## Manual E2E

1. Run the plugin. Drop `apps/playground/src/corpus/integrations/landing.html`
   (or click to choose it).
2. Confirm a frame named after the file appears on the canvas with editable
   text, fills, and shadows.
3. For a real bundled page, serve a `.html` over a local static server and load
   it the same way (bundled pages self-unpack via their inline scripts inside
   the sandbox iframe).
4. Confirm the status line reports `Built N of M layers` and lists any missing
   fonts.

## Scope (V1)

Frames, text, groups; solid + linear-gradient fills; drop/inner shadows; corner
radius; borders; auto-layout; fonts via `loadFontAsync` with an Inter fallback.

Not yet handled (see the plan's Future Work): images (`createImage`), vectors
(SVG → vectorNetwork), per-character icon-font glyph coverage, and deriving
gradient direction from the CSS angle.
