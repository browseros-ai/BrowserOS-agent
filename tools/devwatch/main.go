package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	colorReset   = "\033[0m"
	colorCyan    = "\033[36m"
	colorMagenta = "\033[35m"
	colorYellow  = "\033[33m"
	colorBlue    = "\033[34m"
	colorGreen   = "\033[32m"
	colorRed     = "\033[31m"
)

type tag struct {
	name  string
	color string
}

var (
	tagBuild   = tag{"build", colorYellow}
	tagAgent   = tag{"agent", colorMagenta}
	tagServer  = tag{"server", colorCyan}
	tagBrowser = tag{"browser", colorBlue}
	tagInfo    = tag{"info", colorGreen}
)

func log(t tag, msg string) {
	fmt.Printf("%s[%s]%s %s\n", t.color, t.name, colorReset, msg)
}

func logf(t tag, format string, args ...any) {
	log(t, fmt.Sprintf(format, args...))
}

type ports struct {
	cdp       int
	server    int
	extension int
}

type procConfig struct {
	tag     tag
	dir     string
	env     []string
	restart bool
	cmd     []string
}

func main() {
	isNew := flag.Bool("new", false, "Find available ports and create a fresh user-data directory")
	isManual := flag.Bool("manual", false, "Build agent statically instead of WXT HMR mode")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `Usage: devwatch [flags]

Starts the BrowserOS dev environment with process supervision.

Default mode (watch): Runs agent with WXT HMR, auto-launches BrowserOS.
Manual mode: Builds agent statically, launches BrowserOS directly.

Flags:
`)
		flag.PrintDefaults()
	}
	flag.Parse()

	root, err := findMonorepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	p := ports{cdp: 9005, server: 9105, extension: 9305}
	userDataDir := "/tmp/browseros-dev"

	if *isNew {
		log(tagInfo, "Finding available ports...")
		p.cdp = findAvailablePort(p.cdp)
		p.server = findAvailablePort(p.server)
		p.extension = findAvailablePort(p.extension)

		dir, err := os.MkdirTemp("", "browseros-dev-")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating temp dir: %v\n", err)
			os.Exit(1)
		}
		userDataDir = dir
		logf(tagInfo, "Created fresh profile: %s", userDataDir)
	} else {
		log(tagInfo, "Killing processes on default ports...")
		killPort(p.cdp)
		killPort(p.server)
		killPort(p.extension)
		log(tagInfo, "Ports cleared")
	}

	fmt.Println()
	mode := "watch"
	if *isManual {
		mode = "manual"
	}
	logf(tagInfo, "Mode: %s", mode)
	logf(tagInfo, "Ports: CDP=%d Server=%d Extension=%d", p.cdp, p.server, p.extension)
	logf(tagInfo, "Profile: %s", userDataDir)
	log(tagInfo, "Press Ctrl+C to stop, double Ctrl+C to force kill")
	fmt.Println()

	env := buildEnv(p)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 2)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup
	var procs []*managedProc

	// Pre-build controller-ext (blocking)
	log(tagBuild, "Building controller-ext...")
	if err := runBlocking(ctx, root, tagBuild, "bun", "--cwd", "apps/controller-ext", "build"); err != nil {
		logf(tagBuild, "controller-ext build failed: %v", err)
		os.Exit(1)
	}
	log(tagBuild, "controller-ext built")

	// Run agent codegen if generated files don't exist
	agentDir := filepath.Join(root, "apps/agent")
	if _, err := os.Stat(filepath.Join(agentDir, "generated/graphql")); os.IsNotExist(err) {
		log(tagBuild, "Running agent codegen...")
		if err := runBlocking(ctx, agentDir, tagBuild,
			"bun", "--env-file=.env.development", "graphql-codegen", "--config", "codegen.ts"); err != nil {
			logf(tagBuild, "agent codegen failed: %v", err)
			os.Exit(1)
		}
		log(tagBuild, "agent codegen done")
	}

	if *isManual {
		log(tagBuild, "Building agent (dev)...")
		if err := runBlocking(ctx, agentDir, tagBuild,
			"bun", "--env-file=.env.development", "wxt", "build", "--mode", "development"); err != nil {
			logf(tagBuild, "agent build failed: %v", err)
			os.Exit(1)
		}
		log(tagBuild, "agent built")

		procs = append(procs, startManaged(ctx, &wg, procConfig{
			tag:     tagBrowser,
			dir:     root,
			restart: false,
			cmd:     buildBrowserArgs(root, p, userDataDir),
		}))
	} else {
		procs = append(procs, startManaged(ctx, &wg, procConfig{
			tag:     tagAgent,
			dir:     agentDir,
			env:     env,
			restart: true,
			cmd:     []string{"bun", "--env-file=.env.development", "wxt"},
		}))
	}

	// Wait for CDP
	log(tagServer, "Waiting for CDP...")
	if waitForCDP(ctx, p.cdp, 60) {
		log(tagServer, "CDP ready")
	} else {
		log(tagServer, "Warning: CDP not available, starting server anyway")
	}

	// Start server
	procs = append(procs, startManaged(ctx, &wg, procConfig{
		tag:     tagServer,
		dir:     filepath.Join(root, "apps/server"),
		env:     env,
		restart: true,
		cmd:     []string{"bun", "--watch", "--env-file=.env.development", "src/index.ts"},
	}))

	<-sigCh
	fmt.Println()
	log(tagInfo, "Shutting down (Ctrl+C again to force)...")
	cancel()

	// Second signal → force exit
	go func() {
		<-sigCh
		fmt.Println()
		log(tagInfo, "Force killing all processes...")
		for _, p := range procs {
			p.mu.Lock()
			proc := p.proc
			p.mu.Unlock()
			if proc != nil {
				_ = syscall.Kill(-proc.Pid, syscall.SIGKILL)
			}
		}
		os.Exit(1)
	}()

	for _, p := range procs {
		p.stop()
	}
	wg.Wait()
	log(tagInfo, "All processes stopped")
}

