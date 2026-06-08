import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPrintSession } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function stubObjectUrls() {
  const createObjectURL = vi.fn(() => 'about:blank#securepdf-test')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

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

describe('createPrintSession', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('opens a print window synchronously and can cancel it', () => {
    const target = createFakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(target)

    const session = createPrintSession()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(target.opener).toBeNull()
    expect(target.document.body.textContent).toContain('Preparing PDF for print')

    session.cancel()

    expect(target.close).toHaveBeenCalled()
  })

  it('prints through the reserved window when PDF bytes are ready', () => {
    const target = createFakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(target)
    const { createObjectURL } = stubObjectUrls()

    const session = createPrintSession()
    session.print(pdfBytes)

    const frame = target.document.querySelector('iframe')
    expect(createObjectURL).toHaveBeenCalled()
    expect(frame?.src).toBe('about:blank#securepdf-test')
    expect(frame?.style.width).toBe('100vw')
    expect(frame?.style.height).toBe('100vh')
  })

  it('falls back to an in-page print frame when popups are blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    stubObjectUrls()

    const session = createPrintSession()
    session.print(pdfBytes)

    const frame = document.body.querySelector('iframe')
    expect(frame?.src).toBe('about:blank#securepdf-test')
    expect(frame?.style.width).toBe('1px')
    expect(frame?.style.opacity).toBe('0')
  })
})
