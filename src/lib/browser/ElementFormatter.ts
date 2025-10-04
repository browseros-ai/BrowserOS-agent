import type { InteractiveNode } from "./BrowserOSAdapter";

// ============= Element Formatter =============

export class ElementFormatter {
  private simplified: boolean;

  constructor(simplified: boolean = false) {
    this.simplified = simplified;
  }

  /**
   * Format an array of elements
   */
  formatElements(elements: InteractiveNode[], hideHiddenElements: boolean = false): string {
    // Flags for formatting control
    const SKIP_OUT_OF_VIEWPORT = hideHiddenElements; // Skip out-of-viewport elements entirely
    const SORT_BY_NODEID = true; // Sort by nodeId (ascending)
    const MAX_ELEMENTS = 0; // 0 means no limit

    let filteredElements = [...elements];

    if (SKIP_OUT_OF_VIEWPORT) {
      filteredElements = filteredElements.filter(
        (node) => node.attributes?.in_viewport !== "false",
      );
    }

    // Apply sorting
    if (SORT_BY_NODEID) {
      filteredElements.sort((a, b) => a.nodeId - b.nodeId);
    }

    // Apply max elements limit
    if (MAX_ELEMENTS > 0) {
      filteredElements = filteredElements.slice(0, MAX_ELEMENTS);
    }

    // Format without separation
    const lines: string[] = [];
    for (const node of filteredElements) {
      const formatted = this.formatElement(node);
      if (formatted) {
        lines.push(formatted);
      }
    }
    if (SKIP_OUT_OF_VIEWPORT) {
      lines.push("--- IMPORTANT: OUT OF VIEWPORT ELEMENTS, SCROLL TO INTERACT ---");
    }
    return lines.join("\n");
  }

  /**
   * Format a single element
   */
  formatElement(node: InteractiveNode): string {
    let SHOW_INDENTATION = true;
    const SHOW_NODEID = true;
    const SHOW_TYPE = true;
    const SHOW_TAG = true;
    const SHOW_NAME = true;
    let SHOW_CONTEXT = true;
    let SHOW_PATH = false;
    let SHOW_ATTRIBUTES = true;
    const SHOW_VALUE_FOR_TYPEABLE = true; // Show value attribute for typeable elements
    const APPEND_VIEWPORT_STATUS = true; // Append (visible)/(hidden) to indicate viewport status
    const INDENT_SIZE = 2;
    if (this.simplified) {
      SHOW_CONTEXT = false;
      SHOW_ATTRIBUTES = false;
      SHOW_PATH = false;
      SHOW_INDENTATION = false;
    } 
    const parts: string[] = [];

    if (SHOW_INDENTATION) {
      const depth = parseInt(node.attributes?.depth || "0", 10);
      const indent = " ".repeat(INDENT_SIZE * depth);
      parts.push(indent);
    }

    if (SHOW_NODEID) {
      parts.push(`[${node.nodeId}]`);
    }

    if (SHOW_TYPE) {
      parts.push(`<${this._getTypeSymbol(node.type)}>`);
    }

    if (SHOW_TAG) {
      const tag =
        node.attributes?.["html-tag"] || node.attributes?.role || "div";
      parts.push(`<${tag}>`);
    }

    if (SHOW_NAME && node.name) {
      const truncated = this._truncateText(node.name, 40);
      parts.push(`"${truncated}"`);
    } else if (node.type === "typeable") {
      // For typeable elements without names, show placeholder, id, or input type
      const placeholder = node.attributes?.placeholder;
      const id = node.attributes?.id;
      const inputType = node.attributes?.["input-type"] || "text";
      if (placeholder) {
        parts.push(`placeholder="${this._truncateText(placeholder, 30)}"`);
      } else if (id) {
        parts.push(`id="${this._truncateText(id, 10)}"`);
      } else {
        parts.push(`type="${inputType}"`);
      }
    }

    if (SHOW_CONTEXT && node.attributes?.context) {
      const truncated = this._truncateText(node.attributes.context, 60);
      parts.push(`ctx:"${truncated}"`);
    }

    if (SHOW_PATH && node.attributes?.path) {
      const formatted = this._formatPath(node.attributes.path);
      if (formatted) {
        parts.push(`path:"${formatted}"`);
      }
    }

    if (SHOW_ATTRIBUTES) {
      const attrString = this._formatAttributes(node);
      if (attrString) {
        parts.push(`attr:"${attrString}"`);
      }
    }

    // Show value for typeable elements (if not already shown in attributes)
    if (
      SHOW_VALUE_FOR_TYPEABLE &&
      !SHOW_ATTRIBUTES &&
      node.type === "typeable" &&
      node.attributes?.value
    ) {
      const value = this._truncateText(node.attributes.value, 40);
      parts.push(`value="${value}"`);
    }

    // Append viewport status
    if (APPEND_VIEWPORT_STATUS) {
      const isInViewport = node.attributes?.in_viewport !== "false";
      parts.push(isInViewport ? "(visible)" : "(hidden)");
    }

    return parts.join(" ");
  }

  // ============= Private Helper Methods =============
  private _getTypeSymbol(type: string): string {
    switch (type) {
      case "clickable":
      case "selectable":
        return "C";
      case "typeable":
        return "T";
      default:
        return "O";
    }
  }

  private _truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  private _formatPath(path: string): string {
    if (!path) return "";
    const PATH_DEPTH = 3; // Number of path segments to show

    const parts = path.split(" > ").filter((p) => p && p !== "root");
    const lastParts = parts.slice(-PATH_DEPTH);

    return lastParts.length > 0 ? lastParts.join(">") : "";
  }

  private _formatAttributes(node: InteractiveNode): string {
    if (!node.attributes) return "";

    const INCLUDE_ATTRIBUTES = ["type", "placeholder", "value", "aria-label"]; // Attributes to show
    const pairs: string[] = [];

    for (const key of INCLUDE_ATTRIBUTES) {
      if (key in node.attributes) {
        const value = node.attributes[key];
        if (value !== undefined && value !== null && value !== "") {
          pairs.push(`${key}=${value}`);
        }
      }
    }

    return pairs.join(" ");
  }
}
