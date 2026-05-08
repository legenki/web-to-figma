import { inflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeFigmaData } from "./encoder";

const HEADER_BYTES = 8;
const VERSION_BYTES = 4;
const LENGTH_BYTES = 4;

describe("encodeFigmaData", () => {
  it("starts with the fig-kiwi magic header", () => {
    const { figBytes } = encodeFigmaData({});
    const header = new TextDecoder().decode(figBytes.slice(0, HEADER_BYTES));
    expect(header).toBe("fig-kiwi");
  });

  it("base64 decodes to the same byte length as figBytes", () => {
    const result = encodeFigmaData({});
    expect(atob(result.base64)).toHaveLength(result.figBytes.length);
  });

  it("data segment is a valid deflateRaw stream", () => {
    const { figBytes } = encodeFigmaData({});
    const view = new DataView(
      figBytes.buffer,
      figBytes.byteOffset,
      figBytes.byteLength
    );

    let offset = HEADER_BYTES + VERSION_BYTES;
    const schemaLength = view.getUint32(offset, true);
    offset += LENGTH_BYTES + schemaLength;

    const dataLength = view.getUint32(offset, true);
    offset += LENGTH_BYTES;

    const dataSegment = figBytes.slice(offset, offset + dataLength);
    expect(() => inflateSync(dataSegment)).not.toThrow();
  });

  it("throws when given a non-object root", () => {
    expect(() => encodeFigmaData(null)).toThrow();
    expect(() => encodeFigmaData("invalid")).toThrow();
  });
});
