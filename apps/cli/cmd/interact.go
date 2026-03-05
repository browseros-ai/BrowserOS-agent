package cmd

import (
	"fmt"
	"strings"

	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	hoverCmd := &cobra.Command{
		Use:   "hover <element>",
		Short: "Hover over an element",
		Args:  cobra.ExactArgs(1),
		Run:   elementAction("hover"),
	}

	focusCmd := &cobra.Command{
		Use:   "focus <element>",
		Short: "Focus an element",
		Args:  cobra.ExactArgs(1),
		Run:   elementAction("focus"),
	}

	checkCmd := &cobra.Command{
		Use:   "check <element>",
		Short: "Check a checkbox or radio button",
		Args:  cobra.ExactArgs(1),
		Run:   elementAction("check"),
	}

	uncheckCmd := &cobra.Command{
		Use:   "uncheck <element>",
		Short: "Uncheck a checkbox",
		Args:  cobra.ExactArgs(1),
		Run:   elementAction("uncheck"),
	}

	selectCmd := &cobra.Command{
		Use:   "select <element> <value>",
		Short: "Select a dropdown option",
		Args:  cobra.MinimumNArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			var element int
			if _, err := fmt.Sscanf(args[0], "%d", &element); err != nil {
				output.Errorf(3, "invalid element ID: %s", args[0])
			}
			value := strings.Join(args[1:], " ")

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}
			result, err := c.CallTool("select_option", map[string]any{
				"page":    pageID,
				"element": element,
				"value":   value,
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

	dragCmd := &cobra.Command{
		Use:   "drag <source> --to <target>",
		Short: "Drag from one element to another",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			var source int
			if _, err := fmt.Sscanf(args[0], "%d", &source); err != nil {
				output.Errorf(3, "invalid source element: %s", args[0])
			}
			target, _ := cmd.Flags().GetInt("to")

			c := newClient()
			pageID, err := resolvePageID(c)
			if err != nil {
				output.Error(err.Error(), 2)
			}
			result, err := c.CallTool("drag", map[string]any{
				"page":          pageID,
				"sourceElement": source,
				"targetElement": target,
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
	dragCmd.Flags().Int("to", 0, "Target element ID")
	_ = dragCmd.MarkFlagRequired("to")

	uploadCmd := &cobra.Command{
		Use:   "upload <element> <file...>",
		Short: "Upload files to a file input",
		Args:  cobra.MinimumNArgs(2),
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
			result, err := c.CallTool("upload_file", map[string]any{
				"page":    pageID,
				"element": element,
				"files":   args[1:],
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

	rootCmd.AddCommand(hoverCmd, focusCmd, checkCmd, uncheckCmd, selectCmd, dragCmd, uploadCmd)
}

// elementAction creates a simple element-based tool command.
func elementAction(toolName string) func(*cobra.Command, []string) {
	return func(cmd *cobra.Command, args []string) {
		var element int
		if _, err := fmt.Sscanf(args[0], "%d", &element); err != nil {
			output.Errorf(3, "invalid element ID: %s", args[0])
		}

		c := newClient()
		pageID, err := resolvePageID(c)
		if err != nil {
			output.Error(err.Error(), 2)
		}

		result, err := c.CallTool(toolName, map[string]any{
			"page":    pageID,
			"element": element,
		})
		if err != nil {
			output.Error(err.Error(), 1)
		}
		if jsonOut {
			output.JSON(result)
		} else {
			output.Confirm(result.TextContent())
		}
	}
}
