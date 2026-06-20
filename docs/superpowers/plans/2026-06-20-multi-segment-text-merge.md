# Multi-Segment Inline Text → Single Figma TEXT Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a block element whose children are multiple inline runs (sibling text nodes and inline `<span>`s) into a single, correctly-laid-out Figma TEXT node — preserving each run's per-character styling (font weight, color, gradient fill, decoration) via Figma's `characterStyleIDs` + `styleOverrideTable` wire format — so centered/right-aligned multi-segment headings no longer stack their runs on top of each other.

**Architecture:** Today every inline run becomes its own TEXT node positioned by the union bounding box of its DOM Range; under center/right alignment runs that share a visual line collapse onto the block centre. We replace this with a "paragraph" path: a new classifier kind `text-paragraph` for blocks made entirely of inline runs; a paragraph assembler that walks the block's inline descendants into one `characters` string plus an array of per-character style spans; an extension to the text converter that lays the combined string out **once** (reusing the existing single-node multi-line layout, which is already correct for one centered/wrapping node) and emits `characterStyleIDs` + a `styleOverrideTable` of per-style `NodeChange` overrides, multiple `fontMetaData` entries, and per-run glyph fills. Solo-text blocks keep today's path untouched.

**Tech Stack:** TypeScript, opentype.js (font metrics/glyphs), vitest (node + Playwright browser projects), the Figma kiwi schema in `packages/fig-kiwi/src/schema.json` (authoritative wire format).

