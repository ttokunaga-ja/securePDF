# Office → PDF conversion (Google Apps Script backend)

securePDF converts **docx / xlsx / pptx** (and legacy doc/xls/ppt) to PDF using a
**Google Apps Script (GAS) Web App** that wraps Google Drive's conversion engine.
It fills the "Office→PDF needs a backend" slot from
[`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md) for free, with no server to run.

## Flow

```text
Browser (apps/web)                Cloudflare Worker            Google Apps Script
  read Office file
  base64 + POST JSON  ─────▶  POST /api/v1/convert/office
  {mimeType,filename,           forward body to
   fileBase64}                  GAS_CONVERT_URL?token=GAS_TOKEN ─────▶  doPost
                                (server-to-server, no CORS)            Drive: Office→Google→PDF
  decode pdfBase64  ◀─────  stream JSON back  ◀──────────────────  {ok,filename,pdfBase64}
  render as a PDF
```

- The browser never parses Office bytes; it only base64-encodes the input and
  decodes the returned PDF (`apps/web/src/lib/importFile.ts`).
- The Worker is a **thin server-to-server proxy** (`/api/v1/convert/office`): it
  appends `?token=` and forwards the small JSON body. This sidesteps GAS's CORS
  limitations (a browser can't reliably read a GAS response cross-origin).
- GAS converts via Drive and returns base64 PDF (`tools/gas/Code.gs`).

## Deploy the GAS Web App

1. Create a project at <https://script.google.com> → paste `tools/gas/Code.gs`;
   set the manifest to `tools/gas/appsscript.json` (or add the Drive advanced
   service + Web App settings manually).
2. **Services (+) → Drive API** (advanced service, identifier `Drive`, v3).
3. **Project Settings → Script properties** → add `SHARED_SECRET` = a long random
   string.
4. **Deploy → New deployment → Web app**: _Execute as_ **Me**, _Who has access_
   **Anyone**. Authorize the Drive scope when prompted. Copy the `/exec` URL.

### Wire it into Cloudflare

```bash
# the deployment /exec URL and the SHARED_SECRET from above
wrangler secret put GAS_CONVERT_URL   # paste the /exec URL
wrangler secret put GAS_TOKEN         # paste the SHARED_SECRET
```

(`GAS_CONVERT_URL` and `GAS_TOKEN` are Worker **secrets** — `wrangler.jsonc`
declares no matching `var` on purpose, since a same-named var would conflict with
the secret. When unset, `/api/v1/convert/office` returns
`503 BACKEND_NOT_CONFIGURED` and `capabilities` reports `office-to-pdf` absent.)

Optional (CLI deploy of the script): use [`clasp`](https://github.com/google/clasp)
— `clasp create --type webapp`, `clasp push`, `clasp deploy`.

## Security & privacy

- **Auth:** the Web App is public ("Anyone"), so a **shared secret** (`?token=`,
  checked against `SHARED_SECRET`) gates it. The browser never sees the token —
  the Worker injects it.
- **Privacy:** Office conversion is inherently non-local. With GAS, the file
  briefly becomes a temp file in the **deploying user's Google Drive**, deleted
  immediately after export. Surface this to users; PDFs/images still stay 100%
  in-browser. This is the documented trade-off for Office support.

## Limits (Drive/GAS quotas)

| Limit | Value | Implication |
|---|---|---|
| Execution time | 6 min / call | huge files fail; typical Office is seconds |
| URLFetch/day | 20k (gmail) / 100k (Workspace) | high traffic can exhaust quota |
| Payload / response | ~50 MB (base64 +33%) | safe for inputs up to ~30 MB |
| Drive conversion | daily quota + throttling | not for bursty high volume |

For higher fidelity/scale later, swap the backend for **Gotenberg / LibreOffice on
Cloud Run** — same Worker contract, just change `GAS_CONVERT_URL` (or route by
size). See `CLOUD_RUN_BOUNDARY.md`.

## Errors

`{ ok:false, code, message }` with codes: `UNAUTHORIZED`, `UNSUPPORTED_FORMAT`,
`OFFICE_CONVERT_FAILED` (plus the Worker's `BACKEND_NOT_CONFIGURED` /
`BACKEND_UNAVAILABLE`).
