import { Box } from '@mui/material'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { t } from '../app/i18n'
import { chrome } from '../app/theme'
import { DIVIDER_WIDTH } from '../lib/constants'

const RESIZE_STEP = 24

interface ResizableDividerProps {
  onResizeStart: (event: ReactPointerEvent) => void
  /** 'dark' for the toolbar seam, 'light' for the body seam. */
  variant: 'dark' | 'light'
  /** Decorative seam: pointer-resizable but kept out of the a11y tree so it
   *  doesn't duplicate the body divider's keyboard-operable separator. */
  presentational?: boolean
  /** Current pane width and bounds — required for the (non-presentational)
   *  separator's value semantics and keyboard resize. */
  value?: number
  min?: number
  max?: number
  onResize?: (delta: number) => void
}

const variantSx = {
  dark: {
    bgcolor: chrome.dividerSeam,
    borderRight: `1px solid ${chrome.dividerOnDark}`,
    borderLeft: `1px solid ${chrome.dividerSeamShadow}`,
    '&:hover': { bgcolor: chrome.fieldBg },
  },
  light: {
    bgcolor: 'background.paper',
    borderRight: '1px solid',
    borderColor: 'divider',
    '&:hover': { bgcolor: 'action.hover' },
  },
} as const

const baseSx = {
  position: 'relative',
  width: DIVIDER_WIDTH,
  flex: `0 0 ${DIVIDER_WIDTH}px`,
  height: '100%',
  cursor: 'col-resize',
  touchAction: 'none',
  // Keep the visible seam at DIVIDER_WIDTH but widen the pointer hit area to 24px
  // (WCAG 2.2 SC 2.5.8) with an invisible overlay.
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${-(24 - DIVIDER_WIDTH) / 2}px`,
    right: `${-(24 - DIVIDER_WIDTH) / 2}px`,
  },
} as const

/** Vertical drag handle that resizes the thumbnail pane. The body seam is an ARIA
 *  separator operable by pointer (mouse/pen/touch) and keyboard (←/→, Home/End);
 *  the toolbar seam is `presentational` (pointer only) to avoid a duplicate. */
export function ResizableDivider({
  onResizeStart,
  variant,
  presentational = false,
  value = 0,
  min = 0,
  max = 0,
  onResize,
}: ResizableDividerProps) {
  if (presentational) {
    return (
      <Box
        aria-hidden="true"
        onPointerDown={onResizeStart}
        sx={{ ...baseSx, ...variantSx[variant] }}
      />
    )
  }
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={t('toolbar.resizePane')}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onResizeStart}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          onResize?.(-RESIZE_STEP)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          onResize?.(RESIZE_STEP)
        } else if (event.key === 'Home') {
          event.preventDefault()
          onResize?.(min - value)
        } else if (event.key === 'End') {
          event.preventDefault()
          onResize?.(max - value)
        }
      }}
      sx={{
        ...baseSx,
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: chrome.focusRing,
          outlineOffset: -2,
        },
        ...variantSx[variant],
      }}
    />
  )
}
