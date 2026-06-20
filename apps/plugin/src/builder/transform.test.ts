import { describe, expect, it } from "vitest";
import { decomposeTransform } from "./transform";

describe("decomposeTransform", () => {
  it("extracts translation from a pure-translate matrix", () => {
    const r = decomposeTransform({
      m00: 1,
      m01: 0,
      m02: 12,
      m10: 0,
      m11: 1,
      m12: 34,
    });
    expect(r.x).toBe(12);
    expect(r.y).toBe(34);
    expect(r.rotation).toBeCloseTo(0);
    expect(r.warning).toBeUndefined();
  });

  it("warns on shear", () => {
    const r = decomposeTransform({
      m00: 1,
      m01: 0.5,
      m02: 0,
      m10: 0,
      m11: 1,
      m12: 0,
    });
    expect(r.warning).toMatch(/shear/i);
  });

  it("returns identity translation when transform is undefined", () => {
    const r = decomposeTransform(undefined);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});
