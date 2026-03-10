package cmd

import (
	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	historyCmd := &cobra.Command{
		Use:         "history",
		Annotations: map[string]string{"group": "Resources:"},
		Short:       "Manage browser history",
	}

	searchCmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Search browser history",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			max, _ := cmd.Flags().GetInt("max")
			c := newClient()
			toolArgs := map[string]any{"query": args[0]}
			if cmd.Flags().Changed("max") {
				toolArgs["maxResults"] = max
			}
			result, err := c.CallTool("search_history", toolArgs)
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
	searchCmd.Flags().Int("max", 0, "Max results")

	recentCmd := &cobra.Command{
		Use:   "recent",
		Short: "Show recent history",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			max, _ := cmd.Flags().GetInt("max")
			c := newClient()
			toolArgs := map[string]any{}
			if cmd.Flags().Changed("max") {
				toolArgs["maxResults"] = max
			}
			result, err := c.CallTool("get_recent_history", toolArgs)
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
	recentCmd.Flags().Int("max", 0, "Max results")

	deleteCmd := &cobra.Command{
		Use:   "delete <url>",
		Short: "Delete a URL from history",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			result, err := c.CallTool("delete_history_url", map[string]any{"url": args[0]})
			if err != nil {
				output.Error(err.Error(), 1)
			}
			if jsonOut {
				output.JSON(result)
			} else {
				output.Confirm(result.TextContent())
			}
		},
	}

	deleteRangeCmd := &cobra.Command{
		Use:   "delete-range",
		Short: "Delete history within a time range",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			start, _ := cmd.Flags().GetInt("start")
			end, _ := cmd.Flags().GetInt("end")
			c := newClient()
			result, err := c.CallTool("delete_history_range", map[string]any{
				"startTime": start,
				"endTime":   end,
			})
			if err != nil {
				output.Error(err.Error(), 1)
			}
			if jsonOut {
				output.JSON(result)
			} else {
				output.Confirm(result.TextContent())
			}
		},
	}
	deleteRangeCmd.Flags().Int("start", 0, "Start time (epoch ms)")
	deleteRangeCmd.Flags().Int("end", 0, "End time (epoch ms)")
	_ = deleteRangeCmd.MarkFlagRequired("start")
	_ = deleteRangeCmd.MarkFlagRequired("end")

	historyCmd.AddCommand(searchCmd, recentCmd, deleteCmd, deleteRangeCmd)
	rootCmd.AddCommand(historyCmd)
}
