// secure-pdf Worker — Cloudflare free tier.
//
//   - serve the SPA static assets
//   - GET  /api/v1/capabilities  (light)
//   - GET  /openapi.json         (generated from the schema)
//   - POST /api/v1/validate-plan (light: @securepdf/schema, no PDF parsing)
//   - POST /api/v1/organize, /api/v1/convert/to-pdf
//       → STREAM-PROXY to Cloud Run (CLOUD_RUN_URL); 503 when unset.
//
// The Worker never imports the heavy @securepdf/core or parses file bytes — that
// would risk the 10 ms CPU / 128 MB / 3 MB-bundle free limits. See
// docs/CLOUD_RUN_BOUNDARY.md.

import { OPERATION_NAMES, SCHEMA_VERSION, validatePlan } from '@securepdf/schema'

import { buildOpenApi } from './openapi'

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Base URL of the private Cloud Run backend. Empty/unset ⇒ remote disabled. */
  CLOUD_RUN_URL?: string
  /** Optional bearer token attached to Cloud Run requests (keeps it private). */
  CLOUD_RUN_TOKEN?: string
}

const PROXY_ROUTES = new Set(['/api/v1/organize', '/api/v1/convert/to-pdf'])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    if (pathname === '/api/v1/capabilities') {
      return json(capabilities(env))
    }
    if (pathname === '/openapi.json') {
      return json(buildOpenApi(url.origin))
    }
    if (pathname === '/api/v1/validate-plan') {
      return handleValidate(request)
    }
    if (PROXY_ROUTES.has(pathname)) {
      return proxyToCloudRun(request, env, pathname)
    }
    if (pathname.startsWith('/api/')) {
      return json(errorBody('NOT_FOUND', 'Unknown endpoint.'), 404)
    }

    // Non-API paths are served by the static-assets binding before the Worker
    // runs; this fallback covers direct Worker invocation.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

function capabilities(env: Env) {
  const remoteAvailable = Boolean(env.CLOUD_RUN_URL)
  return {
    version: SCHEMA_VERSION,
    local: {
      operations: OPERATION_NAMES,
      inputFormats: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    remote: remoteAvailable
      ? {
          available: true,
          via: 'cloud-run',
          adds: ['office-to-pdf', 'large-files', 'compress', 'repair'],
          maxInputBytes: 104_857_600,
        }
      : { available: false },
  }
}

async function handleValidate(request: Request): Promise<Response> {
  let plan: unknown
  try {
    plan = await readPlan(request)
  } catch {
    return json(errorBody('INVALID_PLAN', 'Request body is not a valid plan.'), 400)
  }
  const result = validatePlan(plan)
  return json(result, result.ok ? 200 : 400)
}

async function readPlan(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const part = form.get('plan')
    if (typeof part === 'string') return JSON.parse(part)
    if (part && typeof (part as Blob).text === 'function') {
      return JSON.parse(await (part as Blob).text())
    }
    throw new Error('missing plan part')
  }
  return request.json()
}

async function proxyToCloudRun(request: Request, env: Env, pathname: string): Promise<Response> {
  if (!env.CLOUD_RUN_URL) {
    return json(errorBody('BACKEND_NOT_CONFIGURED', 'No Cloud Run backend is configured.'), 503)
  }
  const target = env.CLOUD_RUN_URL.replace(/\/+$/, '') + pathname.replace(/^\/api\/v1/, '')
  const headers = new Headers(request.headers)
  headers.delete('host')
  if (env.CLOUD_RUN_TOKEN) headers.set('authorization', `Bearer ${env.CLOUD_RUN_TOKEN}`)

  // Stream the body straight through — never buffer or parse it here.
  try {
    return await fetch(target, { method: request.method, headers, body: request.body })
  } catch {
    return json(errorBody('BACKEND_UNAVAILABLE', 'Cloud Run backend is unreachable.'), 502)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function errorBody(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}
