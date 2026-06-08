const BASE64_CHUNK_CHARS = 32_768

export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '')
  if (normalized === '') return new Uint8Array()

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const outputLength = Math.floor((normalized.length * 3) / 4) - padding
  const bytes = new Uint8Array(outputLength)
  let offset = 0

  for (let start = 0; start < normalized.length; start += BASE64_CHUNK_CHARS) {
    const chunk = normalized.slice(start, start + BASE64_CHUNK_CHARS)
    const decoded = atob(chunk)
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[offset++] = decoded.charCodeAt(i)
    }
  }

  return bytes
}
