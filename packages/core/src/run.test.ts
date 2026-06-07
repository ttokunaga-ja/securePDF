import { PDFDocument } from '@cantoo/pdf-lib'
import type { Operation, OperationPlan, OutputSpec } from '@securepdf/schema'
import { describe, expect, it } from 'vitest'

import { run } from './run'
import { at, makePdf, onePixelPng, pageWidthsOf, pdfWithWidth } from './testUtils'

const plan = (operations: Operation[], output: OutputSpec = { format: 'pdf' }): OperationPlan => ({
  version: '1',
  operations,
  output,
})

describe('run — organize', () => {
  it('merges two PDFs', async () => {
    const result = await run(plan([{ op: 'merge', inputs: ['a', 'b'] }]), [
      { id: 'a', bytes: await makePdf(1) },
      { id: 'b', bytes: await makePdf(2) },
    ])
    expect(result.ok).toBe(true)
    const doc = await PDFDocument.load(at(result.outputs, 0).bytes)
    expect(doc.getPageCount()).toBe(3)
  })

  it('deletes a page', async () => {
    const result = await run(plan([{ op: 'delete', pages: '2' }]), [
      { id: 'a', bytes: await makePdf(3) },
    ])
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([110, 130])
  })

  it('extracts pages', async () => {
    const result = await run(plan([{ op: 'extract', pages: '1,3' }]), [
      { id: 'a', bytes: await makePdf(3) },
    ])
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([110, 130])
  })

  it('reorders pages', async () => {
    const result = await run(plan([{ op: 'reorder', order: [3, 2, 1] }]), [
      { id: 'a', bytes: await makePdf(3) },
    ])
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([130, 120, 110])
  })

  it('rotates a single page relative to its current angle', async () => {
    const result = await run(plan([{ op: 'rotate', pages: '1', degrees: 90 }]), [
      { id: 'a', bytes: await makePdf(2) },
    ])
    const doc = await PDFDocument.load(at(result.outputs, 0).bytes)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
    expect(doc.getPage(1).getRotation().angle).toBe(0)
  })

  it('flips selected pages while preserving page count and size', async () => {
    const result = await run(plan([{ op: 'flip', pages: '1', axis: 'horizontal' }]), [
      { id: 'a', bytes: await makePdf(2) },
    ])
    expect(result.ok).toBe(true)
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([110, 120])
  })

  it('preserves rotation metadata when flipping a rotated page', async () => {
    const result = await run(
      plan([
        { op: 'rotate', pages: '1', degrees: 90 },
        { op: 'flip', pages: '1', axis: 'horizontal' },
      ]),
      [{ id: 'a', bytes: await makePdf(1) }],
    )
    const doc = await PDFDocument.load(at(result.outputs, 0).bytes)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
  })

  it('splits into one file per page', async () => {
    const result = await run(plan([{ op: 'split', everyNPages: 1 }]), [
      { id: 'a', bytes: await makePdf(3) },
    ])
    expect(result.outputs).toHaveLength(3)
    expect(at(result.outputs, 0).filename).toBe('output-1.pdf')
  })

  it('converts a PNG into a PDF page', async () => {
    const result = await run(plan([{ op: 'convertToPdf', inputs: ['img'] }]), [
      { id: 'img', bytes: onePixelPng(), type: 'image/png' },
    ])
    expect(result.ok).toBe(true)
    expect((await PDFDocument.load(at(result.outputs, 0).bytes)).getPageCount()).toBe(1)
  })

  it('reports an out-of-range page as INVALID_PAGE_RANGE', async () => {
    const result = await run(plan([{ op: 'delete', pages: '9' }]), [
      { id: 'a', bytes: await makePdf(2) },
    ])
    expect(result.ok).toBe(false)
    expect(result.errors?.[0]?.code).toBe('INVALID_PAGE_RANGE')
  })

  it('reports an unparsable input', async () => {
    const result = await run(plan([{ op: 'delete', pages: '1' }]), [
      { id: 'a', bytes: new Uint8Array([1, 2, 3, 4]) },
    ])
    expect(result.ok).toBe(false)
    expect(['CORRUPT_PDF', 'ENCRYPTED_PDF']).toContain(result.errors?.[0]?.code)
  })

  it('inserts PDF pages at a 0-based index', async () => {
    const result = await run(plan([{ op: 'insertPdf', input: 'ins', at: 1 }]), [
      { id: 'a', bytes: await makePdf(2) },
      { id: 'ins', bytes: await pdfWithWidth(999) },
    ])
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([110, 999, 120])
  })

  it('inserts an image as a page at a 0-based index', async () => {
    const result = await run(plan([{ op: 'insertImage', input: 'img', at: 1 }]), [
      { id: 'a', bytes: await makePdf(2) },
      { id: 'img', bytes: onePixelPng(), type: 'image/png' },
    ])
    expect(await pageWidthsOf(at(result.outputs, 0).bytes)).toEqual([110, 1, 120])
  })
})
