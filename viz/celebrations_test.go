package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestCelebrationTokens(t *testing.T) {
	for _, c := range []struct{ text, kind, key string }{
		{"@hub MERGED PR #12 — https://github.com/o/r/pull/12 (exit 0, 11m, log /tmp/a.log)", "pr-merged", "https://github.com/o/r/pull/12"},
		{"MERGED https://gitlab.example/mr/12.", "pr-merged", "https://gitlab.example/mr/12"},
		{"@hub RELEASED v1.4.0 — notes https://x/y", "release", "v1.4.0"},
		{"RELEASED 2026.11.05", "release", "2026.11.05"},
		{"RELEASED: 0.9.1-rc.2", "release", "0.9.1-rc.2"},
		{"PR-OPENED https://github.com/o/r/pull/7", "pr-opened", "https://github.com/o/r/pull/7"},
		{"@hub PR-OPENED fix lights (https://github.com/o/r/pull/8)", "pr-opened", "https://github.com/o/r/pull/8"},
	} {
		kind, key, ok := celebrationOf(c.text)
		if !ok || kind != c.kind || key != c.key {
			t.Errorf("%q: got %q %q %v, want %q %q", c.text, kind, key, ok, c.kind, c.key)
		}
	}
	for _, text := range []string{
		"", "MERGED", "@hub MERGED PR #12 (exit 0)", // a merge without a link is not guessed
		"MERGEDX https://x/y", "MERGED-ish https://x/y", "the PR was MERGED https://x/y", "merged https://x/y",
		"RELEASED", "RELEASED notes later", "RELEASEDv1", "we RELEASED v1.0", "released v1.0", "@hub DONE RELEASED v1",
		"PR-OPENED", "PR-OPENED #12", "PR-OPENEDX https://x/y", "PR OPENED https://x/y", "opened PR https://x/y",
		"@hubMERGED https://x/y",
	} {
		if kind, key, ok := celebrationOf(text); ok {
			t.Errorf("%q: unexpected %q %q", text, kind, key)
		}
	}
}

func TestCelebrateDedupesAndExpires(t *testing.T) {
	h := &Hub{}
	now := time.Date(2026, 11, 5, 14, 7, 30, 0, time.Local)
	line := func(text string, at time.Time) *Event {
		return &Event{Stage: "city-celebrations", Repo: "/src/delamain", Tag: "hub-3-await", Text: text, At: at.Format(time.RFC3339), at: at}
	}
	minute := now.Truncate(time.Minute)
	h.celebrate(line("@hub MERGED PR #1 — https://g/o/r/pull/1 (exit 0)", minute), now)
	h.celebrate(line("@hub MERGED PR #1 — https://g/o/r/pull/1 (exit 0, again)", minute), now)
	h.celebrate(line("RELEASED v2.0.0", minute), now)
	h.celebrate(line("PR-OPENED https://g/o/r/pull/2", minute.Add(-3*time.Minute)), now) // a stale line is not news
	h.celebrate(line("@hub DONE all good", minute), now)
	got := h.recentCelebrations(now)
	if len(got) != 2 || got[0].Kind != "pr-merged" || got[1].Kind != "release" {
		t.Fatalf("got %+v", got)
	}
	if got[0].Project != projectID("city-celebrations", "/src/delamain", "hub-3-await") || got[0].ID == got[1].ID {
		t.Fatalf("project/id: %+v", got)
	}
	b, _ := json.Marshal(got[0])
	var m map[string]any
	json.Unmarshal(b, &m)
	if len(m) != 4 || m["id"] == nil || m["kind"] == nil || m["project"] == nil || m["ts"] == nil {
		t.Fatalf("wire shape %s", b)
	}
	if left := h.recentCelebrations(now.Add(celebrationWindow)); len(left) != 0 {
		t.Fatalf("expired celebrations kept: %+v", left)
	}
}
