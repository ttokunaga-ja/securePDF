import { isOfficeInput } from '@securepdf/schema'
import { useCallback } from 'react'

import { normalizePdfFilename } from '../../../lib/filename'
import { importFile, type LoadedFile } from '../../../lib/importFile'
import { ensureApiKey } from '../../../lib/session'
import { useDocActions, useDocState } from '../DocumentContext'
import type { AsyncTask } from './useAsyncTask'

export type ImportFromList = (list: FileList | File[] | null, insertAt?: number) => void

/** Read dropped/selected files into the document. Seeds the output filename from
 *  the first file of the first import. Shares `task` with export so the busy
 *  state is unified. */
export function useFileImport(
  task: AsyncTask,
  setOutputFilename: (name: string) => void,
): ImportFromList {
  const { files } = useDocState()
  const { importFiles } = useDocActions()
  const filesEmpty = files.length === 0

  return useCallback(
    (list, insertAt) => {
      const items = list ? Array.from(list) : []
      if (items.length === 0) return
      void task.run(async () => {
        // Office formats require backend conversion → ensure a signed-in API key
        // first. ensureApiKey() opens the Google sign-in popup when needed; it is
        // a no-op (returns null) when auth is not configured.
        if (items.some((file) => isOfficeInput(file.name, file.type))) {
          await ensureApiKey()
        }
        const imported: LoadedFile[] = []
        for (const file of items) imported.push(await importFile(file))
        if (filesEmpty && imported[0]) {
          setOutputFilename(normalizePdfFilename(imported[0].filename))
        }
        importFiles(imported, insertAt)
      })
    },
    [task, filesEmpty, importFiles, setOutputFilename],
  )
}