**Pre-flight findings (verified before execution):**
- The fig-kiwi encoder is schema-driven (`encodeMessage` emits any field present on the object that is declared in `SCHEMA`). `TextData` already declares `characterStyleIDs` (field 2) and `styleOverrideTable` (field 3), and `SCHEMA` is `schema.json` cast directly (no trimming). A round-trip probe confirmed both fields survive `encodeFigmaData` (the override's family string appears in the inflated data). **Conclusion: no encoder changes needed** — the converter only has to put these fields on `textData`. Task 1 locks this in with a permanent regression test.
- Playwright browser tests run green via the staged build workaround (`chromium_headless_shell-1217` populated from the cached `-1223` build); `pnpm --filter @figit/dom-to-figma test` passed 43/43 including the browser project. See `[[playwright-headless-shell-download]]` memory.

## Known limitation (V1)

Runs that differ in **font size** keep the base-font glyph *positions* from the single layout pass; only same-size runs are positioned exactly. The reported case (centered/right headings whose runs differ in weight, color, or gradient but share one font size) is exact. Mixed-font-size paragraphs may be slightly mispositioned and are out of scope for V1 — a follow-up would lay out each size-run segment and stitch advances. This is a deliberate, documented boundary, not an oversight; Task 7 must add a code comment pointing here.

**Key reference — Figma `TextData` wire format (`packages/fig-kiwi/src/schema.json`, message `TextData` index 88):**
- `characters: string` — full combined paragraph text.
- `characterStyleIDs: uint[]` — one style id per character (Figma run-length-encodes, but a per-character array is valid). `0` = base style (the node's own `fontName`/`fillPaints`).
- `styleOverrideTable: NodeChange[]` — each entry is a partial `NodeChange` carrying `styleID` (field 49) plus only the properties it overrides (`fillPaints`, `fontName`, `fontSize`, `textDecoration`, etc.).
- `derivedTextData.fontMetaData[]` — one entry per distinct (family, style, weight) used anywhere in the node.

---

## File Structure

**New files:**
- `packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.ts` — walks a block's inline descendants into `{ characters, spans }` where each span is `{ start, end, element }` (the element supplying that run's computed style). One responsibility: DOM → flat styled-span model.
- `packages/dom-to-figma/src/converter/nodes/text/paragraph/style-runs.ts` — turns assembled spans into `characterStyleIDs` + a `styleOverrideTable` (deduped style descriptors → NodeChange overrides), relative to a chosen base style. One responsibility: styled spans → Figma style-override wire model.
- `packages/dom-to-figma/src/converter/nodes/text/paragraph/index.ts` — barrel export.
- `packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.test.ts` — unit tests (node project, jsdom-free pure DOM via the browser project; see Task notes).

**Modified files:**
- `packages/dom-to-figma/src/converter/classify.ts` — add `text-paragraph` kind + `isInlineParagraph` predicate.
- `packages/dom-to-figma/src/converter/classify.ts` types (`ElementKind`) — add `"text-paragraph"`.
- `packages/dom-to-figma/src/converter/convert.ts` — handle the new kind, calling the paragraph converter; `hasChildren: false` (children are absorbed).
- `packages/dom-to-figma/src/converter/nodes/text/converter.ts` — accept an optional `paragraph` input (combined characters + style spans); when present, emit `textData.characterStyleIDs`, `textData.styleOverrideTable`, multi-entry `fontMetaData`, and per-run glyph fills.
- `packages/dom-to-figma/src/converter/types/text.ts` — extend `FigmaTextData` with `characterStyleIDs?` and `styleOverrideTable?`.
- `packages/dom-to-figma/src/converter/types/node.ts` — add `styleID?: number` to `FigmaTextNodeChange` (style-override entries reuse the TEXT change shape).
- `apps/playground/src/corpus/typography/centered-runs.html` — corpus scene (already created; keep).
- `packages/dom-to-figma/src/figma.text.browser.test.ts` — browser test asserting non-overlap + style preservation (a draft test already exists; replace with the paragraph-aware version in Task 10).

---

## Task 1: fig-kiwi round-trip guard (do this first)

**Why first:** The whole approach depends on `TextData.characterStyleIDs` + `styleOverrideTable` surviving encoding. A pre-flight probe confirmed they do, but that probe was deleted — lock the guarantee into a permanent test so a future schema regeneration that drops these fields fails loudly here, not at E2E.

**Files:**
- Create: `packages/fig-kiwi/src/text-style-overrides.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { inflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeFigmaData } from "./encoder";

const HEADER_BYTES = 8;
const VERSION_BYTES = 4;
const LENGTH_BYTES = 4;

// Inflate the data segment of a fig-kiwi envelope (magic + version +
// deflated schema + deflated data).
function inflatedData(figBytes: Uint8Array): Uint8Array {
  const view = new DataView(figBytes.buffer, figBytes.byteOffset, figBytes.byteLength);
  let offset = HEADER_BYTES + VERSION_BYTES;
  const schemaLength = view.getUint32(offset, true);
  offset += LENGTH_BYTES + schemaLength;
  const dataLength = view.getUint32(offset, true);
  offset += LENGTH_BYTES;
  return inflateSync(figBytes.slice(offset, offset + dataLength));
}

describe("TextData style-override encoding", () => {
  it("encodes characterStyleIDs and styleOverrideTable without dropping them", () => {
    const message = {
      type: "NODE_CHANGES",
      nodeChanges: [
        {
          type: "TEXT",
          guid: { sessionID: 1, localID: 1 },
          characters: "Hi bold",
          textData: {
            characters: "Hi bold",
            characterStyleIDs: [0, 0, 0, 7, 7, 7, 7],
            styleOverrideTable: [
              { styleID: 7, fontName: { family: "ProbeFamily", style: "Bold", postscript: "" } },
            ],
          },
        },
      ],
    };

    const { figBytes } = encodeFigmaData(message);
    const text = new TextDecoder("latin1").decode(inflatedData(figBytes));

    // If the encoder silently dropped styleOverrideTable, the distinctive
    // override family string would be absent.
    expect(text).toContain("ProbeFamily");
    expect(text).toContain("Hi bold");
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm --filter @figit/fig-kiwi exec vitest run src/text-style-overrides.test.ts`
Expected: PASS (confirmed via pre-flight probe). If it FAILS, STOP — the encoder/schema drops the fields and the plan's scope grows (add a task to regenerate/extend `schema.json` and `extract-schema`). Surface this before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/fig-kiwi/src/text-style-overrides.test.ts
git commit -m "test(fig-kiwi): guard TextData style-override round-trip"
```

---

## Task 2: Schema types for style overrides

**Files:**
- Modify: `packages/dom-to-figma/src/converter/types/text.ts`
- Modify: `packages/dom-to-figma/src/converter/types/node.ts:34-92`

- [ ] **Step 1: Extend `FigmaTextData`**

In `types/text.ts`, replace the `FigmaTextData` type:

```typescript
export type FigmaTextData = {
  characters: string;
  lines?: Array<unknown>;
  // One style id per character. Index into `styleOverrideTable` by matching
  // `styleID`; id 0 is the node's base style. Parallel to `characters`.
  characterStyleIDs?: Array<number>;
  // Partial NodeChanges, each keyed by `styleID`, overriding only the
  // properties that differ from the base style (fill, fontName, fontSize, …).
  styleOverrideTable?: Array<FigmaStyleOverride>;
};

// A style-override entry is a TEXT-shaped partial change carrying a styleID
// plus the overridden text properties. Imported lazily to avoid a cycle.
export type FigmaStyleOverride = {
  styleID: number;
  fontName?: {
    family: string;
    style: string;
    postscript?: string;
  };
  fontSize?: number;
  fillPaints?: Array<unknown>;
  textDecoration?: FigmaTextDecoration;
  textCase?: FigmaTextCase;
  letterSpacing?: {
    value: number;
    units: string;
  };
};
```

- [ ] **Step 2: Add `styleID` to the TEXT node change**

In `types/node.ts`, inside `FigmaTextNodeChange` (after `fillPaints?` at line 85), add:

```typescript
  // Present only on entries inside `textData.styleOverrideTable`.
  styleID?: number;
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @figit/dom-to-figma check-types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/dom-to-figma/src/converter/types/text.ts packages/dom-to-figma/src/converter/types/node.ts
git commit -m "feat(text): add style-override fields to text data types"
```

---

## Task 3: Paragraph assembler — DOM inline runs → styled spans

**Files:**
- Create: `packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.ts`
- Test: `packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.browser.test.ts` (browser project — needs real DOM)

**Notes:** Assembly must mirror how the browser renders text: collapse runs of whitespace to a single space, but preserve a single inter-run space (`a <b>b</b> c` → `"a b c"`). Trim the combined result. Each character maps to the nearest ancestor element inside the block that carries its computed style (the `<span>` for span text, the block for bare text).

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { loadTestFontIntoBrowser, TEST_FONT_FAMILY } from "../../../../__fixtures__/loaders";
import { assembleParagraph } from "./assembler";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("assembleParagraph", () => {
  it("flattens inline runs into one string with per-run style spans", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}'">Move from <span style="font-weight:700">A to B</span> now.</h1>`
    );

    const result = assembleParagraph(block);

    expect(result.characters).toBe("Move from A to B now.");
    // Three spans: "Move from " (block), "A to B" (span), " now." (block).
    expect(result.spans).toHaveLength(3);
    expect(result.spans[0]).toMatchObject({ start: 0, end: 10 });
    expect(result.spans[1]).toMatchObject({ start: 10, end: 16 });
    expect(result.spans[1]?.element.tagName.toLowerCase()).toBe("span");
    expect(result.spans[2]).toMatchObject({ start: 16, end: 21 });
    document.body.innerHTML = "";
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/converter/nodes/text/paragraph/assembler.browser.test.ts`
Expected: FAIL — `assembleParagraph` is not defined.

- [ ] **Step 3: Implement the assembler**

```typescript
import { isElementNode, isTextNode } from "../../../dom";

