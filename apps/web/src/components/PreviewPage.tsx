import { Box, CircularProgress } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'

interface Props {
  pdf: PDFDocumentProxy
  pageIndex: number
  rotation: number
  flipped: boolean
  zoom: number
  compact?: boolean
}

export function PreviewPage({ pdf, pageIndex, rotation, flipped, zoom, compact = false }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setFrameWidth(width)
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let task: RenderTask | null = null
    let cancelled = false

    setRendering(true)
    void (async () => {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1, rotation })
      const available = Math.max(compact ? 160 : 320, frameWidth - (compact ? 0 : 96))
      const fitScale = available / base.width
      const scale = Math.max(0.2, Math.min(5, fitScale * zoom))
      const viewport = page.getViewport({ scale, rotation })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      task = page.render({ canvas, viewport })
      try {
        await task.promise
      } catch {
        // Render cancelled by page, size, or rotation change.
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageIndex, rotation, frameWidth, zoom, compact])

  return (
    <Box
      ref={frameRef}
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        p: compact ? 0 : 4,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {rendering && (
          <CircularProgress
            size={22}
            sx={{
              position: 'absolute',
              left: '50%',
              top: 32,
              zIndex: 1,
              ml: '-11px',
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            transform: flipped ? 'scaleX(-1)' : undefined,
            transformOrigin: 'center center',
            background: '#fff',
            boxShadow: '0 3px 18px rgba(0,0,0,0.35)',
          }}
        />
      </Box>
    </Box>
  )
}
