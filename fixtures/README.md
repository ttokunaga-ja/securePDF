# Fixtures

Shared test inputs for `packages/*` and `apps/*`. Keep them tiny and synthetic —
**never commit real user documents**. Most unit tests build PDFs in memory via
`packages/core/src/testUtils.ts`; the files here are for cases that are awkward to
synthesize inline.

Regenerate deterministically with:

```bash
pnpm gen:fixtures   # → scripts/gen-fixtures.mjs
```

Generated now:

| File | Purpose |
|---|---|
| `pdf/1-page.pdf` | smallest happy path |
| `pdf/3-page.pdf` | multi-page ops (split/extract/delete/reorder) |
| `pdf/rotated.pdf` | rotation metadata handling |
| `pdf/corrupt.pdf` | parser-failure path (`CORRUPT_PDF`) |
| `img/1px.png` | PNG image→PDF (alpha) |
| `img/1px.jpg` | JPEG image→PDF |

Planned (added with the matching milestones, see `docs/IMPLEMENTATION_PLAN.md` §10):

| File | Purpose |
|---|---|
| `pdf/encrypted.pdf` | decrypt-with-password vs reject |
| `pdf/bomb.pdf` | decompression/object-graph guard |
| `pdf/large-pages.pdf` | page-count cap |
| `img/multipage.tiff` | multi-frame → multi-page (when TIFF lands) |
| `img/sample.heic` | HEIC decode (when HEIC lands) |
