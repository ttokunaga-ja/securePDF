import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { theme } from '../app/theme'
import { infoPageForPath, infoPathForPage } from '../lib/infoRoutes'
import { InfoPage } from './InfoPage'

describe('InfoPage', () => {
  it('maps public documentation paths to Markdown pages', () => {
    expect(infoPageForPath('/docs/overview/')).toBe('overview')
    expect(infoPageForPath('/docs/security')).toBe('security')
    expect(infoPageForPath('/docs/api/')).toBe('api')
    expect(infoPathForPage('api')).toBe('/docs/api/')
  })

  it('renders the API Markdown document', () => {
    render(
      <ThemeProvider theme={theme}>
        <InfoPage page="api" />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'APIドキュメント' })).toBeVisible()
    expect(screen.getByRole('link', { name: '/openapi.json' })).toHaveAttribute(
      'href',
      '/openapi.json',
    )
  })
})
