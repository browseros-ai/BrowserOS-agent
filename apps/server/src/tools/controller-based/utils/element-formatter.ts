/**
 * @license
 * Copyright 2025 BrowserOS
 */

export type FormatPreset = 'simplified' | 'full'

export interface FormatOptions {
  showIndentation: boolean
  showNodeId: boolean
  showType: boolean
  showTag: boolean
  showName: boolean
  showContext: boolean
  showPath: boolean
  showAttributes: boolean
  showValueForTypeable: boolean
  showViewportStatus: boolean
  indentSize: number
}

const PRESET_OPTIONS: Record<FormatPreset, FormatOptions> = {
  simplified: {
    showIndentation: false,
    showNodeId: true,
    showType: true,
    showTag: true,
    showName: true,
    showContext: false,
    showPath: false,
    showAttributes: false,
    showValueForTypeable: true,
    showViewportStatus: true,
    indentSize: 2,
  },
  full: {
    showIndentation: true,
    showNodeId: true,
    showType: true,
    showTag: true,
    showName: true,
    showContext: false,
    showPath: false,
    showAttributes: true,
    showValueForTypeable: true,
    showViewportStatus: true,
    indentSize: 2,
  },
}

/**
 * Interactive Node interface matching the controller response
 */
export interface InteractiveNode {
  nodeId: number
  type: 'clickable' | 'typeable' | 'selectable' | 'other'
  name?: string
  rect?: {
    x: number
    y: number
    width: number
    height: number
  }
  attributes?: {
    in_viewport?: string
    depth?: string
    'html-tag'?: string
    role?: string
    context?: string
    path?: string
    placeholder?: string
    id?: string
    'input-type'?: string
    type?: string
    value?: string
    'aria-label'?: string
    // biome-ignore lint/suspicious/noExplicitAny: index signature for dynamic attributes
    [key: string]: any
  }
}

/**
 * Element Formatter - Formats interactive elements for display
 * Based on BrowserOS-agent ElementFormatter
 */
export class ElementFormatter {
  private options: FormatOptions

  constructor(preset: FormatPreset = 'full') {
    this.options = PRESET_OPTIONS[preset]
  }

  /**
   * Format an array of elements
   */
  formatElements(
    elements: InteractiveNode[],
    hideHiddenElements = false,
  ): string {
    const SKIP_OUT_OF_VIEWPORT = hideHiddenElements
    const SORT_BY_NODEID = true
    const MAX_ELEMENTS = 0 // 0 means no limit

    let filteredElements = [...elements]

    if (SKIP_OUT_OF_VIEWPORT) {
      filteredElements = filteredElements.filter(
        (node) => node.attributes?.in_viewport !== 'false',
      )
    }

    if (SORT_BY_NODEID) {
      filteredElements.sort((a, b) => a.nodeId - b.nodeId)
    }

    if (MAX_ELEMENTS > 0) {
      filteredElements = filteredElements.slice(0, MAX_ELEMENTS)
    }

    const lines: string[] = []
    for (const node of filteredElements) {
      const formatted = this.formatElement(node)
      if (formatted) {
        lines.push(formatted)
      }
    }

    if (SKIP_OUT_OF_VIEWPORT) {
      lines.push(
        '--- IMPORTANT: OUT OF VIEWPORT ELEMENTS, SCROLL TO INTERACT ---',
      )
    }

    return lines.join('\n')
  }

