// Browser-side delivery of generated PDF bytes: save-to-disk and print. Kept out
// of the React tree so the workspace components stay free of DOM plumbing.

import { loadPdfDocument } from './pdf'

export interface PrintSession {
  print: (bytes: Uint8Array) => Promise<void>
  cancel: () => void
}

const CSS_UNITS = 96 / 72
const PRINT_IMAGE_SCALE = 1.6
const PRINT_WINDOW_ERROR =
  '印刷用ウィンドウを開けませんでした。ポップアップを許可してからもう一度お試しください。'

function createPdfBlob(bytes: Uint8Array): Blob {
  // Copy into a plain ArrayBuffer so the Blob part type is unambiguous.
  const part = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Blob([part], { type: 'application/pdf' })
}

/** Trigger a browser download of the given PDF bytes under `name`. */
export function downloadFile(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(createPdfBlob(bytes))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Reserve a same-origin print surface immediately during the click event. The
 * generated PDF is rasterized into this shell, avoiding Chrome's cross-origin
 * built-in PDF viewer frame and preserving popup permission for async export.
 */
export function createPrintSession(): PrintSession {
  const target = window.open('', '_blank')
  if (!target) return blockedPrintSession()

  let cancelled = false
  const imageUrls: string[] = []

  try {
    target.opener = null
    initializePrintDocument(target.document)
  } catch {
    target.close()
    return blockedPrintSession()
  }

  const cleanup = () => {
    for (const url of imageUrls.splice(0)) URL.revokeObjectURL(url)
  }

  return {
    print: async (bytes) => {
      if (cancelled) return
      if (target.closed) throw new Error(PRINT_WINDOW_ERROR)

      await renderPdfForPrint(bytes, target, imageUrls)
      if (cancelled || target.closed) {
        cleanup()
        return
      }

      target.addEventListener('afterprint', cleanup, { once: true })
      target.addEventListener('pagehide', cleanup, { once: true })
      target.focus()
      target.print()
      target.setTimeout(cleanup, 5 * 60_000)
    },
    cancel: () => {
      cancelled = true
      cleanup()
      if (!target.closed) target.close()
    },
  }
}

export async function printFile(bytes: Uint8Array): Promise<void> {
  const session = createPrintSession()
  await session.print(bytes)
}

function blockedPrintSession(): PrintSession {
  return {
    print: async () => {
      throw new Error(PRINT_WINDOW_ERROR)
    },
    cancel: () => undefined,
  }
}

function initializePrintDocument(doc: Document): void {
  doc.open()
  doc.write(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>securePDF 印刷</title>
    <style>
      @page { margin: 0; }
      html, body { margin: 0; background: #f1f3f4; color: #202124; }
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        background: #ffffff;
        border-bottom: 1px solid #dadce0;
      }
      .print-toolbar button {
        border: 0;
        border-radius: 4px;
        padding: 8px 14px;
        background: #1a73e8;
        color: #ffffff;
        font: inherit;
        cursor: pointer;
      }
      .print-pages {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 16px;
      }
      .print-page {
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 1px 5px rgba(60, 64, 67, 0.35);
        break-after: page;
        page-break-after: always;
      }
      .print-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .print-page img {
        display: block;
        width: 100%;
        height: 100%;
      }
      @media print {
        html, body { background: #ffffff; }
        .print-toolbar { display: none; }
        .print-pages { display: block; padding: 0; }
        .print-page { margin: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <span data-print-status>印刷用ページを準備しています...</span>
      <button type="button" data-print-button hidden>印刷</button>
    </div>
    <main class="print-pages" data-print-pages></main>
  </body>
</html>`)
  doc.close()
}

async function renderPdfForPrint(
  bytes: Uint8Array,
  target: Window,
  imageUrls: string[],
): Promise<void> {
  const doc = target.document
  const status = doc.querySelector<HTMLElement>('[data-print-status]')
  const button = doc.querySelector<HTMLButtonElement>('[data-print-button]')
  const pagesRoot = doc.querySelector<HTMLElement>('[data-print-pages]')
  if (!pagesRoot) throw new Error(PRINT_WINDOW_ERROR)

  const pdf = await loadPdfDocument(bytes)
  pagesRoot.replaceChildren()

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (target.closed) throw new Error(PRINT_WINDOW_ERROR)
    if (status) status.textContent = `印刷用ページを準備しています... ${pageNumber}/${pdf.numPages}`

    const page = await pdf.getPage(pageNumber)
    const cssViewport = page.getViewport({ scale: CSS_UNITS })
    const renderViewport = page.getViewport({ scale: CSS_UNITS * PRINT_IMAGE_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(renderViewport.width)
    canvas.height = Math.ceil(renderViewport.height)

    const renderTask = page.render({ canvas, viewport: renderViewport })
    await renderTask.promise

    const blob = await canvasToBlob(canvas)
    const url = URL.createObjectURL(blob)
    imageUrls.push(url)

    const pageFrame = doc.createElement('section')
    pageFrame.className = 'print-page'
    pageFrame.style.width = `${Math.ceil(cssViewport.width)}px`
    pageFrame.style.height = `${Math.ceil(cssViewport.height)}px`

    const image = doc.createElement('img')
    image.alt = `Page ${pageNumber}`
    image.src = url
    pageFrame.appendChild(image)
    pagesRoot.appendChild(pageFrame)
    await waitForImage(image)
  }

  if (status) status.textContent = '印刷の準備ができました。'
  if (button) {
    button.hidden = false
    button.onclick = () => target.print()
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(PRINT_WINDOW_ERROR))
    }, 'image/png')
  })
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  if (typeof image.decode === 'function') {
    return image.decode().catch(() => undefined)
  }
  return new Promise((resolve) => {
    image.onload = () => resolve()
    image.onerror = () => resolve()
  })
}
