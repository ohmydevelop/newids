package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Policy struct {
	Mounts     []string `json:"mounts"`
	SystemInfo bool     `json:"system_info"`
	Timeout    int      `json:"timeout_seconds"`
	Output     int      `json:"output_bytes"`
}
type Config struct {
	Server     string   `json:"server"`
	Token      string   `json:"token"`
	Shellguard string   `json:"shellguard"`
	Newbox     string   `json:"newbox"`
	Spool      string   `json:"spool"`
	Threshold  *float64 `json:"threshold"`
	Policy     Policy   `json:"policy"`
}

var httpClient = &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

func (c Config) post(op string, in, out any) error {
	body, err := json.Marshal(in)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", strings.TrimRight(c.Server, "/")+"/v1/device/"+op, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("%s: HTTP %d", op, resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
	}
	_, err = io.Copy(io.Discard, resp.Body)
	return err
}
func load(path string) (Config, error) {
	c := Config{Policy: Policy{Mounts: []string{}, Timeout: 5, Output: 65536}}
	b, e := os.ReadFile(path)
	if e != nil {
		return c, e
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if e = d.Decode(&c); e != nil {
		return c, e
	}
	u, e := url.Parse(c.Server)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || !(u.Scheme == "https" || u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1")) {
		return c, errors.New("invalid server URL; remote endpoints require HTTPS")
	}
	if len(c.Token) < 32 {
		return c, errors.New("endpoint token too short")
	}
	return c, nil
}
func main() {
	if len(os.Args) != 3 {
		log.Fatal("usage: newids-client worker|collector CONFIG")
	}
	c, err := load(os.Args[2])
	if err != nil {
		log.Fatal(err)
	}
	switch os.Args[1] {
	case "worker":
		if os.Geteuid() == 0 {
			log.Fatal("run worker as an unprivileged user")
		}
		if !filepath.IsAbs(c.Newbox) || c.Policy.Timeout < 1 || c.Policy.Timeout > 60 || c.Policy.Output < 1 || c.Policy.Output > 262144 || c.Policy.Mounts == nil {
			log.Fatal("invalid Newbox settings")
		}
		runWorker(c)
	case "collector":
		if !filepath.IsAbs(c.Shellguard) || !filepath.IsAbs(c.Spool) || c.Threshold == nil || *c.Threshold < 0 || *c.Threshold > 1 {
			log.Fatal("invalid collector settings")
		}
		if err := collect(context.Background(), c, os.Stdin); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatal("unknown mode")
	}
}
