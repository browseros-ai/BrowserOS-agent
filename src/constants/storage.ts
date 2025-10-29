/**
 * Storage Keys
 * Centralized constants for chrome.storage keys to prevent inconsistencies
 */
export const STORAGE_KEYS = {
  ONBOARDING_SEEN: 'hasSeenOnboarding'  // Boolean flag - has user seen onboarding
} as const

/**
 * Onboarding storage utility
 */
export class OnboardingStorage {
  /**
   * Mark onboarding as seen
   */
  static async markAsSeen(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.ONBOARDING_SEEN]: true })
    } catch (error) {
      console.error('[OnboardingStorage] Failed to mark as seen:', error)
    }
  }

  /**
   * Reset onboarding state (for testing/debugging)
   */
  static async reset(): Promise<void> {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.ONBOARDING_SEEN)
    } catch (error) {
      console.error('[OnboardingStorage] Failed to reset:', error)
    }
  }
}
