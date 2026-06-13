import { Box } from '@mui/material'
import { OFFICE_EXTENSIONS, OFFICE_INPUT_FORMATS } from '@securepdf/schema'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { srOnly } from './app/a11y'
import { t } from './app/i18n'
import { InitialDropZone } from './components/InitialDropZone'
import { MainToolbar } from './components/MainToolbar'
import { PreviewArea } from './components/PreviewArea'
import { ResizableDivider } from './components/ResizableDivider'
import { ThumbnailRail } from './components/ThumbnailRail'
import { ApiKeyDialog } from './components/toolbar/ApiKeyDialog'
import { useDocActions, useDocState } from './features/document/DocumentContext'
import { useAsyncTask } from './features/document/hooks/useAsyncTask'
import { type ImportFromList, useFileImport } from './features/document/hooks/useFileImport'
import { useFilePicker } from './features/document/hooks/useFilePicker'
import { usePdfExport } from './features/document/hooks/usePdfExport'
import { shouldRequestOfficeAuth } from './features/document/importAuth'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePreviewZoom } from './hooks/usePreviewZoom'
import { useResizablePane } from './hooks/useResizablePane'
import { MAIN_TOOLBAR_HEIGHT } from './lib/constants'
import { printCurrentPage } from './lib/export'
import { normalizePdfFilename } from './lib/filename'
import { infoPageForPath } from './lib/infoRoutes'
import { prepareAuthPopup } from './lib/session'

const InfoPage = lazy(() =>
  import('./components/InfoPage').then((module) => ({ default: module.InfoPage })),
)

/** Accepted import types: PDF and JPEG/PNG (handled in-browser) plus Office
 *  formats (docx/xlsx/pptx, converted server-side via the Worker → GAS backend). */
const FILE_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  ...OFFICE_INPUT_FORMATS,
  ...OFFICE_EXTENSIONS,
].join(',')

interface PendingAuthImport {
  files: File[]
  insertAt?: number
}

/** Route switch: the editor stays the default route; public docs are loaded only
 *  when a /docs/... path is opened. */
export default function App() {
  const infoPage = infoPageForPath(typeof window === 'undefined' ? '/' : window.location.pathname)

  return infoPage ? (
    <Suspense fallback={<Box sx={{ minHeight: '100vh', bgcolor: '#f5f7f8' }} />}>
      <InfoPage page={infoPage} />
    </Suspense>
  ) : (
    <EditorApp />
  )
}

/** Thin editor shell: wires UI-local state (filename, two-page view, pane width,
 *  zoom) and the import/export hooks to the toolbar, thumbnail rail and preview.
 *  All document-editing state lives in the DocumentProvider (see main.tsx). */
