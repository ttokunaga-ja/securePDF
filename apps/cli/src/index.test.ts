import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PDFDocument } from '@cantoo/pdf-lib'
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'securepdf-cli-'))
  return run(dir).finally(() => rmSync(dir, { recursive: true, force: true }))
}

function withPlan(plan: unknown, run: (path: string) => Promise<void>): Promise<void> {
  return withTempDir((dir) => {
    const path = join(dir, 'plan.json')
    writeFileSync(path, JSON.stringify(plan))
    return run(path)
  })
}

async function readPdf(path: string): Promise<PDFDocument> {
  return PDFDocument.load(readFileSync(path))
}

async function onePagePdfBase64(): Promise<string> {
  const doc = await PDFDocument.create()
  doc.addPage()
  return Buffer.from(await doc.save()).toString('base64')
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

  it('rotates selected pages locally', async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, 'rotated.pdf')
      const result = await main([
        'rotate',
        'fixtures/pdf/3-page.pdf',
        '--pages',
        '1',
        '--degrees',
        '90',
        '-o',
        output,
      ])
      const doc = await readPdf(output)

      expect(result.code).toBe(0)
      expect(doc.getPage(0).getRotation().angle).toBe(90)
      expect(doc.getPage(1).getRotation().angle).toBe(0)
    })
  })

  it('deletes, extracts, flips, and reorders pages locally', async () => {
    await withTempDir(async (dir) => {
      const deleted = join(dir, 'deleted.pdf')
      const extracted = join(dir, 'extracted.pdf')
      const flipped = join(dir, 'flipped.pdf')
      const reordered = join(dir, 'reordered.pdf')

      expect(
        (await main(['delete', 'fixtures/pdf/3-page.pdf', '--pages', '2', '-o', deleted])).code,
      ).toBe(0)
      expect((await readPdf(deleted)).getPageCount()).toBe(2)

      expect(
        (await main(['extract', 'fixtures/pdf/3-page.pdf', '--pages', '1,3', '-o', extracted]))
          .code,
      ).toBe(0)
      expect((await readPdf(extracted)).getPageCount()).toBe(2)

      expect(
        (
          await main([
            'flip',
            'fixtures/pdf/3-page.pdf',
            '--pages',
            'even',
            '--axis',
            'vertical',
            '-o',
            flipped,
          ])
        ).code,
      ).toBe(0)
      expect((await readPdf(flipped)).getPageCount()).toBe(3)

      expect(
        (await main(['reorder', 'fixtures/pdf/3-page.pdf', '--order', '2,1,3', '-o', reordered]))
          .code,
      ).toBe(0)
      const reorderedDoc = await readPdf(reordered)
      expect(reorderedDoc.getPages().map((page) => page.getWidth())).toEqual([240, 200, 200])
    })
  })

  it('inserts PDF and image pages locally', async () => {
    await withTempDir(async (dir) => {
      const withPdf = join(dir, 'with-pdf.pdf')
      const withImage = join(dir, 'with-image.pdf')

      expect(
        (
          await main([
            'insert-pdf',
            'fixtures/pdf/1-page.pdf',
            'fixtures/pdf/3-page.pdf',
            '--at',
            '1',
            '--pages',
            '2',
            '-o',
            withPdf,
          ])
        ).code,
      ).toBe(0)
      expect((await readPdf(withPdf)).getPageCount()).toBe(2)

      expect(
        (
          await main([
            'insert-image',
            'fixtures/pdf/1-page.pdf',
            'fixtures/img/1px.png',
            '--at',
            '0',
            '-o',
            withImage,
          ])
        ).code,
      ).toBe(0)
      expect((await readPdf(withImage)).getPageCount()).toBe(2)
    })
  })

  it('converts images and writes split outputs beside the requested path', async () => {
    await withTempDir(async (dir) => {
      const imagePdf = join(dir, 'image.pdf')
      const splitStem = join(dir, 'page.pdf')

      expect(
        (await main(['convert', 'fixtures/img/1px.png', '--to', 'pdf', '-o', imagePdf])).code,
      ).toBe(0)
      expect((await readPdf(imagePdf)).getPageCount()).toBe(1)

      expect(
        (await main(['split', 'fixtures/pdf/3-page.pdf', '--every', '1', '-o', splitStem])).code,
      ).toBe(0)
      expect(existsSync(join(dir, 'page-1.pdf'))).toBe(true)
      expect(existsSync(join(dir, 'page-2.pdf'))).toBe(true)
      expect(existsSync(join(dir, 'page-3.pdf'))).toBe(true)
    })
  })

  it('converts Office files through the endpoint with X-API-Key', async () => {
    await withTempDir(async (dir) => {
      const input = join(dir, 'deck.pptx')
      const output = join(dir, 'deck.pdf')
      writeFileSync(input, 'office bytes')
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
        return new Response(JSON.stringify({ ok: true, pdfBase64: await onePagePdfBase64() }), {
          headers: { 'content-type': 'application/json' },
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await main([
        'convert',
        input,
        '--to',
        'pdf',
        '--endpoint',
        'https://securepdf.example.com/',
        '--api-key',
        'tkp_test',
        '-o',
        output,
      ])
      const call = fetchMock.mock.calls[0]
      expect(call).toBeDefined()
      const [url, init] = call ?? []
      if (!init) throw new Error('fetch init missing')
      const body = JSON.parse(String(init.body)) as { filename: string; mimeType: string }

      expect(result.code).toBe(0)
      expect(url).toBe('https://securepdf.example.com/api/v1/convert/office')
      expect(new Headers(init.headers).get('x-api-key')).toBe('tkp_test')
      expect(body.filename).toBe('deck.pptx')
      expect(body.mimeType).toContain('presentation')
      expect((await readPdf(output)).getPageCount()).toBe(1)
    })
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
