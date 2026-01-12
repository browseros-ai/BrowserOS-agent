import { Send, SquareStop } from 'lucide-react'
import type { FC, FormEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TabMentionPopover } from '@/components/elements/tab-mention-popover'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chatTypes'

interface MentionState {
  isOpen: boolean
  filterText: string
  startPosition: number
}

interface ChatInputProps {
  input: string
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  mode: ChatMode
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onStop: () => void
  selectedTabs: chrome.tabs.Tab[]
  onToggleTab: (tab: chrome.tabs.Tab) => void
}

export const ChatInput: FC<ChatInputProps> = ({
  input,
  status,
  mode,
  onInputChange,
  onSubmit,
  onStop,
  selectedTabs,
  onToggleTab,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionState, setMentionState] = useState<MentionState>({
    isOpen: false,
    filterText: '',
    startPosition: 0,
  })

  const closeMention = useCallback(() => {
    if (mentionState.isOpen) {
      const beforeMention = input.slice(0, mentionState.startPosition)
      const afterMention = input.slice(
        mentionState.startPosition + 1 + mentionState.filterText.length,
      )
      onInputChange(beforeMention + afterMention)
      setMentionState({ isOpen: false, filterText: '', startPosition: 0 })

      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        const newPosition = beforeMention.length
        textareaRef.current?.setSelectionRange(newPosition, newPosition)
      })
    }
  }, [mentionState, input, onInputChange])

  const handleInputChange = (value: string) => {
    const textarea = textareaRef.current
    const cursorPosition = textarea?.selectionStart ?? value.length

    if (mentionState.isOpen) {
      const textAfterAt = value.slice(mentionState.startPosition + 1)
      const spaceIndex = textAfterAt.search(/\s/)
      const filterText =
        spaceIndex === -1 ? textAfterAt : textAfterAt.slice(0, spaceIndex)

      if (
        cursorPosition <= mentionState.startPosition ||
        value[mentionState.startPosition] !== '@'
      ) {
        setMentionState({ isOpen: false, filterText: '', startPosition: 0 })
      } else {
        setMentionState((prev) => ({ ...prev, filterText }))
      }
    } else {
      const charBeforeCursor = value[cursorPosition - 1]
      const charTwoBeforeCursor = value[cursorPosition - 2]

      if (charBeforeCursor === '@' && charTwoBeforeCursor !== '@') {
        const charBeforeAt = value[cursorPosition - 2]
        if (
          cursorPosition === 1 ||
          charBeforeAt === ' ' ||
          charBeforeAt === '\n' ||
          charBeforeAt === undefined
        ) {
          setMentionState({
            isOpen: true,
            filterText: '',
            startPosition: cursorPosition - 1,
          })
        }
      }
    }

    onInputChange(value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.isOpen) {
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        e.key === 'Enter' ||
        e.key === 'Escape'
      ) {
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        closeMention()
        return
      }
    }

    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault()
      if (input.trim()) {
        e.currentTarget.form?.requestSubmit()
      }
    }
  }

  useEffect(() => {
    if (!mentionState.isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        !textareaRef.current?.contains(target) &&
        !target.closest('[data-slot="popover-content"]')
      ) {
        closeMention()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mentionState.isOpen, closeMention])

  return (
    <form
      onSubmit={onSubmit}
      className="relative mt-2 flex w-full items-end gap-2"
    >
      <TabMentionPopover
        isOpen={mentionState.isOpen}
        filterText={mentionState.filterText}
        selectedTabs={selectedTabs}
        onToggleTab={onToggleTab}
        onClose={closeMention}
        anchorRef={textareaRef}
      />
      <textarea
        ref={textareaRef}
        className={cn(
          'field-sizing-content max-h-60 min-h-[42px] flex-1 resize-none overflow-hidden rounded-2xl border border-border/50 bg-muted/50 px-4 py-2.5 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border focus:border-[var(--accent-orange)]',
        )}
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          mode === 'chat'
            ? 'Ask about this page... (@ to mention tabs)'
            : 'What should I do? (@ to mention tabs)'
        }
        rows={1}
      />
      {status === 'streaming' ? (
        <button
          type="button"
          onClick={onStop}
          className="absolute right-1.5 bottom-1.5 cursor-pointer rounded-full bg-red-600 p-2 text-white shadow-sm transition-all duration-200 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SquareStop className="h-3.5 w-3.5" />
          <span className="sr-only">Stop</span>
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim()}
          className="absolute right-1.5 bottom-1.5 cursor-pointer rounded-full bg-[var(--accent-orange)] p-2 text-white shadow-sm transition-all duration-200 hover:bg-[var(--accent-orange-bright)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="sr-only">Send</span>
        </button>
      )}
    </form>
  )
}
