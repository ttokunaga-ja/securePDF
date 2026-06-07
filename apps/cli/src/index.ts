// securepdf CLI — local-first PDF organization for humans and agents.
//
// Runs operations locally via @securepdf/core (no network), or against a
// configured securePDF endpoint with --endpoint. Every command supports --json.

import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

import { type FileInput, run } from '@securepdf/core'
import {
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
  const images = args.positionals.slice(1)
  if (images.length === 0) throw new CliError('INVALID_PLAN', 'convert needs at least one image')
  if (args.options.to && args.options.to !== 'pdf') {
    throw new CliError('UNSUPPORTED_FORMAT', `unsupported target: ${args.options.to}`)
  }
  const refs = images.map((path, i): InputRef => ({ id: `img${i}`, path }))
  const plan: OperationPlan = {
    version: SCHEMA_VERSION,
    inputs: refs.map((r) => ({ id: r.id, filename: basename(r.path) })),
    operations: [{ op: 'convertToPdf', inputs: refs.map((r) => r.id) }],
    output: { format: 'pdf', filename: basename(outputPath(args)) },
  }
  return runPlan(plan, refs, args, json)
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
  return outputs.map((file) => {
    writeFileSync(file.filename, file.bytes)
    return file.filename
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
  return args.options['api-key'] ? { authorization: `Bearer ${args.options['api-key']}` } : {}
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
  securepdf convert <image>... [--to pdf] [-o out.pdf]
  securepdf organize --input a=a.pdf [--input b=b.pdf] --plan plan.json [-o out.pdf]
  securepdf validate --plan plan.json [--endpoint URL]

Options:
  -o, --output <path>   Output file (default: output.pdf)
  -i, --input id=path   Named input (repeatable; for organize)
      --plan <path>     Operation plan JSON
      --endpoint <url>  Run against a securePDF endpoint instead of locally
      --api-key <key>   Bearer token for --endpoint
      --no-network      Force local execution
      --dry-run         Validate the plan without running it
      --json            Machine-readable JSON output
      --version         Print the schema version
`
