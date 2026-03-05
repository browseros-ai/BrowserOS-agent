package proc

import (
	"fmt"
	"math/rand"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type Ports struct {
	CDP       int
	Server    int
	Extension int
}

const (
	randomPortMin = 9000
	randomPortMax = 9999
)

var defaultLocalPorts = Ports{CDP: 9005, Server: 9105, Extension: 9305}

func DefaultLocalPorts() Ports {
	return defaultLocalPorts
}

func ResolveWatchPorts(useRandom bool) (Ports, error) {
	reserved := make(map[int]struct{}, 3)
	if useRandom {
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		cdp, err := selectRandomPort(rng, reserved)
		if err != nil {
			return Ports{}, err
		}
		server, err := selectRandomPort(rng, reserved)
		if err != nil {
			return Ports{}, err
		}
		extension, err := selectRandomPort(rng, reserved)
		if err != nil {
			return Ports{}, err
		}
		return Ports{CDP: cdp, Server: server, Extension: extension}, nil
	}

	defaultPorts := DefaultLocalPorts()
	cdp, err := selectPreferredPort(defaultPorts.CDP, reserved)
	if err != nil {
		return Ports{}, err
	}
	server, err := selectPreferredPort(defaultPorts.Server, reserved)
	if err != nil {
		return Ports{}, err
	}
	extension, err := selectPreferredPort(defaultPorts.Extension, reserved)
	if err != nil {
		return Ports{}, err
	}
	return Ports{CDP: cdp, Server: server, Extension: extension}, nil
}

func IsPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

func KillPorts(p Ports) {
	KillPort(p.CDP)
	KillPort(p.Server)
	KillPort(p.Extension)
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

func selectPreferredPort(preferred int, reserved map[int]struct{}) (int, error) {
	if reservePort(preferred, reserved) {
		return preferred, nil
	}

	start := preferred + 1
	if preferred < randomPortMin || preferred > randomPortMax {
		start = randomPortMin
	}

	for port := start; port <= randomPortMax; port++ {
		if reservePort(port, reserved) {
			return port, nil
		}
	}
	for port := randomPortMin; port < start; port++ {
		if reservePort(port, reserved) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available port found in range %d-%d", randomPortMin, randomPortMax)
}

func selectRandomPort(rng *rand.Rand, reserved map[int]struct{}) (int, error) {
	candidates := make([]int, 0, randomPortMax-randomPortMin+1)
	for port := randomPortMin; port <= randomPortMax; port++ {
		candidates = append(candidates, port)
	}
	rng.Shuffle(len(candidates), func(i, j int) {
		candidates[i], candidates[j] = candidates[j], candidates[i]
	})
	for _, port := range candidates {
		if reservePort(port, reserved) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available port found in range %d-%d", randomPortMin, randomPortMax)
}

func reservePort(port int, reserved map[int]struct{}) bool {
	if _, exists := reserved[port]; exists {
		return false
	}
	if !IsPortAvailable(port) {
		return false
	}
	reserved[port] = struct{}{}
	return true
}
