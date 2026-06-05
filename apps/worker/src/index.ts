// secure-pdf Worker — Cloudflare free tier.
//
// Responsibilities (all sub-millisecond, no PDF parsing — see
// docs/CLOUD_RUN_BOUNDARY.md):
//   - serve the SPA static assets
//   - GET  /api/v1/capabilities  (live)
//   - GET  /openapi.json         (generated from the schema — Milestone 4)
//   - POST /api/v1/validate-plan (light: schema + declared counts — Milestone 4)
//   - POST /api/v1/organize, /api/v1/convert/to-pdf
//       → STREAM-PROXY to Cloud Run (CLOUD_RUN_URL) — wired in Milestone 4.
//       → 503 BACKEND_NOT_CONFIGURED when no backend is set.
//
// The Worker must never import the heavy @securepdf/core or parse file bytes:
// that would risk the 10 ms CPU / 128 MB / 3 MB-bundle free limits. Heavy work is
// done in the browser (local-first) or on Cloud Run (proxied).

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Base URL of the private Cloud Run backend. Empty/unset ⇒ remote disabled. */
  CLOUD_RUN_URL?: string
}

/** Heavy endpoints that are proxied to Cloud Run rather than handled here. */
const PROXY_ROUTES = new Set(['/api/v1/organize', '/api/v1/convert/to-pdf'])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function errorBody(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

function capabilities(env: Env) {
  const remoteAvailable = Boolean(env.CLOUD_RUN_URL)
  return {
    version: '1',
    local: {
      operations: [
        'merge',
        'split',
        'extract',
        'delete',
        'rotate',
        'reorder',
        'insertPdf',
        'insertImage',
        'convertToPdf',
      ],
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/v1/capabilities') {
      return json(capabilities(env))
    }

    if (pathname === '/openapi.json' || pathname === '/api/v1/validate-plan') {
      return json(errorBody('NOT_IMPLEMENTED', 'Implemented in Milestone 4.'), 501)
    }

    if (PROXY_ROUTES.has(pathname)) {
      if (!env.CLOUD_RUN_URL) {
        return json(errorBody('BACKEND_NOT_CONFIGURED', 'No Cloud Run backend is configured.'), 503)
      }
      // Milestone 4: stream-proxy to Cloud Run, e.g.
      //   const target = env.CLOUD_RUN_URL.replace(/\/$/, '') + pathname.replace('/api/v1', '')
      //   return fetch(target, { method: request.method, headers: withAuth(request.headers), body: request.body })
      // (pass request.body straight through — never buffer/parse — and attach the
      // Cloud Run credential; see OQ1.)
      return json(errorBody('NOT_IMPLEMENTED', 'Proxy is wired in Milestone 4.'), 501)
    }

    if (pathname.startsWith('/api/')) {
      return json(errorBody('NOT_FOUND', 'Unknown endpoint.'), 404)
    }

    // Non-API paths are normally served by the static-assets binding before the
    // Worker runs; this fallback covers direct Worker invocation.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
