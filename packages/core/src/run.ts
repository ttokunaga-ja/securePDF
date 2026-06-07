// The runtime-neutral PDF engine. Operations apply sequentially to a single
// working document (docs/IMPLEMENTATION_PLAN.md §4.3). Pure @cantoo/pdf-lib —
// runs unchanged in the browser, the Node CLI, and Cloud Run.

import { degrees as toDegrees, PDFDocument } from '@cantoo/pdf-lib'
import {
  type ConvertToPdfOp,
  type DeleteOp,
  ERROR_CODES,
  type ExtractOp,
  type FlipOp,
  type InsertImageOp,
  type InsertPdfOp,
  isPlanError,
  type MergeOp,
  type Operation,
  type OperationPlan,
  parsePageRange,
  PlanError,
  type ReorderOp,
  type RotateOp,
  type SplitOp,
  validatePlan,
  type ValidationError,
} from '@securepdf/schema'

import type { FileInput, OutputFile, RunResult } from './types'

/** Execute a plan against its named inputs. Validates first; never throws. */
export async function run(plan: OperationPlan, inputs: FileInput[]): Promise<RunResult> {
  const validation = validatePlan(plan)
  if (!validation.ok) {
    return { ok: false, outputs: [], warnings: [], errors: validation.errors }
  }

  const byId = new Map(inputs.map((file) => [file.id, file]))
  const warnings: string[] = []

  try {
    const outputs = await execute(plan, inputs, byId)
    return { ok: true, outputs, warnings }
  } catch (error) {
    return { ok: false, outputs: [], warnings, errors: [toValidationError(error)] }
  }
}

async function execute(
  plan: OperationPlan,
  inputs: FileInput[],
  byId: Map<string, FileInput>,
): Promise<OutputFile[]> {
  let working: PDFDocument | null = null
  const ops = plan.operations

  for (const [i, op] of ops.entries()) {
    if (op.op === 'merge') {
      working = await mergeOp(op, byId)
      continue
    }
    if (op.op === 'convertToPdf') {
      working = await convertToPdfOp(op, byId)
      continue
    }
    if (op.op === 'split') {
      if (i !== ops.length - 1) {
        throw new PlanError(ERROR_CODES.INVALID_PLAN, 'split must be the last operation.')
      }
      working = await ensureWorking(working, inputs)
      const docs = await splitOp(op, working)
      return serializeMany(docs, plan)
    }

    working = await ensureWorking(working, inputs)
    working = await applyOp(op, working, byId)
  }

  if (!working) {
    throw new PlanError(ERROR_CODES.INVALID_PLAN, 'Plan produced no document.')
  }
  return [await serializeOne(working, outputName(plan))]
}

async function ensureWorking(
  working: PDFDocument | null,
  inputs: FileInput[],
): Promise<PDFDocument> {
  if (working) return working
  const first = inputs[0]
  if (!first) throw new PlanError(ERROR_CODES.MISSING_INPUT, 'No input document to operate on.')
  return load(first.bytes)
}

async function applyOp(
  op: Operation,
  working: PDFDocument,
  byId: Map<string, FileInput>,
): Promise<PDFDocument> {
  switch (op.op) {
    case 'delete':
      return deleteOp(op, working)
    case 'extract':
      return extractOp(op, working)
    case 'rotate':
      return rotateOp(op, working)
    case 'flip':
      return flipOp(op, working)
    case 'reorder':
      return reorderOp(op, working)
    case 'insertPdf':
      return insertPdfOp(op, working, byId)
    case 'insertImage':
      return insertImageOp(op, working, byId)
    default:
      // merge / convertToPdf / split are handled in execute().
      throw new PlanError(ERROR_CODES.INTERNAL, `Unexpected operation "${op.op}".`)
  }
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (/encrypt/i.test(reason)) {
      throw new PlanError(ERROR_CODES.ENCRYPTED_PDF, 'Input PDF is encrypted.', { reason })
    }
    throw new PlanError(ERROR_CODES.CORRUPT_PDF, 'Input PDF could not be parsed.', { reason })
  }
}

function getInput(byId: Map<string, FileInput>, id: string): FileInput {
  const file = byId.get(id)
  if (!file)
    throw new PlanError(ERROR_CODES.MISSING_INPUT, `Input "${id}" was not provided.`, { input: id })
  return file
}

async function mergeOp(op: MergeOp, byId: Map<string, FileInput>): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  for (const id of op.inputs) {
    const src = await load(getInput(byId, id).bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((page) => out.addPage(page))
  }
  return out
}

function deleteOp(op: DeleteOp, working: PDFDocument): PDFDocument {
  const targets = parsePageRange(op.pages, working.getPageCount())
  for (const n of [...targets].sort((a, b) => b - a)) working.removePage(n - 1)
  return working
}

async function extractOp(op: ExtractOp, working: PDFDocument): Promise<PDFDocument> {
  const targets = parsePageRange(op.pages, working.getPageCount())
  const out = await PDFDocument.create()
  const pages = await out.copyPages(
    working,
    targets.map((n) => n - 1),
  )
  pages.forEach((page) => out.addPage(page))
  return out
}

function rotateOp(op: RotateOp, working: PDFDocument): PDFDocument {
  for (const n of parsePageRange(op.pages, working.getPageCount())) {
    const page = working.getPage(n - 1)
    const next = (page.getRotation().angle + op.degrees) % 360
    page.setRotation(toDegrees(next))
  }
  return working
}

