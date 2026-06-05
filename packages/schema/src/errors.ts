// Stable error codes shared across entry points (see docs/api.md). Extend, never
// renumber. Cloud Run adds its own native-tool codes against the same contract.

export const ERROR_CODES = {
  INVALID_PLAN: 'INVALID_PLAN',
  UNKNOWN_OPERATION: 'UNKNOWN_OPERATION',
  INVALID_PAGE_RANGE: 'INVALID_PAGE_RANGE',
  MISSING_INPUT: 'MISSING_INPUT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PAGE_LIMIT_EXCEEDED: 'PAGE_LIMIT_EXCEEDED',
  OUTPUT_TOO_LARGE: 'OUTPUT_TOO_LARGE',
  ENCRYPTED_PDF: 'ENCRYPTED_PDF',
  CORRUPT_PDF: 'CORRUPT_PDF',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** A typed failure carrying a stable code; thrown by the parser/engine and
 *  converted to a `ValidationError` / error response at the boundary. */
export class PlanError extends Error {
  readonly code: ErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'PlanError'
    this.code = code
    this.details = details
  }
}

export function isPlanError(value: unknown): value is PlanError {
  return value instanceof PlanError
}