export type ParagraphSpan = {
  /** Inclusive start index into `characters`. */
  start: number;
  /** Exclusive end index into `characters`. */
  end: number;
  /** Element whose computed style applies to this run. */
  element: Element;
};

export type AssembledParagraph = {
  characters: string;
  spans: Array<ParagraphSpan>;
};

/**
 * Flatten a block element's inline descendants into a single string plus the
 * style spans that produced it. Whitespace is collapsed the way the browser
 * renders it (runs of whitespace → one space) and the result is trimmed, so
 * indices line up with what `getClientRects()` measures on the block.
 */
export function assembleParagraph(block: Element): AssembledParagraph {
  const spans: Array<ParagraphSpan> = [];
  let characters = "";
  // Tracks whether the last emitted character was a collapsible space, so we
  // don't emit two in a row across run boundaries.
  let pendingSpace = false;

  const visit = (node: Node, styleElement: Element): void => {
    if (isTextNode(node)) {
      const raw = node.textContent ?? "";
      const spanStart = characters.length;
      for (const ch of raw) {
        if (/\s/.test(ch)) {
          pendingSpace = characters.length > 0;
          continue;
        }
        if (pendingSpace) {
          characters += " ";
          pendingSpace = false;
        }
        characters += ch;
      }
      const spanEnd = characters.length;
      if (spanEnd > spanStart) {
        spans.push({ start: spanStart, end: spanEnd, element: styleElement });
      }
      return;
    }
    if (!isElementNode(node)) {
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      // Inline children supply their own computed style; descend with the
      // child element as the new style source.
      visit(child, isElementNode(child) ? child : styleElement);
    }
  };

  for (const child of Array.from(block.childNodes)) {
    visit(child, isElementNode(child) ? child : block);
  }

  return { characters, spans };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/converter/nodes/text/paragraph/assembler.browser.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a whitespace-collapse test**

Append to the same `describe`:

```typescript
  it("collapses inter-run and intra-run whitespace to single spaces", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">  a   <span>b</span>\n  c  </p>`
    );
    const result = assembleParagraph(block);
    expect(result.characters).toBe("a b c");
    document.body.innerHTML = "";
  });
```

Run the file again; expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.ts packages/dom-to-figma/src/converter/nodes/text/paragraph/assembler.browser.test.ts
git commit -m "feat(text): assemble block inline runs into styled spans"
```

---

## Task 4: Style-run builder — spans → characterStyleIDs + styleOverrideTable

**Files:**
- Create: `packages/dom-to-figma/src/converter/nodes/text/paragraph/style-runs.ts`
- Test: `packages/dom-to-figma/src/converter/nodes/text/paragraph/style-runs.browser.test.ts`

