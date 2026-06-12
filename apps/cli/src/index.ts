// securepdf CLI — local-only PDF organization for humans and agents.
//
// Runs operations locally via @securepdf/core (no network), or against a
// configured securePDF endpoint with --endpoint. Every command supports --json.

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { type FileInput, run } from '@securepdf/core'
import {
  type Degrees,
  type FlipAxis,
  isOfficeInput,
  officeMimeFor,
  type Operation,
  OPERATION_NAMES,
  type OperationPlan,
  SCHEMA_VERSION,
  validatePlan,
  type ValidationError,
} from '@securepdf/schema'

import { parseArgs, type ParsedArgs } from './args'

export interface CliResult {
  code: number
}

interface InputRef {
  id: string
  path: string
  type?: string
}

export async function main(argv: string[]): Promise<CliResult> {
  const args = parseArgs(argv)
  const command = args.positionals[0]
  const json = args.options.json === 'true'

  if (args.options.version === 'true') {
    process.stdout.write(`securepdf ${SCHEMA_VERSION}\n`)
    return { code: 0 }
  }
  if (!command || command === 'help' || args.options.help === 'true') {
    process.stdout.write(HELP)
    return { code: command && command !== 'help' ? 1 : 0 }
  }

  try {
    switch (command) {
      case 'capabilities':
        return await capabilitiesCommand(args, json)
      case 'merge':
        return await mergeCommand(args, json)
      case 'convert':
        return await convertCommand(args, json)
      case 'rotate':
        return await rotateCommand(args, json)
      case 'delete':
      case 'remove':
        return await deleteCommand(args, json)
      case 'extract':
        return await extractCommand(args, json)
      case 'flip':
        return await flipCommand(args, json)
      case 'reorder':
        return await reorderCommand(args, json)
      case 'insert-pdf':
      case 'insertPdf':
        return await insertPdfCommand(args, json)
      case 'insert-image':
      case 'insertImage':
        return await insertImageCommand(args, json)
      case 'split':
        return await splitCommand(args, json)
      case 'organize':
        return await organizeCommand(args, json)
      case 'validate':
        return await validateCommand(args, json)
      default:
        return reportError(json, 'INVALID_PLAN', `Unknown command: ${command}`)
    }
  } catch (error) {
    return reportError(json, codeOf(error), messageOf(error))
  }
}

// --- commands ---------------------------------------------------------------

async function capabilitiesCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  if (useEndpoint(args)) {
    const res = await fetch(`${endpointBase(args)}/api/v1/capabilities`, {
      headers: authHeaders(args),
    })
    const body = await res.json()
    return report(json, body, res.ok ? 0 : 1, () => JSON.stringify(body, null, 2))
  }
  const caps = {
    version: SCHEMA_VERSION,
    mode: 'local',
    operations: OPERATION_NAMES,
    inputFormats: ['application/pdf', 'image/jpeg', 'image/png'],
  }
  return report(json, caps, 0, () =>
    [`securepdf ${caps.version} (local)`, `operations: ${caps.operations.join(', ')}`].join('\n'),
  )
}

async function mergeCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const files = args.positionals.slice(1)
  if (files.length === 0) throw new CliError('INVALID_PLAN', 'merge needs at least one input PDF')
  const refs = files.map((path, i): InputRef => ({ id: `p${i}`, path }))
  const plan: OperationPlan = {
    version: SCHEMA_VERSION,
    inputs: refs.map((r) => ({ id: r.id, filename: basename(r.path), type: 'application/pdf' })),
    operations: [{ op: 'merge', inputs: refs.map((r) => r.id) }],
    output: { format: 'pdf', filename: basename(outputPath(args)) },
  }
  return runPlan(plan, refs, args, json)
}

async function convertCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const inputs = args.positionals.slice(1)
  if (inputs.length === 0) throw new CliError('INVALID_PLAN', 'convert needs at least one input')
  if (args.options.to && args.options.to !== 'pdf') {
    throw new CliError('UNSUPPORTED_FORMAT', `unsupported target: ${args.options.to}`)
  }
  if (inputs.some((path) => isOfficeInput(path))) return convertOfficeCommand(args, json, inputs)

  const refs = inputs.map((path, i): InputRef => ({ id: `img${i}`, path, type: imageType(path) }))
  const plan: OperationPlan = {
    version: SCHEMA_VERSION,
    inputs: refs.map((r) => ({ id: r.id, filename: basename(r.path), type: r.type })),
    operations: [{ op: 'convertToPdf', inputs: refs.map((r) => r.id) }],
    output: { format: 'pdf', filename: basename(outputPath(args)) },
  }
  return runPlan(plan, refs, args, json)
}

