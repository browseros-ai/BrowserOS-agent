package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"time"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Version    string
	Debug      bool
	reqID      atomic.Int32
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

func (c *Client) nextID() int {
	return int(c.reqID.Add(1))
}

func (c *Client) sendRPC(method string, params any) (json.RawMessage, error) {
	req := jsonrpcRequest{
		JSONRPC: "2.0",
		ID:      c.nextID(),
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	if c.Debug {
		fmt.Printf("[debug] POST %s/mcp %s\n", c.BaseURL, method)
	}

	httpReq, err := http.NewRequest("POST", c.BaseURL+"/mcp", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("cannot connect to BrowserOS at %s: %w\n  Is the server running? Check: browseros-cli health", c.BaseURL, err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if c.Debug {
		fmt.Printf("[debug] Response (%d): %s\n", resp.StatusCode, string(data))
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("server returned HTTP %d: %s", resp.StatusCode, string(data))
	}

	var rpcResp jsonrpcResponse
	if err := json.Unmarshal(data, &rpcResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, rpcResp.Error
	}

	raw, err := json.Marshal(rpcResp.Result)
	if err != nil {
		return nil, fmt.Errorf("marshal result: %w", err)
	}

	return raw, nil
}

func (c *Client) initialize() error {
	params := initializeParams{
		ProtocolVersion: "2025-06-18",
		ClientInfo: clientInfo{
			Name:    "browseros-cli",
			Version: c.Version,
		},
	}
	_, err := c.sendRPC("initialize", params)
	return err
}

// CallTool sends initialize + tools/call and returns the result.
func (c *Client) CallTool(name string, args map[string]any) (*ToolResult, error) {
	if err := c.initialize(); err != nil {
		return nil, fmt.Errorf("initialize: %w", err)
	}

	params := toolCallParams{
		Name:      name,
		Arguments: args,
	}

	raw, err := c.sendRPC("tools/call", params)
	if err != nil {
		return nil, err
	}

	var result ToolResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse tool result: %w", err)
	}

	if result.IsError {
		return &result, fmt.Errorf("%s", result.TextContent())
	}

	return &result, nil
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
		return nil, fmt.Errorf("cannot connect to BrowserOS at %s: %w", c.BaseURL, err)
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
