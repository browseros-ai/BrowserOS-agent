import { describe, expect, it } from 'bun:test'
import {
  truncateHead,
  truncateTail,
} from '../../../src/tools/filesystem/truncate'

describe('truncateHead', () => {
  it('returns content unchanged when under limits', () => {
    const result = truncateHead('line1\nline2\nline3')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('line1\nline2\nline3')
    expect(result.totalLines).toBe(3)
    expect(result.outputLines).toBe(3)
  })

  it('truncates by line count', () => {
    const result = truncateHead('a\nb\nc\nd\ne', {
      maxLines: 3,
      maxBytes: 100_000,
    })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('a\nb\nc')
    expect(result.outputLines).toBe(3)
    expect(result.totalLines).toBe(5)
  })

  it('truncates by byte size', () => {
    const result = truncateHead('aaaa\nbbbb\ncccc', {
      maxLines: 100,
      maxBytes: 10,
    })
    expect(result.truncated).toBe(true)
    expect(result.outputLines).toBeLessThan(3)
  })

  it('handles empty string', () => {
    const result = truncateHead('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(1)
  })

  it('handles single line', () => {
    const result = truncateHead('hello')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('hello')
  })
})

describe('truncateTail', () => {
  it('returns content unchanged when under limits', () => {
    const result = truncateTail('line1\nline2\nline3')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('line1\nline2\nline3')
    expect(result.totalLines).toBe(3)
    expect(result.outputLines).toBe(3)
  })

  it('keeps last N lines', () => {
    const result = truncateTail('a\nb\nc\nd\ne', {
      maxLines: 3,
      maxBytes: 100_000,
    })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('c\nd\ne')
    expect(result.outputLines).toBe(3)
    expect(result.totalLines).toBe(5)
  })

  it('truncates by byte size keeping tail', () => {
    const result = truncateTail('aaaa\nbbbb\ncccc', {
      maxLines: 100,
      maxBytes: 5,
    })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('cccc')
  })

  it('handles empty string', () => {
    const result = truncateTail('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
  })
})
