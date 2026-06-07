# securePDF Refactoring & Optimization (2026-06)

> A large, behaviour-preserving refactor of the repo: the browser GUI was
> decomposed from a 1334-line monolith into a reducer-backed, component-based
> architecture; the bundle was code-split; and the tooling, tests and docs were
> tightened. Every phase kept `pnpm check` (lint → typecheck → test → build)
> green. This document records what changed and the remaining follow-ups.

## Context

`apps/web/src/App.tsx` had grown to **1334 lines / 30 hooks** in one component,
mixing state, keyboard handling, three drag-and-drop flows, file import, the
entire toolbar UI, the thumbnail grid, the preview, and export/print. The web
bundle shipped as a single **1.46 MB** chunk (gzip 512 KB) with no code-splitting,
eagerly loading `@cantoo/pdf-lib` even just to view a PDF. There was no theme,
i18n layer, or error boundary; drag-and-drop MIME strings and constants were
duplicated; and several docs had drifted from the implementation (the `flip`
operation was undocumented, the test count was stale, a Workers test-runtime was
claimed but unused). Engine, schema and worker packages were already clean.

The goal: make the GUI maintainable and testable, shrink first load, and close
the tooling/test/doc gaps — **without changing behaviour** (verified in-browser).

## What changed

### 1. Browser GUI decomposition (zero new runtime deps)

- **State → reducer.** `features/document/` holds the working-document state
  machine: `reducer.ts` (all page ops + a `reconcile` invariant pass that
  replaced the old `useEffect([pages])`), `selectors.ts`, `types.ts`, and a
  two-context provider (`DocumentContext.tsx`, state + stable actions) to limit
  re-renders. `resolveTargets` (selection-or-active) is a pure, tested helper.
- **Hooks.** UI concerns split into `hooks/{useKeyboardShortcuts,useResizablePane,
  usePreviewZoom}` and `features/document/hooks/{useAsyncTask,useFileImport,
  useFilePicker,usePdfExport}` (one shared busy/error channel).
- **Components.** `App.tsx` is now a **~110-line shell**. The toolbar lives in
  `components/MainToolbar.tsx` + `components/toolbar/*` (SelectionActions,
  FilenameField, PageNavigator, ZoomControl, ExportActions, MoreMenu,
  ToolbarIconButton); the workspace in `ThumbnailRail`, `PreviewArea`,
  `InsertSlot`, `ResizableDivider`, `InitialDropZone`.
- **Infrastructure.** `app/theme.ts` (MUI theme + `chrome` tokens; ~44 colour
  literals centralised; `primary.main` unified to the `#8ab4f8` accent),
  `app/ErrorBoundary.tsx`, and a zero-dependency i18n catalog (`app/i18n/`,
  `messages.ja.ts` + a typed `t()`). `main.tsx` composes the providers.
- **Shared utilities.** `lib/{dnd,filename,export,math,constants,core}.ts` removed
  the duplicated MIME strings (7 sites), `CLICK_MOVE_THRESHOLD`, and inline pure
  functions.

### 2. Bundle optimization

- `lib/core.ts` lazily imports `@securepdf/core` (and thus `@cantoo/pdf-lib`) at
  the single export/image-import boundary, so viewing a PDF never loads the engine.
- `vite.config.ts` splits vendors via Rolldown `codeSplitting.groups`
  (react / mui / pdfjs).
- **Result:** first-load JS went from **gzip 512 KB (one chunk)** to **~275 KB
  across cacheable chunks** (app code itself is **11 KB**); the **247 KB** engine
  chunk is fetched on demand. Worker bundle stays ~5 KB gzip (well under the 3 MB
  free-tier cap; verified with `wrangler deploy --dry-run`).

### 3. Tooling

- ESLint: added `react-hooks` (v7), `jsx-a11y`, `simple-import-sort`, and
  `eslint-config-prettier`. The new `react-hooks` rules surfaced three real
  patterns (ref-write/setState during render), fixed per React 19 guidance.
