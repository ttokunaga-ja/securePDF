# securePDF — Architecture

Companion to [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §4 and
[`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md). Runtime topology and module
boundaries for the **two-tier** design: Cloudflare free tier here, heavy
processing on Cloud Run (separate repo).

## Topology

```
            ┌──────────────── Cloudflare Worker (secure-pdf, free) ────────────────┐
 browser ──▶│  /*            ─ static asset ─▶ apps/web/dist (SPA)                  │
            │  /api/v1/capabilities | /openapi.json | /validate-plan               │
            │                ─ run_worker_first ─▶ apps/worker (light, no parsing)  │
            │  /api/v1/organize | /convert/to-pdf                                   │
            │                ─ stream body ─▶ proxy ──┐                             │
            └─────────────────────────────────────────┼───────────────────────────┘
                                                       │ CLOUD_RUN_URL (+ auth, private)
  CLI ──▶ (local)  packages/{schema,core,codecs}       ▼
      └──▶ (remote) POST /api/v1/* ─▶ Worker ─▶  Google Cloud Run (securepdf-run)
                                                  @securepdf/core + native tools
```

- `wrangler.jsonc` (`run_worker_first: ["/api/*"]`, `not_found_handling:
  "single-page-application"`) decides asset-vs-worker. GUI and API are same-origin
  ⇒ no CORS, including for the proxy path.
- The Worker is **stateless and parse-free**: it serves JSON, validates plans
  (declared counts only), and **streams** heavy requests to Cloud Run.

## Module boundaries

| Package | Runtime(s) | Depends on | May NOT use |
|---|---|---|---|
| `packages/schema` | browser, Node, Workers, **Cloud Run** | — | DOM, Node, `fs` |
| `packages/core` | browser, Node, Workers, **Cloud Run** | `schema`, `@cantoo/pdf-lib` | DOM, Node, `fs` |
| `packages/codecs` | browser, Node, **Cloud Run** | (lazy) `@jsquash/*`, `utif2`, … | DOM, Node, `fs` |
| `apps/web` | browser | `schema`, `core`, `codecs`, `pdfjs-dist`, React/MUI | Node, `fs` |
| `apps/cli` | Node | `schema`, `core`, `codecs`, `fs` | DOM |
| `apps/worker` | Workers | `schema` (light validate only) | DOM, Node, `fs`, **PDF parsing** |
| `securepdf-run` (separate repo) | Node/container | `schema`, `core`, `codecs` + native bins | — |

The rule: `packages/*` stays runtime-neutral so the **same engine** runs in the
browser, the CLI, and Cloud Run. The Worker deliberately depends on **only the
light parts of `schema`** — it must never import the heavy `core` (that would risk
the bundle/CPU budget and defeats the free-tier guarantee).

## Data flow

**Local (browser, default):** GUI builds a plan from UI state →
`schema.validate` → `core.run` (with `codecs` for exotic images, `pdfjs-dist` for
preview) → download. Nothing leaves the device.

**Light Worker:** `capabilities` and `openapi.json` are static/generated;
`validate-plan` runs `schema.validate` against declared page counts (no bytes).

**Remote (proxy → Cloud Run):** client → Worker `/api/v1/organize` → Worker
streams `request.body` to `${CLOUD_RUN_URL}/organize` with the Cloud Run
credential → Cloud Run runs the **same `core`** (plus native tools for
Office/large/heavy) → response streamed back unchanged. The Worker never buffers
or parses the file.

## Build & deploy

- `pnpm -C apps/web build` → `apps/web/dist` (Vite).
- `wrangler deploy` bundles `apps/worker/src/index.ts` (tiny — no decoder WASM) and
  uploads `apps/web/dist` as assets. `CLOUD_RUN_URL` + the Cloud Run credential are
  Worker vars/secrets.
- `apps/cli` builds to a publishable npm package.
- `packages/{schema,core,codecs}` gain a build (JS + d.ts) when published for
  Cloud Run to consume (D12 / OQ3).

## Why this stays free

The Worker does only sub-millisecond work (JSON, plan validation, streaming
passthrough), so it lives inside the **10 ms CPU / 128 MB / 100 MB-body / 3 MB-
bundle** free limits (plan §8). All real compute is either in the browser (no
limits beyond the device) or on Cloud Run (32 GiB / 8 vCPU / 60 min).
