import { Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'

import { t } from '../../app/i18n'
import { chrome } from '../../app/theme'
import { useDocActions, useDocState } from '../../features/document/DocumentContext'
import { selectActivePosition } from '../../features/document/selectors'
import { numberFieldSx } from './fieldStyles'

/** Current page indicator and jump-to-page input ("3 / 12"). */
export function PageNavigator() {
  const state = useDocState()
  const { goToPage } = useDocActions()
  const pageCount = state.pages.length
  const activePosition = selectActivePosition(state)
  const [pageInput, setPageInput] = useState(() => String(activePosition))
  const [lastPosition, setLastPosition] = useState(activePosition)

  // Mirror the active page into the editable field (recommended alternative to a
  // syncing effect).
  if (activePosition !== lastPosition) {
    setLastPosition(activePosition)
    setPageInput(activePosition > 0 ? String(activePosition) : '0')
  }

  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.25 }}>
      <TextField
        size="small"
        type="number"
        value={pageInput}
        disabled={pageCount === 0}
        slotProps={{
          htmlInput: {
            min: pageCount > 0 ? 1 : 0,
            max: pageCount,
            inputMode: 'numeric',
            'aria-label': t('toolbar.pageLabel'),
          },
        }}
        onChange={(event) => {
          const value = event.target.value
          setPageInput(value)
          const next = Number(value)
          if (Number.isInteger(next) && next >= 1 && next <= pageCount) goToPage(next)
        }}
        onBlur={() => setPageInput(activePosition > 0 ? String(activePosition) : '0')}
        sx={numberFieldSx}
      />
      <Typography
        variant="body2"
        sx={{
          minWidth: { xs: 16, sm: 20 },
          color: chrome.toolbarTextMuted,
          fontSize: { xs: 12, sm: 13 },
          lineHeight: 1,
        }}
      >
        / {pageCount}
      </Typography>
    </Stack>
  )
}
