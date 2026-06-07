const FALLBACK_PDF_NAME = 'securepdf.pdf'

/** Strip the trailing extension, keeping leading dots (e.g. ".env" stays). */
export function stripExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index <= 0) return filename
  return filename.slice(0, index)
}

/** Sanitise a user-supplied name into a safe `*.pdf` download filename. */
export function normalizePdfFilename(filename: string): string {
  const cleaned = filename.trim().replace(/[\\/:*?"<>|]+/g, '_')
  const safeName = cleaned.length > 0 ? cleaned : FALLBACK_PDF_NAME
  return /\.pdf$/i.test(safeName) ? safeName : `${stripExtension(safeName)}.pdf`
}
