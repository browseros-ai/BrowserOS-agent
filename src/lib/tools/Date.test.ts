import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateTool } from './DateTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'

describe('DateTool', () => {
  let dateTool: DateTool
  let mockExecutionContext: ExecutionContext
  
  // Fix the date for consistent testing
  const mockDate = new Date('2024-01-22T12:00:00.000Z')
  
  beforeEach(() => {
    // Mock the current date
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
    
    // Create mock execution context
    mockExecutionContext = {} as ExecutionContext
    dateTool = new DateTool(mockExecutionContext)
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Single date ranges', () => {
    it('tests that today returns current date', async () => {
      const result = await dateTool.execute({
        date_range: 'today',
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '2024-01-22'
      })
    })
    
    it('tests that yesterday returns previous date', async () => {
      const result = await dateTool.execute({
        date_range: 'yesterday',
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '2024-01-21'
      })
    })
    
    it('tests that today with ISO format includes time', async () => {
      const result = await dateTool.execute({
        date_range: 'today',
        format: 'iso'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '2024-01-22T12:00:00.000Z'
      })
    })
  })

  describe('Date ranges', () => {
    it('tests that lastWeek returns 7 days range', async () => {
      const result = await dateTool.execute({
        date_range: 'lastWeek',
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2024-01-15',
        endDate: '2024-01-22'
      })
    })
    
    it('tests that lastMonth returns 30 days range', async () => {
      const result = await dateTool.execute({
        date_range: 'lastMonth',
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2023-12-23',
        endDate: '2024-01-22'
      })
    })
    
    it('tests that last30Days returns same as lastMonth', async () => {
      const result = await dateTool.execute({
        date_range: 'last30Days',
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2023-12-23',
        endDate: '2024-01-22'
      })
    })
  })

  describe('Custom date ranges', () => {
    it('tests that custom range with valid inputs works', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 10,
        dayEnd: 5,
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2024-01-12',
        endDate: '2024-01-17'
      })
    })
    
    it('tests that custom range for single day works', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 5,
        dayEnd: 5,
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2024-01-17',
        endDate: '2024-01-17'
      })
    })
    
    it('tests that custom range with large span works', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 300,
        dayEnd: 5,
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2023-03-28',
        endDate: '2024-01-17'
      })
    })
    
    it('tests that custom range without dayStart fails', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayEnd: 5,
        format: 'date'
      })
      
      expect(result.ok).toBe(false)
      expect(result.output).toBe('dayStart and dayEnd are required for custom date range')
    })
    
    it('tests that custom range without dayEnd fails', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 10,
        format: 'date'
      })
      
      expect(result.ok).toBe(false)
      expect(result.output).toBe('dayStart and dayEnd are required for custom date range')
    })
    
    it('tests that custom range with invalid order fails', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 5,
        dayEnd: 10,
        format: 'date'
      })
      
      expect(result.ok).toBe(false)
      expect(result.output).toBe('dayStart must be >= dayEnd (dayStart is further back in time)')
    })
  })

  describe('Date formats', () => {
    it('tests that US format works correctly', async () => {
      const result = await dateTool.execute({
        date_range: 'today',
        format: 'us'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '01/22/2024'
      })
    })
    
    it('tests that EU format works correctly', async () => {
      const result = await dateTool.execute({
        date_range: 'today',
        format: 'eu'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '22/01/2024'
      })
    })
    
    it('tests that Unix format returns timestamp', async () => {
      const result = await dateTool.execute({
        date_range: 'today',
        format: 'unix'
      })
      
      expect(result.ok).toBe(true)
      const parsed = JSON.parse(result.output)
      // Check that it's a valid timestamp (number)
      expect(typeof parsed.date).toBe('number')
      // Check it's for the correct date (2024-01-22)
      const resultDate = new Date(parsed.date)
      expect(resultDate.getFullYear()).toBe(2024)
      expect(resultDate.getMonth()).toBe(0) // January is 0
      expect(resultDate.getDate()).toBe(22)
    })
    
    it('tests that date format is default', async () => {
      const result = await dateTool.execute({
        date_range: 'today'
        // No format specified
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        date: '2024-01-22'
      })
    })
    
    it('tests that formats work correctly with ranges', async () => {
      const result = await dateTool.execute({
        date_range: 'lastWeek',
        format: 'us'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '01/15/2024',
        endDate: '01/22/2024'
      })
    })
  })

  describe('Edge cases', () => {
    it('tests that invalid date range returns error', async () => {
      const result = await dateTool.execute({
        date_range: 'invalid' as any,
        format: 'date'
      })
      
      expect(result.ok).toBe(false)
      expect(result.output).toContain('Unknown date range')
    })
    
    it('tests that boundary values work for custom range', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 365,
        dayEnd: 0,
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2023-01-22',
        endDate: '2024-01-22'
      })
    })
    
    it('tests that custom range from today to today works', async () => {
      const result = await dateTool.execute({
        date_range: 'custom',
        dayStart: 0,
        dayEnd: 0,
        format: 'date'
      })
      
      expect(result.ok).toBe(true)
      expect(JSON.parse(result.output)).toEqual({
        startDate: '2024-01-22',
        endDate: '2024-01-22'
      })
    })
  })
})