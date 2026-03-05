package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"browseros-cli/config"
	"browseros-cli/mcp"

	"github.com/fatih/color"
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

var (
	helpHeaderColor = color.New(color.Bold, color.FgCyan)
	helpCmdColor    = color.New(color.FgHiGreen)
	helpAliasColor  = color.New(color.FgYellow)
	helpHintColor   = color.New(color.Faint)
)

func helpHeader(s string) string { return helpHeaderColor.Sprint(s) }
func helpCmdCol(s string) string { return helpCmdColor.Sprint(s) }
func helpHint(s string) string   { return helpHintColor.Sprint(s) }
func helpAliases(aliases []string) string {
	return helpAliasColor.Sprintf("(aliases: %s)", strings.Join(aliases, ", "))
}

var groupOrder = []string{
	"Navigate:",
	"Observe:",
	"Input:",
	"Resources:",
	"Setup:",
}

func groupedHelp(cmd *cobra.Command) string {
	groups := map[string][]*cobra.Command{}
	for _, c := range cmd.Commands() {
		if !c.IsAvailableCommand() && c.Name() != "help" {
			continue
		}
		g := c.Annotations["group"]
		if g == "" {
			g = "Setup:"
		}
		groups[g] = append(groups[g], c)
	}

	var b strings.Builder
	for _, name := range groupOrder {
		cmds, ok := groups[name]
		if !ok {
			continue
		}
		b.WriteString("\n" + helpHeader(name) + "\n")
		for _, c := range cmds {
			line := "  " + helpCmdCol(fmt.Sprintf("%-14s", c.Name())) + " " + c.Short
			if len(c.Aliases) > 0 {
				line += " " + helpAliases(c.Aliases)
			}
			b.WriteString(line + "\n")
		}
	}
	return b.String()
}

const usageTemplate = `{{helpHeader "Usage:"}}{{if .Runnable}}
  {{.UseLine}}{{end}}{{if .HasAvailableSubCommands}}
  {{.CommandPath}} [command]{{end}}{{if gt (len .Aliases) 0}}

{{helpHeader "Aliases:"}}
  {{.NameAndAliases}}{{end}}{{if .HasExample}}

{{helpHeader "Examples:"}}
{{.Example}}{{end}}{{if .HasAvailableSubCommands}}
{{groupedHelp .}}{{end}}{{if .HasAvailableLocalFlags}}

{{helpHeader "Flags:"}}
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableInheritedFlags}}

{{helpHeader "Global Flags:"}}
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableSubCommands}}

{{helpHint (printf "Use \"%s [command] --help\" for more information." .CommandPath)}}{{end}}
`

var rootCmd = &cobra.Command{
	Use:           "browseros-cli",
	Short:         "Browser control CLI for BrowserOS",
	Long:          "browseros-cli — command-line interface for controlling BrowserOS via MCP",
	SilenceUsage:  true,
	SilenceErrors: true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.AddTemplateFunc("helpHeader", helpHeader)
	cobra.AddTemplateFunc("helpCmdCol", helpCmdCol)
	cobra.AddTemplateFunc("helpAliases", helpAliases)
	cobra.AddTemplateFunc("helpHint", helpHint)
	cobra.AddTemplateFunc("groupedHelp", groupedHelp)

	rootCmd.SetUsageTemplate(usageTemplate)

	defaultURL := "http://127.0.0.1:9100"
	if cfg, err := config.Load(); err == nil && cfg.ServerURL != "" {
		defaultURL = cfg.ServerURL
	}
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
