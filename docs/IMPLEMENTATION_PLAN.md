# securePDF Implementation Plan

## 1. Product Direction

securePDF is a PDF organization and To PDF conversion tool that runs as a
Cloudflare Pages project. The project should expose the same PDF capability
through three entry points:

- Browser GUI for human users.
- CLI for local automation and AI agents.
- OpenAPI-compatible HTTP API hosted by Cloudflare Pages Functions.

The core design principle is to avoid separate implementations for GUI, CLI,
and API. All entry points should generate or consume the same versioned
operation schema and call the same core engine where the runtime allows it.

The project does not require Cloud Run, a VPS, Lambda, or a separate backend.
Dynamic API behavior is expected to run inside Cloudflare Pages Functions.

## 2. Approved Initial Scope

### 2.1 PDF Organization

The first functional scope is PDF page organization:

- Merge PDFs.
- Split PDF by page range.
- Extract selected pages.
- Delete selected pages.
- Rotate selected pages.
- Reorder pages.
- Insert pages from another PDF.
- Insert images converted into PDF pages.

### 2.2 To PDF Conversion

The first conversion direction is input file to PDF only. PDF to Word, PDF to
image, OCR extraction, text extraction, and reverse conversion are out of
scope for the initial version.

Initial guaranteed formats:

- PDF input for organization and insertion.
- JPG / JPEG / JFIF.
- PNG.

Browser GUI extended formats:

- APNG.
- WebP.
- AVIF.
- GIF.
- BMP.
- ICO.
- TIFF.
- HEIC / HEIF.

API extended formats should be added only after Cloudflare runtime validation,
because Pages Functions do not provide DOM, Canvas, or browser image decoding.
Those formats need pure JavaScript or WASM decoders.

Deferred formats:

- DOCX, XLSX, PPTX.
- DOC, XLS, PPT.
- ODT, ODS, ODP.
- PSD, JP2, TGA, PCX, PNM.
- RAW photo formats.

Office document conversion is not an initial API requirement. It should be
treated as a separate feasibility track because LibreOffice-class conversion in
WASM may exceed practical Cloudflare Pages Functions limits.

## 3. Non-Goals

- No reverse conversion from PDF to Office, image, text, or HTML in the initial
  release.
- No OCR in the initial release.
- No AI summarization, translation, or chat over PDF in the initial release.
- No external conversion server.
- No persistent storage of uploaded files unless a later async job system
  explicitly introduces R2 with retention rules.
- No promise of perfect editing of existing PDF text content. Page-level
  organization and To PDF conversion are the primary scope.

## 4. Architecture

### 4.1 Package Layout

Recommended monorepo layout:

```text
securePDF/
  apps/
    web/              # Cloudflare Pages frontend
    cli/              # npm CLI package
  packages/
    core/             # Runtime-neutral PDF operation engine
    schema/           # Operation schema, validation, OpenAPI helpers
    codecs/           # Optional image/document decoders
  functions/
    api/
      v1/
        organize.ts   # Pages Functions endpoint
        convert.ts
        capabilities.ts
    openapi.json.ts
  docs/
    architecture.md
    api.md
    security.md
```

If starting smaller, use a single Vite app and split packages after the first
working prototype:

```text
securePDF/
  src/
    core/
    schema/
    web/
  functions/
  bin/
```

### 4.2 Shared Core

The core should be written as runtime-neutral TypeScript:

- Accept `ArrayBuffer`, `Uint8Array`, or `ReadableStream` where practical.
- Return binary PDF output plus structured warnings.
- Avoid browser-only APIs inside `packages/core`.
- Avoid Node-only APIs inside `packages/core`.
- Put browser-specific file handling in `apps/web`.
- Put CLI filesystem handling in `apps/cli`.
- Put request parsing in `functions/api`.

Core libraries:

- `pdf-lib` for merge, page copy, insert, delete, rotate, reorder, and image
  embedding.
- A qpdf WASM wrapper can be evaluated later for encrypted PDFs, repair,
  linearization, or compression.

### 4.3 Operation Schema

Use a versioned JSON schema as the stable contract across GUI, CLI, and API.

Example:

```json
{
  "version": "1",
  "inputs": [
    { "id": "a", "filename": "a.pdf", "type": "application/pdf" },
    { "id": "b", "filename": "b.pdf", "type": "application/pdf" }
  ],
  "operations": [
    { "op": "merge", "inputs": ["a", "b"] },
    { "op": "rotate", "pages": "2-4", "degrees": 90 },
    { "op": "delete", "pages": "7" }
  ],
  "output": {
    "format": "pdf",
    "filename": "output.pdf"
  }
}
```

Schema requirements:

