import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  AlertCircle,
  Brain,
  FileText,
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  X,
} from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownDocument } from '@/components/elements/markdown-document'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCoreMemory } from './useCoreMemory'

dayjs.extend(relativeTime)

const EMPTY_STATE_ITEMS = [
  'Your name, role, and working context',
  'Long-lived project details or constraints',
  'Preferences the agent should consistently remember',
]

export const CoreMemoryPage: FC = () => {
  const { memory, isLoading, error, refetch, saveMemory, isSaving } =
    useCoreMemory()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!isEditing) {
      setDraft(memory?.content ?? '')
    }
  }, [memory?.content, isEditing])

  const currentContent = memory?.content ?? ''
  const hasContent = currentContent.trim().length > 0
  const hasUnsavedChanges = draft !== currentContent
  const updatedLabel = memory?.updatedAt
    ? `Updated ${dayjs(memory.updatedAt).fromNow()}`
    : memory?.exists
      ? 'Saved locally'
      : 'Not created yet'

  const handleEdit = () => {
    setDraft(currentContent)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setDraft(currentContent)
    setIsEditing(false)
  }

  const handleSave = async () => {
    try {
      await saveMemory(draft)
      toast.success('Core memory saved')
      setIsEditing(false)
    } catch {
      toast.error('Failed to save core memory')
    }
  }

  return (
    <main className="mt-4 flex h-full flex-1 flex-col overflow-y-auto">
      <div className="fade-in slide-in-from-bottom-2 flex w-full flex-1 animate-in flex-col gap-4 p-3 duration-300">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 shadow-sm">
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/12 text-[var(--accent-orange)]">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Core Memory</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    Durable facts the agent should retain across sessions.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
                  CORE.md
                </span>
                <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
                  Markdown supported
                </span>
                <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
                  {updatedLabel}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="size-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    <RefreshCw className="size-4" />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={handleEdit} disabled={isLoading}>
                    <PencilLine className="size-4" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="font-medium text-destructive text-sm">
                    Could not load core memory
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs leading-5">
                    Make sure the BrowserOS server is running and supports the
                    memory API.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="size-4" />
                  Try again
                </Button>
              </div>
            </div>
          </section>
        ) : isEditing ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground text-xs">
              <FileText className="size-4" />
              Edit the full `CORE.md` document. Save replaces the current file.
            </div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="# Core Memory\n\n- Important facts the agent should retain"
              className="styled-scrollbar min-h-[340px] resize-none rounded-2xl border-border/60 bg-background/80 px-4 py-3 font-mono text-sm leading-6"
            />
            <p className="mt-3 text-muted-foreground text-xs leading-5">
              Keep this focused on durable facts, preferences, and project
              context. Behavior and tone still belong in SOUL.md.
            </p>
          </section>
        ) : hasContent ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-border/60 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Current memory</span>
              </div>
            </div>
            <div className="px-4 py-4">
              <MarkdownDocument>{currentContent}</MarkdownDocument>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border/80 border-dashed bg-card/80 p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Brain className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-sm">No core memory yet</p>
                <p className="max-w-[260px] text-muted-foreground text-xs leading-5">
                  Add the durable context you want the agent to remember across
                  conversations.
                </p>
              </div>
              <div className="w-full max-w-[280px] rounded-2xl border border-border/60 bg-background/70 p-4 text-left">
                <p className="mb-3 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
                  Good things to store
                </p>
                <ul className="space-y-2 text-foreground text-sm">
                  {EMPTY_STATE_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-orange)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={handleEdit}>
                <PencilLine className="size-4" />
                Add core memory
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
