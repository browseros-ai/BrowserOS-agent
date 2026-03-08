import { describe, expect, it } from 'bun:test'
import {
  getGeneratedFileOpenMode,
  getGeneratedFileTypeLabel,
} from '@browseros/shared/generated-files'

describe('generated-files helpers', () => {
  it('opens HTML and PDF files in the browser', () => {
    expect(getGeneratedFileOpenMode('/tmp/report.html')).toBe('browser')
    expect(getGeneratedFileOpenMode('/tmp/report.pdf')).toBe('browser')
  })

  it('opens DOCX files in the default native app', () => {
    expect(getGeneratedFileOpenMode('/tmp/report.docx')).toBe('native')
    expect(getGeneratedFileTypeLabel('/tmp/report.docx')).toBe('DOCX file')
  })

  it('uses an explicit media type when provided', () => {
    expect(
      getGeneratedFileOpenMode('/tmp/report.bin', 'text/html; charset=utf-8'),
    ).toBe('browser')
    expect(
      getGeneratedFileTypeLabel('/tmp/report.bin', 'application/pdf'),
    ).toBe('PDF document')
  })
})
