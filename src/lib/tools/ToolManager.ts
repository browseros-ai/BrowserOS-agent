import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";

// NTN: Using ToolManager instead of ToolRegistry as requested
// NTN: Only adding necessary methods as requested, can expand later
export class ToolManager {
  private tools: Map<string, DynamicStructuredTool> = new Map();
  private executionContext?: ExecutionContext;

  constructor(executionContext?: ExecutionContext) {
    this.executionContext = executionContext;
  }

  register(tool: DynamicStructuredTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }

  getDescriptions(): string {
    const tools = this.getAll();
    if (tools.length === 0) {
      return "No tools available.";
    }

    const toolDescriptions = tools.map(tool => {
      return `- ${tool.name}: ${tool.description}`;
    }).join("\n");

    return `Available tools:\n${toolDescriptions}`;
  }
}
