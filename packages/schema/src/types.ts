// The versioned operation schema — the cross-entry-point contract shared by the
// browser GUI, the CLI, the Cloudflare Worker, and Cloud Run.

export const SCHEMA_VERSION = '1' as const

export type Mime = 'application/pdf' | 'image/jpeg' | 'image/png' | (string & {})

export interface InputRef {
  id: string
  filename?: string
  type?: Mime
  /** Declared page count, used by light validation that does not parse files. */
  pageCount?: number
}

export type Degrees = 90 | 180 | 270
export type Fit = 'contain' | 'cover' | 'native'

export interface MergeOp {
  op: 'merge'
  inputs: string[]
}

export interface SplitOp {
  op: 'split'
  ranges?: string[]
  everyNPages?: number
  atPages?: string
}

export interface ExtractOp {
  op: 'extract'
  pages: string
}

export interface DeleteOp {
  op: 'delete'
  pages: string
}

export interface RotateOp {
  op: 'rotate'
  pages: string
  degrees: Degrees
}

export interface ReorderOp {
  op: 'reorder'
  /** A full 1-based permutation of the working document's current pages. */
  order: number[]
}

export interface InsertPdfOp {
  op: 'insertPdf'
  input: string
  /** 0-based insertion index in the working document. */
  at: number
  pages?: string
}

export interface InsertImageOp {
  op: 'insertImage'
  input: string
  /** 0-based insertion index in the working document. */
  at: number
  pageSize?: string
  fit?: Fit
  margin?: number
  dpi?: number
}

export interface ConvertToPdfOp {
  op: 'convertToPdf'
  inputs: string[]
  pageSize?: string
  fit?: Fit
  margin?: number
  dpi?: number
}

export type Operation =
  | MergeOp
  | SplitOp
  | ExtractOp
  | DeleteOp
  | RotateOp
  | ReorderOp
  | InsertPdfOp
  | InsertImageOp
  | ConvertToPdfOp

export type OperationName = Operation['op']

export const OPERATION_NAMES: readonly OperationName[] = [
  'merge',
  'split',
  'extract',
  'delete',
  'rotate',
  'reorder',
  'insertPdf',
  'insertImage',
  'convertToPdf',
]

export interface OutputSpec {
  format: 'pdf'
  filename?: string
  /** Set for multi-output operations (split/extract) returned as one archive. */
  container?: 'zip'
}

export interface OperationPlan {
  version: typeof SCHEMA_VERSION
  inputs?: InputRef[]
  operations: Operation[]
  output: OutputSpec
}

export interface ValidationError {
  /** Stable, machine-readable code (e.g. INVALID_PAGE_RANGE). */
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ValidationResult {
  ok: boolean
  normalizedPlan?: OperationPlan
  errors?: ValidationError[]
}