function EditorApp() {
  const [outputFilename, setOutputFilename] = useState('securepdf.pdf')
  const [twoPageView, setTwoPageView] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [pendingAuthImport, setPendingAuthImport] = useState<PendingAuthImport | null>(null)
  const [preInputAdsDismissed, setPreInputAdsDismissed] = useState(false)

  const { files, pages } = useDocState()
  const actions = useDocActions()
  const pane = useResizablePane()
  const zoom = usePreviewZoom()
  const task = useAsyncTask()
  const { setError: setTaskError } = task
  const importFiles = useFileImport(task, setOutputFilename)
  const importFilesWithAuthGate = useCallback<ImportFromList>(
    (list, insertAt) => {
      const items = list ? Array.from(list) : []
      if (items.length === 0) return
      setPreInputAdsDismissed(true)

      if (shouldRequestOfficeAuth(items)) {
        setPendingAuthImport({ files: items, insertAt })
        setApiKeyDialogOpen(true)
        setTaskError(null)
        return
      }

      importFiles(items, insertAt)
    },
    [importFiles, setTaskError],
  )
  const { inputRef, openPickerAt, onInputChange } = useFilePicker(importFilesWithAuthGate)
  const { exportPdf } = usePdfExport(task, outputFilename, setOutputFilename)

  const handlePickAt = useCallback(
    (insertAt?: number) => {
      setPreInputAdsDismissed(true)
      openPickerAt(insertAt)
    },
    [openPickerAt],
  )

  const handleOpenApiKey = useCallback(() => {
    setPendingAuthImport(null)
    setApiKeyDialogOpen(true)
  }, [])

  const handleCloseApiKey = useCallback(() => {
    setApiKeyDialogOpen(false)
    setPendingAuthImport(null)
  }, [])

  const handleApiKeyReady = useCallback(() => {
    if (!pendingAuthImport) return
    setPendingAuthImport(null)
    setApiKeyDialogOpen(false)
    importFiles(pendingAuthImport.files, pendingAuthImport.insertAt)
  }, [importFiles, pendingAuthImport])

  useKeyboardShortcuts({
    selectAll: actions.selectAll,
    zoomBy: zoom.changeZoom,
    zoomReset: zoom.reset,
    moveBy: actions.moveDirection,
    activateBy: actions.activateNeighbor,
    removeTargets: actions.removeTargets,
    rotateTargets: actions.rotateTargets,
    flipTargets: actions.flipTargets,
  })

  useEffect(() => {
    // Start loading the Firebase chunk immediately on mount so it is ready
    // before the user's first drag-and-drop or file-picker selection.
    // Without this, the first Office import attempt may hit an unloaded client
    // and await a network fetch, losing the browser's transient user activation
    // before signInWithPopup is reached.
    prepareAuthPopup()
  }, [])

  const initialDropEnabled = files.length === 0 && pages.length === 0
  const showPreInputAds = initialDropEnabled && !preInputAdsDismissed && !task.busy

  return (
    <InitialDropZone
      enabled={initialDropEnabled}
      onDropFiles={(list) => importFilesWithAuthGate(list, 0)}
    >
      <Box
        component="a"
        href="#main-preview"
        sx={{
          position: 'absolute',
          left: 8,
          top: 8,
          zIndex: 3000,
          px: 2,
          py: 1,
          borderRadius: 1,
          fontSize: 14,
          textDecoration: 'none',
          color: 'primary.main',
          bgcolor: 'background.paper',
          boxShadow: 3,
          transform: 'translateY(calc(-100% - 16px))',
          transition: 'transform 120ms ease',
          '&:focus': { transform: 'translateY(0)' },
        }}
      >
        {t('app.skipToMain')}
      </Box>
      <Box component="h1" sx={srOnly}>
        {t('app.heading')}
      </Box>
      <MainToolbar
        leftPaneWidth={pane.width}
        busy={task.busy}
        outputFilename={outputFilename}
        onOutputFilenameChange={setOutputFilename}
        onCommitFilename={() => setOutputFilename(normalizePdfFilename(outputFilename))}
        zoom={zoom.zoom}
        zoomInput={zoom.zoomInput}
        onZoomInputChange={zoom.setZoomInput}
        onChangeZoom={zoom.changeZoom}
        onApplyZoomPercent={zoom.applyZoomPercent}
        twoPageView={twoPageView}
        onToggleTwoPageView={() => setTwoPageView((prev) => !prev)}
        onOpenApiKey={handleOpenApiKey}
        onExport={exportPdf}
        onPrint={printCurrentPage}
        onResizeStart={pane.onResizeStart}
      />

      {apiKeyDialogOpen && (
        <ApiKeyDialog
          open
          notice={pendingAuthImport ? t('import.officeAuthRequired') : undefined}
          onClose={handleCloseApiKey}
          onApiKeyReady={handleApiKeyReady}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        hidden
        aria-label={t('app.fileInput')}
        onChange={onInputChange}
      />

      <Box
        data-print-workspace
        sx={{
          height: `calc(100vh - ${MAIN_TOOLBAR_HEIGHT}px)`,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <ThumbnailRail
          width={pane.width}
          busy={task.busy}
          error={task.error}
          onDismissError={() => task.setError(null)}
          onImportFiles={importFilesWithAuthGate}
          onPickAt={handlePickAt}
        />
        <ResizableDivider
          variant="light"
          value={pane.width}
          min={pane.min}
          max={pane.max}
          onResize={pane.resizeBy}
          onResizeStart={pane.onResizeStart}
        />
        <PreviewArea
          twoPageView={twoPageView}
          zoom={zoom.zoom}
          busy={task.busy}
          showPreInputAds={showPreInputAds}
          onOpenFiles={handlePickAt}
        />
      </Box>
    </InitialDropZone>
  )
}
