// secure-pdf Worker — Cloudflare free tier.
//
//   - serve the SPA static assets
//   - GET  /api/v1/capabilities  (light)
//   - GET  /openapi.json         (generated from the schema)
//   - POST /api/v1/validate-plan (light: @securepdf/schema, no PDF parsing)
//   - POST /api/v1/organize, /api/v1/convert/to-pdf
//       → STREAM-PROXY to Cloud Run (CLOUD_RUN_URL); 503 when unset.
//   - POST /api/v1/convert/office
//       → if CLOUD_RUN_URL is set: proxy to the authenticated Cloud Run office
//         service (X-API-Key forwarded; key + daily credits enforced there via
//         trialAuth/authAPI). Else fall back to the GAS Web App (GAS_CONVERT_URL),
//         requiring X-API-Key header. GAS_TOKEN is injected into the POST body
//         (not the URL) to keep it out of logs. 503 when neither is set.
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
  /** Google Apps Script Web App URL for Office→PDF (server-to-server, no CORS). */
  GAS_CONVERT_URL?: string
  /** Shared secret injected into the GAS POST body (never in the URL). */
  GAS_TOKEN?: string
}

const PROXY_ROUTES = new Set(['/api/v1/organize', '/api/v1/convert/to-pdf'])
const MAX_VALIDATE_PLAN_BYTES = 512 * 1024

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
    if (pathname === '/api/v1/convert/office') {
      // Prefer the authenticated Cloud Run office service (forwards X-API-Key).
      if (env.CLOUD_RUN_URL) return proxyToCloudRun(request, env, pathname)
      if (!env.GAS_CONVERT_URL) return proxyToGas(request, env)
      // GAS fallback: require X-API-Key to prevent anonymous callers from
      // exhausting the deploying user's Google Drive daily conversion quota.
      if (!request.headers.get('x-api-key')) {
        return json(errorBody('UNAUTHORIZED', 'X-API-Key header required.'), 401)
      }
      return proxyToGas(request, env)
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
  const cloudRun = Boolean(env.CLOUD_RUN_URL)
  const office = Boolean(env.GAS_CONVERT_URL)
  const remoteAvailable = cloudRun || office
  const adds = [
    ...(office || cloudRun ? ['office-to-pdf'] : []),
    ...(cloudRun ? ['large-files', 'compress', 'repair'] : []),
  ]
  return {
    version: SCHEMA_VERSION,
    local: {
      operations: OPERATION_NAMES,
      inputFormats: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    remote: remoteAvailable
      ? {
          available: true,
          via: cloudRun ? 'cloud-run' : 'apps-script',
          adds,
          maxInputBytes: 104_857_600,
        }
      : { available: false },
  }
}

/** Forward an Office→PDF JSON request to the Google Apps Script Web App. GAS is
 *  called server-to-server (no CORS). The shared secret is injected into the JSON
 *  POST body so it never appears in the request URL or server logs. The body is
 *  buffered because a streamed body can't be replayed across GAS's 302→GET redirect. */
async function proxyToGas(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json(errorBody('NOT_FOUND', 'Use POST for Office conversion.'), 404)
  }
  if (!env.GAS_CONVERT_URL) {
    return json(
      errorBody('BACKEND_NOT_CONFIGURED', 'No Office conversion backend is configured.'),
      503,
    )
  }
  let bodyText: string
  try {
    bodyText = await request.text()
  } catch {
    return json(errorBody('INVALID_PLAN', 'Request body could not be read.'), 400)
  }
  // Inject the shared secret into the JSON body to keep it out of the request URL.
  if (env.GAS_TOKEN) {
    try {
      const parsed = JSON.parse(bodyText) as Record<string, unknown>
      parsed.token = env.GAS_TOKEN
      bodyText = JSON.stringify(parsed)
    } catch {
      return json(errorBody('INVALID_PLAN', 'Request body is not valid JSON.'), 400)
    }
  }
  try {
    const upstream = await fetch(env.GAS_CONVERT_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: bodyText,
      redirect: 'follow',
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch {
    return json(errorBody('BACKEND_UNAVAILABLE', 'Office conversion backend is unreachable.'), 502)
  }
}

async function handleValidate(request: Request): Promise<Response> {
  if (bodyTooLarge(request, MAX_VALIDATE_PLAN_BYTES)) {
    return json(errorBody('PAYLOAD_TOO_LARGE', 'Validation request body is too large.'), 413)
  }
  let plan: unknown
  try {
    plan = await readPlan(request)
  } catch {
    return json(errorBody('INVALID_PLAN', 'Request body is not a valid plan.'), 400)
  }
  const result = validatePlan(plan)
  return json(result, result.ok ? 200 : 400)
}

function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get('content-length')
  if (!raw) return false
  const size = Number.parseInt(raw, 10)
  return Number.isFinite(size) && size > maxBytes
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
  const headers = cloudRunHeaders(request, env)

  // Stream the body straight through — never buffer or parse it here.
  try {
    return await fetch(target, { method: request.method, headers, body: request.body })
  } catch {
    return json(errorBody('BACKEND_UNAVAILABLE', 'Cloud Run backend is unreachable.'), 502)
  }
}

function cloudRunHeaders(request: Request, env: Env): Headers {
  const incoming = request.headers
  const headers = new Headers()
  for (const name of ['content-type', 'accept', 'x-api-key', 'x-request-id']) {
    const value = incoming.get(name)
    if (value) headers.set(name, value)
  }
  if (env.CLOUD_RUN_TOKEN) headers.set('authorization', `Bearer ${env.CLOUD_RUN_TOKEN}`)
  return headers
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
