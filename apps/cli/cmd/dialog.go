package cmd

import (
	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	cmd := &cobra.Command{
		Use:         "dialog <accept|dismiss>",
		Annotations: map[string]string{"group": "Input:"},
		Short:       "Handle a JavaScript dialog",
		Args:        cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			action := args[0]
			if action != "accept" && action != "dismiss" {
				output.Errorf(3, "action must be 'accept' or 'dismiss', got: %s", action)
			}

			promptText, _ := cmd.Flags().GetString("text")

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}

			toolArgs := map[string]any{
				"page":   pageID,
				"accept": action == "accept",
			}
			if promptText != "" {
				toolArgs["promptText"] = promptText
			}

			result, err := c.CallTool("handle_dialog", toolArgs)
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

	cmd.Flags().String("text", "", "Text for prompt dialogs")
	rootCmd.AddCommand(cmd)
}
