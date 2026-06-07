import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Alert, Box, Card } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'

import { srOnly } from '../app/a11y'
import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { useDocActions, useDocState } from '../features/document/DocumentContext'
import { selectFilesById } from '../features/document/selectors'
import type { PageItem } from '../features/document/types'
import {
  CLICK_MOVE_THRESHOLD,
  LEFT_PANE_MAX,
  LEFT_PANE_MIN,
  THUMBNAIL_CARD_MAX,
  THUMBNAIL_CARD_MIN,
  THUMBNAIL_CARD_RATIO,
  THUMBNAIL_WIDTH_RATIO,
} from '../lib/constants'
import { clamp } from '../lib/math'
import { INSERT_SLOT_ID, reorderRail } from '../lib/reorder'
import { InsertSlot } from './InsertSlot'
import { PageCard } from './PageCard'
import { PageThumbnail } from './PageThumbnail'

interface ThumbnailRailProps {
  width: number
  busy: boolean
  error: string | null
  onDismissError: () => void
  onImportFiles: (list: FileList, insertAt?: number) => void
  onPickAt: (insertAt?: number) => void
}

/** The scrollable left rail. Page cards and the single insert slot live in one
 *  dnd-kit sortable list: the same drag gesture moves a page (or multi-selection)
 *  or the slot, the list reflows live, and you can drop anywhere — including the
 *  very end. Thumbnail dimensions scale with the pane width. */
