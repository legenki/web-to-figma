import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";
import { beforeEach, describe, expect, it } from "vitest";
import { buildNodes } from "./build-nodes";
import { createFigmaMock } from "./figma-mock";

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
      {
        ...base(3, 0, "FRAME"),
        fillPaints: [
          {
            type: "SOLID",
            color: { r: 1, g: 1, b: 1, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: "NORMAL",
          },
        ],
      } as FigmaNodeChange,
      {
        ...base(4, 3, "TEXT"),
        characters: "Hi",
        fontName: { family: "Inter", style: "Regular" },
      } as FigmaNodeChange,
    ];
    const result = await buildNodes(changes, 0, "My Import");
    expect(result.summary.built).toBe(2);
    expect(result.summary.skipped).toBe(0);
    expect(result.root.type).toBe("FRAME");
    expect(result.root.children).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length asserted on the line above
    expect(result.root.children[0]!.type).toBe("TEXT");
    expect(
      (result.root.children[0] as { characters?: string }).characters
    ).toBe("Hi");
    // position from transform
    expect(result.root.x).toBe(5);
    expect(result.root.y).toBe(6);
  });
});
