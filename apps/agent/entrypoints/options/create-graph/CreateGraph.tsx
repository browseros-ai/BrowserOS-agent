import type { FC } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import '@xyflow/react/dist/style.css'
import { useRpcClient } from '@/lib/rpc/RpcClientProvider'
import { GraphCanvas } from './GraphCanvas'
import { GraphChat } from './GraphChat'

export const CreateGraph: FC = () => {
  const [graphName, setGraphName] = useState('')

  const client = useRpcClient()

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <GraphCanvas
            graphName={graphName}
            onGraphNameChange={(val) => setGraphName(val)}
          />
        </ResizablePanel>

        {/* Resizable Handle */}
        <ResizableHandle withHandle />

        <ResizablePanel>
          <GraphChat />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
