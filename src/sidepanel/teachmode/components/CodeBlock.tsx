import React, { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight, Code } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface CodeBlockProps {
  code: string
  title?: string
  language?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

/**
 * CodeBlock component for displaying code with copy functionality
 */
export function CodeBlock({
  code,
  title = 'Generated Code',
  language = 'typescript',
  collapsible = true,
  defaultExpanded = false
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const toggleExpand = () => {
    if (collapsible) {
      setExpanded(!expanded)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border",
          collapsible && "cursor-pointer hover:bg-muted/70 transition-colors"
        )}
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
          <Code className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
            copied
              ? "text-green-600 bg-green-100"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {(!collapsible || expanded) && (
        <div className="overflow-x-auto">
          <pre className="p-3 text-xs leading-relaxed">
            <code className="text-foreground font-mono whitespace-pre">
              {code}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}
