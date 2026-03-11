import { Check, Circle, Loader2 } from 'lucide-react'
import { type FC, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChatFooter } from '@/entrypoints/sidepanel/index/ChatFooter'
import { ChatMessages } from '@/entrypoints/sidepanel/index/ChatMessages'
import type { ChatMode } from '@/entrypoints/sidepanel/index/chatTypes'
import { useChatSessionContext } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import {
  ONBOARDING_CHAT_COMPLETED_EVENT,
  ONBOARDING_CHAT_SKIPPED_EVENT,
  ONBOARDING_CHAT_STARTED_EVENT,
  ONBOARDING_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import {
  onboardingCompletedStorage,
  onboardingProfileStorage,
} from '@/lib/onboarding/onboardingStorage'

interface OnboardingChatProps {
  onComplete: () => void
}

interface OnboardingTask {
  id: string
  label: string
}

const ONBOARDING_TASKS: OnboardingTask[] = [
  { id: 'linkedin', label: 'Find you on LinkedIn' },
  { id: 'gmail', label: 'Read your recent emails' },
  { id: 'soul', label: 'Personalize your assistant' },
  { id: 'schedule', label: 'Set up daily briefing' },
]

interface MessagePart {
  type: string
  toolName?: string
  text?: string
}

const TOOL_TO_TASK: Record<string, string> = {
  get_page_content: 'linkedin',
  take_snapshot: 'linkedin',
  execute_action: 'gmail',
  soul_update: 'soul',
  suggest_schedule: 'schedule',
}

// Detect which onboarding sub-tasks are done by scanning message parts
const detectCompletedTasks = (
  messages: { role: string; parts: MessagePart[] }[],
) => {
  const completed = new Set<string>()

  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const part of message.parts) {
      const taskId = TOOL_TO_TASK[part.toolName ?? '']
      if (part.type === 'tool-invocation' && taskId) completed.add(taskId)
      if (part.type === 'text' && part.text?.toLowerCase().includes('linkedin'))
        completed.add('linkedin')
    }
  }

  return completed
}

export const OnboardingChat: FC<OnboardingChatProps> = ({ onComplete }) => {
  const {
    mode,
    setMode,
    messages,
    sendMessage,
    status,
    stop,
    getActionForMessage,
    liked,
    onClickLike,
    disliked,
    onClickDislike,
  } = useChatSessionContext()

  const [input, setInput] = useState('')
  const [attachedTabs, setAttachedTabs] = useState<chrome.tabs.Tab[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasAutoSent = useRef(false)

  // Auto-send the onboarding message on mount
  useEffect(() => {
    if (hasAutoSent.current) return
    hasAutoSent.current = true

    const autoSend = async () => {
      const profile = await onboardingProfileStorage.getValue()
      const name = profile?.name || 'there'
      const role = profile?.role || 'user'

      track(ONBOARDING_CHAT_STARTED_EVENT)
      sendMessage({
        text: `I just installed BrowserOS. My name is ${name} and I'm a ${role}. Help me get set up!`,
      })
    }
    autoSend()
  }, [sendMessage])

  // Auto-scroll on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const completedTasks = detectCompletedTasks(
    messages as { role: string; parts: MessagePart[] }[],
  )

  const handleComplete = async () => {
    track(ONBOARDING_CHAT_COMPLETED_EVENT)
    track(ONBOARDING_COMPLETED_EVENT)
    await onboardingCompletedStorage.setValue(true)
    onComplete()
  }

  const handleSkip = async () => {
    stop()
    track(ONBOARDING_CHAT_SKIPPED_EVENT)
    track(ONBOARDING_COMPLETED_EVENT)
    await onboardingCompletedStorage.setValue(true)
    onComplete()
  }

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode)
  }

  const handleStop = () => {
    stop()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    sendMessage({ text })
    setInput('')
  }

  const toggleTabSelection = (tab: chrome.tabs.Tab) => {
    setAttachedTabs((prev) =>
      prev.some((t) => t.id === tab.id)
        ? prev.filter((t) => t.id !== tab.id)
        : [...prev, tab],
    )
  }

  const removeTab = (tabId?: number) => {
    setAttachedTabs((prev) => prev.filter((t) => t.id !== tabId))
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Progress indicators */}
      <div className="border-border/40 border-b px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          {ONBOARDING_TASKS.map((task) => {
            const isDone = completedTasks.has(task.id)
            return (
              <div key={task.id} className="flex items-center gap-1.5">
                {isDone ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground/40" />
                )}
                <span
                  className={`text-xs ${isDone ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {task.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat messages */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-4 overflow-y-auto px-4 pt-4">
        {messages.length === 0 && status !== 'streaming' ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            status={status}
            messagesEndRef={messagesEndRef}
            getActionForMessage={getActionForMessage}
            liked={liked}
            onClickLike={onClickLike}
            disliked={disliked}
            onClickDislike={onClickDislike}
            showJtbdPopup={false}
            showDontShowAgain={false}
            onTakeSurvey={() => {}}
            onDismissJtbdPopup={() => {}}
          />
        )}
      </main>

      {/* Chat input */}
      <div className="mx-auto w-full max-w-3xl px-4">
        <ChatFooter
          mode={mode}
          onModeChange={handleModeChange}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          status={status}
          onStop={handleStop}
          attachedTabs={attachedTabs}
          onToggleTab={toggleTabSelection}
          onRemoveTab={removeTab}
        />
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3 pt-2 pb-4">
        <Button variant="outline" size="sm" onClick={handleComplete}>
          Finish Setup
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground"
        >
          Skip to Home
        </Button>
      </div>
    </div>
  )
}
