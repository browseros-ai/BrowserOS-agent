package proc

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
)

type ProcConfig struct {
	Tag     Tag
	Dir     string
	Env     []string
	Restart bool
	Cmd     []string
}

type ManagedProc struct {
	Cfg    ProcConfig
	cancel context.CancelFunc
	mu     sync.Mutex
	proc   *os.Process
	exited chan struct{}
}

func StartManaged(ctx context.Context, wg *sync.WaitGroup, cfg ProcConfig) *ManagedProc {
	procCtx, procCancel := context.WithCancel(ctx)
	mp := &ManagedProc{
		Cfg:    cfg,
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

func (mp *ManagedProc) run(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}

		LogMsgf(mp.Cfg.Tag, "Starting: %s", DimColor.Sprint(strings.Join(mp.Cfg.Cmd, " ")))

		cmd := exec.Command(mp.Cfg.Cmd[0], mp.Cfg.Cmd[1:]...)
		cmd.Dir = mp.Cfg.Dir
		if mp.Cfg.Env != nil {
			cmd.Env = mp.Cfg.Env
		}
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			LogMsg(mp.Cfg.Tag, ErrorColor.Sprintf("Error starting: %v", err))
			if !mp.Cfg.Restart || ctx.Err() != nil {
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
		go func() { defer streamWg.Done(); StreamLines(stdout, mp.Cfg.Tag) }()
		go func() { defer streamWg.Done(); StreamLines(stderr, mp.Cfg.Tag) }()

		streamWg.Wait()
		_ = cmd.Wait()

		mp.mu.Lock()
		mp.proc = nil
		close(mp.exited)
		mp.mu.Unlock()

		if ctx.Err() != nil {
			return
		}

		exitCode := cmd.ProcessState.ExitCode()
		if exitCode != 0 {
			LogMsg(mp.Cfg.Tag, ErrorColor.Sprintf("Process exited with code %d", exitCode))
		} else {
			LogMsg(mp.Cfg.Tag, "Process exited cleanly")
		}

		if !mp.Cfg.Restart {
			return
		}

		LogMsg(mp.Cfg.Tag, WarnColor.Sprint("Restarting in 1s..."))
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Second):
		}
	}
}

func (mp *ManagedProc) Stop() {
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
			select {
			case <-exited:
			case <-time.After(3 * time.Second):
				LogMsg(mp.Cfg.Tag, WarnColor.Sprint("Process did not exit after SIGKILL, giving up"))
			}
		}
	}
}

func (mp *ManagedProc) ForceKill() {
	mp.mu.Lock()
	proc := mp.proc
	mp.mu.Unlock()

	if proc != nil {
		_ = syscall.Kill(-proc.Pid, syscall.SIGKILL)
	}
}
