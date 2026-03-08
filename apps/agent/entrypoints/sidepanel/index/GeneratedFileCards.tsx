import type { UIMessage } from 'ai'
import {
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
} from 'lucide-react'
import { type FC, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getAgentServerUrl } from '@/lib/browseros/helpers'
import { cn } from '@/lib/utils'
import {
  getGeneratedFilesFromMessage,
  type MessageGeneratedFile,
} from './generated-files'

interface GeneratedFileCardsProps {
  message: UIMessage
  conversationId?: string
}

function getFileIcon(file: MessageGeneratedFile) {
  if (file.mediaType?.startsWith('image/')) return ImageIcon
  if (file.mediaType === 'text/html') return GlobeIcon
  if (
    file.mediaType?.startsWith('text/') ||
    file.mediaType === 'application/pdf'
  ) {
    return FileTextIcon
  }
  return FileIcon
}

function getOpenLabel(file: MessageGeneratedFile): string {
  return file.openMode === 'browser' ? 'Open' : 'Open in App'
}

function getOpenDescription(file: MessageGeneratedFile): string {
  return file.openMode === 'browser'
    ? `${file.typeLabel} - opens in browser`
    : `${file.typeLabel} - opens in default app`
}

export const GeneratedFileCards: FC<GeneratedFileCardsProps> = ({
  message,
  conversationId,
}) => {
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const files = getGeneratedFilesFromMessage(message)

  if (!conversationId || files.length === 0) {
    return null
  }

  const openFile = async (file: MessageGeneratedFile) => {
    setPendingPath(file.path)

    try {
      const baseUrl = await getAgentServerUrl()

      if (file.openMode === 'browser') {
        const url = new URL(`/chat/${conversationId}/files`, baseUrl)
        url.searchParams.set('path', file.path)
        await chrome.tabs.create({ url: url.toString() })
        return
      }

      const url = new URL(`/chat/${conversationId}/files/open`, baseUrl)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error || `Failed to open ${file.fileName}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to open ${file.fileName}`,
      )
    } finally {
      setPendingPath(null)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {files.map((file) => {
        const Icon = getFileIcon(file)
        const isPending = pendingPath === file.path

        return (
          <div
            key={file.path}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm',
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground text-sm">
                {file.fileName}
              </p>
              <p className="truncate text-muted-foreground text-xs">
                {getOpenDescription(file)}
              </p>
            </div>
            <Button
              disabled={isPending}
              onClick={() => openFile(file)}
              size="sm"
              type="button"
              variant="outline"
            >
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              {getOpenLabel(file)}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
