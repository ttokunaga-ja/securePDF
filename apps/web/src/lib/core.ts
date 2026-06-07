// Lazy boundary for the PDF engine. `@securepdf/core` pulls in @cantoo/pdf-lib
// (~hundreds of KB), which is only needed once the user actually imports an image
// or exports a document — never just to view a PDF. Importing it through this
// memoised loader keeps it out of the initial bundle and fetches it at most once.

type CoreModule = typeof import('@securepdf/core')

let corePromise: Promise<CoreModule> | null = null

export function loadCore(): Promise<CoreModule> {
  return (corePromise ??= import('@securepdf/core'))
}
