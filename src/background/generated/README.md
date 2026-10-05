# Generated background assets

`blocked-hostnames.json` is a compact `string[]` of hostnames from plain hostname
block rules (`||example.com^`).

**Bundle:** `background/index.ts` imports `@blocked-hostnames`. esbuild aliases that
to this file when `EXTENSION_TARGET=firefox`, or to `blocked-hostnames-empty.json`
otherwise. This whole directory is build-time only — `copy-src` does not ship it.

Regenerate with:

```bash
npx tsx tools/filter-list-processor.ts
```

Do not hand-edit `blocked-hostnames.json`.
