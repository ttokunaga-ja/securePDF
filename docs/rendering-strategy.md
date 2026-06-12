# Rendering strategy (SSR / CSR)

> TL;DR — securePDF's web UI is a **Vite + React 19 single-page app (SPA)**, served
> as static assets by a Cloudflare Worker. It is **100% client-rendered by design**.
> There is **no Next.js, no React Server Components, no `use client`, no SSR, and no
> router**. The `use client` / "Server Component vs Client Component" framing does
> not apply to this stack; this document explains why all-client is the correct
> choice here and how the equivalent _responsibility separation_ is achieved.

## What the stack actually is

| Concern | Reality |
|---|---|
| Framework | Vite 8 + `@vitejs/plugin-react`, React 19, MUI 6 |
| Rendering | Client-side only. `index.html` ships `<div id="root">` + a module script; React renders everything in the browser. |
| Routing | None — a single screen (the editor). No client/server router. |
| Server | A Cloudflare Worker serves the prebuilt static assets and a few light JSON endpoints; it does **not** render the UI. Heavy PDF ops stream-proxy to Cloud Run. |
| PDF engine | `@securepdf/core` (`@cantoo/pdf-lib`) runs **in the browser**, lazy-imported at the export/convert boundary (`lib/core.ts`). |

Because there is no server render step, **hydration mismatches are impossible by
construction** — there is no server HTML to reconcile.

## Why all-client is the right call (not a smell)

securePDF is a **client-first, privacy-preserving** tool: user PDFs are opened,
rendered, edited and exported **entirely in the browser** and never uploaded. The
core interactions depend on browser-only APIs:

- `File` / `FileReader` / drag-and-drop import
- `<canvas>` + **pdf.js** for thumbnail/preview rendering
- **@cantoo/pdf-lib** for page operations and export, `Blob` / object URLs for download/print

None of this can run on a server, and there is nothing meaningful to pre-render:
the value is the interactive editor, not indexable text. SSR would add a round
trip and a server runtime without improving first meaningful paint of a tool whose
first job is "let me open my file." SEO is intentionally low priority (utility app,
not content).

So the usual SSR wins — SEO, data-on-first-paint, TTFB for content — don't apply.
The usual CSR costs — JS to interactive, no-JS fallback — are accepted and
mitigated by code-splitting (below).

## The responsibility separation that _does_ apply

The SSR/CSR guidance maps onto an SPA as **"keep display-only components pure and
isolate state / browser work."** That is already the structure (see the 2026-06
decomposition in `REFACTORING_PLAN.md`):

- **Presentational / display-only** (the "Server-Component-like" units — pure props
  in, UI out, no app state): `PageThumbnail`, `PreviewPage`, `MainToolbar` and
  `toolbar/*` layout, `InitialDropZone`, the empty-state CTA, `ErrorBoundary`
  fallback. In an SPA these are just pure components; they need no directive.
- **Stateful logic, isolated** (legitimately client): the document **reducer**
  (`features/document/reducer.ts`), pure **selectors**, a two-context provider that
  limits re-renders, and hooks (`useAsyncTask`, `useFileImport`, `useFilePicker`,
  `usePdfExport`, `usePreviewZoom`, `useResizablePane`, `useKeyboardShortcuts`).
- **Browser-only work, confined** to hooks/`lib`: file import, pdf.js rendering,
  the engine (dynamically imported so viewing a PDF never loads `@cantoo/pdf-lib`).
- **Genuinely-CSR UI** per the project's own criteria: drag-and-drop reorder
  (dnd-kit), the overflow `Menu`, number inputs, zoom/resize, busy/error state —
  all require `useState`/`useRef`/`useEffect` or pointer/DOM APIs.

There are **no Client Components that should be Server Components** (no RSC at all),
and **no `use client` overuse** to trim (none exist). The relevant hygiene —
display components staying free of state and browser APIs — already holds.

## First load & SEO (the CSR cost, mitigated)

- Vendors are split into long-cacheable chunks (`react`, `mui`, `pdfjs`, `dnd`) via
  `vite.config.ts`; the engine is a separate on-demand chunk. App code is ~13 KB
  gzip; first load is ~290 KB gzip across cacheable chunks (pdf.js worker fetched
  as needed).
- `index.html` carries `lang`, `<title>`, `description`, `theme-color`, and a
  favicon, so crawlers/social cards get basic metadata even though the body is
  client-rendered.

## If SSR/SSG is ever wanted

It isn't needed for the tool itself, but if a marketing/landing or docs surface is
added later:

- Prerender a **static** landing page (e.g. `vite-plugin-ssg`/`vite-plugin-prerender`)
  or a separate SSG/MDX site — keep it **separate** from the editor SPA.
- Do **not** convert the editor to SSR: its work is browser-bound and SSR would buy
  nothing while adding a server runtime and hydration surface.

## Decision summary

| Unit | Rendering | Why |
|---|---|---|
| Editor screen (toolbar, rail, preview) | CSR | Browser APIs (File/canvas/pdf.js/pdf-lib), user interaction, local processing |
| Display components (thumbnail, preview, layout, empty state) | CSR, but **pure/stateless** | No state/browser API; pure props → UI |
| Reducer / selectors / hooks / dnd / menu / inputs | CSR | State, refs, effects, pointer/DOM |
| Static metadata (`index.html`) | Static | Crawler/social metadata in the first byte |
| Worker endpoints (capabilities, openapi, validate, proxy) | Server (Worker) | Light JSON / stream-proxy; **not** UI SSR |
