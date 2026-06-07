import { useCallback, useState } from 'react'

import { ZOOM_MAX, ZOOM_MIN } from '../lib/constants'
import { clamp } from '../lib/math'

function roundZoom(value: number): number {
  return Math.round(clamp(value, ZOOM_MIN, ZOOM_MAX) * 100) / 100
}

const asPercent = (zoom: number): string => String(Math.round(zoom * 100))

/** Preview zoom state plus its synced text-field value. `zoomInput` follows
 *  `zoom`; `applyZoomPercent` commits an edited percent (recovering on garbage). */
export function usePreviewZoom() {
  const [zoom, setZoom] = useState(1)
  const [zoomInput, setZoomInput] = useState('100')
  const [lastZoom, setLastZoom] = useState(zoom)

  // Re-sync the editable percent field when zoom changes elsewhere (buttons,
  // shortcuts) — the recommended alternative to a syncing effect.
  if (zoom !== lastZoom) {
    setLastZoom(zoom)
    setZoomInput(asPercent(zoom))
  }

  const changeZoom = useCallback((delta: number) => {
    setZoom((prev) => roundZoom(prev + delta))
  }, [])

  const reset = useCallback(() => setZoom(1), [])

  const applyZoomPercent = useCallback(
    (value: string) => {
      const percent = Number(value)
      if (!Number.isFinite(percent)) {
        setZoomInput(asPercent(zoom))
        return
      }
      const next = roundZoom(percent / 100)
      setZoom(next)
      setZoomInput(asPercent(next))
    },
    [zoom],
  )

  return { zoom, zoomInput, setZoomInput, changeZoom, applyZoomPercent, reset }
}
