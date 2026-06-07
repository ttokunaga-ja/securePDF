import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import GoogleIcon from '@mui/icons-material/Google'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
    severity: 'success' | 'info' | 'warning' | 'error'
    text: string
  } | null>(null)

  useEffect(() => subscribeApiKey(setState), [])

  const input = draft.dirty ? draft.value : (state.apiKey ?? '')
  const normalized = useMemo(() => normalizeApiKey(input), [input])
  const hasInput = normalized.length > 0
  const inputValid = isValidApiKey(normalized)
  const savedSameKey = state.apiKey === normalized
  const descriptionId = !hasInput
    ? 'securepdf-api-key-missing'
    : !inputValid
      ? 'securepdf-api-key-error'
      : undefined
  const apiKeyLabel = inputValid ? (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
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

  const handleSave = () => {
    if (!saveApiKey(normalized)) {
      setMessage({ severity: 'error', text: t('apiKey.invalid') })
      return
    }
    setDraft({ value: normalized, dirty: false })
    setMessage({ severity: 'success', text: t('apiKey.saved') })
  }

  const handleClear = () => {
    clearApiKey()
    setDraft({ value: '', dirty: false })
    setMessage({ severity: 'info', text: t('apiKey.cleared') })
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
      setMessage({ severity: 'success', text: t('apiKey.issueSuccess') })
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('import.officeAuthFailed'),
      })
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!state.apiKey) return
    try {
      await navigator.clipboard.writeText(state.apiKey)
      setMessage({ severity: 'success', text: t('apiKey.copied') })
    } catch {
      setMessage({ severity: 'error', text: t('export.failed') })
    }
  }

  const handleClose = () => {
    if (busy) return
    setMessage(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('apiKey.dialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 0.5 }}>
          <TextField
            id="securepdf-api-key"
            label={apiKeyLabel}
            value={input}
            type="text"
            name="securepdf-api-key"
            autoComplete="off"
            placeholder={t('apiKey.placeholder')}
            fullWidth
            disabled={busy}
            error={hasInput && !inputValid}
            onChange={(event) =>
              setDraft({ value: event.target.value.replace(/\s+/g, ''), dirty: true })
            }
            slotProps={{
              htmlInput: {
                autoComplete: 'off',
                autoCapitalize: 'none',
                spellCheck: false,
                'aria-describedby': descriptionId,
                'aria-invalid': hasInput && !inputValid ? 'true' : undefined,
                'data-1p-ignore': 'true',
                'data-lpignore': 'true',
              },
            }}
            sx={{ '& input': { WebkitTextSecurity: hasInput ? 'disc' : 'none' } }}
          />

          {!hasInput ? (
            <Alert
              id="securepdf-api-key-missing"
              severity="warning"
              icon={<KeyRoundedIcon />}
              sx={{ alignItems: 'center' }}
            >
              {t('apiKey.notSet')}
            </Alert>
          ) : !inputValid ? (
            <Alert id="securepdf-api-key-error" severity="error">
              {t('apiKey.invalid')}
            </Alert>
          ) : (
            <Alert severity="success">{t('apiKey.valid')}</Alert>
          )}

          {message && <Alert severity={message.severity}>{message.text}</Alert>}

          <Stack spacing={1}>
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
              {t('apiKey.issueHelp')}
            </Typography>
            <Alert severity="info" sx={{ py: 0.75 }}>
              {t('apiKey.issueRotates')}
            </Alert>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {t('apiKey.portfolioHelp')}{' '}
            <Link href={API_KEY_REQUEST_URL} target="_blank" rel="noreferrer" fontWeight={700}>
              {t('apiKey.portfolio')}
              <OpenInNewRoundedIcon sx={{ ml: 0.4, fontSize: 14, verticalAlign: '-2px' }} />
            </Link>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          {t('apiKey.close')}
        </Button>
        <Button onClick={handleClear} disabled={busy || !state.hasKey} color="error">
          {t('apiKey.delete')}
        </Button>
        <Button
          onClick={handleCopy}
          disabled={busy || !state.valid}
          startIcon={<ContentCopyRoundedIcon />}
        >
          {t('apiKey.copy')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !inputValid || savedSameKey}
        >
          {t('apiKey.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
