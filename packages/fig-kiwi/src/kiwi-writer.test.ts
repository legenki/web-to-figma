import { describe, expect, it } from "vitest";
import { KiwiWriter } from "./kiwi-writer";

describe("KiwiWriter", () => {
  describe("byte", () => {
    it("writes single bytes in order", () => {
      const w = new KiwiWriter();
      w.byte(1);
      w.byte(2);
      w.byte(255);
      expect(Array.from(w.getBytes())).toEqual([1, 2, 255]);
    });

    it("rejects values outside 0-255", () => {
      const w = new KiwiWriter();
      expect(() => w.byte(-1)).toThrow();
      expect(() => w.byte(256)).toThrow();
    });
  });

  describe("bool", () => {
    it("encodes true as 1 and false as 0", () => {
      const w = new KiwiWriter();
      w.bool(true);
      w.bool(false);
      expect(Array.from(w.getBytes())).toEqual([1, 0]);
    });
  });

  describe("uint (varint)", () => {
    it("encodes small values in one byte", () => {
      const w = new KiwiWriter();
      w.uint(0);
      w.uint(1);
      w.uint(127);
      expect(Array.from(w.getBytes())).toEqual([0, 1, 127]);
    });

    it("encodes 128 as two bytes (continuation set)", () => {
      const w = new KiwiWriter();
      w.uint(128);
      expect(Array.from(w.getBytes())).toEqual([0x80, 0x01]);
    });

    it("rejects negative values", () => {
      expect(() => new KiwiWriter().uint(-1)).toThrow();
    });
  });

  describe("int (zigzag)", () => {
    it("encodes 0 as 0", () => {
      const w = new KiwiWriter();
      w.int(0);
      expect(Array.from(w.getBytes())).toEqual([0]);
    });

    it("encodes positive n as 2n", () => {
      const w = new KiwiWriter();
      w.int(1);
      w.int(63);
      expect(Array.from(w.getBytes())).toEqual([2, 126]);
    });

    it("encodes negative -n as 2n - 1", () => {
      const w = new KiwiWriter();
      w.int(-1);
      w.int(-2);
      expect(Array.from(w.getBytes())).toEqual([1, 3]);
    });
  });

  describe("string", () => {
    it("encodes ascii with a null terminator", () => {
      const w = new KiwiWriter();
      w.string("ab");
      expect(Array.from(w.getBytes())).toEqual([0x61, 0x62, 0]);
    });

    it("encodes empty string as just the null terminator", () => {
      const w = new KiwiWriter();
      w.string("");
      expect(Array.from(w.getBytes())).toEqual([0]);
    });

    it("encodes unicode as utf-8", () => {
      const w = new KiwiWriter();
      w.string("é");
      expect(Array.from(w.getBytes())).toEqual([0xc3, 0xa9, 0]);
    });
  });

  describe("bytes", () => {
    it("accepts Uint8Array", () => {
      const w = new KiwiWriter();
      w.bytes(new Uint8Array([1, 2, 3]));
      expect(Array.from(w.getBytes())).toEqual([1, 2, 3]);
    });

    it("accepts ArrayBuffer", () => {
      const w = new KiwiWriter();
      const buf = new ArrayBuffer(2);
      new Uint8Array(buf).set([7, 8]);
      w.bytes(buf);
      expect(Array.from(w.getBytes())).toEqual([7, 8]);
    });

    it("accepts plain Array", () => {
      const w = new KiwiWriter();
      w.bytes([10, 11]);
      expect(Array.from(w.getBytes())).toEqual([10, 11]);
    });

    it("rejects unknown shapes", () => {
      const w = new KiwiWriter();
      // @ts-expect-error -- testing runtime guard
      expect(() => w.bytes("hello")).toThrow();
    });
  });

  describe("float", () => {
    it("encodes 0 as a single zero byte (special case)", () => {
      const w = new KiwiWriter();
      w.float(0);
      expect(Array.from(w.getBytes())).toEqual([0]);
    });
  });

  describe("getBytes", () => {
    it("concatenates mixed writes in order", () => {
      const w = new KiwiWriter();
      w.byte(0xff);
      w.uint(128); // two bytes: 0x80 0x01
      w.string("a"); // 0x61 0x00
      expect(Array.from(w.getBytes())).toEqual([0xff, 0x80, 0x01, 0x61, 0]);
    });
  });
});
