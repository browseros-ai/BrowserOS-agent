/**
 * SessionNotifier - Centralized session start notification system
 * Used by Execution and RecordingSession to notify PortManager of new sessions
 */
export class SessionNotifier {
  private static callback: ((sessionId: string, mode: string) => void) | null = null

  /**
   * Set the session start callback
   * Called once during background script initialization
   */
  static setCallback(callback: (sessionId: string, mode: string) => void): void {
    SessionNotifier.callback = callback
    console.log('[SessionNotifier] Callback registered')
  }

  /**
   * Notify that a new session has started
   * Called by Execution or RecordingSession when creating a new session
   */
  static notifySessionStart(sessionId: string, mode: 'browse' | 'chat' | 'teach' | 'record'): void {
    console.log('[SessionNotifier] Notifying session start:', sessionId, mode, 'at', Date.now())

    if (SessionNotifier.callback) {
      SessionNotifier.callback(sessionId, mode)
    } else {
      console.warn('[SessionNotifier] No callback registered - UI will not receive events!')
    }
  }
}
