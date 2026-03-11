import {
  BookOpenText,
  Brain,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import { type FC, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePersonalization } from '@/lib/personalization/personalizationStorage'
import { cn } from '@/lib/utils'
import { NewTabBranding } from '../index/NewTabBranding'
import { MarkdownPreview } from './MarkdownPreview'
import { PromptTemplates } from './PromptTemplates'
import type { DailyMemoryFile } from './useMemory'
import { useMemory } from './useMemory'

type PersonalizeTab = 'memory' | 'prompt'
type CoreView = 'preview' | 'edit'

const formatMemoryDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))

const getTodayDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getEntryCount = (content: string) => content.match(/^##\s/gm)?.length ?? 0

const getCoreLineCount = (content: string) =>
  content.trim() ? content.trim().split('\n').length : 0

const getDailySummary = (content: string) => {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('## '))

  if (!firstLine) return 'Recent session notes'
  return firstLine.length > 88 ? `${firstLine.slice(0, 88)}...` : firstLine
}

const OverviewCard: FC<{
  icon: typeof Brain
  title: string
  value: string
  description: string
}> = ({ icon: Icon, title, value, description }) => (
  <div className="rounded-2xl border border-border/60 bg-background/80 p-4 backdrop-blur-sm">
    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.18em]">
      <Icon className="h-4 w-4" />
      {title}
    </div>
    <div className="mt-3 font-semibold text-2xl">{value}</div>
    <p className="mt-1 text-muted-foreground text-sm">{description}</p>
  </div>
)

