import { describe, expect, it } from 'vitest'

import { INSERT_SLOT_ID as SLOT, reorderRail } from './reorder'

// Rail with the slot at the top: slot, a, b, c.
const rail = [SLOT, 'a', 'b', 'c']

describe('reorderRail', () => {
  it('moves a page below the target (after it)', () => {
    // Drag a down onto c → a lands after c.
    expect(reorderRail(rail, ['a'], 'a', 'c')).toEqual({ order: ['b', 'c', 'a'], insertIndex: 0 })
  })

  it('moves a page above the target (before it)', () => {
    // Drag c up onto a → c lands before a.
    expect(reorderRail(rail, ['c'], 'c', 'a')).toEqual({ order: ['c', 'a', 'b'], insertIndex: 0 })
  })

  it('moves the insert slot down past a page (updates insertIndex only)', () => {
    // Drag the slot onto b → slot sits after b; pages unchanged.
    expect(reorderRail(rail, [SLOT], SLOT, 'b')).toEqual({ order: ['a', 'b', 'c'], insertIndex: 2 })
  })

  it('a page crossing the slot shifts the slot relative to pages', () => {
    // Slot between a and b: a, slot, b, c. Drag a to the end.
    const r = ['a', SLOT, 'b', 'c']
    expect(reorderRail(r, ['a'], 'a', 'c')).toEqual({ order: ['b', 'c', 'a'], insertIndex: 0 })
  })

  it('moves a multi-page block, keeping the slot', () => {
    // Block [a,b] grabbed by a, dropped onto c.
    expect(reorderRail(rail, ['a', 'b'], 'a', 'c')).toEqual({
      order: ['c', 'a', 'b'],
      insertIndex: 0,
    })
  })

  it('is a no-op when dropped on itself or within the moving block', () => {
    expect(reorderRail(rail, ['a'], 'a', 'a')).toBeNull()
    expect(reorderRail(rail, ['a', 'b'], 'a', 'b')).toBeNull()
  })

  it('returns null for unknown ids', () => {
    expect(reorderRail(rail, ['x'], 'x', 'a')).toBeNull()
    expect(reorderRail(rail, ['a'], 'a', 'z')).toBeNull()
  })
})
