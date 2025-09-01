import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolManager } from "@/lib/tools/ToolManager";

describe("ToolManager", () => {
  let toolManager: ToolManager;
  let mockTool1: DynamicStructuredTool;
  let mockTool2: DynamicStructuredTool;

  beforeEach(() => {
    toolManager = new ToolManager();

    // Create mock tools
    mockTool1 = new DynamicStructuredTool({
      name: "navigate",
      description: "Navigate to a URL",
      schema: z.object({ url: z.string() }),
      func: async () => "Navigation successful",
    });

    mockTool2 = new DynamicStructuredTool({
      name: "click",
      description: "Click on an element",
      schema: z.object({ selector: z.string() }),
      func: async () => "Click successful",
    });
  });

  // Test 1: Tool registration and retrieval
  test("tests that tools can be registered and retrieved by name", () => {
    // Act
    toolManager.register(mockTool1);
    toolManager.register(mockTool2);

    // Assert
    expect(toolManager.get("navigate")).toBe(mockTool1);
    expect(toolManager.get("click")).toBe(mockTool2);
    expect(toolManager.get("nonexistent")).toBeUndefined();
  });

  // Test 2: Get all tools functionality
  test("tests that all registered tools are returned", () => {
    // Act
    toolManager.register(mockTool1);
    toolManager.register(mockTool2);
    const allTools = toolManager.getAll();

    // Assert
    expect(allTools).toHaveLength(2);
    expect(allTools).toContain(mockTool1);
    expect(allTools).toContain(mockTool2);
  });

  // Test 3: Tool descriptions generation for system prompt
  test("tests that formatted descriptions are generated for all tools", () => {
    // Act
    toolManager.register(mockTool1);
    toolManager.register(mockTool2);
    const descriptions = toolManager.getDescriptions();

    // Assert
    expect(descriptions).toContain("navigate");
    expect(descriptions).toContain("Navigate to a URL");
    expect(descriptions).toContain("click");
    expect(descriptions).toContain("Click on an element");
  });

  // Test 4: Prevent duplicate tool registration
  test("tests that tools are overwritten when registered with same name", () => {
    // Arrange
    const updatedMockTool1 = new DynamicStructuredTool({
      name: "navigate",
      description: "Updated navigation tool",
      schema: z.object({ url: z.string(), waitTime: z.number() }),
      func: async () => "Updated navigation",
    });

    // Act
    toolManager.register(mockTool1);
    toolManager.register(updatedMockTool1);

    // Assert
    const retrievedTool = toolManager.get("navigate");
    expect(retrievedTool).toBe(updatedMockTool1);
    expect(retrievedTool?.description).toBe("Updated navigation tool");
    expect(toolManager.getAll()).toHaveLength(1);
  });
});
