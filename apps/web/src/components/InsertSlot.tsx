import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Card, CircularProgress } from '@mui/material'
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'

import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { CLICK_MOVE_THRESHOLD } from '../lib/constants'
import { hasFileTransfer } from '../lib/dnd'

interface InsertSlotProps {
  /** Sortable id shared with the rail (the single insert slot). */
  id: string
  /** Current insert position = where picked/dropped files land. */
  index: number
  busy: boolean
  /** True while the slot itself is the dragged item (dim as a ghost). */
  isMoving: boolean
  cardWidth: number
  cardHeight: number
  iconSize: number
  onFiles: (list: FileList, index: number) => void
  onPick: (index: number) => void
}

/** The dashed "insert here" slot. It is a first-class sortable item — the same
 *  drag gesture that reorders pages also moves it, and it reflows with them
 *  (no separate drag system, never hidden mid-drag). Click to pick files, or drop
 *  OS files onto it to import at this position. */
export function InsertSlot({
  id,
  index,
  busy,
  isMoving,
  cardWidth,
  cardHeight,
  iconSize,
  onFiles,
  onPick,
}: InsertSlotProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id })
  const [fileOver, setFileOver] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const startPointer = (event: ReactPointerEvent) => {
    listeners?.onPointerDown?.(event)
    pointerStartRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  const trackPointer = (event: ReactPointerEvent) => {
    const start = pointerStartRef.current
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= CLICK_MOVE_THRESHOLD) {
      start.moved = true
    }
  }

  return (
    <Card
      ref={setNodeRef}
      role="listitem"
      tabIndex={0}
      aria-label={t('insert.label', { position: index + 1 })}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : isMoving ? 0.4 : 1,
      }}
      onPointerDown={startPointer}
      onPointerMove={trackPointer}
      onClick={(event) => {
        event.stopPropagation()
        const start = pointerStartRef.current
        pointerStartRef.current = null
        if (!busy && !start?.moved && !isDragging) onPick(index)
      }}
      onKeyDown={(event) => {
        if (busy) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPick(index)
        }
      }}
      onDragEnter={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return
        event.preventDefault()
        setFileOver(true)
      }}
      onDragOver={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return
        event.preventDefault()
        setFileOver(true)
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={(event) => {
        if (!hasFileTransfer(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        setFileOver(false)
        if (event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files, index)
      }}
      sx={{
        flex: '0 0 auto',
        width: cardWidth,
        height: cardHeight,
        cursor: busy ? 'default' : 'grab',
        touchAction: 'none',
        bgcolor: 'common.white',
        color: fileOver ? 'primary.main' : 'text.disabled',
        border: '2px dashed',
        borderColor: fileOver ? 'primary.main' : 'divider',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 120ms ease, color 120ms ease',
        '&:active': { cursor: 'grabbing' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: chrome.focusRing,
          outlineOffset: 2,
        },
      }}
    >
      {busy ? (
        <CircularProgress size={Math.max(24, Math.round(iconSize * 1.2))} />
      ) : (
        <UploadFileIcon sx={{ fontSize: Math.round(iconSize * 1.45) }} />
      )}
    </Card>
  )
}
