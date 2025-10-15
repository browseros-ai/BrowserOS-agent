import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LLMProvider } from '../types/llm-settings'

const browserOSLogo =
  typeof chrome !== 'undefined' && chrome?.runtime?.getURL
    ? chrome.runtime.getURL('assets/browseros.svg')
    : 'assets/browseros.svg'

interface BrowserOSPromptEditorProps {
  provider: LLMProvider | undefined
  onSave: (prompt: string) => Promise<void>
}

export function BrowserOSPromptEditor({ provider, onSave }: BrowserOSPromptEditorProps) {
  const [promptValue, setPromptValue] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(true)

  const providerId = provider?.id ?? 'browseros'
  const previousProviderIdRef = useRef<string | null>(null)
  const previousSystemPromptRef = useRef<string | undefined>(undefined)

  // Reset local state whenever provider changes
  useEffect(() => {
    const nextValue = provider?.systemPrompt ?? ''
    setPromptValue(nextValue)
    setErrorMessage(null)

    const providerChanged = previousProviderIdRef.current !== providerId
    const systemPromptChanged = previousSystemPromptRef.current !== provider?.systemPrompt

    if (providerChanged) {
      // Allow editing immediately for brand new provider setups with no saved prompt
      setIsEditing(nextValue.length === 0)
    } else if (systemPromptChanged) {
      // After saving, lock editing UNLESS the prompt is now empty (user clicked reset)
      // Keep user in edit mode when prompt is empty so they can immediately add new content
      setIsEditing(nextValue.length === 0)
    }

    previousProviderIdRef.current = providerId
    previousSystemPromptRef.current = provider?.systemPrompt
  }, [providerId, provider?.systemPrompt])

  const isDirty = useMemo(() => {
    const current = provider?.systemPrompt ?? ''
    return promptValue !== current
  }, [provider?.systemPrompt, promptValue])

  if (!provider) {
    return null
  }

  const handleSave = async () => {
    if (!isDirty || isSaving || !isEditing) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await onSave(promptValue)
      setIsEditing(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save prompt'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (isSaving || !isEditing) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      // Save the empty prompt to storage so it persists across refreshes
      await onSave('')
      setPromptValue('')
      // Keep user in edit mode after reset so they can add new content without clicking "Edit prompt"
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset prompt'
      setErrorMessage(message)
      // Revert to the previous value on error
      setPromptValue(provider?.systemPrompt ?? '')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEnterEditMode = () => {
    setIsEditing(true)
    setErrorMessage(null)
  }

  return (
    <section className="settings-card mb-8">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[16px] font-medium text-foreground mb-1">
              BrowserOS system prompt
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Add optional instructions that run before the built-in BrowserOS guidance.
              These notes are prepended whenever BrowserOS agent mode is active.
            </p>
          </div>
          <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-brand/10 border border-brand/30 overflow-hidden">
            <img
              src={browserOSLogo}
              alt="BrowserOS logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={promptValue}
            readOnly={!isEditing}
            onChange={(event) => setPromptValue(event.target.value)}
            rows={5}
            placeholder="Add optional guardrails, company policies, or tone guidelines for BrowserOS."
            className={`w-full px-4 py-3 rounded-lg border border-input bg-background text-[13px] text-foreground resize-vertical focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all ${isEditing ? '' : 'cursor-not-allowed opacity-80 text-muted-foreground'}`}
            aria-readonly={!isEditing}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="px-4 py-2 text-[13px] font-medium rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save prompt'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={promptValue.length === 0 || isSaving}
                    className="px-4 py-2 text-[13px] font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEnterEditMode}
                  className="px-4 py-2 text-[13px] font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
                >
                  Edit prompt
                </button>
              )}
            </div>

            <span className="text-[12px] text-muted-foreground">
              {promptValue.length} characters
            </span>
          </div>

          {errorMessage && (
            <p className="text-[12px] text-red-600 dark:text-red-400">{errorMessage}</p>
          )}
        </div>
      </div>
    </section>
  )
}
