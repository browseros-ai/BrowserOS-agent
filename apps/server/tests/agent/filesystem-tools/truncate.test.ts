import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  truncateHead,
  truncateLine,
  truncateTail,
} from '../../../src/agent/tool-loop/filesystem-tools/truncate'

describe('filesystem truncate helpers', () => {
  it('truncateHead truncates by line count', () => {
    const input = 'a\nb\nc\nd'
    const result = truncateHead(input, { maxLines: 2, maxBytes: 1024 })

    assert.strictEqual(result.truncated, true)
    assert.strictEqual(result.truncatedBy, 'lines')
    assert.strictEqual(result.content, 'a\nb')
  })

  it('truncateHead truncates by byte count', () => {
    const input = '12345\n67890\nabcde'
    const result = truncateHead(input, { maxLines: 10, maxBytes: 8 })

    assert.strictEqual(result.truncated, true)
    assert.strictEqual(result.truncatedBy, 'bytes')
    assert.strictEqual(result.content, '12345')
  })

  it('truncateTail keeps latest lines', () => {
    const input = 'line1\nline2\nline3\nline4'
    const result = truncateTail(input, { maxLines: 2, maxBytes: 1024 })

    assert.strictEqual(result.truncated, true)
    assert.strictEqual(result.content, 'line3\nline4')
  })

  it('truncateLine shortens very long lines', () => {
    const result = truncateLine('abcdefghijklmnopqrstuvwxyz', 10)

    assert.strictEqual(result.wasTruncated, true)
    assert.match(result.text, /truncated/)
  })
})
