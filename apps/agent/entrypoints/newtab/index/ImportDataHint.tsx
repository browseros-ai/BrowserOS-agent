import { Upload, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { importHintDismissedAtStorage } from '@/lib/onboarding/onboardingStorage'

const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000
const LONG_DISMISS_DURATION = 90 * 24 * 60 * 60 * 1000
const importSettingsURL = 'chrome://settings/importData'

export const ImportDataHint = () => {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    importHintDismissedAtStorage.getValue().then((dismissedAt) => {
      if (cancelled) return
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION) return

      timer = setTimeout(() => {
        if (!cancelled) setVisible(true)
      }, 3000)
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const handleDismiss = async () => {
    setDismissed(true)
    const dismissUntil = dontAskAgain
      ? Date.now() + LONG_DISMISS_DURATION - DISMISS_DURATION
      : Date.now()
    await importHintDismissedAtStorage.setValue(dismissUntil)
  }

  const handleImport = () => {
    chrome.tabs.create({ url: importSettingsURL })
    handleDismiss()
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(importSettingsURL)
    toast.success('Copied to clipboard!', { position: 'bottom-center' })
  }

  const show = visible && !dismissed

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-4 left-4 z-50"
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <Card className="w-80 gap-0 py-4">
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">Import your data</CardTitle>
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
                Bring bookmarks, history, and passwords from Chrome.{' '}
                <button
                  type="button"
                  className="cursor-pointer text-[var(--accent-orange)]"
                  onClick={handleCopyUrl}
                >
                  Copy URL
                </button>
              </CardDescription>
              <label
                htmlFor="import-dont-ask-again"
                className="flex items-center gap-2 text-muted-foreground text-sm"
              >
                <Checkbox
                  id="import-dont-ask-again"
                  checked={dontAskAgain}
                  onCheckedChange={(checked) =>
                    setDontAskAgain(checked === true)
                  }
                />
                Don't ask again
              </label>
              <Button className="w-full" onClick={handleImport}>
                <Upload className="size-4" />
                Open Import Settings
              </Button>
            </CardHeader>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
