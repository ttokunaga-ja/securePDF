// Test helpers — generate small PDFs in memory so tests stay reproducible and no
// binary fixtures are committed. Each page gets a distinct width
// (110, 120, 130, …) so reorder/extract/delete results are verifiable by size.
//
// Kept DOM-/Node-free (no atob/Buffer) so it lives in the runtime-neutral core.

import { PDFDocument } from '@cantoo/pdf-lib'

export async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([pageWidth(i + 1), 200])
  return doc.save()
}

/** The deterministic width of the n-th (1-based) page produced by makePdf. */
export function pageWidth(n: number): number {
  return 100 + n * 10
}

export async function pageWidthsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page) => Math.round(page.getWidth()))
}

/** A 1-page PDF whose page has a caller-chosen width, for identity assertions. */
export async function pdfWithWidth(width: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage([width, 200])
  return doc.save()
}

/** A 1×1 PNG, for image-conversion tests. */
export function onePixelPng(): Uint8Array {
  return fromBase64(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  )
}

function fromBase64(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of b64) {
    const value = alphabet.indexOf(ch)
    if (value === -1) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >> bits) & 0xff)
    }
  }
  return Uint8Array.from(out)
}
