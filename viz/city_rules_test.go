package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
)

func TestCityReferenceParserExclusions(t *testing.T) {
	r := t.TempDir()
	cityFixture(t, r, "one", "/repo/stravel", `- 00:00 [hub-1] started headless agent Team.X-hub-7 (codex)
- 00:01 [Team.X-hub-7] DONE hub completion
- 01:00 [cli] started headless agent worker (codex)
- 02:00 [worker] STOP /tmp/a-REPORT.md finished
- 02:01 [worker] @hub STOP: REPORT complete
- 02:02 [worker] STOP without a report
- 02:03 [worker] STOP report.md
- 02:04 [worker] STOPISH REPORT
- 02:05 [worker] STOPя REPORT
- 02:06 [worker] DONEя
- 02:07 [worker] @other DONE
- 02:08 [worker] PROGRESS DONE REPORT
- 02:09 [pace] DONE REPORT
- 02:10 [watchdog] STOP REPORT
- 02:11 [pace/sub] DONE exact service tags only
- 02:12 [] DONE empty tag is allowed
- 2:13 [worker] DONE one-digit hour is excluded
- 02:14 [worker]  DONE leading space is excluded
- 02:15 [worker]	DONE tab is not the optional space
- 02:16 [worker] MERGED REPORT is not a completion
`)
	cityFixture(t, r, "default", "", "- 03:00 [worker] STOP REPORT\n")
	cityFixture(t, r, "codex-backlog-20261023", "", "- 03:00 [unknown] DONE unassigned\n- 03:01 [stravel-worker] STOP REPORT\n")
	a, err := (&Hub{root: r}).readCityArchive()
	if err != nil {
		t.Fatal(err)
	}
	d := a.Projects["Stravel"].Daily["2026-10-08"]
	if d.Done != 6 || d.Hours != 1 || d.Lines != 18 || a.UnassignedDone != 2 || a.Unclosed != 0 {
		t.Fatalf("daily=%+v unassigned=%d unclosed=%d", d, a.UnassignedDone, a.Unclosed)
	}
}

func frozenCityWork(t *testing.T) map[string]*citySource {
	t.Helper()
	var w struct {
		Projects map[string]*citySource `json:"projects"`
		Stat     map[string]int         `json:"stat"`
	}
	b, err := os.ReadFile("tests/city/work.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &w); err != nil {
		t.Fatal(err)
	}
	done := 0
	for _, p := range w.Projects {
		for _, d := range p.Daily {
			done += d.Done
		}
	}
	if len(w.Projects) != 23 || done != 1368 || w.Stat["done_word"] != 995 || w.Stat["done_stop"] != 373 {
		t.Fatalf("frozen input changed: projects=%d done=%d stat=%v", len(w.Projects), done, w.Stat)
	}
	return w.Projects
}

func TestCityFrozenFingerprint(t *testing.T) {
	frozenCityWork(t)
	var ref struct{ Frames [][]int }
	b, err := os.ReadFile("tests/city/reference.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &ref); err != nil {
		t.Fatal(err)
	}
	// Python json.dumps uses a space after each comma. The reference hash
	// identifies all 210 forecast frames; TestCityReference compares real days 0..28.
	hash := cityFramesFingerprint(ref.Frames)
	if len(ref.Frames) != 210 || hash != "1c646beb11913ac2" {
		t.Fatalf("frames=%d hash=%s", len(ref.Frames), hash)
	}
}

func cityFramesFingerprint(frames [][]int) string {
	b, _ := json.Marshal(frames)
	b = bytes.ReplaceAll(b, []byte(","), []byte(", "))
	return fmt.Sprintf("%x", sha256.Sum256(b))[:16]
}

