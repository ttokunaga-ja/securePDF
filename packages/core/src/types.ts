import type { ValidationError } from '@securepdf/schema'

export interface FileInput {
  id: string
  bytes: Uint8Array
  filename?: string
  type?: string
}

export interface OutputFile {
  filename: string
  bytes: Uint8Array
  type: string
}

export interface RunResult {
  ok: boolean
  /** One entry for single-output ops; many for split (and extract → zip). */
  outputs: OutputFile[]
  warnings: string[]
  errors?: ValidationError[]
}
