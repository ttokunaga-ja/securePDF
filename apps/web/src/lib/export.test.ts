import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPrintSession } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

const pdfMock = vi.hoisted(() => ({
  getPage: vi.fn(),
  loadPdfDocument: vi.fn(),
  render: vi.fn(),
}))

vi.mock('./pdf', () => ({
  loadPdfDocument: pdfMock.loadPdfDocument,
}))

function createFakeWindow() {
  const fake = {
    document: document.implementation.createHTMLDocument(''),
    closed: false,
    close: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn(),
    setTimeout: vi.fn(),
    opener: window,
  }
  fake.close.mockImplementation(() => {
    fake.closed = true
  })
  return fake as unknown as Window & typeof fake
}

function stubCanvasBlob() {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((callback: BlobCallback) => {
      callback(new Blob(['png'], { type: 'image/png' }))
    }),
  })
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn(() => Promise.resolve()),
  })
}

function stubObjectUrls() {
  const createObjectURL = vi.fn(() => 'blob:securepdf-print-page')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

describe('createPrintSession', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    pdfMock.getPage.mockReset()
    pdfMock.loadPdfDocument.mockReset()
    pdfMock.render.mockReset()
    document.body.replaceChildren()
  })

  it('opens a same-origin print window synchronously and cancels it', () => {
    const target = createFakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(target)

    const session = createPrintSession()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(target.opener).toBeNull()
    expect(target.document.querySelector('[data-print-status]')?.textContent).toContain(
      '印刷用ページを準備しています',
    )

    session.cancel()

    expect(target.close).toHaveBeenCalled()
  })

  it('renders PDF pages into the reserved window before printing', async () => {
    const target = createFakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(target)
    const { createObjectURL } = stubObjectUrls()
    stubCanvasBlob()

    pdfMock.render.mockReturnValue({ promise: Promise.resolve() })
    pdfMock.getPage.mockResolvedValue({
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 100 * scale,
        height: 200 * scale,
      })),
      render: pdfMock.render,
    })
    pdfMock.loadPdfDocument.mockResolvedValue({
      numPages: 1,
      getPage: pdfMock.getPage,
    })

    const session = createPrintSession()
    await session.print(pdfBytes)

    const pageFrame = target.document.querySelector('.print-page') as HTMLElement | null
    expect(pdfMock.loadPdfDocument).toHaveBeenCalledWith(pdfBytes)
    expect(pdfMock.getPage).toHaveBeenCalledWith(1)
    expect(pdfMock.render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: expect.any(HTMLCanvasElement),
        viewport: expect.objectContaining({ width: 213.33333333333334 }),
      }),
    )
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(target.document.querySelector('iframe')).toBeNull()
    expect(pageFrame?.style.width).toBe('134px')
    expect(pageFrame?.querySelector('img')?.src).toBe('blob:securepdf-print-page')
    expect(target.addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function), {
      once: true,
    })
    expect(target.print).toHaveBeenCalled()
  })

  it('surfaces a clear error when the print window is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    const session = createPrintSession()

    await expect(session.print(pdfBytes)).rejects.toThrow('印刷用ウィンドウを開けませんでした')
  })
})
