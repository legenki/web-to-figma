// Internal types consumed by first-party tooling (e.g. the Figma import plugin)
// that maps the converter's in-memory document to the Figma Plugin API. Not part
// of the public DOM-to-clipboard API surface.
export type {
  FigmaEffect,
  FigmaFrameNodeChange,
  FigmaNodeChange,
  FigmaPaint,
  FigmaTextNodeChange,
  FigmaTransform,
} from "./converter/types";
