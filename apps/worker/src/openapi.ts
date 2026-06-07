// Generate the OpenAPI 3.1 document from the operation schema so the API spec has
// a single source of truth (docs/api.md is the human mirror). The per-operation
// schemas mirror the structural checks in @securepdf/schema's validate.ts; the
// `oneOf` is built from OPERATION_NAMES so it can never silently fall behind.

import { OPERATION_NAMES, SCHEMA_VERSION } from '@securepdf/schema'

const PAGES = { type: 'string', description: 'Page range, e.g. "1-3,5,last"' }
const FIT = { enum: ['contain', 'cover', 'native'] }
const STR = { type: 'string' }
const NUM = { type: 'number' }
const arr = (items: unknown = STR) => ({ type: 'array', items })
const int = (minimum: number) => ({ type: 'integer', minimum })

function op(
  name: string,
  properties: Record<string, unknown>,
  required: string[],
  description?: string,
) {
  return {
    type: 'object',
    ...(description ? { description } : {}),
    required: ['op', ...required],
    properties: { op: { const: name }, ...properties },
  }
}

/** One schema per operation, keyed by op name. Kept in lockstep with validate.ts. */
function operationSchemas(): Record<string, unknown> {
  return {
    merge: op('merge', { inputs: arr() }, ['inputs']),
    split: op(
      'split',
      { ranges: arr(PAGES), everyNPages: int(1), atPages: PAGES },
      [],
      'Provide exactly one of ranges, everyNPages, atPages.',
    ),
    extract: op('extract', { pages: PAGES }, ['pages']),
    delete: op('delete', { pages: PAGES }, ['pages']),
    rotate: op('rotate', { pages: PAGES, degrees: { enum: [90, 180, 270] } }, ['pages', 'degrees']),
    flip: op('flip', { pages: PAGES, axis: { enum: ['horizontal', 'vertical'] } }, [
      'pages',
      'axis',
    ]),
    reorder: op(
      'reorder',
      { order: { type: 'array', items: int(1) } },
      ['order'],
      'A full 1-based permutation of the working document.',
    ),
    insertPdf: op('insertPdf', { input: STR, at: int(0), pages: PAGES }, ['input', 'at']),
    insertImage: op(
      'insertImage',
      { input: STR, at: int(0), pageSize: STR, fit: FIT, margin: NUM, dpi: NUM },
      ['input', 'at'],
    ),
    convertToPdf: op(
      'convertToPdf',
      { inputs: arr(), pageSize: STR, fit: FIT, margin: NUM, dpi: NUM },
      ['inputs'],
    ),
  }
}

function multipartPlanBody(description: string) {
  return {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          description,
          properties: {
            plan: { type: 'string', description: 'JSON operation plan' },
          },
          required: ['plan'],
          additionalProperties: { type: 'string', format: 'binary' },
        },
      },
    },
  }
}

export function buildOpenApi(origin: string): unknown {
  const errorResponse = {
    description: 'Error',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  }
  const schemas = operationSchemas()

  return {
    openapi: '3.1.0',
    info: {
      title: 'securePDF API',
      version: SCHEMA_VERSION,
      description:
        'PDF organization and To-PDF conversion. Light endpoints run on the ' +
        'Cloudflare Worker; organize/convert are proxied to Cloud Run.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/v1/capabilities': {
        get: {
          summary: 'Describe local and remote capabilities',
          responses: { '200': { description: 'Capability descriptor' } },
        },
      },
      '/api/v1/validate-plan': {
        post: {
          summary: 'Validate a plan structurally (no file parsing)',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/OperationPlan' } },
            },
          },
          responses: {
            '200': { description: 'Plan is valid' },
            '400': errorResponse,
          },
        },
      },
      '/api/v1/organize': {
        post: {
          summary: 'Run an organize plan (proxied to Cloud Run)',
          requestBody: multipartPlanBody('A JSON plan part plus binary input parts keyed by id.'),
          responses: {
            '200': { description: 'application/pdf or application/zip' },
            '503': errorResponse,
          },
        },
      },
      '/api/v1/convert/to-pdf': {
        post: {
          summary: 'Convert image inputs to PDF (proxied to Cloud Run)',
          requestBody: multipartPlanBody('A JSON plan part plus binary image parts keyed by id.'),
          responses: { '200': { description: 'application/pdf' }, '503': errorResponse },
        },
      },
    },
    components: {
      schemas: {
        OperationPlan: {
          type: 'object',
          required: ['version', 'operations', 'output'],
          properties: {
            version: { const: SCHEMA_VERSION },
            inputs: { type: 'array', items: { $ref: '#/components/schemas/InputRef' } },
            operations: { type: 'array', items: { $ref: '#/components/schemas/Operation' } },
            output: {
              type: 'object',
              properties: {
                format: { const: 'pdf' },
                filename: { type: 'string' },
                container: { enum: ['zip'] },
              },
              required: ['format'],
            },
          },
        },
        InputRef: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            filename: { type: 'string' },
            type: { type: 'string' },
            pageCount: { type: 'integer' },
          },
        },
        Operation: {
          oneOf: OPERATION_NAMES.map((name) => schemas[name]),
        },
        Error: {
          type: 'object',
          properties: {
            ok: { const: false },
            error: {
              type: 'object',
              properties: { code: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
  }
}
