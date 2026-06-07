// Browser-side delivery of generated PDF bytes: save-to-disk and print. Kept out
// of the React tree so the workspace components stay free of DOM plumbing.

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

/** Print the given PDF bytes via a hidden iframe, cleaning up afterwards. */
export function printFile(bytes: Uint8Array): void {
  const url = URL.createObjectURL(createPdfBlob(bytes))
  const frame = document.createElement('iframe')
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }

  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.onload = () => {
    const view = frame.contentWindow
    if (!view) {
      cleanup()
      return
    }
    view.focus()
    view.print()
    window.setTimeout(cleanup, 60_000)
  }
  frame.src = url
  document.body.appendChild(frame)
}
