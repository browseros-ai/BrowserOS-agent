import { TeachModeRecording, RecordingMetadata } from '@/lib/teach-mode/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Storage metadata for a recording
 */
interface StorageMetadata {
  id: string
  title: string
  description?: string
  url: string
  tabId: number
  startTime: number
  endTime: number
  eventCount: number
  sizeBytes: number
  createdAt: number
}

/**
 * Storage index for efficient listing
 */
interface StorageIndex {
  recordings: StorageMetadata[]
  totalSize: number
  lastUpdated: number
}

const STORAGE_KEY_PREFIX = 'teach_recording_'
const STORAGE_INDEX_KEY = 'teach_recordings_index'
const MAX_STORAGE_SIZE = 100 * 1024 * 1024  // 100MB limit
const MAX_RECORDINGS = 100  // Maximum number of recordings

/**
 * Manages storage of teach mode recordings
 * Uses chrome.storage.local for persistence
 */
export class RecordingStorage {
  private static instance: RecordingStorage

  private constructor() {}

  static getInstance(): RecordingStorage {
    if (!RecordingStorage.instance) {
      RecordingStorage.instance = new RecordingStorage()
    }
    return RecordingStorage.instance
  }

  /**
   * Save a recording to storage
   */
  async save(recording: TeachModeRecording, title?: string, description?: string): Promise<string> {
    try {
      const recordingId = recording.metadata.id
      const storageKey = `${STORAGE_KEY_PREFIX}${recordingId}`

      // Serialize recording to JSON
      const json = JSON.stringify(recording)
      const sizeBytes = new Blob([json]).size

      // Check storage limits
      const index = await this._getIndex()
      if (index.recordings.length >= MAX_RECORDINGS) {
        throw new Error(`Maximum number of recordings (${MAX_RECORDINGS}) reached. Please delete some recordings.`)
      }
      if (index.totalSize + sizeBytes > MAX_STORAGE_SIZE) {
        throw new Error('Storage limit exceeded. Please delete some recordings.')
      }

      // Create storage metadata
      const metadata: StorageMetadata = {
        id: recordingId,
        title: title || `Recording ${new Date(recording.metadata.startTime).toLocaleString()}`,
        description,
        url: recording.metadata.url,
        tabId: recording.metadata.tabId,
        startTime: recording.metadata.startTime,
        endTime: recording.metadata.endTime || Date.now(),
        eventCount: recording.events.length,
        sizeBytes,
        createdAt: Date.now()
      }

      // Save recording data
      await chrome.storage.local.set({
        [storageKey]: json
      })

      // Update index
      await this._updateIndex(metadata)

      Logging.log('RecordingStorage', `Saved recording ${recordingId} (${sizeBytes} bytes, ${recording.events.length} events)`)

      return recordingId

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to save recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Get a recording by ID
   */
  async get(recordingId: string): Promise<TeachModeRecording | null> {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${recordingId}`
      const result = await chrome.storage.local.get(storageKey)

      if (!result[storageKey]) {
        Logging.log('RecordingStorage', `Recording ${recordingId} not found`, 'warning')
        return null
      }

      // Parse JSON
      const recording = JSON.parse(result[storageKey]) as TeachModeRecording

      Logging.log('RecordingStorage', `Retrieved recording ${recordingId}`)
      return recording

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to get recording ${recordingId}: ${error}`, 'error')
      return null
    }
  }

