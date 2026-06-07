import { Box, Stack } from '@mui/material'
import { type PointerEvent as ReactPointerEvent, useState } from 'react'

import { chrome } from '../app/theme'
import { useDocState } from '../features/document/DocumentContext'
import { LEFT_PANE_MAX, LEFT_PANE_MIN, MAIN_TOOLBAR_HEIGHT } from '../lib/constants'
import { ResizableDivider } from './ResizableDivider'
import { ApiKeyDialog } from './toolbar/ApiKeyDialog'
import { ExportActions } from './toolbar/ExportActions'
import { FilenameField } from './toolbar/FilenameField'
import { MoreMenu } from './toolbar/MoreMenu'
import { PageNavigator } from './toolbar/PageNavigator'
import { SelectionActions } from './toolbar/SelectionActions'
import { ToolbarDivider } from './toolbar/ToolbarIconButton'
import { ZoomControl } from './toolbar/ZoomControl'

interface MainToolbarProps {
  leftPaneWidth: number
  busy: boolean
  outputFilename: string
  onOutputFilenameChange: (value: string) => void
  onCommitFilename: () => void
  zoom: number
  zoomInput: string
  onZoomInputChange: (value: string) => void
  onChangeZoom: (delta: number) => void
  onApplyZoomPercent: (value: string) => void
  twoPageView: boolean
  onToggleTwoPageView: () => void
  onExport: () => void
  onPrint: () => void
  onResizeStart: (event: ReactPointerEvent) => void
}

/** The top toolbar: selection actions (left pane), filename, page navigation,
 *  zoom, and export controls (right). Owns the overflow-menu anchor. */
export function MainToolbar(props: MainToolbarProps) {
  const { pages } = useDocState()
  const pagesEmpty = pages.length === 0
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)

  return (
    <Box
      component="header"
      sx={{
        height: MAIN_TOOLBAR_HEIGHT,
        display: 'flex',
        bgcolor: chrome.toolbarBg,
        color: chrome.toolbarText,
        borderBottom: `1px solid ${chrome.dividerOnDark}`,
      }}
    >
      <Box
        sx={{
          width: props.leftPaneWidth,
          minWidth: LEFT_PANE_MIN,
          maxWidth: LEFT_PANE_MAX,
          flex: '0 0 auto',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          alignItems: 'center',
          px: 0.5,
          overflow: 'hidden',
        }}
      >
        <SelectionActions busy={props.busy} />
      </Box>

      <ResizableDivider variant="dark" presentational onResizeStart={props.onResizeStart} />

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
        <FilenameField
          value={props.outputFilename}
          onChange={props.onOutputFilenameChange}
          onCommit={props.onCommitFilename}
        />

        <Stack
          direction="row"
          alignItems="center"
          spacing={{ xs: 0, sm: 0.25 }}
          sx={{ justifySelf: { xs: 'start', md: 'center' }, minWidth: 'max-content' }}
        >
          <PageNavigator />
          <ToolbarDivider />
          <ZoomControl
            zoom={props.zoom}
            zoomInput={props.zoomInput}
            pagesEmpty={pagesEmpty}
            onZoomInputChange={props.onZoomInputChange}
            onChangeZoom={props.onChangeZoom}
            onApplyZoomPercent={props.onApplyZoomPercent}
          />
        </Stack>

        <ExportActions
          disabled={props.busy || pagesEmpty}
          onPrint={props.onPrint}
          onExport={props.onExport}
          onOpenMenu={(event) => setMenuAnchorEl(event.currentTarget)}
        />
      </Box>

      <MoreMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        pagesEmpty={pagesEmpty}
        twoPageView={props.twoPageView}
        onClose={() => setMenuAnchorEl(null)}
        onOpenApiKey={() => setApiKeyDialogOpen(true)}
        onToggleTwoPageView={props.onToggleTwoPageView}
        onPrint={props.onPrint}
      />
      {apiKeyDialogOpen && <ApiKeyDialog open onClose={() => setApiKeyDialogOpen(false)} />}
    </Box>
  )
}
