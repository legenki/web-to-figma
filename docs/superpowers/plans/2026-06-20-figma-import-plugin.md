# Figit Import Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Figma plugin that turns an HTML file (or pasted markup) into editable Figma layers entirely inside Figma.

**Architecture:** The plugin UI (`ui.html`, a real browser iframe) renders the user's HTML inside a nested sandbox iframe, runs the existing `@figit/dom-to-figma` converter against that live DOM, and posts the resulting `FigmaNodeChange[]` to the sandbox (`code.ts`), where a new `node-builder` maps each node change to Plugin API calls (`figma.createFrame`/`createText`, fills, effects, fonts, auto-layout).

**Tech Stack:** TypeScript, Vite (single-file bundles for `code.js` and `ui.html`), React 19 + `@figit/ui`, `@figma/plugin-typings`, Vitest (node env, mocked Plugin API), `@figit/dom-to-figma` (unchanged).

**Spec:** `docs/superpowers/specs/2026-06-20-figma-import-plugin-design.md`

---

## File Structure

```
apps/plugin/
├── manifest.json              # Figma manifest: api, main, ui, networkAccess
├── package.json               # name "plugin", build scripts, deps
├── tsconfig.json              # extends base, types: ["@figma/plugin-typings"]
├── vite.config.ts             # two builds: code (IIFE) + ui (single file)
├── vitest.config.ts           # node env unit tests
├── index.html                 # ui entry (mounts React)
└── src/
    ├── code.ts                # sandbox entry: receives nodes, calls builder
    ├── builder/
    │   ├── build-nodes.ts     # tree rebuild + recursive creation (orchestrator)
    │   ├── build-nodes.test.ts
    │   ├── tree.ts            # FigmaNodeChange[] → rooted tree by guid
    │   ├── tree.test.ts
    │   ├── transform.ts       # matrix → {x, y, rotation} (+ shear warning)
    │   ├── transform.test.ts
    │   ├── paint-mapper.ts    # FigmaPaint → Figma Paint
    │   ├── paint-mapper.test.ts
    │   ├── effect-mapper.ts   # FigmaEffect → Figma Effect
    │   ├── effect-mapper.test.ts
    │   ├── auto-layout.ts     # stack* fields → layout* props
    │   ├── auto-layout.test.ts
    │   ├── text-builder.ts    # font load + text props (async)
    │   ├── fonts.ts           # loadFontWithFallback helper
    │   ├── fonts.test.ts
    │   └── figma-mock.ts      # test-only Plugin API mock
    ├── messages.ts            # shared postMessage types (ui <-> code)
    └── ui/
        ├── main.tsx           # React root
        ├── app.tsx            # drop-zone + textarea + status
        ├── render-host.ts     # nested sandbox iframe + convert
        └── style.css
```

Each builder sub-module has one responsibility and is unit-tested in isolation against a mocked `figma` global. `build-nodes.ts` is the orchestrator that wires them together.

---

## Task 1: Scaffold the plugin workspace

**Files:**
- Create: `apps/plugin/package.json`
- Create: `apps/plugin/tsconfig.json`
- Create: `apps/plugin/manifest.json`
- Create: `apps/plugin/src/code.ts`

- [ ] **Step 1: Create `apps/plugin/package.json`**

```json
{
  "name": "plugin",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "check-types": "tsc --noEmit",
    "lint": "biome check"
  },
  "dependencies": {
    "@figit/dom-to-figma": "workspace:*",
    "@figit/ui": "workspace:*",
    "react": "^19.2.5",
    "react-dom": "^19.2.5"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.100.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "typescript": "catalog:",
    "vite": "^8.0.10",
    "vite-plugin-singlefile": "^2.0.3",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 2: Create `apps/plugin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["@figma/plugin-typings", "vite/client"],
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `apps/plugin/manifest.json`**

`networkAccess.allowedDomains` lists the fontsource CDN the default font loader uses; `devAllowedDomains` allows the local static server used to test bundled HTML files. `reasoning` is required because we also allow `https://*` for arbitrary page assets (fonts/images referenced by imported HTML).

```json
{
  "name": "Figit Import",
  "id": "figit-import-dev",
  "api": "1.0.0",
  "editorType": ["figma"],
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "networkAccess": {
    "allowedDomains": ["https://cdn.jsdelivr.net", "https://*"],
    "devAllowedDomains": ["http://127.0.0.1:*", "http://localhost:*"],
    "reasoning": "Imported HTML may reference fonts and images on arbitrary domains; the default font loader fetches from the fontsource CDN."
  }
}
```

- [ ] **Step 4: Create a placeholder `apps/plugin/src/code.ts`**

```ts
// Sandbox entry. Wired up in later tasks.
figma.showUI(__html__, { width: 420, height: 560 });
```

- [ ] **Step 5: Install deps and verify the workspace is recognized**

Run: `pnpm install`
Expected: completes; `pnpm --filter plugin exec tsc --version` prints a version.

- [ ] **Step 6: Commit**

```bash
git add apps/plugin/package.json apps/plugin/tsconfig.json apps/plugin/manifest.json apps/plugin/src/code.ts pnpm-lock.yaml
git commit -m "feat(plugin): scaffold figma import plugin workspace"
```

---

## Task 2: Shared message types

**Files:**
- Create: `apps/plugin/src/messages.ts`

- [ ] **Step 1: Create `apps/plugin/src/messages.ts`**

**Do Task 2a FIRST** — `FigmaNodeChange` is currently only reachable via the package's internal `./converter/types` path, not the public `figma.ts` entry, so the `./internal` subpath export must exist before this import resolves.

