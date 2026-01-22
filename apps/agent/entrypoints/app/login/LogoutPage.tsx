import { Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { signOut } from '@/lib/auth/auth-client'

export const LogoutPage: FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const performLogout = async () => {
      await signOut()
      navigate('/login', { replace: true })
    }

    performLogout()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}
