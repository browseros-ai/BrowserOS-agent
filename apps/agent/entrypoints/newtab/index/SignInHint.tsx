import { storage } from '@wxt-dev/storage'
import { Cloud, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSessionInfo } from '@/lib/auth/sessionStorage'

const DISMISS_DURATION = 24 * 60 * 60 * 1000

const signInHintDismissedAtStorage = storage.defineItem<number | null>(
  'local:signInHintDismissedAt',
  { fallback: null },
)

export const SignInHint = () => {
  const { sessionInfo, isLoading } = useSessionInfo()
  const isLoggedIn = !!sessionInfo?.user
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isLoading || isLoggedIn) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    signInHintDismissedAtStorage.getValue().then((dismissedAt) => {
      if (cancelled) return
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION) return

      timer = setTimeout(() => {
        if (!cancelled) setVisible(true)
      }, 2000)
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLoading, isLoggedIn])

  const handleDismiss = async () => {
    setDismissed(true)
    await signInHintDismissedAtStorage.setValue(Date.now())
  }

  const show = visible && !dismissed && !isLoggedIn

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed right-4 bottom-4 z-50"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <Card className="w-80 gap-0 py-4">
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">Sync your data</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={handleDismiss}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <CardDescription>
                Sign in to sync conversation history to the cloud.
              </CardDescription>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </CardHeader>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
