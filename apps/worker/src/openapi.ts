// Generate the OpenAPI 3.1 document from the operation schema so the API spec has
// a single source of truth (docs/api.md is the human mirror).

import { OPERATION_NAMES, SCHEMA_VERSION } from '@securepdf/schema'

export function buildOpenApi(origin: string): unknown {
  const errorResponse = {
    description: 'Error',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  }

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
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    plan: { type: 'string', description: 'JSON operation plan' },
                  },
                  required: ['plan'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'application/pdf or application/zip' },
            '503': errorResponse,
          },
        },
      },
      '/api/v1/convert/to-pdf': {
        post: {
          summary: 'Convert image inputs to PDF (proxied to Cloud Run)',
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
          },
        },
        Operation: {
          type: 'object',
          required: ['op'],
          properties: { op: { enum: [...OPERATION_NAMES] } },
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
