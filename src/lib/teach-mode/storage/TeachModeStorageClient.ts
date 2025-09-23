/**
 * Client for interacting with teach mode storage from UI
 * Communicates with background service via chrome.runtime messages
 */
export class TeachModeStorageClient {
  /**
   * Get list of all recordings
   */
  static async listRecordings(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_LIST' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to list recordings'))
          } else {
            resolve(response.recordings)
          }
        }
      )
    })
  }

  /**
   * Get a specific recording
   */
  static async getRecording(recordingId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_GET', recordingId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to get recording'))
          } else {
            resolve(response.recording)
          }
        }
      )
    })
  }

  /**
   * Delete a recording
   */
  static async deleteRecording(recordingId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_DELETE', recordingId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response.success)
          }
        }
      )
    })
  }

  /**
   * Clear all recordings
   */
  static async clearAllRecordings(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_CLEAR' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to clear recordings'))
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * Export a recording as JSON file
   */
  static async exportRecording(recordingId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_EXPORT', recordingId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to export recording'))
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * Import a recording from JSON
   */
  static async importRecording(json: string, title?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_IMPORT', json, title },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to import recording'))
          } else {
            resolve(response.recordingId)
          }
        }
      )
    })
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<{
    recordingCount: number
    totalSize: number
    availableSpace: number
    oldestRecording?: Date
    newestRecording?: Date
  }> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_STATS' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to get stats'))
          } else {
            // Convert date strings back to Date objects
            const stats = response.stats
            if (stats.oldestRecording) {
              stats.oldestRecording = new Date(stats.oldestRecording)
            }
            if (stats.newestRecording) {
              stats.newestRecording = new Date(stats.newestRecording)
            }
            resolve(stats)
          }
        }
      )
    })
  }

  /**
   * Search recordings by query
   */
  static async searchRecordings(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'TEACH_MODE_SEARCH', query },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to search recordings'))
          } else {
            resolve(response.recordings)
          }
        }
      )
    })
  }

  /**
   * Import recording from file
   * Shows file picker and imports selected JSON file
   */
  static async importFromFile(): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) {
          reject(new Error('No file selected'))
          return
        }

        try {
          const text = await file.text()
          const recordingId = await this.importRecording(text, file.name)
          resolve(recordingId)
        } catch (error) {
          reject(error)
        }
      }

      input.click()
    })
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  /**
   * Format duration for display
   */
  static formatDuration(startTimestamp: number, endTimestamp?: number): string {
    const duration = (endTimestamp || Date.now()) - startTimestamp
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}