package cmd

import (
	"fmt"

	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	pdfCmd := &cobra.Command{
		Use:         "pdf <path>",
		Annotations: map[string]string{"group": "Observe:"},
		Short:       "Save the current page as PDF",
		Args:        cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}
			result, err := c.CallTool("save_pdf", map[string]any{
				"page": pageID,
				"path": args[0],
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

	downloadCmd := &cobra.Command{
		Use:         "download <element> <dir>",
		Annotations: map[string]string{"group": "Input:"},
		Short:       "Click element to trigger download and save to directory",
		Args:        cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			var element int
			if _, err := fmt.Sscanf(args[0], "%d", &element); err != nil {
				output.Errorf(3, "invalid element ID: %s", args[0])
			}

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}
			result, err := c.CallTool("download_file", map[string]any{
				"page":    pageID,
				"element": element,
				"path":    args[1],
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

	rootCmd.AddCommand(pdfCmd, downloadCmd)
}
