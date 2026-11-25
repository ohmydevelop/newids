package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	bolt "go.etcd.io/bbolt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"time"
)

type metrics struct{ scored, dropped, incomplete, fail atomic.Uint64 }
type Score struct {
	ID        string
	Status    string
	Model     struct{ ID, Identity string }
	Risk      struct{ Malicious *float64 } `json:"risk_probabilities"`
	Behaviors map[string]float64           `json:"action_probabilities"`
}
type scorer struct {
	path string
	cmd  *exec.Cmd
	in   io.WriteCloser
	out  *bufio.Reader
}

func (s *scorer) close() {
	if s.cmd != nil {
		_ = s.in.Close()
		_ = s.cmd.Process.Kill()
		_ = s.cmd.Wait()
		s.cmd = nil
	}
}
func (s *scorer) score(e Event) (Score, error) {
	var r Score
	if s.cmd == nil {
		cmd := exec.Command(s.path, "score", "--timeout-ms", "5000")
		in, err := cmd.StdinPipe()
		if err != nil {
			return r, err
		}
		out, err := cmd.StdoutPipe()
		if err != nil {
			return r, err
		}
		cmd.Stderr = os.Stderr
		if err = cmd.Start(); err != nil {
			return r, err
		}
		s.cmd, s.in, s.out = cmd, in, bufio.NewReader(out)
	}
	proc := s.cmd.Process
	timer := time.AfterFunc(10*time.Second, func() { _ = proc.Kill() })
	defer timer.Stop()
	err := json.NewEncoder(s.in).Encode(map[string]any{"id": e.ID, "input_kind": "exec_argv", "executable": e.Exe, "argv": e.Argv})
	if err == nil {
		var line []byte
		line, err = s.out.ReadBytes('\n')
		if err == nil {
			err = json.Unmarshal(line, &r)
		}
	}
	if err != nil {
		s.close()
		return r, err
	}
	if r.Status != "ok" || r.ID != e.ID || r.Risk.Malicious == nil {
		return r, fmt.Errorf("ShellGuard rejected event %s", e.ID)
	}
	return r, nil
}

var bucket = []byte("alerts")

func upload(ctx context.Context, c Config, db *bolt.DB, m *metrics, events <-chan Event) {
	for ctx.Err() == nil {
		pending := 0
		err := db.View(func(t *bolt.Tx) error { pending = t.Bucket(bucket).Stats().KeyN; return nil })
		if err != nil {
			return
		}
		health := map[string]any{"pending": pending, "scoring_backlog": len(events), "scored": m.scored.Load(), "dropped": m.dropped.Load(), "incomplete": m.incomplete.Load(), "score_errors": m.fail.Load()}
		if err = c.post("health", health, nil); err != nil {
			log.Print(err)
		}
		for i := 0; i < 100 && ctx.Err() == nil; i++ {
			var key, data []byte
			err = db.View(func(t *bolt.Tx) error {
				k, v := t.Bucket(bucket).Cursor().First()
				key, data = bytes.Clone(k), bytes.Clone(v)
				return nil
			})
			if err != nil || key == nil {
				break
			}
			if err = c.post("alert", json.RawMessage(data), nil); err != nil {
				log.Print(err)
				break
			}
			if err = db.Update(func(t *bolt.Tx) error { return t.Bucket(bucket).Delete(key) }); err != nil {
				log.Print(err)
				break
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(3 * time.Second):
		}
	}
}
func collect(parent context.Context, c Config, in io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(c.Spool), 0700); err != nil {
		return err
	}
	db, err := bolt.Open(c.Spool, 0600, &bolt.Options{Timeout: time.Second})
	if err != nil {
		return err
	}
	defer db.Close()
	if err = db.Update(func(t *bolt.Tx) error { _, e := t.CreateBucketIfNotExists(bucket); return e }); err != nil {
		return err
	}
	events := make(chan Event, 256)
	ctx, cancel := context.WithCancel(parent)
	var m metrics
	uploaded := make(chan struct{})
	go func() { defer close(uploaded); upload(ctx, c, db, &m, events) }()
	defer func() { cancel(); <-uploaded }()
	scored := make(chan struct{})
	go func() {
		defer close(scored)
		s := scorer{path: c.Shellguard}
		defer s.close()
		for e := range events {
			r, err := s.score(e)
			if err != nil && s.cmd == nil {
				r, err = s.score(e)
			}
			if err != nil {
				m.fail.Add(1)
				log.Print(err)
				continue
			}
			m.scored.Add(1)
			if *r.Risk.Malicious < *c.Threshold {
				continue
			}
			data, err := json.Marshal(struct {
				Event
				Model     string             `json:"model"`
				Identity  string             `json:"model_identity"`
				Risk      float64            `json:"risk"`
				Behaviors map[string]float64 `json:"behaviors"`
			}{e, r.Model.ID, r.Model.Identity, *r.Risk.Malicious, r.Behaviors})
			if err == nil {
				err = db.Update(func(t *bolt.Tx) error { return t.Bucket(bucket).Put([]byte(e.ID), data) })
			}
			if err != nil {
				m.dropped.Add(1)
				log.Print(err)
			}
		}
	}()
	emit := func(p *pending) {
		e, ok := p.finish()
		if !ok {
			if p.exec || p.key {
				m.incomplete.Add(1)
			}
			return
		}
		select {
		case events <- e:
		default:
			m.dropped.Add(1)
		}
	}
	lines := make(chan string, 32)
	readErr := make(chan error, 1)
	go func() {
		defer close(lines)
		scan := bufio.NewScanner(in)
		scan.Buffer(make([]byte, 16384), 1<<20)
		for scan.Scan() {
			lines <- scan.Text()
		}
		readErr <- scan.Err()
	}()
	a := assembler{}
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	for {
		select {
		case l, ok := <-lines:
			if !ok {
				for _, p := range a {
					emit(p)
				}
				close(events)
				<-scored
				return <-readErr
			}
			a.line(l, emit)
		case now := <-tick.C:
			for id, p := range a {
				if now.Sub(p.seen) > 2*time.Second {
					delete(a, id)
					emit(p)
				}
			}
		}
	}
}
