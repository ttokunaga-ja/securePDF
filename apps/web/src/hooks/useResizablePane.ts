import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { DIVIDER_WIDTH, LEFT_PANE_FALLBACK, LEFT_PANE_MAX, LEFT_PANE_MIN } from '../lib/constants'
import { clamp } from '../lib/math'

function initialWidth(): number {
  if (typeof window === 'undefined') return LEFT_PANE_FALLBACK
  return clamp(Math.round((window.innerWidth - DIVIDER_WIDTH) / 3), LEFT_PANE_MIN, LEFT_PANE_MAX)
}

/** Width of the left (thumbnail) pane plus handlers to resize it between
 *  LEFT_PANE_MIN and LEFT_PANE_MAX: `onResizeStart` for pointer drag (mouse, pen,
 *  touch) and `resizeBy` for keyboard arrow steps. */
export function useResizablePane() {
  const [width, setWidth] = useState(initialWidth)
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  })

  const onResizeStart = useCallback((event: ReactPointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = widthRef.current
    const move = (moveEvent: PointerEvent) => {
      setWidth(clamp(startWidth + moveEvent.clientX - startX, LEFT_PANE_MIN, LEFT_PANE_MAX))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [])

  const resizeBy = useCallback((delta: number) => {
    setWidth((current) => clamp(current + delta, LEFT_PANE_MIN, LEFT_PANE_MAX))
  }, [])

  return { width, min: LEFT_PANE_MIN, max: LEFT_PANE_MAX, onResizeStart, resizeBy }
}
