import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { TextField, Typography } from '@mui/material'

import { t } from '../../app/i18n'
import { chrome } from '../../app/theme'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../lib/constants'
import { numberFieldSx } from './fieldStyles'
import { ToolbarIconButton } from './ToolbarIconButton'

interface ZoomControlProps {
  zoom: number
  zoomInput: string
  pagesEmpty: boolean
  onZoomInputChange: (value: string) => void
  onChangeZoom: (delta: number) => void
  onApplyZoomPercent: (value: string) => void
}

/** Zoom out / percent field / zoom in cluster for the preview. */
export function ZoomControl({
  zoom,
  zoomInput,
  pagesEmpty,
  onZoomInputChange,
  onChangeZoom,
  onApplyZoomPercent,
}: ZoomControlProps) {
  return (
    <>
      <ToolbarIconButton
        title={t('toolbar.zoomOut')}
        compact
        disabled={pagesEmpty || zoom <= ZOOM_MIN}
        onClick={() => onChangeZoom(-ZOOM_STEP)}
      >
        <RemoveIcon />
      </ToolbarIconButton>
      <TextField
        size="small"
        type="number"
        value={zoomInput}
        disabled={pagesEmpty}
        slotProps={{
          htmlInput: {
            min: Math.round(ZOOM_MIN * 100),
            max: Math.round(ZOOM_MAX * 100),
            'aria-label': t('toolbar.zoomLabel'),
          },
        }}
        onChange={(event) => onZoomInputChange(event.target.value)}
        onBlur={() => onApplyZoomPercent(zoomInput)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onApplyZoomPercent(zoomInput)
          }
        }}
        sx={numberFieldSx}
      />
      <Typography variant="body2" sx={{ color: chrome.toolbarTextMuted, fontSize: 13 }}>
        %
      </Typography>
      <ToolbarIconButton
        title={t('toolbar.zoomIn')}
        compact
        disabled={pagesEmpty || zoom >= ZOOM_MAX}
        onClick={() => onChangeZoom(ZOOM_STEP)}
      >
        <AddIcon />
      </ToolbarIconButton>
    </>
  )
}
