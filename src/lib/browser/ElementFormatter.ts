import { z } from "zod";
import type { InteractiveNode, InteractiveNodeType } from "./BrowserOSAdapter";
import { Logging } from "@/lib/utils/Logging";

// ============= Configuration Schema =============

export const ElementDisplayConfigSchema = z.object({
  // What to include
  includeAttributes: z
    .union([
      z.array(z.string()), // Specific attributes to include
      z.boolean(), // true = all attributes, false = none
    ])
    .optional(),
  excludeAttributes: z.array(z.string()).optional(), // Blacklist specific attributes

  // Display options
  showIndentation: z.boolean().optional(), // Show depth-based indentation
  showNodeId: z.boolean().optional(), // Show [nodeId]
  showType: z.boolean().optional(), // Show <C>/<T>/<O> type symbol
  showTag: z.boolean().optional(), // Show <tag>
  showName: z.boolean().optional(), // Show "name"
  showContext: z.boolean().optional(), // Show ctx:"..."
  showPath: z.boolean().optional(), // Show path:"..."
  showViewportStatus: z.boolean().optional(), // Show viewport status inline

  // Formatting
  nameMaxLength: z.number().int().positive().optional(), // Default: 40
  contextMaxLength: z.number().int().positive().optional(), // Default: 60
  pathDepth: z.number().int().positive().optional(), // Path segments to show (default: 3)
  indentSize: z.number().int().nonnegative().optional(), // Spaces per depth level (default: 2)

  // Viewport handling
  separateByViewport: z.boolean().optional(), // Group by viewport visibility
  viewportSeparator: z.string().optional(), // Custom separator text
  prioritizeViewport: z.boolean().optional(), // Show in-viewport first (default: true)

  // Filters
  elementTypes: z.array(z.string()).optional(), // Which types to include
  skipEmptyNames: z.boolean().optional(), // Skip elements without names
  maxElements: z.number().int().positive().optional(), // Limit number of elements

  // Output format
  format: z.enum(["text", "json", "compact", "custom"]).optional(), // Output format

  // Sorting
  sortBy: z.enum(["nodeId", "name", "type", "depth", "none"]).optional(), // Sort elements
  sortOrder: z.enum(["asc", "desc"]).optional(), // Sort direction
});

export type ElementDisplayConfig = z.infer<typeof ElementDisplayConfigSchema>;

// ============= Preset Configurations =============

const DEFAULT_CONFIG: Required<ElementDisplayConfig> = {
  includeAttributes: ["type", "placeholder", "value", "aria-label"],
  excludeAttributes: [],
  showIndentation: true,
  showNodeId: true,
  showType: true,
  showTag: true,
  showName: true,
  showContext: false,
  showPath: false,
  showViewportStatus: true,
  nameMaxLength: 40,
  contextMaxLength: 60,
  pathDepth: 3,
  indentSize: 2,
  separateByViewport: false,
  viewportSeparator:
    "--- IMPORTANT: OUT OF VIEWPORT ELEMENTS, SCROLL TO INTERACT ---",
  prioritizeViewport: true,
  elementTypes: [], // Empty means all types
  skipEmptyNames: false,
  maxElements: 0, // 0 means no limit
  format: "text",
  sortBy: "none",
  sortOrder: "asc",
};

