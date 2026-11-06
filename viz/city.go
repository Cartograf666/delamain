package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Version 4 makes vacancy an actual ownership release.
// Identity and all
// provisional numerical rules are here; changing them requires a new version.
var cityRules = struct {
	Version                                                                                     int
	Start                                                                                       string
	HourCap                                                                                     float64
	Offset                                                                                      int
	K, Cap, Step, HourW                                                                         float64
	Grace, HalfLife, Take, DarkAfter, LightFade, Cool, RelDelay, RelRate, Push, Floor, BiteDays int
	CoreRadius, RoomRadius, ClaimRadius, ClaimShare, MinLight, PushRatio, PushExtra             float64
	MinimumRoom                                                                                 int
	PlaceGaps, Intensity, InnerFractions                                                        []float64
	EdgeCosts                                                                                   map[string]float64
	Repo, NoRepo, Backlog                                                                       map[string]string
}{
	Version: 4, Start: "2026-10-08", HourCap: 6, Offset: 3 * 3600,
	K: 110, Cap: .25, Step: .015, HourW: 1, Grace: 3, HalfLife: 9, Take: 14, DarkAfter: 6, LightFade: 10, Cool: 14, RelDelay: 7, RelRate: 6, Push: 4, Floor: 3, BiteDays: 21,
	CoreRadius: 120, RoomRadius: 130, ClaimRadius: 110, ClaimShare: .35, MinLight: .12, PushRatio: 2, PushExtra: 1, MinimumRoom: 25,
	PlaceGaps: []float64{190, 150, 110, 80, 50, 25, 0}, Intensity: []float64{5, 15, 40}, InnerFractions: []float64{.4, .2, .08},
	EdgeCosts: map[string]float64{"block": 1, "street": 1.6, "collector": 2.5, "avenue": 6},
	Repo:      map[string]string{"Dota2Helper": "Dota2Helper", "lotr-minas": "Minas Tirith", "stravel": "Stravel", "concert-for-travelers-api": "Куда за музыкой", "concerts-for-travelers": "Куда за музыкой", "dota-clip-factory": "Clip Factory", "roblox-sokoban": "Crate Trail", "bobby-carrot-1": "Bobby Carrot", "Telegram-iOS": "Telegram", "telegram-reading-ios": "Telegram", "roblox-clicker": "Roblox Clicker", "ai-design-stories": "AI Design Stories", "sochen-app": "Sochen", "agent-harness": "Agent Harness", "snake": "Laser Snake", "delamain": "Delamain", "project": "Delamain", "dark-patterns-stageshow": "Dark Patterns", "production-delamain": "Dark Patterns", "dev-plugin-chrome": "Alfa Inspector", "space-clode-vs-codex": "Mascot Shooter", "meme-library": "Meme Library", "dota-server": "Dota Server", "twin-lab": "Twin Lab", "dota-creators-research": "Dota Creators"},
	NoRepo:    map[string]string{"dota-want-sheet-content": "Dota2Helper", "music-links": "Куда за музыкой", "music-seo": "Куда за музыкой", "concerts-ig-concept": "Куда за музыкой", "ready-solution-recovery": "Agent Harness", "dash-concept-screens": "DASH", "vibeskills-claude-plugin": "VibeSkills", "vibeskills-design-gate-coverage": "VibeSkills", "vibeskills-eval-automation": "VibeSkills", "vibeskills-gate-outcomes": "VibeSkills", "vibeskills-install-freshness": "VibeSkills", "vibeskills-project-contract": "VibeSkills"},
	Backlog:   map[string]string{"d2h": "Dota2Helper", "skin": "Dota2Helper", "concert": "Куда за музыкой", "stravel": "Stravel", "vibeskills": "VibeSkills"},
}

