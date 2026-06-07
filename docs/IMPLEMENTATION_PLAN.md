# securePDF Implementation Plan (v3)

> **v3 — two-tier split.** securePDF runs **entirely on the Cloudflare free
> tier**: static SPA delivery, in-browser PDF processing, and a *light* Worker
> that **proxies** heavy operations to a separate **Cloud Run** service. Anything
> that can't run for free on Cloudflare (large PDFs, Office→PDF, native
> qpdf/Ghostscript/LibreOffice/ImageMagick) lives in the Cloud Run repo
> (`securepdf-run`, not in this repo), which **reuses `@securepdf/core`**. The
> boundary is pinned in [`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md);
> decisions in [`DECISIONS.md`](./DECISIONS.md); the v2→v3 rationale and the
> original audit in [`PLAN_AUDIT.md`](./PLAN_AUDIT.md).

## 1. Product Direction

securePDF is a PDF organization and "To PDF" conversion tool. The same capability
is exposed through three entry points — **browser GUI**, **CLI**, **HTTP API** —
all driven by one **versioned operation schema** and one **runtime-neutral core**.

It deploys as a single **Cloudflare Worker with Static Assets**, and it is
designed so that **everything in this repo fits the Cloudflare free tier**:

- **Browser (default, free, private):** does the actual PDF work on-device. No
  upload, no isolate memory ceiling, no per-request CPU cap.
- **Light Worker (free):** serves the SPA and the OpenAPI spec, answers
  `capabilities` and `validate-plan`, and **proxies** heavy operations to Cloud
  Run. It never parses PDFs itself.
- **Cloud Run (separate repo):** the heavy server-side API for CLI/agents and for
  what the browser can't do — large PDFs, Office→PDF, native compress/repair. It
  reuses `@securepdf/core` plus native tools.

This keeps the "one engine, three entry points" principle (the engine now also
runs on Cloud Run) while drawing a hard line: **no heavy compute on Cloudflare.**

## 2. Approved Initial Scope

### 2.1 PDF Organization

merge, split (multi-output), extract, delete, rotate (90/180/270), flip
(horizontal/vertical), reorder, insertPdf, insertImage. Runs **in the browser**
for small/medium documents and is **proxied to Cloud Run** for large ones (and for
headless CLI/agent use).

### 2.2 To PDF Conversion

Input → PDF only (no reverse conversion, no OCR in v1).

- **Browser:** PDF, JPG/JPEG/JFIF, PNG natively; plus APNG, WebP, AVIF, GIF, BMP,
  ICO, TIFF, HEIC/HEIF via lazily-loaded decoders.
- **Cloud Run:** the same conversions on large inputs, **plus Office→PDF**
  (docx/xlsx/pptx, …) via LibreOffice — which is infeasible on Cloudflare.

### 2.3 What runs where

| Work | Browser (free) | Worker (free) | Cloud Run |
|---|:--:|:--:|:--:|
| Serve SPA / `openapi.json` | — | ✅ | — |
| `capabilities`, `validate-plan` | — | ✅ light | — |
| Organize / To-PDF (small–medium) | ✅ | proxy | ✅ |
| Organize / To-PDF (large) | ✋ | proxy | ✅ |
| **Office→PDF** | ✋ | proxy | ✅ |
| Heavy compress / repair / linearize | ✋ | proxy | ✅ |

## 3. Non-Goals (this repo)

- **No heavy server-side compute on Cloudflare.** Large/Office/native work is
  proxied to Cloud Run, implemented in `securepdf-run`.
- No reverse conversion (PDF→Office/image/text/HTML) in v1 (both repos).
- No OCR, no AI summarization/translation/chat in v1.
- **No remote/URL inputs** (no SSRF surface).
- No persistent storage of uploads (the Worker never stores; Cloud Run retention,
  if any, is defined in its repo).
- No Cloud Run service code, Dockerfile, or GCP infra in this repo.

## 4. Architecture

### 4.1 Package Layout

```text
securePDF/
  apps/
    web/                 # Vite + React 19 + MUI 6 SPA (local-first)
    cli/                 # npm CLI: local engine + --endpoint (→ Worker)
    worker/              # Cloudflare Worker: static host + light API + proxy
      src/index.ts
  packages/
    schema/              # Versioned operation schema, validation, OpenAPI gen
    core/                # Runtime-neutral PDF engine (@cantoo/pdf-lib)
    codecs/              # Lazily-loaded image decoders
  fixtures/
  wrangler.jsonc         # Static Assets + run_worker_first + CLOUD_RUN_URL var
  docs/
```

`packages/{schema,core,codecs}` are **shared with the Cloud Run repo** (D12):
they become publishable (`@securepdf/*` on npm) when `securepdf-run` is created;
until then they're raw-TS internal packages bundled in-repo.

### 4.2 Shared Core

Runtime-neutral TypeScript in `packages/core` (no browser-only or Node-only APIs),
using **`@cantoo/pdf-lib`**. Buffer-based (no streaming parse). The **same code**
runs in the browser, the Node CLI, and Cloud Run. `packages/codecs` wraps image
decoders behind one lazily-imported interface. Rendering (thumbnails) uses
**`pdfjs-dist`** in the GUI only — `pdf-lib` cannot rasterize.

### 4.3 Operation Schema

Versioned JSON schema; the single contract across GUI/CLI/Worker/Cloud Run.

```json
{
  "version": "1",
  "inputs": [{ "id": "a", "filename": "a.pdf", "type": "application/pdf" }],
  "operations": [
    { "op": "merge", "inputs": ["a", "b"] },
    { "op": "rotate", "pages": "2-4", "degrees": 90 },
    { "op": "delete", "pages": "7" }
  ],
  "output": { "format": "pdf", "filename": "output.pdf" }
}
```

- **Working-document model:** operations apply sequentially to a single working
  doc; the first op (usually `merge`) establishes it. `insertPdf`/`insertImage`
  take an `at` index. Ranges resolve against the working doc at that step.
- **Multi-output:** `split`/`extract` may emit N results; `output.container:
  "zip"` returns them as one archive (API), N files (CLI), or N downloads (GUI).
- **Page-range grammar (pinned):** 1-based, inclusive; comma-separated `N` |
  `N-M` | `N-end` | `last` | `even` | `odd`; whitespace tolerant.
- Stable op names: `merge`, `split`, `extract`, `delete`, `rotate`, `flip`,
  `reorder`, `insertPdf`, `insertImage`, `convertToPdf`. `version` required;
  unknown ops rejected; bump to `"2"` only on a breaking change. `/openapi.json`
  is **generated from this schema** (`OPERATION_NAMES` drives the `oneOf`).

## 5. Browser GUI Plan

First screen is the working area, **local-first** (files stay on-device unless
downloaded). Views: import area; PDF.js thumbnail grid; selected-page toolbar;
operation queue; output settings; export; optional CLI/API command preview.
Controls: drag-and-drop; click/shift-click/range selection; rotate; delete;
move; insert; split/extract dialog; merge-order list; download.

- **Stack:** Vite + React 19 + MUI 6 + Emotion. `pdfjs-dist` (Web Worker) renders;
  `@cantoo/pdf-lib` manipulates (off the main thread for large work).
- **Capabilities panel** distinguishing local (browser) from remote (Cloud Run
  via the Worker proxy) — and showing when remote is unconfigured.
- For operations the browser can't do (Office→PDF, very large files), the GUI
  offers **"process on server"**, which POSTs to the same-origin Worker (proxied
  to Cloud Run). Same-origin ⇒ no CORS.
- **Accessibility** (axe/Lighthouse) and a **Japanese UI** (i18n) are first-class.

## 6. CLI Plan

Friendly to humans and AI agents. **Local engine** (`@securepdf/core`, no network)
for what runs locally; **`--endpoint`** points at a securePDF Worker URL, which
proxies heavy work to Cloud Run — so the CLI targets **one** endpoint regardless
of where the work runs.

```bash
securepdf capabilities --endpoint https://pdf.example.com
securepdf merge a.pdf b.pdf -o output.pdf                 # local
securepdf rotate input.pdf --pages 1,last --degrees 90 -o rotated.pdf
securepdf delete input.pdf --pages 2,4-5 -o trimmed.pdf
securepdf extract input.pdf --pages 1,3-4 -o extracted.pdf
securepdf flip input.pdf --pages even --axis horizontal -o flipped.pdf
securepdf reorder input.pdf --order 3,1,2 -o reordered.pdf
securepdf insert-pdf base.pdf appendix.pdf --at 3 -o inserted.pdf
securepdf insert-image base.pdf scan.png --at 0 -o with-scan.pdf
securepdf split input.pdf --every 1 -o page.pdf
securepdf organize --endpoint https://pdf.example.com \   # remote (proxied)
  --input a=a.pdf --input b=b.pdf --plan plan.json -o output.pdf
securepdf convert deck.pptx --to pdf --endpoint https://pdf.example.com -o deck.pdf
```

Agent flags: `--json`, `--dry-run`, `--endpoint`, `--api-key`, `--no-network`.
Every agent-usable command supports JSON output.

## 7. API Plan

One API surface on the Worker. Light endpoints are served by the Worker; heavy
endpoints are **streamed through** to Cloud Run (D11).

### 7.1 Endpoints

```http
GET  /api/v1/capabilities       # light — served by the Worker
GET  /openapi.json              # light — generated from the schema
POST /api/v1/validate-plan      # light — schema + declared page counts, NO parsing
POST /api/v1/organize           # PROXY → Cloud Run
POST /api/v1/convert/to-pdf     # PROXY → Cloud Run
# future, in Cloud Run, proxied:
POST   /api/v1/jobs   GET /api/v1/jobs/:id   GET /api/v1/jobs/:id/result   DELETE …
```

### 7.2 Request / Response

`multipart/form-data`: a JSON `plan` part plus binary input parts keyed by id
(see [`api.md`](./api.md)). Responses: `application/pdf`, `application/zip`
(multi-output), or the JSON error envelope with stable `code`s and a `requestId`.
Output filenames are sanitized and RFC 5987-encoded (Japanese-safe).

### 7.3 The proxy (free-tier-safe)

The Worker maps `…/api/v1/X` → `${CLOUD_RUN_URL}/X`, **streams** `request.body`
into the subrequest (no buffering, no PDF parsing), attaches the Cloud Run
credential, and streams the response back. This is almost pure I/O → fits the
**10 ms** free CPU budget and uses **1/50** free subrequests. Inbound bodies are
capped at the **free 100 MB** limit; larger needs a future direct path (OQ2). If
`CLOUD_RUN_URL` is unset, heavy endpoints return `503 BACKEND_NOT_CONFIGURED`.

### 7.4 Auth

Clients authenticate to the **Worker** (`Authorization: Bearer <token>`, optional
Turnstile for browser origin, Cloudflare rate limiting). The Worker holds the
**Cloud Run** credential; Cloud Run is **private** (OQ1). No file persistence.

## 8. Cloudflare Free-Tier Budget (what keeps us free)

The design is governed by the free limits below; staying inside them is why
nothing here needs Workers Paid.

| Free limit | Value | How securePDF stays inside |
|---|---|---|
| CPU / request | **10 ms** | Worker only serves JSON, validates plans (no parsing), and **streams** the proxy — all sub-millisecond. Heavy compute is in the browser or Cloud Run. |
| Isolate memory | **128 MB** | Worker never holds file bytes (streaming proxy). Heavy in-memory work is browser/Cloud Run. |
| Inbound body | **100 MB** (Free/Pro) | Enforced cap for proxied uploads; bigger → future direct path (OQ2). |
| Subrequests | **50** / request | Proxy uses 1. |
| Requests/day | **100,000** | Static asset hits don't count; only `/api/*` invocations do. |
| Script bundle (gzip) | **3 MB** | Worker ships no decoder WASM (browser/Cloud Run own that) → tiny bundle. |
| Static assets | 20,000 files, 25 MiB/file | SPA + PDF.js worker fit easily. |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
Cloud Run's budget (32 GiB / 8 vCPU / 60 min) lives in
[`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md) / the `securepdf-run` repo.

### 8.1 Capability matrix

| Capability | Browser | Worker | Cloud Run | Notes |
|---|:--:|:--:|:--:|---|
| Serve SPA / OpenAPI | — | ✅ | — | free static + light |
| `capabilities` / `validate-plan` | — | ✅ | — | no PDF parsing |
| Organize (small–medium) | ✅ | proxy | ✅ | `@cantoo/pdf-lib` |
| Organize (large) | ✋ | proxy | ✅ | 128 MB browser/isolate limit |
| JPG/PNG → PDF | ✅ | proxy | ✅ | native embed |
| WebP/TIFF/BMP/ICO/GIF → PDF | ✅ | proxy | ✅ | jSquash/utif2/pure-JS |
| AVIF/HEIC → PDF | ✅ | proxy | ✅ | WASM weight → browser/Cloud Run, not Worker |
| **Office → PDF** | ✋ | proxy | ✅ | LibreOffice (Cloud Run only) |
| Compress / repair / linearize | ✋ | proxy | ✅ | qpdf/Ghostscript (Cloud Run) |

## 9. Security and Privacy

- **Browser local-first** is the privacy default: files never leave the device for
  on-device operations. Advertise which operations are local.
- Worker: **no file storage, no payload logging** (only `requestId` + coarse
  metadata); streaming proxy never parses or buffers file bytes; sanitize output
  filenames (RFC 5987); centralizes auth and keeps **Cloud Run private**.
- Schema validation rejects unknown ops; magic-byte allowlist and enforced caps
  (size/page/output) live where files are actually parsed (browser, Cloud Run).
- No remote/URL inputs (no SSRF). Dependency audit for parsing libs.
- Cloud Run-specific hardening (bomb/object-graph guards on native tools, zip-slip
  on archives) is specified in `securepdf-run` against this contract.

## 10. Testing

Unit (Vitest, split into a **Node** project for the engine/CLI/Worker and a
**happy-dom** project for the React app, with v8 coverage): page-range parser
(property-based), schema validation, merge/split(multi-output)/extract/delete/
reorder, rotation, flip, image→PDF sizing, per-format decode, error-code
stability, round-trips (merge→split, rotate×4 = identity), the GUI's document
reducer/selectors, the Worker proxy (URL mapping, auth, 502), and CLI arg
parsing. (Adopting `@cloudflare/vitest-pool-workers` for true Workers-runtime
Worker tests is a tracked follow-up.)

Integration (Playwright): GUI import/export smoke; CLI local op; CLI `--endpoint`
op against a **mock Worker**; **Worker proxy** smoke (mock Cloud Run upstream —
asserts streaming, header/auth pass-through, `503` when unconfigured);
`/openapi.json` schema validation.

Fixtures (`fixtures/`): 1/3-page, rotated, encrypted, corrupt, bomb, large-page
PDFs; JPG portrait/landscape; transparent PNG; multipage TIFF and HEIC when added.
(Office fixtures live with `securepdf-run`.)

## 11. Milestones (this repo)

> Progress (2026-06): **M0–M4 done** — scaffold, core engine, browser GUI, CLI,
> and the light Worker + proxy are implemented, unit-tested (Vitest, Node +
> happy-dom, with coverage), and verified (browser E2E + `wrangler deploy
> --dry-run`). The browser GUI has since been refactored to a reducer-backed,
> component-decomposed architecture with a lazily-loaded engine chunk. M5–M7 remain.

### Milestone 0 — Project Setup ✅ (scaffold built & verified)
pnpm workspace, TS strict, ESLint/Prettier, Vitest/Playwright, Workers Static
Assets build, CI, fixtures, package skeletons.

### Milestone 1 — Core Schema & PDF Organization
schema + validator (version policy, multi-output, pipeline), page-range parser,
organize ops on `@cantoo/pdf-lib`, unit tests (Node + Workers).

### Milestone 2 — Browser GUI MVP
import, PDF.js thumbnails, selection, organization toolbar, download, command/API
preview, "process on server" hook (disabled until a backend is configured),
baseline a11y + Japanese i18n.

### Milestone 3 — CLI MVP
local commands; `--json`/`--dry-run`/`--no-network`; `--endpoint` mode; structured
errors.

### Milestone 4 — Light Worker + Proxy
`/capabilities` (local vs remote), `/validate-plan`, `/openapi.json` (generated),
streaming **proxy** for `organize` + `convert/to-pdf` with `CLOUD_RUN_URL` +
auth + `503` when unset; Workers-runtime tests. (No heavy PDF code here.)

### Milestone 5 — Extended Browser Conversion
WebP/AVIF/GIF/BMP/ICO/TIFF, then HEIC/HEIF in the browser; same `codecs` package
reused server-side by Cloud Run later.

### Milestone 6 — Publish Shared Packages
Build `@securepdf/{schema,core,codecs}` to JS + d.ts, make publishable for
`securepdf-run` to consume (OQ3); dependency-audit workflow; public docs/examples.

### Milestone 7 — Hand-off to `securepdf-run`
Finalize the boundary contract; the Cloud Run repo implements the proxied
endpoints (Office→PDF, large, heavy compress/repair) against `@securepdf/core`.
(Out of scope in this repo.)

## 12. Immediate Next Steps

1. **(done)** Milestone 0 scaffold (Workers Static Assets, verified).
2. `packages/schema`: operation schema, validator, page-range grammar, OpenAPI gen.
3. `packages/core`: `@cantoo/pdf-lib` organize primitives + working-doc pipeline.
4. `fixtures/` + unit tests (Node + Workers).
5. Minimal GUI: import two PDFs, merge, download (fully in-browser).
6. Light Worker: `/capabilities` + `/validate-plan` before wiring the proxy.
7. CLI `capabilities` + `merge` (local) as the first commands.