export const PRESETS: Record<string, ElementDisplayConfig> = {
  simplified: {
    showNodeId: true,
    showName: true,
    skipEmptyNames: true,
    includeAttributes: false,
    showIndentation: false,
    showType: false,
    showTag: false,
    showContext: false,
    showPath: false,
    separateByViewport: true,
    format: "text",
  },
  full: {
    ...DEFAULT_CONFIG,
  },
  minimal: {
    showNodeId: true,
    showName: true,
    includeAttributes: false,
    showIndentation: false,
    showType: false,
    showTag: false,
    showContext: false,
    showPath: false,
    separateByViewport: false,
    format: "text",
  },
  debug: {
    ...DEFAULT_CONFIG,
    includeAttributes: true, // Show ALL attributes
    nameMaxLength: 100,
    contextMaxLength: 200,
    showViewportStatus: true,
    format: "text",
  },
  json: {
    format: "json",
    separateByViewport: true,
  },
  compact: {
    showNodeId: true,
    showName: true,
    showTag: true,
    includeAttributes: ["type", "placeholder"],
    showIndentation: false,
    showType: false,
    showContext: false,
    showPath: false,
    nameMaxLength: 30,
    separateByViewport: true,
    skipEmptyNames: false,
    format: "compact",
  },
};

// ============= Element Formatter =============

export class ElementFormatter {
  private config: Required<ElementDisplayConfig>;

