// @securepdf/codecs — image decoders behind one interface.
//
// JPEG and PNG are NOT here: the core embeds them directly via @cantoo/pdf-lib.
// Everything else decodes to raw RGBA, which the core then re-encodes to PNG/JPEG
// before embedding. Each format's decoder is LAZILY imported so its WASM only
// loads when that format is actually used — required to stay within the Worker
// bundle-size and startup limits. Implemented in Milestone 5.
//
// Planned backings: @jsquash/webp, @jsquash/avif (WASM); utif2 (TIFF, pure JS);
// bmp-js, decode-ico, omggif (pure JS); libheif-js (HEIC, WASM).

export interface DecodedImage {
  width: number
  height: number
  /** Raw RGBA bytes, length === width * height * 4. */
  rgba: Uint8Array
}

export type DecodableMime =
  | 'image/webp'
  | 'image/avif'
  | 'image/tiff'
  | 'image/bmp'
  | 'image/x-icon'
  | 'image/gif'
  | 'image/heic'
  | 'image/heif'

export const DECODABLE_MIMES: readonly DecodableMime[] = [
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/bmp',
  'image/x-icon',
  'image/gif',
  'image/heic',
  'image/heif',
]

/**
 * Decode an encoded image to raw RGBA. Multi-frame inputs (TIFF/GIF) return the
 * first frame here; multi-page conversion is handled by the core. Implemented in
 * Milestone 5.
 */
export async function decode(_bytes: Uint8Array, _mime: DecodableMime): Promise<DecodedImage> {
  throw new Error('not implemented: decode (Milestone 5)')
}
