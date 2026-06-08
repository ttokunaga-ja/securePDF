// Browser-side delivery of generated PDF bytes: save-to-disk and native print.
// Kept out of the React tree so workspace components stay free of DOM plumbing.

export interface PrintSession {
  print: (bytes: Uint8Array) => Promise<void>
  cancel: () => void
}

const PRINT_WINDOW_ERROR =
  '印刷用ウィンドウを開けませんでした。ポップアップを許可してからもう一度お試しください。'
const PRINT_URL_REVOKE_DELAY = 5 * 60_000

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
 * Reserve a browser tab immediately during the click event, then navigate it to
 * the generated PDF. Chrome's native PDF viewer owns the actual print UI.
 */
export function createPrintSession(): PrintSession {
  const target = window.open('', '_blank')
  if (!target) return blockedPrintSession()

  let cancelled = false
  let url: string | null = null

  try {
    target.opener = null
    target.document.title = 'securePDF'
    target.document.body.style.margin = '24px'
    target.document.body.style.fontFamily = 'system-ui, sans-serif'
    target.document.body.textContent = 'PDFを開いています...'
  } catch {
    target.close()
    return blockedPrintSession()
  }

  const cleanup = () => {
    if (!url) return
    URL.revokeObjectURL(url)
    url = null
  }

  return {
    print: async (bytes) => {
      if (cancelled) return
      if (target.closed) throw new Error(PRINT_WINDOW_ERROR)

      url = URL.createObjectURL(createPdfBlob(bytes))
      target.location.href = url
      target.focus()

      window.setTimeout(() => {
        try {
          target.focus()
          target.print()
        } catch {
          // Chrome may not expose programmatic print for its native PDF viewer.
          // In that case the opened PDF tab remains available for standard print.
        }
      }, 800)
      window.setTimeout(cleanup, PRINT_URL_REVOKE_DELAY)
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
