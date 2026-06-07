import { Box } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef } from 'react'

interface PageThumbnailProps {
  pdf: PDFDocumentProxy
  pageIndex: number
  rotation: number
  flipped: boolean
  cardWidth: number
  cardHeight: number
}

/** Renders one PDF page to a fitted canvas. Pure presentation — no drag,
 *  selection or controls — so it can be reused by PageCard and the drag overlay. */
export function PageThumbnail({
  pdf,
  pageIndex,
  rotation,
  flipped,
  cardWidth,
  cardHeight,
}: PageThumbnailProps) {
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
      const availableWidth = Math.max(1, cardWidth - 16)
      const availableHeight = Math.max(1, cardHeight - 16)
      const scale = Math.min(availableWidth / base.width, availableHeight / base.height)
      const viewport = page.getViewport({ scale, rotation })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      task = page.render({ canvas, viewport })
      try {
        await task.promise
      } catch {
        // Render cancelled by a rotation change or unmount.
      }
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageIndex, rotation, cardWidth, cardHeight])

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.50',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          transform: flipped ? 'scaleX(-1)' : undefined,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.16)',
          background: '#fff',
        }}
      />
    </Box>
  )
}