// Opt-in parity against parse_journal.py on an immutable copy of real journals.
// Generate its work.json in an evidence directory, never in the source simulation.
func TestCityArchiveParserParity(t *testing.T) {
	file, root := os.Getenv("CITY_PARSER_REFERENCE"), os.Getenv("CITY_AUDIT_ROOT")
	if file == "" || root == "" {
		t.Skip("set CITY_PARSER_REFERENCE and CITY_AUDIT_ROOT")
	}
	var ref struct {
		Projects map[string]*citySource `json:"projects"`
		Stat     map[string]int         `json:"stat"`
	}
	b, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &ref); err != nil {
		t.Fatal(err)
	}
	a, err := (&Hub{root: root}).readCityArchive()
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Projects) != len(ref.Projects) {
		t.Fatalf("projects %d/%d", len(a.Projects), len(ref.Projects))
	}
	done := a.UnassignedDone
	for name, p := range a.Projects {
		r := ref.Projects[name]
		if r == nil || !reflect.DeepEqual(p.Daily, r.Daily) || !reflect.DeepEqual(p.Stages, r.Stages) {
			t.Fatalf("parser differs for %s", name)
		}
		for _, d := range p.Daily {
			done += d.Done
		}
	}
	if done != ref.Stat["done_all"] || a.Capped != ref.Stat["runs_capped"] || a.Unclosed != ref.Stat["runs_never_closed"] || a.UnassignedDone != ref.Stat["done_unassigned"] {
		t.Fatalf("done=%d capped=%d unclosed=%d unassigned=%d reference=%v", done, a.Capped, a.Unclosed, a.UnassignedDone, ref.Stat)
	}
	t.Logf("real archive parity: %d projects, %d tasks (%d DONE + %d STOP/REPORT), every daily done/hour/line matched", len(a.Projects), done, ref.Stat["done_word"], ref.Stat["done_stop"])
}

func starterGraph(n int, edges [][2]int) *cityGraph {
	g := &cityGraph{Plots: make([]cityPlot, n), NB: make([][]int, n), Adj: make([][]cityEdge, n), Island: make([]bool, n)}
	for _, e := range edges {
		a, b := e[0], e[1]
		g.NB[a] = append(g.NB[a], b)
		g.NB[b] = append(g.NB[b], a)
		g.Adj[a] = append(g.Adj[a], cityEdge{b, 1})
		g.Adj[b] = append(g.Adj[b], cityEdge{a, 1})
	}
	return g
}

func TestCityConstrainedStarter(t *testing.T) {
	// 1 is a tempting dangling edge, but its only path to three plots takes
	// the donor's main (0). The chain 5-4-3 is a valid bite instead.
	g := starterGraph(9, [][2]int{{0, 1}, {0, 2}, {2, 3}, {3, 4}, {4, 5}, {0, 6}, {6, 7}, {7, 8}})
	q := &cityTerritory{main: 0, plots: map[int]bool{}}
	s := &citySim{P: []*cityTerritory{q}, Owner: make([]int, 9), Reserved: make([]bool, 9)}
	for i := range s.Owner {
		q.plots[i] = true
	}
	before := sortedPlots(q)
	if got := s.starter(g, 1, 0, false, false); got != nil {
		t.Fatal("constrained edge stole main", got)
	}
	if got := s.starter(g, 2, 0, false, false); got != nil {
		t.Fatal("bite disconnected donor's remaining branch", got)
	}
	if got := s.starter(g, 5, 0, false, false); !reflect.DeepEqual(got, []int{5, 4, 3}) {
		t.Fatal("valid contiguous bite", got)
	}
	s.Reserved[4] = true
	if got := s.starter(g, 5, 0, false, false); got != nil {
		t.Fatal("protected landmark stolen", got)
	}
	if !reflect.DeepEqual(before, sortedPlots(q)) {
		t.Fatal("planning changed donor")
	}
	for i := range s.Owner {
		s.Owner[i] = -1
	}
	if got := s.starter(g, 5, -1, false, false); got != nil {
		t.Fatal("free starter jumped protected gap", got)
	}
	s.Reserved[4] = false
	g.Island[3] = true
	if got := s.starter(g, 5, -1, false, true); got != nil {
		t.Fatal("starter crossed island border", got)
	}
}

// Reconstruct every day's ownership from frames, independently of the final
// territory maps. This catches temporary disconnected donors and tiny starters.
func checkCityFrames(t *testing.T, g *cityGraph, s *citySim) {
	t.Helper()
	code := make([]int, len(g.Plots))
	hasHome := false
	for _, p := range s.P {
		hasHome = hasHome || p.name == "Delamain"
	}
	for day, frame := range s.Frames {
		for k := 0; k < len(frame); k += 2 {
			code[frame[k]] = frame[k+1]
		}
		for pi, p := range s.P {
			plots := map[int]bool{}
			area := 0.
			for i, c := range code {
				if c&31 != pi+1 {
					continue
				}
				if s.Reserved[i] || hasHome && g.Island[i] != (p.name == "Delamain") {
					t.Fatalf("day %d %s owns protected/island plot %d", day, p.name, i)
				}
				plots[i] = true
				area += g.Area[i]
			}
			if len(plots) == 0 {
				continue
			}
			territory := &cityTerritory{main: p.main, plots: plots}
			if len(plots) < cityRules.Floor || !plots[p.main] || connectedCount(g, territory, -1) != len(plots) || area > cityRules.Cap*s.CA+1e-7 {
				t.Fatalf("day %d %s: plots=%d main=%d area=%f cap=%f", day, p.name, len(plots), p.main, area, cityRules.Cap*s.CA)
			}
		}
	}
}

