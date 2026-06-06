import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Flip'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import { Box, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'

export const PAGE_CARD_WIDTH = 172
export const PAGE_CARD_HEIGHT = 244
const CLICK_MOVE_THRESHOLD = 6

interface Props {
  pdf: PDFDocumentProxy
  pageIndex: number
  rotation: number
  flipped: boolean
  position: number
  total: number
  cardWidth: number
  cardHeight: number
  controlSize: number
  iconSize: number
  active: boolean
  selected: boolean
  onOpen: () => void
  onToggleSelected: (event: { shiftKey: boolean }) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropAt: (kind: 'pages' | 'insertSlot') => void
  onRotate: (delta: number) => void
  onFlip: () => void
  onDelete: () => void
}

export function PageCard({
  pdf,
  pageIndex,
  rotation,
  flipped,
  position,
  total,
  cardWidth,
  cardHeight,
  controlSize,
  iconSize,
  active,
  selected,
  onOpen,
  onToggleSelected,
  onDragStart,
  onDragEnd,
  onDropAt,
  onRotate,
  onFlip,
  onDelete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const controlOffset = Math.max(6, Math.round(cardWidth * 0.04))
  const pageBadgeFontSize = Math.max(12, Math.min(18, Math.round(cardWidth * 0.075)))

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

  const startPointer = (event: PointerEvent) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  const trackPointer = (event: PointerEvent) => {
    const start = pointerStartRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) >= CLICK_MOVE_THRESHOLD) start.moved = true
  }

  const openIfClick = () => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start?.moved) onOpen()
  }

  const stopControlClick = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const acceptsPageDrag = (event: DragEvent) =>
    event.dataTransfer.types.includes('application/x-securepdf-pages') ||
    event.dataTransfer.types.includes('application/x-securepdf-insert-slot')

  return (
    <Card
      data-page-card
      draggable
      variant="outlined"
      tabIndex={0}
      aria-label={`${position}/${total}ページを表示`}
      onPointerDown={startPointer}
      onPointerMove={trackPointer}
      onClick={openIfClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-securepdf-pages', 'move')
        pointerStartRef.current = { x: 0, y: 0, moved: true }
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragEnter={(event) => {
        if (!acceptsPageDrag(event)) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragOver={(event) => {
        if (!acceptsPageDrag(event)) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        if (!acceptsPageDrag(event)) return
        event.preventDefault()
        event.stopPropagation()
        setDropActive(false)
        onDropAt(
          event.dataTransfer.types.includes('application/x-securepdf-pages')
            ? 'pages'
            : 'insertSlot',
        )
      }}
      sx={{
        position: 'relative',
        flex: '0 0 auto',
        p: 1,
        width: cardWidth,
        height: cardHeight,
        cursor: 'grab',
        bgcolor: 'background.paper',
        borderColor: dropActive ? 'primary.main' : active ? 'primary.main' : 'divider',
        boxShadow: active ? 3 : selected ? 2 : 0,
        overflow: 'hidden',
        '&:active': { cursor: 'grabbing' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
        '&:hover .page-card-controls, &:focus-within .page-card-controls': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          left: controlOffset,
          top: controlOffset,
          zIndex: 2,
          px: 0.75,
          borderRadius: 1,
          bgcolor: 'rgba(255,255,255,0.88)',
          color: 'text.secondary',
          lineHeight: 1.8,
          fontSize: pageBadgeFontSize,
        }}
      >
        {position}
      </Typography>
      <Box
        className="page-card-controls"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
          transition: 'opacity 120ms ease',
        }}
      >
        <Tooltip title="削除">
          <IconButton
            size="small"
            color="error"
            aria-label="削除"
            onClick={(event) => {
              stopControlClick(event)
              onDelete()
            }}
            sx={{
              position: 'absolute',
              left: controlOffset,
              top: controlOffset,
              width: controlSize,
              height: controlSize,
              bgcolor: 'rgba(255,255,255,0.92)',
              '&:hover': { bgcolor: 'background.paper' },
              '& .MuiSvgIcon-root': { fontSize: iconSize },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={selected ? '選択解除' : '選択'}>
          <IconButton
            size="small"
            color={selected ? 'primary' : 'default'}
            aria-label={selected ? '選択解除' : '選択'}
            onClick={(event) => {
              stopControlClick(event)
              onToggleSelected({ shiftKey: event.shiftKey })
            }}
            sx={{
              position: 'absolute',
              right: controlOffset,
              top: controlOffset,
              width: controlSize,
              height: controlSize,
              bgcolor: 'rgba(255,255,255,0.92)',
              '&:hover': { bgcolor: 'background.paper' },
              '& .MuiSvgIcon-root': { fontSize: iconSize },
            }}
          >
            {selected ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          </IconButton>
        </Tooltip>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: controlOffset,
            transform: 'translateX(-50%)',
            px: 0.5,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.92)',
            boxShadow: 1,
          }}
        >
          <Tooltip title="左に回転">
            <IconButton
              size="small"
              aria-label="左に回転"
              onClick={(event) => {
                stopControlClick(event)
                onRotate(-90)
              }}
              sx={{
                width: controlSize,
                height: controlSize,
                '& .MuiSvgIcon-root': { fontSize: iconSize },
              }}
            >
              <RotateLeftIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="反転">
            <IconButton
              size="small"
              color={flipped ? 'primary' : 'default'}
              aria-label="反転"
              onClick={(event) => {
                stopControlClick(event)
                onFlip()
              }}
              sx={{
                width: controlSize,
                height: controlSize,
                '& .MuiSvgIcon-root': { fontSize: iconSize },
              }}
            >
              <FlipIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="右に回転">
            <IconButton
              size="small"
              aria-label="右に回転"
              onClick={(event) => {
                stopControlClick(event)
                onRotate(90)
              }}
              sx={{
                width: controlSize,
                height: controlSize,
                '& .MuiSvgIcon-root': { fontSize: iconSize },
              }}
            >
              <RotateRightIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
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
    </Card>
  )
}