async function flipOp(op: FlipOp, working: PDFDocument): Promise<PDFDocument> {
  const targets = new Set(parsePageRange(op.pages, working.getPageCount()))
  const out = await PDFDocument.create()
  const copied = await out.copyPages(working, working.getPageIndices())

  for (const [i, page] of copied.entries()) {
    const pageNumber = i + 1
    if (targets.has(pageNumber)) {
      if (op.axis === 'horizontal') {
        page.scaleContent(-1, 1)
        page.translateContent(page.getWidth(), 0)
      } else {
        page.scaleContent(1, -1)
        page.translateContent(0, page.getHeight())
      }
    }
    out.addPage(page)
  }

  return out
}

async function reorderOp(op: ReorderOp, working: PDFDocument): Promise<PDFDocument> {
  const count = working.getPageCount()
  assertPermutation(op.order, count)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(
    working,
    op.order.map((n) => n - 1),
  )
  pages.forEach((page) => out.addPage(page))
  return out
}

function assertPermutation(order: number[], count: number): void {
  if (order.length !== count) {
    throw new PlanError(
      ERROR_CODES.INVALID_PLAN,
      `reorder.order must list all ${count} pages exactly once.`,
      { expected: count, got: order.length },
    )
  }
  const seen = new Set<number>()
  for (const n of order) {
    if (n < 1 || n > count) {
      throw new PlanError(
        ERROR_CODES.INVALID_PAGE_RANGE,
        `reorder.order page ${n} is out of range.`,
        {
          page: n,
          pageCount: count,
        },
      )
    }
    if (seen.has(n)) {
      throw new PlanError(ERROR_CODES.INVALID_PLAN, `reorder.order repeats page ${n}.`, { page: n })
    }
    seen.add(n)
  }
}

async function insertPdfOp(
  op: InsertPdfOp,
  working: PDFDocument,
  byId: Map<string, FileInput>,
): Promise<PDFDocument> {
  const src = await load(getInput(byId, op.input).bytes)
  const indices = op.pages
    ? parsePageRange(op.pages, src.getPageCount()).map((n) => n - 1)
    : src.getPageIndices()
  const copied = await working.copyPages(src, indices)
  let pos = clamp(op.at, 0, working.getPageCount())
  for (const page of copied) {
    working.insertPage(pos, page)
    pos++
  }
  return working
}

async function insertImageOp(
  op: InsertImageOp,
  working: PDFDocument,
  byId: Map<string, FileInput>,
): Promise<PDFDocument> {
  const image = await embedImage(working, getInput(byId, op.input))
  const pos = clamp(op.at, 0, working.getPageCount())
  const page = working.insertPage(pos, [image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  return working
}

async function convertToPdfOp(
  op: ConvertToPdfOp,
  byId: Map<string, FileInput>,
): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  for (const id of op.inputs) {
    const image = await embedImage(out, getInput(byId, id))
    const page = out.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  return out
}

async function embedImage(doc: PDFDocument, file: FileInput) {
  const b = file.bytes
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return doc.embedJpg(b)
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return doc.embedPng(b)
  throw new PlanError(
    ERROR_CODES.UNSUPPORTED_FORMAT,
    'Only JPEG and PNG image inputs are supported in this build.',
    { input: file.id, type: file.type },
  )
}

async function splitOp(op: SplitOp, working: PDFDocument): Promise<PDFDocument[]> {
  const count = working.getPageCount()
  const docs: PDFDocument[] = []
  for (const group of splitGroups(op, count)) {
    const out = await PDFDocument.create()
    const pages = await out.copyPages(
      working,
      group.map((n) => n - 1),
    )
    pages.forEach((page) => out.addPage(page))
    docs.push(out)
  }
  return docs
}

function splitGroups(op: SplitOp, count: number): number[][] {
  if (op.ranges) return op.ranges.map((range) => parsePageRange(range, count))

  if (typeof op.everyNPages === 'number') {
    const groups: number[][] = []
    for (let start = 1; start <= count; start += op.everyNPages) {
      const group: number[] = []
      for (let p = start; p < start + op.everyNPages && p <= count; p++) group.push(p)
      groups.push(group)
    }
    return groups
  }

  if (op.atPages) {
    const starts = parsePageRange(op.atPages, count).filter((s) => s > 1)
    const bounds = [...new Set([1, ...starts])].sort((a, b) => a - b)
    return bounds.map((from, k) => {
      const next = bounds[k + 1]
      const to = next !== undefined ? next - 1 : count
      const group: number[] = []
      for (let p = from; p <= to; p++) group.push(p)
      return group
    })
  }

  throw new PlanError(ERROR_CODES.INVALID_PLAN, 'split needs ranges, everyNPages, or atPages.')
}

async function serializeOne(doc: PDFDocument, filename: string): Promise<OutputFile> {
  const bytes = await doc.save()
  return { filename, bytes, type: 'application/pdf' }
}

async function serializeMany(docs: PDFDocument[], plan: OperationPlan): Promise<OutputFile[]> {
  const stem = outputName(plan).replace(/\.pdf$/i, '')
  const outputs: OutputFile[] = []
  for (const [i, doc] of docs.entries()) {
    outputs.push(await serializeOne(doc, `${stem}-${i + 1}.pdf`))
  }
  return outputs
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max))
}

function outputName(plan: OperationPlan): string {
  const name = plan.output.filename
  return name && name.length > 0 ? name : 'output.pdf'
}

function toValidationError(error: unknown): ValidationError {
  if (isPlanError(error))
    return { code: error.code, message: error.message, details: error.details }
  return {
    code: ERROR_CODES.INTERNAL,
    message: error instanceof Error ? error.message : String(error),
  }
}
