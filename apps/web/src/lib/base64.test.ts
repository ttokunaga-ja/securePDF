import { describe, expect, it } from 'vitest'

import { base64ToBytes } from './base64'

describe('base64ToBytes', () => {
  it('decodes a base64 string into bytes', () => {
    const bytes = base64ToBytes('JVBERi0xLjQK')

    expect(new TextDecoder().decode(bytes)).toBe('%PDF-1.4\n')
  })

  it('decodes large payloads without relying on data URL fetch', () => {
    const source = new Uint8Array(120_000)
    for (let i = 0; i < source.length; i += 1) {
      source[i] = i % 251
    }
    const base64 = Buffer.from(source).toString('base64')

    expect(base64ToBytes(base64)).toEqual(source)
  })

  it('ignores transport whitespace', () => {
    expect(base64ToBytes('JVBE\nRi0x\r\nLjQK')).toEqual(base64ToBytes('JVBERi0xLjQK'))
  })
})
