package cmd

import (
	"fmt"

	"browseros-dev/proc"

	"github.com/spf13/cobra"
)

var cleanupCmd = &cobra.Command{
	Use:   "cleanup",
	Short: "Kill port processes and remove orphaned temp directories",
	Long:  "Kills processes on dev/test ports and removes orphaned browseros-* temp directories.",
	RunE:  runCleanup,
}

var (
	cleanupPorts bool
	cleanupTemps bool
)

func init() {
	cleanupCmd.Flags().BoolVar(&cleanupPorts, "ports", false, "Only kill port processes")
	cleanupCmd.Flags().BoolVar(&cleanupTemps, "temps", false, "Only remove temp directories")
	rootCmd.AddCommand(cleanupCmd)
}

func runCleanup(cmd *cobra.Command, args []string) error {
	doPorts := !cleanupTemps || cleanupPorts
	doTemps := !cleanupPorts || cleanupTemps

	if doPorts {
		ports := proc.DefaultLocalPorts()
		proc.LogMsgf(proc.TagInfo, "Killing processes on ports %d, %d, %d...", ports.CDP, ports.Server, ports.Extension)
		proc.KillPorts(ports)
		proc.LogMsg(proc.TagInfo, "Ports cleared")
	}

	if doTemps {
		n := proc.CleanupTempDirs("browseros-test-", "browseros-dev-")
		if n > 0 {
			proc.LogMsgf(proc.TagInfo, "Removed %d temp directories", n)
		} else {
			proc.LogMsg(proc.TagInfo, "No orphaned temp directories found")
		}
	}

	fmt.Println()
	proc.LogMsg(proc.TagInfo, "Cleanup complete")
	return nil
}
