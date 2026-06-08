import { useCallback } from 'react'

import { t } from '../../../app/i18n'
import { buildPlan } from '../../../lib/buildPlan'
import { loadCore } from '../../../lib/core'
import { downloadFile, printFile } from '../../../lib/export'
import { normalizePdfFilename } from '../../../lib/filename'
import { useDocState } from '../DocumentContext'
import type { AsyncTask } from './useAsyncTask'

/** Build the operation plan from the arranged pages and run it through the core
 *  engine to produce output PDF bytes, then download or print them. The engine is
 *  loaded lazily here, so viewing a document never pulls in @cantoo/pdf-lib. */
export function usePdfExport(
  task: AsyncTask,
  outputFilename: string,
  setOutputFilename: (name: string) => void,
) {
  const { files, pages } = useDocState()

  const createOutputPdf = useCallback(async () => {
    const { run } = await loadCore()
    const plan = buildPlan(
      pages.map((page) => ({
        fileId: page.fileId,
        pageIndex: page.pageIndex,
        rotation: page.rotation,
        flipped: page.flipped,
      })),
      files.map((file) => ({ id: file.id, filename: file.filename, pageCount: file.pageCount })),
    )
    const result = await run(
      plan,
      files.map((file) => ({
        id: file.id,
        bytes: file.bytes,
        filename: file.filename,
        type: 'application/pdf',
      })),
    )
    if (!result.ok) {
      throw new Error(result.errors?.[0]?.message ?? t('export.failed'))
    }
    const [output] = result.outputs
    if (!output) throw new Error(t('export.failed'))
    return output
  }, [files, pages])

  const exportPdf = useCallback(() => {
    if (pages.length === 0) return
    void task.run(async () => {
      const output = await createOutputPdf()
      const filename = normalizePdfFilename(outputFilename || output.filename)
      setOutputFilename(filename)
      downloadFile(filename, output.bytes)
    })
  }, [pages.length, task, createOutputPdf, outputFilename, setOutputFilename])

  const printPdf = useCallback(() => {
    if (pages.length === 0) return
    void task.run(async () => {
      const output = await createOutputPdf()
      await printFile(output.bytes)
    })
  }, [pages.length, task, createOutputPdf])

  return { exportPdf, printPdf }
}