```ts
import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";

export type UiToCode =
  | { type: "import-nodes"; nodeChanges: Array<FigmaNodeChange>; rootName: string }
  | { type: "cancel" };

export type CodeToUi =
  | { type: "import-done"; built: number; total: number; skipped: number; missingFonts: Array<string>; warnings: Array<string> }
  | { type: "import-error"; message: string };
```

- [ ] **Step 2: Type-check (after Task 2a is done)**

Run: `pnpm --filter plugin exec tsc --noEmit`
Expected: PASS (the `./internal` export from Task 2a resolves the import).

### Task 2a (required, do before Step 2): expose `FigmaNodeChange` from dom-to-figma

**Files:**
- Modify: `packages/dom-to-figma/package.json` (add an `./internal` export)
- Create: `packages/dom-to-figma/src/internal.ts`

- [ ] Create `packages/dom-to-figma/src/internal.ts`:

```ts
export type {
  FigmaNodeChange,
  FigmaFrameNodeChange,
  FigmaTextNodeChange,
  FigmaPaint,
  FigmaEffect,
  FigmaTransform,
} from "./converter/types";
```

- [ ] In `packages/dom-to-figma/package.json`, add to `exports` (and mirror under `publishConfig.exports`):

```json
"./internal": {
  "types": "./src/internal.ts",
  "import": "./src/internal.ts"
}
```

- [ ] Re-run `pnpm --filter plugin exec tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/plugin/src/messages.ts packages/dom-to-figma
git commit -m "feat(plugin): shared ui<->code message types"
```

---

## Task 3: Test-only Plugin API mock

**Files:**
- Create: `apps/plugin/src/builder/figma-mock.ts`

The mock records created nodes so unit tests can assert structure without a real Figma runtime. It implements only what the builder uses.

- [ ] **Step 1: Create `apps/plugin/src/builder/figma-mock.ts`**

```ts
// Minimal stand-in for the parts of the Figma Plugin API the builder calls.
// Tests install this on globalThis.figma.

export type MockNode = {
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: Array<MockNode>;
  fills?: unknown;
  effects?: unknown;
  characters?: string;
  fontName?: unknown;
  fontSize?: number;
  layoutMode?: string;
  itemSpacing?: number;
  cornerRadius?: number;
  [key: string]: unknown;
};

function makeNode(type: string): MockNode {
  const node: MockNode = {
    type,
    name: type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: [],
    appendChild(child: MockNode) {
      node.children.push(child);
    },
    resize(w: number, h: number) {
      node.width = w;
      node.height = h;
    },
  } as MockNode;
  return node;
}

export function createFigmaMock() {
  const loadedFonts = new Set<string>();
  const availableFonts = new Set<string>(["Inter::Regular", "Inter::Medium", "Inter::Bold"]);
  return {
    createFrame: () => makeNode("FRAME"),
    createText: () => makeNode("TEXT"),
    group: (nodes: Array<MockNode>) => {
      const g = makeNode("GROUP");
      g.children = nodes;
      return g;
    },
    loadFontAsync: (font: { family: string; style: string }) => {
      const key = `${font.family}::${font.style}`;
      if (!availableFonts.has(key)) {
        return Promise.reject(new Error(`font not found: ${key}`));
      }
      loadedFonts.add(key);
      return Promise.resolve();
    },
    currentPage: makeNode("PAGE"),
    viewport: { scrollAndZoomIntoView: (_: Array<MockNode>) => {} },
    __loadedFonts: loadedFonts,
    __availableFonts: availableFonts,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/plugin/src/builder/figma-mock.ts
git commit -m "test(plugin): add figma plugin api mock for builder tests"
```

---

## Task 4: Tree rebuild (`tree.ts`)

**Files:**
- Create: `apps/plugin/src/builder/tree.ts`
- Test: `apps/plugin/src/builder/tree.test.ts`

`FigmaNodeChange[]` is flat. Each node carries `guid.localID` and (except the root) a `parentIndex.guid.localID` + string `parentIndex.position`. Rebuild a rooted tree, children sorted by `position`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";
import { buildTree } from "./tree";

function frame(localID: number, parent?: number, position = "0"): FigmaNodeChange {
  return {
    type: "FRAME",
    guid: { sessionID: 0, localID },
    phase: "CREATED",
    name: `n${localID}`,
    visible: true,
    opacity: 1,
    ...(parent !== undefined
      ? { parentIndex: { guid: { sessionID: 0, localID: parent }, position } }
      : {}),
  } as FigmaNodeChange;
}

