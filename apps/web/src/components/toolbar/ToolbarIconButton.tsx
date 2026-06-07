import { Box, IconButton, Tooltip } from '@mui/material'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'

import { chrome } from '../../app/theme'
import {
  TOOLBAR_COMPACT_ICON_SIZE,
  TOOLBAR_COMPACT_SVG_SIZE,
  TOOLBAR_ICON_SIZE,
  TOOLBAR_SVG_SIZE,
} from '../../lib/constants'

interface ToolbarIconButtonProps {
  title: string
  disabled: boolean
  compact?: boolean
  /** Stretch to fill its grid cell (used by the selection action row). */
  fill?: boolean
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  children: ReactNode
}

export function ToolbarIconButton({
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
      <Box
        component="span"
        sx={{
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
            color: chrome.toolbarIcon,
            '&:hover': { bgcolor: chrome.toolbarHover },
            '&.Mui-disabled': { color: chrome.toolbarDisabled },
            '& .MuiSvgIcon-root': { fontSize: iconSize },
          }}
        >
          {children}
        </IconButton>
      </Box>
    </Tooltip>
  )
}

export function ToolbarDivider() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: '1px',
        flex: '0 0 1px',
        height: 24,
        mx: 0,
        bgcolor: chrome.fieldBorderSubtle,
      }}
    />
  )
}
