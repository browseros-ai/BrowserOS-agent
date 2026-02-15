import type { FC, PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { env } from '@/lib/env'
import { sentry } from '@/lib/sentry/sentry'
import {
  INTERCOM_LAUNCHER_HEIGHT,
  INTERCOM_LAUNCHER_WIDTH,
  INTERCOM_MESSENGER_HEIGHT,
  INTERCOM_MESSENGER_WIDTH,
  isIntercomSandboxEvent,
} from './intercom'

export const IntercomProvider: FC<PropsWithChildren> = ({ children }) => {
  const appId = env.VITE_PUBLIC_INTERCOM_APP_ID
  if (!appId) return <>{children}</>

  return <IntercomProviderInner appId={appId}>{children}</IntercomProviderInner>
}

const IntercomProviderInner: FC<PropsWithChildren<{ appId: string }>> = ({
  appId,
  children,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeWindowRef = useRef<Window | null>(null)
  const [isMessengerOpen, setIsMessengerOpen] = useState(false)
  const { sessionInfo, isLoading } = useSessionInfo()

  const handleIframeLoad = () => {
    iframeWindowRef.current = iframeRef.current?.contentWindow ?? null
    try {
      iframeWindowRef.current?.postMessage(
        { type: 'intercom:boot', appId },
        '*',
      )
    } catch (error) {
      sentry.captureException(error, {
        extra: { message: 'Failed to send boot command to Intercom sandbox' },
      })
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!isIntercomSandboxEvent(event.data)) return

      switch (event.data.type) {
        case 'intercom:ready':
          break
        case 'intercom:messenger-opened':
          setIsMessengerOpen(true)
          break
        case 'intercom:messenger-closed':
          setIsMessengerOpen(false)
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    if (isLoading) return

    try {
      if (sessionInfo.user) {
        iframeWindowRef.current?.postMessage(
          {
            type: 'intercom:update',
            userId: sessionInfo.user.id,
            email: sessionInfo.user.email,
            name: sessionInfo.user.name,
          },
          '*',
        )
      } else {
        iframeWindowRef.current?.postMessage({ type: 'intercom:shutdown' }, '*')
      }
    } catch (error) {
      sentry.captureException(error, {
        extra: { message: 'Failed to sync identity with Intercom sandbox' },
      })
    }
  }, [sessionInfo.user, isLoading])

  const width = isMessengerOpen
    ? INTERCOM_MESSENGER_WIDTH
    : INTERCOM_LAUNCHER_WIDTH
  const height = isMessengerOpen
    ? INTERCOM_MESSENGER_HEIGHT
    : INTERCOM_LAUNCHER_HEIGHT

  return (
    <>
      {children}
      <iframe
        ref={iframeRef}
        title="Intercom Messenger"
        src={chrome.runtime.getURL('intercom.html')}
        onLoad={handleIframeLoad}
        allow="microphone"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          border: 'none',
          background: 'transparent',
          width,
          height,
          transition: 'width 0.2s ease, height 0.2s ease',
          pointerEvents: 'auto',
        }}
      />
    </>
  )
}
