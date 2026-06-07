# Accessibility

**Target:** WCAG 2.2 AA, Lighthouse Accessibility ≥ 90.

securePDF's UI is a small surface: a top toolbar (icon buttons + number inputs +
an overflow `Menu`), a left **rail** (a list of page thumbnails + one insert
slot), a resizable seam, and a preview canvas. Several common patterns are
intentionally absent — see the inventory below.

## How accessibility is checked

| Layer | Tool | Command | Catches |
|---|---|---|---|
| Lint | `eslint-plugin-jsx-a11y` (**strict**) | `pnpm lint` | static JSX issues: missing labels, bad roles, `aria-*` misuse, non-semantic handlers |
| Unit | `axe-core` + Testing Library (happy-dom) | `pnpm test:a11y` (also in `pnpm test`) | structural regressions on the rendered App: labels, landmarks, list semantics, roles |
| Full page | Playwright + `axe-core` | manual (snippet below) | whole-document axe incl. contrast, against a real browser |
| Audit | Lighthouse | `npx lighthouse <url> --only-categories=accessibility` | the headline a11y score |
| Manual | keyboard + screen reader | checklist below | focus order/visibility, SR announcements, drag alternatives |

`color-contrast` is **disabled in the happy-dom unit test** (it needs real layout)
and is instead verified by Playwright/axe and Lighthouse.

### Full-page axe (Playwright)

```js
// against `pnpm dev:web` (http://localhost:5173)
const { chromium } = require('playwright')
const fs = require('fs')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173/')
await page.addScriptTag({ path: require.resolve('axe-core') })
const res = await page.evaluate(async () =>
  await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } }),
)
console.log(res.violations)
await browser.close()
```

### Lighthouse

```bash
pnpm dev:web &                     # or: pnpm build && pnpm -C apps/web preview
npx lighthouse http://localhost:5173 --only-categories=accessibility \
  --chrome-flags="--headless=new" --quiet --output=json --output-path=./lh-a11y.json
```

## WCAG 2.2 status (key criteria)

| SC | Level | Status | Where |
|---|---|---|---|
| 1.1.1 Non-text content | A | ✅ icon buttons have `aria-label`; canvases are labelled by their card/region | toolbar, PageCard, PreviewArea |
| 1.3.1 Info & relationships | A | ✅ landmarks (`header`/`main`/`aside`), `role="list"`/`listitem`, labelled inputs | App, ThumbnailRail |
| 1.4.3 Contrast (text) | AA | ✅ axe/Lighthouse clean | theme |
| 1.4.11 Non-text contrast | AA | ✅ focus ring `#1a73e8` (≥3:1 on white & dark) | `chrome.focusRing` |
| 2.1.1 Keyboard | A | ✅ all actions reachable; reorder via `Ctrl/Cmd+↑↓`; resize via arrows | useKeyboardShortcuts, ResizableDivider |
| 2.4.3 Focus order | A | ✅ logical tab order | — |
| 2.4.7 Focus visible | AA | ✅ `:focus-visible` rings on cards, slot, preview, divider, controls | — |
| **2.5.7 Dragging movements** | **AA (2.2)** | ✅ **per-card ▲/▼ move buttons** are a single-pointer alternative to drag reorder | PageCard, ThumbnailRail `movePage` |
| **2.5.8 Target size (min)** | **AA (2.2)** | ✅ targets ≥24px; resize seam keeps an 8px look but a 24px hit area | ResizableDivider |
| 2.3.3 Animation from interactions | AAA | ✅ `prefers-reduced-motion` reset (bonus) | theme `CssBaseline` |
| 3.3.2 Labels/instructions | A | ✅ every input named on the `<input>` via `slotProps.htmlInput` | toolbar fields |
| 4.1.2 Name, role, value | A | ✅ axe clean; statuses announced via `aria-live` | ThumbnailRail live region |
| 4.1.3 Status messages | AA | ✅ add/remove/reorder announced politely; errors are `role="alert"` | ThumbnailRail, task error Alert |

WCAG 2.2 additions not applicable here: 3.2.6 Consistent Help (no help mechanism),
3.3.7 Redundant Entry / 3.3.8 Accessible Authentication (no forms/auth).

## Component / pattern inventory

| Pattern | Present? | Notes |
|---|---|---|
| button | ✅ | MUI `IconButton`/`Button`; icon-only buttons always have `aria-label` |
| link | ✅ | only the skip link (`<a href="#main-preview">`) |
| input | ✅ | filename (text), page, zoom (number); labelled via `slotProps.htmlInput` |
| menu | ✅ | overflow `Menu` (MoreMenu) — MUI handles focus trap/roving/Esc/return focus |
| dialog / modal | ➖ | none (the Menu is the only overlay) |
| tab / toast / custom dropdown | ➖ | none — transient errors use an inline `Alert` (`role="alert"`) |
| list | ✅ | rail is `role="list"`; cards + insert slot are `role="listitem"` |
| images / icons | ✅ | MUI SVG icons inside labelled buttons; PDF rendered to `<canvas>` (labelled by card/region) |
| loading | ✅ | `CircularProgress` (MUI sets `role="progressbar"`); busy state shared via `useAsyncTask` |
| drag & drop | ✅ | dnd-kit pointer reorder **plus** keyboard (`Ctrl/Cmd+↑↓`) and pointer ▲/▼ buttons (2.5.7) |

## Keyboard map

| Keys | Action |
|---|---|
| `Tab` / `Shift+Tab` | move through toolbar → rail (cards + controls) → preview |
| `Ctrl/Cmd + A` | select all pages |
| `Delete` / `Backspace` | delete selection/active page (focus returns into the rail) |
| `R` / `Shift+R` | rotate right / left |
| `F` | flip |
| `↑` / `↓` | activate previous / next page (preview) |
| `Ctrl/Cmd + ↑` / `↓` | move the page (reorder) |
| `Ctrl/Cmd + +` / `-` / `0` | zoom in / out / reset |
| on the seam: `←` / `→`, `Home` / `End` | resize the thumbnail pane |
| ▲ / ▼ buttons on a card | move that page up / down (pointer alternative to dragging) |

## Manual review checklist (run before release)

- Tab through the whole UI: order is logical, focus ring always visible, nothing
  obscured behind the toolbar.
- Reorder a page three ways: drag, `Ctrl+↑↓`, and the ▲/▼ buttons.
- Delete a page via keyboard — focus lands on a neighbouring card, not `<body>`.
- Screen reader (VoiceOver/NVDA): rail announces "list, N items"; add/remove/move
  are announced; every control has a clear name.
- OS "reduce motion" on: drag/reflow/transitions are effectively instant.

## Residuals / out of scope

- Color-only secondary cues exist on toggle buttons (flip/select turn blue) but the
  primary state is always conveyed non-chromatically (mirrored thumbnail, filled
  check icon, elevation), so this is acceptable.
- Full screen-reader pass (VoiceOver/NVDA) is a manual gate, not automated.
- The insert slot is announced as a `listitem` (not `button`); activation still
  works via click/Enter. A richer "insert here" affordance is a possible follow-up.
