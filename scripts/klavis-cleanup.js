#!/usr/bin/env node

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = true // Set to false to actually delete users
const PAGES_TO_FETCH = null // null = all pages, or set number like 1 for testing
const DELETE_LIMIT = null  // null = no limit, or set number like 10 for safety
const SHOW_SKIPPED = false // Set to true to see users that won't be deleted

const STALE_THRESHOLD_DAYS = 21 // 4 weeks
const API_KEY = process.env.KLAVIS_API_KEY
const API_BASE = 'https://api.klavis.ai'

// ============================================================================
// HELPERS
// ============================================================================

async function apiCall(method, path) {
  const url = `${API_BASE}${path}`

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API Error ${response.status}: ${error}`)
  }

  return response.json()
}

function formatDate(dateString) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

function daysSince(dateString) {
  if (!dateString) return null  // Return null for never used
  const ms = Date.now() - new Date(dateString).getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function fetchAllUsers() {
  console.log('Fetching users from Klavis API...')

  const users = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    // Check if we've hit the page limit
    if (PAGES_TO_FETCH && page > PAGES_TO_FETCH) {
      console.log(`  Stopping at ${PAGES_TO_FETCH} pages (configured limit)`)
      break
    }

    const data = await apiCall('GET', `/user/?page_number=${page}&page_size=50`)
    users.push(...data.users)
    totalPages = data.totalPages

    console.log(`  Page ${page}/${totalPages}: ${data.users.length} users`)
    page++
  }

  console.log(`Total users fetched: ${users.length}\n`)
  return users
}

async function processUsers(users) {
  const staleThresholdMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  const cutoffTime = Date.now() - staleThresholdMs

  let staleCount = 0
  let deletedCount = 0
  let neverUsedCount = 0

  console.log(DRY_RUN ? 'DRY RUN - No users will be deleted\n' : 'LIVE MODE - Users will be deleted\n')
  console.log('Checking users for deletion...')
  console.log('Delete criteria:')
  console.log('  1. Never-used users created > 28 days ago')
  console.log('  2. Users who last used the service > 28 days ago')
  console.log('Keep criteria:')
  console.log('  1. New users created < 28 days ago (even if never used)')
  console.log('  2. Active users who used the service < 28 days ago\n')

  for (let i = 0; i < users.length; i++) {
    // Check if we've hit the delete limit
    if (DELETE_LIMIT && deletedCount >= DELETE_LIMIT) {
      console.log(`\nReached delete limit of ${DELETE_LIMIT} users. Stopping.`)
      break
    }

    const user = users[i]

    // Get user details to check lastUsedAt
    const details = await apiCall('GET', `/user/${user.userId}`)

    // Delete if:
    // 1. User has NEVER used the service (lastUsedAt = null) AND was created > 28 days ago
    // 2. User HAS used the service but not in 28+ days
    let shouldDelete = false
    let deleteReason = ''

    if (!details.lastUsedAt) {
      // Never connected any MCP servers - check if created > 28 days ago
      const createdTime = new Date(user.createdAt).getTime()
      if (createdTime < cutoffTime) {
        // Created more than 28 days ago and never used
        shouldDelete = true
        const daysOld = daysSince(user.createdAt)
        deleteReason = `never used, created ${daysOld} days ago`
        neverUsedCount++
      }
      // else: New user (< 28 days), give them time to connect
    } else if (new Date(details.lastUsedAt).getTime() < cutoffTime) {
      // Used the service but is now stale
      shouldDelete = true
      const daysAgo = daysSince(details.lastUsedAt)
      deleteReason = `stale for ${daysAgo} days`
      staleCount++
    }

    // Process deletion if needed
    if (shouldDelete) {
      if (DRY_RUN) {
        // In dry run mode, show detailed info
        console.log(`User: ${user.userId}`)
        console.log(`  Created: ${formatDate(user.createdAt)} (${daysSince(user.createdAt)} days ago)`)
        console.log(`  Last Used: ${formatDate(details.lastUsedAt)}`)
        console.log(`  Reason: ${deleteReason}`)
        console.log(`  Action: Would delete (dry run)\n`)
      } else {
        // In live mode, just show minimal info and delete
        try {
          await apiCall('DELETE', `/user/${user.userId}`)
          deletedCount++
          console.log(`${user.userId}: ${deleteReason} - DELETED`)
        } catch (error) {
          console.log(`${user.userId}: ${deleteReason} - DELETE FAILED: ${error.message}`)
        }
      }
    } else {
      // User is active or new
      if (SHOW_SKIPPED) {
        if (!details.lastUsedAt) {
          // New user (< 28 days old), never used yet
          console.log(`User: ${user.userId}`)
          console.log(`  Created: ${formatDate(user.createdAt)} (${daysSince(user.createdAt)} days ago)`)
          console.log(`  Last Used: Never`)
          console.log(`  Status: SKIPPED - New user (< 28 days old)\n`)
        } else {
          // Active user (used within 28 days)
          const daysAgo = daysSince(details.lastUsedAt)
          console.log(`User: ${user.userId}`)
          console.log(`  Created: ${formatDate(user.createdAt)} (${daysSince(user.createdAt)} days ago)`)
          console.log(`  Last Used: ${formatDate(details.lastUsedAt)} (${daysAgo} days ago)`)
          console.log(`  Status: SKIPPED - Active user\n`)
        }
      }
    }

    // Progress indicator every 50 users
    if ((i + 1) % 50 === 0) {
      console.log(`... processed ${i + 1}/${users.length} users ...`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total users checked: ${users.length}`)
  console.log(`Never-used (created > 28 days ago): ${neverUsedCount}`)
  console.log(`Stale (last used > 28 days ago): ${staleCount}`)

  const totalToDelete = neverUsedCount + staleCount
  const keptUsers = users.length - totalToDelete

  console.log(`Kept (new or active users): ${keptUsers}`)

  if (DRY_RUN) {
    console.log(`\nUsers that would be deleted: ${totalToDelete}`)
    console.log('\nTo actually delete these users, set DRY_RUN = false')
  } else {
    console.log(`\nUsers deleted: ${deletedCount}`)
  }
}

async function main() {
  console.log('Klavis Stale User Cleanup Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE DELETION'}`)
  console.log(`Stale threshold: ${STALE_THRESHOLD_DAYS} days`)
  console.log(`Page limit: ${PAGES_TO_FETCH || 'None (fetch all)'}`)
  console.log(`Delete limit: ${DELETE_LIMIT || 'None'}`)
  console.log(`Show skipped users: ${SHOW_SKIPPED}`)
  console.log('='.repeat(60) + '\n')

  // Check API key
  if (!API_KEY) {
    console.error('ERROR: KLAVIS_API_KEY environment variable not set')
    console.error('Run: export KLAVIS_API_KEY=your_api_key_here')
    process.exit(1)
  }

  try {
    // Step 1: Fetch all users
    const users = await fetchAllUsers()

    // Step 2: Process users (check staleness and delete if needed)
    await processUsers(users)

  } catch (error) {
    console.error('\nERROR:', error.message)
    process.exit(1)
  }
}

// Run the script
main()
