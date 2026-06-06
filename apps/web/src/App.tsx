import { run } from '@securepdf/core'
import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import FlipIcon from '@mui/icons-material/Flip'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PrintIcon from '@mui/icons-material/Print'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import {
  Alert,
  Box,
  Card,
  CircularProgress,
  CssBaseline,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { PAGE_CARD_HEIGHT, PAGE_CARD_WIDTH, PageCard } from './components/PageCard'
import { PreviewPage } from './components/PreviewPage'
import { buildPlan } from './lib/buildPlan'
import { importFile, type LoadedFile } from './lib/importFile'

const LEFT_PANE_MIN = 204
const LEFT_PANE_MAX = 1120
const LEFT_PANE_FALLBACK = 426
const DIVIDER_WIDTH = 8
const CLICK_MOVE_THRESHOLD = 6
const THUMBNAIL_CARD_MIN = 148
const THUMBNAIL_CARD_MAX = 520
const THUMBNAIL_WIDTH_BASE = 284
const THUMBNAIL_WIDTH_RATIO = PAGE_CARD_WIDTH / THUMBNAIL_WIDTH_BASE
const THUMBNAIL_CARD_RATIO = PAGE_CARD_HEIGHT / PAGE_CARD_WIDTH
const MAIN_TOOLBAR_HEIGHT = 48
const TOOLBAR_ICON_SIZE = 36
const TOOLBAR_SVG_SIZE = 21
const TOOLBAR_COMPACT_ICON_SIZE = 30
const TOOLBAR_COMPACT_SVG_SIZE = 19
const ZOOM_MIN = 0.35
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

interface PageItem {
  key: string
  fileId: string
  pageIndex: number
  rotation: number
  flipped: boolean
}

export default function App() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState('1')
  const [previewZoom, setPreviewZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [outputFilename, setOutputFilename] = useState('securepdf.pdf')
  const [twoPageView, setTwoPageView] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [initialDropActive, setInitialDropActive] = useState(false)
  const [insertIndex, setInsertIndex] = useState(0)
  const [leftPaneWidth, setLeftPaneWidth] = useState(initialLeftPaneWidth)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingInsertAtRef = useRef<number | undefined>(undefined)
  const draggedPageKeysRef = useRef<string[]>([])
  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const selectedCount = selectedKeys.size
  const activeIndex = activeKey ? pages.findIndex((page) => page.key === activeKey) : -1
  const activePosition = activeIndex >= 0 ? activeIndex + 1 : 0
  const activePage = pages.find((page) => page.key === activeKey) ?? null
  const activeFile = activePage ? filesById.get(activePage.fileId) : undefined
  const nextPreviewPage = twoPageView && activeIndex >= 0 ? (pages[activeIndex + 1] ?? null) : null
  const nextPreviewFile = nextPreviewPage ? filesById.get(nextPreviewPage.fileId) : undefined
  const menuOpen = Boolean(menuAnchorEl)
  const initialDropEnabled = files.length === 0 && pages.length === 0
  const thumbnailCardWidth = Math.round(
    clamp(leftPaneWidth * THUMBNAIL_WIDTH_RATIO, THUMBNAIL_CARD_MIN, THUMBNAIL_CARD_MAX),
  )
  const thumbnailCardHeight = Math.round(thumbnailCardWidth * THUMBNAIL_CARD_RATIO)
  const thumbnailControlSize = Math.round(clamp(thumbnailCardWidth * 0.24, 44, 72))
  const thumbnailIconSize = Math.round(clamp(thumbnailCardWidth * 0.13, 24, 42))

  useEffect(() => {
    const pageKeys = new Set(pages.map((page) => page.key))
    setSelectedKeys((prev) => new Set([...prev].filter((key) => pageKeys.has(key))))
    setInsertIndex((prev) => Math.max(0, Math.min(prev, pages.length)))
    if (pages.length === 0) {
      setActiveKey(null)
      return
    }
    setActiveKey((prev) => (prev && pageKeys.has(prev) ? prev : pages[0].key))
  }, [pages])

  useEffect(() => {
    setPageInput(activePosition > 0 ? String(activePosition) : '0')
  }, [activePosition])

  useEffect(() => {
    setZoomInput(String(Math.round(previewZoom * 100)))
  }, [previewZoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return

      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        event.preventDefault()
        selectAllPages()
        return
      }
      if ((event.ctrlKey || event.metaKey) && (key === '+' || key === '=')) {
        event.preventDefault()
        changeZoom(ZOOM_STEP)
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === '-') {
        event.preventDefault()
        changeZoom(-ZOOM_STEP)
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === '0') {
        event.preventDefault()
        setPreviewZoom(1)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelectedOrActive(-1)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelectedOrActive(1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        activateNeighbor(-1)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        activateNeighbor(1)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelectedOrActive()
        return
      }
      if (key === 'r') {
        event.preventDefault()
        rotateSelectedOrActive(event.shiftKey ? -90 : 90)
        return
      }
      if (key === 'f') {
        event.preventDefault()
        flipSelectedOrActive()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pages, selectedKeys, activeKey])

  async function onImport(list: FileList | null, insertAt?: number) {
    if (!list || list.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const imported: LoadedFile[] = []
      for (const file of Array.from(list)) imported.push(await importFile(file))
      if (files.length === 0 && imported[0]) {
        setOutputFilename(normalizePdfFilename(imported[0].filename))
      }
      setFiles((prev) => [...prev, ...imported])
      setPages((prev) => {
        const nextPages = imported.flatMap((file) =>
          Array.from({ length: file.pageCount }, (_, i) => ({
            key: `${file.id}:${i}`,
            fileId: file.id,
            pageIndex: i,
            rotation: 0,
            flipped: false,
          })),
        )
        const index =
          insertAt === undefined ? prev.length : Math.max(0, Math.min(insertAt, prev.length))
        setInsertIndex(index + nextPages.length)
        setActiveKey(nextPages[0]?.key ?? prev[0]?.key ?? null)
        return [...prev.slice(0, index), ...nextPages, ...prev.slice(index)]
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function selectedOrActiveKeys(): string[] {
    if (selectedKeys.size > 0) {
      return pages.filter((page) => selectedKeys.has(page.key)).map((page) => page.key)
    }
    return activeKey ? [activeKey] : []
  }

  function rotateKeys(keys: string[], delta: number) {
    const targets = new Set(keys)
    setPages((prev) =>
      prev.map((page) =>
        targets.has(page.key)
          ? { ...page, rotation: (((page.rotation + delta) % 360) + 360) % 360 }
          : page,
      ),
    )
  }

  function flipKeys(keys: string[]) {
    const targets = new Set(keys)
    setPages((prev) =>
      prev.map((page) => (targets.has(page.key) ? { ...page, flipped: !page.flipped } : page)),
    )
  }

  function removeKeys(keys: string[]) {
    const targets = new Set(keys)
    setPages((prev) => prev.filter((page) => !targets.has(page.key)))
    setSelectedKeys((prev) => new Set([...prev].filter((key) => !targets.has(key))))
    setLastSelectedKey((prev) => (prev && targets.has(prev) ? null : prev))
  }

  function rotateSelectedOrActive(delta: number) {
    rotateKeys(selectedOrActiveKeys(), delta)
  }

  function flipSelectedOrActive() {
    flipKeys(selectedOrActiveKeys())
  }

  function removeSelectedOrActive() {
    removeKeys(selectedOrActiveKeys())
  }

  function selectAllPages() {
    setSelectedKeys(new Set(pages.map((page) => page.key)))
    setLastSelectedKey(pages.at(-1)?.key ?? null)
  }

  function clearSelection() {
    setSelectedKeys(new Set())
    setLastSelectedKey(null)
  }

  function togglePageSelected(key: string, event: { shiftKey: boolean }) {
    if (event.shiftKey && lastSelectedKey) {
      const from = pages.findIndex((page) => page.key === lastSelectedKey)
      const to = pages.findIndex((page) => page.key === key)
      if (from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from]
        setSelectedKeys((prev) => {
          const next = new Set(prev)
          pages.slice(start, end + 1).forEach((page) => next.add(page.key))
          return next
        })
        setLastSelectedKey(key)
        return
      }
    }

    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setLastSelectedKey(key)
  }

  function activateNeighbor(direction: -1 | 1) {
    if (pages.length === 0) return
    const current = activeKey ? pages.findIndex((page) => page.key === activeKey) : 0
    const next = Math.max(0, Math.min(pages.length - 1, current + direction))
    setActiveKey(pages[next].key)
  }

  function goToPage(position: number) {
    if (pages.length === 0 || !Number.isFinite(position)) return
    const index = clamp(Math.trunc(position), 1, pages.length) - 1
    setActiveKey(pages[index].key)
  }

  function changeZoom(delta: number) {
    setPreviewZoom((prev) => Math.round(clamp(prev + delta, ZOOM_MIN, ZOOM_MAX) * 100) / 100)
  }

  function applyZoomPercent(value: string) {
    const percent = Number(value)
    if (!Number.isFinite(percent)) {
      setZoomInput(String(Math.round(previewZoom * 100)))
      return
    }
    const nextZoom = Math.round(clamp(percent / 100, ZOOM_MIN, ZOOM_MAX) * 100) / 100
    setPreviewZoom(nextZoom)
    setZoomInput(String(Math.round(nextZoom * 100)))
  }

  function openMoreMenu(event: ReactMouseEvent<HTMLElement>) {
    setMenuAnchorEl(event.currentTarget)
  }

  function closeMoreMenu() {
    setMenuAnchorEl(null)
  }

  function beginPageDrag(key: string) {
    const keys = selectedKeys.has(key)
      ? pages.filter((page) => selectedKeys.has(page.key)).map((page) => page.key)
      : [key]
    draggedPageKeysRef.current = keys
    if (!selectedKeys.has(key)) {
      setActiveKey(key)
    }
  }

  function moveDraggedPages(insertAt: number) {
    const keys = draggedPageKeysRef.current
    if (keys.length === 0) return
    movePages(keys, insertAt)
    draggedPageKeysRef.current = []
  }

  function endPageDrag() {
    draggedPageKeysRef.current = []
  }

  function moveSelectedOrActive(direction: -1 | 1) {
    const keys = selectedOrActiveKeys()
    if (keys.length === 0) return
    const keySet = new Set(keys)
    const indices = pages.flatMap((page, index) => (keySet.has(page.key) ? [index] : []))
    if (indices.length === 0) return
    const first = indices[0]
    const last = indices[indices.length - 1]
    if (direction === -1) {
      if (first === 0) return
      movePages(keys, first - 1)
      return
    }
    if (last >= pages.length - 1) return
    movePages(keys, last + 2)
  }

  function movePages(keys: string[], insertAt: number) {
    const keySet = new Set(keys)
    setPages((prev) => {
      const moving = prev.filter((page) => keySet.has(page.key))
      if (moving.length === 0) return prev
      const remaining = prev.filter((page) => !keySet.has(page.key))
      const adjustedIndex = prev.slice(0, insertAt).filter((page) => !keySet.has(page.key)).length
      setInsertIndex(adjustedIndex + moving.length)
      setActiveKey(moving[0]?.key ?? null)
      return [...remaining.slice(0, adjustedIndex), ...moving, ...remaining.slice(adjustedIndex)]
    })
  }

  function openPickerAt(insertAt?: number) {
    pendingInsertAtRef.current = insertAt
    inputRef.current?.click()
  }

  function onInitialDragEnter(event: ReactDragEvent<HTMLElement>) {
    if (!initialDropEnabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setInitialDropActive(true)
  }

  function onInitialDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!initialDropEnabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setInitialDropActive(true)
  }

  function onInitialDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!initialDropEnabled) return
    const relatedTarget = event.relatedTarget as Node | null
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return
    setInitialDropActive(false)
  }

  function onInitialDrop(event: ReactDragEvent<HTMLElement>) {
    if (!initialDropEnabled || !hasFileTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setInitialDropActive(false)
    void onImport(event.dataTransfer.files, 0)
  }

  function resizeLeftPane(event: ReactMouseEvent) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = leftPaneWidth
    const move = (moveEvent: MouseEvent) => {
      const next = Math.max(
        LEFT_PANE_MIN,
        Math.min(LEFT_PANE_MAX, startWidth + moveEvent.clientX - startX),
      )
      setLeftPaneWidth(next)
    }
    const stop = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  async function createOutputPdf() {
    const plan = buildPlan(
      pages.map((page) => ({
        fileId: page.fileId,
        pageIndex: page.pageIndex,
        rotation: page.rotation,
        flipped: page.flipped,
      })),
      files.map((file) => ({ id: file.id, filename: file.filename, pageCount: file.pageCount })),
    )
    const result = await run(
      plan,
      files.map((file) => ({
        id: file.id,
        bytes: file.bytes,
        filename: file.filename,
        type: 'application/pdf',
      })),
    )
    if (!result.ok) {
      throw new Error(result.errors?.[0]?.message ?? 'PDFの生成に失敗しました')
    }
    return result.outputs[0]
  }

  async function onExport() {
    if (pages.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const output = await createOutputPdf()
      const filename = normalizePdfFilename(outputFilename || output.filename)
      setOutputFilename(filename)
      downloadFile(filename, output.bytes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onPrint() {
    if (pages.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const output = await createOutputPdf()
      printFile(output.bytes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const hasSelection = selectedCount > 0
  const selectionToggleTitle = hasSelection ? '選択解除' : '全選択'
  const selectionToggleDisabled = busy || (!hasSelection && pages.length === 0)
  const toggleAllSelection = hasSelection ? clearSelection : selectAllPages

  const selectionButtons = (
    <>
      <ToolbarIconButton
        title="選択ページを削除"
        disabled={busy || selectedCount === 0}
        onClick={() => removeKeys([...selectedKeys])}
        fill
      >
        <DeleteIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="選択ページを左に回転"
        disabled={busy || selectedCount === 0}
        onClick={() => rotateKeys([...selectedKeys], -90)}
        fill
      >
        <RotateLeftIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="選択ページを反転"
        disabled={busy || selectedCount === 0}
        onClick={() => flipKeys([...selectedKeys])}
        fill
      >
        <FlipIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title="選択ページを右に回転"
        disabled={busy || selectedCount === 0}
        onClick={() => rotateKeys([...selectedKeys], 90)}
        fill
      >
        <RotateRightIcon />
      </ToolbarIconButton>
      <ToolbarIconButton
        title={selectionToggleTitle}
        disabled={selectionToggleDisabled}
        onClick={toggleAllSelection}
        fill
      >
        {hasSelection ? <ClearIcon /> : <SelectAllIcon />}
      </ToolbarIconButton>
    </>
  )

  return (
    <>
      <CssBaseline />
      <Box
        onDragEnter={onInitialDragEnter}
        onDragOver={onInitialDragOver}
        onDragLeave={onInitialDragLeave}
        onDrop={onInitialDrop}
        sx={{ minHeight: '100vh', position: 'relative', bgcolor: '#5f6368' }}
      >
        <Box
          component="header"
          sx={{
            height: MAIN_TOOLBAR_HEIGHT,
            display: 'flex',
            bgcolor: '#323639',
            color: '#f1f3f4',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <Box
            sx={{
              width: leftPaneWidth,
              minWidth: LEFT_PANE_MIN,
              maxWidth: LEFT_PANE_MAX,
              flex: '0 0 auto',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              alignItems: 'center',
              px: 0.5,
              overflowX: 'hidden',
              overflowY: 'hidden',
            }}
          >
            {selectionButtons}
          </Box>

          <Box
            role="separator"
            aria-orientation="vertical"
            onMouseDown={resizeLeftPane}
            sx={{
              width: DIVIDER_WIDTH,
              flex: `0 0 ${DIVIDER_WIDTH}px`,
              height: '100%',
              cursor: 'col-resize',
              bgcolor: '#2f3336',
              borderRight: '1px solid rgba(255,255,255,0.12)',
              borderLeft: '1px solid rgba(0,0,0,0.18)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.10)' },
            }}
          />

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) auto',
                md: 'minmax(120px, 1fr) auto minmax(110px, 1fr)',
              },
              alignItems: 'center',
              gap: { xs: 0, md: 1 },
              px: { xs: 0.5, md: 1 },
              overflow: 'hidden',
            }}
          >
            <Box sx={{ minWidth: 0, display: { xs: 'none', md: 'block' } }}>
              <TextField
                size="small"
                value={outputFilename}
                aria-label="ダウンロードファイル名"
                onChange={(event) => setOutputFilename(event.target.value)}
                onBlur={() => setOutputFilename(normalizePdfFilename(outputFilename))}
                sx={{
                  flex: '1 1 auto',
                  minWidth: 82,
                  maxWidth: { xs: 132, sm: 220, lg: 280 },
                  '& .MuiOutlinedInput-root': {
                    height: 30,
                    borderRadius: '2px',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: '#f1f3f4',
                    fontSize: 13,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.42)' },
                    '&.Mui-focused fieldset': { borderColor: '#8ab4f8' },
                  },
                  '& .MuiInputBase-input': {
                    px: 0.75,
                    py: 0,
                    color: '#f1f3f4',
                    WebkitTextFillColor: '#f1f3f4',
                  },
                }}
              />
            </Box>

            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 0, sm: 0.25 }}
              sx={{ justifySelf: { xs: 'start', md: 'center' }, minWidth: 'max-content' }}
            >
              <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.25 }}>
                <TextField
                  size="small"
                  type="number"
                  value={pageInput}
                  disabled={pages.length === 0}
                  slotProps={{
                    htmlInput: {
                      min: pages.length > 0 ? 1 : 0,
                      max: pages.length,
                      inputMode: 'numeric',
                    },
                  }}
                  onChange={(event) => {
                    const value = event.target.value
                    setPageInput(value)
                    const next = Number(value)
                    if (Number.isInteger(next) && next >= 1 && next <= pages.length) {
                      goToPage(next)
                    }
                  }}
                  onBlur={() => setPageInput(activePosition > 0 ? String(activePosition) : '0')}
                  sx={{
                    width: { xs: 34, sm: 38 },
                    '& .MuiOutlinedInput-root': {
                      height: 28,
                      borderRadius: '2px',
                      bgcolor: 'rgba(255,255,255,0.10)',
                      color: '#f1f3f4',
                      fontSize: 13,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.44)' },
                      '&.Mui-focused fieldset': { borderColor: '#8ab4f8' },
                      '&.Mui-disabled': { color: 'rgba(255,255,255,0.54)' },
                    },
                    '& .MuiInputBase-input': {
                      p: 0,
                      textAlign: 'center',
                      color: '#f1f3f4',
                      WebkitTextFillColor: '#f1f3f4',
                    },
                    '& .MuiInputBase-input.Mui-disabled': {
                      WebkitTextFillColor: 'rgba(255,255,255,0.54)',
                    },
                    '& input[type=number]': { MozAppearance: 'textfield' },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                      {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: { xs: 16, sm: 20 },
                    color: 'rgba(255,255,255,0.82)',
                    fontSize: { xs: 12, sm: 13 },
                    lineHeight: 1,
                  }}
                >
                  / {pages.length}
                </Typography>
              </Stack>
              <ToolbarDivider />
              <ToolbarIconButton
                title="縮小"
                compact
                disabled={pages.length === 0 || previewZoom <= ZOOM_MIN}
                onClick={() => changeZoom(-ZOOM_STEP)}
              >
                <RemoveIcon />
              </ToolbarIconButton>
              <TextField
                size="small"
                type="number"
                value={zoomInput}
                disabled={pages.length === 0}
                aria-label="拡大率"
                slotProps={{
                  htmlInput: { min: Math.round(ZOOM_MIN * 100), max: Math.round(ZOOM_MAX * 100) },
                }}
                onChange={(event) => setZoomInput(event.target.value)}
                onBlur={() => applyZoomPercent(zoomInput)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyZoomPercent(zoomInput)
                  }
                }}
                sx={{
                  width: { xs: 34, sm: 38 },
                  '& .MuiOutlinedInput-root': {
                    height: 28,
                    borderRadius: '2px',
                    bgcolor: 'rgba(255,255,255,0.10)',
                    color: '#f1f3f4',
                    fontSize: 13,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.44)' },
                    '&.Mui-focused fieldset': { borderColor: '#8ab4f8' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.54)' },
                  },
                  '& .MuiInputBase-input': {
                    p: 0,
                    textAlign: 'center',
                    color: '#f1f3f4',
                    WebkitTextFillColor: '#f1f3f4',
                  },
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: 'rgba(255,255,255,0.54)',
                  },
                  '& input[type=number]': { MozAppearance: 'textfield' },
                  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                    {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                }}
              />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontSize: 13 }}>
                %
              </Typography>
              <ToolbarIconButton
                title="拡大"
                compact
                disabled={pages.length === 0 || previewZoom >= ZOOM_MAX}
                onClick={() => changeZoom(ZOOM_STEP)}
              >
                <AddIcon />
              </ToolbarIconButton>
            </Stack>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="flex-end"
              spacing={{ xs: 0, sm: 0.25 }}
              sx={{ justifySelf: 'end', minWidth: 0 }}
            >
              <ToolbarIconButton
                title="印刷"
                disabled={busy || pages.length === 0}
                onClick={() => void onPrint()}
              >
                <PrintIcon />
              </ToolbarIconButton>
              <ToolbarIconButton
                title="PDFをダウンロード"
                disabled={busy || pages.length === 0}
                onClick={() => void onExport()}
              >
                <DownloadIcon />
              </ToolbarIconButton>
              <ToolbarIconButton title="その他" disabled={false} onClick={openMoreMenu}>
                <MoreVertIcon />
              </ToolbarIconButton>
            </Stack>
          </Box>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            hidden
            onChange={(event) => {
              const insertAt = pendingInsertAtRef.current
              pendingInsertAtRef.current = undefined
              void onImport(event.target.files, insertAt)
            }}
          />
          <Menu
            anchorEl={menuAnchorEl}
            open={menuOpen}
            onClose={closeMoreMenu}
            MenuListProps={{ dense: true, 'aria-label': 'その他の操作' }}
          >
            <MenuItem
              disabled={pages.length === 0}
              onClick={() => {
                setTwoPageView((prev) => !prev)
                closeMoreMenu()
              }}
            >
              <ListItemIcon>
                <ViewColumnIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={twoPageView ? '1ページ表示' : '2ページ表示'} />
            </MenuItem>
            <MenuItem
              disabled={pages.length === 0}
              onClick={() => {
                closeMoreMenu()
                void onPrint()
              }}
            >
              <ListItemIcon>
                <PrintIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="印刷" />
            </MenuItem>
          </Menu>
        </Box>

        <Box
          sx={{
            height: `calc(100vh - ${MAIN_TOOLBAR_HEIGHT}px)`,
            minHeight: 0,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <Box
            component="aside"
            sx={{
              width: leftPaneWidth,
              minWidth: LEFT_PANE_MIN,
              maxWidth: LEFT_PANE_MAX,
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: '#f8f9fa',
            }}
          >
            {error && (
              <Alert severity="error" sx={{ m: 1 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <Box
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
              {pages.map((page, index) => {
                const file = filesById.get(page.fileId)
                if (!file) return null
                return (
                  <Box key={page.key} sx={{ display: 'contents' }}>
                    {insertIndex === index && (
                      <InsertSlot
                        index={index}
                        busy={busy}
                        cardWidth={thumbnailCardWidth}
                        cardHeight={thumbnailCardHeight}
                        iconSize={thumbnailIconSize}
                        onFiles={(list, slotIndex) => void onImport(list, slotIndex)}
                        onPages={moveDraggedPages}
                        onMove={setInsertIndex}
                        onPick={openPickerAt}
                      />
                    )}
                    <PageCard
                      pdf={file.pdf}
                      pageIndex={page.pageIndex}
                      rotation={page.rotation}
                      flipped={page.flipped}
                      position={index + 1}
                      total={pages.length}
                      cardWidth={thumbnailCardWidth}
                      cardHeight={thumbnailCardHeight}
                      controlSize={thumbnailControlSize}
                      iconSize={thumbnailIconSize}
                      active={page.key === activeKey}
                      selected={selectedKeys.has(page.key)}
                      onOpen={() => setActiveKey(page.key)}
                      onToggleSelected={(event) => togglePageSelected(page.key, event)}
                      onDragStart={() => beginPageDrag(page.key)}
                      onDragEnd={endPageDrag}
                      onDropAt={(kind) => {
                        if (kind === 'pages') moveDraggedPages(index)
                        else setInsertIndex(index)
                      }}
                      onRotate={(delta) => rotateKeys([page.key], delta)}
                      onFlip={() => flipKeys([page.key])}
                      onDelete={() => removeKeys([page.key])}
                    />
                  </Box>
                )
              })}
              {insertIndex === pages.length && (
                <InsertSlot
                  index={pages.length}
                  busy={busy}
                  cardWidth={thumbnailCardWidth}
                  cardHeight={thumbnailCardHeight}
                  iconSize={thumbnailIconSize}
                  onFiles={(list, slotIndex) => void onImport(list, slotIndex)}
                  onPages={moveDraggedPages}
                  onMove={setInsertIndex}
                  onPick={openPickerAt}
                />
              )}
            </Box>
          </Box>

          <Box
            role="separator"
            aria-orientation="vertical"
            onMouseDown={resizeLeftPane}
            sx={{
              width: DIVIDER_WIDTH,
              flex: `0 0 ${DIVIDER_WIDTH}px`,
              cursor: 'col-resize',
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          />

          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#5f6368',
            }}
          >
            <Box
              tabIndex={0}
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                bgcolor: '#5f6368',
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: -3,
                },
              }}
            >
              {activePage && activeFile ? (
                twoPageView ? (
                  <Box
                    sx={{
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: 3,
                      p: 4,
                    }}
                  >
                    <Box sx={{ flex: '0 1 50%', maxWidth: '50%', minWidth: 0 }}>
                      <PreviewPage
                        compact
                        pdf={activeFile.pdf}
                        pageIndex={activePage.pageIndex}
                        rotation={activePage.rotation}
                        flipped={activePage.flipped}
                        zoom={previewZoom}
                      />
                    </Box>
                    {nextPreviewPage && nextPreviewFile && (
                      <Box sx={{ flex: '0 1 50%', maxWidth: '50%', minWidth: 0 }}>
                        <PreviewPage
                          compact
                          pdf={nextPreviewFile.pdf}
                          pageIndex={nextPreviewPage.pageIndex}
                          rotation={nextPreviewPage.rotation}
                          flipped={nextPreviewPage.flipped}
                          zoom={previewZoom}
                        />
                      </Box>
                    )}
                  </Box>
                ) : (
                  <PreviewPage
                    pdf={activeFile.pdf}
                    pageIndex={activePage.pageIndex}
                    rotation={activePage.rotation}
                    flipped={activePage.flipped}
                    zoom={previewZoom}
                  />
                )
              ) : busy ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100%' }}>
                  <CircularProgress />
                </Stack>
              ) : (
                <Box sx={{ minHeight: '100%' }} />
              )}
            </Box>
          </Box>
        </Box>

        {initialDropEnabled && initialDropActive && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              pointerEvents: 'none',
              bgcolor: 'rgba(138,180,248,0.10)',
              boxShadow: 'inset 0 0 0 3px #8ab4f8',
            }}
          />
        )}
      </Box>
    </>
  )
}