**Notes:** The base style is the block's own computed style (styleID 0). For each span whose computed style differs from the base in any tracked property (font weight/style → resolved `fontName`, fontSize, fill color, gradient fill, text-decoration, letter-spacing), allocate a styleID and a `styleOverrideTable` entry containing only the differing properties. Reuse the existing CSS→Figma helpers (`cssColorToFigmaColor`, `createSolidPaint`, `cssBackgroundToFigmaPaints`, the maps in `converter.ts`). Deduplicate identical style descriptors so two same-styled spans share one styleID.

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { loadTestFontIntoBrowser, TEST_FONT_FAMILY } from "../../../../__fixtures__/loaders";
import { assembleParagraph } from "./assembler";
import { buildStyleRuns } from "./style-runs";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("buildStyleRuns", () => {
  it("emits per-character ids and overrides only for differing runs", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}';font-weight:400;color:rgb(0,0,0)">Hi <span style="font-weight:700;color:rgb(255,0,0)">bold</span></h1>`
    );
    const para = assembleParagraph(block);
    const runs = buildStyleRuns(block, para);

    // "Hi " is base (id 0), "bold" gets a non-zero override id.
    expect(runs.characterStyleIDs).toHaveLength(para.characters.length);
    expect(runs.characterStyleIDs.slice(0, 3)).toEqual([0, 0, 0]);
    const boldId = runs.characterStyleIDs[3];
    expect(boldId).toBeGreaterThan(0);
    expect(new Set(runs.characterStyleIDs.slice(3))).toEqual(new Set([boldId]));

    // One override entry, carrying the bold weight and red fill, keyed by id.
    expect(runs.styleOverrideTable).toHaveLength(1);
    expect(runs.styleOverrideTable[0]?.styleID).toBe(boldId);
    expect(runs.styleOverrideTable[0]?.fontName?.style).toBe("Bold");
    expect(runs.styleOverrideTable[0]?.fillPaints?.length).toBeGreaterThan(0);
    document.body.innerHTML = "";
  });

  it("returns no overrides when every run shares the base style", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">plain <span>more</span> text</p>`
    );
    const para = assembleParagraph(block);
    const runs = buildStyleRuns(block, para);
    expect(runs.styleOverrideTable).toHaveLength(0);
    expect(new Set(runs.characterStyleIDs)).toEqual(new Set([0]));
    document.body.innerHTML = "";
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/converter/nodes/text/paragraph/style-runs.browser.test.ts`
Expected: FAIL — `buildStyleRuns` not defined.

- [ ] **Step 3: Implement the style-run builder**

```typescript
import { createSolidPaint, cssColorToFigmaColor } from "../../../styles/color";
import { cssBackgroundToFigmaPaints } from "../../../styles/gradient";
import type { FigmaPaint } from "../../../types";
import type { FigmaStyleOverride } from "../../../types/text";
import { parseFontProperties } from "../primitives/font/properties";
import type { AssembledParagraph } from "./assembler";

export type StyleRuns = {
  characterStyleIDs: Array<number>;
  styleOverrideTable: Array<FigmaStyleOverride>;
};

// A stable descriptor of the visual style we care about for a run. Two spans
// with equal descriptors share a styleID.
type StyleDescriptor = {
  family: string;
  weight: number;
  italic: boolean;
  fontSize: number;
  fillKey: string;
  fills: Array<FigmaPaint>;
  textDecoration: "NONE" | "UNDERLINE";
  letterSpacing: number;
};

function fillsFor(style: CSSStyleDeclaration): Array<FigmaPaint> {
  const color = cssColorToFigmaColor(style.color);
  const background = style.backgroundImage || style.background;
  if (background && background !== "none" && color === null) {
    return cssBackgroundToFigmaPaints(background);
  }
  if (color) {
    return [createSolidPaint(color.color, color.opacity)];
  }
  return [];
}

function describe(element: Element): StyleDescriptor {
  const style = window.getComputedStyle(element);
  const font = parseFontProperties(style.fontFamily, style.fontWeight, style.fontStyle);
  const fills = fillsFor(style);
  return {
    family: font.family,
    weight: font.weight,
    italic: font.italic,
    fontSize: Number.parseFloat(style.fontSize || "16"),
    fills,
    fillKey: JSON.stringify(fills),
    textDecoration: (style.textDecorationLine || "none") === "underline" ? "UNDERLINE" : "NONE",
    letterSpacing: style.letterSpacing !== "normal" ? Number.parseFloat(style.letterSpacing) : 0,
  };
}

function key(d: StyleDescriptor): string {
  return `${d.family}|${d.weight}|${d.italic}|${d.fontSize}|${d.fillKey}|${d.textDecoration}|${d.letterSpacing}`;
}

