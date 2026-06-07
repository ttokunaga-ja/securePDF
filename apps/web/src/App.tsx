import { Box } from '@mui/material'
import { OFFICE_EXTENSIONS, OFFICE_INPUT_FORMATS } from '@securepdf/schema'
import { useState } from 'react'

import { srOnly } from './app/a11y'
import { t } from './app/i18n'
import { InitialDropZone } from './components/InitialDropZone'
import { MainToolbar } from './components/MainToolbar'
import { PreviewArea } from './components/PreviewArea'
import { ResizableDivider } from './components/ResizableDivider'
import { ThumbnailRail } from './components/ThumbnailRail'
import { useDocActions, useDocState } from './features/document/DocumentContext'
import { useAsyncTask } from './features/document/hooks/useAsyncTask'
import { useFileImport } from './features/document/hooks/useFileImport'
import { useFilePicker } from './features/document/hooks/useFilePicker'
import { usePdfExport } from './features/document/hooks/usePdfExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { usePreviewZoom } from './hooks/usePreviewZoom'
import { useResizablePane } from './hooks/useResizablePane'
import { MAIN_TOOLBAR_HEIGHT } from './lib/constants'
import { normalizePdfFilename } from './lib/filename'

/** Accepted import types: PDF and JPEG/PNG (handled in-browser) plus Office
 *  formats (docx/xlsx/pptx, converted server-side via the Worker → GAS backend). */
const FILE_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  ...OFFICE_INPUT_FORMATS,
  ...OFFICE_EXTENSIONS,
].join(',')

/** Thin layout shell: wires UI-local state (filename, two-page view, pane width,
 *  zoom) and the import/export hooks to the toolbar, thumbnail rail and preview.
 *  All document-editing state lives in the DocumentProvider (see main.tsx). */
export default function App() {
  const [outputFilename, setOutputFilename] = useState('securepdf.pdf')
  const [twoPageView, setTwoPageView] = useState(false)

  const { files, pages } = useDocState()
  const actions = useDocActions()
  const pane = useResizablePane()
  const zoom = usePreviewZoom()
  const task = useAsyncTask()
  const importFiles = useFileImport(task, setOutputFilename)
  const { inputRef, openPickerAt, onInputChange } = useFilePicker(importFiles)
  const { exportPdf, printPdf } = usePdfExport(task, outputFilename, setOutputFilename)

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

  const initialDropEnabled = files.length === 0 && pages.length === 0

  return (
    <InitialDropZone enabled={initialDropEnabled} onDropFiles={(list) => importFiles(list, 0)}>
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
        onExport={exportPdf}
        onPrint={printPdf}
        onResizeStart={pane.onResizeStart}
      />

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
          onImportFiles={importFiles}
          onPickAt={openPickerAt}
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
          onOpenFiles={() => openPickerAt()}
        />
      </Box>
    </InitialDropZone>
  )
}
