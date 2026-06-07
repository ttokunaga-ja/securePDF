import { Box, CircularProgress } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  pdf: PDFDocumentProxy
  pageIndex: number
  rotation: number
  flipped: boolean
  zoom: number
  compact?: boolean
  fillViewport?: boolean
  lazyRoot?: RefObject<HTMLElement | null>
}

interface PageSize {
  width: number
  height: number
}

const DEFAULT_RATIO = 1.414

export function PreviewPage({
  pdf,
  pageIndex,
  rotation,
  flipped,
  zoom,
  compact = false,
  fillViewport = true,
  lazyRoot,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize | null>(null)
  const [lazyVisible, setLazyVisible] = useState(false)
  const [rendering, setRendering] = useState(false)
  const shouldRender = !lazyRoot || lazyVisible

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
    let cancelled = false
    void (async () => {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const viewport = page.getViewport({ scale: 1, rotation })
      setPageSize({ width: viewport.width, height: viewport.height })
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex, rotation])

  useEffect(() => {
    if (!lazyRoot) return

    const frame = frameRef.current
    if (!frame) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLazyVisible(true)
      },
      { root: lazyRoot.current, rootMargin: '900px 0px' },
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [lazyRoot])

  const renderedSize = useMemo(() => {
    const source = pageSize ?? { width: 1, height: DEFAULT_RATIO }
    const available = Math.max(compact ? 160 : 320, frameWidth - (compact ? 0 : 96))
    const fitScale = available / source.width
    const scale = Math.max(0.2, Math.min(5, fitScale * zoom))
    return {
      width: Math.ceil(source.width * scale),
      height: Math.ceil(source.height * scale),
    }
  }, [compact, frameWidth, pageSize, zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !shouldRender || !pageSize || frameWidth <= 0) return
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
  }, [pdf, pageIndex, rotation, frameWidth, zoom, compact, pageSize, shouldRender])

  return (
    <Box
      ref={frameRef}
      sx={{
        minHeight: fillViewport ? '100%' : undefined,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        p: compact ? 0 : 4,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: renderedSize.width,
          height: renderedSize.height,
          maxWidth: '100%',
          bgcolor: '#fff',
          boxShadow: '0 3px 18px rgba(0,0,0,0.35)',
        }}
      >
        {shouldRender && rendering && (
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
            width: '100%',
            height: '100%',
            transform: flipped ? 'scaleX(-1)' : undefined,
            transformOrigin: 'center center',
            background: '#fff',
          }}
        />
      </Box>
    </Box>
  )
}
