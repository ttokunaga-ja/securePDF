// Pure derivations over DocState, shared by the workspace components. Kept
// separate from the reducer so views can memoise them without importing reducer
// internals.

import type { LoadedFile } from '../../lib/importFile'
import type { DocState, PageItem } from './types'

export function selectFilesById(files: LoadedFile[]): Map<string, LoadedFile> {
  return new Map(files.map((file) => [file.id, file]))
}

/** Index of the active page, or -1 when there is none. */
export function selectActiveIndex(state: DocState): number {
  return state.activeKey ? state.pages.findIndex((page) => page.key === state.activeKey) : -1
}

export function selectActivePage(state: DocState): PageItem | null {
  return state.pages.find((page) => page.key === state.activeKey) ?? null
}

/** 1-based position of the active page (0 when none) for the page navigator. */
export function selectActivePosition(state: DocState): number {
  const index = selectActiveIndex(state)
  return index >= 0 ? index + 1 : 0
}