  /**
   * Format a single element
   */
  formatElement(node: InteractiveNode): string {
    const opts = this.options
    const parts: string[] = []

    if (opts.showIndentation) {
      const depth = parseInt(node.attributes?.depth || '0', 10)
      const indent = ' '.repeat(opts.indentSize * depth)
      parts.push(indent)
    }

    if (opts.showNodeId) {
      parts.push(`[${node.nodeId}]`)
    }

    if (opts.showType) {
      parts.push(`<${this._getTypeSymbol(node.type)}>`)
    }

    if (opts.showTag) {
      const tag =
        node.attributes?.['html-tag'] || node.attributes?.role || 'div'
      parts.push(`<${tag}>`)
    }

    if (opts.showName && node.name) {
      const truncated = this._truncateText(node.name, 40)
      parts.push(`"${truncated}"`)
    } else if (node.type === 'typeable') {
      const placeholder = node.attributes?.placeholder
      const id = node.attributes?.id
      const inputType = node.attributes?.['input-type'] || 'text'
      if (placeholder) {
        parts.push(`placeholder="${this._truncateText(placeholder, 30)}"`)
      } else if (id) {
        parts.push(`id="${this._truncateText(id, 10)}"`)
      } else {
        parts.push(`type="${inputType}"`)
      }
    }

    if (opts.showContext && node.attributes?.context) {
      const truncated = this._truncateText(node.attributes.context, 60)
      parts.push(`ctx:"${truncated}"`)
    }

    if (opts.showPath && node.attributes?.path) {
      const formatted = this._formatPath(node.attributes.path)
      if (formatted) {
        parts.push(`path:"${formatted}"`)
      }
    }

    if (opts.showAttributes) {
      const attrString = this._formatAttributes(node)
      if (attrString) {
        parts.push(`attr:"${attrString}"`)
      }
    }

    if (
      opts.showValueForTypeable &&
      !opts.showAttributes &&
      node.type === 'typeable' &&
      node.attributes?.value
    ) {
      const value = this._truncateText(node.attributes.value, 40)
      parts.push(`value="${value}"`)
    }

    if (opts.showViewportStatus) {
      const isInViewport = node.attributes?.in_viewport !== 'false'
      parts.push(isInViewport ? '(visible)' : '(hidden)')
    }

    return parts.join(' ')
  }

  /**
   * Get legend entries based on enabled format options
   */
  getLegend(): string[] {
    const opts = this.options
    const legend: string[] = []

    if (opts.showNodeId) {
      legend.push('[nodeId] - Use this number to interact with the element')
    }
    if (opts.showType) {
      legend.push('<C> - Clickable element')
      legend.push('<T> - Typeable/input element')
    }
    if (opts.showViewportStatus) {
      legend.push('(visible) - Element is in viewport')
      legend.push('(hidden) - Element is out of viewport, may need scrolling')
    }
    if (opts.showIndentation) {
      legend.push('Indentation shows DOM depth')
    }
    if (opts.showPath) {
      legend.push('path:"..." - DOM path to element')
    }
    if (opts.showContext) {
      legend.push('ctx:"..." - Surrounding text context')
    }
    if (opts.showAttributes) {
      legend.push(
        'attr:"..." - Element attributes (type, placeholder, value, aria-label)',
      )
    }

    return legend
  }

  private _getTypeSymbol(type: string): string {
    switch (type) {
      case 'clickable':
      case 'selectable':
        return 'C'
      case 'typeable':
        return 'T'
      default:
        return 'O'
    }
  }

  private _truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text
    return `${text.substring(0, maxLength - 3)}...`
  }

  private _formatPath(path: string): string {
    if (!path) return ''
    const PATH_DEPTH = 3

    const parts = path.split(' > ').filter((p) => p && p !== 'root')
    const lastParts = parts.slice(-PATH_DEPTH)

    return lastParts.length > 0 ? lastParts.join('>') : ''
  }

  private _formatAttributes(node: InteractiveNode): string {
    if (!node.attributes) return ''

    const INCLUDE_ATTRIBUTES = ['type', 'placeholder', 'value', 'aria-label']
    const pairs: string[] = []

    for (const key of INCLUDE_ATTRIBUTES) {
      if (key in node.attributes) {
        const value = node.attributes[key]
        if (value !== undefined && value !== null && value !== '') {
          pairs.push(`${key}=${value}`)
        }
      }
    }

    return pairs.join(' ')
  }
}
