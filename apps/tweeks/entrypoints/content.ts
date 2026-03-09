export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    const SERVER_URL = 'http://127.0.0.1:9222'
    const currentUrl = window.location.href

    try {
      const res = await fetch(
        `${SERVER_URL}/tweeks/match?url=${encodeURIComponent(currentUrl)}`,
      )
      if (!res.ok) return

      const data = await res.json()
      const tweeks = data.tweeks as Array<{
        id: string
        script: string
        script_type: 'js' | 'css'
        name: string
      }>

      for (const tweek of tweeks) {
        try {
          if (tweek.script_type === 'css') {
            const style = document.createElement('style')
            style.dataset.tweekId = tweek.id
            style.textContent = tweek.script
            document.head.appendChild(style)
          } else {
            const script = document.createElement('script')
            script.dataset.tweekId = tweek.id
            script.textContent = tweek.script
            document.head.appendChild(script)
          }
        } catch {
          // Individual tweek failure shouldn't block others
        }
      }
    } catch {
      // Server not available — silently skip
    }
  },
})