- Include `version`.
- Use stable operation names.
- Validate page ranges before running operations.
- Validate input references before loading files.
- Return structured errors with machine-readable `code` fields.
- Support dry-run validation.

Suggested operation names:

- `merge`
- `split`
- `extract`
- `delete`
- `rotate`
- `reorder`
- `insertPdf`
- `insertImage`
- `convertToPdf`

## 5. Browser GUI Plan

The browser GUI should behave like a real document tool, not a landing page.
The first screen should be the working area.

Primary views:

- File import area.
- Page thumbnail grid.
- Selected-page toolbar.
- Operation queue or history.
- Output settings.
- Export button.
- Optional command preview showing equivalent CLI/API request.

Expected controls:

- Drag and drop files.
- Page selection by click, shift-click, and range input.
- Rotate left/right buttons.
- Delete button.
- Move before/after controls.
- Insert file action.
- Split/extract dialog.
- Merge order list.
- Download result.

Implementation notes:

- Use Web Workers for large PDF work where possible.
- Keep files in memory only unless the user explicitly saves/downloads.
- Do not use analytics, external fonts, or external CDN assets by default.
- Provide a visible capabilities panel that distinguishes browser support from
  API support.

## 6. CLI Plan

The CLI should be friendly to humans and AI agents.

Package goals:

- Publishable as an npm package later.
- Can run locally without network for supported local operations.
- Can call a configured securePDF API endpoint.
- Can print JSON results and structured errors.

Example commands:

```bash
securepdf capabilities --endpoint https://pdf.example.com

securepdf merge a.pdf b.pdf -o output.pdf

securepdf organize \
  --endpoint https://pdf.example.com \
  --input a=a.pdf \
  --input b=b.pdf \
  --plan plan.json \
  -o output.pdf

securepdf convert image.jpg --to pdf -o image.pdf
```

Agent-focused flags:

- `--json`
- `--dry-run`
- `--endpoint`
- `--api-key`
- `--no-network`
- `--max-file-size`
- `--timeout`

CLI output should never rely on prose only. Every command that may be used by
an agent should support a JSON result shape.

## 7. API Plan

### 7.1 Endpoints

Initial endpoints:

```http
GET  /api/v1/capabilities
GET  /openapi.json
POST /api/v1/organize
POST /api/v1/convert/to-pdf
POST /api/v1/validate-plan
```

Future async endpoints:

```http
POST   /api/v1/jobs
GET    /api/v1/jobs/:id
GET    /api/v1/jobs/:id/result
DELETE /api/v1/jobs/:id
```

The initial API should be synchronous and limited to small and medium files.
Async jobs should only be added if R2, Queues, or Workflows are introduced with
explicit retention and deletion rules.

### 7.2 Request Format

Use `multipart/form-data` for binary input plus a JSON operation plan.

Example:

```bash
curl -X POST https://pdf.example.com/api/v1/organize \
  -F 'plan={"version":"1","operations":[{"op":"merge","inputs":["a","b"]}],"output":{"format":"pdf"}};type=application/json' \
  -F 'a=@a.pdf;type=application/pdf' \
  -F 'b=@b.pdf;type=application/pdf' \
  -o output.pdf
```

Response modes:

