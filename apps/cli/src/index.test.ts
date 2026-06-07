import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from './index'

let out: string[]
let err: string[]

beforeEach(() => {
  out = []
  err = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    err.push(String(chunk))
    return true
  })
})

afterEach(() => vi.restoreAllMocks())

function withPlan(plan: unknown, run: (path: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'securepdf-cli-'))
  const path = join(dir, 'plan.json')
  writeFileSync(path, JSON.stringify(plan))
  return run(path).finally(() => rmSync(dir, { recursive: true, force: true }))
}

describe('cli main', () => {
  it('prints help when given no command', async () => {
    const result = await main([])
    expect(result.code).toBe(0)
    expect(out.join('')).toContain('securepdf')
  })

  it('prints the schema version', async () => {
    const result = await main(['--version'])
    expect(result.code).toBe(0)
    expect(out.join('')).toContain('securepdf 1')
  })

  it('errors on an unknown command', async () => {
    const result = await main(['frobnicate', '--json'])
    expect(result.code).toBe(1)
    expect(err.join('')).toContain('INVALID_PLAN')
  })

  it('errors when merge has no inputs', async () => {
    const result = await main(['merge', '--json'])
    expect(result.code).toBe(1)
    expect(err.join('')).toContain('INVALID_PLAN')
  })

  it('validates a good plan file locally', async () => {
    await withPlan(
      { version: '1', operations: [{ op: 'merge', inputs: ['a'] }], output: { format: 'pdf' } },
      async (path) => {
        const result = await main(['validate', '--plan', path, '--json'])
        expect(result.code).toBe(0)
        expect(out.join('')).toContain('"ok":true')
      },
    )
  })

  it('reports an invalid plan file', async () => {
    await withPlan({ version: '2', operations: [], output: {} }, async (path) => {
      const result = await main(['validate', '--plan', path])
      expect(result.code).toBe(1)
    })
  })
})
