// Executable entry: runs the CLI and maps the result to an exit code. Kept
// separate from index.ts so main() can be imported in tests without side effects.

import { main } from './index'

main(process.argv.slice(2))
  .then((result) => process.exit(result.code))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  })
