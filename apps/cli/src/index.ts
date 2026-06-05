// securepdf CLI entry. Parses argv, builds an operation plan, and runs it either
// locally (@securepdf/core) or against a configured endpoint. Implemented in
// Milestone 3. See docs/IMPLEMENTATION_PLAN.md §6.

export interface CliResult {
  code: number
}

export async function main(_argv: string[]): Promise<CliResult> {
  throw new Error('not implemented: CLI (Milestone 3)')
}
