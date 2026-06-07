import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import App from './App'
import { theme } from './app/theme'
import { DocumentProvider } from './features/document/DocumentContext'

// A CI guard for the structural accessibility regressions that are cheap to break
// (missing input labels, landmarks, list semantics, role/aria misuse). Runs axe
// on the empty App shell in happy-dom. `color-contrast` needs real layout, so it
// is checked out-of-band with Playwright + axe / Lighthouse (see docs/accessibility.md).
describe('App accessibility (empty state)', () => {
  it('exposes the expected landmarks, heading and labels', () => {
    const { getByRole, getByLabelText } = render(
      <ThemeProvider theme={theme}>
        <DocumentProvider>
          <App />
        </DocumentProvider>
      </ThemeProvider>,
    )
    getByRole('main')
    getByRole('heading', { level: 1 })
    getByRole('list', { name: 'ページ一覧' })
    getByRole('separator', { name: 'サムネイル列の幅' })
    // The three toolbar inputs must name the actual <input> (the MUI-wrapper trap).
    getByLabelText('ダウンロードファイル名')
    getByLabelText('ページ番号')
    getByLabelText('拡大率')
  })

  it('has no axe violations (wcag2a/2aa/21aa/22aa)', async () => {
    document.documentElement.lang = 'ja'
    document.title = 'securePDF'
    const { container } = render(
      <ThemeProvider theme={theme}>
        <DocumentProvider>
          <App />
        </DocumentProvider>
      </ThemeProvider>,
    )
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      // Contrast needs a real rendering engine; covered by Playwright/Lighthouse.
      rules: { 'color-contrast': { enabled: false } },
    })
    const summary = results.violations.map((v) => `${v.id} (${v.nodes.length})`)
    expect(summary).toEqual([])
  })
})
