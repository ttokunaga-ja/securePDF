import { Box, TextField } from '@mui/material'

import { t } from '../../app/i18n'
import { chrome } from '../../app/theme'

interface FilenameFieldProps {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
}

/** The output filename input in the toolbar (hidden below md). */
export function FilenameField({ value, onChange, onCommit }: FilenameFieldProps) {
  return (
    <Box sx={{ minWidth: 0, display: { xs: 'none', md: 'block' } }}>
      <TextField
        size="small"
        value={value}
        slotProps={{ htmlInput: { 'aria-label': t('toolbar.filenameLabel') } }}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        sx={{
          flex: '1 1 auto',
          minWidth: 82,
          maxWidth: { xs: 132, sm: 220, lg: 280 },
          '& .MuiOutlinedInput-root': {
            height: 30,
            borderRadius: '2px',
            bgcolor: chrome.fieldBgSubtle,
            color: chrome.toolbarText,
            fontSize: 13,
            '& fieldset': { borderColor: chrome.fieldBorderSubtle },
            '&:hover fieldset': { borderColor: chrome.fieldBorderSubtleHover },
            '&.Mui-focused fieldset': { borderColor: chrome.accent },
          },
          '& .MuiInputBase-input': {
            px: 0.75,
            py: 0,
            color: chrome.toolbarText,
            WebkitTextFillColor: chrome.toolbarText,
          },
        }}
      />
    </Box>
  )
}
