# securePDF — HTTP API (v1)

Companion to [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §7 and the
[`CLOUD_RUN_BOUNDARY.md`](./CLOUD_RUN_BOUNDARY.md). The API is one surface on the
Cloudflare Worker: **light** endpoints are served by the Worker on the free tier;
**heavy** endpoints are **streamed through (proxied)** to the Cloud Run backend.
`/openapi.json` is generated from `packages/schema` — this page is the
human-readable mirror.

Base path: `/api/v1`, same origin as the GUI.

## Endpoints

| Method | Path | Served by | Body | Success response |
|---|---|---|---|---|
| GET | `/api/v1/capabilities` | Worker (light) | — | `application/json` |
| GET | `/openapi.json` | Worker (light) | — | `application/json` (OpenAPI 3.1) |
| POST | `/api/v1/validate-plan` | Worker (light) | multipart (`plan` [+ metadata]) | `application/json` |
| POST | `/api/v1/organize` | **proxy → Cloud Run** | multipart (`plan` + inputs) | `application/pdf` or `application/zip` |
| POST | `/api/v1/convert/to-pdf` | **proxy → Cloud Run** | multipart (`plan` + image/Office inputs) | `application/pdf` |

`validate-plan` is **light by design**: it validates the plan structure and page
ranges against **declared** input page counts (sent as metadata) and never parses
PDF bytes, so it stays under the 10 ms free CPU limit. Range checks against
*actual* page counts happen where files are parsed (browser or Cloud Run).

## Request shape (multipart/form-data)

- `plan` part: `application/json`, the operation schema (plan §4.3).
- one part per input id (`a`, `b`, …): the binary file with its real
  `Content-Type`.

```bash
curl -X POST https://pdf.example.com/api/v1/organize \
  -H 'Authorization: Bearer <token>' \
  -F 'plan={"version":"1","operations":[{"op":"merge","inputs":["a","b"]}],"output":{"format":"pdf"}};type=application/json' \
  -F 'a=@a.pdf;type=application/pdf' \
  -F 'b=@b.pdf;type=application/pdf' \
  -o output.pdf
```

The client sends this to the **Worker**; for `organize`/`convert` the Worker
streams it to `${CLOUD_RUN_URL}/organize` (etc.), attaches the Cloud Run
credential, and streams the response back. Same request/response shape either way.

## The proxy (heavy endpoints)

- Worker maps `…/api/v1/X` → `${CLOUD_RUN_URL}/X`, passing `request.body` straight
  into the subrequest (no buffering, no parsing) and copying relevant headers.
- **Auth:** clients authenticate to the Worker; the Worker injects the Cloud Run
  credential. Cloud Run is **private**.
- **Size:** proxied uploads are capped at the **free Worker inbound limit
  (100 MB)**; larger needs a future direct/signed-URL path.
- **Backend unset:** if `CLOUD_RUN_URL` is not configured →
  `503 { "ok": false, "error": { "code": "BACKEND_NOT_CONFIGURED" } }`.

## Responses

- `application/pdf` — single binary; `Content-Disposition` filename sanitized,
  non-ASCII via `filename*=UTF-8''…` (RFC 5987).
- `application/zip` — multi-output (split/extract, `output.container: "zip"`); zip
  entry names sanitized (no `..`, no absolute paths).
- `application/json` — capabilities / dry-run / errors; every JSON response
  carries `requestId`.

### Error envelope

```json
{
  "ok": false,
  "requestId": "req_…",
  "error": {
    "code": "INVALID_PAGE_RANGE",
    "message": "Page range 10-12 exceeds the 8-page document.",
    "details": { "input": "a", "pageCount": 8 }
  }
}
```

### Error codes (stable; extend, don't renumber)

| Code | HTTP | Origin | Meaning |
|---|---|---|---|
| `INVALID_PLAN` | 400 | Worker/CR | Plan failed schema validation |
| `UNKNOWN_OPERATION` | 400 | Worker/CR | Op not in this version |
| `INVALID_PAGE_RANGE` | 400 | Worker/CR | Range out of bounds / unparsable |
| `MISSING_INPUT` | 400 | CR | Plan references an input not provided |
| `UNSUPPORTED_FORMAT` | 415 | CR | Input type not supported |
| `FILE_TOO_LARGE` | 413 | Worker/CR | Exceeds enforced input cap (Worker: 100 MB) |
| `PAGE_LIMIT_EXCEEDED` | 422 | CR | Exceeds enforced page cap |
| `OUTPUT_TOO_LARGE` | 422 | CR | Result exceeds enforced output cap |
| `ENCRYPTED_PDF` | 422 | CR | Encrypted input without/with wrong password |
| `CORRUPT_PDF` | 422 | CR | Input could not be parsed |
| `OFFICE_CONVERT_FAILED` | 422 | CR | LibreOffice conversion failed |
| `BACKEND_NOT_CONFIGURED` | 503 | Worker | Heavy endpoint hit but `CLOUD_RUN_URL` unset |
| `BACKEND_UNAVAILABLE` | 502 | Worker | Cloud Run unreachable / errored upstream |
| `UNAUTHORIZED` | 401 | Worker | Missing/invalid API key |
| `RATE_LIMITED` | 429 | Worker | Abuse control tripped |
| `INTERNAL` | 500 | Worker/CR | Unexpected failure (no payload leaked) |

"Origin": `Worker` = produced on Cloudflare; `CR` = produced by Cloud Run and
passed through; `Worker/CR` = either, depending on where the work ran.

## Capabilities descriptor

Reflects the local/remote split so clients negotiate correctly:

```json
{
  "version": "1",
  "local": {
    "operations": ["merge","split","extract","delete","rotate","flip","reorder","insertPdf","insertImage","convertToPdf"],
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

When `remote.available` is `false` (no `CLOUD_RUN_URL`), clients fall back to local
(browser) processing or report that server-side features are unconfigured. GUI and
CLI read `capabilities` before building a plan so they never send unsupported work.
