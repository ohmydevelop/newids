package main

import (
	"encoding/hex"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type Event struct {
	ID       string   `json:"event_id"`
	Occurred string   `json:"occurred_at"`
	Exe      string   `json:"executable"`
	Argv     []string `json:"argv"`
	UID      int      `json:"uid"`
	PID      int      `json:"pid"`
	PPID     int      `json:"ppid"`
}
type pending struct {
	e              Event
	argc           int
	args           map[int]string
	chunks         map[int]map[int]string
	lengths        map[int]int
	encodedSizes   map[int]int
	seen           time.Time
	bytes          int
	bad, exec, key bool
}

var header = regexp.MustCompile(`(?:^| )type=(SYSCALL|EXECVE|EOE) msg=audit\(([0-9]+)\.([0-9]{1,9}):([0-9]+)\):`)
var field = regexp.MustCompile(`(?:^| )([a-zA-Z0-9_\[\]]+)=("[^"]*"|[^ ]+)`)
var argument = regexp.MustCompile(`^a([0-9]+)(?:(_len)|\[([0-9]+)\])?$`)

func decoded(s string) (string, bool) {
	if strings.HasPrefix(s, "\"") && strings.HasSuffix(s, "\"") {
		return s[1 : len(s)-1], true
	}
	b, e := hex.DecodeString(s)
	return string(b), e == nil
}
func (p *pending) consume(kind, body string) {
	p.bytes += len(body)
	if p.bytes > 256<<10 {
		p.bad = true
		return
	}
	for _, f := range field.FindAllStringSubmatch(strings.SplitN(body, "\x1d", 2)[0], -1) {
		name, s := f[1], f[2]
		if kind == "SYSCALL" {
			switch name {
			case "exe":
				var ok bool
				p.e.Exe, ok = decoded(s)
				p.bad = p.bad || !ok
			case "uid", "pid", "ppid":
				n, err := strconv.Atoi(s)
				if err != nil || n < 0 {
					p.bad = true
				}
				switch name {
				case "uid":
					p.e.UID = n
				case "pid":
					p.e.PID = n
				case "ppid":
					p.e.PPID = n
				}
			case "key":
				p.key = strings.Trim(s, "\"") == "newids_exec"
			}
			continue
		}
		p.exec = true
		if name == "argc" {
			n, err := strconv.Atoi(s)
			p.argc = n
			p.bad = p.bad || err != nil || n < 1 || n > 8192
			continue
		}
		m := argument.FindStringSubmatch(name)
		if m == nil {
			continue
		}
		i, _ := strconv.Atoi(m[1])
		if m[2] != "" {
			n, err := strconv.Atoi(s)
			p.bad = p.bad || err != nil
			p.lengths[i] = n
			continue
		}
		value, ok := decoded(s)
		if !ok {
			p.bad = true
			continue
		}
		if m[3] == "" {
			p.args[i] = value
			continue
		}
		j, _ := strconv.Atoi(m[3])
		if p.chunks[i] == nil {
			p.chunks[i] = map[int]string{}
		}
		p.chunks[i][j] = value
		p.encodedSizes[i] += len(strings.Trim(s, "\""))
	}
}
func (p *pending) finish() (Event, bool) {
	if p.bad || !p.key || !p.exec || p.argc <= 0 || p.e.Exe == "" || !utf8.ValidString(p.e.Exe) || p.e.PID < 0 || p.e.UID < 0 || p.e.PPID < 0 {
		return p.e, false
	}
	for i := 0; i < p.argc; i++ {
		s, ok := p.args[i]
		if chunks := p.chunks[i]; chunks != nil {
			var b strings.Builder
			for j := 0; j < len(chunks); j++ {
				v, exists := chunks[j]
				if !exists {
					return p.e, false
				}
				b.WriteString(v)
			}
			s = b.String()
			n, exists := p.lengths[i]
			ok = exists && n == p.encodedSizes[i]
		}
		if !ok || !utf8.ValidString(s) {
			return p.e, false
		}
		p.e.Argv = append(p.e.Argv, s)
	}
	return p.e, true
}

type assembler map[string]*pending

func (a assembler) line(line string, emit func(*pending)) {
	m := header.FindStringSubmatchIndex(line)
	if m == nil {
		return
	}
	group := func(i int) string { return line[m[2*i]:m[2*i+1]] }
	id := group(2) + "." + group(3) + ":" + group(4)
	p := a[id]
	if group(1) == "EOE" {
		if p != nil {
			delete(a, id)
			emit(p)
		}
		return
	}
	if p == nil {
		if len(a) >= 256 {
			for k, old := range a {
				old.bad = true
				emit(old)
				delete(a, k)
				break
			}
		}
		sec, _ := strconv.ParseInt(group(2), 10, 64)
		ns, _ := strconv.Atoi((group(3) + "000000000")[:9])
		p = &pending{e: Event{ID: id, Occurred: time.Unix(sec, int64(ns)).UTC().Format(time.RFC3339Nano), UID: -1, PID: -1, PPID: -1}, args: map[int]string{}, chunks: map[int]map[int]string{}, lengths: map[int]int{}, encodedSizes: map[int]int{}}
		a[id] = p
	}
	p.seen = time.Now()
	p.consume(group(1), line[m[1]:])
}
