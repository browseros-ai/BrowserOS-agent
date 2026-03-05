package mcp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Version    string
	Debug      bool
}

func NewClient(baseURL, version string, timeout time.Duration) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
		Version: version,
	}
}

func (c *Client) connect(ctx context.Context) (*sdkmcp.ClientSession, error) {
	sdkClient := sdkmcp.NewClient(&sdkmcp.Implementation{
		Name:    "browseros-cli",
		Version: c.Version,
	}, nil)

	transport := &sdkmcp.StreamableClientTransport{
		Endpoint:             c.BaseURL + "/mcp",
		HTTPClient:           c.HTTPClient,
		DisableStandaloneSSE: true,
	}

	session, err := sdkClient.Connect(ctx, transport, nil)
	if err != nil {
		return nil, fmt.Errorf("cannot connect to BrowserOS at %s: %w\n  Is the server running? Try: browseros-cli init", c.BaseURL, err)
	}
	return session, nil
}

// CallTool connects, initializes, calls the named tool, and returns the result.
func (c *Client) CallTool(name string, args map[string]any) (*ToolResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), c.HTTPClient.Timeout)
	defer cancel()

	session, err := c.connect(ctx)
	if err != nil {
		return nil, err
	}
	defer session.Close()

	if args == nil {
		args = map[string]any{}
	}

	sdkResult, err := session.CallTool(ctx, &sdkmcp.CallToolParams{
		Name:      name,
		Arguments: args,
	})
	if err != nil {
		return nil, err
	}

	result := convertResult(sdkResult)
	if result.IsError {
		return result, fmt.Errorf("%s", result.TextContent())
	}

	return result, nil
}

func convertResult(r *sdkmcp.CallToolResult) *ToolResult {
	result := &ToolResult{
		IsError: r.IsError,
	}

	for _, c := range r.Content {
		switch v := c.(type) {
		case *sdkmcp.TextContent:
			result.Content = append(result.Content, ContentItem{Type: "text", Text: v.Text})
		case *sdkmcp.ImageContent:
			result.Content = append(result.Content, ContentItem{Type: "image", Data: base64.StdEncoding.EncodeToString(v.Data), MimeType: v.MIMEType})
		}
	}

	if r.StructuredContent != nil {
		switch sc := r.StructuredContent.(type) {
		case map[string]any:
			result.StructuredContent = sc
		default:
			data, err := json.Marshal(sc)
			if err == nil {
				var m map[string]any
				if json.Unmarshal(data, &m) == nil {
					result.StructuredContent = m
				}
			}
		}
	}

	return result
}

// ResolvePageID returns the explicit page ID or fetches the active page.
func (c *Client) ResolvePageID(explicit *int) (int, error) {
	if explicit != nil {
		return *explicit, nil
	}
	result, err := c.CallTool("get_active_page", nil)
	if err != nil {
		return 0, fmt.Errorf("no active page: %w", err)
	}

	if sc := result.StructuredContent; sc != nil {
		if v, ok := sc["pageId"]; ok {
			if f, ok := v.(float64); ok {
				return int(f), nil
			}
		}
	}

	return 0, fmt.Errorf("could not determine active page ID from response")
}

// Health checks the /health endpoint (REST, not MCP).
func (c *Client) Health() (map[string]any, error) {
	return c.restGET("/health")
}

// Status checks the /status endpoint (REST, not MCP).
func (c *Client) Status() (map[string]any, error) {
	return c.restGET("/status")
}

func (c *Client) restGET(path string) (map[string]any, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + path)
	if err != nil {
		return nil, fmt.Errorf("cannot connect to BrowserOS at %s: %w\n  Try: browseros-cli init", c.BaseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return data, nil
}
