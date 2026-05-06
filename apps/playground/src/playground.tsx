import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";

import { TEMPLATES } from "./templates";
import { usePlayground } from "./use-playground";

const FIELD_CLASSES =
  "rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600";

export function Playground() {
  const {
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
  } = usePlayground();

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-zinc-800 border-b px-4 py-3">
        <h1 className="font-semibold text-sm tracking-tight">
          dom-to-figma playground
        </h1>
        <div className="flex-1" />
        <select
          aria-label="Template"
          className={FIELD_CLASSES}
          onChange={(event) => loadTemplate(event.target.value)}
        >
          {TEMPLATES.map((template) => (
            <option key={template.name} value={template.name}>
              {template.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-sm">
          <input
            aria-label="Width"
            className={`${FIELD_CLASSES} w-16 tabular-nums`}
            min={1}
            onChange={(event) => setWidth(event.target.valueAsNumber || 0)}
            type="number"
            value={width || ""}
          />
          <span className="text-zinc-500">×</span>
          <input
            aria-label="Height"
            className={`${FIELD_CLASSES} w-16 tabular-nums`}
            min={1}
            onChange={(event) => setHeight(event.target.valueAsNumber || 0)}
            type="number"
            value={height || ""}
          />
        </div>
        <input
          aria-label="Frame name"
          className={`${FIELD_CLASSES} w-32`}
          onChange={(event) => setFrameName(event.target.value)}
          placeholder="Frame name"
          value={frameName}
        />
        <button
          className="rounded bg-orange-500 px-3 py-1 font-medium text-sm text-zinc-950 hover:bg-orange-400 disabled:opacity-50"
          disabled={isCopying}
          onClick={copyToFigma}
          type="button"
        >
          {isCopying ? "Copying…" : "Copy to Figma"}
        </button>
      </header>

      {status && (
        <div className="border-zinc-800 border-b bg-zinc-900 px-4 py-2 text-xs text-zinc-300">
          {status}
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        <div className="overflow-auto border-zinc-800 border-r">
          <CodeMirror
            extensions={[html()]}
            height="100%"
            onChange={setCode}
            theme="dark"
            value={code}
          />
        </div>
        <iframe
          className="h-full w-full bg-white"
          ref={iframeRef}
          srcDoc={previewCode}
          title="Preview"
        />
      </div>
    </div>
  );
}
