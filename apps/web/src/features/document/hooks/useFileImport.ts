import { useCallback } from 'react'

import { normalizePdfFilename } from '../../../lib/filename'
import { importFile, type LoadedFile } from '../../../lib/importFile'
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
