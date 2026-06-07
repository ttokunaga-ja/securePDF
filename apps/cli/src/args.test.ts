import { describe, expect, it } from 'vitest'

import { parseArgs } from './args'

describe('parseArgs', () => {
  it('collects positionals (command + operands)', () => {
    expect(parseArgs(['merge', 'a.pdf', 'b.pdf']).positionals).toEqual(['merge', 'a.pdf', 'b.pdf'])
  })

  it('resolves the -o / --output alias and = form', () => {
    expect(parseArgs(['merge', '-o', 'out.pdf']).options.output).toBe('out.pdf')
    expect(parseArgs(['merge', '--output=out.pdf']).options.output).toBe('out.pdf')
  })

  it('collects repeated --input id=path in order', () => {
    expect(parseArgs(['organize', '-i', 'a=a.pdf', '--input', 'b=b.pdf']).inputs).toEqual([
      'a=a.pdf',
      'b=b.pdf',
    ])
  })

  it('treats known flags as booleans', () => {
    const { options } = parseArgs(['validate', '--json', '--dry-run', '--no-network'])
    expect(options.json).toBe('true')
    expect(options['dry-run']).toBe('true')
    expect(options['no-network']).toBe('true')
  })

  it('reads value options', () => {
    expect(parseArgs(['organize', '--plan', 'p.json']).options.plan).toBe('p.json')
    expect(parseArgs(['x', '--endpoint', 'https://e']).options.endpoint).toBe('https://e')
  })
})
