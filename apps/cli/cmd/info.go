package cmd

import (
	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	cmd := &cobra.Command{
		Use:         "info [topic]",
		Annotations: map[string]string{"group": "Setup:"},
		Short:       "Get information about BrowserOS features",
		Args:        cobra.MaximumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			toolArgs := map[string]any{}
			if len(args) > 0 {
				toolArgs["topic"] = args[0]
			}
			result, err := c.CallTool("browseros_info", toolArgs)
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

	rootCmd.AddCommand(cmd)
}
