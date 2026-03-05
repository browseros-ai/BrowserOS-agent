package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"browseros-cli/config"

	"github.com/spf13/cobra"
)

func init() {
	cmd := &cobra.Command{
		Use:         "config",
		Aliases:     []string{"cfg"},
		Annotations: map[string]string{"group": "Setup:"},
		Short:       "Open config in $EDITOR",
		Long: `Open the browseros-cli config file in your editor.

Config file: ~/.config/browseros-cli/config.yaml
Creates the file if it doesn't exist.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			showPath, _ := cmd.Flags().GetBool("path")
			if showPath {
				fmt.Println(config.Path())
				return nil
			}

			// Ensure config exists
			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("loading config: %w", err)
			}
			cfg.ServerURL = normalizeServerURL(cfg.ServerURL)
			if err := config.Save(cfg); err != nil {
				return fmt.Errorf("saving config: %w", err)
			}

			editor := os.Getenv("EDITOR")
			if editor == "" {
				editor = "vi"
			}

			c := exec.Command(editor, config.Path())
			c.Stdin = os.Stdin
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		},
	}

	cmd.Flags().Bool("path", false, "Print config file path and exit")

	rootCmd.AddCommand(cmd)
}
