package cmd

import (
	"browseros-cli/output"

	"github.com/spf13/cobra"
)

func init() {
	bookmarkCmd := &cobra.Command{
		Use:         "bookmark",
		Annotations: map[string]string{"group": "Resources:"},
		Short:       "Manage bookmarks",
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all bookmarks",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			result, err := c.CallTool("get_bookmarks", nil)
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

	createCmd := &cobra.Command{
		Use:   "create <title> [url]",
		Short: "Create a bookmark or folder",
		Args:  cobra.RangeArgs(1, 2),
		Run: func(cmd *cobra.Command, args []string) {
			parent, _ := cmd.Flags().GetString("parent")
			toolArgs := map[string]any{"title": args[0]}
			if len(args) > 1 {
				toolArgs["url"] = args[1]
			}
			if parent != "" {
				toolArgs["parentId"] = parent
			}
			c := newClient()
			result, err := c.CallTool("create_bookmark", toolArgs)
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
	createCmd.Flags().String("parent", "", "Parent folder ID")

	removeCmd := &cobra.Command{
		Use:   "remove <id>",
		Short: "Remove a bookmark or folder",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			result, err := c.CallTool("remove_bookmark", map[string]any{"id": args[0]})
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

	updateCmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update a bookmark",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			title, _ := cmd.Flags().GetString("title")
			url, _ := cmd.Flags().GetString("url")
			toolArgs := map[string]any{"id": args[0]}
			if title != "" {
				toolArgs["title"] = title
			}
			if url != "" {
				toolArgs["url"] = url
			}
			c := newClient()
			result, err := c.CallTool("update_bookmark", toolArgs)
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
	updateCmd.Flags().String("title", "", "New title")
	updateCmd.Flags().String("url", "", "New URL")

	moveCmd := &cobra.Command{
		Use:   "move <id>",
		Short: "Move a bookmark to a different folder",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			parent, _ := cmd.Flags().GetString("parent")
			index, _ := cmd.Flags().GetInt("index")
			toolArgs := map[string]any{"id": args[0]}
			if parent != "" {
				toolArgs["parentId"] = parent
			}
			if cmd.Flags().Changed("index") {
				toolArgs["index"] = index
			}
			c := newClient()
			result, err := c.CallTool("move_bookmark", toolArgs)
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
	moveCmd.Flags().String("parent", "", "Target parent folder ID")
	moveCmd.Flags().Int("index", 0, "Position index")

	searchCmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Search bookmarks",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			c := newClient()
			result, err := c.CallTool("search_bookmarks", map[string]any{"query": args[0]})
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

	bookmarkCmd.AddCommand(listCmd, createCmd, removeCmd, updateCmd, moveCmd, searchCmd)
	rootCmd.AddCommand(bookmarkCmd)
}
