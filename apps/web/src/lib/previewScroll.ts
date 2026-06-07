const PAGE_SELECTOR = '[data-preview-page-key]'

/** Return the preview page whose centre is closest to the scrollport centre.
 *  This mirrors Chrome PDF viewer's "current page follows scroll" feel without
 *  requiring page-height assumptions from the PDF renderer. */
export function nearestPreviewPageKey(scrollport: HTMLElement): string | null {
  const scrollportRect = scrollport.getBoundingClientRect()
  const centreY = scrollportRect.top + scrollportRect.height / 2
  let nearest: { key: string; distance: number } | null = null

  for (const page of scrollport.querySelectorAll<HTMLElement>(PAGE_SELECTOR)) {
    const key = page.dataset.previewPageKey
    if (!key) continue
    const rect = page.getBoundingClientRect()
    const pageCentre = rect.top + rect.height / 2
    const distance = Math.abs(pageCentre - centreY)
    if (!nearest || distance < nearest.distance) nearest = { key, distance }
  }

  return nearest?.key ?? null
}
