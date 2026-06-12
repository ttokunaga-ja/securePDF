# securePDF — Security & Privacy

Companion to [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §9. Threat model
plus the controls checklist to satisfy before public exposure.

## Trust model

- **Inputs are untrusted.** PDFs and images come from anyone; parsing them is the
  main attack surface.
- **GUI is client-first.** Browser-executed operations never leave the device —
  the strongest privacy position, and the default.
- **The Worker is a parse-free proxy** (Cloudflare free tier): it serves light
  JSON and *streams* heavy requests to Cloud Run, never parsing file bytes.
  Server-side file parsing — and the parsing-related controls below — run on
  **Cloud Run**; the browser parses for client-side operations.

## Threats → controls

| Threat | Control |
|---|---|
| Malicious/decompression-bomb PDF (memory/CPU exhaustion) | Enforce input-size, **page-count**, object-count, and output-size caps **where files are parsed** (browser; Cloud Run against its memory budget); fail closed. The Worker proxy never parses, so it can't be bombed. |
| Type confusion / disguised upload | **Magic-byte allowlist** (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, …) + content-type check; reject mismatches. |
| `Content-Disposition` header injection via filename | Sanitize output filename; encode non-ASCII with `filename*=UTF-8''…` (RFC 5987). |
| Zip-slip in multi-output archives | Sanitize zip entry names (no `..`, no absolute paths). |
| SSRF | **No remote/URL inputs** — uploads only (explicit non-goal). |
| Data exfiltration via logs | Never log file contents or payloads (filenames may be sensitive); log only `requestId` + coarse metadata. |
| Persistence leakage | **No storage** of uploads in the initial API; in-memory only. |
| Abuse / DoS | Rate limiting (Cloudflare), API keys, optional Turnstile for browser origin, fail-closed caps. |
| Supply chain (parser libs) | Pin versions; dependency-audit workflow in CI; review `@cantoo/pdf-lib`, `@jsquash/*`, `utif2`, `libheif-js`. |
| UI-thread stalls from parser | Parser work off the main thread (GUI Web Worker). The Cloudflare Worker does no parsing; heavy parsing is isolated on Cloud Run. |
| Encrypted-PDF mishandling | Defined behavior via `@cantoo/pdf-lib`: decrypt only with supplied password, else `ENCRYPTED_PDF`; never silently emit garbage. |

## Privacy messaging (must be accurate in-product)

- **GUI:** "Files are processed in your browser and are not uploaded" — true for
  browser-executed operations; state clearly which operations run locally.
- **API:** files are sent to the Worker and, for heavy operations, **proxied to
  Cloud Run** for processing; not stored on either.
- **CLI:** endpoint use is explicit; `--no-network` guarantees local-only.

## Pre-exposure checklist

- [ ] Magic-byte + content-type validation on every input.
- [ ] Enforced caps: input bytes, file count, page count, output bytes.
- [ ] Decompression-bomb / object-graph guards.
- [ ] Filename sanitization + RFC 5987 `Content-Disposition`.
- [ ] Zip entry-name sanitization.
- [ ] No payload/content logging; `requestId` only.
- [ ] API key auth; rate limiting; optional Turnstile.
- [ ] Worker proxy stays parse-free and streaming (free-tier safe); Cloud Run
      memory/CPU headroom load-tested against the caps.
- [ ] Dependency audit green; versions pinned.
- [ ] HEVC/HEIC patent-licensing review **before** any hosted HEIC decode.
