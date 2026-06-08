import { isOfficeInput } from '@securepdf/schema'

import { hasValidApiKey } from '../../lib/session'

export function hasOfficeInput(files: readonly File[]): boolean {
  return files.some((file) => isOfficeInput(file.name, file.type))
}

export function shouldRequestOfficeAuth(files: readonly File[]): boolean {
  return hasOfficeInput(files) && !hasValidApiKey()
}
