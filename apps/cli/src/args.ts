// Minimal dependency-free argv parser for the securepdf CLI.

export interface ParsedArgs {
  /** Positional arguments (command + operands). */
  positionals: string[]
  /** Single-value / boolean options keyed by long name. */
  options: Record<string, string>
  /** Repeated `--input id=path` values, in order. */
  inputs: string[]
}

const BOOLEAN_FLAGS = new Set(['json', 'dry-run', 'no-network', 'help', 'version'])
const ALIASES: Record<string, string> = { o: 'output', i: 'input', h: 'help' }

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const options: Record<string, string> = {}
  const inputs: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (!token.startsWith('-')) {
      positionals.push(token)
      continue
    }

    const dashless = token.replace(/^-+/, '')
    const eq = dashless.indexOf('=')
    let key = eq >= 0 ? dashless.slice(0, eq) : dashless
    let value = eq >= 0 ? dashless.slice(eq + 1) : undefined
    key = ALIASES[key] ?? key

    if (BOOLEAN_FLAGS.has(key)) {
      options[key] = 'true'
      continue
    }
    if (value === undefined) {
      value = argv[++i]
    }
    if (value === undefined) continue

    if (key === 'input') inputs.push(value)
    else options[key] = value
  }

  return { positionals, options, inputs }
}
