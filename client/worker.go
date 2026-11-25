package main

import (
	"bytes"
	"context"
	"encoding/json"

	"fmt"

	"log"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

type Command struct {
	Kind   string
	Argv   []string
	Script string
}
type Job struct {
	ID      string
	Command Command
}
type Result struct {
	Duration  int64   `json:"duration_ms"`
	Collected string  `json:"collected_at"`
	Stdout    string  `json:"stdout"`
	Stderr    string  `json:"stderr"`
	Exit      int     `json:"exit_code"`
	Truncated bool    `json:"truncated"`
	TimedOut  bool    `json:"timed_out"`
	Error     *string `json:"error"`
	Policy    Policy  `json:"policy"`
}

var applet = regexp.MustCompile("^[a-z][a-z0-9_-]*$")

func execute(c Config, j Job) Result {
	p := c.Policy
	r := Result{Collected: time.Now().UTC().Format(time.RFC3339Nano), Exit: -1, Policy: p}
	fail := func(message string) Result { r.Error = &message; return r }
	args := []string{"--json", "--restricted", "--output-bytes", fmt.Sprint(p.Output), "--timeout", fmt.Sprintf("%ds", p.Timeout)}
	for _, m := range p.Mounts {
		args = append(args, "--ro", m)
	}
	if p.SystemInfo {
		args = append(args, "--system-info")
	}
	switch j.Command.Kind {
	case "argv":
		if len(j.Command.Argv) == 0 || len(j.Command.Argv) > 256 || !applet.MatchString(j.Command.Argv[0]) {
			return fail("invalid applet")
		}
		args = append(args, j.Command.Argv...)
	case "script":
		args = append(args, "sh", "-c", j.Command.Script)
	default:
		return fail("invalid command kind")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(p.Timeout+1)*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.Newbox, args...)
	// Bound host-side diagnostics as well as guest stdout and stderr.
	var out limitedBuffer
	out.remaining = 8 << 20
	cmd.Stdout = &out
	var diagnostic limitedBuffer
	diagnostic.remaining = 4096
	cmd.Stderr = &diagnostic
	started := time.Now()
	e := cmd.Run()
	r.Duration = time.Since(started).Milliseconds()
	if ctx.Err() != nil {
		r.TimedOut = true
		return fail("worker deadline exceeded")
	}
	var wire struct {
		Stdout, Stderr string
		Exit           *int `json:"exit_code"`
		Timed          bool `json:"timed_out"`
		Error          *string
	}
	if json.Unmarshal(out.data.Bytes(), &wire) != nil || wire.Exit == nil {
		if e != nil {
			return fail(fmt.Sprintf("Newbox: %v %s", e, diagnostic.data.String()))
		}
		return fail("invalid Newbox result")
	}
	r.Stdout, r.Stderr, r.Exit, r.TimedOut, r.Error = wire.Stdout, wire.Stderr, *wire.Exit, wire.Timed, wire.Error
	r.Truncated = wire.Error != nil && (strings.Contains(*wire.Error, "output byte limit") || strings.Contains(*wire.Error, "output limit"))
	return r
}

type limitedBuffer struct {
	data      bytes.Buffer
	remaining int
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	n := min(len(p), b.remaining)
	_, _ = b.data.Write(p[:n])
	b.remaining -= n
	return len(p), nil
}

func runWorker(c Config) {
	go func() {
		for {
			if e := c.post("heartbeat", c.Policy, nil); e != nil {
				log.Print(e)
			}
			time.Sleep(4 * time.Second)
		}
	}()
	for {
		var response struct{ Job *Job }
		e := c.post("claim", struct{}{}, &response)
		if e != nil {
			log.Print(e)
			time.Sleep(2 * time.Second)
			continue
		}
		if response.Job == nil {
			time.Sleep(time.Second)
			continue
		}
		job := *response.Job
		payload := map[string]any{"id": job.ID, "result": execute(c, job)}
		for {
			e = c.post("finish", payload, nil)
			if e == nil {
				break
			}
			log.Print(e)

			time.Sleep(2 * time.Second)
		}
	}
}