function styleNameFor(weight: number, italic: boolean): string {
  const base =
    weight >= 700 ? "Bold" : weight >= 600 ? "SemiBold" : weight >= 500 ? "Medium" : weight <= 300 ? "Light" : "Regular";
  return italic ? `${base} Italic` : base;
}

/**
 * Build the per-character style id array and the override table for an
 * assembled paragraph. styleID 0 is the block's base style; any run that
 * differs gets its own deduplicated id and a partial override entry.
 */
export function buildStyleRuns(block: Element, paragraph: AssembledParagraph): StyleRuns {
  const baseKey = key(describe(block));
  const characterStyleIDs = new Array<number>(paragraph.characters.length).fill(0);

  const idByKey = new Map<string, number>([[baseKey, 0]]);
  const overrides = new Map<number, FigmaStyleOverride>();
  let nextId = 1;

  for (const span of paragraph.spans) {
    const descriptor = describe(span.element);
    const k = key(descriptor);
    if (k === baseKey) {
      continue; // base style — leave ids at 0
    }
    let id = idByKey.get(k);
    if (id === undefined) {
      id = nextId;
      nextId += 1;
      idByKey.set(k, id);
      overrides.set(id, {
        styleID: id,
        fontName: { family: descriptor.family, style: styleNameFor(descriptor.weight, descriptor.italic) },
        fontSize: descriptor.fontSize,
        fillPaints: descriptor.fills,
        ...(descriptor.textDecoration === "UNDERLINE" && { textDecoration: "UNDERLINE" as const }),
        ...(descriptor.letterSpacing !== 0 && {
          letterSpacing: { value: descriptor.letterSpacing, units: "PIXELS" },
        }),
      });
    }
    for (let i = span.start; i < span.end; i += 1) {
      characterStyleIDs[i] = id;
    }
  }

  return {
    characterStyleIDs,
    styleOverrideTable: Array.from(overrides.values()),
  };
}
```

NOTE for the implementer: confirm the actual export name/signature of `parseFontProperties` in `packages/dom-to-figma/src/converter/nodes/text/primitives/font/properties.ts` and the return shape (`family`, `weight`, `italic`) before relying on it; adapt the import/usage to match. If the helper resolves a concrete font style name already, prefer that over the local `styleNameFor`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/converter/nodes/text/paragraph/style-runs.browser.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Add the barrel + commit**

Create `packages/dom-to-figma/src/converter/nodes/text/paragraph/index.ts`:

```typescript
export { assembleParagraph } from "./assembler";
export type { AssembledParagraph, ParagraphSpan } from "./assembler";
export { buildStyleRuns } from "./style-runs";
export type { StyleRuns } from "./style-runs";
```

```bash
git add packages/dom-to-figma/src/converter/nodes/text/paragraph/
git commit -m "feat(text): build characterStyleIDs and styleOverrideTable from spans"
```

---

## Task 5: Classify inline-paragraph blocks

**Files:**
- Modify: `packages/dom-to-figma/src/converter/classify.ts`
- Test: `packages/dom-to-figma/src/converter/classify.browser.test.ts` (create if absent; classification needs computed style → browser project)

**Notes:** A block is a `text-paragraph` when: it has text content; it has at least one element child OR more than one rendered inline run (so a solo text node stays `text`); every rendered child is inline (text node, or an element whose `display` computes to `inline`/`inline-block` and which is itself leaf-text-like — no nested block, image, svg, or form); and it has no painted box concerns beyond what the text path already tolerates. Keep it conservative: anything with a block-level or non-text child falls through to `frame` as today.

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { loadTestFontIntoBrowser, TEST_FONT_FAMILY } from "./__fixtures__/loaders";
import { defaultClassify } from "./converter/classify";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("defaultClassify — inline paragraphs", () => {
  it("classifies a block of inline runs as text-paragraph", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}'">a <span>b</span> c</h1>`
    );
    expect(defaultClassify(block)).toBe("text-paragraph");
    document.body.innerHTML = "";
  });

  it("keeps a solo text block as plain text", () => {
    const block = mount(`<p style="font-family:'${TEST_FONT_FAMILY}'">just text</p>`);
    expect(defaultClassify(block)).toBe("text");
    document.body.innerHTML = "";
  });

  it("leaves a block with a block-level child as a frame", () => {
    const block = mount(`<div>text <div>nested block</div></div>`);
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/classify.browser.test.ts`
Expected: FAIL — `"text-paragraph"` not produced / not in `ElementKind`.

- [ ] **Step 3: Add the kind and predicate**

In `classify.ts`, add `"text-paragraph"` to the `ElementKind` union. In `defaultClassify`, before the `isPlainTextElement` → `"text"` check, add:

```typescript
  if (isInlineParagraph(element)) {
    return "text-paragraph";
  }
```

Add the predicate:

```typescript
// A block whose rendered children are all inline runs (sibling text nodes and
// inline leaf elements). Such a block is one paragraph and must convert to a
// single TEXT node so its runs share one layout pass — see the multi-segment
// text plan. Anything with a block-level, image, svg, or form child is not a
// paragraph and falls through to `frame`.
function isInlineParagraph(element: Element): boolean {
  if (!(element.textContent || "").trim().length) {
    return false;
  }
  const childElements = Array.from(element.children);
  if (childElements.length === 0) {
    return false; // solo text → existing `text` path
  }
  // Painted box on the block itself is fine (text path tolerates it via frame
  // wrapping elsewhere); here we only gate on child shape.
  for (const child of childElements) {
    const tag = child.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "input" || tag === "textarea" || tag === "br") {
      return false;
    }
    if (child.children.length > 0) {
      return false; // nested structure — not a flat inline run
    }
    const display = window.getComputedStyle(child).display;
    if (display !== "inline" && display !== "inline-block") {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/classify.browser.test.ts`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add packages/dom-to-figma/src/converter/classify.ts packages/dom-to-figma/src/classify.browser.test.ts
git commit -m "feat(text): classify inline-run blocks as text-paragraph"
```

---

## Task 6: Converter accepts a combined paragraph

**Files:**
- Modify: `packages/dom-to-figma/src/converter/nodes/text/converter.ts:98-110` (Params), and the body where `text`, `fontMetaData`, `textData`, and glyph fills are built.

**Notes:** Add an optional `paragraph?: { characters: string; styleRuns: StyleRuns; spans: ParagraphSpan[] }` to `Params`. When present:
- Use `paragraph.characters` as the layout text (instead of `node.textContent`).
- The node's base `fontName`/`fillPaints`/`textAlignHorizontal` come from the block element (already the `element` in this function when called with the block).
- Set `textData.characterStyleIDs = paragraph.styleRuns.characterStyleIDs` and `textData.styleOverrideTable = paragraph.styleRuns.styleOverrideTable`.
- This task wires the data through and emits the style table; multi-font glyph fills come in Task 7. For this task, lay out with the **base** font for all glyphs (correct positions for same-size runs; weight-induced advance differences are refined in Task 7).

- [ ] **Step 1: Write the failing test** (browser project, in `figma.text.browser.test.ts`)

```typescript
  it("emits characterStyleIDs and a styleOverrideTable for a styled paragraph", async () => {
    const element = mountElement(
      `<h1 style="width:600px;font-family:'${TEST_FONT_FAMILY}';font-size:32px;color:rgb(0,0,0)">Hi <span style="font-weight:700;color:rgb(255,0,0)">bold</span> end</h1>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({ element, width: 600, height: 120 });
    const textChange = result.document.nodeChanges.find((c) => c.type === "TEXT");
    if (textChange?.type !== "TEXT") throw new Error("expected TEXT node");

    expect(textChange.characters).toBe("Hi bold end");
    expect(textChange.textData?.characterStyleIDs).toHaveLength("Hi bold end".length);
    expect(textChange.textData?.styleOverrideTable?.length).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "characterStyleIDs"`
Expected: FAIL — only one TEXT node expected but currently three are produced, or `characterStyleIDs` undefined.

- [ ] **Step 3: Thread `paragraph` through `Params` and the body**

Add to `Params`:

```typescript
  paragraph?: {
    characters: string;
    characterStyleIDs: Array<number>;
    styleOverrideTable: Array<import("../../types/text").FigmaStyleOverride>;
  };
```

In the body, after `const rawText = textContent ?? defaultTextContent;`, prefer the paragraph text:

```typescript
  const paragraphText = options.paragraph?.characters;
  const sourceText = paragraphText ?? rawText;
```

Use `sourceText` everywhere `rawText` currently feeds layout/glyphs/`text`. When building `result.textData`, add:

```typescript
    textData: {
      characters: text,
      lines: [/* unchanged */],
      ...(options.paragraph && {
        characterStyleIDs: options.paragraph.characterStyleIDs,
        styleOverrideTable: options.paragraph.styleOverrideTable,
      }),
    },
```

- [ ] **Step 4: Add the `text-paragraph` case in `convert.ts`**

In `convert.ts`, add a case:

```typescript
    case "text-paragraph": {
      const paragraph = assembleParagraph(element);
      const styleRuns = buildStyleRuns(element, paragraph);
      return {
        changes: [
          await nodeToTextNodeChange(element, {
            guid,
            parentGuid,
            childIndex,
            position,
            registerBlob,
            inheritedProperties,
            fontCache,
            paragraph: {
              characters: paragraph.characters,
              characterStyleIDs: styleRuns.characterStyleIDs,
              styleOverrideTable: styleRuns.styleOverrideTable,
            },
          }),
        ],
        hasChildren: false,
      };
    }
```

Import `assembleParagraph`, `buildStyleRuns` from `./nodes/text/paragraph`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "characterStyleIDs"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-to-figma/src/converter/nodes/text/converter.ts packages/dom-to-figma/src/converter/convert.ts
git commit -m "feat(text): convert inline-paragraph blocks to one styled TEXT node"
```

---

## Task 7: Multi-font glyphs and fontMetaData

**Files:**
- Modify: `packages/dom-to-figma/src/converter/nodes/text/converter.ts` (glyph + fontMetaData emission)

**Notes:** When a paragraph mixes fonts/weights (e.g. a bold span), glyph advances and `fontMetaData` must reflect each run's font. Load each distinct font referenced by `styleOverrideTable` (plus the base) via `fontCache`. Generate glyphs per character using the font for that character's styleID; emit one `fontMetaData` entry per distinct loaded font. Keep positions from the single layout pass when all runs share a size; if a run differs in size, fall back to the base layout for positioning (acceptable for v1 — document it).

- [ ] **Step 1: Write the failing test**

```typescript
  it("emits one fontMetaData entry per distinct run font", async () => {
    const element = mountElement(
      `<h1 style="width:600px;font-family:'${TEST_FONT_FAMILY}';font-size:32px;font-weight:400">light <span style="font-weight:700">heavy</span></h1>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({ element, width: 600, height: 120 });
    const textChange = result.document.nodeChanges.find((c) => c.type === "TEXT");
    if (textChange?.type !== "TEXT") throw new Error("expected TEXT node");
    const styles = new Set(
      (textChange.derivedTextData?.fontMetaData ?? []).map((m) => m.fontWeight)
    );
    expect(styles.has(400)).toBe(true);
    expect(styles.has(700)).toBe(true);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "fontMetaData entry per"`
Expected: FAIL — only the base weight present.

- [ ] **Step 3: Implement multi-font emission**

Resolve the set of fonts: base + one per `styleOverrideTable` entry that changes `fontName`. Load each through `fontCache`. Build `fontMetaData` from the deduped set. For glyph generation, map each character index → styleID → font, generating that character's glyph blob from the matching loaded font; keep x/y from the existing layout positions. (Reuse `processGlyphs` per font subset, or extend it to accept a per-character font resolver — implementer's choice; smaller diff preferred.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "fontMetaData entry per"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dom-to-figma/src/converter/nodes/text/converter.ts
git commit -m "feat(text): emit per-run fonts and fontMetaData for paragraphs"
```

---

## Task 8: Per-run gradient/solid fills on glyphs

**Files:**
- Modify: `packages/dom-to-figma/src/converter/nodes/text/converter.ts`

**Notes:** The `.accent` span uses `background-clip:text` with a gradient and `color:transparent`. The base node `fillPaints` covers styleID-0 characters; the span's gradient must ride on its `styleOverrideTable` entry's `fillPaints` (already emitted by Task 4). Verify the gradient survives end-to-end: a styled paragraph whose span carries a gradient produces a `styleOverrideTable` entry with a gradient paint, and the base node keeps its solid/none fill.

- [ ] **Step 1: Write the failing/asserting test**

```typescript
  it("keeps a gradient span as a per-run fill override", async () => {
    const element = mountElement(
      `<h1 style="width:600px;font-family:'${TEST_FONT_FAMILY}';font-size:32px;color:rgb(0,0,0)">go <span style="background:linear-gradient(135deg,#f97316,#db2777);-webkit-background-clip:text;background-clip:text;color:transparent">far</span></h1>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({ element, width: 600, height: 120 });
    const textChange = result.document.nodeChanges.find((c) => c.type === "TEXT");
    if (textChange?.type !== "TEXT") throw new Error("expected TEXT node");
    const override = textChange.textData?.styleOverrideTable?.[0];
    const paint = override?.fillPaints?.[0] as { type?: string } | undefined;
    expect(paint?.type).toMatch(/GRADIENT/);
  });
```

- [ ] **Step 2: Run to verify** — likely PASS already if Task 4 emitted gradient fills; if not, fix `fillsFor`/override emission until it passes.

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "gradient span"`
Expected: PASS.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add packages/dom-to-figma/src/converter/nodes/text/converter.ts packages/dom-to-figma/src/converter/nodes/text/paragraph/style-runs.ts
git commit -m "feat(text): preserve gradient span as per-run fill"
```

---

## Task 9: Corpus scene

**Files:**
- Keep/verify: `apps/playground/src/corpus/typography/centered-runs.html` (already created)

- [ ] **Step 1: Confirm the scene exists and renders**

Run: `pnpm --filter @figit/playground dev` (or the playground's dev script — check `apps/playground/package.json`) and open `typography/centered-runs`. Confirm the centered h1 wraps to three visual lines and the right-aligned paragraph wraps with a styled run.

- [ ] **Step 2: Commit (if not already)**

```bash
git add apps/playground/src/corpus/typography/centered-runs.html
git commit -m "test(playground): add centered multi-segment typography scene"
```

---

## Task 10: Non-overlap + integration browser test

**Files:**
- Modify: `packages/dom-to-figma/src/figma.text.browser.test.ts`

**Notes:** Replace the draft non-overlap test (added during investigation) with the paragraph-aware version: a centered multi-segment h1 now produces exactly **one** TEXT node whose multi-line layout is internally non-overlapping (baselines have distinct, increasing `lineY`), and whose `characters` is the full combined string.

- [ ] **Step 1: Write the test**

```typescript
  it("lays out a centered multi-segment heading as one wrapped TEXT node", async () => {
    const FRAME = 360;
    const element = mountElement(
      `<h1 style="width:${FRAME}px;text-align:center;line-height:1.05;font-size:48px;font-family:'${TEST_FONT_FAMILY}',sans-serif;margin:0">Move designs from <span style="font-weight:700">browser to Figma</span> in one paste.</h1>`
    );
    const figma = createFigmaConverter({ fontLoader: createTestFontLoader() });
    const result = await figma.convert({ element, width: FRAME, height: 400 });

    const textChanges = result.document.nodeChanges.filter((c) => c.type === "TEXT");
    expect(textChanges).toHaveLength(1);
    const textChange = textChanges[0];
    if (textChange?.type !== "TEXT") throw new Error("expected TEXT node");

    expect(textChange.characters).toBe("Move designs from browser to Figma in one paste.");

    // Wrapped onto multiple lines with strictly increasing line offsets — the
    // runs no longer stack: each baseline sits below the previous one.
    const baselines = textChange.derivedTextData?.baselines ?? [];
    expect(baselines.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < baselines.length; i += 1) {
      expect(baselines[i]!.lineY).toBeGreaterThan(baselines[i - 1]!.lineY);
    }

    // The bold span survived as a per-character style override.
    expect(textChange.textData?.styleOverrideTable?.length).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm --filter @figit/dom-to-figma exec vitest run --project browser src/figma.text.browser.test.ts -t "centered multi-segment heading"`
Expected: PASS.

- [ ] **Step 3: Remove the obsolete draft test** (the per-run "non-overlapping runs" test from investigation, if still present) and commit.

```bash
git add packages/dom-to-figma/src/figma.text.browser.test.ts
git commit -m "test(text): assert centered multi-segment heading is one wrapped node"
```

---

## Task 11: Full regression sweep

- [ ] **Step 1: Run the whole package test suite**

Run: `pnpm --filter @figit/dom-to-figma test`
Expected: all unit + browser tests pass. Pay attention to existing text-gradient and inline-runs corpus-derived tests — confirm no regressions.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm --filter @figit/dom-to-figma check-types` and the repo's biome/lint script.
Expected: clean.

- [ ] **Step 3: Manual Figma paste verification**

Build/run the extension, paste the `integrations/landing` scene into Figma, and confirm the `.hero h1` reads as three stacked lines (not overlapping), with the gradient on "browser to Figma" preserved and the text fully editable as one node.

- [ ] **Step 4: Final commit / PR**

```bash
git add -A
git commit -m "feat(text): merge inline runs into one styled Figma TEXT node"
```

---

## Self-Review notes

- **Spec coverage:** encoder guard (Task 1), overlap fix (Tasks 5–6, 10), per-character styling/gradient (Tasks 4, 7, 8), corpus scene (Task 9), browser test (Task 10), Figma paste verification (Task 11). ✔
- **Open verification items for the implementer (resolve before relying on them):**
  1. `parseFontProperties` export name/shape in `primitives/font/properties.ts` (Task 4).
  2. Whether `processGlyphs` can be reused per-font or needs a per-character font resolver (Task 7).
  3. fig-kiwi round-trip of `TextData.characterStyleIDs`/`styleOverrideTable` is **confirmed** (pre-flight probe) and locked by Task 1 — no encoder change needed.
- **Type consistency:** `StyleRuns`, `AssembledParagraph`, `ParagraphSpan`, `FigmaStyleOverride` names are used identically across Tasks 3–10.
- **Known limitation (V1):** promoted to its own `## Known limitation (V1)` section near the top; runs that differ in *font size* keep base-font glyph positions. Same-size weight/color/gradient runs (the reported case) are exact.
