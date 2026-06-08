import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadFile, printCurrentPage } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
const originalPrint = Object.getOwnPropertyDescriptor(window, 'print')

function stubObjectUrls() {
  const createObjectURL = vi.fn((blob: Blob) => {
    void blob
    return 'blob:securepdf-test'
  })
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

describe('browser export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalPrint) {
      Object.defineProperty(window, 'print', originalPrint)
    } else {
      Reflect.deleteProperty(window, 'print')
    }
    document.body.replaceChildren()
  })

  it('downloads a PDF blob without opening a print tab', () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrls()
    const open = vi.spyOn(window, 'open')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    downloadFile('securepdf.pdf', pdfBytes)

    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('application/pdf')
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:securepdf-test')
    expect(open).not.toHaveBeenCalled()
  })

  it('uses the current page browser print API only', () => {
    const open = vi.spyOn(window, 'open')
    const print = vi.fn()
    Object.defineProperty(window, 'print', { configurable: true, value: print })

    printCurrentPage()

    expect(print).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
  })
})
