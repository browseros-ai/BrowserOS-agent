import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import {
  ArrowLeft,
  Maximize,
  Minus,
  Pencil,
  Play,
  Plus,
  Save,
} from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import useDeepCompareEffect from 'use-deep-compare-effect'
import ProductLogo from '@/assets/product_logo.svg'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { GraphData } from './CreateGraph'
import type { NodeType } from './CustomNode'

cytoscape.use(dagre)

const NODE_COLORS: Record<NodeType, string> = {
  start: '#22c55e',
  end: '#ef4444',
  nav: '#3b82f6',
  act: '#8b5cf6',
  extract: '#f59e0b',
  verify: '#10b981',
  decision: '#ec4899',
  loop: '#06b6d4',
  fork: '#6366f1',
  join: '#84cc16',
}

const initialData: GraphData = {
  nodes: [
    {
      id: 'start',
      type: 'start',
      data: { label: 'Use the Chat to build your workflow!' },
    },
  ],
  edges: [],
}

type GraphCanvasProps = {
  graphName: string
  onGraphNameChange: (name: string) => void
  graphData?: GraphData
  codeId?: string
  onClickTest: () => unknown
  onClickSave: () => unknown
  isSaved: boolean
  hasUnsavedChanges: boolean
  shouldBlockNavigation: boolean
  panelSize?: { asPercentage: number; inPixels: number }
}

export const GraphCanvas: FC<GraphCanvasProps> = ({
  graphName,
  onGraphNameChange,
  graphData = initialData,
  codeId,
  onClickTest,
  onClickSave,
  isSaved,
  hasUnsavedChanges,
  shouldBlockNavigation,
  panelSize,
}) => {
  const [isEditingName, setIsEditingName] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  const handleBack = () => {
    if (shouldBlockNavigation) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?',
      )
      if (!confirmed) return
    }
    navigate(-1)
  }

  const canTest = !!codeId
  const canSave = !!graphName && !!codeId && hasUnsavedChanges

  const getTestTooltip = () => {
    if (!codeId) return 'Create a workflow using the chat first'
    return 'Run a test of this workflow'
  }

  const getSaveTooltip = () => {
    if (!codeId) return 'Create a workflow using the chat first'
    if (!graphName) return 'Provide a name for the workflow'
    if (isSaved && !hasUnsavedChanges) return 'Workflow already saved'
    return isSaved ? 'Save changes to this workflow' : 'Save this workflow'
  }

  const getSaveButtonLabel = () => {
    return isSaved ? 'Save Changes' : 'Save Workflow'
  }

  const zoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.2)
    cyRef.current?.center()
  }, [])

  const zoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.2)
    cyRef.current?.center()
  }, [])

  const fitView = useCallback(() => {
    cyRef.current?.fit(undefined, 50)
    cyRef.current?.center()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '140px',
            'font-size': '12px',
            'font-family': 'system-ui, sans-serif',
            color: '#ffffff',
            'background-color': 'data(color)',
            shape: 'round-rectangle',
            width: 'label',
            height: 50,
            padding: '20px',
            'border-width': 2,
            'border-color': 'data(borderColor)',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#f97316',
            'target-arrow-color': '#f97316',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: 'edge.back-edge',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3],
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [80],
            'control-point-weights': [0.5],
          },
        },
      ],
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single',
      autoungrabify: true,
      autounselectify: true,
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
    }
  }, [])

  const updateGraph = useCallback((data: GraphData) => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().remove()

    const nodes = data.nodes.map((node) => {
      const nodeType = node.type as NodeType
      const baseColor = NODE_COLORS[nodeType] || '#6b7280'
      return {
        data: {
          id: node.id,
          label: node.data.label,
          type: node.type,
          color: baseColor,
          borderColor: baseColor,
        },
      }
    })

    const edges = data.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      },
    }))

    cy.add([...nodes, ...edges])

    cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 60,
      rankSep: 80,
      padding: 30,
      animate: true,
      animationDuration: 300,
      fit: true,
    } as cytoscape.LayoutOptions).run()

    setTimeout(() => {
      cy.edges().forEach((edge) => {
        const sourceNode = edge.source()
        const targetNode = edge.target()
        const sourceY = sourceNode.position('y')
        const targetY = targetNode.position('y')

        if (sourceY > targetY) {
          edge.addClass('back-edge')
        }
      })
    }, 350)
  }, [])

  useDeepCompareEffect(() => {
    updateGraph(graphData)
  }, [graphData])

  useEffect(() => {
    if (panelSize?.inPixels !== undefined) {
      cyRef.current?.resize()
      setTimeout(() => fitView(), 100)
    }
  }, [panelSize?.inPixels, fitView])

  return (
    <div className="flex h-full flex-col">
      {/* Graph Header */}
      <header className="flex items-center justify-between border-border/40 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <img src={ProductLogo} alt="BrowserOS" className="h-8 w-8 shrink-0" />
          {isEditingName ? (
            <input
              type="text"
              value={graphName}
              onChange={(e) => onGraphNameChange(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false)
              }}
              // biome-ignore lint/a11y/noAutofocus: needed to autofocus field when edit mode is toggled
              autoFocus
              placeholder="Enter workflow name..."
              className="max-w-64 border-[var(--accent-orange)] border-b bg-transparent font-semibold text-sm outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingName(true)}
              className="group min-w-0 gap-2 px-2 py-1"
            >
              {graphName ? (
                <span className="truncate font-semibold text-sm">
                  {graphName}
                </span>
              ) : (
                <span className="text-muted-foreground/60 text-sm italic">
                  Untitled workflow
                </span>
              )}
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Button>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onClickTest}
                  disabled={!canTest}
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  Test Workflow
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{getTestTooltip()}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={onClickSave}
                  disabled={!canSave}
                  className="bg-[var(--accent-orange)] shadow-lg shadow-orange-500/20 hover:bg-[var(--accent-orange-bright)] disabled:bg-[var(--accent-orange)]/50"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {getSaveButtonLabel()}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{getSaveTooltip()}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Graph Canvas */}
      <div className="relative flex-1 bg-[hsl(var(--background))]">
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* Zoom Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg border-2 border-border bg-card p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fitView}
            title="Fit view"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
