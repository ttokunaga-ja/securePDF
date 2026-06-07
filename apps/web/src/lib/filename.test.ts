import { describe, expect, it } from 'vitest'

import { normalizePdfFilename, stripExtension } from './filename'

describe('stripExtension', () => {
  it('removes a trailing extension', () => {
    expect(stripExtension('report.docx')).toBe('report')
  })
  it('keeps dotfiles intact', () => {
    expect(stripExtension('.env')).toBe('.env')
  })
  it('returns the name unchanged when there is no extension', () => {
    expect(stripExtension('report')).toBe('report')
  })
})

describe('normalizePdfFilename', () => {
  it('appends .pdf when missing', () => {
    expect(normalizePdfFilename('report')).toBe('report.pdf')
  })
  it('keeps an existing .pdf (case-insensitive)', () => {
    expect(normalizePdfFilename('report.PDF')).toBe('report.PDF')
  })
  it('replaces a non-pdf extension', () => {
    expect(normalizePdfFilename('report.docx')).toBe('report.pdf')
  })
  it('sanitises forbidden characters', () => {
    expect(normalizePdfFilename('a/b:c*?.pdf')).toBe('a_b_c_.pdf')
  })
  it('falls back for blank input', () => {
    expect(normalizePdfFilename('   ')).toBe('securepdf.pdf')
  })
})