// projectID is the single grouping policy. Unknown future repos keep their full
// path identity; unknown no-repo stages stand alone rather than disappearing.
func projectID(stageName, repo, tag string) string {
	if stageName == "default" {
		return ""
	}
	if stageName == "codex-backlog-20261023" {
		for _, key := range []string{"d2h", "skin", "concert", "stravel", "vibeskills"} {
			if strings.HasPrefix(tag, key) {
				return cityRules.Backlog[key]
			}
		}
		return ""
	}
	if p := cityRules.NoRepo[stageName]; p != "" {
		return p
	}
	if p := cityRules.Repo[filepath.Base(repo)]; p != "" {
		return p
	}
	if repo != "" {
		return filepath.Clean(repo)
	}
	return stageName
}
func cityHash(s string) uint32 {
	h := uint32(2166136261)
	for _, b := range []byte(s) {
		h = (h ^ uint32(b)) * 16777619
	}
	return h
}
func cityClock() *time.Location { return time.FixedZone("journal", cityRules.Offset) }
func cityDay(s string) time.Time {
	t, _ := time.ParseInLocation("2006-01-02", s, cityClock())
	return t
}
func dayIndex(t time.Time) int { return int(t.Sub(cityDay(cityRules.Start)).Hours() / 24) }

type cityDaily struct {
	Done  int     `json:"done"`
	Hours float64 `json:"hours"`
	Lines int     `json:"lines"`
}
type CityLine struct {
	Stage string `json:"stage"`
	Tag   string `json:"tag"`
	Text  string `json:"text"`
	At    string `json:"at"`
}
type cityLine struct {
	stage, tag, text string
	at               time.Time
}
type cityMeta struct {
	Repo   string          `json:"repo"`
	Goal   string          `json:"goal"`
	Closed json.RawMessage `json:"closed"`
}
type citySource struct {
	Stages      []string              `json:"stages"`
	Daily       map[string]*cityDaily `json:"daily"`
	First, Last string
	Lines       []CityLine
}
type cityArchive struct {
	Projects                         map[string]*citySource
	Metas                            map[string]cityMeta
	Latest                           time.Time
	NoRepo                           int
	Rows                             []cityLine
	Capped, Unclosed, UnassignedDone int
}

var (
	// Keep the archive grammar separate from the live event parser. Python's
	// word boundary is Unicode-aware; Go's \b would count DONEя as DONE.
	cityJournalRE = regexp.MustCompile(`^- (\d\d):(\d\d) \[([^\]]*)\] ?(.*)`)
	cityDoneRE    = regexp.MustCompile(`^(?:@hub\s+)?DONE(?:$|[^\p{L}\p{N}_])`)
	cityStopRE    = regexp.MustCompile(`^(?:@hub\s+)?STOP(?:$|[^\p{L}\p{N}_])`)
	cityEndRE     = regexp.MustCompile(`^(?:@hub\s+)?(?:DONE|STOP|EXIT|ENDED|REVIEWED|BLOCKED)(?:$|[^\p{L}\p{N}_])`)
	cityHubRE     = regexp.MustCompile(`^(?:.*-)?hub-\d+$`)
	cityStartRE   = regexp.MustCompile(`^started headless agent (\S+)`)
	cityResumeRE  = regexp.MustCompile(`^@(\S+) \(session resumed`)
)

