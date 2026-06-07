// The working-document state machine. Every page mutation runs through
// `reconcile`, which restores the invariants that App.tsx previously patched up
// in a `useEffect([pages])`: selection ⊆ pages, insertIndex in range, and a live
// active page. Keeping it here makes the editing logic testable without a DOM.

import { clamp } from '../../lib/math'
import type { DocAction, DocState, PageItem } from './types'

export function initDocState(): DocState {
  return {
    files: [],
    pages: [],
    selectedKeys: new Set(),
    lastSelectedKey: null,
    activeKey: null,
    insertIndex: 0,
  }
}

/** The pages targeted by a keyboard/menu action: the selection if any, else the
 *  active page. Exported for direct unit testing and reuse by *_TARGETS actions. */
export function resolveTargets(state: DocState): string[] {
  if (state.selectedKeys.size > 0) {
    return state.pages.filter((page) => state.selectedKeys.has(page.key)).map((page) => page.key)
  }
  return state.activeKey ? [state.activeKey] : []
}

/** Restore cross-field invariants after the page set or order changes. */
function reconcile(state: DocState): DocState {
  const pageKeys = new Set(state.pages.map((page) => page.key))
  const selectedKeys = new Set([...state.selectedKeys].filter((key) => pageKeys.has(key)))
  const insertIndex = clamp(state.insertIndex, 0, state.pages.length)
  const first = state.pages[0]
  let activeKey = state.activeKey
  if (!first) activeKey = null
  else if (!activeKey || !pageKeys.has(activeKey)) activeKey = first.key
  return { ...state, selectedKeys, insertIndex, activeKey }
}

/** Move `keys` so they sit at `insertAt` in the pre-move indexing. Returns null
 *  when none of the keys are present. */
function moveCore(state: DocState, keys: string[], insertAt: number): DocState | null {
  const keySet = new Set(keys)
  const moving = state.pages.filter((page) => keySet.has(page.key))
  if (moving.length === 0) return null
  const remaining = state.pages.filter((page) => !keySet.has(page.key))
  const adjustedIndex = state.pages
    .slice(0, insertAt)
    .filter((page) => !keySet.has(page.key)).length
  const pages = [...remaining.slice(0, adjustedIndex), ...moving, ...remaining.slice(adjustedIndex)]
  return reconcile({
    ...state,
    pages,
    insertIndex: adjustedIndex + moving.length,
    activeKey: moving[0]?.key ?? null,
  })
}

function pagesFor(files: { id: string; pageCount: number }[]): PageItem[] {
  return files.flatMap((file) =>
    Array.from({ length: file.pageCount }, (_, i) => ({
      key: `${file.id}:${i}`,
      fileId: file.id,
      pageIndex: i,
      rotation: 0,
      flipped: false,
    })),
  )
}

