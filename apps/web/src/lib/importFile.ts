import { isOfficeInput, officeMimeFor } from '@securepdf/schema'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { t } from '../app/i18n'
import { loadCore } from './core'
import { loadPdfDocument } from './pdf'

export interface LoadedFile {
  id: string
  filename: string
  /** Always PDF bytes (images and Office files are converted on import). */
  bytes: Uint8Array
  pdf: PDFDocumentProxy
  pageCount: number
}

let counter = 0

/** Read a dropped/selected file into a renderable, organizable PDF. Images
 *  (JPEG/PNG) convert in-browser via the core engine; Office files (docx/xlsx/pptx)
 *  convert server-side via the Worker → Google Apps Script backend. */
export async function importFile(file: File): Promise<LoadedFile> {
  let bytes: Uint8Array
  if (isOfficeInput(file.name, file.type)) {
    bytes = await officeToPdf(file)
  } else {
    const raw = new Uint8Array(await file.arrayBuffer())
    bytes = isPdf(raw) ? raw : await imageToPdf(raw, file)
  }
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

/** Convert an Office document to PDF via the Worker, which forwards to the Google
 *  Apps Script backend (server-to-server, no CORS). The browser only base64-encodes
 *  the input and decodes the returned PDF — no Office bytes are parsed locally. */
async function officeToPdf(file: File): Promise<Uint8Array> {
  const fileBase64 = await fileToBase64(file)
  let res: Response
  try {
    res = await fetch('/api/v1/convert/office', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mimeType: officeMimeFor(file.name, file.type),
        filename: file.name,
        fileBase64,
      }),
    })
  } catch {
    throw new Error(t('import.officeUnavailable'))
  }
  if (res.status === 503) throw new Error(t('import.officeUnavailable'))

  let data: { ok?: boolean; pdfBase64?: string; message?: string } = {}
  try {
    data = (await res.json()) as typeof data
  } catch {
    throw new Error(t('import.officeFailed', { name: file.name }))
  }
  if (!res.ok || !data.ok || !data.pdfBase64) {
    throw new Error(data.message ?? t('import.officeFailed', { name: file.name }))
  }
  const buffer = await (await fetch(`data:application/pdf;base64,${data.pdfBase64}`)).arrayBuffer()
  return new Uint8Array(buffer)
}

/** Read a File as base64 (no data-URL prefix) without blowing the call stack on
 *  large inputs (FileReader handles the chunking). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}
