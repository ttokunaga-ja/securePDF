import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'

import { t } from '../../app/i18n'

interface MoreMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  pagesEmpty: boolean
  twoPageView: boolean
  onClose: () => void
  onOpenApiKey: () => void
  onToggleTwoPageView: () => void
}

/** Overflow menu: view options and authentication settings. */
export function MoreMenu({
  anchorEl,
  open,
  pagesEmpty,
  twoPageView,
  onClose,
  onOpenApiKey,
  onToggleTwoPageView,
}: MoreMenuProps) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      MenuListProps={{ dense: true, 'aria-label': t('toolbar.moreMenuLabel') }}
    >
      <MenuItem
        disabled={pagesEmpty}
        onClick={() => {
          onToggleTwoPageView()
          onClose()
        }}
      >
        <ListItemIcon>
          <ViewColumnIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={twoPageView ? t('toolbar.singlePageView') : t('toolbar.twoPageView')}
        />
      </MenuItem>
      <MenuItem
        onClick={() => {
          onClose()
          onOpenApiKey()
        }}
      >
        <ListItemIcon>
          <KeyRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('toolbar.apiKey')} />
      </MenuItem>
    </Menu>
  )
}
