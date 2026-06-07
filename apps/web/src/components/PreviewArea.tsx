import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'

import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { useDocState } from '../features/document/DocumentContext'
import {
  selectActiveIndex,
  selectActivePage,
  selectFilesById,
} from '../features/document/selectors'
import { PreviewPage } from './PreviewPage'

interface PreviewAreaProps {
  twoPageView: boolean
  zoom: number
  busy: boolean
  /** Open the file picker from the empty-state call to action. */
  onOpenFiles: () => void
}

/** The main preview canvas: the active page, or two pages side-by-side. */
export function PreviewArea({ twoPageView, zoom, busy, onOpenFiles }: PreviewAreaProps) {
  const state = useDocState()
  const filesById = useMemo(() => selectFilesById(state.files), [state.files])
  const activeIndex = selectActiveIndex(state)
  const activePage = selectActivePage(state)
  const activeFile = activePage ? filesById.get(activePage.fileId) : undefined
  const nextPreviewPage =
    twoPageView && activeIndex >= 0 ? (state.pages[activeIndex + 1] ?? null) : null
  const nextPreviewFile = nextPreviewPage ? filesById.get(nextPreviewPage.fileId) : undefined

  return (
    <Box
      component="main"
      aria-label={t('preview.label')}
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: chrome.canvas,
      }}
    >
      <Box
        id="main-preview"
        tabIndex={0}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          bgcolor: chrome.canvas,
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: -3,
          },
        }}
      >
        {activePage && activeFile ? (
          twoPageView ? (
            <Box
              sx={{
                minHeight: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                gap: 3,
                p: 4,
              }}
            >
              <Box sx={{ flex: '0 1 50%', maxWidth: '50%', minWidth: 0 }}>
                <PreviewPage
                  compact
                  pdf={activeFile.pdf}
                  pageIndex={activePage.pageIndex}
                  rotation={activePage.rotation}
                  flipped={activePage.flipped}
                  zoom={zoom}
                />
              </Box>
              {nextPreviewPage && nextPreviewFile && (
                <Box sx={{ flex: '0 1 50%', maxWidth: '50%', minWidth: 0 }}>
                  <PreviewPage
                    compact
                    pdf={nextPreviewFile.pdf}
                    pageIndex={nextPreviewPage.pageIndex}
                    rotation={nextPreviewPage.rotation}
                    flipped={nextPreviewPage.flipped}
                    zoom={zoom}
                  />
                </Box>
              )}
            </Box>
          ) : (
            <PreviewPage
              pdf={activeFile.pdf}
              pageIndex={activePage.pageIndex}
              rotation={activePage.rotation}
              flipped={activePage.flipped}
              zoom={zoom}
            />
          )
        ) : busy ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100%' }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ minHeight: '100%', p: 4, textAlign: 'center' }}
          >
            <UploadFileIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.65)' }} />
            <Typography component="h2" variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
              {t('empty.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 440 }}>
              {t('empty.body')}
            </Typography>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={onOpenFiles}>
              {t('empty.open')}
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  )
}
