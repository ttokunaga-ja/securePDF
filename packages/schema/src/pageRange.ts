// Page-range grammar (1-based, inclusive):
//   comma-separated tokens, each:  N | N-M | N-end | last | even | odd
//   whitespace tolerant. Returns a sorted, de-duplicated list of page numbers.

import { ERROR_CODES, PlanError } from './errors'

type Token =
  | { kind: 'single'; n: number }
  | { kind: 'range'; from: number; to: number | 'end' }
  | { kind: 'keyword'; value: 'last' | 'even' | 'odd' }

const INT = /^\d+$/

function rangeError(expr: string, token: string, why = 'Invalid page-range token.'): PlanError {
  return new PlanError(ERROR_CODES.INVALID_PAGE_RANGE, why, { expr, token })
}

/** Validate grammar only (no page-count bound check). Throws on malformed input. */
export function tokenizePageRange(expr: string): Token[] {
  if (typeof expr !== 'string' || expr.trim() === '') {
    throw new PlanError(ERROR_CODES.INVALID_PAGE_RANGE, 'Page range is empty.', { expr })
  }
  const parts = expr
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '')
  if (parts.length === 0) {
    throw new PlanError(ERROR_CODES.INVALID_PAGE_RANGE, 'Page range is empty.', { expr })
  }
  return parts.map((part) => parseToken(part, expr))
}

function parseToken(part: string, expr: string): Token {
  const lower = part.toLowerCase()
  if (lower === 'last' || lower === 'even' || lower === 'odd') {
    return { kind: 'keyword', value: lower }
  }

  if (part.includes('-')) {
    const segs = part.split('-').map((s) => s.trim())
    if (segs.length !== 2) throw rangeError(expr, part)
    const [a, b] = segs
    if (!INT.test(a)) throw rangeError(expr, part)
    const from = Number(a)
    if (from < 1) throw rangeError(expr, part)
    if (b.toLowerCase() === 'end') return { kind: 'range', from, to: 'end' }
    if (!INT.test(b)) throw rangeError(expr, part)
    const to = Number(b)
    if (to < from) throw rangeError(expr, part, 'Descending page range.')
    return { kind: 'range', from, to }
  }

  if (!INT.test(part)) throw rangeError(expr, part)
  const n = Number(part)
  if (n < 1) throw rangeError(expr, part)
  return { kind: 'single', n }
}

function checkBound(n: number, pageCount: number, expr: string): void {
  if (n < 1 || n > pageCount) {
    throw new PlanError(
      ERROR_CODES.INVALID_PAGE_RANGE,
      `Page ${n} is out of range for a ${pageCount}-page document.`,
      { expr, page: n, pageCount },
    )
  }
}

/** Resolve a page-range expression against a known page count. */
export function parsePageRange(expr: string, pageCount: number): number[] {
  const tokens = tokenizePageRange(expr)
  const pages = new Set<number>()

  for (const token of tokens) {
    if (token.kind === 'single') {
      checkBound(token.n, pageCount, expr)
      pages.add(token.n)
    } else if (token.kind === 'range') {
      const to = token.to === 'end' ? pageCount : token.to
      checkBound(token.from, pageCount, expr)
      checkBound(to, pageCount, expr)
      for (let i = token.from; i <= to; i++) pages.add(i)
    } else if (token.value === 'last') {
      checkBound(pageCount, pageCount, expr)
      pages.add(pageCount)
    } else if (token.value === 'even') {
      for (let i = 2; i <= pageCount; i += 2) pages.add(i)
    } else {
      for (let i = 1; i <= pageCount; i += 2) pages.add(i)
    }
  }

  return [...pages].sort((a, b) => a - b)
}
