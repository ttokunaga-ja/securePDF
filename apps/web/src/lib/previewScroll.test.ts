import { describe, expect, it } from 'vitest'

import { nearestPreviewPageKey } from './previewScroll'

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }
}

function makeScrollport(pages: { key: string; top: number; height: number }[]) {
  const scrollport = document.createElement('div')
  scrollport.getBoundingClientRect = () => rect(0, 800)
  for (const page of pages) {
    const node = document.createElement('section')
    node.dataset.previewPageKey = page.key
    node.getBoundingClientRect = () => rect(page.top, page.height)
    scrollport.append(node)
  }
  return scrollport
}

describe('nearestPreviewPageKey', () => {
  it('returns the page nearest the scrollport centre', () => {
    const scrollport = makeScrollport([
      { key: 'p1', top: -500, height: 700 },
      { key: 'p2', top: 240, height: 700 },
      { key: 'p3', top: 980, height: 700 },
    ])

    expect(nearestPreviewPageKey(scrollport)).toBe('p2')
  })

  it('returns null when no preview pages are present', () => {
    expect(nearestPreviewPageKey(document.createElement('div'))).toBeNull()
  })
})
