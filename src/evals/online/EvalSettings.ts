/**
 * EvalSettings - Configuration management for online evaluation
 * 
 * This module provides a centralized way to manage evaluation settings
 * across the extension. Settings control what data is collected, how it's
 * filtered, and privacy controls.
 * 
 * Key features:
 * - Persistent storage using Chrome storage API
 * - Runtime validation with Zod schemas
 * - Privacy-first defaults (anonymization, redaction)
 * - Flexible filtering to reduce noise
 * - Performance tuning for production use
 */

import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'

// Comprehensive settings schema with sensible defaults
export const EvalSettingsSchema = z.object({
  enabled: z.boolean().default(false),  // Master switch for all tracking
  sampleRate: z.number().min(0).max(1).default(1.0),  // Statistical sampling (0=none, 1=all)
  
  // Tool filtering - reduce noise by tracking only relevant tools
  toolFilters: z.object({
    include: z.array(z.string()).optional(),  // Whitelist: only track these tools
    exclude: z.array(z.string()).optional()   // Blacklist: never track these tools
  }).optional(),
  
  // Event type filtering - focus on specific event categories
  eventFilters: z.object({
    includeTypes: z.array(z.string()).optional(),  // Only track these event types
    excludeTypes: z.array(z.string()).optional()   // Never track these event types
  }).optional(),
  
  // Performance tuning for production environments
  performance: z.object({
    bufferSize: z.number().min(1).max(100).default(20),  // Events to batch before sending
    flushIntervalMs: z.number().min(1000).max(60000).default(5000),  // Auto-flush interval
    maxEventSize: z.number().min(100).max(10000).default(1000)  // Truncate large events
  }).optional(),
  
  // Privacy controls - protect user data
  privacy: z.object({
    anonymizeUrls: z.boolean().default(true),      // Replace URLs with patterns
    redactSelectors: z.boolean().default(true),    // Remove CSS selectors
    hashUserId: z.boolean().default(true)          // Hash user IDs for anonymity
  }).optional(),
  
  braintrustApiKey: z.string().optional(),  // API key (should be stored securely)
  
  // Additional context for analysis
  metadata: z.object({
    environment: z.enum(['development', 'staging', 'production']).optional(),
    version: z.string().optional(),     // Extension version
    userId: z.string().optional()       // User identifier (will be hashed if privacy.hashUserId)
  }).optional()
})

export type EvalSettings = z.infer<typeof EvalSettingsSchema>

/**
 * Settings manager with caching and change notification
 * Uses Chrome storage API for persistence across sessions
 */
export class EvalSettingsManager {
  // Storage keys for different setting types
  private static readonly STORAGE_KEY = 'browseros_eval_settings'        // Main settings
  private static readonly API_KEY_STORAGE_KEY = 'BRAINTRUST_API_KEY'    // API key (separate for security)
  private static readonly EVAL_MODE_KEY = 'BROWSEROS_EVAL_MODE'         // Quick enable/disable flag
  
  // Runtime cache to avoid repeated storage reads
  private static cachedSettings: EvalSettings | null = null
  
  // Observer pattern for settings changes
  private static listeners: Set<(settings: EvalSettings) => void> = new Set()
  
