import { Lightbulb, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FC, useEffect, useMemo, useState } from 'react'
import { NEWTAB_TIP_DISMISSED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { dismissTip, getRandomTip, shouldShowTip } from './tips'

export const NewTabTip: FC = () => {
  const [visible, setVisible] = useState(true)
  const tip = useMemo(() => getRandomTip(), [])

  useEffect(() => {
    if (!shouldShowTip()) return
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    dismissTip()
    track(NEWTAB_TIP_DISMISSED_EVENT, { tip_id: tip.id })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="group flex max-w-lg items-center gap-2.5 rounded-lg border border-border/50 px-3.5 py-2">
            <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent-orange)]" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="font-semibold text-[var(--accent-orange)]">
                Tip:
              </span>{' '}
              {tip.text}
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-sm p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:text-muted-foreground group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
