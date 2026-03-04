package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"

	"browseros-dev/browser"
	"browseros-dev/proc"

	"github.com/spf13/cobra"
)

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Start the dev environment with process supervision",
	Long:  "Builds controller-ext, starts agent (WXT HMR or static), waits for CDP, then starts the server.",
	RunE:  runWatch,
}

var (
	watchNew    bool
	watchManual bool
)

func init() {
	watchCmd.Flags().BoolVar(&watchNew, "new", false, "Find available ports and create a fresh user-data directory")
	watchCmd.Flags().BoolVar(&watchManual, "manual", false, "Build agent statically instead of WXT HMR mode")
	rootCmd.AddCommand(watchCmd)
}

func runWatch(cmd *cobra.Command, args []string) error {
	root, err := proc.FindMonorepoRoot()
	if err != nil {
		return err
	}

	p := proc.Ports{CDP: 9005, Server: 9105, Extension: 9305}
	userDataDir := "/tmp/browseros-dev"

	if watchNew {
		proc.LogMsg(proc.TagInfo, "Finding available ports...")
		p.CDP = proc.FindAvailablePort(p.CDP)
		p.Server = proc.FindAvailablePort(p.Server)
		p.Extension = proc.FindAvailablePort(p.Extension)

		dir, err := os.MkdirTemp("", "browseros-dev-")
		if err != nil {
			return fmt.Errorf("creating temp dir: %w", err)
		}
		userDataDir = dir
		proc.LogMsgf(proc.TagInfo, "Created fresh profile: %s", userDataDir)
	} else {
		proc.LogMsg(proc.TagInfo, "Killing processes on default ports...")
		proc.KillPort(p.CDP)
		proc.KillPort(p.Server)
		proc.KillPort(p.Extension)
		proc.LogMsg(proc.TagInfo, "Ports cleared")
	}

	fmt.Println()
	mode := "watch"
	if watchManual {
		mode = "manual"
	}
	proc.LogMsgf(proc.TagInfo, "Mode: %s", proc.BoldColor.Sprint(mode))
	proc.LogMsgf(proc.TagInfo, "Ports: CDP=%d Server=%d Extension=%d", p.CDP, p.Server, p.Extension)
	proc.LogMsgf(proc.TagInfo, "Profile: %s", userDataDir)
	proc.LogMsg(proc.TagInfo, proc.DimColor.Sprint("Press Ctrl+C to stop, double Ctrl+C to force kill"))
	fmt.Println()

	env := proc.BuildEnv(p, "development")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 2)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup
	var procs []*proc.ManagedProc

	// Pre-build controller-ext
	proc.LogMsg(proc.TagBuild, "Building controller-ext...")
	if err := proc.RunBlocking(ctx, root, proc.TagBuild, "bun", "--cwd", "apps/controller-ext", "build"); err != nil {
		return fmt.Errorf("controller-ext build failed: %w", err)
	}
	proc.LogMsg(proc.TagBuild, "controller-ext built")

	// Run agent codegen if generated files don't exist
	agentDir := filepath.Join(root, "apps/agent")
	if _, err := os.Stat(filepath.Join(agentDir, "generated/graphql")); os.IsNotExist(err) {
		proc.LogMsg(proc.TagBuild, "Running agent codegen...")
		if err := proc.RunBlocking(ctx, agentDir, proc.TagBuild,
			"bun", "--env-file=.env.development", "graphql-codegen", "--config", "codegen.ts"); err != nil {
			return fmt.Errorf("agent codegen failed: %w", err)
		}
		proc.LogMsg(proc.TagBuild, "agent codegen done")
	}

	if watchManual {
		proc.LogMsg(proc.TagBuild, "Building agent (dev)...")
		if err := proc.RunBlocking(ctx, agentDir, proc.TagBuild,
			"bun", "--env-file=.env.development", "wxt", "build", "--mode", "development"); err != nil {
			return fmt.Errorf("agent build failed: %w", err)
		}
		proc.LogMsg(proc.TagBuild, "agent built")

		procs = append(procs, proc.StartManaged(ctx, &wg, proc.ProcConfig{
			Tag:     proc.TagBrowser,
			Dir:     root,
			Restart: false,
			Cmd: browser.BuildArgs(browser.ArgsConfig{
				Root:              root,
				Ports:             p,
				UserDataDir:       userDataDir,
				LoadDevExtensions: true,
			}),
		}))
	} else {
		procs = append(procs, proc.StartManaged(ctx, &wg, proc.ProcConfig{
			Tag:     proc.TagAgent,
			Dir:     agentDir,
			Env:     env,
			Restart: true,
			Cmd:     []string{"bun", "--env-file=.env.development", "wxt"},
		}))
	}

	// Wait for CDP
	proc.LogMsg(proc.TagServer, "Waiting for CDP...")
	if browser.WaitForCDP(ctx, p.CDP, 60) {
		proc.LogMsg(proc.TagServer, "CDP ready")
	} else {
		proc.LogMsg(proc.TagServer, proc.WarnColor.Sprint("CDP not available, starting server anyway"))
	}

	// Start server
	procs = append(procs, proc.StartManaged(ctx, &wg, proc.ProcConfig{
		Tag:     proc.TagServer,
		Dir:     filepath.Join(root, "apps/server"),
		Env:     env,
		Restart: true,
		Cmd:     []string{"bun", "--watch", "--env-file=.env.development", "src/index.ts"},
	}))

	<-sigCh
	fmt.Println()
	proc.LogMsg(proc.TagInfo, proc.WarnColor.Sprint("Shutting down (Ctrl+C again to force)..."))
	cancel()

	go func() {
		<-sigCh
		fmt.Println()
		proc.LogMsg(proc.TagInfo, proc.ErrorColor.Sprint("Force killing all processes..."))
		for _, p := range procs {
			p.ForceKill()
		}
		os.Exit(1)
	}()

	for _, p := range procs {
		p.Stop()
	}
	wg.Wait()
	proc.LogMsg(proc.TagInfo, "All processes stopped")
	return nil
}