async function convertOfficeCommand(
  args: ParsedArgs,
  json: boolean,
  inputs: string[],
): Promise<CliResult> {
  if (inputs.length !== 1) {
    throw new CliError('INVALID_PLAN', 'Office conversion supports one file per command')
  }
  if (!useEndpoint(args)) {
    throw new CliError('BACKEND_NOT_CONFIGURED', 'Office conversion needs --endpoint <url>')
  }

  const path = inputs[0]
  if (!path) throw new CliError('INVALID_PLAN', 'convert needs an input')
  if (args.options['dry-run'] === 'true') {
    return report(json, { ok: true }, 0, () => 'Office conversion request is valid (dry run).')
  }

  const fileBase64 = Buffer.from(readFileSync(path)).toString('base64')
  const res = await fetch(`${endpointBase(args)}/api/v1/convert/office`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(args) },
    body: JSON.stringify({
      filename: basename(path),
      mimeType: officeMimeFor(path),
      fileBase64,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    pdfBase64?: string
    message?: string
    code?: string
    error?: { code?: string; message?: string }
  }
  if (!res.ok || !body.ok) {
    throw new CliError(
      body.error?.code ?? body.code ?? `HTTP_${res.status}`,
      body.error?.message ?? body.message ?? `Office conversion failed (${res.status})`,
    )
  }
  if (!body.pdfBase64) {
    throw new CliError('OFFICE_CONVERT_FAILED', 'Office conversion returned no PDF bytes')
  }

  const out = outputPath(args)
  writeFileSync(out, Buffer.from(body.pdfBase64, 'base64'))
  return report(json, { ok: true, outputs: [out] }, 0, () => `Wrote ${out}`)
}

async function rotateCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const pages = requiredOption(args, 'pages', 'rotate needs --pages <expr>')
  const degrees = parseDegrees(
    requiredOption(args, 'degrees', 'rotate needs --degrees <90|180|270>'),
  )
  return runSinglePdfCommand(args, json, 'rotate', { op: 'rotate', pages, degrees })
}

async function deleteCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const pages = requiredOption(args, 'pages', 'delete needs --pages <expr>')
  return runSinglePdfCommand(args, json, 'delete', { op: 'delete', pages })
}

async function extractCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const pages = requiredOption(args, 'pages', 'extract needs --pages <expr>')
  return runSinglePdfCommand(args, json, 'extract', { op: 'extract', pages })
}

async function flipCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const pages = requiredOption(args, 'pages', 'flip needs --pages <expr>')
  const axis = parseAxis(args.options.axis ?? 'horizontal')
  return runSinglePdfCommand(args, json, 'flip', { op: 'flip', pages, axis })
}

async function reorderCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const order = parseOrder(requiredOption(args, 'order', 'reorder needs --order <pages>'))
  return runSinglePdfCommand(args, json, 'reorder', { op: 'reorder', order })
}

async function insertPdfCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const [base, inserted] = args.positionals.slice(1)
  if (!base || !inserted) {
    throw new CliError('INVALID_PLAN', 'insert-pdf needs <base.pdf> <insert.pdf>')
  }
  const at = parseNonNegativeInt(
    requiredOption(args, 'at', 'insert-pdf needs --at <index>'),
    '--at',
  )
  const refs: InputRef[] = [
    { id: 'doc', path: base, type: 'application/pdf' },
    { id: 'insert', path: inserted, type: 'application/pdf' },
  ]
  const op: Operation = { op: 'insertPdf', input: 'insert', at }
  if (args.options.pages) op.pages = args.options.pages
  return runPlan(singleOutputPlan(refs, [op], outputPath(args)), refs, args, json)
}

async function insertImageCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const [base, image] = args.positionals.slice(1)
  if (!base || !image) {
    throw new CliError('INVALID_PLAN', 'insert-image needs <base.pdf> <image>')
  }
  const at = parseNonNegativeInt(
    requiredOption(args, 'at', 'insert-image needs --at <index>'),
    '--at',
  )
  const refs: InputRef[] = [
    { id: 'doc', path: base, type: 'application/pdf' },
    { id: 'image', path: image, type: imageType(image) },
  ]
  return runPlan(
    singleOutputPlan(refs, [{ op: 'insertImage', input: 'image', at }], outputPath(args)),
    refs,
    args,
    json,
  )
}

async function splitCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  const op = splitOperation(args)
  return runSinglePdfCommand(args, json, 'split', op)
}

async function organizeCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  if (!args.options.plan) throw new CliError('INVALID_PLAN', 'organize needs --plan <file.json>')
  const plan = JSON.parse(readFileSync(args.options.plan, 'utf8')) as OperationPlan
  const refs = args.inputs.map((pair): InputRef => {
    const eq = pair.indexOf('=')
    if (eq < 0) throw new CliError('INVALID_PLAN', `--input expects id=path, got "${pair}"`)
    return { id: pair.slice(0, eq), path: pair.slice(eq + 1) }
  })
  return runPlan(plan, refs, args, json)
}