- `application/pdf` for successful binary output.
- `application/json` for validation, dry-run, capabilities, and errors.

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_PAGE_RANGE",
    "message": "Page range 10-12 exceeds the 8-page document.",
    "details": {
      "input": "a",
      "pageCount": 8
    }
  }
}
```

### 7.3 API Authentication

Initial public demo:

- No account system.
- Strict file size limits.
- Strict operation limits.
- Rate limiting through Cloudflare controls if available.

Production API:

- API key header: `Authorization: Bearer <token>`.
- Optional Turnstile for browser-origin requests.
- No file persistence by default.
- Add request IDs for debugging.

## 8. Cloudflare Constraints To Validate

Before committing to each runtime feature, validate the current Cloudflare
limits from official documentation:

- Pages static asset size.
- Pages Functions compatibility with required packages.
- Worker script size.
- Worker memory.
- Request body size.
- CPU time and wall time.
- FormData parsing behavior for binary files.
- WASM module size and startup time.

Initial Cloudflare API compatibility matrix:

| Capability | Initial API | Browser GUI | Notes |
|---|---:|---:|---|
| PDF merge | Yes | Yes | `pdf-lib` |
| PDF split | Yes | Yes | `pdf-lib` |
| PDF extract | Yes | Yes | `pdf-lib` |
| PDF delete | Yes | Yes | `pdf-lib` |
| PDF rotate | Yes | Yes | `pdf-lib` |
| PDF reorder | Yes | Yes | `pdf-lib` |
| PDF insert PDF pages | Yes | Yes | `pdf-lib` |
| JPG/PNG to PDF | Yes | Yes | `pdf-lib` image embedding |
| WebP/AVIF/GIF/BMP to PDF | Validate | Yes | API requires decoder strategy |
| TIFF to PDF | Validate | Yes | Multipage handling required |
| HEIC/HEIF to PDF | Validate | Yes | WASM size risk |
| Office to PDF | No | Deferred | Separate feasibility track |

## 9. Security And Privacy Plan

Security goals:

- Do not persist uploaded files in the initial API.
- Do not log file contents.
- Do not log operation payloads if filenames may contain sensitive data.
- Enforce content-type and magic-byte validation.
- Enforce maximum file count, file size, page count, and output size.
- Return deterministic JSON errors.
- Keep parser failures isolated from the UI thread.
- Use dependency review for PDF/image parsing libraries.
- Add abuse limits before public API exposure.

Privacy messaging:

- Browser GUI can advertise local-only processing for browser-executed
  operations.
- API mode must clearly state that files are sent to the configured Cloudflare
  endpoint for processing.
- CLI must make endpoint use explicit and support `--no-network`.

## 10. Testing Plan

Unit tests:

- Page range parser.
- Operation schema validation.
- Merge operation.
- Split operation.
- Extract/delete/reorder behavior.
- Rotation metadata.
- Image to PDF page sizing.
- Error code stability.

Integration tests:

- Browser GUI import and export smoke test.
- CLI local operation smoke test.
- CLI endpoint operation smoke test.
- Pages Functions multipart request smoke test.
- `/openapi.json` schema validation.

Fixture files:

- 1-page PDF.
- 3-page PDF.
- Rotated PDF.
- Encrypted PDF.
- Corrupt PDF.
- Large-page-count PDF.
- JPG portrait and landscape.
- PNG with transparency.
- TIFF multipage when TIFF support is added.
- HEIC sample when HEIC support is added.

Manual verification:

- Compare page counts before and after each operation.
- Render output PDF thumbnails with PDF.js.
- Open output in at least one external PDF viewer.
- Test files with Japanese filenames.
- Test drag and drop and CLI paths containing spaces.

## 11. Milestones

### Milestone 0: Project Setup

- Initialize package manager and TypeScript.
- Add lint, format, and test commands.
- Add Cloudflare Pages build setup.
- Add basic CI.
- Add fixture directory.

### Milestone 1: Core Schema And PDF Organization

- Implement operation schema.
- Implement page range parser.
- Implement merge, split, extract, delete, rotate, reorder, and insert PDF.
- Add unit tests.

### Milestone 2: Browser GUI MVP

- Build file import.
- Build PDF thumbnail grid.
- Build page selection.
- Build organization toolbar.
- Build result download.
- Add equivalent command/API request preview.

### Milestone 3: CLI MVP

- Add local CLI commands.
- Add `--json`, `--dry-run`, and `--no-network`.
- Add endpoint mode for API requests.
- Add structured error handling.

### Milestone 4: Pages Functions API MVP

- Add `/api/v1/capabilities`.
- Add `/api/v1/validate-plan`.
- Add `/api/v1/organize`.
- Add `/api/v1/convert/to-pdf` for JPG and PNG.
- Add `/openapi.json`.
- Add Cloudflare runtime tests.

### Milestone 5: Extended Image Conversion

- Add browser support for WebP, AVIF, GIF, BMP, ICO.
- Add TIFF browser support.
- Add HEIC/HEIF browser support if decoder size is acceptable.
- Validate which extended formats can safely run inside Pages Functions.

### Milestone 6: Production Hardening

- Add API keys.
- Add rate limits.
- Add size/page/output limits.
- Add dependency audit workflow.
- Add public documentation.
- Add examples for curl, OpenAPI clients, and AI agents.

### Milestone 7: Feasibility Tracks

- Evaluate qpdf WASM for encrypted PDFs, repair, and compression.
- Evaluate Office to PDF conversion feasibility.
- Evaluate async jobs with R2 retention if synchronous API limits are not
  enough.

## 12. Immediate Next Steps

1. Initialize the repo with TypeScript, Vite, and Cloudflare Pages-compatible
   tooling.
2. Create `packages/schema` with the first operation schema and validator.
3. Create `packages/core` with `pdf-lib` organization primitives.
4. Add fixture PDFs and unit tests.
5. Build a minimal GUI that imports two PDFs, merges them, and downloads the
   result.
6. Add `/api/v1/capabilities` before any mutating API endpoint.
7. Add CLI `securepdf capabilities` and `securepdf merge` as the first CLI
   commands.

