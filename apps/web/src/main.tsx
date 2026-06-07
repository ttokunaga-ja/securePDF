import { CssBaseline, ThemeProvider } from '@mui/material'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { theme } from './app/theme'
import { DocumentProvider } from './features/document/DocumentContext'

const container = document.getElementById('root')
if (!container) {
  throw new Error('#root element not found')
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <DocumentProvider>
          <App />
        </DocumentProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
