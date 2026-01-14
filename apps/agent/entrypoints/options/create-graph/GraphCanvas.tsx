import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Bot, Pencil, Play, Save } from 'lucide-react'
import type { FC } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { GraphData } from './CreateGraph'
import { CustomNode, type NodeType } from './CustomNode'

const nodeTypes: Record<NodeType, typeof CustomNode> = {
  start: CustomNode,
  end: CustomNode,
  nav: CustomNode,
  act: CustomNode,
  extract: CustomNode,
  verify: CustomNode,
  decision: CustomNode,
  loop: CustomNode,
  fork: CustomNode,
  join: CustomNode,
}

const initialData: GraphData = {
  nodes: [{ id: 'start', type: 'start', data: { label: 'Start' } }],
  edges: [],
}

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const nodeWidth = 180
const nodeHeight = 60

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    }
  })

  return { nodes, edges }
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
}) => {
  const [isEditingName, setIsEditingName] = useState(false)

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

  // Initialize nodes and edges with layout
  const initialLayout = getLayoutedElements(
    graphData.nodes.map((n) => ({
      ...n,
      data: { ...n.data, type: n.type },
      position: { x: 0, y: 0 },
    })),
    graphData.edges,
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges)

  // Handle graph updates from chat
  const handleGraphUpdate = useCallback(
    (newGraphData: { nodes: any[]; edges: any[] }) => {
      const layouted = getLayoutedElements(
        newGraphData.nodes.map((n) => ({
          ...n,
          data: { ...n.data, type: n.type },
          position: { x: 0, y: 0 },
        })),
        newGraphData.edges,
      )
      setNodes(layouted.nodes)
      setEdges(layouted.edges)
    },
    [setNodes, setEdges],
  )

  useDeepCompareEffect(() => {
    handleGraphUpdate(graphData)
  }, [graphData])

  return (
    <div className="flex h-full flex-col">
      {/* Graph Header */}
      <header className="flex items-center justify-between border-border/40 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-orange)] to-[var(--accent-orange-bright)] text-white shadow-lg shadow-orange-500/20">
            <Bot className="h-5 w-5" />
          </div>
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
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          nodesFocusable={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            style: { stroke: 'var(--accent-orange)', strokeWidth: 2 },
            type: 'smoothstep',
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
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
              return colors[node.type || 'default'] || '#gray'
            }}
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
