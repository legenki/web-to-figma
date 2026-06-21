import { inflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeFigmaData } from "./encoder";

const HEADER_BYTES = 8;
const VERSION_BYTES = 4;
const LENGTH_BYTES = 4;

// Inflate the data segment of a fig-kiwi envelope (magic + version +
// deflated schema + deflated data).
function inflatedData(figBytes: Uint8Array): Uint8Array {
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
              {
                styleID: 7,
                fontName: {
                  family: "ProbeFamily",
                  style: "Bold",
                  postscript: "",
                },
              },
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
