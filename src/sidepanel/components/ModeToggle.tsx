import React from 'react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

/**
 * ModeToggle - Toggle between Chat Mode (Q&A), Agent Mode (automation), and Teach Mode
 * Inspired by the Write/Chat toggle design
 */
export function ModeToggle() {
  const { appMode, setAppMode } = useSettingsStore()

  return (
    <div className='flex items-center'>
      {/* Use design tokens via CSS variables to auto-adapt across light, gray and dark */}
      <div className='inline-flex h-[25px] items-center gap-[2px] rounded-2xl border border-border bg-[hsl(var(--secondary))] p-[2px]'>
        <button
          className={`h-[21px] px-3 rounded-xl text-[12px] font-semibold transition-colors ${
            appMode === 'chat'
              ? 'bg-[hsl(var(--background-alt))] text-foreground border border-border'
              : 'text-muted-foreground hover:bg-[hsl(var(--accent))]'
          }`}
          onClick={() => setAppMode('chat')}
          aria-label='Chat mode for Q&A'
          title='Chat mode - Simple Q&A about pages'
        >
          Chat Mode
        </button>
        <button
          className={`h-[21px] px-3 rounded-xl text-[12px] font-semibold transition-colors ${
            appMode === 'agent'
              ? 'bg-[hsl(var(--background-alt))] text-foreground border border-border'
              : 'text-muted-foreground hover:bg-[hsl(var(--accent))]'
          }`}
          onClick={() => setAppMode('agent')}
          aria-label='Agent mode for automation'
          title='Agent mode - Complex web navigation tasks'
        >
          Agent Mode
        </button>
        <button
          className={`h-[21px] px-3 rounded-xl text-[12px] font-semibold transition-colors ${
            appMode === 'teach'
              ? 'bg-[hsl(var(--background-alt))] text-foreground border border-border'
              : 'text-muted-foreground hover:bg-[hsl(var(--accent))]'
          }`}
          onClick={() => setAppMode('teach')}
          aria-label='Teach mode for recording workflows'
          title='Teach mode - Record and replay workflows'
        >
          Teach Mode
        </button>
      </div>
    </div>
  )
}