// Structural validation of an untrusted plan: shape, version, operation names,
// per-operation parameters, and page-range *syntax*. Bound checks against actual
// page counts happen in the engine (packages/core), where files are parsed.

import { ERROR_CODES, isPlanError } from './errors'
import { tokenizePageRange } from './pageRange'
import {
  OPERATION_NAMES,
  SCHEMA_VERSION,
  type OperationName,
  type OperationPlan,
  type ValidationError,
  type ValidationResult,
} from './types'

type Add = (code: string, message: string, details?: Record<string, unknown>) => void
type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export function validatePlan(plan: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const add: Add = (code, message, details) => errors.push({ code, message, details })

  if (!isRec(plan)) {
    return {
      ok: false,
      errors: [{ code: ERROR_CODES.INVALID_PLAN, message: 'Plan must be an object.' }],
    }
  }

  if (plan.version !== SCHEMA_VERSION) {
    add(ERROR_CODES.INVALID_PLAN, `Unsupported version; expected "${SCHEMA_VERSION}".`, {
      version: plan.version,
    })
  }

  const inputIds = collectInputIds(plan.inputs, add)
  validateOutput(plan.output, add)

  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    add(ERROR_CODES.INVALID_PLAN, 'operations must be a non-empty array.')
  } else {
    plan.operations.forEach((op, i) => validateOperation(op, i, inputIds, add))
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, normalizedPlan: plan as unknown as OperationPlan }
}

function collectInputIds(inputs: unknown, add: Add): Set<string> {
  const ids = new Set<string>()
  if (inputs === undefined) return ids
  if (!Array.isArray(inputs)) {
    add(ERROR_CODES.INVALID_PLAN, 'inputs must be an array.')
    return ids
  }
  inputs.forEach((input, i) => {
    if (!isRec(input) || !isNonEmptyString(input.id)) {
      add(ERROR_CODES.INVALID_PLAN, `inputs[${i}] must have a non-empty string id.`)
      return
    }
    if (ids.has(input.id)) add(ERROR_CODES.INVALID_PLAN, `Duplicate input id "${input.id}".`)
    ids.add(input.id)
  })
  return ids
}

function validateOutput(output: unknown, add: Add): void {
  if (!isRec(output)) {
    add(ERROR_CODES.INVALID_PLAN, 'output is required.')
    return
  }
  if (output.format !== 'pdf') add(ERROR_CODES.INVALID_PLAN, 'output.format must be "pdf".')
  if (output.container !== undefined && output.container !== 'zip') {
    add(ERROR_CODES.INVALID_PLAN, 'output.container, if set, must be "zip".')
  }
}

function validateOperation(op: unknown, i: number, inputIds: Set<string>, add: Add): void {
  const at = `operations[${i}]`
  if (!isRec(op) || typeof op.op !== 'string') {
    add(ERROR_CODES.INVALID_PLAN, `${at} must have a string "op".`)
    return
  }
  if (!OPERATION_NAMES.includes(op.op as OperationName)) {
    add(ERROR_CODES.UNKNOWN_OPERATION, `${at}: unknown operation "${op.op}".`, { op: op.op })
    return
  }

  const ref = (id: unknown, field: string) => {
    if (!isNonEmptyString(id)) {
      add(ERROR_CODES.INVALID_PLAN, `${at}.${field} must be a non-empty input id.`)
    } else if (inputIds.size > 0 && !inputIds.has(id)) {
      add(ERROR_CODES.MISSING_INPUT, `${at}.${field} references unknown input "${id}".`, {
        input: id,
      })
    }
  }
  const pages = (v: unknown, field: string) => {
    if (!isNonEmptyString(v)) {
      add(ERROR_CODES.INVALID_PLAN, `${at}.${field} must be a non-empty page expression.`)
      return
    }
    try {
      tokenizePageRange(v)
    } catch (e) {
      add(
        isPlanError(e) ? e.code : ERROR_CODES.INVALID_PAGE_RANGE,
        `${at}.${field}: ${(e as Error).message}`,
        { expr: v },
      )
    }
  }
  const inputList = (v: unknown, field: string) => {
    if (!Array.isArray(v) || v.length === 0) {
      add(ERROR_CODES.INVALID_PLAN, `${at}.${field} must be a non-empty array of input ids.`)
      return
    }
    v.forEach((id) => ref(id, field))
  }
  const at0 = (v: unknown) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      add(ERROR_CODES.INVALID_PLAN, `${at}.at must be a non-negative integer index.`)
    }
  }

  switch (op.op as OperationName) {
    case 'merge':
      inputList(op.inputs, 'inputs')
      break
    case 'split': {
      const modes = [
        op.ranges !== undefined,
        op.everyNPages !== undefined,
        op.atPages !== undefined,
      ]
      if (modes.filter(Boolean).length !== 1) {
        add(
          ERROR_CODES.INVALID_PLAN,
          `${at}: split needs exactly one of ranges, everyNPages, atPages.`,
        )
      }
      if (op.ranges !== undefined) {
        if (!Array.isArray(op.ranges) || op.ranges.length === 0) {
          add(ERROR_CODES.INVALID_PLAN, `${at}.ranges must be a non-empty array.`)
        } else {
          op.ranges.forEach((r, k) => pages(r, `ranges[${k}]`))
        }
      }
      if (op.everyNPages !== undefined) {
        if (
          typeof op.everyNPages !== 'number' ||
          !Number.isInteger(op.everyNPages) ||
          op.everyNPages < 1
        ) {
          add(ERROR_CODES.INVALID_PLAN, `${at}.everyNPages must be a positive integer.`)
        }
      }
      if (op.atPages !== undefined) pages(op.atPages, 'atPages')
      break
    }
    case 'extract':
      pages(op.pages, 'pages')
      break
    case 'delete':
      pages(op.pages, 'pages')
      break
    case 'rotate':
      pages(op.pages, 'pages')
      if (op.degrees !== 90 && op.degrees !== 180 && op.degrees !== 270) {
        add(ERROR_CODES.INVALID_PLAN, `${at}.degrees must be 90, 180, or 270.`, {
          degrees: op.degrees,
        })
      }
      break
    case 'reorder':
      if (
        !Array.isArray(op.order) ||
        op.order.length === 0 ||
        !op.order.every((n) => Number.isInteger(n) && (n as number) >= 1)
      ) {
        add(
          ERROR_CODES.INVALID_PLAN,
          `${at}.order must be a non-empty array of 1-based page numbers.`,
        )
      }
      break
    case 'insertPdf':
      ref(op.input, 'input')
      at0(op.at)
      if (op.pages !== undefined) pages(op.pages, 'pages')
      break
    case 'insertImage':
      ref(op.input, 'input')
      at0(op.at)
      break
    case 'convertToPdf':
      inputList(op.inputs, 'inputs')
      break
  }
}
