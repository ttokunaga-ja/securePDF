import type { PDFDocumentProxy } from 'pdfjs-dist'

import { loadCore } from './core'
import { loadPdfDocument } from './pdf'

export interface LoadedFile {
  id: string
  filename: string
  /** Always PDF bytes (images are converted on import). */
  bytes: Uint8Array
  pdf: PDFDocumentProxy
  pageCount: number
}

let counter = 0

/** Read a dropped/selected file into a renderable, organizable PDF. Images
 *  (JPEG/PNG) are converted to a 1-page PDF in-browser via the core engine. */
export async function importFile(file: File): Promise<LoadedFile> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const bytes = isPdf(raw) ? raw : await imageToPdf(raw, file)
  const pdf = await loadPdfDocument(bytes)
  return { id: `f${counter++}`, filename: file.name, bytes, pdf, pageCount: pdf.numPages }
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

async function imageToPdf(bytes: Uint8Array, file: File): Promise<Uint8Array> {
  const { run } = await loadCore()
  const result = await run(
    {
      version: '1',
      operations: [{ op: 'convertToPdf', inputs: ['img'] }],
      output: { format: 'pdf' },
    },
    [{ id: 'img', bytes, filename: file.name, type: file.type }],
  )
  if (!result.ok) {
    throw new Error(result.errors?.[0]?.message ?? `Could not import ${file.name}`)
  }
  const [output] = result.outputs
  if (!output) throw new Error(`Could not import ${file.name}`)
  return output.bytes
}
