# securePDF — Decision Record

ADR-lite. Each entry is a resolved decision the implementation depends on, with
the reasoning, so building can start without re-litigating. Status: **Accepted**
unless noted. See [`PLAN_AUDIT.md`](./PLAN_AUDIT.md) for the supporting evidence
and [`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md) for the split with the
separate heavy-processing repo.

> **Deployment model (v3).** securePDF runs **entirely on the Cloudflare free
> tier**: static SPA delivery, in-browser PDF processing, and a *light* Worker
> (capabilities / openapi / validate-plan) that **proxies** heavy operations to a
> separate **Cloud Run** service. Anything that cannot run on the free tier
> (large PDFs, Office→PDF, native qpdf/Ghostscript/LibreOffice/ImageMagick) lives
> in the Cloud Run repo, which **reuses `@securepdf/core`**. This record was
> updated from v2, where the server API was assumed to need Workers Paid.

| # | Decision | Status |
|---|---|---|
| D1 | Deploy as **Cloudflare Workers + Static Assets** (not Pages) | Accepted |
| D2 | PDF engine = **`@cantoo/pdf-lib`** | Accepted |
| D3 | Monorepo via **pnpm workspaces** | Accepted |
| D4 | Build with **Vite 8**, **TypeScript 5.9 strict** | Accepted |
| D5 | GUI = **React 19 + MUI 6 + Emotion**, local-first | Accepted |
| D6 | Rendering = **`pdfjs-dist`** (PDF.js), GUI-only | Accepted |
| D7 | Image decoders = **`@jsquash/*` + pure-JS**, lazy per-format | Accepted |
| D8 | Tests = **Vitest** (+ Workers pool) and **Playwright** | Accepted |
| D9 | Lint/format = **ESLint 9 flat + Prettier** | Accepted |
| D10 | securePDF is **Cloudflare free-tier only**; heavy work → Cloud Run | Accepted |
| D11 | The light Worker **proxies** `/api/*` heavy ops to Cloud Run | Accepted |
| D12 | Cloud Run **reuses `@securepdf/core`** (published) + native tools | Accepted |

---

### D1 — Cloudflare Workers + Static Assets

Cloudflare officially steers new full-stack projects to Workers with Static
Assets; Pages is supported but feature-frozen
([blog 2025-04-08](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/)).
One Worker serves the built SPA (free static delivery) and runs `/api/*` first
via `run_worker_first`, so GUI and API **share an origin** (no CORS, and the
proxy in D11 stays same-origin for the browser).

### D2 — `@cantoo/pdf-lib`

Upstream `pdf-lib` is the right shape (pure JS, runs in browser/Node/Workers) but
its last release is v1.17.1 (Nov 2021) and it cannot open encrypted PDFs. The
maintained fork `@cantoo/pdf-lib` (v2.7.x, 2026) is a drop-in adding maintenance,
encrypted-document support, and SVG. The **same package powers the browser, the
CLI, and Cloud Run** (D12).

### D3 — pnpm workspaces

Matches the user's convention (`pnpm@11.0.8`) and the `apps/`+`packages/` layout.
Workspace protocol wires `core`/`schema`/`codecs` into `web`/`cli`/`worker`.

### D4 — Vite 8 + TypeScript 5.9 strict

Matches sibling repos: `target: ES2022`, `module: ESNext`,
`moduleResolution: "Bundler"`, `strict: true`, `"type": "module"`.

### D5 — React 19 + MUI 6 + Emotion, local-first

The user's GUIs are consistently React 19 + MUI 6 + Emotion. The GUI processes
files **in-browser by default** (no upload), which is the privacy story and the
zero-cost path — it has no 128 MB isolate ceiling and no per-request CPU cap. The
GUI only reaches the network for operations the browser cannot do (Office→PDF,
very large files), which go to the same-origin Worker and are proxied (D11).

### D6 — PDF.js for rendering

`pdf-lib` cannot rasterize. Thumbnails/previews use `pdfjs-dist` in its Web
Worker, **client-only** — never shipped to the Worker or Cloud Run.

### D7 — Image decoders, lazy per-format

`@cantoo/pdf-lib` embeds only JPEG/PNG, so other formats decode to RGBA then
re-encode to PNG/JPEG before embedding. Libraries: `@jsquash/webp`,
`@jsquash/avif`, `@jsquash/png`/`@jsquash/jpeg`, `utif2`, `bmp-js`, `decode-ico`,
`omggif`, `libheif-js`. Each is **lazily imported**. In securePDF these run in the
**browser**; on Cloud Run the same `codecs` package runs server-side when needed.

### D8 — Vitest + Playwright

Vitest (jsdom, globals, v8 coverage); core tests also run in the Workers runtime
via `@cloudflare/vitest-pool-workers`/Miniflare. Playwright for GUI/CLI/proxy
smoke tests.

### D9 — ESLint 9 flat config + Prettier

Matches the user's repos. Shared root config; per-package overrides as needed.

### D10 — securePDF is Cloudflare free-tier only; heavy work → Cloud Run

securePDF intentionally does **no heavy server-side compute**. The work splits by
where it can run for free:

- **Free, in-browser:** all PDF organization and To-PDF conversion the JS/WASM
  engine can do on-device (the bulk of the product).
- **Free, in the light Worker:** static delivery, `GET /capabilities`,
  `GET /openapi.json`, `POST /validate-plan` (structural + declared-page-count
  validation only — **no PDF parsing**, so it stays well under the 10 ms free CPU
  limit).
- **Not on Cloudflare at all:** large PDFs (the 128 MB isolate is the ceiling),
  Office→PDF, and native qpdf/Ghostscript/LibreOffice/ImageMagick work — these go
  to **Cloud Run** (separate repo) which offers up to 32 GiB RAM / 8 vCPU / 60 min
  ([Cloud Run quotas](https://docs.cloud.google.com/run/quotas)).

This removes the v2 assumption that the server API needed Workers Paid: there is
no heavy Cloudflare compute to pay for. Cloud Run has its own (low-frequency,
possibly free-tier) cost model, tracked in its own repo.

### D11 — The light Worker proxies `/api/*` heavy ops to Cloud Run

Chosen over direct client→Cloud Run calls (user decision). securePDF's Worker
exposes the full `/api/v1/*` surface and **forwards** the heavy endpoints
(`organize`, `convert/to-pdf`, future `jobs/*`) to a configured Cloud Run backend
(`CLOUD_RUN_URL`), **streaming the request body through** (passing
`request.body` straight into the subrequest — no buffering). A streaming
passthrough is almost pure I/O, so it fits the **10 ms free CPU** budget and uses
**1 of 50** free subrequests.

Benefits: one origin and one API for clients (CLI/agents/GUI), **centralized
auth** at the Worker (it attaches the Cloud Run credential), and Cloud Run can
stay **private** (only the Worker may call it). Same-origin keeps the browser
CORS-free.

Constraint: the **free Worker inbound body limit is 100 MB**, so proxied uploads
are capped there; files beyond 100 MB need a future direct/signed-URL path (see
open questions). When `CLOUD_RUN_URL` is unset, heavy endpoints return
`503 BACKEND_NOT_CONFIGURED` and `capabilities` advertises them as unavailable.

### D12 — Cloud Run reuses `@securepdf/core` (published) + native tools

Chosen over an independent reimplementation (user decision). Cloud Run consumes
the **same** `@securepdf/schema` / `@securepdf/core` / `@securepdf/codecs`
(published to npm from this repo, or referenced), so the operation schema and the
organize/convert engine are **one implementation** across browser, CLI, and
server. Cloud Run adds only the *heavy differential*: more memory/CPU for large
PDFs, and native binaries (LibreOffice/qpdf/Ghostscript/ImageMagick) for Office
conversion and heavy repair/compression that JS/WASM can't do well.

Consequence: `packages/{schema,core,codecs}` must become **publishable** (built to
JS + d.ts, `private: false`) when the Cloud Run repo is set up. Until then they
stay raw-TS internal packages (bundled by Vite/Wrangler in-repo). The contract is
pinned in [`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md).

---

## Open questions (decide with the user before the relevant milestone)

- **OQ1 (proxy, Milestone 4):** Worker→Cloud Run **auth mechanism** — GCP ID
  token (OIDC) minted by the Worker, vs a shared secret header. Affects how Cloud
  Run is locked down.
- **OQ2 (proxy):** Files **> 100 MB** (above the free Worker inbound limit) —
  out of scope initially, or add a direct/signed-URL upload path to Cloud Run
  later.
- **OQ3 (packaging, when Cloud Run repo starts):** Publish `@securepdf/*` to a
  public/private npm registry, vs git submodule / vendored — for Cloud Run reuse.
- **OQ4 (Milestone 1):** Multi-output transport — zip for the API is assumed;
  confirm vs a JSON manifest + multiple parts.
- **OQ5 (Milestone 2):** Confirm Japanese as the default UI language (with
  English).
- **OQ6 (Cloud Run repo):** HEIC server-side at all (HEVC patent licensing), or
  keep HEIC browser-only.

None of these block in-repo Milestones 0–3 (scaffold, core, browser GUI, CLI
local mode).
