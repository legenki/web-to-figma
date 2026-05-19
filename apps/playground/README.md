# playground

Interactive sandbox for `@figit/dom-to-figma`. Browse a corpus of unit and integration scenes, edit the HTML, watch the iframe preview update, inspect the Figma payload tree, and copy to Figma in one click.

## Stack

- [TanStack Start](https://tanstack.com/start) in SPA mode (Vite, React 19)
- [TanStack Router](https://tanstack.com/router) for file-based routes
- [Tailwind CSS v4](https://tailwindcss.com)
- CodeMirror 6 for the HTML editor

## Run

```sh
# from repo root
pnpm --filter playground dev
```

The playground consumes `@figit/dom-to-figma` from source via the workspace, so no separate build step is needed.

## Layout

```
src/
├── routes/
│   ├── __root.tsx          # html shell, global header
│   ├── index.tsx           # scene gallery (grouped by category)
│   └── scenes.$.tsx        # one scene: editor + preview + inspector
├── corpus/                 # *.html scenes, one file per concern
│   ├── typography/
│   ├── color/
│   ├── layout/
│   ├── positioning/
│   ├── borders/
│   ├── effects/
│   ├── svg/
│   ├── forms/
│   └── integrations/
├── components/
│   ├── playground-shell.tsx  # editor + iframe + copy + status
│   └── payload-inspector.tsx # tree view of nodeChanges
└── lib/converter.ts          # singleton FigmaConverter (caches fonts/images)
```

## Adding a scene

Drop a new `.html` file under the right category directory. The filename (kebab-case) becomes the slug; the title is derived from the filename. No registry edits needed.
