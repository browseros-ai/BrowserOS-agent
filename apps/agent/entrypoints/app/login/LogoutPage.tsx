import { useQueryClient } from '@tanstack/react-query'
import localforage from 'localforage'
import { Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '@/lib/auth/auth-client'
import { providersStorage } from '@/lib/llm-providers/storage'
import { scheduledJobStorage } from '@/lib/schedules/scheduleStorage'

export const LogoutPage: FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // biome-ignore lint/correctness/useExhaustiveDependencies: must run only once to ensure the logout process happens successfully
  useEffect(() => {
    const performLogout = async () => {
      await providersStorage.removeValue()
      await scheduledJobStorage.removeValue()
      queryClient.clear()
      await localforage.clear()

      await signOut()
      navigate('/login', { replace: true })
    }

    performLogout()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}
