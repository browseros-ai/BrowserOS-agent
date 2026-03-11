export type OnboardingFlowSource = 'setup' | 'settings'

export const ONBOARDING_HOME_PATH = '/home'
export const ONBOARDING_ENTRY_PATH = '/onboarding'
export const ONBOARDING_DEMO_PATH = '/onboarding/demo'

export const onboardingProgressSteps = [
  {
    id: 1,
    name: 'About You',
  },
  {
    id: 2,
    name: 'Sign In',
  },
  {
    id: 3,
    name: 'First Task',
  },
] as const

export type OnboardingProgressStep =
  (typeof onboardingProgressSteps)[number]['id']

export function getOnboardingFlowSource(
  searchParams: URLSearchParams,
): OnboardingFlowSource {
  const source = searchParams.get('source')
  return source === 'settings' || source === 'revisit' ? 'settings' : 'setup'
}

export function getOnboardingFeaturesPath(source: OnboardingFlowSource) {
  return `${ONBOARDING_ENTRY_PATH}/features?source=${source}`
}

export function getOnboardingStepPath(
  step: 1 | 2,
  source: OnboardingFlowSource,
) {
  return `${ONBOARDING_ENTRY_PATH}/steps/${step}?source=${source}`
}

export function getOnboardingDemoPath(source: OnboardingFlowSource) {
  return `${ONBOARDING_DEMO_PATH}?source=${source}`
}

export function getOnboardingRevisitPath() {
  return `${ONBOARDING_ENTRY_PATH}?source=revisit`
}
