import { beforeAll, describe, expect, it } from "vitest";
import {
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "../../../../__fixtures__/loaders";
import { assembleParagraph } from "./assembler";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("assembleParagraph", () => {
  it("flattens inline runs into one string with per-run style spans", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}'">Move from <span style="font-weight:700">A to B</span> now.</h1>`
    );

    const result = assembleParagraph(block);

    expect(result.characters).toBe("Move from A to B now.");
    expect(result.spans).toHaveLength(3);
    // Spans are contiguous and cover the whole string.
    expect(result.spans[0]?.start).toBe(0);
    expect(result.spans.at(-1)?.end).toBe(result.characters.length);
    for (let i = 1; i < result.spans.length; i += 1) {
      expect(result.spans[i]?.start).toBe(result.spans[i - 1]?.end);
    }
    // The middle span is the bold span element.
    const boldSpan = result.spans[1];
    if (!boldSpan) {
      throw new Error("expected a middle span");
    }
    expect(boldSpan.element.tagName.toLowerCase()).toBe("span");
    // The bold span covers " A to B" (the inter-run space is emitted at the
    // start of the span's text processing, so it lands inside the span range).
    expect(result.characters.slice(boldSpan.start, boldSpan.end)).toBe(
      " A to B"
    );
    document.body.innerHTML = "";
  });

  it("collapses inter-run and intra-run whitespace to single spaces", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">  a   <span>b</span>\n  c  </p>`
    );
    const result = assembleParagraph(block);
    expect(result.characters).toBe("a b c");
    document.body.innerHTML = "";
  });
});
