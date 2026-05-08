/**
 * HTML envelope Figma reads when you paste from the system clipboard.
 *
 * The wire format is two HTML comments embedded in `data-*` attributes:
 *
 *   <!--(figmeta)<base64-json>(/figmeta)-->
 *   <!--(figma)<base64-bytes>(/figma)-->
 *
 * Figma scans pasted HTML for these markers and decodes the inner payloads.
 */

export type FigmaClipboardMeta = {
  dataType: "scene";
  fileKey: string;
  pasteId: number;
};

const DEFAULT_META: FigmaClipboardMeta = {
  dataType: "scene",
  fileKey: "TEST",
  pasteId: 123,
};

/** Build the HTML clipboard envelope. No DOM required. */
export function composeClipboardHtml(
  base64: string,
  meta: FigmaClipboardMeta = DEFAULT_META
): string {
  const metaB64 = btoa(JSON.stringify(meta));
  const metadata = `<!--(figmeta)${metaB64}(/figmeta)-->`;
  const buffer = `<!--(figma)${base64}(/figma)-->`;

  return (
    '<meta charset="utf-8"><html><head><meta charset="utf-8"></head><body>' +
    `<span data-metadata="${metadata}"></span>` +
    `<span data-buffer="${buffer}"></span>` +
    '<span style="white-space: pre-wrap"></span>' +
    "</body></html>"
  );
}

/** Wrap envelope HTML in a `ClipboardItem` for `navigator.clipboard.write`. */
export function toClipboardItem(html: string): ClipboardItem {
  const blob = new Blob([html], { type: "text/html" });
  return new ClipboardItem({ "text/html": blob });
}
