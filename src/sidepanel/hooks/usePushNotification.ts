import { useCallback } from 'react'

/**
* Custom hook for sending web push notifications
 */
export function usePushNotification() {

  /**
   * Can be called for sending notifications
   * 
   * options parameter is `chrome.notifications.NotificationOptions<true>` because `chrome.notifications.create` function expects it like that
   */
  const sendNotification = useCallback(async (options: chrome.notifications.NotificationOptions<true>): Promise<string> => {

    return new Promise(async (resolve, reject) => {
      try {
        const { id: windowId } = await chrome.windows.getCurrent();
    
        // Not checking windowId for undefined here because it is already being checked in the background script
        // And sending the notification has more priority than saving windowId
  
        chrome.runtime.sendMessage({ action: "send-notification", options, windowId }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    })

  }, []);

  return {
    sendNotification,
  }
}
