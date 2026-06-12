/**
 * securePDF — Office→PDF conversion Web App (Google Apps Script).
 *
 * Converts docx/xlsx/pptx (and legacy doc/xls/ppt) to PDF using Google Drive's
 * conversion engine. The securePDF Cloudflare Worker calls this server-to-server
 * (no CORS). The shared secret is passed as `token` inside the JSON POST body
 * (not as a URL query parameter) to keep it out of server logs.
 * Files transit the dedicated conversion account's Google Drive briefly (a temp
 * file, deleted right after) — see docs/office-conversion.md for the privacy note.
 *
 * Request  (POST body, JSON): { mimeType, filename, fileBase64, token }
 * Response (JSON): { ok:true, filename, pdfBase64 } | { ok:false, code, message }
 */

var OFFICE_TO_GOOGLE = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'application/vnd.google-apps.document', // .docx
  'application/msword': 'application/vnd.google-apps.document', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'application/vnd.google-apps.spreadsheet', // .xlsx
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'application/vnd.google-apps.presentation', // .pptx
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation', // .ppt
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, code: 'INVALID_PLAN', message: 'Empty request body.' })
    }
    var req = JSON.parse(e.postData.contents)
    var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')
    var token = req.token || ''
    if (!constantTimeTokenEquals_(token, expected)) {
      return jsonOut({ ok: false, code: 'UNAUTHORIZED', message: 'Invalid or missing token.' })
    }
    var target = OFFICE_TO_GOOGLE[req.mimeType]
    if (!target) {
      return jsonOut({
        ok: false,
        code: 'UNSUPPORTED_FORMAT',
        message: 'Unsupported file type.',
      })
    }

    var blob = Utilities.newBlob(
      Utilities.base64Decode(req.fileBase64),
      req.mimeType,
      req.filename || 'input',
    )
    // Uploading the Office blob with a Google-native target mimeType triggers the
    // Drive conversion; we then export the result as PDF and delete the temp file.
    var created = Drive.Files.create({ name: 'securepdf-tmp', mimeType: target }, blob, {
      fields: 'id',
    })
    try {
      var pdf = DriveApp.getFileById(created.id).getAs('application/pdf')
      var name = String(req.filename || 'output').replace(/\.[^.]+$/, '') + '.pdf'
      return jsonOut({
        ok: true,
        filename: name,
        pdfBase64: Utilities.base64Encode(pdf.getBytes()),
      })
    } finally {
      try {
        Drive.Files.remove(created.id)
      } catch (cleanupErr) {
        // best-effort cleanup; ignore
      }
    }
  } catch (err) {
    console.error(err)
    return jsonOut({ ok: false, code: 'OFFICE_CONVERT_FAILED', message: 'Conversion failed.' })
  }
}

/** Health check (GET) — handy to confirm the deployment is live. */
function doGet() {
  return jsonOut({ ok: true, service: 'securepdf-office-convert' })
}

function constantTimeTokenEquals_(provided, expected) {
  if (!provided || !expected) return false
  var key = String(expected)
  var providedDigest = hmacHex_(String(provided), key)
  var expectedDigest = hmacHex_(key, key)
  return constantTimeStringEquals_(providedDigest, expectedDigest)
}

function hmacHex_(value, key) {
  var bytes = Utilities.computeHmacSha256Signature(value, key)
  var out = ''
  for (var i = 0; i < bytes.length; i += 1) {
    var b = bytes[i]
    if (b < 0) b += 256
    var part = b.toString(16)
    out += part.length === 1 ? '0' + part : part
  }
  return out
}

function constantTimeStringEquals_(a, b) {
  var max = Math.max(a.length, b.length)
  var diff = a.length ^ b.length
  for (var i = 0; i < max; i += 1) {
    var ca = i < a.length ? a.charCodeAt(i) : 0
    var cb = i < b.length ? b.charCodeAt(i) : 0
    diff |= ca ^ cb
  }
  return diff === 0
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
