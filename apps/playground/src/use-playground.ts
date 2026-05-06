import { createFigmaConverter } from "@sleekdesign/dom-to-figma";
import { useDeferredValue, useRef, useState } from "react";

import { TEMPLATES } from "./templates";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const DEFAULT_FRAME_NAME = "Playground";

export function usePlayground() {
  // One converter instance for the lifetime of the playground so that
  // dom-to-figma's internal font/image caches are reused across copies.
  const [figma] = useState(createFigmaConverter);

  const [code, setCode] = useState<string>(TEMPLATES[0].html);
  const previewCode = useDeferredValue(code);

  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [frameName, setFrameName] = useState<string>(DEFAULT_FRAME_NAME);

  const [status, setStatus] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const copyToFigma = async () => {
    const body = iframeRef.current?.contentDocument?.body;
    if (!body) {
      setStatus("Preview not ready");
      return;
    }

    setIsCopying(true);
    setStatus(null);

    try {
      const result = await figma.convert({
        element: body,
        width: width || DEFAULT_WIDTH,
        height: height || DEFAULT_HEIGHT,
        name: frameName,
      });
      await navigator.clipboard.write([result.toClipboardItem()]);
      setStatus("Copied. Paste in Figma with Cmd+V.");
    } catch (error) {
      console.error("Convert failed:", error);
      setStatus(error instanceof Error ? error.message : "Failed to copy");
    } finally {
      setIsCopying(false);
    }
  };

  const loadTemplate = (templateName: string) => {
    const template = TEMPLATES.find((entry) => entry.name === templateName);
    if (template) {
      setCode(template.html);
    }
  };

  return {
    code,
    setCode,
    previewCode,
    width,
    setWidth,
    height,
    setHeight,
    frameName,
    setFrameName,
    status,
    isCopying,
    iframeRef,
    copyToFigma,
    loadTemplate,
  };
}
