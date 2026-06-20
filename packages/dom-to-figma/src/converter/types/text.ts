export type FigmaTextAlignHorizontal =
  | "LEFT"
  | "CENTER"
  | "RIGHT"
  | "JUSTIFIED";

export type FigmaTextDecoration = "NONE" | "UNDERLINE" | "STRIKETHROUGH";

export type FigmaTextCase =
  | "ORIGINAL"
  | "UPPER"
  | "LOWER"
  | "TITLE"
  | "SMALL_CAPS"
  | "SMALL_CAPS_FORCED";

export type FigmaTextData = {
  characters: string;
  lines?: Array<unknown>;
  // One style id per character. Index into `styleOverrideTable` by matching
  // `styleID`; id 0 is the node's base style. Parallel to `characters`.
  characterStyleIDs?: Array<number>;
  // Partial NodeChanges, each keyed by `styleID`, overriding only the
  // properties that differ from the base style (fill, fontName, fontSize, …).
  styleOverrideTable?: Array<FigmaStyleOverride>;
};

// A style-override entry is a TEXT-shaped partial change carrying a styleID
// plus the overridden text properties.
export type FigmaStyleOverride = {
  styleID: number;
  fontName?: {
    family: string;
    style: string;
    postscript?: string;
  };
  fontSize?: number;
  fillPaints?: Array<unknown>;
  textDecoration?: FigmaTextDecoration;
  textCase?: FigmaTextCase;
  letterSpacing?: {
    value: number;
    units: string;
  };
};

export type FigmaDerivedTextData = {
  layoutSize?: {
    x: number;
    y: number;
  };
  layoutVersion?: number;
  derivedLines: Array<{
    directionality: "LTR" | "RTL";
  }>;
  fontMetaData?: Array<{
    key: {
      family: string;
      style: string;
      postscript: string;
    };
    fontDigest?: Array<number>;
    fontWeight: number;
    fontLineHeight: number;
    fontStyle: "NORMAL" | "ITALIC";
  }>;
  baselines?: Array<{
    position: { x: number; y: number };
    width: number;
    lineY: number;
    lineHeight: number;
    lineAscent: number;
    firstCharacter: number;
    endCharacter: number;
  }>;
  glyphs?: Array<{
    commandsBlob: number;
    position: { x: number; y: number };
    fontSize: number;
    firstCharacter: number;
    advance: number;
    rotation: number;
  }>;
  truncationStartIndex?: number;
  truncatedHeight?: number;
  logicalIndexToCharacterOffsetMap?: Array<number>;
};
