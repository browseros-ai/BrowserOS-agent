package proc

import (
	"fmt"
	"math/rand"
	"net"
	"testing"
)

func TestSelectPreferredPortUsesPreferredWhenAvailable(t *testing.T) {
	reserved := map[int]struct{}{}
	preferred := findFreePortInRange(t, randomPortMin)

	port, err := selectPreferredPort(preferred, reserved)
	if err != nil {
		t.Fatalf("selectPreferredPort returned error: %v", err)
	}
	if port != preferred {
		t.Fatalf("expected preferred port %d, got %d", preferred, port)
	}
	if _, ok := reserved[port]; !ok {
		t.Fatalf("expected port %d to be reserved", port)
	}
}

func TestSelectPreferredPortFallsBackWhenPreferredUnavailable(t *testing.T) {
	preferred := findFreePortInRange(t, randomPortMin)
	listener := listenOnPort(t, preferred)
	defer listener.Close()

	reserved := map[int]struct{}{}
	port, err := selectPreferredPort(preferred, reserved)
	if err != nil {
		t.Fatalf("selectPreferredPort returned error: %v", err)
	}
	if port == preferred {
		t.Fatalf("expected fallback port when preferred port %d is unavailable", preferred)
	}
	if port < randomPortMin || port > randomPortMax {
		t.Fatalf("expected fallback port in range %d-%d, got %d", randomPortMin, randomPortMax, port)
	}
	if _, ok := reserved[port]; !ok {
		t.Fatalf("expected fallback port %d to be reserved", port)
	}
}

func TestSelectRandomPortUsesRangeAndUniqueness(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	reserved := map[int]struct{}{}

	first, err := selectRandomPort(rng, reserved)
	if err != nil {
		t.Fatalf("selectRandomPort returned error: %v", err)
	}
	second, err := selectRandomPort(rng, reserved)
	if err != nil {
		t.Fatalf("selectRandomPort returned error: %v", err)
	}
	third, err := selectRandomPort(rng, reserved)
	if err != nil {
		t.Fatalf("selectRandomPort returned error: %v", err)
	}

	assertPortInRange(t, first)
	assertPortInRange(t, second)
	assertPortInRange(t, third)

	if first == second || first == third || second == third {
		t.Fatalf("expected unique ports, got %d, %d, %d", first, second, third)
	}
}

func TestResolveWatchPortsRandomUsesUniquePortsInRange(t *testing.T) {
	ports, err := ResolveWatchPorts(true)
	if err != nil {
		t.Fatalf("ResolveWatchPorts returned error: %v", err)
	}

	assertPortInRange(t, ports.CDP)
	assertPortInRange(t, ports.Server)
	assertPortInRange(t, ports.Extension)

	if ports.CDP == ports.Server || ports.CDP == ports.Extension || ports.Server == ports.Extension {
		t.Fatalf("expected unique ports, got %+v", ports)
	}
}

func assertPortInRange(t *testing.T, port int) {
	t.Helper()
	if port < randomPortMin || port > randomPortMax {
		t.Fatalf("expected port in range %d-%d, got %d", randomPortMin, randomPortMax, port)
	}
}

func findFreePortInRange(t *testing.T, start int) int {
	t.Helper()
	for port := start; port <= randomPortMax; port++ {
		if IsPortAvailable(port) {
			return port
		}
	}
	t.Fatalf("failed to find free port in range %d-%d", start, randomPortMax)
	return 0
}

func listenOnPort(t *testing.T, port int) net.Listener {
	t.Helper()
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("failed to listen on port %d: %v", port, err)
	}
	return listener
}
