import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Flip'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import { Box, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { type MouseEvent, type PointerEvent, useRef } from 'react'

import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { CLICK_MOVE_THRESHOLD } from '../lib/constants'
import { PageThumbnail } from './PageThumbnail'

interface Props {
  pdf: PDFDocumentProxy
  /** Stable sortable id (the page key). */
  pageKey: string
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
  /** True while this card is part of the block being dragged (dim as a ghost). */
  isMoving: boolean
  onOpen: () => void
  onToggleSelected: (event: { shiftKey: boolean }) => void
  onRotate: (delta: number) => void
  onFlip: () => void
  onDelete: () => void
  /** Single-pointer reorder (WCAG 2.2 SC 2.5.7 alternative to dragging). */
  onMoveUp: () => void
  onMoveDown: () => void
}

export function PageCard({
  pdf,
  pageKey,
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
  isMoving,
  onOpen,
  onToggleSelected,
  onRotate,
  onFlip,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: pageKey })
  const pointerStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const controlOffset = Math.max(6, Math.round(cardWidth * 0.04))
  const pageBadgeFontSize = Math.max(12, Math.min(18, Math.round(cardWidth * 0.075)))

  const startPointer = (event: PointerEvent) => {
    // Let dnd-kit's PointerSensor begin tracking, then record the origin so a
    // tap (no movement) still counts as a click-to-open rather than a drag.
    listeners?.onPointerDown?.(event)
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
    if (!start?.moved && !isDragging) onOpen()
  }

  const stopControlClick = (event: MouseEvent) => {
    event.stopPropagation()
  }

  return (
    <Card
      ref={setNodeRef}
      data-page-card
      data-page-key={pageKey}
      variant="outlined"
      role="listitem"
      tabIndex={0}
      aria-label={t('card.openPage', { position, total })}
      aria-keyshortcuts="Control+ArrowUp Control+ArrowDown"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : isMoving ? 0.4 : 1,
      }}
      onPointerDown={startPointer}
      onPointerMove={trackPointer}
      onClick={openIfClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      sx={{
        position: 'relative',
        flex: '0 0 auto',
        p: 1,
        width: cardWidth,
        height: cardHeight,
        cursor: 'grab',
        touchAction: 'none',
        bgcolor: 'background.paper',
        borderColor: active ? 'primary.main' : 'divider',
        boxShadow: active ? 3 : selected ? 2 : 0,
        overflow: 'hidden',
        '&:active': { cursor: 'grabbing' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: chrome.focusRing,
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
          // Visible/interactive only when selected or hovered (the hover rule on
          // the card sets these). Crucially we do NOT stop pointerdown here — a
          // press on empty card area must bubble to the card so a dnd-kit drag can
          // start; only the buttons below stop pointerdown (so dragging from a
          // control doesn't move the page).
          pointerEvents: selected ? 'auto' : 'none',
          transition: 'opacity 120ms ease',
          // Touch devices have no hover: always show the controls so a page can be
          // selected/rotated/deleted without a pointer hover.
          '@media (hover: none)': { opacity: 1, pointerEvents: 'auto' },
        }}
      >
        <Tooltip title={t('card.delete')}>
          <IconButton
            size="small"
            color="error"
            aria-label={t('card.delete')}
            onPointerDown={stopControlClick}
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
        <Tooltip title={selected ? t('card.deselect') : t('card.select')}>
          <IconButton
            size="small"
            color={selected ? 'primary' : 'default'}
            aria-label={selected ? t('card.deselect') : t('card.select')}
            onPointerDown={stopControlClick}
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
          onPointerDown={stopControlClick}
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
          <Tooltip title={t('card.rotateLeft')}>
            <IconButton
              size="small"
              aria-label={t('card.rotateLeft')}
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
          <Tooltip title={t('card.flip')}>
            <IconButton
              size="small"
              color={flipped ? 'primary' : 'default'}
              aria-label={t('card.flip')}
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
          <Tooltip title={t('card.rotateRight')}>
            <IconButton
              size="small"
              aria-label={t('card.rotateRight')}
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
        <Stack
          direction="column"
          spacing={0.5}
          onPointerDown={stopControlClick}
          sx={{
            position: 'absolute',
            right: controlOffset,
            top: '50%',
            transform: 'translateY(-50%)',
            p: 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.92)',
            boxShadow: 1,
          }}
        >
          <Tooltip title={t('card.moveUp')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('card.moveUp')}
                disabled={position <= 1}
                onClick={(event) => {
                  stopControlClick(event)
                  onMoveUp()
                }}
                sx={{
                  width: controlSize,
                  height: controlSize,
                  '& .MuiSvgIcon-root': { fontSize: iconSize },
                }}
              >
                <ArrowUpwardIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('card.moveDown')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('card.moveDown')}
                disabled={position >= total}
                onClick={(event) => {
                  stopControlClick(event)
                  onMoveDown()
                }}
                sx={{
                  width: controlSize,
                  height: controlSize,
                  '& .MuiSvgIcon-root': { fontSize: iconSize },
                }}
              >
                <ArrowDownwardIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
      <PageThumbnail
        pdf={pdf}
        pageIndex={pageIndex}
        rotation={rotation}
        flipped={flipped}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
      />
    </Card>
  )
}
