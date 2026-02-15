import type { IntercomParentMessage } from '../../lib/intercom/intercom'

type IntercomFn = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    Intercom: IntercomFn
    intercomSettings: Record<string, unknown>
  }
}

function sendToParent(message: { type: string }) {
  parent.postMessage(message, '*')
}

function initIntercomStub() {
  const i = ((...args: unknown[]) => {
    i.c(args)
  }) as ((...args: unknown[]) => void) & {
    q: unknown[][]
    c: (args: unknown[]) => void
  }
  i.q = []
  i.c = (args: unknown[]) => {
    i.q.push(args)
  }
  window.Intercom = i as IntercomFn
}

function loadIntercomScript(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://widget.intercom.io/widget/${appId}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Intercom script'))
    document.head.appendChild(script)
  })
}

let booted = false

async function handleBoot(appId: string) {
  if (booted) return
  booted = true

  initIntercomStub()
  await loadIntercomScript(appId)

  window.Intercom('boot', {
    app_id: appId,
    vertical_padding: 0,
    horizontal_padding: 0,
  })

  window.Intercom('onShow', () => {
    sendToParent({ type: 'intercom:messenger-opened' })
  })

  window.Intercom('onHide', () => {
    sendToParent({ type: 'intercom:messenger-closed' })
  })

  sendToParent({ type: 'intercom:ready' })
}

function handleUpdate(userId: string, email: string, name: string) {
  if (!window.Intercom) return
  window.Intercom('update', {
    user_id: userId,
    email,
    name,
  })
}

function handleShutdown() {
  if (!window.Intercom) return
  window.Intercom('shutdown')
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as IntercomParentMessage
  if (
    !data ||
    typeof data.type !== 'string' ||
    !data.type.startsWith('intercom:')
  )
    return

  switch (data.type) {
    case 'intercom:boot':
      handleBoot(data.appId)
      break
    case 'intercom:update':
      handleUpdate(data.userId, data.email, data.name)
      break
    case 'intercom:shutdown':
      handleShutdown()
      break
  }
})
