import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { theme } from '../app/theme'
import { DocumentProvider, useDocActions } from '../features/document/DocumentContext'
import type { LoadedFile } from '../lib/importFile'
import { PreviewArea } from './PreviewArea'

vi.mock('./PreviewPage', () => ({
  PreviewPage: ({ pageIndex }: { pageIndex: number }) => (
    <div data-testid={`preview-page-${pageIndex + 1}`} />
  ),
}))

const fixtureFile = {
  id: 'fixture',
  filename: 'fixture.pdf',
  bytes: new Uint8Array(),
  pdf: {},
  pageCount: 3,
} as LoadedFile

function SeedDocument({ insertIndex }: { insertIndex: number }) {
  const actions = useDocActions()
  useEffect(() => {
    actions.importFiles([fixtureFile], 0)
    actions.setInsertIndex(insertIndex)
  }, [actions, insertIndex])
  return null
}

function renderPreview(insertIndex: number, onOpenFiles = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <DocumentProvider>
        <SeedDocument insertIndex={insertIndex} />
        <PreviewArea twoPageView={false} zoom={1} busy={false} onOpenFiles={onOpenFiles} />
      </DocumentProvider>
    </ThemeProvider>,
  )
  return { onOpenFiles }
}

describe('PreviewArea', () => {
  afterEach(() => cleanup())

  it('shows the insert-position page in the continuous preview', async () => {
    renderPreview(1)

    expect(await screen.findByTestId('preview-page-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2番目の位置に挿入' })).toBeInTheDocument()
    expect(screen.getByText('ここに追加')).toBeInTheDocument()
    expect(screen.getByText('2番目の位置')).toBeInTheDocument()
  })

  it('opens the picker at the insert-position page', async () => {
    const { onOpenFiles } = renderPreview(1)
    const insertButton = await screen.findByRole('button', { name: '2番目の位置に挿入' })

    fireEvent.click(insertButton)

    await waitFor(() => expect(onOpenFiles).toHaveBeenCalledWith(1))
  })
})