async function validateCommand(args: ParsedArgs, json: boolean): Promise<CliResult> {
  if (!args.options.plan) throw new CliError('INVALID_PLAN', 'validate needs --plan <file.json>')
  const plan = JSON.parse(readFileSync(args.options.plan, 'utf8'))
  if (useEndpoint(args)) {
    const res = await fetch(`${endpointBase(args)}/api/v1/validate-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(args) },
      body: JSON.stringify(plan),
    })
    const body = await res.json()
    return report(json, body, res.ok ? 0 : 1, () => JSON.stringify(body, null, 2))
  }
  const result = validatePlan(plan)
  return report(json, result, result.ok ? 0 : 1, () =>
    result.ok ? 'Plan is valid.' : formatErrors(result.errors),
  )
}

// --- execution --------------------------------------------------------------

async function runPlan(
  plan: OperationPlan,
  refs: InputRef[],
  args: ParsedArgs,
  json: boolean,
): Promise<CliResult> {
  if (args.options['dry-run'] === 'true') {
    const result = validatePlan(plan)
    return report(json, result, result.ok ? 0 : 1, () =>
      result.ok ? 'Plan is valid (dry run).' : formatErrors(result.errors),
    )
  }

  const files: FileInput[] = refs.map((ref) => ({
    id: ref.id,
    bytes: new Uint8Array(readFileSync(ref.path)),
    filename: basename(ref.path),
    type: ref.type,
  }))

  if (useEndpoint(args)) {
    return runRemote(plan, files, args, json)
  }

  const result = await run(plan, files)
  if (!result.ok) {
    return report(json, { ok: false, errors: result.errors }, 1, () => formatErrors(result.errors))
  }
  const written = writeOutputs(result.outputs, outputPath(args))
  return report(json, { ok: true, outputs: written }, 0, () => `Wrote ${written.join(', ')}`)
}

async function runRemote(
  plan: OperationPlan,
  files: FileInput[],
  args: ParsedArgs,
  json: boolean,
): Promise<CliResult> {
  const form = new FormData()
  form.set('plan', new Blob([JSON.stringify(plan)], { type: 'application/json' }), 'plan.json')
  for (const file of files) {
    form.set(file.id, new Blob([asArrayBuffer(file.bytes)]), file.filename ?? file.id)
  }
  const res = await fetch(`${endpointBase(args)}/api/v1/organize`, {
    method: 'POST',
    headers: authHeaders(args),
    body: form,
  })
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await res.json()
    return report(json, body, res.ok ? 0 : 1, () => JSON.stringify(body, null, 2))
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const out = outputPath(args)
  writeFileSync(out, bytes)
  return report(json, { ok: true, outputs: [out] }, 0, () => `Wrote ${out}`)
}

function writeOutputs(outputs: { filename: string; bytes: Uint8Array }[], out: string): string[] {
  const [first] = outputs
  if (outputs.length === 1 && first) {
    writeFileSync(out, first.bytes)
    return [out]
  }
  // Multi-output (split): write each next to the requested path's directory.
  const dir = dirname(out)
  return outputs.map((file) => {
    const target = join(dir, file.filename)
    writeFileSync(target, file.bytes)
    return target
  })
}

// --- helpers ----------------------------------------------------------------

class CliError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function useEndpoint(args: ParsedArgs): boolean {
  return Boolean(args.options.endpoint) && args.options['no-network'] !== 'true'
}

function authHeaders(args: ParsedArgs): Record<string, string> {
  return args.options['api-key'] ? { 'x-api-key': args.options['api-key'] } : {}
}

function outputPath(args: ParsedArgs): string {
  return args.options.output ?? 'output.pdf'
}

/** The endpoint base URL with trailing slashes trimmed. Only reached after
 *  `useEndpoint(args)` has confirmed an endpoint was supplied. */
function endpointBase(args: ParsedArgs): string {
  const url = args.options.endpoint
  if (!url) throw new CliError('INVALID_PLAN', '--endpoint requires a URL')
  return url.replace(/\/+$/, '')
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function singleOutputPlan(refs: InputRef[], operations: Operation[], out: string): OperationPlan {
  return {
    version: SCHEMA_VERSION,
    inputs: refs.map((r) => ({ id: r.id, filename: basename(r.path), type: r.type })),
    operations,
    output: { format: 'pdf', filename: basename(out) },
  }
}

function runSinglePdfCommand(
  args: ParsedArgs,
  json: boolean,
  command: string,
  operation: Operation,
): Promise<CliResult> {
  const input = args.positionals[1]
  if (!input) throw new CliError('INVALID_PLAN', `${command} needs <input.pdf>`)
  const refs: InputRef[] = [{ id: 'doc', path: input, type: 'application/pdf' }]
  return runPlan(singleOutputPlan(refs, [operation], outputPath(args)), refs, args, json)
}

function requiredOption(args: ParsedArgs, key: string, message: string): string {
  const value = args.options[key]
  if (!value) throw new CliError('INVALID_PLAN', message)
  return value
}

function parseDegrees(value: string): Degrees {
  const degrees = Number(value)
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
    throw new CliError('INVALID_PLAN', '--degrees must be 90, 180, or 270')
  }
  return degrees
}

function parseAxis(value: string): FlipAxis {
  if (value === 'horizontal' || value === 'vertical') return value
  throw new CliError('INVALID_PLAN', '--axis must be horizontal or vertical')
}

function parseOrder(value: string): number[] {
  const order = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parsePositiveInt(part, '--order'))
  if (order.length === 0) throw new CliError('INVALID_PLAN', '--order must list pages')
  return order
}

function splitOperation(args: ParsedArgs): Operation {
  const modes = [args.options.every, args.options['at-pages'], args.options.ranges].filter(Boolean)
  if (modes.length !== 1) {
    throw new CliError(
      'INVALID_PLAN',
      'split needs exactly one of --every, --at-pages, or --ranges',
    )
  }
  if (args.options.every) {
    return { op: 'split', everyNPages: parsePositiveInt(args.options.every, '--every') }
  }
  if (args.options['at-pages']) return { op: 'split', atPages: args.options['at-pages'] }
  const ranges = (args.options.ranges ?? '')
    .split(';')
    .map((range) => range.trim())
    .filter(Boolean)
  if (ranges.length === 0) throw new CliError('INVALID_PLAN', '--ranges must list page ranges')
  return { op: 'split', ranges }
}

function parsePositiveInt(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1)
    throw new CliError('INVALID_PLAN', `${name} must be a positive integer`)
  return n
}

function parseNonNegativeInt(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) {
    throw new CliError('INVALID_PLAN', `${name} must be a non-negative integer`)
  }
  return n
}

function imageType(path: string): string | undefined {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return undefined
}

function formatErrors(errors: ValidationError[] | undefined): string {
  if (!errors || errors.length === 0) return 'Unknown error'
  return errors.map((e) => `${e.code}: ${e.message}`).join('\n')
}

function report(json: boolean, data: unknown, code: number, human: () => string): CliResult {
  process.stdout.write(json ? `${JSON.stringify(data)}\n` : `${human()}\n`)
  return { code }
}

function reportError(json: boolean, code: string, message: string): CliResult {
  const data = { ok: false, error: { code, message } }
  process.stderr.write(json ? `${JSON.stringify(data)}\n` : `${code}: ${message}\n`)
  return { code: 1 }
}

function codeOf(error: unknown): string {
  if (error instanceof CliError) return error.code
  return 'INTERNAL'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const HELP = `securepdf — PDF organization and To-PDF conversion

Usage:
  securepdf capabilities [--endpoint URL] [--json]
  securepdf merge <a.pdf> <b.pdf>... [-o out.pdf] [--endpoint URL]
  securepdf convert <image>... [--to pdf] [-o out.pdf] [--endpoint URL]
  securepdf rotate <input.pdf> --pages <expr> --degrees <90|180|270> [-o out.pdf]
  securepdf delete <input.pdf> --pages <expr> [-o out.pdf]
  securepdf extract <input.pdf> --pages <expr> [-o out.pdf]
  securepdf flip <input.pdf> --pages <expr> [--axis horizontal|vertical] [-o out.pdf]
  securepdf reorder <input.pdf> --order <pages> [-o out.pdf]
  securepdf insert-pdf <base.pdf> <insert.pdf> --at <index> [--pages <expr>] [-o out.pdf]
  securepdf insert-image <base.pdf> <image> --at <index> [-o out.pdf]
  securepdf split <input.pdf> (--every <n> | --at-pages <expr> | --ranges <expr;expr>) [-o out.pdf]
  securepdf organize --input a=a.pdf [--input b=b.pdf] --plan plan.json [-o out.pdf]
  securepdf validate --plan plan.json [--endpoint URL]

Options:
  -o, --output <path>   Output file (default: output.pdf)
  -i, --input id=path   Named input (repeatable; for organize)
      --plan <path>     Operation plan JSON
      --endpoint <url>  Run against a securePDF endpoint instead of locally
      --api-key <key>   API key for --endpoint (sent as X-API-Key)
      --no-network      Force local execution
      --dry-run         Validate the plan without running it
      --json            Machine-readable JSON output
      --version         Print the schema version

Page expressions:
  1,3-5,last,even,odd,1-end.  --order uses a comma-separated full permutation.
  --at is the 0-based insertion slot before the current page at that index.
`
