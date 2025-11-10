/**
 * Utility functions for managing BrowserOS user ID
 * User ID is stored in Chrome storage and used for server session identification
 */

const NXTSCAPE_USER_ID_KEY = 'nxtscape_user_id'

/**
 * Get or create browser-specific user ID
 * Format: nxtscape_<timestamp>_<random>
 *
 * @returns Promise<string> The user ID from storage or newly generated
 */
export async function getUserId(): Promise<string> {
  // Try to get from Chrome storage
  try {
    const storage = await chrome.storage.local.get([NXTSCAPE_USER_ID_KEY])
    if (storage[NXTSCAPE_USER_ID_KEY]) {
      return storage[NXTSCAPE_USER_ID_KEY] as string
    }
  } catch (error) {
    console.warn('Could not read user ID from Chrome storage:', error)
  }

  // Generate new user ID
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  const userId = `nxtscape_${timestamp}_${random}`

  // Save to Chrome storage
  try {
    await chrome.storage.local.set({ [NXTSCAPE_USER_ID_KEY]: userId })
  } catch (error) {
    console.warn('Could not save user ID to Chrome storage:', error)
  }

  return userId
}
