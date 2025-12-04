import React, { useState } from 'react'
import { PrismLight as SyntaxHighlighterBase } from 'react-syntax-highlighter'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ChevronDown, ChevronRight, Code } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

// Register only TypeScript language for smaller bundle
SyntaxHighlighterBase.registerLanguage('typescript', typescript)

// Cast to any to fix React 18 type compatibility issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SyntaxHighlighter = SyntaxHighlighterBase as any

interface CodeBlockProps {
  code: string
  title?: string
  language?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

/**
 * CodeBlock component for displaying code with syntax highlighting and copy functionality
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
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 bg-[#282c34] border-b border-border",
          collapsible && "cursor-pointer hover:bg-[#2c313a] transition-colors"
        )}
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )
          )}
          <Code className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200">{title}</span>
          <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-[#21252b] rounded">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
            copied
              ? "text-green-400 bg-green-900/30"
              : "text-gray-400 hover:text-gray-200 hover:bg-[#21252b]"
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

      {/* Code content with syntax highlighting */}
      {(!collapsible || expanded) && (
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '12px',
            fontSize: '12px',
            lineHeight: '1.5',
            borderRadius: 0,
            background: '#282c34'
          }}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#636d83',
            userSelect: 'none'
          }}
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  )
}
