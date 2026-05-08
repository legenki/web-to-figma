import { deflateSync } from "fflate";
import { KiwiWriter } from "./kiwi-writer";
import { SCHEMA } from "./schema";
import type { TypeDef } from "./types";

// Kiwi datatype sentinels (negative = primitive, non-negative = type index).
const PRIM = {
  BOOL: -1,
  BYTE: -2,
  INT: -3,
  UINT: -4,
  FLOAT: -5,
  STRING: -6,
  INT64: -7,
  UINT64: -8,
} as const;

// `TypeDef.kind` values.
const ENUM = 0;
const STRUCT = 1;
const MESSAGE = 2;

const MAGIC = new TextEncoder().encode("fig-kiwi");
const ROOT_TYPE_NAME = "Message";

function encodePrimitive(w: KiwiWriter, datatype: number, value: unknown) {
  switch (datatype) {
    case PRIM.BOOL:
      return w.bool(value as boolean);
    case PRIM.BYTE:
      return w.byte(value as number);
    case PRIM.INT:
      return w.int(value as number);
    case PRIM.UINT:
      return w.uint(value as number);
    case PRIM.FLOAT:
      return w.float(value as number);
    case PRIM.STRING:
      return w.string(value as string);
    case PRIM.INT64:
      return w.int64(value as number);
    case PRIM.UINT64:
      return w.uint64(value as number);
    default:
      throw new Error(`Unknown primitive datatype: ${datatype}`);
  }
}

function asByteArray(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value as Array<number>);
  }
  throw new Error(
    `Byte array expected Uint8Array, ArrayBuffer, or Array, got ${typeof value}`
  );
}

function encodeArray(
  w: KiwiWriter,
  types: ReadonlyArray<TypeDef>,
  datatype: number,
  value: unknown
) {
  // Byte arrays use a length-prefixed raw write instead of per-element encoding.
  if (datatype === PRIM.BYTE) {
    const bytes = asByteArray(value);
    w.uint(bytes.length);
    w.bytes(bytes);
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Array expected, got ${typeof value}`);
  }
  w.uint(value.length);
  for (const item of value) {
    encodeType(w, types, datatype, item, false);
  }
}

function encodeEnum(w: KiwiWriter, type: TypeDef, value: unknown) {
  for (const [fieldId, field] of Object.entries(type.fields)) {
    if (field.name === value) {
      w.uint(Number.parseInt(fieldId, 10));
      return;
    }
  }
  throw new Error(
    `Unknown enum value '${String(value)}' for type '${type.name}'`
  );
}

function encodeStruct(
  w: KiwiWriter,
  types: ReadonlyArray<TypeDef>,
  type: TypeDef,
  value: unknown
) {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Struct expected object, got ${typeof value}`);
  }
  const obj = value as Record<string, unknown>;
  // Structs serialize every field in id order, no terminator. Explicit
  // `undefined` is treated as missing.
  const fieldCount = Object.keys(type.fields).length;
  for (let id = 1; id <= fieldCount; id += 1) {
    const field = type.fields[id];
    if (!field) {
      throw new Error(`Field ${id} missing in struct '${type.name}'`);
    }
    const v = obj[field.name];
    if (v === undefined) {
      throw new Error(
        `Missing required field '${field.name}' in struct '${type.name}'`
      );
    }
    encodeType(w, types, field.datatype, v, field.array);
  }
}

function encodeMessage(
  w: KiwiWriter,
  types: ReadonlyArray<TypeDef>,
  type: TypeDef,
  value: unknown
) {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Message expected object, got ${typeof value}`);
  }
  const obj = value as Record<string, unknown>;
  // Messages emit only present fields (each preceded by its id), terminated by 0.
  for (const [fieldId, field] of Object.entries(type.fields)) {
    if (field.name in obj) {
      w.uint(Number.parseInt(fieldId, 10));
      encodeType(w, types, field.datatype, obj[field.name], field.array);
    }
  }
  w.uint(0);
}

function encodeType(
  w: KiwiWriter,
  types: ReadonlyArray<TypeDef>,
  datatype: number,
  value: unknown,
  isArray: boolean
) {
  if (isArray) {
    return encodeArray(w, types, datatype, value);
  }
  if (datatype < 0) {
    return encodePrimitive(w, datatype, value);
  }

  const type = types[datatype];
  if (!type) {
    throw new Error(`Type definition not found for datatype ${datatype}`);
  }
  switch (type.kind) {
    case ENUM:
      return encodeEnum(w, type, value);
    case STRUCT:
      return encodeStruct(w, types, type, value);
    case MESSAGE:
      return encodeMessage(w, types, type, value);
    default:
      throw new Error(`Unknown kind ${type.kind} for type '${type.name}'`);
  }
}

function writeSchema(w: KiwiWriter, types: ReadonlyArray<TypeDef>) {
  w.uint(types.length);
  for (const type of types) {
    w.string(type.name);
    w.byte(type.kind);
    w.uint(Object.keys(type.fields).length);
    for (const [fieldId, field] of Object.entries(type.fields)) {
      w.string(field.name);
      w.int(field.datatype);
      w.bool(field.array);
      w.uint(Number.parseInt(fieldId, 10));
    }
  }
}

function uint32LE(value: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, value, true);
  return new Uint8Array(buf);
}

function concatBytes(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// `String.fromCharCode(...arr)` blows the call stack on large inputs, so
// chunk through it before handing the binary string to `btoa`.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x80_00;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Encode a Kiwi `Message` into the fig-kiwi binary envelope (magic + version
 * + deflated schema + deflated data) plus its base64 form.
 */
export function encodeFigmaData(message: unknown) {
  const { types, version } = SCHEMA;
  const rootIndex = types.findIndex((t) => t.name === ROOT_TYPE_NAME);
  if (rootIndex === -1) {
    throw new Error(`No root '${ROOT_TYPE_NAME}' type found in schema`);
  }

  const schemaWriter = new KiwiWriter();
  writeSchema(schemaWriter, types);
  const compressedSchema = deflateSync(schemaWriter.getBytes(), { level: 6 });

  const dataWriter = new KiwiWriter();
  encodeType(dataWriter, types, rootIndex, message, false);
  const compressedData = deflateSync(dataWriter.getBytes(), { level: 6 });

  const figBytes = concatBytes([
    MAGIC,
    uint32LE(version),
    uint32LE(compressedSchema.length),
    compressedSchema,
    uint32LE(compressedData.length),
    compressedData,
  ]);

  return {
    figBytes,
    base64: bytesToBase64(figBytes),
    size: figBytes.length,
  };
}
