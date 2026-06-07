import { Box } from '@mui/material'
import { type DragEvent as ReactDragEvent, type ReactNode, useState } from 'react'

import { chrome } from '../app/theme'
import { hasFileTransfer } from '../lib/dnd'

interface InitialDropZoneProps {
  /** Only the empty workspace accepts a full-window drop. */
  enabled: boolean
  onDropFiles: (files: FileList) => void
  children: ReactNode
}

/** Full-window drop target shown when the workspace is empty, with a highlight
 *  overlay while a file is dragged over it. */
export function InitialDropZone({ enabled, onDropFiles, children }: InitialDropZoneProps) {
  const [active, setActive] = useState(false)

  const onDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!enabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setActive(true)
  }
  const onDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!enabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setActive(true)
  }
  const onDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!enabled) return
    const relatedTarget = event.relatedTarget as Node | null
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return
    setActive(false)
  }
  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!enabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setActive(false)
    onDropFiles(event.dataTransfer.files)
  }

  return (
    <Box
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{ minHeight: '100vh', position: 'relative', bgcolor: chrome.canvas }}
    >
      {children}
      {enabled && active && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            pointerEvents: 'none',
            bgcolor: chrome.dropTint,
            boxShadow: `inset 0 0 0 3px ${chrome.accent}`,
          }}
        />
      )}
    </Box>
  )
}