const DailyMemoryButton: FC<{
  item: DailyMemoryFile
  selected: boolean
  onSelect: (fileName: string) => void
}> = ({ item, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(item.fileName)}
    className={cn(
      'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
      selected
        ? 'border-orange-400/70 bg-orange-500/10'
        : 'border-border/60 bg-background hover:bg-muted/50',
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-sm">{formatMemoryDate(item.date)}</span>
      {item.date === getTodayDate() ? (
        <Badge variant="secondary">Today</Badge>
      ) : null}
    </div>
    <p className="mt-2 text-muted-foreground text-sm">
      {getEntryCount(item.content)} entries
    </p>
    <p className="mt-1 text-muted-foreground text-xs">
      {getDailySummary(item.content)}
    </p>
  </button>
)

export const Personalize = () => {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<PersonalizeTab>('memory')
  const [coreView, setCoreView] = useState<CoreView>('preview')
  const [coreDraft, setCoreDraft] = useState('')
  const [selectedDailyFile, setSelectedDailyFile] = useState<string | null>(
    null,
  )
  const lastLoadedCore = useRef('')
  const { personalization, setPersonalization } = usePersonalization()
  const { memory, isLoading, error, refetch, saveCoreMemory, isSavingCore } =
    useMemory()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!memory) return
    setCoreDraft((current) =>
      current === lastLoadedCore.current ? memory.coreMemory : current,
    )
    lastLoadedCore.current = memory.coreMemory
  }, [memory])

  useEffect(() => {
    if (!memory) return
    if (memory.dailyMemories.length === 0) {
      setSelectedDailyFile(null)
      return
    }

    setSelectedDailyFile((current) =>
      current &&
      memory.dailyMemories.some((entry) => entry.fileName === current)
        ? current
        : memory.dailyMemories[0].fileName,
    )
  }, [memory])

  const isCoreDirty = coreDraft !== lastLoadedCore.current
  const todayDate = getTodayDate()
  const selectedDailyMemory =
    memory?.dailyMemories.find(
      (entry) => entry.fileName === selectedDailyFile,
    ) ?? null
  const coreLineCount = getCoreLineCount(memory?.coreMemory ?? '')
  const dailyMemoryCount = memory?.dailyMemories.length ?? 0

  const handleSaveCore = async () => {
    try {
      await saveCoreMemory(coreDraft)
      toast.success('Core memory updated')
      setCoreView('preview')
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Failed to save memory'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <NewTabBranding />

      <div
        className={cn(
          'overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%)] bg-background p-6 transition-all duration-500',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge
              variant="secondary"
              className="bg-orange-500/10 text-orange-700 dark:text-orange-300"
            >
              Personalize
            </Badge>
            <div className="space-y-2">
              <h1 className="font-semibold text-3xl tracking-tight">
                Shape what BrowserOS knows and remembers
              </h1>
              <p className="text-base text-muted-foreground leading-7">
                Keep your live prompt separate from long-term memory, review
                what the agent has saved, and update your durable facts without
                digging through markdown files by hand.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/75 p-4 text-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Behavior lives in Agent Soul
            </div>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Use memory for user facts and recent context. Use Soul for tone,
              boundaries, and how the agent behaves.
            </p>
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link to="/settings/soul">Open Agent Soul</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <OverviewCard
            icon={BookOpenText}
            title="Prompt"
            value={personalization.trim() ? 'Active' : 'Empty'}
            description="Injected directly into chat as your local personalization prompt."
          />
          <OverviewCard
            icon={Brain}
            title="Core Memory"
            value={coreLineCount > 0 ? `${coreLineCount}` : '0'}
            description="Durable markdown facts that stay until you edit them."
          />
          <OverviewCard
            icon={Clock3}
            title="Daily Memory"
            value={`${dailyMemoryCount}`}
            description={`Recent notes saved by the agent and retained for ${memory?.retentionDays ?? 30} days.`}
          />
        </div>
      </div>

      <div
        className={cn(
          'transition-all delay-100 duration-500',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        )}
      >
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as PersonalizeTab)}
        >
          <TabsList variant="line" className="mb-2">
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="memory" className="space-y-6">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-5">
                <CardTitle>Memory Model</CardTitle>
                <CardDescription>
                  Core memory holds durable facts. Daily memory captures recent
                  notes and expires automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 py-5 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Brain className="h-4 w-4 text-orange-500" />
                    Core memory
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Stable facts about you, your projects, tools, people, and
                    preferences.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Clock3 className="h-4 w-4 text-orange-500" />
                    Daily memory
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Session notes and recent context saved into date-based
                    markdown files.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    Agent soul
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Tone, behavior, and boundaries. Keep it separate from
                    factual memory.
                  </p>
                </div>
              </CardContent>
            </Card>

            {error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
                <p className="font-medium text-destructive text-sm">
                  Could not load memory from the local BrowserOS server.
                </p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Make sure the BrowserOS server is running, then refresh.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => void refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : null}

            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Core Memory</CardTitle>
                    <Badge variant="outline">CORE.md</Badge>
                    <Badge variant="secondary">Editable</Badge>
                    {isCoreDirty ? (
                      <Badge variant="secondary">Unsaved</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="mt-2">
                    Add or refine the durable facts you want BrowserOS to keep.
                  </CardDescription>
                </div>
                <CardAction className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', isLoading && 'animate-spin')}
                    />
                    Refresh
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4 py-5">
                {isLoading && !memory ? (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-muted/20">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Tabs
                    value={coreView}
                    onValueChange={(value) => setCoreView(value as CoreView)}
                  >
                    <TabsList>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                      <TabsTrigger value="edit">Edit</TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview">
                      <MarkdownPreview
                        content={coreDraft}
                        emptyMessage="Core memory is empty. Add durable facts you want the agent to keep."
                      />
                    </TabsContent>
                    <TabsContent value="edit">
                      <Textarea
                        value={coreDraft}
                        onChange={(event) => setCoreDraft(event.target.value)}
                        placeholder="Write stable facts you want BrowserOS to remember. Markdown is supported."
                        className="styled-scrollbar min-h-80 resize-y rounded-2xl border-border/70 bg-muted/10 px-4 py-3"
                      />
                    </TabsContent>
                  </Tabs>
                )}

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-sm">
                    Facts belong here. Behavior and tone belong in Agent Soul.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setCoreDraft(lastLoadedCore.current)}
                      disabled={!isCoreDirty || isSavingCore}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      onClick={() => void handleSaveCore()}
                      disabled={!isCoreDirty || isSavingCore || !!error}
                    >
                      {isSavingCore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save core memory
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-5">
                <CardTitle>Daily Memory</CardTitle>
                <CardDescription>
                  Recent notes the agent has saved. Files rotate automatically
                  after {memory?.retentionDays ?? 30} days.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-5">
                {isLoading && !memory ? (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-muted/20">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : dailyMemoryCount === 0 ? (
                  <div className="rounded-2xl border border-border/70 border-dashed bg-muted/20 px-6 py-12 text-center">
                    <Clock3 className="mx-auto h-6 w-6 text-muted-foreground/70" />
                    <p className="mt-3 font-medium text-sm">
                      No daily memories yet
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      As the agent saves recent context, date-based markdown
                      files will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ScrollArea className="h-[420px] rounded-2xl border border-border/60 bg-muted/10 p-2">
                      <div className="space-y-2 pr-3">
                        {memory?.dailyMemories.map((item) => (
                          <DailyMemoryButton
                            key={item.fileName}
                            item={item}
                            selected={item.fileName === selectedDailyFile}
                            onSelect={setSelectedDailyFile}
                          />
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">
                            {selectedDailyMemory
                              ? formatMemoryDate(selectedDailyMemory.date)
                              : 'Select a file'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {selectedDailyMemory?.fileName ?? ''}
                          </p>
                        </div>
                        {selectedDailyMemory?.date === todayDate ? (
                          <Badge variant="secondary">Today</Badge>
                        ) : null}
                      </div>
                      <MarkdownPreview
                        content={selectedDailyMemory?.content ?? ''}
                        className="min-h-[340px]"
                        emptyMessage="Select a daily memory file to inspect its contents."
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-6">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-5">
                <CardTitle>Live Personalization Prompt</CardTitle>
                <CardDescription>
                  This stays local and is injected into chat directly. Use it
                  for immediate instructions or context you always want present.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 py-5">
                <div className="space-y-3">
                  <Label htmlFor="personalization">Your information</Label>
                  <Textarea
                    id="personalization"
                    value={personalization}
                    onChange={(event) => setPersonalization(event.target.value)}
                    placeholder="Tell BrowserOS about yourself... (Supports Markdown)"
                    className="styled-scrollbar h-96 resize-none rounded-2xl border-2 border-border/50 bg-card px-4 py-3 transition-transform placeholder:text-muted-foreground focus:border-orange-500/30 focus:ring-4 focus:ring-orange-500/10"
                  />
                  <p className="text-muted-foreground text-xs">
                    This prompt is saved locally and never leaves your device
                    until BrowserOS includes it in your chat request.
                  </p>
                </div>
              </CardContent>
            </Card>

            <PromptTemplates />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
