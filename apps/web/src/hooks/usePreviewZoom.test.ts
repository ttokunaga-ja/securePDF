import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ZOOM_MAX, ZOOM_MIN } from '../lib/constants'
import { usePreviewZoom } from './usePreviewZoom'

describe('usePreviewZoom', () => {
  it('starts at 100%', () => {
    const { result } = renderHook(() => usePreviewZoom())
    expect(result.current.zoom).toBe(1)
    expect(result.current.zoomInput).toBe('100')
  })

  it('clamps zoom to the configured bounds', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.changeZoom(-5))
    expect(result.current.zoom).toBe(ZOOM_MIN)
    act(() => result.current.changeZoom(10))
    expect(result.current.zoom).toBe(ZOOM_MAX)
  })

  it('mirrors zoom changes into the percent field', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.changeZoom(0.5))
    expect(result.current.zoom).toBe(1.5)
    expect(result.current.zoomInput).toBe('150')
  })

  it('recovers the field from non-numeric input', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.applyZoomPercent('abc'))
    expect(result.current.zoom).toBe(1)
    expect(result.current.zoomInput).toBe('100')
  })
})
