# Fixtures

Shared test inputs for `packages/*` and `apps/*`. Generated/added in Milestone 1
(PDFs) and Milestone 5 (exotic images). Keep them tiny and synthetic — **never
commit real user documents**.

Required (see `docs/IMPLEMENTATION_PLAN.md` §10):

| File | Purpose |
|---|---|
| `pdf/1-page.pdf` | smallest happy path |
| `pdf/3-page.pdf` | multi-page ops (split/extract/delete/reorder) |
| `pdf/rotated.pdf` | rotation metadata handling |
| `pdf/encrypted.pdf` | defined behavior: decrypt-with-password vs reject |
| `pdf/corrupt.pdf` | parser-failure path |
| `pdf/bomb.pdf` | decompression/object-graph guard |
| `pdf/large-pages.pdf` | page-count cap |
| `img/portrait.jpg`, `img/landscape.jpg` | image→PDF sizing |
| `img/transparent.png` | alpha handling |
| `img/multipage.tiff` | multi-frame → multi-page (when TIFF lands) |
| `img/sample.heic` | HEIC decode (when HEIC lands) |

Generation scripts (e.g. building the PDFs with `@cantoo/pdf-lib`) are added in
Milestone 1 so fixtures are reproducible rather than opaque binaries.
