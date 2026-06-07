import { describe, expect, it } from 'vitest'

import type { LoadedFile } from '../../lib/importFile'
import { documentReducer, initDocState } from './reducer'
import {
  selectActiveIndex,
  selectActivePage,
  selectActivePosition,
  selectFilesById,
} from './selectors'

function makeFile(id: string, pageCount: number): LoadedFile {
  return { id, filename: `${id}.pdf`, bytes: new Uint8Array(), pdf: {} as never, pageCount }
}

describe('selectors', () => {
  it('indexes files by id', () => {
    const files = [makeFile('a', 1), makeFile('b', 2)]
    const byId = selectFilesById(files)
    expect(byId.get('b')?.pageCount).toBe(2)
    expect(byId.size).toBe(2)
  })

  it('reports no active page on an empty document', () => {
    const state = initDocState()
    expect(selectActiveIndex(state)).toBe(-1)
    expect(selectActivePage(state)).toBeNull()
    expect(selectActivePosition(state)).toBe(0)
  })

  it('derives the active index, page and 1-based position', () => {
    let state = documentReducer(initDocState(), {
      type: 'IMPORT_FILES',
      files: [makeFile('f0', 3)],
    })
    state = documentReducer(state, { type: 'SET_ACTIVE', key: 'f0:1' })
    expect(selectActiveIndex(state)).toBe(1)
    expect(selectActivePage(state)?.key).toBe('f0:1')
    expect(selectActivePosition(state)).toBe(2)
  })
})
