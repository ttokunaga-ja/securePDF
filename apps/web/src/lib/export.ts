// Browser-side delivery of generated PDF bytes: save-to-disk and print. Kept out
// of the React tree so the workspace components stay free of DOM plumbing.

export interface PrintSession {
  print: (bytes: Uint8Array) => void
  cancel: () => void
}

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

/** Reserve a print surface immediately during the click event. Waiting until the
 *  generated PDF bytes are ready can lose browser user activation, causing the
 *  print dialog to be silently blocked. */
export function createPrintSession(): PrintSession {
  const target = openPrintWindow()
  if (!target) return { print: printFile, cancel: () => undefined }

  return {
    print: (bytes) => printFileInWindow(bytes, target, true),
    cancel: () => closeWindow(target),
  }
}

/** Print the given PDF bytes via an iframe, cleaning up afterwards. */
export function printFile(bytes: Uint8Array): void {
  printFileInWindow(bytes, window, false)
}

function openPrintWindow(): Window | null {
  const target = window.open('', '_blank')
  if (!target) return null

  try {
    target.opener = null
    target.document.title = 'securePDF'
    target.document.body.replaceChildren()
    target.document.body.style.margin = '0'
    target.document.body.style.fontFamily = 'system-ui, sans-serif'

    const message = target.document.createElement('p')
    message.textContent = 'Preparing PDF for print...'
    message.style.margin = '24px'
    target.document.body.appendChild(message)
    return target
  } catch {
    closeWindow(target)
    return null
  }
}

function printFileInWindow(bytes: Uint8Array, target: Window, closeAfterPrint: boolean): void {
  if (target.closed) {
    printFile(bytes)
    return
  }

  const url = URL.createObjectURL(createPdfBlob(bytes))
  const doc = target.document
  const frame = doc.createElement('iframe')
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    frame.remove()
    URL.revokeObjectURL(url)
    if (closeAfterPrint) closeWindow(target)
  }

  if (closeAfterPrint) doc.body.replaceChildren()
  frame.style.position = 'fixed'
  frame.style.inset = closeAfterPrint ? '0' : 'auto 0 0 auto'
  frame.style.width = closeAfterPrint ? '100vw' : '1px'
  frame.style.height = closeAfterPrint ? '100vh' : '1px'
  frame.style.border = '0'
  frame.style.opacity = closeAfterPrint ? '1' : '0'
  frame.style.pointerEvents = 'none'
  frame.onload = () => {
    const view = frame.contentWindow
    if (!view) {
      cleanup()
      return
    }
    const cleanupOnce = () => cleanup()
    view.addEventListener('afterprint', cleanupOnce, { once: true })
    target.addEventListener('afterprint', cleanupOnce, { once: true })
    if (tryPrint(view) || tryPrint(target)) {
      target.setTimeout(cleanup, 60_000)
      return
    }
    cleanup()
  }
  frame.src = url
  doc.body.appendChild(frame)
}

function tryPrint(target: Window): boolean {
  if (typeof target.print !== 'function') return false
  try {
    target.focus()
    target.print()
    return true
  } catch {
    return false
  }
}

function closeWindow(target: Window): void {
  if (target === window || target.closed) return
  target.close()
}
