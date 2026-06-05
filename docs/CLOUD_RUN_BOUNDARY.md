# securePDF ↔ Cloud Run — Boundary Contract

This repository (**securePDF**) runs **entirely on the Cloudflare free tier**.
Anything that cannot run there is implemented in a **separate Cloud Run repo**
(referred to here as `securepdf-run`, not yet created). This document is the
contract between the two so the Cloud Run repo can be built independently without
guessing.

## Two tiers

```text
┌──────────────── securePDF (this repo · Cloudflare free) ─────────────────┐
│                                                                          │
│  Static Assets ───────▶  SPA (apps/web)  ──▶ in-browser PDF engine       │
│                                              (@securepdf/core + codecs    │
│                                               + pdfjs-dist), local-first  │
│                                                                          │
│  Worker (apps/worker, free: 10 ms CPU, 100 MB body, 100k req/day)        │
│    GET  /api/v1/capabilities   ── light, served here                     │
│    GET  /openapi.json          ── light, served here                     │
│    POST /api/v1/validate-plan  ── light (schema + declared counts)       │
│    POST /api/v1/organize       ── PROXY ─┐                               │
│    POST /api/v1/convert/to-pdf ── PROXY ─┤ stream body through,          │
│    (future) /api/v1/jobs/*     ── PROXY ─┘ attach auth                   │
│                                            │                             │
└────────────────────────────────────────────┼─────────────────────────────┘
                                              │ CLOUD_RUN_URL (private)
                                              ▼
┌──────────────── securepdf-run (separate repo · Google Cloud Run) ────────┐
│  Heavy PDF API: up to 32 GiB RAM / 8 vCPU / 60 min                        │
│  REUSES @securepdf/core + schema + codecs  (same engine, no drift)       │
│  ADDS native tools: LibreOffice / qpdf / Ghostscript / ImageMagick       │
│  Implements: organize on large files, convert/to-pdf (all formats),      │
│              Office→PDF, heavy compress / repair / linearize             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Responsibility split

| Capability | securePDF (browser) | securePDF (Worker) | Cloud Run |
|---|:--:|:--:|:--:|
| Serve SPA / OpenAPI | — | ✅ | — |
| `capabilities` / `validate-plan` | — | ✅ light | — |
| Organize (merge/split/…) small/medium | ✅ local | proxy | ✅ |
| Organize on **large** PDFs (>128 MB-class) | ✋ memory | proxy | ✅ |
| To-PDF: JPG/PNG | ✅ local | proxy | ✅ |
| To-PDF: WebP/AVIF/TIFF/BMP/ICO/GIF/HEIC | ✅ local | proxy | ✅ |
| **Office→PDF** (docx/xlsx/pptx, …) | ✋ | proxy | ✅ LibreOffice |
| Heavy **compress / repair / linearize** | ✋ | proxy | ✅ qpdf/Ghostscript |
| Rasterize / flatten (if added later) | ✋ | proxy | ✅ Ghostscript/ImageMagick |

`✋` = not feasible there. The browser is the **default** for everything it can
do; the Worker proxy + Cloud Run is the path for the rest and for headless
CLI/agent use.

## The proxy contract (Worker → Cloud Run)

- **Endpoints proxied:** `POST /api/v1/organize`, `POST /api/v1/convert/to-pdf`,
  and future `/api/v1/jobs/*`. The Worker maps `…/api/v1/X` → `${CLOUD_RUN_URL}/X`.
- **Passthrough:** the Worker streams the incoming `multipart/form-data` body
  straight into the subrequest (`body: request.body`), copies the relevant
  request headers, and streams the response (PDF / ZIP / JSON) back unmodified. It
  **must not buffer or parse** the file bytes (that would blow the 10 ms CPU /
  128 MB limits) — only header/size/path checks.
- **Request shape:** identical to the in-repo API ([`api.md`](./api.md)) — a JSON
  `plan` part (the operation schema) plus binary input parts. Cloud Run validates
  with the **same** `@securepdf/schema`.
- **Response shape:** identical — `application/pdf`, `application/zip`, or the
  JSON error envelope with stable `code`s.
- **Auth:** the Worker injects the Cloud Run credential (OQ1: GCP ID token vs
  shared secret). Clients authenticate to the **Worker**; Cloud Run is **private**
  and rejects anything without the credential.
- **Size limit:** the free Worker inbound body limit (**100 MB**) caps proxied
  uploads. Cloud Run itself accepts more (HTTP/2 has no 32 MiB request cap), so
  files > 100 MB need a future direct/signed-URL path (OQ2).
- **Backend unset:** if `CLOUD_RUN_URL` is not configured, the proxied endpoints
  return `503 { code: "BACKEND_NOT_CONFIGURED" }` and `capabilities` lists
  `remote: { available: false }`. securePDF is fully usable without Cloud Run
  (browser + light Worker still work).

## The code-sharing contract (Cloud Run → securePDF packages)

- Cloud Run **depends on** `@securepdf/schema`, `@securepdf/core`, and (when
  needed) `@securepdf/codecs`, published from this repo (OQ3). It MUST NOT fork
  the operation schema or the organize engine — same code, same behavior.
- Cloud Run implements only the **heavy differential** on top of `core`:
  - route large/Office/heavy requests to native tools;
  - everything `core` already does is delegated to `core` (one code path).
- New operations or schema fields are added **here first** (schema is the source
  of truth and generates `/openapi.json`), then consumed by Cloud Run.
- Error `code`s are shared and stable (see [`api.md`](./api.md)); Cloud Run adds
  only codes for its native-tool failures (e.g. `OFFICE_CONVERT_FAILED`).

## What is explicitly NOT in this repo

- The Cloud Run service code, its Dockerfile, GCP IaC, IAM, Artifact Registry, and
  deployment — all live in `securepdf-run`.
- Native binaries (LibreOffice/qpdf/Ghostscript/ImageMagick) — bundled in the
  Cloud Run container only; never shipped to Cloudflare.
- Reverse conversion (PDF→Office/image/text) and OCR remain **non-goals** for the
  initial release in *both* repos.

## Capabilities advertisement

`GET /api/v1/capabilities` reflects the split so clients negotiate correctly:

```json
{
  "version": "1",
  "local": {
    "operations": ["merge","split","extract","delete","rotate","reorder","insertPdf","insertImage","convertToPdf"],
    "inputFormats": ["application/pdf","image/jpeg","image/png"]
  },
  "remote": {
    "available": true,
    "via": "cloud-run",
    "adds": ["office-to-pdf","large-files","compress","repair"],
    "maxInputBytes": 104857600
  }
}
```

When `remote.available` is `false`, clients fall back to local (browser) or report
that server-side features are unconfigured.