function initialLeftPaneWidth(): number {
  if (typeof window === 'undefined') return LEFT_PANE_FALLBACK
  return clamp(Math.round((window.innerWidth - DIVIDER_WIDTH) / 3), LEFT_PANE_MIN, LEFT_PANE_MAX)
}

interface ToolbarIconButtonProps {
  title: string
  disabled: boolean
  compact?: boolean
  fill?: boolean
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  children: ReactNode
}

function ToolbarIconButton({
  title,
  disabled,
  compact = false,
  fill = false,
  onClick,
  children,
}: ToolbarIconButtonProps) {
  const size = compact ? TOOLBAR_COMPACT_ICON_SIZE : TOOLBAR_ICON_SIZE
  const iconSize = compact ? TOOLBAR_COMPACT_SVG_SIZE : TOOLBAR_SVG_SIZE
  return (
    <Tooltip title={title}>
      <span
        style={{
          alignItems: fill ? 'center' : undefined,
          display: fill ? 'flex' : undefined,
          justifyContent: fill ? 'center' : undefined,
          width: fill ? '100%' : undefined,
        }}
      >
        <IconButton
          aria-label={title}
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            color: 'rgba(255,255,255,0.92)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.26)' },
            '& .MuiSvgIcon-root': { fontSize: iconSize },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function ToolbarDivider() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: '1px',
        flex: '0 0 1px',
        height: 24,
        mx: 0,
        bgcolor: 'rgba(255,255,255,0.24)',
      }}
    />
  )
}

