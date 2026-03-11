import { createBrowserOSAction } from '@/lib/chat-actions/types'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'
import { buildOnboardingLaunchPrompt } from './buildOnboardingLaunchPrompt'
import type { OnboardingProfile } from './onboardingStorage'

export interface SeedOnboardingHomeChatParams {
  profile: OnboardingProfile | null
  gmailConnected: boolean
  calendarConnected: boolean
}

export function buildOnboardingScheduledTaskUrl() {
  const params = new URLSearchParams({
    openDialog: 'true',
    name: 'Daily inbox and calendar brief',
    query:
      'Every morning at 09:00, review my recent Gmail inbox and upcoming Google Calendar events, then summarize what matters most today.',
    scheduleType: 'daily',
    scheduleTime: '09:00',
  })

  return chrome.runtime.getURL(`app.html#/scheduled?${params.toString()}`)
}

export async function seedOnboardingHomeChat({
  profile,
  gmailConnected,
  calendarConnected,
}: SeedOnboardingHomeChatParams) {
  const currentTab = await chrome.tabs.getCurrent().catch(() => undefined)
  const prompt = buildOnboardingLaunchPrompt({
    profile,
    gmailConnected,
    calendarConnected,
  })

  let linkedInTab: chrome.tabs.Tab | undefined
  try {
    const created = await chrome.tabs.create({
      url: 'https://www.linkedin.com/in/me/',
      active: false,
    })
    linkedInTab = created.id ? await chrome.tabs.get(created.id) : created
  } catch {
    linkedInTab = undefined
  }

  await searchActionsStorage.setValue({
    query: prompt,
    mode: 'agent',
    target: 'newtab',
    targetTabId: currentTab?.id,
    action: createBrowserOSAction({
      mode: 'agent',
      message: prompt,
      tabs: linkedInTab ? [linkedInTab] : undefined,
    }),
  })
}
