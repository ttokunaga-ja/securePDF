import { describe, expect, it } from 'vitest'

import { hasFileTransfer } from './dnd'

const dt = (types: string[]): DataTransfer => ({ types }) as unknown as DataTransfer

describe('hasFileTransfer', () => {
  it('is true when the drag carries OS files', () => {
    expect(hasFileTransfer(dt(['Files']))).toBe(true)
  })
  it('is false for non-file drags', () => {
    expect(hasFileTransfer(dt(['text/plain']))).toBe(false)
  })
})
