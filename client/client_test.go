package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAuditFragmentedArgument(t *testing.T) {
	a := assembler{}
	var event Event
	done := false
	emit := func(p *pending) { event, done = p.finish() }
	for _, line := range []string{
		`type=EXECVE msg=audit(100.000:3): argc=2 a0="printf" a1_len=12 a1[0]=612062`,
		`type=SYSCALL msg=audit(100.000:3): ppid=1 pid=2 uid=1000 key="newids_exec" exe="/usr/bin/printf"`,
		`type=EXECVE msg=audit(100.000:3): a1[1]=206364`,
		`type=EOE msg=audit(100.000:3):`,
	} {
		a.line(line, emit)
	}
	if !done || len(event.Argv) != 2 || event.Argv[1] != "a b cd" {
		t.Fatalf("fragment assembly: %#v", event)
	}
}
func TestWorkerDeadline(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "slow")
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexec sleep 10\n"), 0700); err != nil {
		t.Fatal(err)
	}
	r := execute(Config{Newbox: binary, Policy: Policy{Timeout: 1, Output: 128}}, Job{Command: Command{Kind: "argv", Argv: []string{"echo"}}})
	if !r.TimedOut || r.Exit != -1 {
		t.Fatalf("deadline result: %#v", r)
	}
}
