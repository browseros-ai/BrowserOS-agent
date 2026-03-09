import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronRight,
  Info,
  Lightbulb,
  Minus,
  Plus,
  Terminal,
} from 'lucide-react'
import { type FC, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type McpTransport = 'http' | 'sse' | 'stdio'

const urlFormSchema = z.object({
  transport: z.enum(['http', 'sse']),
  name: z.string().min(1, 'Server name is required'),
  url: z.string().url('Please enter a valid URL'),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  description: z.string().optional(),
})

const stdioFormSchema = z.object({
  transport: z.literal('stdio'),
  name: z.string().min(1, 'Server name is required'),
  command: z.string().min(1, 'Command is required'),
  args: z.string().optional(),
  cwd: z.string().optional(),
  envVars: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  description: z.string().optional(),
})

type UrlFormValues = z.infer<typeof urlFormSchema>
type StdioFormValues = z.infer<typeof stdioFormSchema>

export interface CustomServerConfig {
  name: string
  url: string
  description: string
  transport?: McpTransport
  headers?: Record<string, string>
  command?: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
}

interface AddCustomMCPDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddServer: (config: CustomServerConfig) => void
}

export const AddCustomMCPDialog: FC<AddCustomMCPDialogProps> = ({
  open,
  onOpenChange,
  onAddServer,
}) => {
  const [transport, setTransport] = useState<McpTransport>('http')

  const urlForm = useForm<UrlFormValues>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      transport: 'http',
      name: '',
      url: '',
      headers: [],
      description: '',
    },
  })

  const stdioForm = useForm<StdioFormValues>({
    resolver: zodResolver(stdioFormSchema),
    defaultValues: {
      transport: 'stdio',
      name: '',
      command: '',
      args: '',
      cwd: '',
      envVars: [],
      description: '',
    },
  })

  const {
    fields: headerFields,
    append: addHeader,
    remove: removeHeader,
  } = useFieldArray({ control: urlForm.control, name: 'headers' })

  const {
    fields: envFields,
    append: addEnvVar,
    remove: removeEnvVar,
  } = useFieldArray({ control: stdioForm.control, name: 'envVars' })

  const resetForms = () => {
    urlForm.reset()
    stdioForm.reset()
    setTransport('http')
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForms()
    onOpenChange(isOpen)
  }

  const handleTransportChange = (value: string) => {
    const t = value as McpTransport
    setTransport(t)
    if (t === 'http' || t === 'sse') {
      urlForm.setValue('transport', t)
    }
  }

  const onUrlSubmit = (values: UrlFormValues) => {
    const headers: Record<string, string> = {}
    for (const h of values.headers ?? []) {
      if (h.key.trim()) headers[h.key.trim()] = h.value
    }

    onAddServer({
      name: values.name,
      url: values.url,
      description: values.description ?? '',
      transport: values.transport,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    })
    resetForms()
    onOpenChange(false)
  }

  const onStdioSubmit = (values: StdioFormValues) => {
    // Parse space-separated args string into array
    const args = values.args?.trim()
      ? values.args.trim().split(/\s+/)
      : undefined

    // Convert env var pairs to record
    const env: Record<string, string> = {}
    for (const v of values.envVars ?? []) {
      if (v.key.trim()) env[v.key.trim()] = v.value
    }

    onAddServer({
      name: values.name,
      url: '',
      description: values.description ?? '',
      transport: 'stdio',
      command: values.command,
      args,
      cwd: values.cwd?.trim() || undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
    })
    resetForms()
    onOpenChange(false)
  }

  const isStdio = transport === 'stdio'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom App</DialogTitle>
          <DialogDescription>
            Configure your custom app connection
          </DialogDescription>
        </DialogHeader>

        {/* Transport selector */}
        <Tabs
          value={transport}
          onValueChange={handleTransportChange}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="http" className="flex-1">
              HTTP
            </TabsTrigger>
            <TabsTrigger value="sse" className="flex-1">
              SSE
            </TabsTrigger>
            <TabsTrigger value="stdio" className="flex-1">
              <Terminal className="mr-1 h-3.5 w-3.5" />
              Stdio
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* HTTP / SSE form */}
        {!isStdio && (
          <Form {...urlForm}>
            <form
              onSubmit={urlForm.handleSubmit(onUrlSubmit)}
              className="space-y-4"
            >
              <FormField
                control={urlForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Custom App" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={urlForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MCP Server URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://mcp.example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Collapsible>
                <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                  <span className="flex-1 font-medium">Headers (Optional)</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      e.g. Authorization: Bearer sk-...
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addHeader({ key: '', value: '' })}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  </div>
                  {headerFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="mb-2 flex items-center gap-2"
                    >
                      <Input
                        placeholder="Header"
                        className="flex-1 font-mono text-xs"
                        {...urlForm.register(`headers.${index}.key`)}
                      />
                      <Input
                        placeholder="Value"
                        className="flex-1 font-mono text-xs"
                        {...urlForm.register(`headers.${index}.value`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeHeader(index)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <FormField
                control={urlForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this server does..."
                        rows={2}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <TransportHelpCollapsible />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange-bright)]"
                >
                  Add Server
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* Stdio form */}
        {isStdio && (
          <Form {...stdioForm}>
            <form
              onSubmit={stdioForm.handleSubmit(onStdioSubmit)}
              className="space-y-4"
            >
              {/* Info banner */}
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800 text-sm dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Stdio servers run on the machine where BrowserOS is installed.
                </span>
              </div>

              <FormField
                control={stdioForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Filesystem Server" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={stdioForm.control}
                name="command"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command</FormLabel>
                    <FormControl>
                      <Input placeholder="npx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={stdioForm.control}
                name="args"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arguments</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Collapsible>
                <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                  <span className="flex-1 font-medium">
                    Advanced (Optional)
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  <FormField
                    control={stdioForm.control}
                    name="cwd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Working Directory</FormLabel>
                        <FormControl>
                          <Input placeholder="/home/user/project" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-sm">
                        Environment Variables
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addEnvVar({ key: '', value: '' })}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    {envFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="mb-2 flex items-center gap-2"
                      >
                        <Input
                          placeholder="KEY"
                          className="flex-1 font-mono text-xs"
                          {...stdioForm.register(`envVars.${index}.key`)}
                        />
                        <Input
                          placeholder="value"
                          className="flex-1 font-mono text-xs"
                          {...stdioForm.register(`envVars.${index}.value`)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeEnvVar(index)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <FormField
                control={stdioForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this server does..."
                        rows={2}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <TransportHelpCollapsible />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange-bright)]"
                >
                  Add Server
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

const TransportHelpCollapsible: FC = () => (
  <Collapsible>
    <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--accent-orange)]/10">
      <Lightbulb className="h-4 w-4 shrink-0 text-[var(--accent-orange)]" />
      <span className="flex-1 font-medium">Which transport should I use?</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5 px-3 py-2 text-muted-foreground text-sm">
      <p>
        <strong>HTTP</strong> — Most modern MCP servers use Streamable HTTP.
        Choose this if your server docs say &quot;HTTP&quot; or you&apos;re
        unsure.
      </p>
      <p>
        <strong>SSE</strong> — Older MCP servers use Server-Sent Events. Choose
        this if your server docs mention SSE.
      </p>
      <p>
        <strong>Stdio</strong> — For locally-installed MCP servers that run as a
        command (e.g., npx, uvx, node).
      </p>
    </CollapsibleContent>
  </Collapsible>
)
