import { describe, expect, it } from 'vitest'

import { isOfficeInput, officeMimeFor } from './office'

describe('isOfficeInput', () => {
  it('detects by extension regardless of MIME (case-insensitive)', () => {
    expect(isOfficeInput('report.docx')).toBe(true)
    expect(isOfficeInput('Budget.XLSX')).toBe(true)
    expect(isOfficeInput('deck.pptx', '')).toBe(true)
    expect(isOfficeInput('legacy.doc')).toBe(true)
  })
  it('detects by MIME when the extension is missing', () => {
    expect(
      isOfficeInput('blob', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true)
  })
  it('rejects non-office inputs', () => {
    expect(isOfficeInput('a.pdf', 'application/pdf')).toBe(false)
    expect(isOfficeInput('a.png', 'image/png')).toBe(false)
    expect(isOfficeInput('notes.txt', 'text/plain')).toBe(false)
  })
})

describe('officeMimeFor', () => {
  it('prefers the extension-derived MIME over a vague one', () => {
    expect(officeMimeFor('report.docx', 'application/octet-stream')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })
  it('falls back to the provided MIME when the extension is unknown', () => {
    expect(officeMimeFor('blob', 'application/vnd.ms-excel')).toBe('application/vnd.ms-excel')
  })
})
