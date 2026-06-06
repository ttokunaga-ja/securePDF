import { describe, expect, it } from 'vitest'

import { buildPlan } from './buildPlan'

describe('buildPlan', () => {
  it('merges, reorders, and deletes across files', () => {
    const plan = buildPlan(
      [
        { fileId: 'f1', pageIndex: 0, rotation: 0, flipped: false },
        { fileId: 'f0', pageIndex: 0, rotation: 0, flipped: false },
      ],
      [
        { id: 'f0', filename: 'a.pdf', pageCount: 2 },
        { id: 'f1', filename: 'b.pdf', pageCount: 1 },
      ],
    )
    expect(plan.operations).toEqual([
      { op: 'merge', inputs: ['f0', 'f1'] },
      { op: 'reorder', order: [3, 1, 2] },
      { op: 'delete', pages: '3-3' },
    ])
  })

  it('emits only rotate when the order is unchanged', () => {
    const plan = buildPlan(
      [
        { fileId: 'f0', pageIndex: 0, rotation: 0, flipped: false },
        { fileId: 'f0', pageIndex: 1, rotation: 90, flipped: false },
        { fileId: 'f0', pageIndex: 2, rotation: 0, flipped: false },
      ],
      [{ id: 'f0', filename: 'a.pdf', pageCount: 3 }],
    )
    expect(plan.operations).toEqual([
      { op: 'merge', inputs: ['f0'] },
      { op: 'rotate', pages: '2', degrees: 90 },
    ])
  })

  it('is a plain merge when nothing changed', () => {
    const plan = buildPlan(
      [{ fileId: 'f0', pageIndex: 0, rotation: 0, flipped: false }],
      [{ id: 'f0', filename: 'a.pdf', pageCount: 1 }],
    )
    expect(plan.operations).toEqual([{ op: 'merge', inputs: ['f0'] }])
  })

  it('emits flip after rotation for mirrored pages', () => {
    const plan = buildPlan(
      [
        { fileId: 'f0', pageIndex: 0, rotation: 90, flipped: true },
        { fileId: 'f0', pageIndex: 1, rotation: 0, flipped: false },
      ],
      [{ id: 'f0', filename: 'a.pdf', pageCount: 2 }],
    )
    expect(plan.operations).toEqual([
      { op: 'merge', inputs: ['f0'] },
      { op: 'rotate', pages: '1', degrees: 90 },
      { op: 'flip', pages: '1', axis: 'horizontal' },
    ])
  })
})
