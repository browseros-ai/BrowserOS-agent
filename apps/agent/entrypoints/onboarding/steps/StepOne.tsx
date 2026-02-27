import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ONBOARDING_ABOUT_SUBMITTED_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { personalizationStorage } from '@/lib/personalization/personalizationStorage'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepOneProps {
  direction: StepDirection
  onContinue: () => void
}

export const StepOne = ({ direction, onContinue }: StepOneProps) => {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [description, setDescription] = useState('')

  const handleContinue = async () => {
    const parts: string[] = []
    if (name.trim()) parts.push(`Name: ${name.trim()}`)
    if (role.trim()) parts.push(`Role: ${role.trim()}`)
    if (company.trim()) parts.push(`Company: ${company.trim()}`)
    if (description.trim()) parts.push(`About: ${description.trim()}`)

    if (parts.length > 0) {
      const markdown = parts.join('\n')
      await personalizationStorage.setValue(markdown)

      track(ONBOARDING_ABOUT_SUBMITTED_EVENT, {
        fields_filled: parts.length,
        has_name: !!name.trim(),
        has_role: !!role.trim(),
        has_company: !!company.trim(),
        has_description: !!description.trim(),
      })
    }

    track(ONBOARDING_STEP_COMPLETED_EVENT, { step: 1, step_name: 'about' })
    onContinue()
  }

  return (
    <StepTransition direction={direction}>
      <div className="flex h-full flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="font-bold text-3xl tracking-tight">
              Tell us about yourself
            </h2>
            <p className="text-base text-muted-foreground">
              Help us personalize your experience
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">Your name</Label>
              <Input
                id="onboarding-name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-role">Your role</Label>
              <Input
                id="onboarding-role"
                placeholder="Product Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-company">Company</Label>
              <Input
                id="onboarding-company"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-description">
                What does a typical day look like for you?
              </Label>
              <Textarea
                id="onboarding-description"
                placeholder="I spend most of my day researching competitors, writing specs, and coordinating with engineering..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <Button
            onClick={handleContinue}
            className="w-full bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
          >
            Continue
          </Button>
        </div>
      </div>
    </StepTransition>
  )
}
