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
  const availableFonts = new Set<string>([
    "Inter::Regular",
    "Inter::Medium",
    "Inter::Bold",
  ]);
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
    viewport: {
      scrollAndZoomIntoView: (_: Array<MockNode>) => {
        // no-op: nothing to scroll in tests
      },
    },
    __loadedFonts: loadedFonts,
    __availableFonts: availableFonts,
  };
}