  constructor(config?: ElementDisplayConfig | keyof typeof PRESETS) {
    if (!config) {
      this.config = { ...DEFAULT_CONFIG };
    } else if (typeof config === "string") {
      // Use preset configuration
      if (!(config in PRESETS)) {
        throw new Error(`Unknown preset: ${config}`);
      }
      this.config = { ...DEFAULT_CONFIG, ...PRESETS[config] };
    } else {
      // Merge with defaults
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Log configuration for debugging
    const configLines = [
      `ElementFormatter initialized with config:`,
      `  Format: ${this.config.format}`,
      `  Display: nodeId=${this.config.showNodeId}, type=${this.config.showType}, tag=${this.config.showTag}, name=${this.config.showName}`,
      `  Context: show=${this.config.showContext}, maxLength=${this.config.contextMaxLength}`,
      `  Path: show=${this.config.showPath}, depth=${this.config.pathDepth}`,
      `  Attributes: ${Array.isArray(this.config.includeAttributes) ? `[${this.config.includeAttributes.join(", ")}]` : this.config.includeAttributes}`,
      `  Viewport: separate=${this.config.separateByViewport}, prioritize=${this.config.prioritizeViewport}, showStatus=${this.config.showViewportStatus}`,
      `  Filters: skipEmpty=${this.config.skipEmptyNames}, maxElements=${this.config.maxElements || "unlimited"}, types=${this.config.elementTypes.length > 0 ? `[${this.config.elementTypes.join(", ")}]` : "all"}`,
      `  Formatting: indent=${this.config.showIndentation} (${this.config.indentSize} spaces), nameMax=${this.config.nameMaxLength}`,
      `  Sorting: by=${this.config.sortBy}, order=${this.config.sortOrder}`,
    ];

    Logging.log("ElementFormatter", configLines.join("\n"), "info");
  }

  /**
   * Format an array of elements based on configuration
   */
  formatElements(
    elements: InteractiveNode[],
    filter?: (node: InteractiveNode) => boolean,
  ): string {
    // Apply filter
    let filteredElements = filter ? elements.filter(filter) : elements;

    // Apply type filter from config
    if (this.config.elementTypes.length > 0) {
      filteredElements = filteredElements.filter((node) =>
        this.config.elementTypes.includes(node.type),
      );
    }

    // Apply name filter
    if (this.config.skipEmptyNames) {
      filteredElements = filteredElements.filter(
        (node) => node.name && node.name.trim() !== "",
      );
    }

    // Apply sorting
    filteredElements = this._sortElements(filteredElements);

    // Apply max elements limit
    if (this.config.maxElements > 0) {
      filteredElements = filteredElements.slice(0, this.config.maxElements);
    }

    // Format based on output format
    switch (this.config.format) {
      case "json":
        return this._formatAsJSON(filteredElements);
      case "compact":
        return this._formatAsCompact(filteredElements);
      case "text":
      default:
        return this._formatAsText(filteredElements);
    }
  }

  // ============= Private Formatting Methods =============

  private _formatAsText(elements: InteractiveNode[]): string {
    if (this.config.separateByViewport && this.config.prioritizeViewport) {
      return this._formatWithViewportSeparation(elements);
    }

    const lines: string[] = [];
    for (const node of elements) {
      const formatted = this._formatSingleElement(node);
      if (formatted) {
        lines.push(formatted);
      }
    }
    return lines.join("\n");
  }

  private _formatWithViewportSeparation(elements: InteractiveNode[]): string {
    const lines: string[] = [];
    const inViewport: InteractiveNode[] = [];
    const outOfViewport: InteractiveNode[] = [];

    // Separate by viewport visibility
    for (const node of elements) {
      const isInViewport = node.attributes?.in_viewport !== "false";
      if (isInViewport) {
        inViewport.push(node);
      } else {
        outOfViewport.push(node);
      }
    }

    // Format in-viewport elements
    for (const node of inViewport) {
      const formatted = this._formatSingleElement(node);
      if (formatted) {
        lines.push(formatted);
      }
    }

    // Add separator and out-of-viewport elements
    if (outOfViewport.length > 0) {
      if (lines.length > 0) {
        lines.push(""); // Empty line before separator
      }
      lines.push(this.config.viewportSeparator);

      for (const node of outOfViewport) {
        const formatted = this._formatSingleElement(node);
        if (formatted) {
          lines.push(formatted);
        }
      }
    }

    return lines.join("\n");
  }

  private _formatSingleElement(node: InteractiveNode): string {
    const parts: string[] = [];

    // Indentation
    if (this.config.showIndentation) {
      const depth = parseInt(node.attributes?.depth || "0", 10);
      const indent = " ".repeat(this.config.indentSize * depth);
      parts.push(indent);
    }

    // Node ID
    if (this.config.showNodeId) {
      parts.push(`[${node.nodeId}]`);
    }

    // Type symbol
    if (this.config.showType) {
      parts.push(`<${this._getTypeSymbol(node.type)}>`);
    }

    // HTML tag
    if (this.config.showTag) {
      const tag =
        node.attributes?.["html-tag"] || node.attributes?.role || "div";
      parts.push(`<${tag}>`);
    }

    // Name
    if (this.config.showName && node.name) {
      const truncated = this._truncateText(
        node.name,
        this.config.nameMaxLength,
      );
      parts.push(`"${truncated}"`);
    }

    // Context
    if (this.config.showContext && node.attributes?.context) {
      const truncated = this._truncateText(
        node.attributes.context,
        this.config.contextMaxLength,
      );
      parts.push(`ctx:"${truncated}"`);
    }

    // Path
    if (this.config.showPath && node.attributes?.path) {
      const formatted = this._formatPath(node.attributes.path);
      if (formatted) {
        parts.push(`path:"${formatted}"`);
      }
    }

    // Viewport status (inline)
    if (this.config.showViewportStatus && !this.config.separateByViewport) {
      const isInViewport = node.attributes?.in_viewport !== "false";
      if (!isInViewport) {
        parts.push("(off-screen)");
      }
    }

    // Attributes
    const attrString = this._formatAttributes(node);
    if (attrString) {
      parts.push(`attr:"${attrString}"`);
    }

    return parts.join(" ");
  }

  private _formatAsJSON(elements: InteractiveNode[]): string {
    const output: any = {};

    if (this.config.separateByViewport && this.config.prioritizeViewport) {
      const inViewport: any[] = [];
      const outOfViewport: any[] = [];

      for (const node of elements) {
        const isInViewport = node.attributes?.in_viewport !== "false";
        const jsonNode = this._nodeToJSON(node);

        if (isInViewport) {
          inViewport.push(jsonNode);
        } else {
          outOfViewport.push(jsonNode);
        }
      }

      output.inViewport = inViewport;
      output.outOfViewport = outOfViewport;
    } else {
      output.elements = elements.map((node) => this._nodeToJSON(node));
    }

    return JSON.stringify(output, null, 2);
  }

  private _nodeToJSON(node: InteractiveNode): any {
    const json: any = {
      nodeId: node.nodeId,
      type: node.type,
    };

    if (this.config.showName && node.name) {
      json.name = node.name;
    }

    if (this.config.showTag) {
      json.tag = node.attributes?.["html-tag"] || node.attributes?.role || "";
    }

    // Include configured attributes
    const attrs = this._getAttributesToShow(node);
    if (Object.keys(attrs).length > 0) {
      json.attributes = attrs;
    }

    if (node.rect) {
      json.rect = node.rect;
    }

    return json;
  }

  private _formatAsCompact(elements: InteractiveNode[]): string {
    const lines: string[] = [];

    for (const node of elements) {
      const parts: string[] = [];

      // Minimal format: [id] name/type
      parts.push(`[${node.nodeId}]`);

      if (node.name) {
        parts.push(this._truncateText(node.name, 30));
      } else if (node.attributes?.placeholder) {
        parts.push(this._truncateText(node.attributes.placeholder, 30));
      } else if (node.attributes?.type) {
        parts.push(node.attributes.type);
      } else {
        parts.push(node.type);
      }

      lines.push(parts.join(" "));
    }

    return lines.join("\n");
  }

  // ============= Helper Methods =============

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

    const parts = path.split(" > ").filter((p) => p && p !== "root");
    const lastParts = parts.slice(-this.config.pathDepth);

    return lastParts.length > 0 ? lastParts.join(">") : "";
  }

