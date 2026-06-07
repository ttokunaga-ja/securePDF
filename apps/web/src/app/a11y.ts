import type { SxProps, Theme } from '@mui/material'

/** Visually-hidden but screen-reader-accessible. For skip-link targets, the page
 *  `<h1>`, and `aria-live` status regions that shouldn't take visual space. */
export const srOnly: SxProps<Theme> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
