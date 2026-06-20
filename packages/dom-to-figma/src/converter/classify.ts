import { TRANSPARENT_COLOR_VALUES } from "./styles/color";

export type ElementKind =
  | "skip"
  | "group"
  | "frame"
  | "vector"
  | "image"
  | "text"
  | "text-paragraph"
  | "form-with-placeholder";

export function defaultClassify(element: Element): ElementKind {
  if (isNonVisualElement(element)) {
    return "skip";
  }
  if (isHiddenElement(element)) {
    return "skip";
  }
  if (isGroupElement(element)) {
    return "group";
  }
  if (isSvgShapeElement(element)) {
    return "vector";
  }
  if (isImageElement(element)) {
    return "image";
  }
  if (isPlainTextElement(element)) {
    return "text";
  }
  if (isInlineParagraph(element)) {
    return "text-paragraph";
  }
  if (isFormElementWithPlaceholder(element) && hasPlaceholderText(element)) {
    return "form-with-placeholder";
  }
  return "frame";
}

function isNonVisualElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "script" ||
    tagName === "style" ||
    tagName === "head" ||
    tagName === "meta" ||
    tagName === "title" ||
    tagName === "link" ||
    tagName === "noscript" ||
    tagName === "template" ||
    tagName === "comment" ||
    tagName === "defs" ||
    tagName === "desc" ||
    tagName === "clipPath"
  );
}

function isHiddenElement(element: Element): boolean {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return true;
  }

  const clip = computedStyle.clip;
  if (clip === "rect(0px, 0px, 0px, 0px)" || clip === "rect(0, 0, 0, 0)") {
    return true;
  }

  return false;
}

function isGroupElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "g";
}

function isSvgShapeElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "path" ||
    tagName === "circle" ||
    tagName === "rect" ||
    tagName === "ellipse" ||
    tagName === "line" ||
    tagName === "polyline" ||
    tagName === "polygon"
  );
}

function isImageElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "img";
}

/**
 * A plain text element is a leaf with text content and no painted box of its
 * own (no padding, border, or background). The whole element is treated as
 * text rather than a frame containing text.
 */
function isPlainTextElement(element: Element): boolean {
  const computedStyle = window.getComputedStyle(element);
  const hasText = !!(element.textContent || "").trim().length;
  const isTransparent = TRANSPARENT_COLOR_VALUES.includes(
    computedStyle.backgroundColor
  );
  const hasNoPadding = computedStyle.padding === "0px";
  const hasNoBorder = computedStyle.borderWidth === "0px";

  return (
    hasText &&
    element.children.length === 0 &&
    isTransparent &&
    hasNoPadding &&
    hasNoBorder
  );
}

/**
 * A block whose rendered children are all inline runs (sibling text nodes and
 * inline leaf elements) and which has no painted box of its own. Such a block
 * is one paragraph and must convert to a single TEXT node so its runs share
 * one layout pass — see the multi-segment text plan. Anything with a painted
 * box, or a block-level / image / svg / form / nested-structure child, is not
 * a flat paragraph and falls through to `frame` (preserving today's behavior).
 */
function isInlineParagraph(element: Element): boolean {
  if (!(element.textContent || "").trim().length) {
    return false;
  }
  const childElements = Array.from(element.children);
  if (childElements.length === 0) {
    return false; // solo text → handled by `isPlainTextElement` above
  }

  // The block must have no painted box of its own; otherwise collapsing it to
  // a TEXT node would drop its background/border/padding. Same gates as
  // isPlainTextElement.
  const computedStyle = window.getComputedStyle(element);
  const isTransparent = TRANSPARENT_COLOR_VALUES.includes(
    computedStyle.backgroundColor
  );
  if (
    !isTransparent ||
    computedStyle.padding !== "0px" ||
    computedStyle.borderWidth !== "0px"
  ) {
    return false;
  }

  for (const child of childElements) {
    const tag = child.tagName.toLowerCase();
    if (
      tag === "img" ||
      tag === "svg" ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "br"
    ) {
      return false;
    }
    if (child.children.length > 0) {
      return false; // nested structure — not a flat inline run
    }
    const display = window.getComputedStyle(child).display;
    if (display !== "inline" && display !== "inline-block") {
      return false;
    }
  }
  return true;
}

const FORM_PLACEHOLDER_EXCLUDED_TYPES = [
  "checkbox",
  "radio",
  "submit",
  "button",
  "file",
  "hidden",
];

function isFormElementWithPlaceholder(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const inputType = (element as HTMLInputElement).type?.toLowerCase() || "";

  return (
    (tagName === "input" &&
      !FORM_PLACEHOLDER_EXCLUDED_TYPES.includes(inputType)) ||
    tagName === "textarea"
  );
}

function hasPlaceholderText(element: Element): boolean {
  const placeholder = element.getAttribute("placeholder");
  return !!(placeholder && placeholder.trim().length > 0);
}