  /**
   * Retrieve current settings with caching
   * Tries Chrome storage first, falls back to localStorage
   */
  static async getSettings(): Promise<EvalSettings> {
    // Use cache to avoid repeated storage reads
    if (this.cachedSettings) {
      return this.cachedSettings
    }
    
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        // Chrome extension: Use chrome.storage for persistence
        const result = await chrome.storage.local.get(this.STORAGE_KEY)
        const settings = result[this.STORAGE_KEY] || this.getDefaultSettings()
        this.cachedSettings = EvalSettingsSchema.parse(settings)  // Validate schema
        return this.cachedSettings
      } else if (typeof window !== 'undefined') {
        // Browser fallback: Use localStorage (for development)
        const stored = localStorage.getItem(this.STORAGE_KEY)
        const settings = stored ? JSON.parse(stored) : this.getDefaultSettings()
        this.cachedSettings = EvalSettingsSchema.parse(settings)
        return this.cachedSettings
      } else {
        // Node.js: Return defaults (for testing)
        return this.getDefaultSettings()
      }
    } catch (error) {
      Logging.log('EvalSettingsManager', `Failed to get settings: ${error.message}`, 'error')
      return this.getDefaultSettings()  // Fail gracefully with defaults
    }
  }
  
  /**
   * Update evaluation settings
   */
  static async setSettings(settings: Partial<EvalSettings>): Promise<void> {
    try {
      // Merge with existing settings
      const current = await this.getSettings()
      const updated = { ...current, ...settings }
      const validated = EvalSettingsSchema.parse(updated)
      
      // Update storage
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({
          [this.STORAGE_KEY]: validated
        })
      } else if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated))
      }
      
      // Update cached settings
      this.cachedSettings = validated
      
      // Update eval mode flag
      await this._updateEvalModeFlag(validated.enabled)
      
      // Notify listeners
      this.listeners.forEach(listener => listener(validated))
      
      Logging.log('EvalSettingsManager', `Settings updated: enabled=${validated.enabled}`, 'info')
    } catch (error) {
      Logging.log('EvalSettingsManager', `Failed to set settings: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * Get default settings
   */
  static getDefaultSettings(): EvalSettings {
    return {
      enabled: false,
      sampleRate: 1.0,
      toolFilters: {},
      eventFilters: {},
      performance: {
        bufferSize: 20,
        flushIntervalMs: 5000,
        maxEventSize: 1000
      },
      privacy: {
        anonymizeUrls: true,
        redactSelectors: true,
        hashUserId: true
      },
      metadata: {
        environment: 'development'
      }
    }
  }
  
  /**
   * Toggle evaluation mode on/off
   */
  static async toggleEvalMode(): Promise<boolean> {
    const settings = await this.getSettings()
    await this.setSettings({ enabled: !settings.enabled })
    return !settings.enabled
  }
  
  /**
   * Enable evaluation mode
   */
  static async enable(options: Partial<EvalSettings> = {}): Promise<void> {
    await this.setSettings({ ...options, enabled: true })
  }
  
  /**
   * Disable evaluation mode
   */
  static async disable(): Promise<void> {
    await this.setSettings({ enabled: false })
  }
  
  /**
   * Set Braintrust API key
   */
  static async setApiKey(apiKey: string): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({
        [this.API_KEY_STORAGE_KEY]: apiKey
      })
    } else if (typeof window !== 'undefined') {
      localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey)
    }
    
    await this.setSettings({ braintrustApiKey: apiKey })
  }
  
  /**
   * Get Braintrust API key
   */
  static async getApiKey(): Promise<string | null> {
    // Check settings first
    const settings = await this.getSettings()
    if (settings.braintrustApiKey) {
      return settings.braintrustApiKey
    }
    
    // Check storage
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(this.API_KEY_STORAGE_KEY)
      return result[this.API_KEY_STORAGE_KEY] || null
    } else if (typeof window !== 'undefined') {
      return localStorage.getItem(this.API_KEY_STORAGE_KEY)
    }
    
    return null
  }
  
  /**
   * Determine if a specific tool should be tracked
   * Applies include/exclude filters for fine-grained control
   * 
   * @param toolName - Name of the tool to check
   * @returns Whether the tool should be tracked
   */
  static async shouldTrackTool(toolName: string): Promise<boolean> {
    const settings = await this.getSettings()
    
    if (!settings.enabled) return false
    
    // Apply whitelist if specified
    if (settings.toolFilters?.include?.length) {
      return settings.toolFilters.include.includes(toolName)
    }
    
    // Apply blacklist if specified
    if (settings.toolFilters?.exclude?.length) {
      return !settings.toolFilters.exclude.includes(toolName)
    }
    
    return true  // Track by default if no filters
  }
  
  /**
   * Determine if a specific event type should be tracked
   * Applies sampling rate and type filters
   * 
   * @param eventType - Type of event to check
   * @returns Whether the event should be tracked
   */
  static async shouldTrackEvent(eventType: string): Promise<boolean> {
    const settings = await this.getSettings()
    
    if (!settings.enabled) return false
    
    // Apply statistical sampling
    if (Math.random() > settings.sampleRate) {
      return false  // Skip this event for sampling
    }
    
    // Apply event type whitelist
    if (settings.eventFilters?.includeTypes?.length) {
      return settings.eventFilters.includeTypes.includes(eventType)
    }
    
    // Apply event type blacklist
    if (settings.eventFilters?.excludeTypes?.length) {
      return !settings.eventFilters.excludeTypes.includes(eventType)
    }
    
    return true  // Track by default if no filters
  }
  
  /**
   * Add a listener for settings changes
   */
  static addListener(listener: (settings: EvalSettings) => void): void {
    this.listeners.add(listener)
  }
  
  /**
   * Remove a settings change listener
   */
  static removeListener(listener: (settings: EvalSettings) => void): void {
    this.listeners.delete(listener)
  }
  
  /**
   * Clear all settings
   */
  static async clearSettings(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.remove([this.STORAGE_KEY, this.API_KEY_STORAGE_KEY, this.EVAL_MODE_KEY])
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
      localStorage.removeItem(this.API_KEY_STORAGE_KEY)
      localStorage.removeItem(this.EVAL_MODE_KEY)
    }
    
    this.cachedSettings = null
    Logging.log('EvalSettingsManager', 'Settings cleared', 'info')
  }
  
  /**
   * Export settings as JSON
   */
  static async exportSettings(): Promise<string> {
    const settings = await this.getSettings()
    return JSON.stringify(settings, null, 2)
  }
  
  /**
   * Import settings from JSON
   */
  static async importSettings(json: string): Promise<void> {
    try {
      const settings = JSON.parse(json)
      const validated = EvalSettingsSchema.parse(settings)
      await this.setSettings(validated)
    } catch (error) {
      throw new Error(`Invalid settings JSON: ${error.message}`)
    }
  }
  
  // Private helper to update eval mode flag
  private static async _updateEvalModeFlag(enabled: boolean): Promise<void> {
    const value = enabled ? 'true' : 'false'
    
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({
        [this.EVAL_MODE_KEY]: value
      })
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.EVAL_MODE_KEY, value)
      sessionStorage.setItem(this.EVAL_MODE_KEY, value)
    }
  }
}
