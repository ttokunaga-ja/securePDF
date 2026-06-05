import type { PDFDocumentProxy } from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves the worker to a hashed asset URL; pdf.js loads it as a Web Worker.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export const THUMBNAIL_WIDTH = 150

/**
 * Open a PDF for rendering. pdf.js detaches the buffer it is handed, so we pass a
 * copy — the original bytes stay usable by the core engine on export.
 */
export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: bytes.slice() }).promise
}
