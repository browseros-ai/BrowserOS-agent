import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { signIn } from '@/lib/auth/auth-client'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import {
  ONBOARDING_SIGNIN_COMPLETED_EVENT,
  ONBOARDING_SIGNIN_SKIPPED_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import {
  authRedirectPathStorage,
  signInHintDismissedAtStorage,
} from '@/lib/onboarding/onboardingStorage'
import { useGetUserMCPIntegrations } from '../../app/connect-mcp/useGetUserMCPIntegrations'
import { ManagedAppConnectionCard } from './ManagedAppConnectionCard'
import { StepScaffold } from './StepScaffold'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepTwoProps {
  direction: StepDirection
  onContinue: () => void
}

export const StepTwo = ({ direction, onContinue }: StepTwoProps) => {
  const { sessionInfo } = useSessionInfo()
  const { data: integrations } = useGetUserMCPIntegrations()
  const [state, setState] = useState<'idle' | 'loading' | 'local-only'>('idle')
  const [error, setError] = useState<string | null>(null)

  const isSignedIn = !!sessionInfo?.user

  const connectedApps = useMemo(() => {
    const items = integrations?.integrations ?? []
    return {
      gmail:
        items.find((integration) => integration.name === 'Gmail')
          ?.is_authenticated ?? false,
      calendar:
        items.find((integration) => integration.name === 'Google Calendar')
          ?.is_authenticated ?? false,
    }
  }, [integrations])

  const handleGoogleSignIn = async () => {
    setState('loading')
    setError(null)

    try {
      await authRedirectPathStorage.setValue('/onboarding/steps/3')
      track(ONBOARDING_SIGNIN_COMPLETED_EVENT, { method: 'google' })
      await signIn.social({
        provider: 'google',
        callbackURL: '/home',
      })
    } catch (err) {
      setState('idle')
      setError(
        err instanceof Error ? err.message : 'Failed to sign in with Google',
      )
    }
  }

  const handleLocalOnly = async () => {
    setState('local-only')
    setError(null)
    track(ONBOARDING_SIGNIN_SKIPPED_EVENT)
    await signInHintDismissedAtStorage.setValue(
      Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
    )
  }

  const handleContinue = async () => {
    await signInHintDismissedAtStorage.setValue(
      Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
    )
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 3,
      step_name: 'connect_google',
      signed_in: isSignedIn,
      gmail_connected: connectedApps.gmail,
      calendar_connected: connectedApps.calendar,
      local_only: state === 'local-only',
    })
    onContinue()
  }

  const canContinue = isSignedIn || state === 'local-only'

  return (
    <StepTransition direction={direction}>
      <StepScaffold
        badge="Step 3"
        title="Connect the Google layer"
        description="Sign in to BrowserOS, then connect Gmail and Google Calendar so the first chat can ask for the right context instead of guessing."
        aside={
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge
                variant="secondary"
                className="rounded-full bg-background px-3 py-1"
              >
                Why this matters
              </Badge>
              <p className="text-muted-foreground text-sm leading-6">
                Strawberry's best move is earning context before the first ask.
                This step gives BrowserOS the same setup path without hiding the
                user's consent.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'BrowserOS account',
                  description:
                    'Sync chat history, providers, schedules, and onboarding profile across devices.',
                },
                {
                  icon: Mail,
                  title: 'Gmail',
                  description:
                    'Lets the agent ask to inspect recent inbox threads when you want it to know your work better.',
                },
                {
                  icon: CalendarDays,
                  title: 'Google Calendar',
                  description:
                    'Gives BrowserOS the option to understand your upcoming week and schedule recurring automation.',
                },
              ].map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/70 bg-background/80 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[var(--accent-orange)]" />
                    <p className="font-medium text-sm">{title}</p>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-[28px] border border-border/70 bg-muted/35 p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">BrowserOS sign-in</p>
                </div>
                <h3 className="font-semibold text-xl">
                  {isSignedIn
                    ? `Signed in as ${sessionInfo.user?.email ?? 'your account'}`
                    : 'Use Google to unlock cloud sync and app connections'}
                </h3>
                <p className="max-w-2xl text-muted-foreground leading-7">
                  This is the foundation for connected apps and a richer launch
                  conversation. If you prefer, you can stay local and connect
                  everything later.
                </p>
              </div>

              {isSignedIn ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-700 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected
                </div>
              ) : null}
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isSignedIn ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
                  onClick={handleGoogleSignIn}
                  disabled={state === 'loading'}
                >
                  {state === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={handleLocalOnly}
                  disabled={state === 'loading'}
                >
                  Keep this local for now
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                You can go ahead and connect Gmail and Google Calendar below.
              </p>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ManagedAppConnectionCard
              appName="Gmail"
              description="Read and search recent email once you explicitly approve it."
              Icon={Mail}
              disabled={!isSignedIn}
              disabledReason="Sign in to BrowserOS first so Gmail can be connected to your account."
            />
            <ManagedAppConnectionCard
              appName="Google Calendar"
              description="Read upcoming events and help BrowserOS schedule work around them."
              Icon={CalendarDays}
              disabled={!isSignedIn}
              disabledReason="Sign in to BrowserOS first so Calendar can be connected to your account."
            />
          </div>

          {state === 'local-only' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You can finish onboarding locally. BrowserOS will still explain
                soul, skills, BYO keys, and schedules, and you can connect apps
                later from settings.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-6">
            <p className="max-w-xl text-muted-foreground text-sm leading-6">
              {isSignedIn
                ? `Connected now: ${connectedApps.gmail ? 'Gmail' : 'Gmail pending'}, ${connectedApps.calendar ? 'Google Calendar' : 'Google Calendar pending'}.`
                : 'Sign in for the full connected-apps path, or continue locally and wire these in later.'}
            </p>
            <Button
              type="button"
              size="lg"
              className="min-w-40 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              onClick={handleContinue}
              disabled={!canContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </StepScaffold>
    </StepTransition>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" role="img" aria-label="Google">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
