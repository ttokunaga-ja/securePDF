import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import { Box, Card, IconButton, Stack, Typography } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef } from 'react'

import { THUMBNAIL_WIDTH } from '../lib/pdf'

interface Props {
  pdf: PDFDocumentProxy
  pageIndex: number
  rotation: number
  position: number
  total: number
  onRotate: (delta: number) => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}

export function PageCard({
  pdf,
  pageIndex,
  rotation,
  position,
  total,
  onRotate,
  onDelete,
  onMove,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let task: RenderTask | null = null
    let cancelled = false

    void (async () => {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1, rotation })
      const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / base.width, rotation })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      task = page.render({ canvas, viewport })
      try {
        await task.promise
      } catch {
        // Render cancelled by a rotation change or unmount — ignore.
      }
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageIndex, rotation])

  return (
    <Card variant="outlined" sx={{ p: 1, width: THUMBNAIL_WIDTH + 16 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 130,
          bgcolor: 'grey.50',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ maxWidth: '100%', boxShadow: '0 0 0 1px rgba(0,0,0,0.12)' }}
        />
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {position}/{total}
        </Typography>
        <Box>
          <IconButton
            size="small"
            aria-label="前へ移動"
            disabled={position === 1}
            onClick={() => onMove(-1)}
          >
            <ChevronLeftIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="後ろへ移動"
            disabled={position === total}
            onClick={() => onMove(1)}
          >
            <ChevronRightIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Stack>
      <Stack direction="row" justifyContent="center">
        <IconButton size="small" aria-label="左に回転" onClick={() => onRotate(-90)}>
          <RotateLeftIcon fontSize="inherit" />
        </IconButton>
        <IconButton size="small" aria-label="右に回転" onClick={() => onRotate(90)}>
          <RotateRightIcon fontSize="inherit" />
        </IconButton>
        <IconButton size="small" color="error" aria-label="削除" onClick={onDelete}>
          <DeleteIcon fontSize="inherit" />
        </IconButton>
      </Stack>
    </Card>
  )
}
