import { beforeAll, describe, expect, it } from "vitest";
import {
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "./__fixtures__/loaders";
import { defaultClassify } from "./converter/classify";

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

const mount = (html: string): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper.firstElementChild as HTMLElement;
};

describe("defaultClassify — inline paragraphs", () => {
  it("classifies a block of inline runs as text-paragraph", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}'">a <span>b</span> c</h1>`
    );
    expect(defaultClassify(block)).toBe("text-paragraph");
    document.body.innerHTML = "";
  });

  it("keeps a solo text block as plain text", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">just text</p>`
    );
    expect(defaultClassify(block)).toBe("text");
    document.body.innerHTML = "";
  });

  it("leaves a block with a block-level child as a frame", () => {
    const block = mount("<div>text <div>nested block</div></div>");
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });

  it("leaves an inline-run block with its own background as a frame", () => {
    const block = mount(
      `<h1 style="font-family:'${TEST_FONT_FAMILY}';background:rgb(255,0,0)">a <span>b</span></h1>`
    );
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });

  it("leaves a block with a link child as a frame (href must not be lost)", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">see <a href="/x">the docs</a> now</p>`
    );
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });

  it("leaves a block whose inline child has its own painted box as a frame", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}'">press <span style="background:rgb(240,240,240);padding:2px 4px">Enter</span></p>`
    );
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });

  it("leaves a white-space:pre block as a frame (whitespace must be preserved)", () => {
    const block = mount(
      `<p style="font-family:'${TEST_FONT_FAMILY}';white-space:pre">a   <span>b</span></p>`
    );
    expect(defaultClassify(block)).toBe("frame");
    document.body.innerHTML = "";
  });
});
