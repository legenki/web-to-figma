import { beforeAll, describe, expect, it } from "vitest";
import {
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "../../../../__fixtures__/loaders";
import { assembleParagraph } from "./assembler";
import { buildStyleRuns } from "./style-runs";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("buildStyleRuns", () => {
  it("emits per-character ids and overrides only for differing runs", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}';font-weight:400;color:rgb(0,0,0)">Hi <span style="font-weight:700;color:rgb(255,0,0)">bold</span></h1>`
    );
    const para = assembleParagraph(block);
    const runs = buildStyleRuns(block, para);

    expect(runs.characterStyleIDs).toHaveLength(para.characters.length);
    // Leading "Hi" characters are the base style (id 0).
    expect(runs.characterStyleIDs[0]).toBe(0);
    expect(runs.characterStyleIDs[1]).toBe(0);
    // The bold run has a non-zero id.
    const boldId = runs.characterStyleIDs.at(-1);
    expect(boldId).toBeGreaterThan(0);

    // Exactly one override entry, carrying the bold weight and a fill.
    expect(runs.styleOverrideTable).toHaveLength(1);
    const override = runs.styleOverrideTable[0];
    expect(override?.styleID).toBe(boldId);
    expect(override?.fontName?.style).toBe("Bold");
    expect(override?.fillPaints?.length ?? 0).toBeGreaterThan(0);
    document.body.innerHTML = "";
  });

  it("returns no overrides when every run shares the base style", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">plain <span>more</span> text</p>`
    );
    const para = assembleParagraph(block);
    const runs = buildStyleRuns(block, para);
    expect(runs.styleOverrideTable).toHaveLength(0);
    expect(new Set(runs.characterStyleIDs)).toEqual(new Set([0]));
    document.body.innerHTML = "";
  });

  it("resolves the override style name via the shared font-weight table", () => {
    // weight 800 must resolve to "ExtraBold", not the coarse "Bold" — the
    // style name comes from the same buildFontStyleName the font loader uses.
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}';font-weight:400">a <span style="font-weight:800">heavy</span></p>`
    );
    const para = assembleParagraph(block);
    const runs = buildStyleRuns(block, para);
    expect(runs.styleOverrideTable).toHaveLength(1);
    expect(runs.styleOverrideTable[0]?.fontName?.style).toBe("ExtraBold");
    document.body.innerHTML = "";
  });
});
