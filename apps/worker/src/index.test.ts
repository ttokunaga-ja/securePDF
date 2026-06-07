import { OPERATION_NAMES } from '@securepdf/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'

import worker, { type Env } from './index'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) },
    ...overrides,
  }
}

const call = (request: Request, env: Env = makeEnv()) => worker.fetch(request, env)

/** Index access that throws instead of yielding `T | undefined`, so assertions on
 *  `at(calls, 0)` etc. type-check under noUncheckedIndexedAccess without `!`. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No element at index ${index}.`)
  return item
}

describe('worker', () => {
  it('serves capabilities with remote disabled when no backend', async () => {
    const res = await call(new Request('https://x/api/v1/capabilities'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      local: { operations: string[] }
      remote: { available: boolean }
    }
    expect(body.local.operations).toContain('merge')
    expect(body.remote.available).toBe(false)
  })

  it('advertises remote when a backend is configured', async () => {
    const res = await call(
      new Request('https://x/api/v1/capabilities'),
      makeEnv({ CLOUD_RUN_URL: 'https://run.example.com' }),
    )
    const body = (await res.json()) as { remote: { available: boolean } }
    expect(body.remote.available).toBe(true)
  })

  it('generates an OpenAPI document', async () => {
    const res = await call(new Request('https://x/openapi.json'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { openapi: string; servers: { url: string }[] }
    expect(body.openapi).toBe('3.1.0')
    expect(at(body.servers, 0).url).toBe('https://x')
  })

  it('keeps the OpenAPI Operation schema in sync with OPERATION_NAMES', async () => {
    const res = await call(new Request('https://x/openapi.json'))
    const body = (await res.json()) as {
      components: { schemas: { Operation: { oneOf: { properties: { op: { const: string } } }[] } } }
    }
    const ops = body.components.schemas.Operation.oneOf.map((s) => s.properties.op.const)
    expect([...ops].sort()).toEqual([...OPERATION_NAMES].sort())
  })

  it('validates a good plan', async () => {
    const res = await call(
      new Request('https://x/api/v1/validate-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          version: '1',
          operations: [{ op: 'merge', inputs: ['a'] }],
          output: { format: 'pdf' },
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true)
  })

  it('rejects a bad plan with 400', async () => {
    const res = await call(
      new Request('https://x/api/v1/validate-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: '2', operations: [], output: {} }),
      }),
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false)
  })

  it('rejects oversized validate-plan requests before reading the body', async () => {
    const res = await call(
      new Request('https://x/api/v1/validate-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(512 * 1024 + 1) },
        body: '{}',
      }),
    )
    expect(res.status).toBe(413)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 503 for heavy endpoints when no backend is configured', async () => {
    const res = await call(new Request('https://x/api/v1/organize', { method: 'POST' }))
    expect(res.status).toBe(503)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'BACKEND_NOT_CONFIGURED',
    )
  })

  it('404s unknown API routes', async () => {
    const res = await call(new Request('https://x/api/v1/nope'))
    expect(res.status).toBe(404)
  })

  it('falls back to static assets for non-API paths', async () => {
    const res = await call(new Request('https://x/index.html'))
    expect(await res.text()).toBe('asset:/index.html')
  })
})

describe('worker proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('streams organize to Cloud Run with allowlisted headers and service auth', async () => {
    const calls: { url: string; headers: Headers }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { headers: Headers }) => {
        calls.push({ url, headers: init.headers })
        return new Response('PDFBYTES', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        })
      }),
    )

    const res = await call(
      new Request('https://x/api/v1/organize', {
        method: 'POST',
        headers: {
          host: 'x',
          authorization: 'Bearer attacker',
          'content-type': 'application/octet-stream',
          'x-api-key': 'tkp_test',
          'x-request-id': 'req-1',
          'x-forwarded-for': '203.0.113.10',
        },
        body: 'PLAN',
      }),
      makeEnv({ CLOUD_RUN_URL: 'https://run.example.com/', CLOUD_RUN_TOKEN: 'secret' }),
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('PDFBYTES')
    expect(calls).toHaveLength(1)
    expect(at(calls, 0).url).toBe('https://run.example.com/organize')
    expect(at(calls, 0).headers.get('authorization')).toBe('Bearer secret')
    expect(at(calls, 0).headers.get('host')).toBeNull()
    expect(at(calls, 0).headers.get('x-api-key')).toBe('tkp_test')
    expect(at(calls, 0).headers.get('x-request-id')).toBe('req-1')
    expect(at(calls, 0).headers.get('x-forwarded-for')).toBeNull()
  })

  it('drops client Authorization when no Cloud Run token is configured', async () => {
    const calls: { headers: Headers }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Headers }) => {
        calls.push({ headers: init.headers })
        return new Response('ok', { status: 200 })
      }),
    )

    await call(
      new Request('https://x/api/v1/organize', {
        method: 'POST',
        headers: { authorization: 'Bearer attacker', 'x-api-key': 'tkp_test' },
        body: 'PLAN',
      }),
      makeEnv({ CLOUD_RUN_URL: 'https://run.example.com/' }),
    )

    expect(calls).toHaveLength(1)
    expect(at(calls, 0).headers.get('authorization')).toBeNull()
    expect(at(calls, 0).headers.get('x-api-key')).toBe('tkp_test')
  })

  it('maps the nested convert route', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url)
        return new Response('ok', { status: 200 })
      }),
    )
    await call(
      new Request('https://x/api/v1/convert/to-pdf', { method: 'POST', body: 'x' }),
      makeEnv({ CLOUD_RUN_URL: 'https://run.example.com' }),
    )
    expect(seen[0]).toBe('https://run.example.com/convert/to-pdf')
  })

  it('returns 502 BACKEND_UNAVAILABLE when the backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )
    const res = await call(
      new Request('https://x/api/v1/organize', { method: 'POST', body: 'x' }),
      makeEnv({ CLOUD_RUN_URL: 'https://run.example.com' }),
    )
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'BACKEND_UNAVAILABLE',
    )
  })
})

describe('office convert', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns 503 when no GAS backend is configured', async () => {
    const res = await call(
      new Request('https://x/api/v1/convert/office', { method: 'POST', body: '{}' }),
    )
    expect(res.status).toBe(503)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'BACKEND_NOT_CONFIGURED',
    )
  })

  it('advertises office-to-pdf (via apps-script) in capabilities when GAS is set', async () => {
    const res = await call(
      new Request('https://x/api/v1/capabilities'),
      makeEnv({ GAS_CONVERT_URL: 'https://script.google.com/macros/s/abc/exec' }),
    )
    const body = (await res.json()) as {
      remote: { available: boolean; via?: string; adds?: string[] }
    }
    expect(body.remote.available).toBe(true)
    expect(body.remote.via).toBe('apps-script')
    expect(body.remote.adds).toContain('office-to-pdf')
  })

  it('requires an API key before using the GAS conversion backend', async () => {
    const res = await call(
      new Request('https://x/api/v1/convert/office', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      makeEnv({ GAS_CONVERT_URL: 'https://script.google.com/macros/s/abc/exec' }),
    )
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })

  it('forwards to the GAS web app with the shared-secret token and returns its JSON', async () => {
    const calls: { url: string; body: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body?: BodyInit | null }) => {
        calls.push({ url, body: String(init.body ?? '') })
        return new Response(JSON.stringify({ ok: true, pdfBase64: 'UERG' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    const res = await call(
      new Request('https://x/api/v1/convert/office', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'tkp_test' },
        body: JSON.stringify({
          mimeType: 'application/msword',
          filename: 'a.doc',
          fileBase64: 'AAA',
        }),
      }),
      makeEnv({
        GAS_CONVERT_URL: 'https://script.google.com/macros/s/abc/exec',
        GAS_TOKEN: 'secret',
      }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { ok: boolean; pdfBase64: string }).pdfBase64).toBe('UERG')
    expect(calls).toHaveLength(1)
    const u = new URL(at(calls, 0).url)
    expect(u.origin + u.pathname).toBe('https://script.google.com/macros/s/abc/exec')
    expect(u.searchParams.get('token')).toBeNull()
    expect(JSON.parse(at(calls, 0).body)).toMatchObject({ token: 'secret', filename: 'a.doc' })
  })

  it('proxies office to Cloud Run (forwarding X-API-Key) when CLOUD_RUN_URL is set', async () => {
    const calls: { url: string; headers: Headers }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { headers: Headers }) => {
        calls.push({ url, headers: init.headers })
        return new Response(JSON.stringify({ ok: true, pdfBase64: 'UERG' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    const res = await call(
      new Request('https://x/api/v1/convert/office', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'tkp_test' },
        body: '{"mimeType":"application/msword","filename":"a.doc","fileBase64":"AAA"}',
      }),
      // Cloud Run is preferred even when GAS is also configured.
      makeEnv({
        CLOUD_RUN_URL: 'https://office.run.example.com',
        GAS_CONVERT_URL: 'https://gas/exec',
      }),
    )
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(at(calls, 0).url).toBe('https://office.run.example.com/convert/office')
    expect(at(calls, 0).headers.get('x-api-key')).toBe('tkp_test')
  })
})
