import { zodResolver } from '@hookform/resolvers/zod'
import {
  BriefcaseBusiness,
  Check,
  ChevronsUpDown,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
import { onboardingProfileStorage } from '@/lib/onboarding/onboardingStorage'
import { personalizationStorage } from '@/lib/personalization/personalizationStorage'
import { cn } from '@/lib/utils'
import { StepScaffold } from './StepScaffold'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepOneProps {
  direction: StepDirection
  onContinue: () => void
}

const roles = [
  'Founder / Co-Founder',
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Data Engineer',
  'ML Engineer',
  'Tech Lead',
  'CTO',
  'Product Manager',
  'Product Designer',
  'Researcher',
  'Growth / Marketing',
  'Sales',
  'Operations',
]

const formSchema = z.object({
  name: z.string().min(1, 'Tell us what to call you'),
  role: z.string().min(1, 'Role is required'),
  company: z.string().optional(),
  description: z.string().min(1, 'Tell us a bit about your work'),
  assistantName: z.string().min(1, 'Give your BrowserOS agent a name'),
})

type FormValues = z.infer<typeof formSchema>

export const StepOne = ({ direction, onContinue }: StepOneProps) => {
  const [roleOpen, setRoleOpen] = useState(false)
  const [roleSearch, setRoleSearch] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      role: '',
      company: '',
      description: '',
      assistantName: 'BrowserOS',
    },
  })

  useEffect(() => {
    onboardingProfileStorage.getValue().then((profile) => {
      if (!profile) return
      form.reset({
        name: profile.name,
        role: profile.role,
        company: profile.company ?? '',
        description: profile.description ?? '',
        assistantName: profile.assistantName ?? 'BrowserOS',
      })
    })
  }, [form])

  const handleSubmit = async (values: FormValues) => {
    const name = values.name.trim()
    const role = values.role.trim()
    const company = values.company?.trim() || undefined
    const description = values.description.trim()
    const assistantName = values.assistantName.trim()
    const existingProfile = await onboardingProfileStorage.getValue()

    await onboardingProfileStorage.setValue({
      ...existingProfile,
      name,
      role,
      company,
      description,
      assistantName,
    })

    const parts: string[] = []
    parts.push(`Call the user: ${name}`)
    parts.push(`Role: ${role}`)
    if (company) parts.push(`Company: ${company}`)
    parts.push(`What they do: ${description}`)
    parts.push(`Preferred assistant name: ${assistantName}`)
    await personalizationStorage.setValue(parts.join('\n'))

    track(ONBOARDING_ABOUT_SUBMITTED_EVENT, {
      fields_filled: parts.length,
      has_company: !!company,
      has_description: true,
      role,
      assistant_name: assistantName,
    })
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 1,
      step_name: 'about_you',
    })
    onContinue()
  }

  return (
    <StepTransition direction={direction}>
      <StepScaffold
        badge="Step 1"
        title="Start with who you are"
        description="Give BrowserOS just enough context to make the first conversation feel personal instead of generic."
        aside={
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge
                variant="secondary"
                className="rounded-full bg-background px-3 py-1"
              >
                First-run context
              </Badge>
              <div className="space-y-2">
                <h3 className="font-medium text-lg">What BrowserOS will do</h3>
                <p className="text-muted-foreground text-sm leading-6">
                  Use your intro to personalize the launch prompt, shape your
                  first `SOUL.md` update, and suggest useful skills or recurring
                  tasks.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">You</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  Name, role, company, and the kind of work you want help with.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">Your agent</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  Pick the name BrowserOS should use when it introduces itself
                  in the first chat.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">What comes next</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  Chrome import, Google setup, LinkedIn-aware launch, then a
                  BrowserOS chat that can ask to learn more from Gmail and
                  Calendar.
                </p>
              </div>
            </div>
          </div>
        }
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should I call you?</FormLabel>
                    <FormControl>
                      <Input placeholder="Nithin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assistantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should I be called?</FormLabel>
                    <FormControl>
                      <Input placeholder="BrowserOS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What do you do?</FormLabel>
                    <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            {field.value || (
                              <span className="text-muted-foreground">
                                Select or type your role
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="p-0"
                        style={{
                          width: 'var(--radix-popover-trigger-width)',
                        }}
                      >
                        <Command>
                          <CommandInput
                            placeholder="Search roles..."
                            value={roleSearch}
                            onValueChange={setRoleSearch}
                          />
                          <CommandList>
                            <CommandEmpty className="p-0" />
                            <CommandGroup>
                              {roleSearch.trim() &&
                                !roles.some(
                                  (role) =>
                                    role.toLowerCase() ===
                                    roleSearch.trim().toLowerCase(),
                                ) && (
                                  <CommandItem
                                    value={roleSearch.trim()}
                                    onSelect={() => {
                                      field.onChange(roleSearch.trim())
                                      setRoleOpen(false)
                                      setRoleSearch('')
                                    }}
                                  >
                                    <Check className="size-4 opacity-0" />
                                    {roleSearch.trim()}
                                  </CommandItem>
                                )}
                              {roles.map((role) => (
                                <CommandItem
                                  key={role}
                                  value={role}
                                  onSelect={(selected) => {
                                    field.onChange(selected)
                                    setRoleOpen(false)
                                    setRoleSearch('')
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 size-4',
                                      role === field.value
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                  {role}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Where do you work? (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="BrowserOS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    What does your work look like day to day?
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="I'm a founder shipping product, talking to users, and living inside Gmail, Calendar, docs, and LinkedIn."
                      className="min-h-36 resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-6">
              <p className="max-w-md text-muted-foreground text-sm leading-6">
                This stays local until you choose to sign in. After that,
                BrowserOS can sync the basic profile and use it to make chat,
                skills, and schedules feel more relevant.
              </p>
              <Button
                type="submit"
                size="lg"
                className="min-w-40 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              >
                Continue
              </Button>
            </div>
          </form>
        </Form>
      </StepScaffold>
    </StepTransition>
  )
}
