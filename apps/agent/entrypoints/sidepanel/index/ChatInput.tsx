import { Send, SquareStop } from 'lucide-react'
import type { FC, FormEvent, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chatTypes'

interface ChatInputProps {
  input: string
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  mode: ChatMode
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onStop: () => void
}

export const ChatInput: FC<ChatInputProps> = ({
  input,
  status,
  mode,
  onInputChange,
  onSubmit,
  onStop,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

  return (
    <form
      onSubmit={onSubmit}
      className="relative mt-2 flex w-full items-end gap-2"
    >
      <textarea
        className={cn(
          'field-sizing-content max-h-60 min-h-[42px] flex-1 resize-none overflow-hidden rounded-2xl border border-border/50 bg-muted/50 px-4 py-2.5 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-border focus:border-[var(--accent-orange)]',
        )}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          mode === 'chat' ? 'Ask about this page...' : 'What should I do?'
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
