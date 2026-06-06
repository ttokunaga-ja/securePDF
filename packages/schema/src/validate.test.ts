import { describe, expect, it } from 'vitest'

import { SCHEMA_VERSION } from './types'
import { validatePlan } from './validate'

const plan = (operations: unknown[], inputs?: unknown[]) => ({
  version: SCHEMA_VERSION,
  inputs,
  operations,
  output: { format: 'pdf' },
})

const hasCode = (result: ReturnType<typeof validatePlan>, code: string) =>
  result.errors?.some((e) => e.code === code) ?? false

describe('validatePlan', () => {
  it('accepts a valid plan', () => {
    expect(validatePlan(plan([{ op: 'rotate', pages: '1', degrees: 90 }])).ok).toBe(true)
  })

  it('rejects a non-object', () => expect(validatePlan(null).ok).toBe(false))

  it('rejects an unsupported version', () => {
    const result = validatePlan({
      version: '2',
      operations: [{ op: 'delete', pages: '1' }],
      output: { format: 'pdf' },
    })
    expect(hasCode(result, 'INVALID_PLAN')).toBe(true)
  })

  it('rejects empty operations', () => expect(validatePlan(plan([])).ok).toBe(false))

  it('flags an unknown operation', () => {
    expect(hasCode(validatePlan(plan([{ op: 'frobnicate' }])), 'UNKNOWN_OPERATION')).toBe(true)
  })

  it('flags an invalid page range', () => {
    expect(
      hasCode(validatePlan(plan([{ op: 'delete', pages: '4-2' }])), 'INVALID_PAGE_RANGE'),
    ).toBe(true)
  })

  it('flags invalid rotate degrees', () => {
    expect(validatePlan(plan([{ op: 'rotate', pages: '1', degrees: 45 }])).ok).toBe(false)
  })

  it('accepts flip and validates the axis', () => {
    expect(validatePlan(plan([{ op: 'flip', pages: '1', axis: 'horizontal' }])).ok).toBe(true)
    expect(validatePlan(plan([{ op: 'flip', pages: '1', axis: 'diagonal' }])).ok).toBe(false)
  })

  it('flags a reference to an undeclared input', () => {
    const result = validatePlan(plan([{ op: 'merge', inputs: ['a', 'z'] }], [{ id: 'a' }]))
    expect(hasCode(result, 'MISSING_INPUT')).toBe(true)
  })

  it('requires exactly one split mode', () => {
    expect(validatePlan(plan([{ op: 'split', ranges: ['1'], everyNPages: 2 }])).ok).toBe(false)
  })
})
