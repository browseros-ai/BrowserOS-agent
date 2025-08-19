import React, { useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { PortName } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

interface ParsedPlan { goal: string; steps: string[] }

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
      const port = chrome.runtime.connect({ name: PortName.NEWTAB_TO_BACKGROUND })
      const id = crypto.randomUUID()
      const handler = (msg: any): void => {
        if (msg?.type === MessageType.PLAN_GENERATION_UPDATE && msg?.id === id) {
          onMessage(msg)
        }
      }
      port.onMessage.addListener(handler)
      port.postMessage({ ...message, id })
      // Auto-disconnect shortly after last update in onMessage
      setTimeout(() => {
        try { port.onMessage.removeListener(handler); port.disconnect() } catch (_) {}
      }, 10_000)
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
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
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
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
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
        const err = msg?.payload?.error as string | undefined
        if (status === 'started' || status === 'thinking') setAiStatus(msg.payload.content || status)
        if (status === 'done') {
          setAiStatus('Done')
          setAiSteps(steps || [])
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
            Plan Generator
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
                <ol className="list-decimal list-inside space-y-1 mb-4">
                  {aiSteps.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">{s}</li>
                  ))}
                </ol>
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      if (onReplacePlan) {
                        const goal = currentPlan?.goal || ''
                        onReplacePlan({ goal, steps: aiSteps || [] })
                      }
                      setAiSteps(null)
                      setInputText('')
                    }}
                  >
                    Replace Plan
                  </button>
                  <button
                    className="flex-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => {
                      if (onAppendSteps) {
                        onAppendSteps(aiSteps)
                      }
                      setAiSteps(null)
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
              className="w-full min-h-[80px] max-h-40 resize-none px-4 py-3 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              onKeyDown={() => {}}
            />
            <button
              onClick={aiGeneratePlan}
              disabled={isGenerating || (!inputText.trim() && !currentPlan?.goal)}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span>
                  {currentPlan?.goal && inputText.trim() ? 'Refining Plan...' : 'Generating Plan...'}
                </span>
              ) : (
                currentPlan?.goal && inputText.trim() ? 'Refine Plan with AI' : currentPlan?.goal ? 'Regenerate Plan' : 'Generate Plan with AI'
              )}
            </button>
            {/* Removed keyboard shortcut hint */}
          </div>
        </div>
      </div>
    </div>
  )
}

