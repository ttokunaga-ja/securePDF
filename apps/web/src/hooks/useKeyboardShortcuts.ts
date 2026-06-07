import { useEffect, useRef } from 'react'

import { ZOOM_STEP } from '../lib/constants'

export interface ShortcutHandlers {
  selectAll: () => void
  zoomBy: (delta: number) => void
  zoomReset: () => void
  moveBy: (direction: -1 | 1) => void
  activateBy: (direction: -1 | 1) => void
  removeTargets: () => void
  rotateTargets: (delta: number) => void
  flipTargets: () => void
}

/** Global keyboard shortcuts for the workspace. Bound once; always invokes the
 *  latest handlers via a ref. Ignores events originating from text inputs. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return

      const handler = ref.current
      const key = event.key.toLowerCase()
      const mod = event.ctrlKey || event.metaKey

      if (mod && key === 'a') return prevent(event, handler.selectAll)
      if (mod && (key === '+' || key === '='))
        return prevent(event, () => handler.zoomBy(ZOOM_STEP))
      if (mod && key === '-') return prevent(event, () => handler.zoomBy(-ZOOM_STEP))
      if (mod && key === '0') return prevent(event, handler.zoomReset)
      if (mod && event.key === 'ArrowUp') return prevent(event, () => handler.moveBy(-1))
      if (mod && event.key === 'ArrowDown') return prevent(event, () => handler.moveBy(1))
      if (event.key === 'ArrowUp') return prevent(event, () => handler.activateBy(-1))
      if (event.key === 'ArrowDown') return prevent(event, () => handler.activateBy(1))
      if (event.key === 'Delete' || event.key === 'Backspace') {
        return prevent(event, handler.removeTargets)
      }
      if (key === 'r') return prevent(event, () => handler.rotateTargets(event.shiftKey ? -90 : 90))
      if (key === 'f') return prevent(event, handler.flipTargets)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

function prevent(event: KeyboardEvent, action: () => void): void {
  event.preventDefault()
  action()
}
