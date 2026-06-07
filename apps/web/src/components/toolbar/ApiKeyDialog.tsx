import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GoogleIcon from '@mui/icons-material/Google'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'

import { t } from '../../app/i18n'
import {
  API_KEY_REQUEST_URL,
  type ApiKeyState,
  clearApiKey,
  issueApiKeyViaPopup,
  isValidApiKey,
  normalizeApiKey,
  prepareAuthPopup,
  saveApiKey,
  subscribeApiKey,
} from '../../lib/session'

interface ApiKeyDialogProps {
  open: boolean
  onClose: () => void
}

function initialState(): ApiKeyState {
  return { apiKey: null, hasKey: false, valid: false }
}

export function ApiKeyDialog({ open, onClose }: ApiKeyDialogProps) {
  const [state, setState] = useState<ApiKeyState>(initialState)
  const [draft, setDraft] = useState({ value: '', dirty: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    severity: 'warning' | 'error'
    text: string
  } | null>(null)

  useEffect(() => subscribeApiKey(setState), [])

  const input = draft.dirty ? draft.value : (state.apiKey ?? '')
  const normalized = useMemo(() => normalizeApiKey(input), [input])
  const hasInput = normalized.length > 0
  const inputValid = isValidApiKey(normalized)
  const helperText = !hasInput ? t('apiKey.notSet') : !inputValid ? t('apiKey.invalid') : undefined
  const helperId = helperText ? 'securepdf-api-key-helper' : undefined
  const apiKeyLabel = inputValid ? (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
      <Box component="span">{t('apiKey.fieldLabel')}</Box>
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: 0.75,
          bgcolor: 'success.main',
          color: 'success.contrastText',
        }}
      >
        <CheckRoundedIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  ) : (
    t('apiKey.fieldLabel')
  )

  const handleInputChange = (value: string) => {
    const next = value.replace(/\s+/g, '')
    const nextNormalized = normalizeApiKey(next)

    setDraft({ value: next, dirty: true })
    setMessage(null)

    if (nextNormalized === '') {
      if (state.hasKey) clearApiKey()
      return
    }
    if (isValidApiKey(nextNormalized)) {
      saveApiKey(nextNormalized)
    }
  }

  const handleIssue = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const issued = await issueApiKeyViaPopup()
      if (!issued) {
        setMessage({ severity: 'warning', text: t('apiKey.issueUnavailable') })
        return
      }
      setDraft({ value: issued, dirty: false })
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('import.officeAuthFailed'),
      })
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    if (busy) return
    setMessage(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="securepdf-auth-dialog-title"
      slotProps={{ paper: { sx: { position: 'relative' } } }}
    >
      <DialogTitle id="securepdf-auth-dialog-title" sx={{ pr: 7 }}>
        {t('apiKey.dialogTitle')}
      </DialogTitle>
      <IconButton
        aria-label={t('apiKey.close')}
        disabled={busy}
        onClick={handleClose}
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseRoundedIcon />
      </IconButton>
      <DialogContent sx={{ pb: 3 }}>
        <Stack spacing={2.25} sx={{ pt: 0.5 }}>
          <TextField
            id="securepdf-api-key"
            label={apiKeyLabel}
            value={input}
            type="password"
            name="securepdf-api-key"
            autoComplete="off"
            placeholder={t('apiKey.placeholder')}
            fullWidth
            disabled={busy}
            error={!hasInput || !inputValid}
            helperText={helperText}
            onChange={(event) => handleInputChange(event.target.value)}
            slotProps={{
              htmlInput: {
                autoComplete: 'off',
                autoCapitalize: 'none',
                spellCheck: false,
                'aria-describedby': helperId,
                'aria-invalid': !hasInput || !inputValid ? 'true' : undefined,
                'data-1p-ignore': 'true',
                'data-lpignore': 'true',
              },
              formHelperText: helperId ? { id: helperId } : undefined,
            }}
            sx={{ '& input': { WebkitTextSecurity: hasInput ? 'disc' : 'none' } }}
          />

          {message && <Alert severity={message.severity}>{message.text}</Alert>}

          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            disabled={busy}
            onClick={handleIssue}
            onFocus={prepareAuthPopup}
            onMouseEnter={prepareAuthPopup}
            onPointerDown={prepareAuthPopup}
          >
            {t('apiKey.issue')}
          </Button>

          <Typography variant="body2" color="text.secondary">
            <Link href={API_KEY_REQUEST_URL} target="_blank" rel="noreferrer" fontWeight={700}>
              {t('apiKey.portfolio')}
            </Link>
            {t('apiKey.portfolioSuffix')}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