- TS strict: added `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `verbatimModuleSyntax`, and `noUncheckedIndexedAccess` to `tsconfig.base.json`
  (the last as a follow-up pass — ~92 index-access sites fixed with guards and a
  typed test helper, not blanket `!`).

### 4. Tests & fixtures

- Vitest **projects** split `node` (engine/CLI/Worker) from `happy-dom` (React),
  with v8 **coverage** (`pnpm coverage`). Added `@testing-library/*` (dev only).
- New tests: document **reducer** (19) + **selectors**, `lib/{filename,dnd}`,
  `usePreviewZoom`, a `SelectionActions` render test, **Worker proxy** success /
  route-mapping / 502 paths, **CLI** `parseArgs` + `main`, and an OpenAPI↔
  `OPERATION_NAMES` drift guard. Test count **57 → 112**; reducer ~94 %,
  selectors/buildPlan 100 %, worker ~89 %.
- `scripts/gen-fixtures.mjs` (`pnpm gen:fixtures`) deterministically builds the
  synthetic `fixtures/` (1/3-page, rotated, corrupt PDFs; 1px PNG/JPG).

### 5. OpenAPI, docs, CI

- `openapi.ts` now emits a full per-operation `oneOf` (mirrors `validate.ts`),
  built from `OPERATION_NAMES`; convert/to-pdf gained its multipart body.
- Docs: documented `flip`; replaced the hard-coded "53 tests"; corrected the
  Workers-runtime test claim.
- CI: `concurrency` cancellation, `node-version-file`, `pnpm coverage`, and
  `wrangler deploy --dry-run`.

## Directory shape (apps/web/src)

```text
app/        App shell theme, ErrorBoundary, i18n
features/document/   reducer, selectors, context, types + document hooks
hooks/      useKeyboardShortcuts, useResizablePane, usePreviewZoom
components/  MainToolbar (+ toolbar/*), ThumbnailRail, PreviewArea, InsertSlot,
             ResizableDivider, InitialDropZone, PageCard, PageThumbnail, PreviewPage
lib/        buildPlan, importFile, pdf, core, dnd, reorder, filename, export, math,
             constants
```

## Verification

- `pnpm check` green (lint, 6-project typecheck, 112 tests, build).
- In-browser smoke (Vite dev): empty state; import a 3-page PDF (lazy engine +
  pdf.js render); page navigation; zoom (100 → 120 %); Ctrl+A + Delete clears all
  pages — i.e. the keyboard → reducer → context path works end-to-end.

## Page reordering (dnd-kit) — 2026-06 follow-up

The thumbnail rail's page reordering was rebuilt on **@dnd-kit** (`core`,
`sortable`, `utilities`, `modifiers`) — the repo's first runtime DnD dependency.
The old hand-rolled HTML5 drag let you drop a page only _onto_ a card (always
"before" it): inserting between two pages was fiddly and **moving a page to the
very end was impossible**, with no live feedback beyond a border highlight.

- **One sortable rail.** `ThumbnailRail` builds a single combined list — the page
  cards _and_ the insert slot — inside `DndContext` + `SortableContext` (vertical
  strategy; `PointerSensor` with a 6 px activation distance;
  `restrictToVerticalAxis`). The same gesture moves a page, a multi-selection, or
  the insert slot; the list reflows live and drops into any gap, including the end.
  The slot is a first-class item (its own `INSERT_SLOT_ID`), so it is never hidden
  mid-drag and moves exactly like a page — replacing the old separate native
  insert-slot drag.
- **Pure rail mapping.** `lib/reorder.ts` (`reorderRail`, unit-tested) resolves a
  drop against the combined id list and returns the new page order plus the slot's
  new index, applied atomically by the reducer's `REORDER` action.
- **Multi-select drag + overlay.** Grabbing a selected card drags the whole
  selection; a `DragOverlay` shows the real thumbnail (or the dashed slot) with an
  "N枚" badge while the moving items dim in place. Canvas rendering was extracted to
  `PageThumbnail`, shared by the card and the overlay.
- **Native drags kept (file import only).** OS file import stays native
  (`InitialDropZone`, and dropping/clicking the `InsertSlot`); `dnd.ts` is now just
  `hasFileTransfer`. Keyboard reordering (`Ctrl/Cmd+↑↓`) is unchanged.
- **Bundle.** dnd-kit is isolated in its own cacheable `dnd` chunk (~15 KB gzip)
  via `vite.config.ts`, keeping the app chunk at ~12 KB gzip.
- **Verified in-browser with real pointer input** (Vite dev, 3-page PDF):
  drag-to-end, insert-between, dragging the slot itself, a page crossing the slot,
  and click-to-import all behave correctly (rail order asserted via `data-page-key`
  / the slot's label). Note: synthetic `dispatchEvent` drags can false-pass —
  dnd-kit must be exercised with real mouse input.

## Accessibility & UX pass — 2026-06 follow-up

A focused audit (static review + axe-core 4.10 + keyboard/screen-reader checks)
drove the following. axe now reports **0 WCAG 2.1 A/AA violations** (was 1
critical — unlabeled inputs); each item was verified in-browser with real pointer
and keyboard input.

- **Form labels (was critical).** The three toolbar inputs (filename, page, zoom)
  now name the actual `<input>` via `slotProps.htmlInput` — `aria-label` on a MUI
  `TextField` only labels the wrapper `div`, leaving the input nameless.
- **Focus contrast.** A new `chrome.focusRing` (#1a73e8) replaces the `accent`
  focus outline on white surfaces (cards, insert slot, preview, divider): ~1.8:1
  → ≥4:1 (WCAG 2.4.11).
- **List semantics.** The rail is a labeled `role="list"`; page cards and the
  insert slot are `role="listitem"`.
- **Status + focus.** A visually-hidden `aria-live="polite"` region in the rail
  announces add/remove/reorder, and focus is restored into the rail after a delete
  so keyboard users aren't dropped onto `<body>`.
- **Reduced motion.** A `prefers-reduced-motion` `CssBaseline` reset near-disables
  transitions/animations (MUI, dnd-kit reflow, and our own).
- **Keyboard + touch resize.** `ResizableDivider` is a focusable ARIA separator
  (←/→, Home/End, `aria-valuenow/min/max`) and uses pointer events (touch).
- **Reorder discoverability / touch.** Cards expose `aria-keyshortcuts` for the
  existing `Ctrl/Cmd+↑↓` move; card controls show without hover via
  `@media (hover: none)`.
- **Shell.** Visually-hidden `<h1>`, a skip link to `#main-preview`, a labeled
  `<main>`, and a labeled hidden file input.
- **Empty state.** The preview shows a persistent call to action (open files)
  instead of a blank canvas.
- **Polish.** PageCard/rail strings moved into the typed i18n catalog (the
  `card.*` keys were defined but unused); added `public/favicon.svg`, plus
  `description` / `theme-color` meta.

## Recommended follow-ups (not done here)

1. **`@cloudflare/vitest-pool-workers`** — run the Worker tests on the real
   Workers runtime (Miniflare is already in the tree); today they run on Node.
2. **Playwright E2E** — a separate CI job for an import→export smoke and a
   theme-migration screenshot baseline.
3. **OpenAPI validation in CI** — assert `/openapi.json` is valid 3.1 (e.g.
   `@apidevtools/swagger-parser`).
4. **Capabilities single-source** — `api.md` and `CLOUD_RUN_BOUNDARY.md` still
   duplicate the capability JSON; collapse to one with a cross-reference.
5. **`PLAN_AUDIT.md`** — mark explicitly historical (it audits the pre-v3 plan).
6. **i18n** — the catalog is JA-only by design; if EN is needed, the typed `t()`
   keys make adding a sibling catalog mechanical.
```
