import { afterEach, describe, expect, it } from 'vitest'

import { clearApiKey, saveApiKey } from '../../lib/session'
import { hasOfficeInput, shouldRequestOfficeAuth } from './importAuth'

function file(name: string, type = ''): File {
  return new File(['x'], name, { type })
}

describe('import auth gate', () => {
  afterEach(() => {
    clearApiKey()
  })

  it('does not request auth for browser-local formats', () => {
    const files = [file('a.pdf', 'application/pdf'), file('b.png', 'image/png')]

    expect(hasOfficeInput(files)).toBe(false)
    expect(shouldRequestOfficeAuth(files)).toBe(false)
  })

  it('requests auth once when a mixed selection contains Office input', () => {
    const files = [file('a.pdf', 'application/pdf'), file('b.docx')]

    expect(hasOfficeInput(files)).toBe(true)
    expect(shouldRequestOfficeAuth(files)).toBe(true)
  })

  it('does not request auth when a valid API key is already available', () => {
    saveApiKey(`tkp_${'a'.repeat(64)}`)

    expect(shouldRequestOfficeAuth([file('report.xlsx')])).toBe(false)
  })
})
