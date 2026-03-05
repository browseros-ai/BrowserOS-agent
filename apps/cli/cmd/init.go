package cmd

import (
	"bufio"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"browseros-cli/config"
	"browseros-cli/output"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

func init() {
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Configure the BrowserOS server connection",
		Long: `Set up the CLI by providing the MCP server URL from BrowserOS.

Open BrowserOS → Settings → BrowserOS as MCP to find your Server URL.
The URL looks like: http://127.0.0.1:9004/mcp

The port varies per installation, so this step is required on first use.
Run again if your port changes.`,
		Annotations: map[string]string{"group": "Setup:"},
		Args:        cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			bold := color.New(color.Bold)
			green := color.New(color.FgGreen)
			dim := color.New(color.Faint)

			fmt.Println()
			bold.Println("BrowserOS CLI Setup")
			fmt.Println()
			fmt.Println("Open BrowserOS → Settings → BrowserOS as MCP")
			fmt.Println("Copy the Server URL shown there.")
			fmt.Println()
			dim.Println("It looks like: http://127.0.0.1:9004/mcp")
			fmt.Println()

			reader := bufio.NewReader(os.Stdin)
			fmt.Print("Server URL: ")
			input, err := reader.ReadString('\n')
			if err != nil {
				output.Error("failed to read input", 1)
			}
			input = strings.TrimSpace(input)

			if input == "" {
				output.Error("no URL provided", 1)
			}

			// Normalize: strip trailing /mcp if present — we add it ourselves
			baseURL := strings.TrimSuffix(input, "/mcp")
			baseURL = strings.TrimSuffix(baseURL, "/")

			parsed, err := url.Parse(baseURL)
			if err != nil || parsed.Host == "" {
				output.Errorf(1, "invalid URL: %s", input)
			}

			// Verify connectivity
			fmt.Printf("Checking connection to %s ...\n", baseURL)
			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Get(baseURL + "/health")
			if err != nil {
				output.Errorf(1, "cannot connect to %s: %v\nIs BrowserOS running?", baseURL, err)
			}
			resp.Body.Close()

			if resp.StatusCode >= 400 {
				output.Errorf(1, "server returned HTTP %d — check the URL", resp.StatusCode)
			}

			cfg := &config.Config{ServerURL: baseURL}
			if err := config.Save(cfg); err != nil {
				output.Errorf(1, "save config: %v", err)
			}

			fmt.Println()
			green.Printf("Connected! Config saved to %s\n", config.Path())
			fmt.Println()
			dim.Println("Try: browseros-cli health")
			dim.Println("     browseros-cli pages")
		},
	}

	rootCmd.AddCommand(cmd)
}
