import { startTweakRuntime } from '@/lib/tweaks/runtime'
import { seedStarterTweaksIfNeeded } from '@/lib/tweaks/storage'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    await seedStarterTweaksIfNeeded()
    await startTweakRuntime()
  },
})
