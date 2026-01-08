/**
 * @license
 * Copyright 2025 BrowserOS
 */
import fs from 'node:fs'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

import { cliOptions } from '../build/src/cli'
import { ToolCategories } from '../build/src/tools/categories'

const MCP_SERVER_PATH = 'build/src/index.js'
const OUTPUT_PATH = './docs/tool-reference.md'
const README_PATH = './README.md'

// Extend the MCP Tool type to include our annotations
interface ToolWithAnnotations extends Tool {
  annotations?: {
    title?: string
    category?: ToolCategories
  }
}

function escapeHtmlTags(text: string): string {
  return text
    .replace(/&(?![a-zA-Z]+;)/g, '&amp;')
    .replace(/<([a-zA-Z][^>]*)>/g, '&lt;$1&gt;')
}

function addCrossLinks(text: string, tools: ToolWithAnnotations[]): string {
  let result = text

  // Create a set of all tool names for efficient lookup
  const toolNames = new Set(tools.map((tool) => tool.name))

  // Sort tool names by length (descending) to match longer names first
  const sortedToolNames = Array.from(toolNames).sort(
    (a, b) => b.length - a.length,
  )

  for (const toolName of sortedToolNames) {
    // Create regex to match tool name (case insensitive, word boundaries)
    const regex = new RegExp(`\\b${toolName.replace(/_/g, '_')}\\b`, 'gi')

    result = result.replace(regex, (match) => {
      // Only create link if the match isn't already inside a link
      if (result.indexOf(`[${match}]`) !== -1) {
        return match // Already linked
      }
      const anchorLink = toolName.toLowerCase()
      return `[\`${match}\`](#${anchorLink})`
    })
  }

  return result
}

function generateToolsTOC(
  categories: Record<string, ToolWithAnnotations[]>,
  sortedCategories: string[],
): string {
  let toc = ''

  for (const category of sortedCategories) {
    const categoryTools = categories[category]
    const categoryName = category
    toc += `- **${categoryName}** (${categoryTools.length} tools)\n`

    // Sort tools within category for TOC
    categoryTools.sort((a: Tool, b: Tool) => a.name.localeCompare(b.name))
    for (const tool of categoryTools) {
      const anchorLink = tool.name.toLowerCase()
      toc += `  - [\`${tool.name}\`](docs/tool-reference.md#${anchorLink})\n`
    }
  }

  return toc
}

function updateReadmeWithToolsTOC(toolsTOC: string): void {
  const readmeContent = fs.readFileSync(README_PATH, 'utf8')

  const beginMarker = '<!-- BEGIN AUTO GENERATED TOOLS -->'
  const endMarker = '<!-- END AUTO GENERATED TOOLS -->'

  const beginIndex = readmeContent.indexOf(beginMarker)
  const endIndex = readmeContent.indexOf(endMarker)

  if (beginIndex === -1 || endIndex === -1) {
    console.warn('Could not find auto-generated tools markers in README.md')
    return
  }

  const before = readmeContent.substring(0, beginIndex + beginMarker.length)
  const after = readmeContent.substring(endIndex)

  const updatedContent = `${before}\n\n${toolsTOC}\n${after}`

  fs.writeFileSync(README_PATH, updatedContent)
  console.log('Updated README.md with tools table of contents')
}

function generateConfigOptionsMarkdown(): string {
  let markdown = ''

  for (const [optionName, optionConfig] of Object.entries(cliOptions)) {
    // Skip hidden options
    if (optionConfig.hidden) {
      continue
    }

    const aliasText = optionConfig.alias ? `, \`-${optionConfig.alias}\`` : ''
    const description = optionConfig.description || optionConfig.describe || ''

    // Start with option name and description
    markdown += `- **\`--${optionName}\`${aliasText}**\n`
    markdown += `  ${description}\n`

    // Add type information
    markdown += `  - **Type:** ${optionConfig.type}\n`

    // Add choices if available
    if (optionConfig.choices) {
      markdown += `  - **Choices:** ${optionConfig.choices.map((c) => `\`${c}\``).join(', ')}\n`
    }

    // Add default if available
    if (optionConfig.default !== undefined) {
      markdown += `  - **Default:** \`${optionConfig.default}\`\n`
    }

    markdown += '\n'
  }

  return markdown.trim()
}

function updateReadmeWithOptionsMarkdown(optionsMarkdown: string): void {
  const readmeContent = fs.readFileSync(README_PATH, 'utf8')

  const beginMarker = '<!-- BEGIN AUTO GENERATED OPTIONS -->'
  const endMarker = '<!-- END AUTO GENERATED OPTIONS -->'

  const beginIndex = readmeContent.indexOf(beginMarker)
  const endIndex = readmeContent.indexOf(endMarker)

  if (beginIndex === -1 || endIndex === -1) {
    console.warn('Could not find auto-generated options markers in README.md')
    return
  }

  const before = readmeContent.substring(0, beginIndex + beginMarker.length)
  const after = readmeContent.substring(endIndex)

  const updatedContent = `${before}\n\n${optionsMarkdown}\n\n${after}`

  fs.writeFileSync(README_PATH, updatedContent)
  console.log('Updated README.md with options markdown')
}

