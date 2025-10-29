import React, { useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { PortPrefix } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

interface ParsedPlan { name?: string; goal: string; steps: string[] }

interface PlanGeneratorProps {
  className?: string
  onReplacePlan?: (plan: ParsedPlan) => void
  onAppendSteps?: (steps: string[]) => void
  getCurrentPlan?: () => ParsedPlan | null
  refreshKey?: number
}

export function PlanGenerator ({
  className,
  onReplacePlan,
  onAppendSteps,
  getCurrentPlan,
  refreshKey
}: PlanGeneratorProps) {
  const [inputText, setInputText] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [aiSteps, setAiSteps] = useState<string[] | null>(null)
  const [aiGoal, setAiGoal] = useState<string>('')
  const [aiName, setAiName] = useState<string>('')
  const [aiStatus, setAiStatus] = useState<string>('')
  const [aiError, setAiError] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when opened
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  const currentPlan = getCurrentPlan ? getCurrentPlan() : null

  // --- AI Integration ---
  const sendPortMessage = (message: { type: MessageType, payload: any }, onMessage: (m: any) => void): void => {
    try {
      const port = chrome.runtime.connect({ name: PortPrefix.NEWTAB })
      const id = crypto.randomUUID()
      const handler = (msg: any): void => {
        if (msg?.type === MessageType.PLAN_GENERATION_UPDATE && msg?.id === id) {
          onMessage(msg)
        }
      }
      port.onMessage.addListener(handler)
      port.postMessage({ ...message, id })
      // Auto-disconnect after completion or timeout
      setTimeout(() => {
        try { port.onMessage.removeListener(handler); port.disconnect() } catch (_) {}
      }, 30_000)  // Increased timeout for plan generation which can take longer
    } catch (e) {
      setAiError('Failed to connect to background')
      setIsGenerating(false)
    }
  }

  const aiGeneratePlan = (): void => {
    setIsGenerating(true)
    setAiStatus('Starting…')
    setAiError('')
    setAiSteps(null)
    setAiGoal('')
    setAiName('')

    const currentGoal = currentPlan?.goal || ''
    const currentSteps = currentPlan?.steps || []
    const hasPlan = !!(currentGoal || currentSteps.length > 0)

    if (hasPlan && inputText.trim()) {
      // Refine existing plan with feedback
      sendPortMessage({
        type: MessageType.REFINE_PLAN,
        payload: {
          currentPlan: { goal: currentGoal, steps: currentSteps },
          feedback: inputText.trim()
        }
      }, (msg) => {
        const status = msg?.payload?.status
        const steps = msg?.payload?.plan?.steps as string[] | undefined
        const goal = msg?.payload?.plan?.goal as string | undefined
        const name = msg?.payload?.plan?.name as string | undefined
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
          setAiGoal(goal || '')
          setAiName(name || '')
          setIsGenerating(false)
        }
        if (status === 'error') {
          setIsGenerating(false)
          setAiError(err || 'Refinement failed')
        }
      })
    } else if (hasPlan && !inputText.trim()) {
      // Regenerate plan based on existing goal
      const goalToUse = currentGoal || 'Improve this plan'
      sendPortMessage({
        type: MessageType.GENERATE_PLAN,
        payload: { 
          input: goalToUse,
          context: currentSteps.length > 0 ? `Current steps:\n${currentSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : undefined
        }
      }, (msg) => {
        const status = msg?.payload?.status
        const steps = msg?.payload?.plan?.steps as string[] | undefined
        const goal = msg?.payload?.plan?.goal as string | undefined
        const name = msg?.payload?.plan?.name as string | undefined
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
          setAiGoal(goal || '')
          setAiName(name || '')
          setIsGenerating(false)
        }
        if (status === 'error') {
          setIsGenerating(false)
          setAiError(err || 'Generation failed')
        }
      })
    } else {
      // Generate new plan from input text or current goal
      const goalText = currentGoal || inputText.trim()
      if (!goalText) {
        setIsGenerating(false)
        setAiError('Please enter a goal to generate a plan')
        return
      }
      sendPortMessage({
        type: MessageType.GENERATE_PLAN,
        payload: { input: goalText }
      }, (msg) => {
        const status = msg?.payload?.status
        const steps = msg?.payload?.plan?.steps as string[] | undefined
        const goal = msg?.payload?.plan?.goal as string | undefined
        const name = msg?.payload?.plan?.name as string | undefined
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
          setAiGoal(goal || '')
          setAiName(name || '')
          setIsGenerating(false)
        }
        if (status === 'error') {
          setIsGenerating(false)
          setAiError(err || 'Generation failed')
        }
      })
    }
  }

  return (
    <div className={"h-full flex flex-col bg-background-alt " + (className || '')}>
      {/* Header */}
      <div className="border-b border-border">
        <div className="flex items-center">
          <div className="flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground bg-background relative">
            <Hammer className="w-4 h-4" />
            Agent generator
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {currentPlan && (currentPlan.goal || currentPlan.steps.length > 0) && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">CURRENT PLAN</div>
                {currentPlan.goal && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Goal</div>
                    <div className="text-sm font-medium">{currentPlan.goal}</div>
                  </div>
                )}
                {currentPlan.steps.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Steps</div>
                    <ol className="list-decimal list-inside space-y-1">
                      {currentPlan.steps.map((step, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {aiSteps && (
              <div className="rounded-lg border border-primary/50 bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-primary">AI GENERATED PLAN</div>
                  <div className="text-xs text-muted-foreground">{aiStatus}</div>
                </div>
                {(aiName || aiGoal) && (
                  <div className="mb-3">
                    {aiName && (
                      <div className="mb-1">
                        <div className="text-xs font-medium text-muted-foreground">Name</div>
                        <div className="text-sm font-medium">{aiName}</div>
                      </div>
                    )}
                    {aiGoal && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Goal</div>
                        <div className="text-sm text-foreground">{aiGoal}</div>
                      </div>
                    )}
                  </div>
                )}
                <ol className="list-decimal list-inside space-y-1 mb-4">
                  {aiSteps.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">{s}</li>
                  ))}
                </ol>
                <div className="flex gap-2">
                  {(aiName || aiGoal) && (
                    <button
                      className="flex-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        if (onReplacePlan) {
                          onReplacePlan({ name: aiName, goal: aiGoal || (currentPlan?.goal || ''), steps: aiSteps || [] })
                        }
                        setAiSteps(null)
                        setAiGoal('')
                        setAiName('')
                        setInputText('')
                      }}
                    >
                      Replace All
                    </button>
                  )}
                  <button
                    className="flex-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => {
                      if (onReplacePlan) {
                        const goal = currentPlan?.goal || ''
                        onReplacePlan({ goal, steps: aiSteps || [] })
                      }
                      setAiSteps(null)
                      setAiGoal('')
                      setAiName('')
                      setInputText('')
                    }}
                  >
                    Replace Steps
                  </button>
                  <button
                    className="flex-1 px-3 py-1.5 text-sm rounded-md bg-muted text-foreground hover:bg-muted/80"
                    onClick={() => {
                      if (onAppendSteps) {
                        onAppendSteps(aiSteps)
                      }
                      setAiSteps(null)
                      setAiGoal('')
                      setAiName('')
                      setInputText('')
                    }}
                  >
                    Append Steps
                  </button>
                </div>
              </div>
            )}

            {aiError && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md p-3">
                {aiError}
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <div className="space-y-3">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={currentPlan?.goal ? "Describe how to improve this plan..." : "Describe what you want the agent to do..."}
              className="w-full min-h-[80px] max-h-40 resize-none px-4 py-3 text-sm border-2 border-[hsl(var(--brand))]/30 rounded-lg bg-background/80 backdrop-blur-sm placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--brand))]/60 hover:border-[hsl(var(--brand))]/50 hover:bg-background/90 transition-all duration-300 ease-out"
              onKeyDown={() => {}}
            />
            <button
              onClick={aiGeneratePlan}
              disabled={isGenerating || (!inputText.trim() && !currentPlan?.goal)}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[hsl(var(--brand))]/30 hover:border-[hsl(var(--brand))]/50"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span>
                  {currentPlan?.goal && inputText.trim() ? 'Refining Plan...' : 'Generating Plan...'}
                </span>
              ) : (
                currentPlan?.goal && inputText.trim() ? 'Refine Plan with AI' : currentPlan?.goal ? 'Regenerate Plan' : 'Build Agent with AI'
              )}
            </button>
            {/* Removed keyboard shortcut hint */}
          </div>
        </div>
      </div>
    </div>
  )
}
