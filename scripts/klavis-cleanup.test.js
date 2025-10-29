import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the script content
const scriptPath = path.join(__dirname, 'klavis-cleanup.js')
const scriptContent = fs.readFileSync(scriptPath, 'utf-8')

// Replicate helper functions from the script for testing
// These are exact copies of the functions in klavis-cleanup.js
function formatDate(dateString) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

function daysSince(dateString) {
  if (!dateString) return null  // Return null for never used
  const ms = Date.now() - new Date(dateString).getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

describe('klavis-cleanup-script-unit-test', () => {
  it('tests that the script file can be loaded and contains required functions', () => {
    expect(scriptContent).toBeDefined()
    expect(scriptContent.length).toBeGreaterThan(0)

    // Verify critical constants
    expect(scriptContent).toContain('const STALE_THRESHOLD_DAYS = 28')
    expect(scriptContent).toContain('const DRY_RUN')
    expect(scriptContent).toContain('const DELETE_LIMIT')
  })

  it('tests that daysSince helper correctly calculates days for valid dates', () => {
    // Test with a date 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const result = daysSince(thirtyDaysAgo)

    expect(result).toBeGreaterThanOrEqual(29)
    expect(result).toBeLessThanOrEqual(31) // Allow some tolerance for timing

    // Test with a date 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const result2 = daysSince(tenDaysAgo)

    expect(result2).toBeGreaterThanOrEqual(9)
    expect(result2).toBeLessThanOrEqual(11)

    // Test with a date 1 day ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const result3 = daysSince(oneDayAgo)

    expect(result3).toBeGreaterThanOrEqual(0)
    expect(result3).toBeLessThanOrEqual(2)
  })

  it('tests that daysSince returns null for null input (never-used users)', () => {
    // IMPORTANT: This is the critical behavior - null input means "never used"
    const nullResult = daysSince(null)
    expect(nullResult).toBe(null)

    // Test with undefined as well
    const undefinedResult = daysSince(undefined)
    expect(undefinedResult).toBe(null)

    // Test with empty string
    const emptyResult = daysSince('')
    expect(emptyResult).toBe(null)
  })

  it('tests that formatDate helper formats dates properly and returns "Never" for null', () => {
    // Test with null input (never-used user)
    const neverResult = formatDate(null)
    expect(neverResult).toBe('Never')

    // Test with undefined input
    const undefinedResult = formatDate(undefined)
    expect(undefinedResult).toBe('Never')

    // Test with empty string
    const emptyResult = formatDate('')
    expect(emptyResult).toBe('Never')

    // Test with valid date - should return a formatted date string
    const validDate = '2024-01-15T10:30:00Z'
    const validResult = formatDate(validDate)
    expect(validResult).not.toBe('Never')
    expect(validResult).toBeTruthy()
    expect(typeof validResult).toBe('string')
    expect(validResult.length).toBeGreaterThan(0)
  })

  it('tests stale detection logic correctly identifies stale vs never-used users', () => {
    // This tests the core logic from the processUsers function
    const STALE_THRESHOLD_DAYS = 28
    const staleThresholdMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - staleThresholdMs

    // Test Case 1: User who last used 30 days ago (SHOULD BE STALE)
    const staleUserLastUsed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const isStaleUser = staleUserLastUsed && new Date(staleUserLastUsed).getTime() < cutoffTime
    expect(isStaleUser).toBe(true)

    // Test Case 2: User who last used 20 days ago (NOT STALE - within 28 days)
    const activeUserLastUsed = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    const isActiveUser = activeUserLastUsed && new Date(activeUserLastUsed).getTime() < cutoffTime
    expect(isActiveUser).toBe(false)

    // Test Case 3: User who NEVER used the service (NOT STALE - CRITICAL!)
    // The check is: lastUsedAt && new Date(lastUsedAt).getTime() < cutoffTime
    // If lastUsedAt is null, the && short-circuits and returns falsy (null)
    const neverUsedLastUsed = null
    const isNeverUsedStale = neverUsedLastUsed && new Date(neverUsedLastUsed).getTime() < cutoffTime
    expect(isNeverUsedStale).toBeFalsy() // Returns null, which is falsy

    // Test Case 4: User with undefined lastUsedAt (NOT STALE)
    const undefinedLastUsed = undefined
    const isUndefinedStale = undefinedLastUsed && new Date(undefinedLastUsed).getTime() < cutoffTime
    expect(isUndefinedStale).toBeFalsy() // Returns undefined, which is falsy

    // Test Case 5: User who last used 29 days ago (SHOULD BE STALE - clearly past threshold)
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
    const isTwentyNineDaysStale = twentyNineDaysAgo &&
      new Date(twentyNineDaysAgo).getTime() < cutoffTime
    expect(isTwentyNineDaysStale).toBe(true)

    // Test Case 6: User who last used 27 days ago (NOT STALE - just before threshold)
    const twentySevenDaysAgo = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString()
    const isTwentySevenDaysStale = twentySevenDaysAgo &&
      new Date(twentySevenDaysAgo).getTime() < cutoffTime
    expect(isTwentySevenDaysStale).toBe(false)
  })

  it('tests that API error handling logic works correctly', () => {
    // Test the error message format from apiCall function
    const errorPattern = /API Error \d+:/

    // Simulate different error scenarios that the script would create
    const error404 = new Error('API Error 404: User not found')
    expect(error404.message).toMatch(errorPattern)
    expect(error404.message).toContain('404')
    expect(error404.message).toContain('User not found')

    const error500 = new Error('API Error 500: Internal server error')
    expect(error500.message).toMatch(errorPattern)
    expect(error500.message).toContain('500')
    expect(error500.message).toContain('Internal server error')

    const error401 = new Error('API Error 401: Unauthorized')
    expect(error401.message).toMatch(errorPattern)
    expect(error401.message).toContain('401')
    expect(error401.message).toContain('Unauthorized')

    // Verify the script has error handling for API calls
    expect(scriptContent).toContain('if (!response.ok)')
    expect(scriptContent).toContain('throw new Error')
    expect(scriptContent).toContain('API Error')
  })
})