type managedProc struct {
	cfg    procConfig
	cancel context.CancelFunc
	mu     sync.Mutex
	proc   *os.Process
	exited chan struct{} // closed each time the current process instance exits
}

func startManaged(ctx context.Context, wg *sync.WaitGroup, cfg procConfig) *managedProc {
	procCtx, procCancel := context.WithCancel(ctx)
	mp := &managedProc{
		cfg:    cfg,
		cancel: procCancel,
		exited: make(chan struct{}),
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		mp.run(procCtx)
	}()

	return mp
}

func (mp *managedProc) run(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}

		logf(mp.cfg.tag, "Starting: %s", strings.Join(mp.cfg.cmd, " "))

		cmd := exec.Command(mp.cfg.cmd[0], mp.cfg.cmd[1:]...)
		cmd.Dir = mp.cfg.dir
		if mp.cfg.env != nil {
			cmd.Env = mp.cfg.env
		}
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			logf(mp.cfg.tag, "%sError starting: %v%s", colorRed, err, colorReset)
			if !mp.cfg.restart || ctx.Err() != nil {
				return
			}
			time.Sleep(time.Second)
			continue
		}

		mp.mu.Lock()
		mp.proc = cmd.Process
		mp.exited = make(chan struct{})
		mp.mu.Unlock()

		var streamWg sync.WaitGroup
		streamWg.Add(2)
		go func() { defer streamWg.Done(); streamLines(stdout, mp.cfg.tag) }()
		go func() { defer streamWg.Done(); streamLines(stderr, mp.cfg.tag) }()

		streamWg.Wait()
		_ = cmd.Wait()

		mp.mu.Lock()
		mp.proc = nil
		close(mp.exited)
		mp.mu.Unlock()

		if ctx.Err() != nil {
			return
		}

		exitErr := cmd.ProcessState.ExitCode()
		if exitErr != 0 {
			logf(mp.cfg.tag, "%sProcess exited with code %d%s", colorRed, exitErr, colorReset)
		} else {
			logf(mp.cfg.tag, "Process exited cleanly")
		}

		if !mp.cfg.restart {
			return
		}

		log(mp.cfg.tag, "Restarting in 1s...")
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Second):
		}
	}
}

