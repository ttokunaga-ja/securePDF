import type { LoadedFile } from '../../lib/importFile'

/** One arranged page in the working document: a reference into a source file
 *  plus the per-page transforms applied in the GUI. */
export interface PageItem {
  key: string
  fileId: string
  pageIndex: number
  /** Rotation delta in degrees, normalised to 0 | 90 | 180 | 270. */
  rotation: number
  /** Whether the page is mirrored horizontally. */
  flipped: boolean
}

/** The reducer-owned editing state. UI-only concerns (zoom, pane width, output
 *  filename, busy/error) live outside, in component or hook state. */
export interface DocState {
  files: LoadedFile[]
  pages: PageItem[]
  selectedKeys: Set<string>
  lastSelectedKey: string | null
  activeKey: string | null
  insertIndex: number
}

export type DocAction =
  | { type: 'IMPORT_FILES'; files: LoadedFile[]; insertAt?: number }
  | { type: 'ROTATE'; keys: string[]; delta: number }
  | { type: 'FLIP'; keys: string[] }
  | { type: 'REMOVE'; keys: string[] }
  | { type: 'MOVE'; keys: string[]; insertAt: number }
  | { type: 'REORDER'; order: string[]; insertIndex: number }
  | { type: 'ROTATE_TARGETS'; delta: number }
  | { type: 'FLIP_TARGETS' }
  | { type: 'REMOVE_TARGETS' }
  | { type: 'MOVE_DIRECTION'; direction: -1 | 1 }
  | { type: 'TOGGLE_SELECT'; key: string; shiftKey: boolean }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_ACTIVE'; key: string | null }
  | { type: 'ACTIVATE_NEIGHBOR'; direction: -1 | 1 }
  | { type: 'GO_TO_PAGE'; position: number }
  | { type: 'SET_INSERT_INDEX'; index: number }

/** Stable, memoised action dispatchers exposed through the document context. */
export interface DocActions {
  importFiles: (files: LoadedFile[], insertAt?: number) => void
  rotate: (keys: string[], delta: number) => void
  flip: (keys: string[]) => void
  remove: (keys: string[]) => void
  move: (keys: string[], insertAt: number) => void
  /** Apply a new page order and insert-slot position from one rail drag. */
  reorder: (order: string[], insertIndex: number) => void
  rotateTargets: (delta: number) => void
  flipTargets: () => void
  removeTargets: () => void
  moveDirection: (direction: -1 | 1) => void
  toggleSelect: (key: string, shiftKey: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  setActive: (key: string | null) => void
  activateNeighbor: (direction: -1 | 1) => void
  goToPage: (position: number) => void
  setInsertIndex: (index: number) => void
}
