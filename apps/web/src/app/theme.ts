import { createTheme } from '@mui/material/styles'

// The workspace mimics a desktop PDF viewer: a dark chrome toolbar and a grey
// canvas around light page thumbnails. Those chrome colours aren't part of MUI's
// semantic palette, so they live here as named tokens — the single source the
// chrome components import, replacing the colour literals once scattered across
// App.tsx and PageCard.tsx.
export const chrome = {
  canvas: '#5f6368',
  toolbarBg: '#323639',
  toolbarText: '#f1f3f4',
  toolbarTextMuted: 'rgba(255,255,255,0.82)',
  toolbarIcon: 'rgba(255,255,255,0.92)',
  toolbarHover: 'rgba(255,255,255,0.12)',
  toolbarDisabled: 'rgba(255,255,255,0.26)',
  fieldBg: 'rgba(255,255,255,0.10)',
  fieldBgSubtle: 'rgba(255,255,255,0.08)',
  fieldBorder: 'rgba(255,255,255,0.28)',
  fieldBorderHover: 'rgba(255,255,255,0.44)',
  fieldBorderSubtle: 'rgba(255,255,255,0.24)',
  fieldBorderSubtleHover: 'rgba(255,255,255,0.42)',
  dividerOnDark: 'rgba(255,255,255,0.12)',
  dividerSeam: '#2f3336',
  dividerSeamShadow: 'rgba(0,0,0,0.18)',
  railBg: '#f8f9fa',
  controlBg: 'rgba(255,255,255,0.92)',
  textFill: '#f1f3f4',
  textFillDisabled: 'rgba(255,255,255,0.54)',
  accent: '#8ab4f8',
  dropTint: 'rgba(138,180,248,0.10)',
  // Focus indicator. A darker blue than `accent` so the ring keeps ≥3:1 non-text
  // contrast (WCAG 2.4.11) on white surfaces (cards, pages, rail) as well as on
  // the dark toolbar — `accent` (#8ab4f8) is only ~1.8:1 on white.
  focusRing: '#1a73e8',
} as const

/** App theme. `primary.main` is the workspace accent (`#8ab4f8`), which unifies
 *  the focus/active outlines that were previously a mix of MUI's default blue
 *  (PageCard) and the literal accent (toolbar). */
export const theme = createTheme({
  palette: {
    primary: { main: chrome.accent },
    background: { default: chrome.canvas, paper: '#ffffff' },
  },
  components: {
    // Respect the OS "reduce motion" setting: near-instant transitions/animations
    // app-wide (covers MUI, dnd-kit reflow, and our own transitions). WCAG 2.3.3.
    MuiCssBaseline: {
      styleOverrides: {
        '@media print': {
          '@page': {
            margin: '10mm',
          },
          'html, body, #root': {
            width: 'auto !important',
            height: 'auto !important',
            minHeight: '0 !important',
            overflow: 'visible !important',
            background: '#ffffff !important',
          },
          body: {
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          },
          'header, aside, [role="complementary"], [role="separator"], [data-preview-insert-slot]': {
            display: 'none !important',
          },
          '[data-print-workspace], [data-print-preview-root], [data-print-scrollport], [data-print-preview-pages], [data-print-page-row]':
            {
              display: 'block !important',
              width: 'auto !important',
              height: 'auto !important',
              minHeight: '0 !important',
              maxWidth: 'none !important',
              overflow: 'visible !important',
              background: '#ffffff !important',
              padding: '0 !important',
              margin: '0 !important',
              gap: '0 !important',
            },
          '[data-preview-page-key]': {
            display: 'block !important',
            width: '100% !important',
            maxWidth: 'none !important',
            minWidth: '0 !important',
            padding: '0 !important',
            margin: '0 !important',
            breakAfter: 'page',
            pageBreakAfter: 'always',
          },
          '[data-preview-page-key]:last-of-type': {
            breakAfter: 'auto',
            pageBreakAfter: 'auto',
          },
          '[data-print-page-shell]': {
            display: 'block !important',
            width: '100% !important',
            minHeight: '0 !important',
            padding: '0 !important',
            margin: '0 !important',
          },
          '[data-print-page-frame]': {
            width: '100% !important',
            height: 'auto !important',
            maxWidth: 'none !important',
            boxShadow: 'none !important',
          },
          '[data-print-page-canvas]': {
            display: 'block !important',
            width: '100% !important',
            height: 'auto !important',
            maxWidth: '100% !important',
            background: '#ffffff !important',
          },
          '[data-print-page-frame] .MuiCircularProgress-root': {
            display: 'none !important',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
  },
})
