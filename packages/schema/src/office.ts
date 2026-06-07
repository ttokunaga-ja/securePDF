// Office input formats that convert to PDF via the remote backend (a Google Apps
// Script Web App today; LibreOffice/Gotenberg on Cloud Run later). The browser
// detects these on import and posts them to the Worker's /api/v1/convert/office
// endpoint; the Worker advertises `office-to-pdf` in capabilities when a backend
// is configured. Conversion itself is never done in the browser or the Worker.

/** Office MIME types accepted for Office to PDF conversion. */
export const OFFICE_INPUT_FORMATS = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt
] as const

/** Matching file extensions (browsers often omit or mis-set the Office MIME). */
export const OFFICE_EXTENSIONS = ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'] as const

const EXT_TO_MIME: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
}

/** True when a filename/MIME looks like a supported Office document. */
export function isOfficeInput(filename: string, mimeType?: string): boolean {
  const lower = filename.toLowerCase()
  if (OFFICE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true
  return mimeType ? (OFFICE_INPUT_FORMATS as readonly string[]).includes(mimeType) : false
}

/** Best-effort MIME for an Office file, preferring the (reliable) extension. */
export function officeMimeFor(filename: string, mimeType?: string): string {
  const lower = filename.toLowerCase()
  const ext = OFFICE_EXTENSIONS.find((candidate) => lower.endsWith(candidate))
  if (ext) return EXT_TO_MIME[ext] ?? mimeType ?? ''
  return mimeType ?? ''
}