func TestCityStress(t *testing.T) {
	g, err := loadCityGraph()
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"real", "monster", "alone", "late", "silence"} {
		t.Run(mode, func(t *testing.T) {
			work := frozenCityWork(t)
			days := 210
			if mode == "real" {
				days = 29
			}
			if mode == "monster" || mode == "alone" {
				for _, d := range work["Dota2Helper"].Daily {
					d.Done *= 20
					d.Hours *= 20
				}
			}
			if mode == "alone" {
				work = map[string]*citySource{"Dota2Helper": work["Dota2Helper"]}
			}
			// Replay is test input only; production never fabricates future work.
			if mode != "silence" {
				for _, p := range work {
					for day := 29; day < days; day++ {
						from := cityDay(cityRules.Start).AddDate(0, 0, 1+(day-1)%28).Format("2006-01-02")
						to := cityDay(cityRules.Start).AddDate(0, 0, day).Format("2006-01-02")
						if d := p.Daily[from]; d != nil {
							copy := *d
							p.Daily[to] = &copy
						}
					}
				}
			}
			if mode == "late" {
				for i, born := range []int{60, 90, 120} {
					p := &citySource{Daily: map[string]*cityDaily{}}
					for day := born; day < days; day++ {
						p.Daily[cityDay(cityRules.Start).AddDate(0, 0, day).Format("2006-01-02")] = &cityDaily{Done: 10, Lines: 1}
					}
					work[fmt.Sprintf("Newcomer %d", i)] = p
				}
			}
			s := simulateCity(g, work, days, true, nil)
			checkCityFrames(t, g, s)
			if mode == "late" {
				for _, p := range s.P {
					if p.born >= 60 && p.main < 0 {
						t.Fatal("late newcomer never seated", p.name)
					}
				}
			}
		})
	}
}

func TestCitySaturatedEdgeBite(t *testing.T) {
	// A small ring has fewer than 25 free plots after the host grows.
	// This exercises placement itself, including skipping an impossible seed.
	edges := make([][2]int, 30)
	for i := range edges {
		edges[i] = [2]int{i, (i + 1) % 30}
	}
	g := starterGraph(30, edges)
	g.Home = 15
	g.Area = make([]float64, 30)
	g.BaseReserved = make([]bool, 30)
	g.Reserved = make([]bool, 30)
	g.Room = make([][]int, 30)
	g.Reserved[15], g.BaseReserved[15] = true, true
	for i := range g.Plots {
		g.Area[i] = 1
		g.Plots[i].X = float64(i) * 10
		for j := range g.Plots {
			g.Room[i] = append(g.Room[i], j)
		}
	}
	work := map[string]*citySource{
		"Host":     {Daily: map[string]*cityDaily{"2026-10-08": {Done: 1000, Lines: 1}}},
		"Newcomer": {Daily: map[string]*cityDaily{"2026-10-11": {Done: 1, Lines: 1}}},
	}
	for i := range g.Plots {
		g.Plots[i].ID = 1000 + i
	}
	withoutNewcomer := simulateCity(g, work, 3, true, nil)
	if len(withoutNewcomer.Captures) != 0 {
		t.Fatal("free land triggered a capture")
	}
	s := simulateCity(g, work, 4, true, nil)
	if len(s.Captures) == 0 {
		t.Fatal("missing border capture")
	}
	for _, event := range s.Captures {
		index := event.PlotID - 1000
		if event.From != "Host" || event.To != "Newcomer" || index < 0 || index >= len(g.Plots) ||
			withoutNewcomer.Owner[index] != 0 || s.Owner[index] != 1 {
			t.Fatalf("capture does not describe transferred occupied land: %+v", event)
		}
	}
	checkCityFrames(t, g, s)
	if s.P[1].host != 0 || s.Series[3][1].N != 3 || s.Series[3][0].N < 3 {
		t.Fatalf("host=%d newcomer=%+v donor=%+v", s.P[1].host, s.Series[3][1], s.Series[3][0])
	}
}
