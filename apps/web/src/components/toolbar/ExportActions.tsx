import DownloadIcon from '@mui/icons-material/Download'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PrintIcon from '@mui/icons-material/Print'
import { Stack } from '@mui/material'
import type { MouseEvent as ReactMouseEvent } from 'react'

import { t } from '../../app/i18n'
import { ToolbarIconButton } from './ToolbarIconButton'

interface ExportActionsProps {
  disabled: boolean
  onPrint: () => void
  onExport: () => void
  onOpenMenu: (event: ReactMouseEvent<HTMLElement>) => void
}

/** Print, download and overflow-menu buttons at the toolbar's right edge. */
export function ExportActions({ disabled, onPrint, onExport, onOpenMenu }: ExportActionsProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-end"
      spacing={{ xs: 0, sm: 0.25 }}
      sx={{ justifySelf: 'end', minWidth: 0 }}
    >
      <ToolbarIconButton title={t('toolbar.print')} disabled={disabled} onClick={onPrint}>
        <PrintIcon />
      </ToolbarIconButton>
      <ToolbarIconButton title={t('toolbar.download')} disabled={disabled} onClick={onExport}>
        <DownloadIcon />
      </ToolbarIconButton>
      <ToolbarIconButton title={t('toolbar.more')} disabled={false} onClick={onOpenMenu}>
        <MoreVertIcon />
      </ToolbarIconButton>
    </Stack>
  )
}
