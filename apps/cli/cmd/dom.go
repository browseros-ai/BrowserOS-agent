package cmd

import (
	"strings"

	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	domCmd := &cobra.Command{
		Use:   "dom",
		Short: "Get raw HTML DOM structure",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			selector, _ := cmd.Flags().GetString("selector")

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}

			toolArgs := map[string]any{"page": pageID}
			if selector != "" {
				toolArgs["selector"] = selector
			}

			result, err := c.CallTool("get_dom", toolArgs)
			if err != nil {
				output.Error(err.Error(), 1)
			}
			if jsonOut {
				output.JSON(result)
			} else {
				output.Text(result)
			}
		},
	}
	domCmd.Flags().String("selector", "", "CSS selector to scope")

	domSearchCmd := &cobra.Command{
		Use:   "dom-search <query>",
		Short: "Search DOM by text, CSS selector, or XPath",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			query := strings.Join(args, " ")
			limit, _ := cmd.Flags().GetInt("limit")

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}

			result, err := c.CallTool("search_dom", map[string]any{
				"page":  pageID,
				"query": query,
				"limit": limit,
			})
			if err != nil {
				output.Error(err.Error(), 1)
			}
			if jsonOut {
				output.JSON(result)
			} else {
				output.Text(result)
			}
		},
	}
	domSearchCmd.Flags().Int("limit", 25, "Max results")

	rootCmd.AddCommand(domCmd, domSearchCmd)
}