  private _formatAttributes(node: InteractiveNode): string {
    const attrs = this._getAttributesToShow(node);
    const pairs: string[] = [];

    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null && value !== "") {
        pairs.push(`${key}=${value}`);
      }
    }

    return pairs.join(" ");
  }

  private _getAttributesToShow(node: InteractiveNode): Record<string, any> {
    if (!node.attributes) return {};

    const result: Record<string, any> = {};

    // Determine which attributes to include
    if (this.config.includeAttributes === false) {
      return {};
    }

    if (this.config.includeAttributes === true) {
      // Include all attributes except excluded ones
      for (const [key, value] of Object.entries(node.attributes)) {
        if (!this.config.excludeAttributes.includes(key)) {
          // Skip some internal attributes
          if (
            ![
              "depth",
              "path",
              "context",
              "html-tag",
              "role",
              "in_viewport",
            ].includes(key)
          ) {
            result[key] = value;
          }
        }
      }
    } else if (Array.isArray(this.config.includeAttributes)) {
      // Include only specified attributes
      for (const key of this.config.includeAttributes) {
        if (
          key in node.attributes &&
          !this.config.excludeAttributes.includes(key)
        ) {
          result[key] = node.attributes[key];
        }
      }
    }

    return result;
  }

  private _sortElements(elements: InteractiveNode[]): InteractiveNode[] {
    if (this.config.sortBy === "none") {
      return elements;
    }

    const sorted = [...elements];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (this.config.sortBy) {
        case "nodeId":
          comparison = a.nodeId - b.nodeId;
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "depth":
          const depthA = parseInt(a.attributes?.depth || "0", 10);
          const depthB = parseInt(b.attributes?.depth || "0", 10);
          comparison = depthA - depthB;
          break;
      }

      return this.config.sortOrder === "desc" ? -comparison : comparison;
    });

    return sorted;
  }

  // ============= Static Helper Methods =============

  /**
   * Get a preset configuration
   */
  static getPreset(name: keyof typeof PRESETS): ElementDisplayConfig {
    return { ...DEFAULT_CONFIG, ...PRESETS[name] };
  }

  /**
   * Create a custom configuration by merging with defaults
   */
  static createConfig(
    overrides: ElementDisplayConfig,
  ): Required<ElementDisplayConfig> {
    return { ...DEFAULT_CONFIG, ...overrides };
  }
}
