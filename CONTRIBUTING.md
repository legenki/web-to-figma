# Contributing

Thanks for your interest in contributing.

## Setup

```sh
git clone git@github.com:figitdesign/web-to-figma.git
cd figma
pnpm install
```

`pnpm install` registers the lefthook git hooks (lint on commit, commitlint on the message).

Use the Node version pinned in [`.nvmrc`](./.nvmrc) (current LTS).

## Development

```sh
# Run all package builds in watch mode
pnpm dev

# Lint + format
pnpm lint
pnpm format

# Typecheck across the workspace
pnpm check-types

# Run tests
pnpm test
```

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` lefthook runs commitlint to enforce the format.

Examples:

```
feat(dom-to-figma): support svg inline gradients
fix(dom-to-figma): align font cache path with resolver api
chore: bump biome to 2.5
docs: clarify image-loader contract
```

## Changesets

Every user-facing change ships with a changeset. Run:

```sh
pnpm changeset
```

…and pick the package(s) and bump type. Commit the generated `.changeset/*.md` along with your code.

When the change merges to `main`, the `Release` workflow opens (or updates) a "Version Packages" PR. Merging that PR publishes to npm and creates a GitHub release.

## Pull requests

- One logical change per PR.
- Include a changeset.
- Make sure CI is green: lint, typecheck, build, test.

## Reporting bugs

Open an issue with a minimal reproduction and the relevant browser. The package targets modern browsers (Chrome / Edge / Firefox / Safari current).
