import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { useDocActions, useDocState } from '../features/document/DocumentContext'
import { selectFilesById } from '../features/document/selectors'
import type { PageItem } from '../features/document/types'
import { nearestPreviewPageKey } from '../lib/previewScroll'
import { PreInputAdSlot } from './PreInputAdSlot'
import { PreviewPage } from './PreviewPage'

interface PreviewAreaProps {
  twoPageView: boolean
  zoom: number
  busy: boolean
  /** Show the pre-input ad placements around the empty-state CTA. */
  showPreInputAds?: boolean
  /** Open the file picker from the empty-state call to action. */
  onOpenFiles: (insertAt?: number) => void
}

type PreviewItem = { kind: 'slot'; index: number } | { kind: 'page'; page: PageItem; index: number }

/** The main preview canvas: a Chrome-PDF-viewer-style continuous scroll area. */
export function PreviewArea({
  twoPageView,
  zoom,
  busy,
  showPreInputAds = false,
  onOpenFiles,
}: PreviewAreaProps) {
  const state = useDocState()
  const { setActive } = useDocActions()
  const filesById = useMemo(() => selectFilesById(state.files), [state.files])
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<string, HTMLElement>())
  const scrollRafRef = useRef<number | null>(null)
  const scrollActivatedKeyRef = useRef<string | null>(null)

  const setPageRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) pageRefs.current.set(key, node)
      else pageRefs.current.delete(key)
    },
    [],
  )

  const updateActiveFromScroll = useCallback(() => {
    scrollRafRef.current = null
    const scrollport = scrollRef.current
    if (!scrollport) return
    const nextKey = nearestPreviewPageKey(scrollport)
    if (!nextKey || nextKey === state.activeKey) return
    scrollActivatedKeyRef.current = nextKey
    setActive(nextKey)
  }, [setActive, state.activeKey])

  const scheduleScrollSync = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = window.requestAnimationFrame(updateActiveFromScroll)
  }, [updateActiveFromScroll])

  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!state.activeKey) return
    if (scrollActivatedKeyRef.current === state.activeKey) {
      scrollActivatedKeyRef.current = null
      return
    }

    const target = pageRefs.current.get(state.activeKey)
    target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }, [state.activeKey, state.pages.length, twoPageView])

  useEffect(() => {
    const id = window.requestAnimationFrame(updateActiveFromScroll)
    return () => window.cancelAnimationFrame(id)
  }, [state.pages, twoPageView, updateActiveFromScroll])

  function renderPreviewPage(page: PageItem, index: number, compact: boolean) {
    const file = filesById.get(page.fileId)
    if (!file) return null

    return (
      <Box
        key={page.key}
        ref={setPageRef(page.key)}
        data-preview-page-key={page.key}
        data-preview-page-position={index + 1}
        aria-label={t('card.openPage', { position: index + 1, total: state.pages.length })}
        sx={{
          flex: compact ? '1 1 0' : '0 0 auto',
          width: compact ? undefined : '100%',
          maxWidth: compact ? 'min(50%, 760px)' : '100%',
          minWidth: compact ? 0 : undefined,
          scrollMarginBlock: 32,
        }}
      >
        <PreviewPage
          compact={compact}
          fillViewport={false}
          pdf={file.pdf}
          pageIndex={page.pageIndex}
          rotation={page.rotation}
          flipped={page.flipped}
          zoom={zoom}
        />
      </Box>
    )
  }

  function renderInsertPage(index: number, compact: boolean) {
    const label = t('insert.label', { position: index + 1 })

    return (
      <Box
        key={`preview-insert-${index}`}
        data-preview-insert-slot
        data-preview-insert-position={index + 1}
        sx={{
          flex: compact ? '1 1 0' : '0 0 auto',
          width: compact ? undefined : '100%',
          maxWidth: compact ? 'min(50%, 760px)' : '100%',
          minWidth: compact ? 0 : undefined,
          scrollMarginBlock: 32,
          p: compact ? 0 : 4,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={label}
          disabled={busy}
          onClick={() => onOpenFiles(index)}
          sx={{
            width: '100%',
            aspectRatio: '1 / 1.414',
            minHeight: compact ? 180 : 320,
            border: '2px dashed',
            borderColor: 'primary.main',
            bgcolor: 'rgba(255,255,255,0.88)',
            color: 'primary.main',
            boxShadow: '0 3px 18px rgba(0,0,0,0.24)',
            cursor: busy ? 'default' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            font: 'inherit',
            transition: 'background-color 120ms ease, border-color 120ms ease',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.96)',
            },
            '&:focus-visible': {
              outline: '3px solid',
              outlineColor: chrome.focusRing,
              outlineOffset: 3,
            },
          }}
        >
          <UploadFileIcon sx={{ fontSize: compact ? 34 : 46 }} />
          <Typography variant={compact ? 'caption' : 'body2'} fontWeight={700}>
            {t('preview.insertHere')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('preview.insertPosition', { position: index + 1 })}
          </Typography>
        </Box>
      </Box>
    )
  }

  function previewItems(): PreviewItem[] {
    const items: PreviewItem[] = []
    state.pages.forEach((page, index) => {
      if (index === state.insertIndex) items.push({ kind: 'slot', index })
      items.push({ kind: 'page', page, index })
    })
    if (state.insertIndex >= state.pages.length) {
      items.push({ kind: 'slot', index: state.pages.length })
    }
    return items
  }

  function renderPreviewItem(item: PreviewItem, compact: boolean) {
    return item.kind === 'slot'
      ? renderInsertPage(item.index, compact)
      : renderPreviewPage(item.page, item.index, compact)
  }

  function renderContinuousPages() {
    const items = previewItems()
    if (!twoPageView) {
      return (
        <Stack
          data-print-preview-pages
          spacing={2}
          alignItems="center"
          sx={{ width: '100%', minHeight: '100%', px: { xs: 1, sm: 2 }, py: 2 }}
        >
          {items.map((item) => renderPreviewItem(item, false))}
        </Stack>
      )
    }

    const rows: PreviewItem[][] = []
    for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
    return (
      <Stack
        data-print-preview-pages
        spacing={2.5}
        sx={{ width: '100%', minHeight: '100%', px: { xs: 1.5, sm: 3 }, py: 3 }}
      >
        {rows.map((row) => (
          <Box
            data-print-page-row
            key={row
              .map((item) => (item.kind === 'slot' ? `slot-${item.index}` : item.page.key))
              .join('|')}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: { xs: 1.5, md: 3 },
              width: '100%',
            }}
          >
            {row.map((item) => renderPreviewItem(item, true))}
          </Box>
        ))}
      </Stack>
    )
  }

  return (
    <Box
      component="main"
      data-print-preview-root
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
        data-print-scrollport
        ref={scrollRef}
        tabIndex={0}
        onScroll={scheduleScrollSync}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          bgcolor: chrome.canvas,
          scrollSnapType: 'y proximity',
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: -3,
          },
        }}
      >
        {state.pages.length > 0 ? (
          renderContinuousPages()
        ) : busy ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100%' }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={showPreInputAds ? { xs: 5, md: 7 } : 0}
            sx={{
              minHeight: '100%',
              px: { xs: 2, sm: 4 },
              py: { xs: 5, md: 7 },
              textAlign: 'center',
            }}
          >
            {showPreInputAds && <PreInputAdSlot placement="top" />}

            <Stack
              alignItems="center"
              spacing={2}
              sx={{
                width: '100%',
                maxWidth: 560,
                mx: 'auto',
                py: showPreInputAds ? { xs: 1.5, md: 2 } : 0,
              }}
            >
              <UploadFileIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.65)' }} />
              <Typography component="h2" variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
                {t('empty.title')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 440 }}>
                {t('empty.body')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => onOpenFiles()}
              >
                {t('empty.open')}
              </Button>
            </Stack>

            {showPreInputAds && <PreInputAdSlot placement="bottom" />}
          </Stack>
        )}
      </Box>
    </Box>
  )
}
