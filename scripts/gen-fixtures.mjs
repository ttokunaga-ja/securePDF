// Generate the synthetic test fixtures described in fixtures/README.md.
// Deterministic (fixed dates, fixed geometry) and tiny — no real user documents.
// Run with `pnpm gen:fixtures`.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { degrees, PDFDocument } from '@cantoo/pdf-lib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pdfDir = join(root, 'fixtures', 'pdf')
const imgDir = join(root, 'fixtures', 'img')
mkdirSync(pdfDir, { recursive: true })
mkdirSync(imgDir, { recursive: true })

const FIXED = new Date('2020-01-01T00:00:00Z')

/** Build a PDF from [width, height] page sizes; optionally rotate page 1 by 90°. */
async function makePdf(sizes, { rotateFirst = false } = {}) {
  const doc = await PDFDocument.create()
  doc.setCreationDate(FIXED)
  doc.setModificationDate(FIXED)
  doc.setProducer('securepdf-fixtures')
  sizes.forEach(([w, h], i) => {
    const page = doc.addPage([w, h])
    if (rotateFirst && i === 0) page.setRotation(degrees(90))
  })
  return doc.save()
}

function fromBase64(b64) {
  return Uint8Array.from(Buffer.from(b64, 'base64'))
}

const fixtures = [
  ['pdf/1-page.pdf', await makePdf([[200, 280]])],
  [
    'pdf/3-page.pdf',
    await makePdf([
      [200, 280],
      [240, 200],
      [200, 280],
    ]),
  ],
  [
    'pdf/rotated.pdf',
    await makePdf(
      [
        [200, 280],
        [240, 200],
        [200, 280],
      ],
      { rotateFirst: true },
    ),
  ],
  // A PDF header followed by garbage — must fail parsing with CORRUPT_PDF.
  ['pdf/corrupt.pdf', Buffer.from('%PDF-1.7\n%\xff\xff not a real pdf body\n')],
  // 1×1 PNG and JPEG for image→PDF conversion tests.
  [
    'img/1px.png',
    fromBase64(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    ),
  ],
  [
    'img/1px.jpg',
    fromBase64(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==',
    ),
  ],
]

for (const [name, bytes] of fixtures) {
  writeFileSync(join(root, 'fixtures', name), bytes)
}

console.log(`Wrote ${fixtures.length} fixtures to fixtures/{pdf,img}/`)
