import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  ONBOARDING_ABOUT_SUBMITTED_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { personalizationStorage } from '@/lib/personalization/personalizationStorage'
import { cn } from '@/lib/utils'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepOneProps {
  direction: StepDirection
  onContinue: () => void
}

const roles = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Data Engineer',
  'ML Engineer',
  'Engineering Manager',
  'Tech Lead',
  'CTO',
  'VP of Engineering',
  'Product Manager',
  'Product Designer',
  'UX Researcher',
  'QA Engineer',
  'Solutions Architect',
  'Developer Advocate',
  'Data Scientist',
  'Founder / Co-Founder',
  'CEO',
  'COO',
  'Growth / Marketing',
  'Sales Engineer',
  'Customer Success',
]

export const StepOne = ({ direction, onContinue }: StepOneProps) => {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [description, setDescription] = useState('')
  const [roleOpen, setRoleOpen] = useState(false)

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
                placeholder="What should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Your role</Label>
              <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    {role || (
                      <span className="text-muted-foreground">
                        Select or type a role
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0"
                  style={{ width: 'var(--radix-popover-trigger-width)' }}
                >
                  <Command>
                    <CommandInput placeholder="Search roles..." />
                    <CommandList>
                      <CommandEmpty>
                        <button
                          type="button"
                          className="cursor-pointer text-muted-foreground text-sm"
                          onClick={() => {
                            const input =
                              document.querySelector<HTMLInputElement>(
                                '[data-slot="command-input"]',
                              )
                            if (input?.value) {
                              setRole(input.value)
                              setRoleOpen(false)
                            }
                          }}
                        >
                          Use custom role
                        </button>
                      </CommandEmpty>
                      <CommandGroup>
                        {roles.map((r) => (
                          <CommandItem
                            key={r}
                            value={r}
                            onSelect={(value) => {
                              setRole(value === role ? '' : value)
                              setRoleOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'size-4',
                                role === r ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {r}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                rows={4}
                className="field-sizing-fixed"
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