func (mp *managedProc) stop() {
	mp.cancel()
	mp.mu.Lock()
	proc := mp.proc
	exited := mp.exited
	mp.mu.Unlock()

	if proc != nil {
		_ = syscall.Kill(-proc.Pid, syscall.SIGTERM)
		select {
		case <-exited:
		case <-time.After(5 * time.Second):
			_ = syscall.Kill(-proc.Pid, syscall.SIGKILL)
			<-exited
		}
	}
}

func streamLines(r interface{ Read([]byte) (int, error) }, t tag) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			fmt.Printf("%s[%s]%s %s\n", t.color, t.name, colorReset, line)
		}
	}
}

func findMonorepoRoot() (string, error) {
	exe, err := os.Executable()
	if err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "../..")
		if isMonorepoRoot(candidate) {
			return filepath.Abs(candidate)
		}
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("cannot determine working directory: %w", err)
	}

	dir := cwd
	for {
		if isMonorepoRoot(dir) {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("cannot find monorepo root (no package.json with apps/ found from %s)", cwd)
}

func isMonorepoRoot(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, "package.json"))
	if err != nil || info.IsDir() {
		return false
	}
	_, err = os.Stat(filepath.Join(dir, "apps"))
	return err == nil
}

func buildEnv(p ports) []string {
	env := os.Environ()
	env = append(env,
		fmt.Sprintf("BROWSEROS_CDP_PORT=%d", p.cdp),
		fmt.Sprintf("BROWSEROS_SERVER_PORT=%d", p.server),
		fmt.Sprintf("BROWSEROS_EXTENSION_PORT=%d", p.extension),
		fmt.Sprintf("VITE_BROWSEROS_SERVER_PORT=%d", p.server),
		"NODE_ENV=development",
	)
	return env
}

func buildBrowserArgs(root string, p ports, userDataDir string) []string {
	binary := "/Applications/BrowserOS.app/Contents/MacOS/BrowserOS"
	controllerExtDir := filepath.Join(root, "apps/controller-ext/dist")
	agentExtDir := filepath.Join(root, "apps/agent/dist/chrome-mv3-dev")

	return []string{
		binary,
		"--no-first-run",
		"--no-default-browser-check",
		"--use-mock-keychain",
		"--show-component-extension-options",
		"--disable-browseros-server",
		"--disable-browseros-extensions",
		fmt.Sprintf("--remote-debugging-port=%d", p.cdp),
		fmt.Sprintf("--browseros-mcp-port=%d", p.server),
		fmt.Sprintf("--browseros-extension-port=%d", p.extension),
		fmt.Sprintf("--user-data-dir=%s", userDataDir),
		fmt.Sprintf("--load-extension=%s,%s", controllerExtDir, agentExtDir),
		"chrome://newtab",
	}
}

func findAvailablePort(start int) int {
	for port := start; port < start+100; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			ln.Close()
			return port
		}
	}
	logf(tagInfo, "%sWarning: could not find available port near %d, using %d%s", colorYellow, start, start, colorReset)
	return start
}

func killPort(port int) {
	exec.Command("sh", "-c", fmt.Sprintf("lsof -ti:%d | xargs kill -9 2>/dev/null || true", port)).Run()
}

func waitForCDP(ctx context.Context, port int, maxAttempts int) bool {
	client := &http.Client{Timeout: time.Second}
	url := fmt.Sprintf("http://127.0.0.1:%d/json/version", port)

	for range maxAttempts {
		if ctx.Err() != nil {
			return false
		}
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return true
			}
		}
		select {
		case <-ctx.Done():
			return false
		case <-time.After(500 * time.Millisecond):
		}
	}
	return false
}

func runBlocking(ctx context.Context, dir string, t tag, args ...string) error {
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = dir

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); streamLines(stdout, t) }()
	go func() { defer wg.Done(); streamLines(stderr, t) }()
	wg.Wait()

	return cmd.Wait()
}
