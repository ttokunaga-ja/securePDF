import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react'

import { documentReducer, initDocState } from './reducer'
import type { DocActions, DocState } from './types'

const DocStateContext = createContext<DocState | null>(null)
const DocActionsContext = createContext<DocActions | null>(null)

/** Owns the working-document reducer and exposes state and stable actions
 *  through two contexts, so dispatch-only views don't re-render on state change. */
export function DocumentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(documentReducer, undefined, initDocState)

  const actions = useMemo<DocActions>(
    () => ({
      importFiles: (files, insertAt) => dispatch({ type: 'IMPORT_FILES', files, insertAt }),
      rotate: (keys, delta) => dispatch({ type: 'ROTATE', keys, delta }),
      flip: (keys) => dispatch({ type: 'FLIP', keys }),
      remove: (keys) => dispatch({ type: 'REMOVE', keys }),
      move: (keys, insertAt) => dispatch({ type: 'MOVE', keys, insertAt }),
      reorder: (order, insertIndex) => dispatch({ type: 'REORDER', order, insertIndex }),
      rotateTargets: (delta) => dispatch({ type: 'ROTATE_TARGETS', delta }),
      flipTargets: () => dispatch({ type: 'FLIP_TARGETS' }),
      removeTargets: () => dispatch({ type: 'REMOVE_TARGETS' }),
      moveDirection: (direction) => dispatch({ type: 'MOVE_DIRECTION', direction }),
      toggleSelect: (key, shiftKey) => dispatch({ type: 'TOGGLE_SELECT', key, shiftKey }),
      selectAll: () => dispatch({ type: 'SELECT_ALL' }),
      clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),
      setActive: (key) => dispatch({ type: 'SET_ACTIVE', key }),
      activateNeighbor: (direction) => dispatch({ type: 'ACTIVATE_NEIGHBOR', direction }),
      goToPage: (position) => dispatch({ type: 'GO_TO_PAGE', position }),
      setInsertIndex: (index) => dispatch({ type: 'SET_INSERT_INDEX', index }),
    }),
    [dispatch],
  )

  return (
    <DocActionsContext.Provider value={actions}>
      <DocStateContext.Provider value={state}>{children}</DocStateContext.Provider>
    </DocActionsContext.Provider>
  )
}

export function useDocState(): DocState {
  const state = useContext(DocStateContext)
  if (!state) throw new Error('useDocState must be used within a DocumentProvider')
  return state
}

export function useDocActions(): DocActions {
  const actions = useContext(DocActionsContext)
  if (!actions) throw new Error('useDocActions must be used within a DocumentProvider')
  return actions
}
