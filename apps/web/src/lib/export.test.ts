import { afterEach, describe, expect, it, vi } from 'vitest'

import { printFile } from './export'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function stubObjectUrls() {
  const createObjectURL = vi.fn(() => 'blob:securepdf-test')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

describe('printFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('uses the historical hidden iframe print path', () => {
    const { createObjectURL } = stubObjectUrls()
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node: Node) => node)

    printFile(pdfBytes)

    const frame = appendChild.mock.calls[0]?.[0] as HTMLIFrameElement | undefined
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(frame).toBeInstanceOf(HTMLIFrameElement)
    expect(frame?.src).toBe('blob:securepdf-test')
    expect(frame?.style.position).toBe('fixed')
    expect(frame?.style.right).toBe('0px')
    expect(frame?.style.bottom).toBe('0px')
    expect(frame?.style.width).toBe('0px')
    expect(frame?.style.height).toBe('0px')
    expect(frame?.style.border).toBe('0px')
    expect(frame?.onload).toEqual(expect.any(Function))
  })
})
