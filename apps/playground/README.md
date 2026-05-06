# playground

Interactive sandbox for `@sleekdesign/dom-to-figma`. Edit HTML on the left, see it rendered on the right, click "Copy to Figma", paste in Figma.

Used during development of `dom-to-figma` and as a lightweight smoke-testing harness.

## Run

The playground consumes the built output of `@sleekdesign/dom-to-figma`, so build the package first (or run it in watch mode in a second terminal).

```sh
# from repo root, one-time build of the package
pnpm --filter @sleekdesign/dom-to-figma build

# then start the playground
pnpm --filter playground dev
```

For active development on the package itself:

```sh
# terminal 1 — rebuild dom-to-figma on every change
pnpm --filter @sleekdesign/dom-to-figma dev

# terminal 2 — playground with HMR
pnpm --filter playground dev
```
