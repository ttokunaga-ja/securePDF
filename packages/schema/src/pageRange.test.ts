import { describe, expect, it } from 'vitest'

import { PlanError } from './errors'
import { parsePageRange, tokenizePageRange } from './pageRange'

describe('parsePageRange', () => {
  it('single page', () => expect(parsePageRange('7', 10)).toEqual([7]))
  it('range', () => expect(parsePageRange('2-4', 10)).toEqual([2, 3, 4]))
  it('mixed tokens', () => expect(parsePageRange('1,3,5-9', 10)).toEqual([1, 3, 5, 6, 7, 8, 9]))
  it('N-end', () => expect(parsePageRange('4-end', 6)).toEqual([4, 5, 6]))
  it('last', () => expect(parsePageRange('last', 10)).toEqual([10]))
  it('even', () => expect(parsePageRange('even', 6)).toEqual([2, 4, 6]))
  it('odd', () => expect(parsePageRange('odd', 5)).toEqual([1, 3, 5]))
  it('whitespace tolerant', () => expect(parsePageRange(' 2 - 4 , 7 ', 10)).toEqual([2, 3, 4, 7]))
  it('dedupes and sorts', () => expect(parsePageRange('5,2,2,3', 10)).toEqual([2, 3, 5]))
  it('case-insensitive keywords', () => expect(parsePageRange('LAST', 3)).toEqual([3]))

  for (const bad of ['', '0', '11', '4-2', 'abc', '2-', '-3', '1-2-3', 'evenx']) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      expect(() => parsePageRange(bad, 10)).toThrow(PlanError)
    })
  }

  it('out-of-range error carries INVALID_PAGE_RANGE', () => {
    expect.assertions(1)
    try {
      parsePageRange('11', 10)
    } catch (error) {
      expect((error as PlanError).code).toBe('INVALID_PAGE_RANGE')
    }
  })
})

describe('tokenizePageRange', () => {
  it('accepts grammar without bound checking', () =>
    expect(() => tokenizePageRange('1-999999')).not.toThrow())
  it('rejects malformed tokens', () => expect(() => tokenizePageRange('1--2')).toThrow(PlanError))
})
