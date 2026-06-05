import { describe, expect, it } from 'vitest'

import worker, { type Env } from './index'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) },
    ...overrides,
  }
}

const call = (request: Request, env: Env = makeEnv()) => worker.fetch(request, env)

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
    expect(body.servers[0].url).toBe('https://x')
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
