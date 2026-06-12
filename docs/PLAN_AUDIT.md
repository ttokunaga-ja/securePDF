# securePDF Implementation Plan — Audit

**Date:** 2026-06-05
**Audited document:** `docs/IMPLEMENTATION_PLAN.md` (original, 518 lines)
**Method:** Architectural review plus verification of version-sensitive claims
(Cloudflare platform direction, runtime limits, `pdf-lib` and image-decoder
feasibility) against current (2025–2026) primary sources. Citations inline.

The plan is fundamentally sound: the single-schema-across-GUI/CLI/API principle,
the runtime-neutral core, the synchronous-first / async-later staging, the
no-persistence privacy posture, and the capabilities-endpoint-before-mutation
discipline are all good calls. The findings below are corrections and gaps, not
a rejection of the direction. They are ranked by severity.

> **v3 update.** This audit produced plan **v2**. The deployment model was then
> changed again in **v3**: securePDF runs only on the Cloudflare **free tier** and
> **proxies** heavy work to a separate **Cloud Run** service. That supersedes
> **C3's** "use Workers Paid" resolution — there is no heavy Cloudflare compute to
> pay for now. The C3 *facts* (Free = 10 ms CPU, 128 MB isolate) still hold and
> are exactly why heavy work moved off Cloudflare. See
> [`DECISIONS.md`](./DECISIONS.md) (D10–D12) and
> [`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md).

---

## Severity legend

- **C — Critical:** wrong foundation; fix before writing code or it forces rework.
- **M — Major:** real design gap or quantitative error; fix before the relevant milestone.
- **m — Minor:** improvement, clarification, or hardening; track but not blocking.

---

## C1 — Build on Workers Static Assets, not Pages + Pages Functions

The plan frames the whole project as a "Cloudflare Pages project" whose dynamic
API runs in "Cloudflare Pages Functions" (§1, §4.1 `functions/api/v1/*.ts`, §7,
Milestone 4). As of 2026 this is the **superseded** path.

- Cloudflare's official position (blog, 2025-04-08): *"Now that Workers supports
  both serving static assets and server-side rendering, you should start with
  Workers,"* and *"Cloudflare Pages will continue to be supported, but, going
  forward, all of our investment, optimizations, and feature work will be
  dedicated to improving Workers."*
  — https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/
- The two products are explicitly converging into one.
  — https://blog.cloudflare.com/pages-and-workers-are-converging-into-one-experience/
- Official Pages→Workers migration guide with a feature matrix exists; new
  features (Durable Objects, Cron, Secrets Store, observability) land on Workers
  first.
  — https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

**Why it matters for this project specifically.** securePDF is exactly the case
the recommendation targets: a static SPA **plus** a small dynamic JSON/binary
API. Workers Static Assets serves both from one deployable unit, which also means
**the GUI and the API share an origin** — so the cross-origin CORS layer the
current design would otherwise need disappears.

**Fix.** Replace the Pages file-routing `functions/api/v1/*.ts` layout with a
single Worker entry (`apps/worker/src/index.ts`) and a `wrangler.jsonc` that
serves the built SPA as assets and routes `/api/*` to the Worker first:

```jsonc
{
  "name": "secure-pdf",
  "main": "apps/worker/src/index.ts",
  "compatibility_date": "2026-06-04",
  "assets": {
    "directory": "apps/web/dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"],
    "not_found_handling": "single-page-application"
  }
}
```

- Routing model and `run_worker_first`:
  https://developers.cloudflare.com/workers/static-assets/routing/ ,
  https://developers.cloudflare.com/workers/static-assets/binding/

Note: the user's existing `portfolio` repo uses Pages (`pages_build_output_dir`),
but that project is **purely static** with no Functions, so Pages was fine there.
securePDF's dynamic API is precisely where the Workers recommendation bites.

---

## C2 — `pdf-lib` upstream is effectively unmaintained; use `@cantoo/pdf-lib`

The plan names `pdf-lib` as the core engine (§4.2). `pdf-lib` is the right
*shape* of library — pure TypeScript, no Node- or browser-only dependencies, so
it runs unchanged in browser, Node, and Workers (confirmed:
https://github.com/Hopding/pdf-lib). But:

- Upstream's last release is **v1.17.1, November 2021** — it is stale.
- It throws `EncryptedPDFError` on encrypted input and documents that encrypted
  documents are unsupported; `ignoreEncryption: true` loads without decrypting
  and often yields garbage (https://github.com/Hopding/pdf-lib).

The maintained fork **`@cantoo/pdf-lib`** (v2.7.1, published 2026-05-27) is a
drop-in that adds active maintenance, SVG support, and **encrypted-document
support** — https://www.npmjs.com/package/@cantoo/pdf-lib ,
https://github.com/cantoo-scribe/pdf-lib.

**Fix.** Depend on `@cantoo/pdf-lib` from day one (same API surface). This also
**partially retires the §4.2 "qpdf WASM for encrypted PDFs" feasibility item**:
the common "decrypt with a supplied password" case is covered without shipping a
multi-MB WASM module. Keep qpdf on the feasibility track only for repair,
linearization, and compression — not for routine decryption.

---

## C3 — The "free public demo" collides with the Workers Free CPU limit

§7.3 proposes an initial "public demo" with "no account system" and "strict file
size limits," implying it runs on the free tier. The current limits make real
server-side PDF work on Free impossible:

| Limit | Free | Paid (Bundled/Standard) | Source |
|---|---|---|---|
| **CPU time / request** | **10 ms** (hard) | default **30 s**, up to **5 min** via `limits.cpu_ms` | [limits](https://developers.cloudflare.com/workers/platform/limits/), [CPU changelog](https://developers.cloudflare.com/changelog/post/2025-03-25-higher-cpu-limits/) |
| **Isolate memory** | **128 MB** | 128 MB (same) | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Max request body** | **100 MB** (Free/Pro) | 200 MB (Business) / 500 MB (Enterprise) — set by **account** plan | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Script bundle (gzip)** | **3 MB** | **10 MB** | [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Startup time** (incl. WASM compile) | **1 s** | 1 s | [startup changelog](https://developers.cloudflare.com/changelog/2025-10-10-increased-startup-time/) |
| **Static assets** | 20,000 files, 25 MiB/file | 100,000 files, 25 MiB/file | [assets changelog](https://developers.cloudflare.com/changelog/2025-09-02-increased-static-asset-limits/) |

Merging or rewriting a real PDF will not finish in **10 ms of CPU**. Important
nuance: CPU time ≠ wall time — time spent *awaiting* `fetch`/I/O does not count,
and HTTP (fetch) handlers have **no wall-clock cap** while the client stays
connected. But PDF manipulation is CPU-bound, so the 10 ms Free ceiling is the
binding constraint.

**Fix / decisions the plan must make explicit:**

1. The server-side API requires **Workers Paid**, and likely a `limits.cpu_ms`
   bump toward the 5-min ceiling for the largest allowed jobs. State this as a
   cost decision, not a footnote.
2. Make the **GUI client-first** the headline: browser-side processing has no
   128 MB isolate ceiling and no per-request CPU cap, and keeps files on-device
   (a privacy win the plan already hints at). The API is the convenience path
   for **automation/agents/CLI**, governed by strict limits.
3. If a zero-cost public demo is still wanted, it must run the **same WASM/JS
   core in the browser** (client-side), not in a Free Worker.

---

## M4 — Quantify limits and tie them to enforced caps

§8 lists limits "to validate" but leaves them blank, and §9 asks for "maximum
file count, file size, page count, and output size" without numbers. Derive the
caps from the table in C3 and pin them in the schema validator:

- **Memory is the real ceiling.** `pdf-lib`/`@cantoo/pdf-lib` parse the whole
  document into memory (no streaming parse), and an operation holds the source
  plus the output copy simultaneously. Against a 128 MB isolate, a safe initial
  server cap is on the order of **~20–25 MB total input** and a bounded **page
  count** (e.g. 500) and **output size**, not the full 100 MB body limit. Treat
  these as starting guesses to be load-tested, and keep them as config.
- **Body size** caps must respect the account-plan value (100/200/500 MB) — but
  the memory ceiling will bite first, so the enforced cap is lower than the body
  limit.
- **Bundle size** (3 MB Free / 10 MB Paid gzip) is consumed by WASM decoders —
  see M5/M6. This caps how many decoders can live in one Worker.
- **Honesty fix:** §4.2's "accept `ReadableStream` where practical" is mostly
  aspirational for `pdf-lib`, which needs full buffers. Keep the streaming-
  friendly signature, but document that organize operations are buffer-based and
  memory-bound.

---

## M5 — The capability matrix understates what is feasible; the real blocker is bundle weight

§8's matrix marks WebP/AVIF/GIF/BMP/ICO/TIFF as "Validate" for the API, implying
decode feasibility is unknown. It is known: every target format has a
Workers-viable pure-JS or WASM decoder. The genuine constraint is **cumulative
WASM bundle size** (M4), not whether decoding is possible.

| Format | Decoder (npm) | Approx size | Workers | Note |
|---|---|---|---|---|
| JPEG, PNG | `@cantoo/pdf-lib` native `embedJpg`/`embedPng` | — | ✅ | no decode needed |
| WebP | `@jsquash/webp` | decode ~173 kB | ✅ | jSquash targets Workers/edge |
| AVIF | `@jsquash/avif` | decode ~1.21 MB | ⚠️ | large; lazy-load |
| TIFF (multi-page) | `utif2` | ~105 kB, pure JS | ✅ | returns per-frame IFDs |
| BMP | `bmp-js` | small, pure JS | ✅ | |
| ICO | `decode-ico` | ~5 kB, pure JS | ✅ | |
| GIF | `omggif` | ~38 kB, pure JS | ✅ | first/all frames |
| HEIC/HEIF | `libheif-js` (+`heic-decode`) | **~1.03 MB WASM, 6.4 MB pkg** | ⚠️ | size risk is real |

Sources: jSquash https://github.com/jamsinclair/jSquash ; utif2
https://www.npmjs.com/package/utif2 ; libheif-js
https://www.npmjs.com/package/libheif-js ; heic-decode
https://www.npmjs.com/package/heic-decode .

**Fixes:**

- Upgrade the matrix: WebP/TIFF/BMP/ICO/GIF move from "Validate" to **"Yes (pure
  JS / small WASM)"** for the API; AVIF and **HEIC** stay flagged for **bundle
  weight**, not decodability.
- **WASM must be statically imported** in Workers (not `fetch`-then-compile), it
  counts toward the gzip bundle, and global-scope compile counts toward the 1 s
  startup limit — so instantiate decoders **lazily inside the handler**, never at
  module top level.
  — https://developers.cloudflare.com/workers/runtime-apis/webassembly/
- Because AVIF (~1.2 MB) + HEIC (~1 MB) together eat much of the 10 MB paid
  bundle, prefer **lazy/dynamic import** and consider isolating HEIC in its own
  Worker if it ever ships server-side. For the **initial** API, keep server-side
  conversion to **JPEG/PNG only** (no decoder WASM at all) and let the browser
  handle exotic formats locally.

---

## M6 — Specify the decode→re-encode→embed pipeline

`pdf-lib`/`@cantoo/pdf-lib` can only embed **JPEG and PNG** — it cannot take raw
RGBA (https://pdf-lib.js.org/). So every non-JPEG/PNG format needs:

> decode to RGBA (jSquash/utif2/…) → **re-encode to PNG** (`@jsquash/png`
> ~193 kB, or pure-JS `fast-png`/`upng-js`) → `embedPng`.

This is the standard approach (https://github.com/jamsinclair/jSquash) and the
plan should name it. Cost implications worth stating: an extra encode pass per
image (CPU + a transient `width×height×4` buffer), and PNG is lossless so
photographic sources balloon — for photo-like inputs, re-encode to **JPEG**
(`@jsquash/jpeg`) and `embedJpg` instead. The §10 test "Image to PDF page sizing"
should be joined by a "decode path produces correct pixels" test per format.

---

## M7 — The GUI needs a renderer (`pdf.js`); `pdf-lib` cannot rasterize

§5's thumbnail grid and §10's "render output thumbnails with PDF.js" assume page
rendering, but `pdf-lib` is a **writer/manipulator with no rasterizer**. The GUI
therefore needs **`pdfjs-dist`** (PDF.js) for thumbnails and page previews,
separate from `@cantoo/pdf-lib` for manipulation. This dependency is missing from
the architecture (§4) and the GUI plan (§5). Add it explicitly, run rendering in
a **Web Worker** (PDF.js ships one), and keep it **client-only** — never ship a
rasterizer to the API.

---

## M8 — The operation schema has real gaps

The §4.3 schema is a good start but underspecified in ways that will cause rework:

1. **Multi-output operations.** `split` "by page range" and `extract` can produce
   **N files**, but `output` models a **single** file. The schema cannot express
   "split into 3 PDFs." Decide the contract: either each split range is its own
   output entry, or multi-file results are returned as a **zip** (API) / multiple
   files (CLI/GUI). This must be designed before Milestone 1, since it shapes both
   the core return type and the API response mode.
2. **Pipeline semantics.** `operations` is an array — define the **working-
   document model**: e.g. operations apply sequentially to a working doc;
   `merge [a,b]` establishes it, then `rotate`/`delete` mutate it. Specify what
   `inputs` mean for non-merge ops and how `insertPdf`/`insertImage` reference a
   position. Without this, GUI/CLI/API will diverge.
3. **Per-op parameters are unspecified:** `split` (ranges, fixed chunk size, or
   at-pages?), `reorder` (full permutation vs move-ops), `rotate` (`degrees`
   restricted to 90/180/270 — `pdf-lib` rotation must be a multiple of 90),
   `insertImage`/`convertToPdf` (target page size, fit/cover/contain, margin,
   DPI, multi-frame TIFF → multiple pages).
4. **Page-range grammar** is referenced (the "page range parser" unit) but never
   defined. Pin it: `"2-4"`, `"7"`, `"1,3,5-9"`, whitespace tolerance,
   1-based, inclusive, and decide `even`/`odd`/`N-end`/`last` support up front —
   the parser and its tests depend on the exact grammar.
5. **Versioning policy.** `version: "1"` needs a stated compatibility rule (when
   does it become `"2"`, are unknown ops rejected, is the field required).

---

## M9 — API/security details to close before exposure

- **Multi-output response mode** (zip) for split/extract — tie to M8(1). Ensure
  safe zip entry names (no `../`, no absolute paths).
- **`Content-Disposition` injection & Japanese filenames.** Output filename comes
  from the user; sanitize it and encode non-ASCII with `filename*=UTF-8''…`
  (RFC 5987). The §10 "Japanese filenames" manual test must cover the **download
  header**, not just the upload.
- **Malicious-PDF surface.** Parsing untrusted PDFs in-memory invites
  decompression bombs and pathological object graphs. Tie caps (page/object
  count, output size) to the 128 MB ceiling and fail closed. Add a corrupt/bomb
  fixture beyond the existing "corrupt PDF."
- **Magic-byte allowlist.** §9 says "magic-byte validation" — specify the sniff
  set (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, …) and reject content-type
  mismatches.
- **Do not add URL/remote inputs** (keeps SSRF off the table) — make this an
  explicit non-goal alongside the existing ones.
- **OpenAPI from the schema.** §1 wants one source of truth; generate
  `/openapi.json` **from** the operation schema. Note that documenting
  `multipart/form-data` (binary parts + a JSON `plan` part) in OpenAPI is fiddly —
  budget for it and add the §10 "`/openapi.json` schema validation" test as a
  guard.
- **Same-origin bonus.** With C1's unified Worker, GUI→API is same-origin, so no
  CORS config is needed for the first-party GUI; only document a CORS policy if
  third-party browser clients are ever allowed.

---

## m10 — Testing, conventions, and smaller items

- **Cross-runtime core tests.** Run the same core suite in **Node and in the
  Workers runtime** (vitest + `@cloudflare/vitest-pool-workers` / Miniflare) so
  "runs everywhere" is enforced, not assumed. Update §10's "Pages Functions
  multipart smoke test" → **Workers**.
- **Property-based + round-trip tests.** Fuzz the page-range parser; assert
  round-trips (merge→split restores page counts; rotate×4 = identity).
- **Encrypted-PDF expected behavior.** With `@cantoo/pdf-lib`, decide and test:
  decrypt-with-password vs reject-without — the existing "encrypted PDF" fixture
  needs a defined expectation.
- **Match the user's stack** (observed in sibling repos): **pnpm 11**, **Vite 8**,
  **TypeScript 5.9 strict** (`moduleResolution: "Bundler"`), **React 19 + MUI 6 +
  Emotion**, **wrangler 4**, **ESLint 9 flat config + Prettier**, **Vitest
  (jsdom, v8 coverage) + Playwright**, `apps/`+`packages/` monorepo. The plan is
  framework-agnostic; aligning the GUI to React + MUI keeps it consistent with
  the user's other projects.
- **Accessibility & i18n.** The user's other projects test a11y heavily (axe,
  Lighthouse) and ship Japanese UIs. A document tool should meet a11y and offer a
  Japanese UI; add both as explicit GUI goals.
- **HEIC/HEVC patent licensing.** HEIC decode touches HEVC patent licensing — a
  real legal gray area for a public service. Flag it on the feasibility track
  (Milestone 7), not just as a size risk.
- **CLI/npm release strategy.** Define versioning/publish flow for the CLI
  package and the API version lifecycle.

---

## What to keep (explicitly endorsed)

- One **versioned operation schema** as the single contract across GUI/CLI/API.
- **Runtime-neutral core**; runtime specifics pushed to `web`/`cli`/`worker`.
- **Synchronous-first**, async/R2 only when justified by limits.
- **No persistence / no payload logging** by default.
- **Capabilities + validate (dry-run) before any mutating endpoint.**
- **Disciplined non-goals** (no reverse conversion / OCR / AI in v1).
- The **milestone spine** — only the API milestone's runtime target changes
  (Pages Functions → Workers).

---

## Net effect on the plan

The intellectual core survives intact. The corrections are: (1) change the
deployment substrate to Workers Static Assets, (2) swap to the maintained
`@cantoo/pdf-lib`, (3) replace vague limits with the real numbers and the
plan-tier reality, (4) name the decoder + render dependencies the plan implies
but omits (`@jsquash/*`, `utif2`, `pdfjs-dist`), and (5) tighten the schema's
multi-output and pipeline semantics before code is written. The revised
`IMPLEMENTATION_PLAN.md` folds all of these in; `DECISIONS.md` records the choices.