// readCityArchive preserves the reference's sorted file order, exact service-tag
// exclusion, first-start pairing, six-hour cap and per-day two-decimal rounding.
func (h *Hub) readCityArchive() (*cityArchive, error) {
	a := &cityArchive{Projects: map[string]*citySource{}, Metas: map[string]cityMeta{}, Latest: cityDay(cityRules.Start)}
	metas, _ := filepath.Glob(filepath.Join(h.root, "*", "stage.json"))
	for _, p := range metas {
		b, e := os.ReadFile(p)
		if e != nil {
			return nil, e
		}
		var m cityMeta
		if e = json.Unmarshal(b, &m); e != nil {
			return nil, fmt.Errorf("%s: %w", p, e)
		}
		a.Metas[filepath.Base(filepath.Dir(p))] = m
	}
	paths, _ := filepath.Glob(filepath.Join(h.root, "*", "coordinator", "work", "journal-*.md"))
	for _, p := range paths {
		m := journalRE.FindStringSubmatch(filepath.Base(p))
		if m == nil {
			continue
		}
		day := cityDay(m[1])
		if day.IsZero() {
			continue
		}
		if day.After(a.Latest) {
			a.Latest = day
		}
		name := filepath.Base(filepath.Dir(filepath.Dir(filepath.Dir(p))))
		if _, ok := a.Metas[name]; !ok {
			a.Metas[name] = cityMeta{}
		}
		f, e := os.Open(p)
		if e != nil {
			return nil, e
		}
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
		for sc.Scan() {
			m := cityJournalRE.FindStringSubmatch(sc.Text())
			if m == nil {
				continue
			}
			hh, _ := strconv.Atoi(m[1])
			mm, _ := strconv.Atoi(m[2])
			if hh > 23 || mm > 59 {
				continue
			}
			a.Rows = append(a.Rows, cityLine{name, m[3], m[4], day.Add(time.Duration(hh)*time.Hour + time.Duration(mm)*time.Minute)})
		}
		e = sc.Err()
		f.Close()
		if e != nil {
			return nil, e
		}
	}
	for _, m := range a.Metas {
		if m.Repo == "" {
			a.NoRepo++
		}
	}
	starts := map[string]time.Time{}
	for _, l := range a.Rows {
		if l.tag == "pace" || l.tag == "watchdog" {
			continue
		}
		id := projectID(l.stage, a.Metas[l.stage].Repo, l.tag)
		d := l.at.Format("2006-01-02")
		m := cityStartRE.FindStringSubmatch(l.text)
		if m == nil {
			m = cityResumeRE.FindStringSubmatch(l.text)
		}
		if m != nil && !cityHubRE.MatchString(m[1]) {
			k := l.stage + "\x00" + m[1]
			if _, ok := starts[k]; !ok {
				starts[k] = l.at
			}
		}
		var p *citySource
		var daily *cityDaily
		if id != "" {
			p = a.Projects[id]
			if p == nil {
				p = &citySource{Daily: map[string]*cityDaily{}, Lines: []CityLine{}}
				a.Projects[id] = p
			}
			if !containsString(p.Stages, l.stage) {
				p.Stages = append(p.Stages, l.stage)
			}
			daily = p.Daily[d]
			if daily == nil {
				daily = &cityDaily{}
				p.Daily[d] = daily
			}
			daily.Lines++
			at := l.at.Format(time.RFC3339)
			if p.First == "" || at < p.First {
				p.First = at
			}
			if at > p.Last {
				p.Last = at
			}
			p.Lines = append(p.Lines, CityLine{l.stage, l.tag, l.text, at})
		}
		if cityDoneRE.MatchString(l.text) || cityStopRE.MatchString(l.text) && strings.Contains(l.text, "REPORT") {
			if daily != nil {
				daily.Done++
			} else {
				a.UnassignedDone++
			}
		}
		k := l.stage + "\x00" + l.tag
		if cityEndRE.MatchString(l.text) {
			if start, ok := starts[k]; ok {
				hours := l.at.Sub(start).Hours()
				delete(starts, k)
				if hours < 0 {
					continue
				} // a reversed source clock is not evidence of negative work
				if hours > cityRules.HourCap {
					hours = cityRules.HourCap
					a.Capped++
				}
				if daily != nil {
					daily.Hours += hours
				}
			}
		}
	}
	a.Unclosed = len(starts)
	for _, p := range a.Projects {
		sort.Strings(p.Stages)
		for _, d := range p.Daily {
			d.Hours = roundEven(d.Hours, 2)
		}
		sort.SliceStable(p.Lines, func(i, j int) bool { return p.Lines[i].At < p.Lines[j].At })
	}
	return a, nil
}
func containsString(a []string, s string) bool {
	for _, x := range a {
		if x == s {
			return true
		}
	}
	return false
}