interface InsertSlotProps {
  index: number
  busy: boolean
  cardWidth: number
  cardHeight: number
  iconSize: number
  onFiles: (list: FileList, index: number) => void
  onPages: (index: number) => void
  onMove: (index: number) => void
  onPick: (index: number) => void
}

function InsertSlot({
  index,
  busy,
  cardWidth,
  cardHeight,
  iconSize,
  onFiles,
  onPages,
  onMove,
  onPick,
}: InsertSlotProps) {
  const [active, setActive] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  function trackPointer(event: ReactPointerEvent) {
    const start = pointerStartRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) >= CLICK_MOVE_THRESHOLD) start.moved = true
  }

  return (
    <Card
      variant="outlined"
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${index + 1}番目の位置に挿入`}
      onPointerDown={(event) => {
        pointerStartRef.current = { x: event.clientX, y: event.clientY, moved: false }
      }}
      onPointerMove={trackPointer}
      onClick={(event) => {
        event.stopPropagation()
        const start = pointerStartRef.current
        pointerStartRef.current = null
        if (!busy && !start?.moved) onPick(index)
      }}
      onKeyDown={(event) => {
        if (busy) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPick(index)
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-securepdf-insert-slot', 'move')
        pointerStartRef.current = { x: 0, y: 0, moved: true }
      }}
      onDragEnter={(event) => {
        event.preventDefault()
        setActive(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setActive(true)
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setActive(false)
        if (event.dataTransfer.files.length > 0) {
          onFiles(event.dataTransfer.files, index)
          return
        }
        if (event.dataTransfer.types.includes('application/x-securepdf-pages')) {
          onPages(index)
          return
        }
        if (event.dataTransfer.types.includes('application/x-securepdf-insert-slot')) {
          onMove(index)
        }
      }}
      sx={{
        flex: '0 0 auto',
        width: cardWidth,
        height: cardHeight,
        cursor: busy ? 'default' : 'copy',
        bgcolor: 'common.white',
        color: active ? 'primary.main' : 'text.disabled',
        border: '2px dashed',
        borderColor: active ? 'primary.main' : 'divider',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 120ms ease, color 120ms ease',
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizePdfFilename(filename: string): string {
  const fallback = 'securepdf.pdf'
  const cleaned = filename.trim().replace(/[\\/:*?"<>|]+/g, '_')
  const safeName = cleaned.length > 0 ? cleaned : fallback
  return /\.pdf$/i.test(safeName) ? safeName : `${stripExtension(safeName)}.pdf`
}

function stripExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0) return filename
  return filename.slice(0, index)
}

function hasFileTransfer(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

function downloadFile(name: string, bytes: Uint8Array) {
  const blob = createPdfBlob(bytes)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function printFile(bytes: Uint8Array) {
  const blob = createPdfBlob(bytes)
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }

  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.onload = () => {
    const view = frame.contentWindow
    if (!view) {
      cleanup()
      return
    }
    view.focus()
    view.print()
    window.setTimeout(cleanup, 60_000)
  }
  frame.src = url
  document.body.appendChild(frame)
}

function createPdfBlob(bytes: Uint8Array): Blob {
  // Copy into a plain ArrayBuffer so the Blob part type is unambiguous.
  const part = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Blob([part], { type: 'application/pdf' })
}
