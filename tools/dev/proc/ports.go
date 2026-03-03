package proc

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
)

type Ports struct {
	CDP       int
	Server    int
	Extension int
}

func FindAvailablePort(start int) int {
	for port := start; port < start+100; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			ln.Close()
			return port
		}
	}
	LogMsg(TagInfo, WarnColor.Sprintf("Could not find available port near %d, using %d", start, start))
	return start
}

func KillPort(port int) {
	exec.Command("sh", "-c", fmt.Sprintf("lsof -ti:%d | xargs kill -9 2>/dev/null || true", port)).Run()
}

func BuildEnv(p Ports, nodeEnv string) []string {
	env := os.Environ()
	env = append(env,
		fmt.Sprintf("BROWSEROS_CDP_PORT=%d", p.CDP),
		fmt.Sprintf("BROWSEROS_SERVER_PORT=%d", p.Server),
		fmt.Sprintf("BROWSEROS_EXTENSION_PORT=%d", p.Extension),
		fmt.Sprintf("VITE_BROWSEROS_SERVER_PORT=%d", p.Server),
		fmt.Sprintf("NODE_ENV=%s", nodeEnv),
	)
	return env
}

func CleanupTempDirs(prefixes ...string) int {
	tmpDir := os.TempDir()
	count := 0
	for _, prefix := range prefixes {
		entries, err := filepath.Glob(filepath.Join(tmpDir, prefix+"*"))
		if err != nil {
			continue
		}
		for _, entry := range entries {
			info, err := os.Stat(entry)
			if err != nil || !info.IsDir() {
				continue
			}
			if err := os.RemoveAll(entry); err == nil {
				count++
			}
		}
	}
	return count
}

func FindMonorepoRoot() (string, error) {
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
