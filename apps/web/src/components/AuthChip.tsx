import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

import { t } from '../app/i18n'
import { ensureApiKey, type SessionState, signOutSession, subscribe } from '../lib/session'

/** Floating sign-in / credits indicator (bottom-right). Renders nothing unless
 *  auth is configured (VITE_FIREBASE_* present), so dev/tests are unaffected. */
export function AuthChip() {
  const [state, setState] = useState<SessionState | null>(null)
  useEffect(() => subscribe(setState), [])

  if (!state?.configured) return null

  return (
    <Box sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1400 }}>
      {state.user ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ bgcolor: 'background.paper', boxShadow: 3, borderRadius: 2, px: 1.5, py: 0.5 }}
        >
          <Typography
            variant="caption"
            sx={{
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {state.user.email ?? state.user.displayName ?? ''}
          </Typography>
          {state.credits && (
            <Chip
              size="small"
              label={t('auth.credits', {
                remaining: String(state.credits.remaining),
                limit: String(state.credits.limit),
              })}
            />
          )}
          <Button size="small" onClick={() => void signOutSession()}>
            {t('auth.signOut')}
          </Button>
        </Stack>
      ) : (
        <Button
          variant="contained"
          size="small"
          sx={{ boxShadow: 3 }}
          onClick={() => {
            void ensureApiKey().catch(() => {
              /* user dismissed the popup */
            })
          }}
        >
          {t('auth.signIn')}
        </Button>
      )}
    </Box>
  )
}
