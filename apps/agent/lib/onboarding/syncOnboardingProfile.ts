import { UpdateProfileByUserIdDocument } from '@/entrypoints/app/profile/graphql/profileDocument'
import { execute } from '@/lib/graphql/execute'
import { onboardingProfileStorage } from './onboardingStorage'

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  }
}

export async function syncOnboardingProfile(userId: string): Promise<void> {
  const profile = await onboardingProfileStorage.getValue()
  if (!profile) return

  const { firstName, lastName } = splitName(profile.name)

  const preferences: Record<string, string> = {}
  if (profile.role) preferences.role = profile.role

  await execute(UpdateProfileByUserIdDocument, {
    userId,
    patch: {
      firstName,
      ...(lastName ? { lastName } : {}),
      preferences,
    },
  })

  await onboardingProfileStorage.removeValue()
}
