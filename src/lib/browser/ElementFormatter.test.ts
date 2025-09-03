import { describe, it, expect } from "vitest";
import { ElementFormatter } from "./ElementFormatter";
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

  it("tests that the formatter can be created with full mode", () => {
    const formatter = new ElementFormatter(false);  // Full mode
    expect(formatter).toBeDefined();
  });

  it("tests that the formatter can be created with simplified mode", () => {
    const formatter = new ElementFormatter(true);  // Simplified mode
    expect(formatter).toBeDefined();
  });

  it("tests that full format includes all details", () => {
    const formatter = new ElementFormatter(false);  // Full mode
    const result = formatter.formatElements([mockElements[0]]);
    
    // Full format should include indentation, nodeId, type, tag, name, context, path, attributes
    expect(result).toContain("[1]");  // nodeId
    expect(result).toContain("<C>");  // type symbol for clickable
    expect(result).toContain("<button>");  // tag
    expect(result).toContain('"Submit Button"');  // name
    expect(result).toContain('ctx:"Form submission button');  // context
    expect(result).toContain('path:"main>form>button"');  // path (truncated)
    expect(result).toContain("type=submit");  // attributes
  });

  it("tests that simplified format shows minimal info", () => {
    const formatter = new ElementFormatter(true);  // Simplified mode
    const result = formatter.formatElements([mockElements[0]]);
    
    // Simplified format should only show nodeId, tag, and name
    expect(result).toContain("[1]");  // nodeId
    expect(result).toContain("<button>");  // tag
    expect(result).toContain('"Submit Button"');  // name
    
    // Should NOT include these in simplified mode
    expect(result).not.toContain("<C>");  // no type symbol
    expect(result).not.toContain("ctx:");  // no context
    expect(result).not.toContain("path:");  // no path
    expect(result).not.toContain("type=submit");  // no attributes
  });

  it("tests that viewport separation works", () => {
    // Add an out-of-viewport element with a name so it doesn't get filtered
    const elementsWithViewport: InteractiveNode[] = [
      ...mockElements.slice(0, 1),  // In viewport: Submit Button
      {
        nodeId: 4,
        type: "typeable",
        name: "Email Input",  // Has name so won't be filtered
        attributes: {
          "html-tag": "input",
          "in_viewport": "false",
          "type": "email",
        },
      },
      mockElements[2],  // In viewport: Cancel
    ];
    
    const formatter = new ElementFormatter(false);  // Full mode
    const result = formatter.formatElements(elementsWithViewport);
    
    // Should contain separator text
    expect(result).toContain("OUT OF VIEWPORT ELEMENTS");
    
    // In-viewport elements should appear before separator
    const separatorIndex = result.indexOf("OUT OF VIEWPORT");
    expect(result.indexOf("[1]")).toBeLessThan(separatorIndex);
    expect(result.indexOf("[3]")).toBeLessThan(separatorIndex);
    
    // Out-of-viewport element should appear after separator
    expect(result.indexOf("[4]")).toBeGreaterThan(separatorIndex);
  });

  it("tests that empty names are filtered", () => {
    const elementsWithEmptyNames: InteractiveNode[] = [
      { nodeId: 1, type: "clickable", name: "Valid Name", attributes: {} },
      { nodeId: 2, type: "clickable", name: "", attributes: {} },
      { nodeId: 3, type: "clickable", name: "   ", attributes: {} },
    ];
    
    const formatter = new ElementFormatter(false);
    const result = formatter.formatElements(elementsWithEmptyNames);
    
    // Should only include element with valid name
    expect(result).toContain("[1]");
    expect(result).not.toContain("[2]");
    expect(result).not.toContain("[3]");
  });
});