export function ThumbnailRail({
  width,
  busy,
  error,
  onDismissError,
  onImportFiles,
  onPickAt,
}: ThumbnailRailProps) {
  const { files, pages, selectedKeys, activeKey, insertIndex } = useDocState()
  const { reorder, toggleSelect, setActive, rotate, flip, remove } = useDocActions()
  const filesById = useMemo(() => selectFilesById(files), [files])
  const [drag, setDrag] = useState<{ id: string; keys: string[] } | null>(null)

  const [status, setStatus] = useState('')
  const railRef = useRef<HTMLDivElement>(null)
  const activeKeyRef = useRef(activeKey)
  useEffect(() => {
    activeKeyRef.current = activeKey
  })
  const railSigRef = useRef<{ len: number; order: string } | null>(null)
  // Announce structural changes (add / remove / reorder) to screen readers, and
  // after a deletion restore focus into the rail so keyboard users aren't dropped
  // onto <body>. Runs on any page-set change; rotate/flip keep order+length so
  // they don't announce.
  useEffect(() => {
    const order = pages.map((page) => page.key).join('|')
    const prev = railSigRef.current
    railSigRef.current = { len: pages.length, order }
    if (!prev) return
    if (pages.length > prev.len) {
      setStatus(t('status.pagesAdded', { count: pages.length - prev.len, total: pages.length }))
    } else if (pages.length < prev.len) {
      setStatus(t('status.pagesRemoved', { count: prev.len - pages.length, total: pages.length }))
      const active = document.activeElement
      const railHadFocus =
        !active || active === document.body || !!railRef.current?.contains(active)
      const key = activeKeyRef.current
      if (railHadFocus && key) {
        railRef.current?.querySelector<HTMLElement>(`[data-page-key="${key}"]`)?.focus()
      }
    } else if (order !== prev.order) {
      setStatus(t('status.reordered'))
    }
  }, [pages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: CLICK_MOVE_THRESHOLD } }),
  )

  const cardWidth = Math.round(
    clamp(width * THUMBNAIL_WIDTH_RATIO, THUMBNAIL_CARD_MIN, THUMBNAIL_CARD_MAX),
  )
  const cardHeight = Math.round(cardWidth * THUMBNAIL_CARD_RATIO)
  const controlSize = Math.round(clamp(cardWidth * 0.24, 44, 72))
  const iconSize = Math.round(clamp(cardWidth * 0.13, 24, 42))

  // The rail as one ordered list: pages with the insert slot spliced in at its
  // current index. This is the single source of truth for the sortable.
  const railItems: ({ kind: 'slot' } | { kind: 'page'; page: PageItem; index: number })[] = []
  pages.forEach((page, index) => {
    if (index === insertIndex) railItems.push({ kind: 'slot' })
    railItems.push({ kind: 'page', page, index })
  })
  if (insertIndex >= pages.length) railItems.push({ kind: 'slot' })
  const railIds = railItems.map((item) => (item.kind === 'slot' ? INSERT_SLOT_ID : item.page.key))

  /** The ids that move together: just the slot, the whole selection (if the
   *  grabbed page is selected), or the single grabbed page. */
  function movingIdsFor(activeId: string): string[] {
    if (activeId === INSERT_SLOT_ID) return [INSERT_SLOT_ID]
    return selectedKeys.has(activeId)
      ? pages.filter((page) => selectedKeys.has(page.key)).map((page) => page.key)
      : [activeId]
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (id !== INSERT_SLOT_ID && !selectedKeys.has(id)) setActive(id)
    setDrag({ id, keys: movingIdsFor(id) })
  }

  function onDragEnd(event: DragEndEvent) {
    setDrag(null)
    if (!event.over) return
    const activeId = String(event.active.id)
    const result = reorderRail(railIds, movingIdsFor(activeId), activeId, String(event.over.id))
    if (result) reorder(result.order, result.insertIndex)
  }

  /** Single-pointer reorder (no dragging) for WCAG 2.2 SC 2.5.7: swap a page with
   *  its neighbour and keep the insert slot at the same gap. */
  function movePage(key: string, dir: -1 | 1) {
    const i = pages.findIndex((page) => page.key === key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= pages.length) return
    const order = pages.map((page) => page.key)
    const a = order[i]
    const b = order[j]
    if (a === undefined || b === undefined) return
    order[i] = b
    order[j] = a
    reorder(order, insertIndex)
  }

  function renderSlot() {
    return (
      <InsertSlot
        key="insert-slot"
        id={INSERT_SLOT_ID}
        index={insertIndex}
        busy={busy}
        isMoving={drag?.keys.includes(INSERT_SLOT_ID) ?? false}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        iconSize={iconSize}
        onFiles={(list, slotIndex) => onImportFiles(list, slotIndex)}
        onPick={onPickAt}
      />
    )
  }

  function renderPage(page: PageItem, index: number) {
    const file = filesById.get(page.fileId)
    if (!file) return null
    return (
      <PageCard
        key={page.key}
        pdf={file.pdf}
        pageKey={page.key}
        pageIndex={page.pageIndex}
        rotation={page.rotation}
        flipped={page.flipped}
        position={index + 1}
        total={pages.length}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        controlSize={controlSize}
        iconSize={iconSize}
        active={page.key === activeKey}
        selected={selectedKeys.has(page.key)}
        isMoving={drag?.keys.includes(page.key) ?? false}
        onOpen={() => setActive(page.key)}
        onToggleSelected={(event) => toggleSelect(page.key, event.shiftKey)}
        onRotate={(delta) => rotate([page.key], delta)}
        onFlip={() => flip([page.key])}
        onDelete={() => remove([page.key])}
        onMoveUp={() => movePage(page.key, -1)}
        onMoveDown={() => movePage(page.key, 1)}
      />
    )
  }

  function renderOverlay() {
    if (!drag) return null
    if (drag.id === INSERT_SLOT_ID) {
      return (
        <Card
          variant="outlined"
          sx={{
            width: cardWidth,
            height: cardHeight,
            border: '2px dashed',
            borderColor: 'primary.main',
            color: 'primary.main',
            bgcolor: 'common.white',
            boxShadow: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grabbing',
          }}
        >
          <UploadFileIcon sx={{ fontSize: Math.round(iconSize * 1.45) }} />
        </Card>
      )
    }
    const primary = pages.find((page) => page.key === drag.id)
    const primaryFile = primary ? filesById.get(primary.fileId) : undefined
    if (!primary || !primaryFile) return null
    return (
      <Card
        variant="outlined"
        sx={{
          position: 'relative',
          p: 1,
          width: cardWidth,
          height: cardHeight,
          boxShadow: 6,
          bgcolor: 'background.paper',
          cursor: 'grabbing',
        }}
      >
        <PageThumbnail
          pdf={primaryFile.pdf}
          pageIndex={primary.pageIndex}
          rotation={primary.rotation}
          flipped={primary.flipped}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
        {drag.keys.length > 1 && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 1,
              py: 0.25,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t('rail.dragBadge', { count: drag.keys.length })}
          </Box>
        )}
      </Card>
    )
  }

  return (
    <Box
      component="aside"
      sx={{
        width,
        minWidth: LEFT_PANE_MIN,
        maxWidth: LEFT_PANE_MAX,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: chrome.railBg,
      }}
    >
      {error && (
        <Alert severity="error" sx={{ m: 1 }} onClose={onDismissError}>
          {error}
        </Alert>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <Box
          ref={railRef}
          role="list"
          aria-label={t('rail.label')}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.25,
            px: 1,
            py: 1.5,
          }}
        >
          <SortableContext items={railIds} strategy={verticalListSortingStrategy}>
            {railItems.map((item) =>
              item.kind === 'slot' ? renderSlot() : renderPage(item.page, item.index),
            )}
          </SortableContext>
        </Box>

        <DragOverlay dropAnimation={null}>{renderOverlay()}</DragOverlay>
      </DndContext>
      <Box aria-live="polite" aria-atomic="true" sx={srOnly}>
        {status}
      </Box>
    </Box>
  )
}
