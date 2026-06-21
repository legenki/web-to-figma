import { beforeEach, describe, expect, it } from "vitest";
import { createFigmaMock } from "./figma-mock";
import { loadFontWithFallback } from "./fonts";

describe("loadFontWithFallback", () => {
  beforeEach(() => {
    (globalThis as { figma?: unknown }).figma = createFigmaMock();
  });

  it("loads the requested font when available", async () => {
    const missing = new Set<string>();
    const font = await loadFontWithFallback(
      { family: "Inter", style: "Bold" },
      missing
    );
    expect(font).toEqual({ family: "Inter", style: "Bold" });
    expect(missing.size).toBe(0);
  });

  it("falls back to Inter Regular and records the missing family", async () => {
    const missing = new Set<string>();
    const font = await loadFontWithFallback(
      { family: "IBM Plex Sans", style: "Regular" },
      missing
    );
    expect(font).toEqual({ family: "Inter", style: "Regular" });
    expect([...missing]).toContain("IBM Plex Sans");
  });
});
