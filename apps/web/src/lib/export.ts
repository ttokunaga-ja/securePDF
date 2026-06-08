// Browser-side delivery of generated PDF bytes: save-to-disk and print. Kept out
// of the React tree so the workspace components stay free of DOM plumbing.

const PRINT_LOAD_ERROR = 'ブラウザの印刷ダイアログを開けませんでした。もう一度お試しください。'
const PRINT_LOAD_TIMEOUT = 15_000
const PRINT_CLEANUP_DELAY = 60_000

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

/** Print the generated PDF in-place through a hidden iframe without opening a tab. */
export function printFile(bytes: Uint8Array): Promise<void> {
  const url = URL.createObjectURL(createPdfBlob(bytes))
  const frame = document.createElement('iframe')
  let cleaned = false
  let settled = false
  let cleanupTimer: number | null = null
  let loadTimer: number | null = null

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer)
    if (loadTimer !== null) window.clearTimeout(loadTimer)
    frame.remove()
    URL.revokeObjectURL(url)
  }

  const settle = (callback: () => void) => {
    if (settled) return
    settled = true
    callback()
  }

  frame.title = 'securePDF print'
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'

  return new Promise((resolve, reject) => {
    const rejectWithCleanup = () => {
      cleanup()
      reject(new Error(PRINT_LOAD_ERROR))
    }
    frame.onload = () => {
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer)
        loadTimer = null
      }
      const view = frame.contentWindow
      if (!view) {
        settle(rejectWithCleanup)
        return
      }

      try {
        window.addEventListener('afterprint', cleanup, { once: true })
        view.addEventListener('afterprint', cleanup, { once: true })
        cleanupTimer = window.setTimeout(cleanup, PRINT_CLEANUP_DELAY)
        view.focus()
        view.print()
        settle(resolve)
      } catch {
        settle(rejectWithCleanup)
      }
    }
    frame.onerror = () => settle(rejectWithCleanup)
    loadTimer = window.setTimeout(() => settle(rejectWithCleanup), PRINT_LOAD_TIMEOUT)
    frame.src = url
    document.body.appendChild(frame)
  })
}
