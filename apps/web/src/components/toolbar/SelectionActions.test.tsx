import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { theme } from '../../app/theme'
import { DocumentProvider } from '../../features/document/DocumentContext'
import { SelectionActions } from './SelectionActions'

function renderWithProviders(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <DocumentProvider>{ui}</DocumentProvider>
    </ThemeProvider>,
  )
}

describe('SelectionActions', () => {
  it('disables selection actions on an empty document', () => {
    renderWithProviders(<SelectionActions busy={false} />)
    expect(screen.getByRole('button', { name: '選択ページを削除' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '選択ページを左に回転' })).toBeDisabled()
    // The toggle shows "全選択" and is disabled while empty with no selection.
    expect(screen.getByRole('button', { name: '全選択' })).toBeDisabled()
  })
})
