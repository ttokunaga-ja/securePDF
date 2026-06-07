import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'

import { t } from '../../app/i18n'
import { infoPathForPage } from '../../lib/infoRoutes'

interface MoreMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  pagesEmpty: boolean
  twoPageView: boolean
  onClose: () => void
  onOpenApiKey: () => void
  onToggleTwoPageView: () => void
}

/** Overflow menu: view options, authentication settings, and public docs. */
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
      <Divider />
      <MenuItem component="a" href={infoPathForPage('overview')} onClick={onClose}>
        <ListItemIcon>
          <InfoOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('toolbar.serviceOverview')} />
      </MenuItem>
      <MenuItem component="a" href={infoPathForPage('security')} onClick={onClose}>
        <ListItemIcon>
          <SecurityRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('toolbar.securityPolicy')} />
      </MenuItem>
      <MenuItem component="a" href={infoPathForPage('api')} onClick={onClose}>
        <ListItemIcon>
          <CodeRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t('toolbar.apiDocs')} />
      </MenuItem>
    </Menu>
  )
}
