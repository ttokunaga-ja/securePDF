import { Alert, AlertTitle, Box, Button } from '@mui/material'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { t } from './i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Catches render-time errors (e.g. an unexpected pdf.js/core failure) and shows
 *  a recoverable fallback instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Alert
          severity="error"
          sx={{ maxWidth: 480 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              {t('app.crashed.reload')}
            </Button>
          }
        >
          <AlertTitle>{t('app.crashed.title')}</AlertTitle>
          {t('app.crashed.body')}
        </Alert>
      </Box>
    )
  }
}
