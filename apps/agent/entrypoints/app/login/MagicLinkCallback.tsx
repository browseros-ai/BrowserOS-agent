import { AlertCircle, Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/lib/auth/auth-client'
import { authRedirectPathStorage } from '@/lib/onboarding/onboardingStorage'

export const MagicLinkCallback: FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: session, isPending } = useSession()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      return
    }

    if (isPending || !session) return

    const redirectAfterAuth = async () => {
      const redirectPath = await authRedirectPathStorage.getValue()
      if (redirectPath) {
        await authRedirectPathStorage.removeValue()
      }
      if (cancelled) return
      navigate(redirectPath || '/home', { replace: true })
    }

    void redirectAfterAuth()
    return () => {
      cancelled = true
    }
  }, [session, isPending, searchParams, navigate])

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>We couldn't verify your magic link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Verifying your link</CardTitle>
        <CardDescription>Please wait while we sign you in...</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}