  /**
   * List all recordings (metadata only)
   */
  async list(): Promise<StorageMetadata[]> {
    try {
      const index = await this._getIndex()

      // Sort by creation date (newest first)
      const sorted = [...index.recordings].sort((a, b) => b.createdAt - a.createdAt)

      Logging.log('RecordingStorage', `Listed ${sorted.length} recordings`)
      return sorted

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to list recordings: ${error}`, 'error')
      return []
    }
  }

  /**
   * Delete a recording
   */
  async delete(recordingId: string): Promise<boolean> {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${recordingId}`

      // Remove from storage
      await chrome.storage.local.remove(storageKey)

      // Update index
      const index = await this._getIndex()
      index.recordings = index.recordings.filter(r => r.id !== recordingId)
      index.totalSize = index.recordings.reduce((sum, r) => sum + r.sizeBytes, 0)
      index.lastUpdated = Date.now()
      await chrome.storage.local.set({ [STORAGE_INDEX_KEY]: index })

      Logging.log('RecordingStorage', `Deleted recording ${recordingId}`)
      return true

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to delete recording ${recordingId}: ${error}`, 'error')
      return false
    }
  }

  /**
   * Clear all recordings
   */
  async clear(): Promise<void> {
    try {
      // Get all recording keys
      const index = await this._getIndex()
      const keysToRemove = index.recordings.map(r => `${STORAGE_KEY_PREFIX}${r.id}`)
      keysToRemove.push(STORAGE_INDEX_KEY)

      // Remove all recordings and index
      await chrome.storage.local.remove(keysToRemove)

      Logging.log('RecordingStorage', `Cleared ${index.recordings.length} recordings`)

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to clear recordings: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Export recording as JSON file download
   */
  async export(recordingId: string): Promise<void> {
    try {
      const recording = await this.get(recordingId)
      if (!recording) {
        throw new Error(`Recording ${recordingId} not found`)
      }

      // Create JSON blob
      const json = JSON.stringify(recording, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // Generate filename
      const date = new Date(recording.metadata.startTime)
      const dateStr = date.toISOString().slice(0, 19).replace(/[:.]/g, '-')
      const filename = `teach-mode-recording-${dateStr}.json`

      // Trigger download
      await chrome.downloads.download({
        url,
        filename,
        saveAs: true
      })

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      Logging.log('RecordingStorage', `Exported recording ${recordingId} as ${filename}`)

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to export recording ${recordingId}: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Import recording from JSON
   */
  async import(json: string, title?: string): Promise<string> {
    try {
      // Parse and validate JSON
      const recording = JSON.parse(json) as TeachModeRecording

      // Validate structure
      if (!recording.metadata || !recording.events || !Array.isArray(recording.events)) {
        throw new Error('Invalid recording format')
      }

      // Generate new ID for imported recording
      recording.metadata.id = `recording_imported_${Date.now()}`

      // Save imported recording
      const recordingId = await this.save(
        recording,
        title || `Imported: ${recording.metadata.id}`,
        'Imported recording'
      )

      Logging.log('RecordingStorage', `Imported recording as ${recordingId}`)
      return recordingId

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to import recording: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    recordingCount: number
    totalSize: number
    availableSpace: number
    oldestRecording?: Date
    newestRecording?: Date
  }> {
    try {
      const index = await this._getIndex()

      const stats = {
        recordingCount: index.recordings.length,
        totalSize: index.totalSize,
        availableSpace: MAX_STORAGE_SIZE - index.totalSize,
        oldestRecording: undefined as Date | undefined,
        newestRecording: undefined as Date | undefined
      }

      if (index.recordings.length > 0) {
        const sorted = [...index.recordings].sort((a, b) => a.createdAt - b.createdAt)
        stats.oldestRecording = new Date(sorted[0].createdAt)
        stats.newestRecording = new Date(sorted[sorted.length - 1].createdAt)
      }

      return stats

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to get storage stats: ${error}`, 'error')
      return {
        recordingCount: 0,
        totalSize: 0,
        availableSpace: MAX_STORAGE_SIZE
      }
    }
  }

  /**
   * Search recordings by URL or title
   */
  async search(query: string): Promise<StorageMetadata[]> {
    try {
      const index = await this._getIndex()
      const lowerQuery = query.toLowerCase()

      const results = index.recordings.filter(r =>
        r.title.toLowerCase().includes(lowerQuery) ||
        r.url.toLowerCase().includes(lowerQuery) ||
        (r.description && r.description.toLowerCase().includes(lowerQuery))
      )

      // Sort by relevance (title matches first, then URL matches)
      results.sort((a, b) => {
        const aInTitle = a.title.toLowerCase().includes(lowerQuery) ? 1 : 0
        const bInTitle = b.title.toLowerCase().includes(lowerQuery) ? 1 : 0
        if (aInTitle !== bInTitle) return bInTitle - aInTitle
        return b.createdAt - a.createdAt
      })

      return results

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to search recordings: ${error}`, 'error')
      return []
    }
  }

  /**
   * Get storage index
   */
  private async _getIndex(): Promise<StorageIndex> {
    try {
      const result = await chrome.storage.local.get(STORAGE_INDEX_KEY)

      if (result[STORAGE_INDEX_KEY]) {
        return result[STORAGE_INDEX_KEY] as StorageIndex
      }

      // Initialize empty index
      return {
        recordings: [],
        totalSize: 0,
        lastUpdated: Date.now()
      }

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to get index: ${error}`, 'error')
      return {
        recordings: [],
        totalSize: 0,
        lastUpdated: Date.now()
      }
    }
  }

  /**
   * Update storage index with new metadata
   */
  private async _updateIndex(metadata: StorageMetadata): Promise<void> {
    try {
      const index = await this._getIndex()

      // Remove existing entry if updating
      const existingIndex = index.recordings.findIndex(r => r.id === metadata.id)
      if (existingIndex >= 0) {
        index.totalSize -= index.recordings[existingIndex].sizeBytes
        index.recordings.splice(existingIndex, 1)
      }

      // Add new metadata
      index.recordings.push(metadata)
      index.totalSize += metadata.sizeBytes
      index.lastUpdated = Date.now()

      // Save updated index
      await chrome.storage.local.set({ [STORAGE_INDEX_KEY]: index })

      Logging.log('RecordingStorage', `Updated index with recording ${metadata.id}`)

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to update index: ${error}`, 'error')
      throw error
    }
  }

  /**
   * Cleanup old recordings if storage is full
   */
  async cleanupOldRecordings(keepCount: number = 50): Promise<number> {
    try {
      const index = await this._getIndex()

      if (index.recordings.length <= keepCount) {
        return 0
      }

      // Sort by creation date (oldest first)
      const sorted = [...index.recordings].sort((a, b) => a.createdAt - b.createdAt)

      // Delete oldest recordings
      const toDelete = sorted.slice(0, index.recordings.length - keepCount)
      let deletedCount = 0

      for (const recording of toDelete) {
        if (await this.delete(recording.id)) {
          deletedCount++
        }
      }

      Logging.log('RecordingStorage', `Cleaned up ${deletedCount} old recordings`)
      return deletedCount

    } catch (error) {
      Logging.log('RecordingStorage', `Failed to cleanup old recordings: ${error}`, 'error')
      return 0
    }
  }
}