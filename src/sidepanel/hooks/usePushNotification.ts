import { useCallback } from 'react'

/**
* Custom hook for sending web push notifications
 */
export function usePushNotification() {

  /**
   * Can be called for sending notifications
   */
  const sendNotification = useCallback(async (options: chrome.notifications.NotificationOptions<true> ): Promise<string> => {

    return new Promise(async (resolve, reject) => {

      try {

        const noticationId = `notification-${Date.now()}`;

        chrome.notifications.create( noticationId , options, (notificationId) => {
          resolve(notificationId);
        });

      } catch (err: any) {

        reject(err);

      }

    })

  }, []);

  return {
    sendNotification,
  }
}
