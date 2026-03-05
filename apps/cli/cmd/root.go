package cmd

import (
	"os"
	"strconv"
	"time"

	"browseros-cli/mcp"

	"github.com/spf13/cobra"
)

var (
	serverURL string
	pageFlag  int
	pageSet   bool
	jsonOut   bool
	debug     bool
	timeout   time.Duration
	version   = "dev"
)

func SetVersion(v string) {
	version = v
}

var rootCmd = &cobra.Command{
	Use:   "browseros-cli",
	Short: "Browser control CLI for BrowserOS",
	Long:  "browseros-cli — command-line interface for controlling BrowserOS via MCP",
	SilenceUsage:  true,
	SilenceErrors: true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	defaultURL := "http://127.0.0.1:9100"
	if env := os.Getenv("BROWSEROS_URL"); env != "" {
		defaultURL = env
	}

	rootCmd.PersistentFlags().StringVarP(&serverURL, "server", "s", defaultURL, "BrowserOS server URL")
	rootCmd.PersistentFlags().IntVarP(&pageFlag, "page", "p", 0, "Target page ID (default: active page)")
	rootCmd.PersistentFlags().BoolVar(&jsonOut, "json", envBool("BOS_JSON"), "JSON output")
	rootCmd.PersistentFlags().BoolVar(&debug, "debug", envBool("BOS_DEBUG"), "Debug output")
	rootCmd.PersistentFlags().DurationVarP(&timeout, "timeout", "t", 120*time.Second, "Request timeout")

	rootCmd.Version = version
}

func newClient() *mcp.Client {
	c := mcp.NewClient(serverURL, version, timeout)
	c.Debug = debug
	return c
}

func resolvePageID(c *mcp.Client) (int, error) {
	if rootCmd.PersistentFlags().Changed("page") {
		return pageFlag, nil
	}

	if env := os.Getenv("BROWSEROS_PAGE"); env != "" {
		if v, err := strconv.Atoi(env); err == nil {
			return v, nil
		}
	}

	return c.ResolvePageID(nil)
}

func envBool(key string) bool {
	v := os.Getenv(key)
	return v == "1" || v == "true"
}
