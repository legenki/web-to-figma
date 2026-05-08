export class KiwiWriter {
  chunks: Array<Uint8Array>;
  currentSize: number;

  constructor() {
    this.chunks = [];
    this.currentSize = 0;
  }

  getBytes() {
    // Concatenate all chunks into a single Uint8Array
    const result = new Uint8Array(this.currentSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  byte(value: number) {
    if (value < 0 || value > 255) {
      throw new Error(`Byte value must be 0-255, got ${value}`);
    }
    const arr = new Uint8Array([value]);
    this.chunks.push(arr);
    this.currentSize += 1;
  }

  bool(value: boolean) {
    this.byte(value ? 1 : 0);
  }

  uint(value: number) {
    if (value < 0) {
      throw new Error(`Unsigned int cannot be negative: ${value}`);
    }

    let current = value;
    while (current >= 128) {
      this.byte((current & 127) | 128);
      current = Math.floor(current / 128);
    }
    this.byte(current & 127);
  }

  uint64(value: number) {
    // JavaScript doesn't have native 64-bit integers, but we can handle them
    // as long as they're within JavaScript's safe integer range
    if (value < 0) {
      throw new Error(`Unsigned int64 cannot be negative: ${value}`);
    }

    let current = value;
    while (current >= 128) {
      this.byte((current & 127) | 128);
      current = Math.floor(current / 128);
    }
    this.byte(current & 127);
  }

  bytes(data: Uint8Array | ArrayBuffer | Array<number>) {
    if (data instanceof Uint8Array) {
      this.chunks.push(data);
      this.currentSize += data.length;
    } else if (data instanceof ArrayBuffer) {
      const arr = new Uint8Array(data);
      this.chunks.push(arr);
      this.currentSize += arr.length;
    } else if (Array.isArray(data)) {
      const arr = new Uint8Array(data);
      this.chunks.push(arr);
      this.currentSize += arr.length;
    } else {
      throw new Error("bytes() requires Uint8Array, ArrayBuffer, or Array");
    }
  }

  int(value: number) {
    // Zigzag encoding for signed integers
    let encoded: number;
    if (value >= 0) {
      encoded = value * 2;
    } else {
      encoded = (-value - 1) * 2 + 1;
    }
    this.uint(encoded);
  }

  int64(value: number) {
    // Zigzag encoding for signed 64-bit integers
    let encoded: number;
    if (value >= 0) {
      encoded = value * 2;
    } else {
      encoded = (~value * 2) | 1;
    }
    this.uint64(encoded);
  }

  float(value: number) {
    if (value === 0.0) {
      this.byte(0);
      return;
    }

    // Convert float to 32-bit representation
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, false); // big-endian
    let bits = view.getUint32(0, false);

    // Apply bit manipulation (reverse of decoder)
    bits = (bits >>> 23) | (bits << 9);
    bits >>>= 0; // Ensure unsigned 32-bit

    // Write 4 bytes
    this.byte(bits & 0xff);
    this.byte((bits >>> 8) & 0xff);
    this.byte((bits >>> 16) & 0xff);
    this.byte((bits >>> 24) & 0xff);
  }

  string(value: string) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);
    this.bytes(encoded);
    this.byte(0); // Null terminator
  }
}
