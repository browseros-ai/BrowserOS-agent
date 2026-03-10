package mcp

// ToolResult is the result from an MCP tools/call.
type ToolResult struct {
	Content           []ContentItem  `json:"content"`
	StructuredContent map[string]any `json:"structuredContent,omitempty"`
	IsError           bool           `json:"isError,omitempty"`
}

type ContentItem struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

// TextContent returns the first text content item, or empty string.
func (r *ToolResult) TextContent() string {
	for _, c := range r.Content {
		if c.Type == "text" {
			return c.Text
		}
	}
	return ""
}

// ImageContent returns the first image content item, or nil.
func (r *ToolResult) ImageContent() *ContentItem {
	for i, c := range r.Content {
		if c.Type == "image" {
			return &r.Content[i]
		}
	}
	return nil
}