describe("buildTree", () => {
  it("roots at the node whose parent is the reserved root and nests children", () => {
    const changes = [frame(3, 0, "a"), frame(4, 3, "b"), frame(5, 3, "a")];
    const tree = buildTree(changes, 0);
    expect(tree.map((n) => n.change.guid.localID)).toEqual([3]);
    // children of 3 sorted by position "a" < "b" => [5, 4]
    expect(tree[0]!.children.map((c) => c.change.guid.localID)).toEqual([5, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/tree.test.ts`
Expected: FAIL ("buildTree is not a function" / module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";

export type TreeNode = {
  change: FigmaNodeChange;
  children: Array<TreeNode>;
};

export function buildTree(
  changes: Array<FigmaNodeChange>,
  rootParentLocalId: number
): Array<TreeNode> {
  const nodes = new Map<number, TreeNode>();
  for (const change of changes) {
    nodes.set(change.guid.localID, { change, children: [] });
  }

  const roots: Array<{ node: TreeNode; position: string }> = [];
  const childBuckets = new Map<number, Array<{ node: TreeNode; position: string }>>();

  for (const change of changes) {
    const node = nodes.get(change.guid.localID)!;
    const parentId = change.parentIndex?.guid.localID;
    const position = change.parentIndex?.position ?? "";
    if (parentId === undefined || parentId === rootParentLocalId) {
      roots.push({ node, position });
      continue;
    }
    const bucket = childBuckets.get(parentId) ?? [];
    bucket.push({ node, position });
    childBuckets.set(parentId, bucket);
  }

  const byPosition = (a: { position: string }, b: { position: string }) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0;

  for (const [parentId, bucket] of childBuckets) {
    const parent = nodes.get(parentId);
    if (!parent) continue;
    parent.children = bucket.sort(byPosition).map((e) => e.node);
  }

  return roots.sort(byPosition).map((e) => e.node);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/tree.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/tree.ts apps/plugin/src/builder/tree.test.ts
git commit -m "feat(plugin): rebuild figma node tree from flat node changes"
```

---

## Task 5: Transform matrix → position (`transform.ts`)

**Files:**
- Create: `apps/plugin/src/builder/transform.ts`
- Test: `apps/plugin/src/builder/transform.test.ts`

`FigmaTransform` is `{m00,m01,m02,m10,m11,m12}`. Translate is `(m02, m12)`. Rotation from `atan2(m10, m00)`. Shear/non-unit scale are unsupported in V1: detected and reported as a warning, otherwise ignored.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { decomposeTransform } from "./transform";

describe("decomposeTransform", () => {
  it("extracts translation from a pure-translate matrix", () => {
    const r = decomposeTransform({ m00: 1, m01: 0, m02: 12, m10: 0, m11: 1, m12: 34 });
    expect(r.x).toBe(12);
    expect(r.y).toBe(34);
    expect(r.rotation).toBeCloseTo(0);
    expect(r.warning).toBeUndefined();
  });

  it("warns on shear", () => {
    const r = decomposeTransform({ m00: 1, m01: 0.5, m02: 0, m10: 0, m11: 1, m12: 0 });
    expect(r.warning).toMatch(/shear/i);
  });

  it("returns identity translation when transform is undefined", () => {
    const r = decomposeTransform(undefined);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/transform.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FigmaTransform } from "@figit/dom-to-figma/internal";

export type Decomposed = {
  x: number;
  y: number;
  rotation: number;
  warning?: string;
};

const SHEAR_EPSILON = 1e-4;

export function decomposeTransform(t: FigmaTransform | undefined): Decomposed {
  if (!t) {
    return { x: 0, y: 0, rotation: 0 };
  }
  const rotation = Math.atan2(t.m10, t.m00) * (180 / Math.PI);
  // A pure rotation+translation has m01 === -m10 and m00 === m11.
  const shear = Math.abs(t.m00 * t.m01 + t.m10 * t.m11);
  const warning =
    shear > SHEAR_EPSILON ? "shear/skew is not supported in V1 and was ignored" : undefined;
  return { x: t.m02, y: t.m12, rotation, warning };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/transform.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/transform.ts apps/plugin/src/builder/transform.test.ts
git commit -m "feat(plugin): decompose figma transform matrix to x/y/rotation"
```

---

## Task 6: Paint mapper (`paint-mapper.ts`)

**Files:**
- Create: `apps/plugin/src/builder/paint-mapper.ts`
- Test: `apps/plugin/src/builder/paint-mapper.test.ts`

Maps `FigmaPaint` (SOLID, GRADIENT_LINEAR; IMAGE skipped in V1) to Figma `Paint`. `FigmaColor` is `{r,g,b,a}` in 0..1 — Figma's `RGB` is `{r,g,b}` (0..1) with separate `opacity`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { FigmaPaint } from "@figit/dom-to-figma/internal";
import { mapPaints } from "./paint-mapper";

describe("mapPaints", () => {
  it("maps a solid paint and splits alpha into opacity", () => {
    const paints: Array<FigmaPaint> = [
      { type: "SOLID", color: { r: 1, g: 0, b: 0, a: 0.5 }, opacity: 1, visible: true, blendMode: "NORMAL" },
    ];
    const out = mapPaints(paints);
    expect(out).toEqual([
      { type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 0.5, visible: true, blendMode: "NORMAL" },
    ]);
  });

  it("drops IMAGE paints in V1", () => {
    const paints = [
      { type: "IMAGE", image: { hash: [] }, opacity: 1, visible: true, blendMode: "NORMAL" },
    ] as Array<FigmaPaint>;
    expect(mapPaints(paints)).toEqual([]);
  });

  it("maps a linear gradient with stops", () => {
    const paints: Array<FigmaPaint> = [
      {
        type: "GRADIENT_LINEAR",
        stops: [
          { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
          { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
        ],
        opacity: 1,
        visible: true,
        blendMode: "NORMAL",
      },
    ];
    const out = mapPaints(paints);
    expect(out[0]!.type).toBe("GRADIENT_LINEAR");
    expect((out[0] as { gradientStops: Array<unknown> }).gradientStops).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/paint-mapper.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FigmaPaint } from "@figit/dom-to-figma/internal";

// Figma's GradientPaint requires a gradientTransform; a top-to-bottom default
// is used for V1 (the converter encodes the visual direction into stops only
// for the clipboard path; refining direction is future work).
const DEFAULT_GRADIENT_TRANSFORM = [
  [1, 0, 0],
  [0, 1, 0],
];

export function mapPaints(paints: Array<FigmaPaint> | undefined): Array<Paint> {
  if (!paints) return [];
  const out: Array<Paint> = [];
  for (const p of paints) {
    if (p.type === "SOLID") {
      out.push({
        type: "SOLID",
        color: { r: p.color.r, g: p.color.g, b: p.color.b },
        opacity: p.color.a,
        visible: p.visible,
        blendMode: p.blendMode as BlendMode,
      });
    } else if (p.type === "GRADIENT_LINEAR") {
      out.push({
        type: "GRADIENT_LINEAR",
        gradientTransform: DEFAULT_GRADIENT_TRANSFORM as Transform,
        gradientStops: p.stops.map((s) => ({
          position: s.position,
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        })),
        opacity: p.opacity,
        visible: p.visible,
        blendMode: p.blendMode as BlendMode,
      });
    }
    // IMAGE: skipped in V1.
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/paint-mapper.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/paint-mapper.ts apps/plugin/src/builder/paint-mapper.test.ts
git commit -m "feat(plugin): map figma paints (solid + linear gradient) to plugin api"
```

---

## Task 7: Effect mapper (`effect-mapper.ts`)

**Files:**
- Create: `apps/plugin/src/builder/effect-mapper.ts`
- Test: `apps/plugin/src/builder/effect-mapper.test.ts`

Maps `FigmaEffect` to Figma `Effect`. V1 handles DROP_SHADOW and INNER_SHADOW; blur effects (FOREGROUND_BLUR/BACKGROUND_BLUR) map to LAYER_BLUR/BACKGROUND_BLUR.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { FigmaEffect } from "@figit/dom-to-figma/internal";
import { mapEffects } from "./effect-mapper";

describe("mapEffects", () => {
  it("maps a drop shadow", () => {
    const effects: Array<FigmaEffect> = [
      {
        type: "DROP_SHADOW",
        visible: true,
        radius: 8,
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 2 },
        blendMode: "NORMAL",
        spread: 0,
      },
    ];
    const out = mapEffects(effects);
    expect(out).toEqual([
      {
        type: "DROP_SHADOW",
        visible: true,
        radius: 8,
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 2 },
        blendMode: "NORMAL",
        spread: 0,
      },
    ]);
  });

  it("maps a foreground blur to LAYER_BLUR", () => {
    const effects = [
      { type: "FOREGROUND_BLUR", visible: true, radius: 4 },
    ] as Array<FigmaEffect>;
    expect(mapEffects(effects)).toEqual([
      { type: "LAYER_BLUR", visible: true, radius: 4 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/effect-mapper.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FigmaEffect } from "@figit/dom-to-figma/internal";

export function mapEffects(effects: Array<FigmaEffect> | undefined): Array<Effect> {
  if (!effects) return [];
  const out: Array<Effect> = [];
  for (const e of effects) {
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      out.push({
        type: e.type,
        visible: e.visible,
        radius: e.radius,
        color: e.color,
        offset: e.offset,
        blendMode: e.blendMode as BlendMode,
        spread: e.spread ?? 0,
      } as Effect);
    } else if (e.type === "FOREGROUND_BLUR") {
      out.push({ type: "LAYER_BLUR", visible: e.visible, radius: e.radius } as Effect);
    } else if (e.type === "BACKGROUND_BLUR") {
      out.push({ type: "BACKGROUND_BLUR", visible: e.visible, radius: e.radius } as Effect);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/effect-mapper.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/effect-mapper.ts apps/plugin/src/builder/effect-mapper.test.ts
git commit -m "feat(plugin): map figma shadow/blur effects to plugin api"
```

---

## Task 8: Auto-layout mapper (`auto-layout.ts`)

**Files:**
- Create: `apps/plugin/src/builder/auto-layout.ts`
- Test: `apps/plugin/src/builder/auto-layout.test.ts`

Applies `FigmaFrameNodeChange` stack* fields to a frame-like node. Stack enum strings come straight from the converter (`"MIN"`, `"MAX"`, `"CENTER"`, `"SPACE_BETWEEN"`, `"AUTO"`, `"FIXED"`); these match Plugin API enum values, so they pass through. `stackMode "NONE"` leaves `layoutMode === "NONE"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { FigmaFrameNodeChange } from "@figit/dom-to-figma/internal";
import { applyAutoLayout } from "./auto-layout";

function frameChange(extra: Partial<FigmaFrameNodeChange>): FigmaFrameNodeChange {
  return {
    type: "FRAME",
    guid: { sessionID: 0, localID: 1 },
    phase: "CREATED",
    name: "f",
    visible: true,
    opacity: 1,
    ...extra,
  } as FigmaFrameNodeChange;
}

describe("applyAutoLayout", () => {
  it("maps vertical stack with spacing and padding", () => {
    const node: Record<string, unknown> = {};
    applyAutoLayout(node as never, frameChange({
      stackMode: "VERTICAL",
      stackSpacing: 12,
      stackHorizontalPadding: 16,
      stackVerticalPadding: 8,
      stackPaddingRight: 16,
      stackPaddingBottom: 8,
      stackPrimaryAlignItems: "CENTER",
    }));
    expect(node.layoutMode).toBe("VERTICAL");
    expect(node.itemSpacing).toBe(12);
    expect(node.paddingLeft).toBe(16);
    expect(node.paddingRight).toBe(16);
    expect(node.paddingTop).toBe(8);
    expect(node.paddingBottom).toBe(8);
    expect(node.primaryAxisAlignItems).toBe("CENTER");
  });

  it("does nothing when stackMode is NONE", () => {
    const node: Record<string, unknown> = {};
    applyAutoLayout(node as never, frameChange({ stackMode: "NONE" }));
    expect(node.layoutMode).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/auto-layout.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FigmaFrameNodeChange } from "@figit/dom-to-figma/internal";

export function applyAutoLayout(node: FrameNode, change: FigmaFrameNodeChange): void {
  if (!change.stackMode || change.stackMode === "NONE") {
    return;
  }
  node.layoutMode = change.stackMode;
  if (change.stackSpacing !== undefined) node.itemSpacing = change.stackSpacing;
  if (change.stackCounterSpacing !== undefined) node.counterAxisSpacing = change.stackCounterSpacing;
  if (change.stackWrap !== undefined) node.layoutWrap = change.stackWrap as FrameNode["layoutWrap"];
  if (change.stackHorizontalPadding !== undefined) node.paddingLeft = change.stackHorizontalPadding;
  if (change.stackPaddingRight !== undefined) node.paddingRight = change.stackPaddingRight;
  if (change.stackVerticalPadding !== undefined) node.paddingTop = change.stackVerticalPadding;
  if (change.stackPaddingBottom !== undefined) node.paddingBottom = change.stackPaddingBottom;
  if (change.stackPrimarySizing !== undefined) node.primaryAxisSizingMode = change.stackPrimarySizing as FrameNode["primaryAxisSizingMode"];
  if (change.stackCounterSizing !== undefined) node.counterAxisSizingMode = change.stackCounterSizing as FrameNode["counterAxisSizingMode"];
  if (change.stackPrimaryAlignItems !== undefined) node.primaryAxisAlignItems = change.stackPrimaryAlignItems as FrameNode["primaryAxisAlignItems"];
  if (change.stackCounterAlignItems !== undefined) node.counterAxisAlignItems = change.stackCounterAlignItems as FrameNode["counterAxisAlignItems"];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/auto-layout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/auto-layout.ts apps/plugin/src/builder/auto-layout.test.ts
git commit -m "feat(plugin): apply auto-layout stack fields to frame nodes"
```

---

## Task 9: Font loading with fallback (`fonts.ts`)

**Files:**
- Create: `apps/plugin/src/builder/fonts.ts`
- Test: `apps/plugin/src/builder/fonts.test.ts`

`loadFontWithFallback` tries the requested `{family, style}`, and on rejection falls back to `Inter Regular`, recording the missing family. Returns the font that actually loaded.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createFigmaMock } from "./figma-mock";
import { loadFontWithFallback } from "./fonts";

describe("loadFontWithFallback", () => {
  beforeEach(() => {
    (globalThis as { figma?: unknown }).figma = createFigmaMock();
  });

  it("loads the requested font when available", async () => {
    const missing = new Set<string>();
    const font = await loadFontWithFallback({ family: "Inter", style: "Bold" }, missing);
    expect(font).toEqual({ family: "Inter", style: "Bold" });
    expect(missing.size).toBe(0);
  });

  it("falls back to Inter Regular and records the missing family", async () => {
    const missing = new Set<string>();
    const font = await loadFontWithFallback({ family: "IBM Plex Sans", style: "Regular" }, missing);
    expect(font).toEqual({ family: "Inter", style: "Regular" });
    expect([...missing]).toContain("IBM Plex Sans");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/fonts.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
const FALLBACK: FontName = { family: "Inter", style: "Regular" };

export async function loadFontWithFallback(
  requested: FontName,
  missingFamilies: Set<string>
): Promise<FontName> {
  try {
    await figma.loadFontAsync(requested);
    return requested;
  } catch {
    missingFamilies.add(requested.family);
    await figma.loadFontAsync(FALLBACK);
    return FALLBACK;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/fonts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/plugin/src/builder/fonts.ts apps/plugin/src/builder/fonts.test.ts
git commit -m "feat(plugin): load fonts with inter fallback and track missing families"
```

---

## Task 10: Text builder (`text-builder.ts`)

**Files:**
- Create: `apps/plugin/src/builder/text-builder.ts`

Builds a TEXT node from a `FigmaTextNodeChange`: load font (with fallback), set `characters`, `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`, fills. Tested indirectly via Task 11's builder integration test (it needs `createText` + font load together, which the mock already supports).

- [ ] **Step 1: Create `apps/plugin/src/builder/text-builder.ts`**

```ts
import type { FigmaTextNodeChange } from "@figit/dom-to-figma/internal";
import { loadFontWithFallback } from "./fonts";
import { mapPaints } from "./paint-mapper";

export async function buildText(
  change: FigmaTextNodeChange,
  missingFamilies: Set<string>
): Promise<TextNode> {
  const node = figma.createText();
  const requested: FontName = {
    family: change.fontName?.family ?? "Inter",
    style: change.fontName?.style ?? "Regular",
  };
  const loaded = await loadFontWithFallback(requested, missingFamilies);
  node.fontName = loaded;
  node.characters = change.characters ?? "";
  if (change.fontSize !== undefined) node.fontSize = change.fontSize;
  if (change.lineHeight) {
    node.lineHeight = { value: change.lineHeight.value, unit: change.lineHeight.units as "PIXELS" | "PERCENT" };
  }
  if (change.letterSpacing) {
    node.letterSpacing = { value: change.letterSpacing.value, unit: change.letterSpacing.units as "PIXELS" | "PERCENT" };
  }
  if (change.textAlignHorizontal) {
    node.textAlignHorizontal = change.textAlignHorizontal as TextNode["textAlignHorizontal"];
  }
  const fills = mapPaints(change.fillPaints);
  if (fills.length > 0) node.fills = fills;
  return node;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter plugin exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/plugin/src/builder/text-builder.ts
git commit -m "feat(plugin): build text nodes with fonts, metrics, and fills"
```

---

## Task 11: Node builder orchestrator (`build-nodes.ts`)

**Files:**
- Create: `apps/plugin/src/builder/build-nodes.ts`
- Test: `apps/plugin/src/builder/build-nodes.test.ts`

Walks the tree, creates a frame or text node per change, applies size/position/fills/effects/auto-layout, recurses into children, appends to parent. Per-node try/catch: a failing node is skipped and counted. Returns a summary. The reserved root parent localID is `0` (matches `ROOT_FRAME_GUID` handling in the converter; confirm against `packages/dom-to-figma/src/converter/nodes/root`).

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";
import { createFigmaMock } from "./figma-mock";
import { buildNodes } from "./build-nodes";

function base(localID: number, parent: number, type: "FRAME" | "TEXT") {
  return {
    type,
    guid: { sessionID: 0, localID },
    phase: "CREATED",
    name: `n${localID}`,
    visible: true,
    opacity: 1,
    size: { x: 100, y: 40 },
    transform: { m00: 1, m01: 0, m02: 5, m10: 0, m11: 1, m12: 6 },
    parentIndex: { guid: { sessionID: 0, localID: parent }, position: "0" },
  };
}

describe("buildNodes", () => {
  beforeEach(() => {
    (globalThis as { figma?: unknown }).figma = createFigmaMock();
  });

  it("builds a frame with a text child and reports a summary", async () => {
    const changes: Array<FigmaNodeChange> = [
      { ...base(3, 0, "FRAME"), fillPaints: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true, blendMode: "NORMAL" }] } as FigmaNodeChange,
      { ...base(4, 3, "TEXT"), characters: "Hi", fontName: { family: "Inter", style: "Regular" } } as FigmaNodeChange,
    ];
    const result = await buildNodes(changes, 0, "My Import");
    expect(result.summary.built).toBe(2);
    expect(result.summary.skipped).toBe(0);
    expect(result.root.type).toBe("FRAME");
    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0]!.type).toBe("TEXT");
    expect((result.root.children[0] as { characters?: string }).characters).toBe("Hi");
    // position from transform
    expect(result.root.x).toBe(5);
    expect(result.root.y).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin exec vitest run src/builder/build-nodes.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type {
  FigmaFrameNodeChange,
  FigmaNodeChange,
  FigmaTextNodeChange,
} from "@figit/dom-to-figma/internal";
import { applyAutoLayout } from "./auto-layout";
import { mapEffects } from "./effect-mapper";
import { mapPaints } from "./paint-mapper";
import { buildText } from "./text-builder";
import { decomposeTransform } from "./transform";
import { buildTree, type TreeNode } from "./tree";

export type BuildSummary = {
  built: number;
  total: number;
  skipped: number;
  missingFonts: Array<string>;
  warnings: Array<string>;
};

export type BuildResult = {
  root: SceneNode & { children: ReadonlyArray<SceneNode> };
  summary: BuildSummary;
};

export async function buildNodes(
  changes: Array<FigmaNodeChange>,
  rootParentLocalId: number,
  rootName: string
): Promise<BuildResult> {
  const tree = buildTree(changes, rootParentLocalId);
  const missingFonts = new Set<string>();
  const warnings: Array<string> = [];
  let built = 0;
  let skipped = 0;

  async function makeNode(treeNode: TreeNode): Promise<SceneNode | null> {
    const change = treeNode.change;
    try {
      let node: SceneNode;
      if (change.type === "TEXT") {
        node = await buildText(change as FigmaTextNodeChange, missingFonts);
      } else {
        node = figma.createFrame();
        applyFrame(node as FrameNode, change);
      }
      node.name = change.name;
      applyGeometry(node, change, warnings);
      built += 1;
      for (const child of treeNode.children) {
        const childNode = await makeNode(child);
        if (childNode) (node as FrameNode).appendChild(childNode);
      }
      return node;
    } catch (error) {
      skipped += 1;
      warnings.push(`skipped ${change.name}: ${(error as Error).message}`);
      return null;
    }
  }

  // Wrap all roots in a single container frame named rootName.
  const container = figma.createFrame();
  container.name = rootName;
  for (const r of tree) {
    const n = await makeNode(r);
    if (n) container.appendChild(n);
  }

  return {
    root: container as BuildResult["root"],
    summary: {
      built,
      total: changes.length,
      skipped,
      missingFonts: [...missingFonts],
      warnings,
    },
  };
}

function applyGeometry(
  node: SceneNode,
  change: FigmaNodeChange,
  warnings: Array<string>
): void {
  const { x, y, warning } = decomposeTransform(change.transform);
  if (warning) warnings.push(`${change.name}: ${warning}`);
  if (change.size && "resize" in node) {
    (node as FrameNode).resize(change.size.x || 0.01, change.size.y || 0.01);
  }
  node.x = x;
  node.y = y;
  if (change.opacity !== undefined && "opacity" in node) {
    (node as FrameNode).opacity = change.opacity;
  }
}

function applyFrame(node: FrameNode, change: FigmaNodeChange): void {
  const frame = change as FigmaFrameNodeChange;
  const fills = mapPaints(frame.fillPaints);
  if (fills.length > 0) node.fills = fills;
  const strokes = mapPaints(frame.strokePaints);
  if (strokes.length > 0) node.strokes = strokes;
  if (frame.strokeWeight !== undefined) node.strokeWeight = frame.strokeWeight;
  const effects = mapEffects(frame.effects);
  if (effects.length > 0) node.effects = effects;
  if (frame.cornerRadius !== undefined) node.cornerRadius = frame.cornerRadius;
  applyAutoLayout(node, frame);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter plugin exec vitest run src/builder/build-nodes.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the whole builder suite**

Run: `pnpm --filter plugin exec vitest run`
Expected: PASS (all builder tests green).

- [ ] **Step 6: Commit**

```bash
git add apps/plugin/src/builder/build-nodes.ts apps/plugin/src/builder/build-nodes.test.ts
git commit -m "feat(plugin): orchestrate node tree build with per-node fault tolerance"
```

---

## Task 12: Wire `code.ts` to the builder

**Files:**
- Modify: `apps/plugin/src/code.ts`

The root parent localID is the reserved root frame's localID. Confirm the value by reading `packages/dom-to-figma/src/converter/nodes/root` (`ROOT_FRAME_GUID`); the converter starts user node IDs at `ROOT_RESERVED_GUIDS = 3`, and `ROOT_FRAME_GUID.localID` is the frame children attach to — pass that exact value.

- [ ] **Step 1: Read the reserved root GUID**

Run: `grep -rn "ROOT_FRAME_GUID" packages/dom-to-figma/src/converter/nodes/root`
Expected: a `localID` value (note it for the constant below).

- [ ] **Step 2: Replace `apps/plugin/src/code.ts`**

```ts
import { buildNodes } from "./builder/build-nodes";
import type { CodeToUi, UiToCode } from "./messages";

// Children of the user's root attach to the reserved root frame; its localID
// is defined by ROOT_FRAME_GUID in dom-to-figma (verified in Task 12 Step 1).
const ROOT_PARENT_LOCAL_ID = 1;

figma.showUI(__html__, { width: 420, height: 560 });

figma.ui.onmessage = async (msg: UiToCode) => {
  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }
  if (msg.type !== "import-nodes") return;

  try {
    const { root, summary } = await buildNodes(
      msg.nodeChanges,
      ROOT_PARENT_LOCAL_ID,
      msg.rootName
    );
    figma.currentPage.appendChild(root);
    figma.viewport.scrollAndZoomIntoView([root]);
    const done: CodeToUi = {
      type: "import-done",
      built: summary.built,
      total: summary.total,
      skipped: summary.skipped,
      missingFonts: summary.missingFonts,
      warnings: summary.warnings,
    };
    figma.ui.postMessage(done);
  } catch (error) {
    const err: CodeToUi = { type: "import-error", message: (error as Error).message };
    figma.ui.postMessage(err);
  }
};
```

- [ ] **Step 3: Set `ROOT_PARENT_LOCAL_ID` to the value found in Step 1, then type-check**

Run: `pnpm --filter plugin exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/plugin/src/code.ts
git commit -m "feat(plugin): handle import messages and place built frame on canvas"
```

---

## Task 13: Render host (`render-host.ts`)

**Files:**
- Create: `apps/plugin/src/ui/render-host.ts`

Renders HTML in a nested sandbox iframe so bundled pages' inline scripts run (the plugin's own CSP would block them otherwise), waits for load + a short DOM-stability window, then runs the existing converter and returns `nodeChanges`. The converter is used exactly as in the extension (`apps/extension/entrypoints/content/convert.ts`).

- [ ] **Step 1: Create `apps/plugin/src/ui/render-host.ts`**

```ts
import { createFigmaConverter } from "@figit/dom-to-figma";
import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";

const STABILIZE_MS = 400;
const LOAD_TIMEOUT_MS = 10000;

export type RenderResult = {
  nodeChanges: Array<FigmaNodeChange>;
  rootName: string;
};

export async function renderAndConvert(html: string, rootName: string): Promise<RenderResult> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1280px;height:2000px;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  try {
    await writeAndWait(iframe, html);
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not access rendered document");
    const body = doc.body;
    const width = Math.max(1, Math.round(doc.documentElement.scrollWidth));
    const height = Math.max(1, Math.round(doc.documentElement.scrollHeight));

    const converter = createFigmaConverter();
    const result = await converter.convert({ element: body, width, height, name: rootName });
    return { nodeChanges: result.document.nodeChanges, rootName };
  } finally {
    iframe.remove();
  }
}

function writeAndWait(iframe: HTMLIFrameElement, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Render timed out")), LOAD_TIMEOUT_MS);
    iframe.addEventListener(
      "load",
      () => {
        // Give bundled-page inline scripts time to unpack into the DOM.
        setTimeout(() => {
          clearTimeout(timer);
          resolve();
        }, STABILIZE_MS);
      },
      { once: true }
    );
    const doc = iframe.contentDocument;
    if (!doc) {
      clearTimeout(timer);
      reject(new Error("Could not open iframe document"));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter plugin exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/plugin/src/ui/render-host.ts
git commit -m "feat(plugin): render html in sandbox iframe and convert to node changes"
```

---

## Task 14: UI (drop-zone + textarea + status)

**Files:**
- Create: `apps/plugin/index.html`
- Create: `apps/plugin/src/ui/main.tsx`
- Create: `apps/plugin/src/ui/app.tsx`
- Create: `apps/plugin/src/ui/style.css`

- [ ] **Step 1: Create `apps/plugin/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `apps/plugin/src/ui/style.css`**

```css
:root { font-family: Inter, -apple-system, system-ui, sans-serif; font-size: 13px; }
body { margin: 0; padding: 12px; color: #1e1e1e; }
.drop { border: 1.5px dashed #c4c4c4; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; }
.drop.over { border-color: #0d99ff; background: #f0f8ff; }
textarea { width: 100%; height: 160px; box-sizing: border-box; margin-top: 8px; font-family: ui-monospace, monospace; font-size: 12px; }
button { margin-top: 8px; padding: 8px 14px; border: 0; border-radius: 6px; background: #0d99ff; color: #fff; font-weight: 600; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
.status { margin-top: 10px; white-space: pre-wrap; }
.status.error { color: #b91c1c; }
```

- [ ] **Step 3: Create `apps/plugin/src/ui/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Create `apps/plugin/src/ui/app.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { CodeToUi, UiToCode } from "../messages";
import { renderAndConvert } from "./render-host";

function post(msg: UiToCode) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

export function App() {
  const [html, setHtml] = useState("");
  const [name, setName] = useState("Imported");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage as CodeToUi | undefined;
      if (!msg) return;
      setBusy(false);
      if (msg.type === "import-error") {
        setIsError(true);
        setStatus(`Import failed: ${msg.message}`);
        return;
      }
      setIsError(false);
      const parts = [`Built ${msg.built} of ${msg.total} layers.`];
      if (msg.skipped) parts.push(`Skipped ${msg.skipped}.`);
      if (msg.missingFonts.length) parts.push(`Missing fonts: ${msg.missingFonts.join(", ")}.`);
      setStatus(parts.join(" "));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function runImport(source: string) {
    setBusy(true);
    setIsError(false);
    setStatus("Rendering and converting…");
    try {
      const { nodeChanges, rootName } = await renderAndConvert(source, name);
      post({ type: "import-nodes", nodeChanges, rootName });
    } catch (error) {
      setBusy(false);
      setIsError(true);
      setStatus(`Convert failed: ${(error as Error).message}`);
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    setHtml(text);
    setName(file.name.replace(/\.html?$/i, ""));
    await runImport(text);
  }

  return (
    <div>
      <div
        className={over ? "drop over" : "drop"}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void onFile(file);
        }}
      >
        Drop an .html file here, or click to choose
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <textarea
        placeholder="…or paste HTML markup"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
      />
      <button disabled={busy || !html.trim()} onClick={() => void runImport(html)}>
        {busy ? "Importing…" : "Import to Figma"}
      </button>
      {status && <div className={isError ? "status error" : "status"}>{status}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter plugin exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/plugin/index.html apps/plugin/src/ui
git commit -m "feat(plugin): plugin ui with drop-zone, paste, and status reporting"
```

---

## Task 15: Vite build (single-file `code.js` + `ui.html`)

**Files:**
- Create: `apps/plugin/vite.config.ts`
- Create: `apps/plugin/vitest.config.ts`

Figma needs each of `code.js` and `ui.html` as one self-contained file. Build runs twice: a "code" pass (IIFE, no imports) and a "ui" pass (`vite-plugin-singlefile` inlines all JS/CSS into `ui.html`). Mode switches via an env flag.

- [ ] **Step 1: Create `apps/plugin/vite.config.ts`**

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const target = process.env.PLUGIN_TARGET ?? "ui";

export default defineConfig(
  target === "code"
    ? {
        build: {
          outDir: "dist",
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, "src/code.ts"),
            formats: ["iife"],
            name: "code",
            fileName: () => "code.js",
          },
        },
      }
    : {
        plugins: [react(), viteSingleFile()],
        build: {
          outDir: "dist",
          emptyOutDir: false,
          rollupOptions: { input: resolve(__dirname, "index.html") },
        },
      }
);
```

- [ ] **Step 2: Update `apps/plugin/package.json` build script to run both passes**

Replace the `"build"` and `"dev"` scripts:

```json
"build": "PLUGIN_TARGET=code vite build && PLUGIN_TARGET=ui vite build",
"dev": "PLUGIN_TARGET=ui vite build --watch",
```

- [ ] **Step 3: Create `apps/plugin/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Build and verify both artifacts exist**

Run: `pnpm --filter plugin build`
Expected: completes; `ls apps/plugin/dist` shows `code.js` and `ui.html`.

- [ ] **Step 5: Verify `ui.html` is self-contained (no external script src)**

Run: `grep -c 'src="/' apps/plugin/dist/ui.html`
Expected: `0` (all assets inlined).

- [ ] **Step 6: Commit**

```bash
git add apps/plugin/vite.config.ts apps/plugin/vitest.config.ts apps/plugin/package.json
git commit -m "build(plugin): single-file code.js and ui.html via dual vite build"
```

---

## Task 16: Full workspace verification

**Files:** none (verification only)

- [ ] **Step 1: Types across the workspace**

Run: `pnpm check-types`
Expected: PASS (all projects, including `plugin`).

- [ ] **Step 2: All unit tests**

Run: `pnpm --filter plugin exec vitest run`
Expected: PASS — tree (1), transform (3), paint (3), effect (2), auto-layout (2), fonts (2), build-nodes (1).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors (warnings/infos acceptable, consistent with the rest of the repo).

- [ ] **Step 4: Manual E2E (documented, not automated)**

1. In Figma desktop: Plugins → Development → Import plugin from manifest → choose `apps/plugin/manifest.json`.
2. Run "Figit Import". Drop `apps/playground/src/corpus/integrations/landing.html`.
3. Confirm a "landing" frame appears with editable text and fills.
4. Repeat with the Send Test bundled file served over the dev static server.
5. Confirm the status reports built/total and any missing fonts.

- [ ] **Step 5: Commit any doc updates**

```bash
git add -A
git commit -m "chore(plugin): workspace verification pass" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Do not modify** `packages/dom-to-figma` or `packages/fig-kiwi` except for the conditional `./internal` re-export in Task 2a. The converter is consumed as-is.
- The Plugin API global `figma` is ambient (from `@figma/plugin-typings`); tests install `createFigmaMock()` onto `globalThis.figma` in `beforeEach`.
- `__html__` is a Figma-injected global containing the bundled UI; it is typed by `@figma/plugin-typings`.
- Stack/align enum strings from the converter already match Plugin API enum values — they pass through without translation. If a future converter change diverges, add a small lookup in `auto-layout.ts`.
