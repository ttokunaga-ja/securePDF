import { type ChangeEvent, useCallback, useRef } from 'react'

import { prepareAuthPopup } from '../../../lib/session'
import type { ImportFromList } from './useFileImport'

/** Drives the hidden `<input type=file>`: opens it remembering the insert
 *  position, then forwards the chosen files and clears the input so the same
 *  file can be picked again. */
export function useFilePicker(onFiles: ImportFromList) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingInsertAtRef = useRef<number | undefined>(undefined)

  const openPickerAt = useCallback((insertAt?: number) => {
    pendingInsertAtRef.current = insertAt
    prepareAuthPopup()
    inputRef.current?.click()
  }, [])

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const insertAt = pendingInsertAtRef.current
      pendingInsertAtRef.current = undefined
      onFiles(event.target.files, insertAt)
      event.target.value = ''
    },
    [onFiles],
  )

  return { inputRef, openPickerAt, onInputChange }
}
