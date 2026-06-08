import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadFile, printFile } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

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

  it('prints the generated PDF through a hidden iframe without opening a tab', async () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrls()
    const open = vi.spyOn(window, 'open')
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
    ) => {
      void handler
      return timeout ?? 0
    }) as typeof window.setTimeout)
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node: Node) => node)

    const printPromise = printFile(pdfBytes)
    const frame = appendChild.mock.calls[0]?.[0] as HTMLIFrameElement | undefined
    const focus = vi.fn()
    const print = vi.fn()
    const addEventListener = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true,
      value: { addEventListener, focus, print },
    })
    frame?.onload?.call(frame, new Event('load'))

    await printPromise

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(frame).toBeInstanceOf(HTMLIFrameElement)
    expect(frame?.src).toBe('blob:securepdf-test')
    expect(frame?.style.position).toBe('fixed')
    expect(frame?.style.width).toBe('0px')
    expect(frame?.style.height).toBe('0px')
    expect(addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function), {
      once: true,
    })
    expect(focus).toHaveBeenCalledOnce()
    expect(print).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('afterprint'))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:securepdf-test')
  })

  it('surfaces a clear error when the hidden print frame is unavailable', async () => {
    const { revokeObjectURL } = stubObjectUrls()
    const open = vi.spyOn(window, 'open')
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
    ) => {
      void handler
      return timeout ?? 0
    }) as typeof window.setTimeout)
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node: Node) => node)

    const printPromise = printFile(pdfBytes)
    const frame = appendChild.mock.calls[0]?.[0] as HTMLIFrameElement | undefined
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: null })
    frame?.onload?.call(frame, new Event('load'))

    await expect(printPromise).rejects.toThrow('ブラウザの印刷ダイアログを開けませんでした')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:securepdf-test')
    expect(open).not.toHaveBeenCalled()
  })
})