function groupToolsByCategory(
  tools: ToolWithAnnotations[],
): Record<string, ToolWithAnnotations[]> {
  const categories: Record<string, ToolWithAnnotations[]> = {}
  for (const tool of tools) {
    const category = tool.annotations?.category || 'Uncategorized'
    if (!categories[category]) categories[category] = []
    categories[category].push(tool)
  }
  return categories
}

function sortCategories(
  categories: Record<string, ToolWithAnnotations[]>,
): string[] {
  const categoryOrder = Object.values(ToolCategories)
  return Object.keys(categories).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a)
    const bIndex = categoryOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

function generateToolReferenceTOC(
  categories: Record<string, ToolWithAnnotations[]>,
  sortedCategories: string[],
): string {
  let toc = ''
  for (const category of sortedCategories) {
    const categoryTools = categories[category]
    const anchorName = category.toLowerCase().replace(/\s+/g, '-')
    toc += `- **[${category}](#${anchorName})** (${categoryTools.length} tools)\n`

    categoryTools.sort((a, b) => a.name.localeCompare(b.name))
    for (const tool of categoryTools) {
      toc += `  - [\`${tool.name}\`](#${tool.name.toLowerCase()})\n`
    }
  }
  return toc
}

function generateToolSection(
  tool: ToolWithAnnotations,
  allTools: ToolWithAnnotations[],
): string {
  let section = `### \`${tool.name}\`\n\n`

  if (tool.description) {
    let escapedDescription = escapeHtmlTags(tool.description)
    escapedDescription = addCrossLinks(escapedDescription, allTools)
    section += `**Description:** ${escapedDescription}\n\n`
  }

  if (
    tool.inputSchema?.properties &&
    Object.keys(tool.inputSchema.properties).length > 0
  ) {
    const properties = tool.inputSchema.properties
    const required = tool.inputSchema.required || []

    section += '**Parameters:**\n\n'
    for (const propName of Object.keys(properties).sort()) {
      const prop = properties[propName] as {
        type?: string
        enum?: string[]
        description?: string
      }
      const isRequired = required.includes(propName)
      const requiredText = isRequired ? ' **(required)**' : ' _(optional)_'

      let typeInfo = prop.type || 'unknown'
      if (prop.enum) {
        typeInfo = `enum: ${prop.enum.map((v) => `"${v}"`).join(', ')}`
      }

      section += `- **${propName}** (${typeInfo})${requiredText}`
      if (prop.description) {
        let escapedParamDesc = escapeHtmlTags(prop.description)
        escapedParamDesc = addCrossLinks(escapedParamDesc, allTools)
        section += `: ${escapedParamDesc}`
      }
      section += '\n'
    }
    section += '\n'
  } else {
    section += '**Parameters:** None\n\n'
  }

  section += '---\n\n'
  return section
}

function generateCategorySections(
  categories: Record<string, ToolWithAnnotations[]>,
  sortedCategories: string[],
  allTools: ToolWithAnnotations[],
): string {
  let sections = ''
  for (const category of sortedCategories) {
    const categoryTools = categories[category]
    sections += `## ${category}\n\n`
    categoryTools.sort((a, b) => a.name.localeCompare(b.name))
    for (const tool of categoryTools) {
      sections += generateToolSection(tool, allTools)
    }
  }
  return sections
}

async function generateToolDocumentation(): Promise<void> {
  console.log('Starting MCP server to query tool definitions...')

  const transport = new StdioClientTransport({
    command: 'node',
    args: [MCP_SERVER_PATH, '--channel', 'canary'],
  })

  const client = new Client(
    { name: 'docs-generator', version: '1.0.0' },
    { capabilities: {} },
  )

  try {
    await client.connect(transport)
    console.log('Connected to MCP server')

    const { tools } = await client.listTools()
    const toolsWithAnnotations = tools as ToolWithAnnotations[]
    console.log(`Found ${tools.length} tools`)

    const categories = groupToolsByCategory(toolsWithAnnotations)
    const sortedCategories = sortCategories(categories)

    const markdown = `<!-- AUTO GENERATED DO NOT EDIT - run 'npm run docs' to update-->

# Chrome DevTools MCP Tool Reference

${generateToolReferenceTOC(categories, sortedCategories)}
${generateCategorySections(categories, sortedCategories, toolsWithAnnotations)}`

    fs.writeFileSync(OUTPUT_PATH, `${markdown.trim()}\n`)
    console.log(
      `Generated documentation for ${toolsWithAnnotations.length} tools in ${OUTPUT_PATH}`,
    )

    updateReadmeWithToolsTOC(generateToolsTOC(categories, sortedCategories))
    updateReadmeWithOptionsMarkdown(generateConfigOptionsMarkdown())

    await client.close()
    process.exit(0)
  } catch (error) {
    console.error('Error generating documentation:', error)
    process.exit(1)
  }
}

// Run the documentation generator
generateToolDocumentation().catch(console.error)
