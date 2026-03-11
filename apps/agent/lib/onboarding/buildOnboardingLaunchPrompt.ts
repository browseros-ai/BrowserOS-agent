import type { OnboardingProfile } from './onboardingStorage'

interface BuildOnboardingLaunchPromptParams {
  profile: OnboardingProfile | null
  gmailConnected: boolean
  calendarConnected: boolean
}

export function buildOnboardingLaunchPrompt({
  profile,
  gmailConnected,
  calendarConnected,
}: BuildOnboardingLaunchPromptParams): string {
  const name = profile?.name || 'the user'
  const assistantName = profile?.assistantName || 'BrowserOS'
  const roleLine = profile?.role ? `They work as ${profile.role}.` : ''
  const companyLine = profile?.company
    ? `They are currently at ${profile.company}.`
    : ''
  const descriptionLine = profile?.description
    ? `Their day-to-day: ${profile.description}`
    : ''
  const importLine =
    profile?.importStatus === 'imported'
      ? 'They already imported their Chrome profile.'
      : 'They skipped browser import for now.'

  let appInstruction =
    'Explain that Gmail and Google Calendar are not connected yet, and that connecting them later will let you understand their inbox and schedule before taking action.'

  if (gmailConnected && calendarConnected) {
    appInstruction =
      'Tell them Gmail and Google Calendar are connected, then ask if you may read up to 10 recent emails and up to 10 upcoming calendar events to get to know them better before doing anything else. Wait for permission before reading either service.'
  } else if (gmailConnected) {
    appInstruction =
      'Tell them Gmail is connected, then ask if you may read up to 10 recent emails to get to know them better before doing anything else. Wait for permission before reading Gmail.'
  } else if (calendarConnected) {
    appInstruction =
      'Tell them Google Calendar is connected, then ask if you may read up to 10 upcoming calendar events to get to know them better before doing anything else. Wait for permission before reading Calendar.'
  }

  return [
    `You are kicking off BrowserOS onboarding as ${assistantName}.`,
    `Call the user ${name}.`,
    roleLine,
    companyLine,
    descriptionLine,
    importLine,
    'The attached browser tab is their LinkedIn context.',
    'First, inspect the attached LinkedIn tab and give one concise summary of who they seem to be and what they do.',
    "Then briefly explain that BrowserOS can personalize SOUL.md, create and use skills, work with the user's own API keys, and automate scheduled tasks.",
    appInstruction,
    'Before you finish the first response, offer to co-create a daily 09:00 AM BrowserOS task that summarizes their inbox and calendar.',
    'Keep the first response warm, concise, and concrete.',
  ]
    .filter(Boolean)
    .join('\n')
}
