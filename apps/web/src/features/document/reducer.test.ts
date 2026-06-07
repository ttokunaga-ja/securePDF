import { describe, expect, it } from 'vitest'

import type { LoadedFile } from '../../lib/importFile'
import { documentReducer, initDocState, resolveTargets } from './reducer'
import type { DocState } from './types'

function makeFile(id: string, pageCount: number): LoadedFile {
  return { id, filename: `${id}.pdf`, bytes: new Uint8Array(), pdf: {} as never, pageCount }
}

/** Build a state by importing one file with `pageCount` pages (keys `f0:0`…). */
function stateWith(pageCount: number): DocState {
  return documentReducer(initDocState(), {
    type: 'IMPORT_FILES',
    files: [makeFile('f0', pageCount)],
  })
}

const keys = (state: DocState) => state.pages.map((page) => page.key)

/** Index access that throws instead of yielding `T | undefined`, so assertions on
 *  `pages[0]` type-check under noUncheckedIndexedAccess without `!`. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No element at index ${index}.`)
  return item
}

describe('documentReducer', () => {
  it('starts empty', () => {
    const state = initDocState()
    expect(state.pages).toHaveLength(0)
    expect(state.activeKey).toBeNull()
    expect(state.insertIndex).toBe(0)
  })

  describe('IMPORT_FILES', () => {
    it('appends pages and activates the first imported page', () => {
      const state = stateWith(3)
      expect(keys(state)).toEqual(['f0:0', 'f0:1', 'f0:2'])
      expect(state.activeKey).toBe('f0:0')
      expect(state.insertIndex).toBe(3)
    })

    it('inserts at a given index', () => {
      const base = stateWith(2)
      const next = documentReducer(base, {
        type: 'IMPORT_FILES',
        files: [makeFile('f1', 1)],
        insertAt: 1,
      })
      expect(keys(next)).toEqual(['f0:0', 'f1:0', 'f0:1'])
      expect(next.insertIndex).toBe(2)
    })
  })

  describe('ROTATE / FLIP', () => {
    it('normalises rotation into [0,360)', () => {
      const state = documentReducer(stateWith(1), { type: 'ROTATE', keys: ['f0:0'], delta: -90 })
      expect(at(state.pages, 0).rotation).toBe(270)
    })

    it('rotate by 360 is identity', () => {
      const once = documentReducer(stateWith(1), { type: 'ROTATE', keys: ['f0:0'], delta: 90 })
      const full = [90, 90, 90].reduce(
        (acc) => documentReducer(acc, { type: 'ROTATE', keys: ['f0:0'], delta: 90 }),
        once,
      )
      expect(at(full.pages, 0).rotation).toBe(0)
    })

    it('toggles flip', () => {
      const flipped = documentReducer(stateWith(1), { type: 'FLIP', keys: ['f0:0'] })
      expect(at(flipped.pages, 0).flipped).toBe(true)
      const back = documentReducer(flipped, { type: 'FLIP', keys: ['f0:0'] })
      expect(at(back.pages, 0).flipped).toBe(false)
    })
  })

  describe('REMOVE', () => {
    it('removes pages and reconciles the active page', () => {
      const state = documentReducer(stateWith(3), { type: 'REMOVE', keys: ['f0:0'] })
      expect(keys(state)).toEqual(['f0:1', 'f0:2'])
      expect(state.activeKey).toBe('f0:1')
    })

    it('drops removed keys from the selection', () => {
      let state = stateWith(3)
      state = documentReducer(state, { type: 'SELECT_ALL' })
      state = documentReducer(state, { type: 'REMOVE', keys: ['f0:1'] })
      expect([...state.selectedKeys].sort()).toEqual(['f0:0', 'f0:2'])
    })

    it('keeps the insert slot at the same gap when a page above it is removed', () => {
      let state = stateWith(3)
      state = documentReducer(state, { type: 'SET_INSERT_INDEX', index: 2 }) // between f0:1 and f0:2
      state = documentReducer(state, { type: 'REMOVE', keys: ['f0:0'] })
      expect(keys(state)).toEqual(['f0:1', 'f0:2'])
      expect(state.insertIndex).toBe(1) // still before f0:2, not pushed to the end
    })

    it('leaves the insert slot when a page below it is removed', () => {
      let state = stateWith(3)
      state = documentReducer(state, { type: 'SET_INSERT_INDEX', index: 1 }) // between f0:0 and f0:1
      state = documentReducer(state, { type: 'REMOVE', keys: ['f0:2'] })
      expect(state.insertIndex).toBe(1)
    })
  })

  describe('MOVE', () => {
    it('moves a page to a new index using pre-move indexing', () => {
      const state = documentReducer(stateWith(4), { type: 'MOVE', keys: ['f0:2'], insertAt: 1 })
      expect(keys(state)).toEqual(['f0:0', 'f0:2', 'f0:1', 'f0:3'])
      expect(state.activeKey).toBe('f0:2')
    })
  })

  describe('MOVE_DIRECTION', () => {
    it('moves the active page up', () => {
      let state = documentReducer(stateWith(3), { type: 'SET_ACTIVE', key: 'f0:1' })
      state = documentReducer(state, { type: 'MOVE_DIRECTION', direction: -1 })
      expect(keys(state)).toEqual(['f0:1', 'f0:0', 'f0:2'])
    })

    it('is a no-op at the top edge', () => {
      let state = documentReducer(stateWith(3), { type: 'SET_ACTIVE', key: 'f0:0' })
      state = documentReducer(state, { type: 'MOVE_DIRECTION', direction: -1 })
      expect(keys(state)).toEqual(['f0:0', 'f0:1', 'f0:2'])
    })
  })

  describe('selection', () => {
    it('toggles a single page', () => {
      const state = documentReducer(stateWith(3), {
        type: 'TOGGLE_SELECT',
        key: 'f0:1',
        shiftKey: false,
      })
      expect([...state.selectedKeys]).toEqual(['f0:1'])
      expect(state.lastSelectedKey).toBe('f0:1')
    })

    it('shift-selects a contiguous range from the anchor', () => {
      let state = documentReducer(stateWith(4), {
        type: 'TOGGLE_SELECT',
        key: 'f0:0',
        shiftKey: false,
      })
      state = documentReducer(state, { type: 'TOGGLE_SELECT', key: 'f0:2', shiftKey: true })
      expect([...state.selectedKeys].sort()).toEqual(['f0:0', 'f0:1', 'f0:2'])
      expect(state.lastSelectedKey).toBe('f0:2')
    })

    it('select-all then clear', () => {
      let state = documentReducer(stateWith(3), { type: 'SELECT_ALL' })
      expect(state.selectedKeys.size).toBe(3)
      state = documentReducer(state, { type: 'CLEAR_SELECTION' })
      expect(state.selectedKeys.size).toBe(0)
      expect(state.lastSelectedKey).toBeNull()
    })
  })

  describe('navigation', () => {
    it('activates neighbours within bounds', () => {
      let state = documentReducer(stateWith(2), { type: 'SET_ACTIVE', key: 'f0:0' })
      state = documentReducer(state, { type: 'ACTIVATE_NEIGHBOR', direction: 1 })
      expect(state.activeKey).toBe('f0:1')
      state = documentReducer(state, { type: 'ACTIVATE_NEIGHBOR', direction: 1 })
      expect(state.activeKey).toBe('f0:1')
    })

    it('goes to a 1-based page, clamped', () => {
      let state = documentReducer(stateWith(3), { type: 'GO_TO_PAGE', position: 99 })
      expect(state.activeKey).toBe('f0:2')
      state = documentReducer(state, { type: 'GO_TO_PAGE', position: 1 })
      expect(state.activeKey).toBe('f0:0')
    })
  })

  describe('resolveTargets', () => {
    it('prefers the selection in page order', () => {
      let state = stateWith(3)
      state = documentReducer(state, { type: 'TOGGLE_SELECT', key: 'f0:2', shiftKey: false })
      state = documentReducer(state, { type: 'TOGGLE_SELECT', key: 'f0:0', shiftKey: false })
      expect(resolveTargets(state)).toEqual(['f0:0', 'f0:2'])
    })

    it('falls back to the active page', () => {
      const state = documentReducer(stateWith(3), { type: 'SET_ACTIVE', key: 'f0:1' })
      expect(resolveTargets(state)).toEqual(['f0:1'])
    })

    it('is empty with no selection and no active page', () => {
      expect(resolveTargets(initDocState())).toEqual([])
    })
  })
})
