import { describe, it, expect } from "vitest";
import { ElementFormatter, PRESETS, ElementDisplayConfigSchema } from "./ElementFormatter";
import type { InteractiveNode } from "./BrowserOSAdapter";

describe("ElementFormatter", () => {
  // Sample test data
  const mockElements: InteractiveNode[] = [
    {
      nodeId: 1,
      type: "clickable",
      name: "Submit Button",
      attributes: {
        "html-tag": "button",
        "in_viewport": "true",
        "depth": "2",
        "context": "Form submission button in the main form",
        "path": "root > body > main > form > button",
        "type": "submit",
        "aria-label": "Submit form",
      },
    },
    {
      nodeId: 2,
      type: "typeable",
      name: "",
      attributes: {
        "html-tag": "input",
        "in_viewport": "false",
        "depth": "3",
        "placeholder": "Enter your email",
        "type": "email",
        "value": "",
      },
    },
    {
      nodeId: 3,
      type: "clickable",
      name: "Cancel",
      attributes: {
        "html-tag": "a",
        "in_viewport": "true",
        "depth": "2",
        "href": "/cancel",
      },
    },
  ];

  it("tests that the formatter can be created with default configuration", () => {
    const formatter = new ElementFormatter();
    expect(formatter).toBeDefined();
  });

  it("tests that the formatter can be created with preset configurations", () => {
    const formatter = new ElementFormatter("simplified");
    expect(formatter).toBeDefined();
    
    const formatter2 = new ElementFormatter("json");
    expect(formatter2).toBeDefined();
  });

  it("tests that the formatter handles invalid preset names gracefully", () => {
    expect(() => new ElementFormatter("invalid" as any)).toThrow("Unknown preset");
  });

  it("tests that JSON format returns valid JSON structure", () => {
    const formatter = new ElementFormatter({ format: "json" });
    const result = formatter.formatElements(mockElements);
    
    // Should parse without error
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(parsed.inViewport).toBeInstanceOf(Array);
    expect(parsed.outOfViewport).toBeInstanceOf(Array);
  });

  it("tests that viewport separation works correctly", () => {
    const formatter = new ElementFormatter({
      format: "text",
      separateByViewport: true,
      showNodeId: true,
      showName: true,
    });
    
    const result = formatter.formatElements(mockElements);
    
    // Should contain separator text
    expect(result).toContain("Not visible, scroll to activate");
    
    // In-viewport elements should appear before separator
    expect(result.indexOf("[1]")).toBeLessThan(
      result.indexOf("Not visible, scroll to activate")
    );
    expect(result.indexOf("[3]")).toBeLessThan(
      result.indexOf("Not visible, scroll to activate")
    );
    
    // Out-of-viewport element should appear after separator
    expect(result.indexOf("[2]")).toBeGreaterThan(
      result.indexOf("Not visible, scroll to activate")
    );
  });

  it("tests that element filtering works correctly", () => {
    const formatter = new ElementFormatter({ 
      elementTypes: ["clickable"],
      showNodeId: true,
    });
    
    const result = formatter.formatElements(mockElements);
    
    // Should include clickable elements
    expect(result).toContain("[1]");
    expect(result).toContain("[3]");
    
    // Should not include typeable element
    expect(result).not.toContain("[2]");
  });

  it("tests that custom filter functions work", () => {
    const formatter = new ElementFormatter({ showNodeId: true });
    
    const result = formatter.formatElements(
      mockElements,
      node => node.nodeId > 1
    );
    
    // Should not include element with nodeId 1
    expect(result).not.toContain("[1]");
    
    // Should include elements with nodeId > 1
    expect(result).toContain("[2]");
    expect(result).toContain("[3]");
  });

  it("tests that sorting works correctly", () => {
    const formatter = new ElementFormatter({
      sortBy: "name",
      sortOrder: "asc",
      showNodeId: true,
      showName: true,
      separateByViewport: false,
    });
    
    const result = formatter.formatElements(mockElements);
    const lines = result.split("\n").filter(l => l.trim());
    
    // Empty name should come first (nodeId 2)
    // Then "Cancel" (nodeId 3)
    // Then "Submit Button" (nodeId 1)
    expect(lines[0]).toContain("[2]");
    expect(lines[1]).toContain("[3]");
    expect(lines[2]).toContain("[1]");
  });

  it("tests that compact format works", () => {
    const formatter = new ElementFormatter({ format: "compact" });
    const result = formatter.formatElements(mockElements);
    
    const lines = result.split("\n");
    
    // Compact format should be simple: [id] name/type
    expect(lines[0]).toMatch(/^\[1\] Submit Button$/);
    expect(lines[1]).toMatch(/^\[2\] Enter your email$/);  // Uses placeholder
    expect(lines[2]).toMatch(/^\[3\] Cancel$/);
  });

  it("tests that attribute inclusion/exclusion works", () => {
    const formatter = new ElementFormatter({
      includeAttributes: ["type", "href"],
      showNodeId: true,
      separateByViewport: false,
    });
    
    const result = formatter.formatElements(mockElements);
    
    // Should include specified attributes
    expect(result).toContain("type=submit");
    expect(result).toContain("type=email");
    expect(result).toContain("href=/cancel");
    
    // Should not include other attributes
    expect(result).not.toContain("aria-label");
    expect(result).not.toContain("placeholder");
  });

  it("tests that configuration schema validation works", () => {
    const validConfig = {
      format: "json",
      showNodeId: true,
      nameMaxLength: 50,
    };
    
    const parsed = ElementDisplayConfigSchema.parse(validConfig);
    expect(parsed.format).toBe("json");
    expect(parsed.showNodeId).toBe(true);
    expect(parsed.nameMaxLength).toBe(50);
    
    // Invalid format should throw
    const invalidConfig = {
      format: "invalid",
    };
    
    expect(() => ElementDisplayConfigSchema.parse(invalidConfig)).toThrow();
  });

  it("tests that text truncation works", () => {
    const longNameElement: InteractiveNode = {
      nodeId: 4,
      type: "clickable",
      name: "This is a very long button name that should be truncated according to the configuration",
      attributes: {},
    };
    
    const formatter = new ElementFormatter({
      nameMaxLength: 20,
      showName: true,
      showNodeId: true,
    });
    
    const result = formatter.formatElements([longNameElement]);
    
    // Name should be truncated to 20 chars (17 + "...")
    expect(result).toContain("This is a very lo...");
    expect(result).not.toContain("should be truncated");
  });

  it("tests that skipEmptyNames filter works", () => {
    const elementsWithEmptyNames: InteractiveNode[] = [
      { nodeId: 1, type: "clickable", name: "Valid Name", attributes: {} },
      { nodeId: 2, type: "clickable", name: "", attributes: {} },
      { nodeId: 3, type: "clickable", name: "   ", attributes: {} },
      { nodeId: 4, type: "clickable", attributes: {} },  // No name property
    ];
    
    const formatter = new ElementFormatter({
      skipEmptyNames: true,
      showNodeId: true,
    });
    
    const result = formatter.formatElements(elementsWithEmptyNames);
    
    // Should only include element with valid name
    expect(result).toContain("[1]");
    expect(result).not.toContain("[2]");
    expect(result).not.toContain("[3]");
    expect(result).not.toContain("[4]");
  });

  it("tests that maxElements limit works", () => {
    const formatter = new ElementFormatter({
      maxElements: 2,
      showNodeId: true,
      separateByViewport: false,
    });
    
    const result = formatter.formatElements(mockElements);
    const lines = result.split("\n").filter(l => l.trim());
    
    // Should only include first 2 elements
    expect(lines).toHaveLength(2);
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
    expect(result).not.toContain("[3]");
  });
});