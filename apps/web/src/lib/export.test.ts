import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPrintSession } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function createFakeWindow() {
  const fake = {
    document: document.implementation.createHTMLDocument(''),
    location: { href: 'about:blank' },
    closed: false,
    close: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
    opener: window,
  }
  fake.close.mockImplementation(() => {
    fake.closed = true
  })
  return fake as unknown as Window & typeof fake
}

function stubObjectUrls() {
  const createObjectURL = vi.fn((blob: Blob) => {
    void blob
    return 'blob:securepdf-native-pdf'
  })
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

describe('createPrintSession', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('opens a browser tab synchronously and can cancel it', () => {
    const target = createFakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(target)

    const session = createPrintSession()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(target.opener).toBeNull()
    expect(target.document.body.textContent).toContain('PDFを開いています')

    session.cancel()

    expect(target.close).toHaveBeenCalled()
  })

  it('hands the generated PDF to the native PDF viewer without custom rendering', async () => {
    const target = createFakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(target)
    const { createObjectURL, revokeObjectURL } = stubObjectUrls()
    const timers: Array<() => void> = []
    vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') timers.push(handler as () => void)
      return 0
    }) as unknown as typeof window.setTimeout)

    const session = createPrintSession()
    await session.print(pdfBytes)

    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('application/pdf')
    expect(target.location.href).toBe('blob:securepdf-native-pdf')
    expect(target.document.querySelector('iframe')).toBeNull()
    expect(target.document.querySelector('[data-print-pages]')).toBeNull()

    timers[0]?.()
    expect(target.print).toHaveBeenCalled()

    timers[1]?.()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:securepdf-native-pdf')
  })

  it('surfaces a clear error when the print window is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    const session = createPrintSession()

    await expect(session.print(pdfBytes)).rejects.toThrow('印刷用ウィンドウを開けませんでした')
  })
})