// projectClosed is provisional: all member stages must be closed, effective no
// earlier than the latest dated close. Undated truthy closes use the archive date.
func projectClosed(p *citySource, a *cityArchive, date time.Time) bool {
	if len(p.Stages) == 0 {
		return false
	}
	for _, s := range p.Stages {
		raw := a.Metas[s].Closed
		if len(raw) == 0 || string(raw) == "null" || string(raw) == "false" || string(raw) == `""` {
			return false
		}
		var str string
		json.Unmarshal(raw, &str)
		effective := a.Latest
		if len(str) >= 10 {
			if t := cityDay(str[:10]); !t.IsZero() {
				effective = t
			}
		}
		if date.Before(effective) {
			return false
		}
	}
	return true
}
func (h *Hub) city() (City, error) { return h.cityAt("") }
func (h *Hub) cityAt(date string) (City, error) {
	a, e := h.readCityArchive()
	if e != nil {
		return City{}, e
	}
	at := a.Latest
	if date != "" {
		at = cityDay(date)
		if at.IsZero() {
			return City{}, fmt.Errorf("invalid date")
		}
	}
	return buildCity(a, at, true)
}

// Celebrations: a merge, a release or an opened PR becomes fireworks over the project's district.
// The tokens follow the status-word rule above: the word opens the line (after an optional
// "@hub ") and ends at a non-word character, so "MERGEDX" or "a PR was MERGED" never count.
// MERGED is the line `await --ok MERGED` already writes; RELEASED and PR-OPENED are explicit
// tokens. A merge and an opened PR need a link, a release needs a version: nothing is guessed.
var (
	celebrationRE        = regexp.MustCompile(`^(?:@hub\s+)?(MERGED|RELEASED|PR-OPENED)(?:$|[^\p{L}\p{N}_-])(.*)$`)
	celebrationLinkRE    = regexp.MustCompile(`https?://[^\s<>()\[\]]+`)
	celebrationVersionRE = regexp.MustCompile(`^v?\d[\p{L}\p{N}._+-]*`)
)

// celebrationWindow is how long a celebration stays in /state; the page plays only fresh ones.
const celebrationWindow = 2 * time.Minute

type Celebration struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"` // pr-opened | pr-merged | release
	Project string `json:"project"`
	TS      string `json:"ts"`
	at      time.Time
}

// celebrationOf returns the kind and the key that identifies the occasion (link or version).
func celebrationOf(text string) (kind, key string, ok bool) {
	m := celebrationRE.FindStringSubmatch(strings.TrimSpace(text))
	if m == nil {
		return "", "", false
	}
	rest := strings.TrimSpace(m[2])
	link := strings.TrimRight(celebrationLinkRE.FindString(rest), ".,;:!?'\"")
	switch m[1] {
	case "MERGED":
		kind, key = "pr-merged", link
	case "PR-OPENED":
		kind, key = "pr-opened", link
	case "RELEASED":
		kind, key = "release", celebrationVersionRE.FindString(rest)
	}
	if key == "" {
		return "", "", false
	}
	return kind, key, true
}

// celebrate records a fresh celebration of a live line once per id. Caller holds mu.
func (h *Hub) celebrate(ev *Event, now time.Time) {
	kind, key, ok := celebrationOf(ev.Text)
	if !ok || now.Sub(ev.at) >= celebrationWindow {
		return
	}
	project := projectID(ev.Stage, ev.Repo, ev.Tag)
	if project == "" {
		return
	}
	id := kind + "|" + project + "|" + key
	for _, c := range h.celebrations {
		if c.ID == id {
			return
		}
	}
	h.celebrations = append(h.celebrations, Celebration{ID: id, Kind: kind, Project: project, TS: ev.At, at: ev.at})
}

// recentCelebrations drops the stale ones and returns a copy for the state. Caller holds mu.
func (h *Hub) recentCelebrations(now time.Time) []Celebration {
	kept := h.celebrations[:0]
	for _, c := range h.celebrations {
		if now.Sub(c.at) < celebrationWindow {
			kept = append(kept, c)
		}
	}
	h.celebrations = kept
	return append([]Celebration{}, kept...)
}
