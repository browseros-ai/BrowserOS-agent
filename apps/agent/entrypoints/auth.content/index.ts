import { env } from '@/lib/env'

export default defineContentScript({
  matches: [`${env.VITE_PUBLIC_BROWSEROS_API}/home`],
  runAt: 'document_start',
  main() {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'AUTH_SUCCESS') {
        chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS' })
      }
    })
  },
})