export function documentReducer(state: DocState, action: DocAction): DocState {
  switch (action.type) {
    case 'IMPORT_FILES': {
      const nextPages = pagesFor(action.files)
      const index =
        action.insertAt === undefined
          ? state.pages.length
          : clamp(action.insertAt, 0, state.pages.length)
      const pages = [...state.pages.slice(0, index), ...nextPages, ...state.pages.slice(index)]
      return reconcile({
        ...state,
        files: [...state.files, ...action.files],
        pages,
        insertIndex: index + nextPages.length,
        activeKey: nextPages[0]?.key ?? state.activeKey,
      })
    }

    case 'ROTATE': {
      const targets = new Set(action.keys)
      const pages = state.pages.map((page) =>
        targets.has(page.key)
          ? { ...page, rotation: (((page.rotation + action.delta) % 360) + 360) % 360 }
          : page,
      )
      return reconcile({ ...state, pages })
    }

    case 'FLIP': {
      const targets = new Set(action.keys)
      const pages = state.pages.map((page) =>
        targets.has(page.key) ? { ...page, flipped: !page.flipped } : page,
      )
      return reconcile({ ...state, pages })
    }

    case 'REMOVE': {
      const targets = new Set(action.keys)
      // Shift the insert slot up by the pages removed before it so it stays at the
      // same gap (otherwise deleting a page above it drifts the slot toward the end).
      const removedBefore = state.pages
        .slice(0, state.insertIndex)
        .filter((page) => targets.has(page.key)).length
      const pages = state.pages.filter((page) => !targets.has(page.key))
      const lastSelectedKey =
        state.lastSelectedKey && targets.has(state.lastSelectedKey) ? null : state.lastSelectedKey
      const selectedKeys = new Set([...state.selectedKeys].filter((key) => !targets.has(key)))
      return reconcile({
        ...state,
        pages,
        insertIndex: state.insertIndex - removedBefore,
        selectedKeys,
        lastSelectedKey,
      })
    }

    case 'MOVE':
      return moveCore(state, action.keys, action.insertAt) ?? state

    case 'REORDER': {
      // Apply a full page order + insert-slot position computed from one rail
      // drag (pages and the insert slot move on the same gesture).
      const byKey = new Map(state.pages.map((page) => [page.key, page]))
      const pages = action.order.flatMap((key) => {
        const page = byKey.get(key)
        return page ? [page] : []
      })
      if (pages.length !== state.pages.length) return state
      return reconcile({ ...state, pages, insertIndex: action.insertIndex })
    }

    case 'MOVE_DIRECTION': {
      const keys = resolveTargets(state)
      if (keys.length === 0) return state
      const keySet = new Set(keys)
      const indices = state.pages.flatMap((page, index) => (keySet.has(page.key) ? [index] : []))
      const first = indices[0]
      const last = indices[indices.length - 1]
      if (first === undefined || last === undefined) return state
      if (action.direction === -1) {
        return first === 0 ? state : (moveCore(state, keys, first - 1) ?? state)
      }
      return last >= state.pages.length - 1 ? state : (moveCore(state, keys, last + 2) ?? state)
    }

    case 'ROTATE_TARGETS':
      return documentReducer(state, {
        type: 'ROTATE',
        keys: resolveTargets(state),
        delta: action.delta,
      })
    case 'FLIP_TARGETS':
      return documentReducer(state, { type: 'FLIP', keys: resolveTargets(state) })
    case 'REMOVE_TARGETS':
      return documentReducer(state, { type: 'REMOVE', keys: resolveTargets(state) })

    case 'TOGGLE_SELECT': {
      const { key, shiftKey } = action
      if (shiftKey && state.lastSelectedKey) {
        const from = state.pages.findIndex((page) => page.key === state.lastSelectedKey)
        const to = state.pages.findIndex((page) => page.key === key)
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from]
          const selectedKeys = new Set(state.selectedKeys)
          state.pages.slice(start, end + 1).forEach((page) => selectedKeys.add(page.key))
          return { ...state, selectedKeys, lastSelectedKey: key }
        }
      }
      const selectedKeys = new Set(state.selectedKeys)
      if (selectedKeys.has(key)) selectedKeys.delete(key)
      else selectedKeys.add(key)
      return { ...state, selectedKeys, lastSelectedKey: key }
    }

    case 'SELECT_ALL':
      return {
        ...state,
        selectedKeys: new Set(state.pages.map((page) => page.key)),
        lastSelectedKey: state.pages.at(-1)?.key ?? null,
      }

    case 'CLEAR_SELECTION':
      return { ...state, selectedKeys: new Set(), lastSelectedKey: null }

    case 'SET_ACTIVE':
      return { ...state, activeKey: action.key }

    case 'ACTIVATE_NEIGHBOR': {
      if (state.pages.length === 0) return state
      const current = state.activeKey
        ? state.pages.findIndex((page) => page.key === state.activeKey)
        : 0
      const next = clamp(current + action.direction, 0, state.pages.length - 1)
      const nextPage = state.pages[next]
      return nextPage ? { ...state, activeKey: nextPage.key } : state
    }

    case 'GO_TO_PAGE': {
      if (state.pages.length === 0 || !Number.isFinite(action.position)) return state
      const index = clamp(Math.trunc(action.position), 1, state.pages.length) - 1
      const page = state.pages[index]
      return page ? { ...state, activeKey: page.key } : state
    }

    case 'SET_INSERT_INDEX':
      return { ...state, insertIndex: clamp(action.index, 0, state.pages.length) }
  }
}
