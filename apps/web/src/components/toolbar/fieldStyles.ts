import type { SxProps, Theme } from '@mui/material'

import { chrome } from '../../app/theme'

/** Shared styling for the toolbar's compact number fields (page navigator and
 *  zoom). Identical between the two; centralised so they can't drift. */
export const numberFieldSx: SxProps<Theme> = {
  width: { xs: 34, sm: 38 },
  '& .MuiOutlinedInput-root': {
    height: 28,
    borderRadius: '2px',
    bgcolor: chrome.fieldBg,
    color: chrome.toolbarText,
    fontSize: 13,
    '& fieldset': { borderColor: chrome.fieldBorder },
    '&:hover fieldset': { borderColor: chrome.fieldBorderHover },
    '&.Mui-focused fieldset': { borderColor: chrome.accent },
    '&.Mui-disabled': { color: chrome.textFillDisabled },
  },
  '& .MuiInputBase-input': {
    p: 0,
    textAlign: 'center',
    color: chrome.toolbarText,
    WebkitTextFillColor: chrome.toolbarText,
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: chrome.textFillDisabled,
  },
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
    {
      WebkitAppearance: 'none',
      margin: 0,
    },
}
