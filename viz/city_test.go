package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func cityFixture(t *testing.T, root, name, repo, text string) {
	t.Helper()
	d := filepath.Join(root, name)
	w := filepath.Join(d, "coordinator", "work")
	if e := os.MkdirAll(w, 0755); e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(map[string]any{"repo": repo})
	if e := os.WriteFile(filepath.Join(d, "stage.json"), b, 0644); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(w, "journal-2026-10-08.md"), []byte(text), 0644); e != nil {
		t.Fatal(e)
	}
}
func getCity(t *testing.T, root string) City {
	t.Helper()
	c, e := (&Hub{root: root}).city()
	if e != nil {
		t.Fatal(e)
	}
	return c
}
func TestCityGroupingAndParsing(t *testing.T) {
	r := t.TempDir()
	cityFixture(t, r, "one", "/repo/concert-for-travelers-api", `- 00:00 [hub-1] started headless agent worker (sol), session a
- 01:00 [worker] @hub DONE: complete
- 01:01 [worker] EXIT worker: duplicate end
- 02:00 [cli] @worker (session resumed, pid 10)
- 02:30 [worker] STOP
- 03:00 [pace] DONE fake
- 03:00 [watchdog] DONE fake
- 03:10 [worker] DONEISH no
- 03:20 [worker] PROGRESS DONE no
- 25:00 [worker] DONE invalid clock
`)
	cityFixture(t, r, "two", "/repo/concerts-for-travelers", "- 04:00 [worker] DONE second stage\n")
	cityFixture(t, r, "music-links", "", "- 05:00 [worker] DONE grouped\n")
	a, e := (&Hub{root: r}).readCityArchive()
	if e != nil {
		t.Fatal(e)
	}
	if len(a.Projects) != 1 || a.NoRepo != 1 {
		t.Fatalf("%+v", a)
	}
	p := a.Projects["Куда за музыкой"]
	if p.Daily["2026-10-08"].Done != 3 || p.Daily["2026-10-08"].Hours != 1.5 {
		t.Fatalf("%+v", p)
	}
	if !reflect.DeepEqual(p.Stages, []string{"music-links", "one", "two"}) {
		t.Fatal(p.Stages)
	}
	if projectID("default", "", "x") != "" || projectID("codex-backlog-20261023", "", "concert-worker") != "Куда за музыкой" || projectID("codex-backlog-20261023", "", "unknown") != "" {
		t.Fatal("backlog/default policy")
	}
	if projectID("a", "/a/same", "") == projectID("b", "/b/same", "") {
		t.Fatal("unknown repo fallback collided")
	}
	c := getCity(t, r)
	if len(c.Projects) != 1 || c.Projects[0].District != "Куда за музыкой" || c.Projects[0].Area <= 0 {
		t.Fatalf("%+v", c.Projects)
	}
}
func TestCityReference(t *testing.T) {
	g, e := loadCityGraph()
	if e != nil {
		t.Fatal(e)
	}
	var w struct {
		Projects map[string]*citySource `json:"projects"`
	}
	b, _ := os.ReadFile("tests/city/work.json")
	if e = json.Unmarshal(b, &w); e != nil {
		t.Fatal(e)
	}
	var ref struct {
		Names  []string `json:"names"`
		Mains  []int    `json:"mains"`
		Frames [][]int  `json:"frames"`
		Hash   string   `json:"hash"`
	}
	b, _ = os.ReadFile("tests/city/reference.json")
	if e = json.Unmarshal(b, &ref); e != nil {
		t.Fatal(e)
	}
	if ref.Hash != "1c646beb11913ac2" {
		t.Fatal(ref.Hash)
	}
	sim := simulateCityRules(g, w.Projects, 29, false, nil, true)
	for i, p := range sim.P {
		if p.name != ref.Names[i] || p.main != ref.Mains[i] {
			t.Fatalf("project %d: %s main %d expected %s/%d", i, p.name, p.main, ref.Names[i], ref.Mains[i])
		}
	}
	for day, fr := range sim.Frames {
		if !reflect.DeepEqual(fr, ref.Frames[day]) {
			for k := 0; k < min(len(fr), len(ref.Frames[day])); k++ {
				if fr[k] != ref.Frames[day][k] {
					t.Fatalf("day %d frame index %d got %d want %d (lengths %d/%d)", day, k, fr[k], ref.Frames[day][k], len(fr), len(ref.Frames[day]))
				}
			}
			t.Fatalf("day %d lengths %d/%d", day, len(fr), len(ref.Frames[day]))
		}
	}
	protected := simulateCityRules(g, w.Projects, 29, true, nil, true)
	checkCityFrames(t, g, protected)
	if cityFramesFingerprint(sim.Frames) != "910b430c5bc10060" || cityFramesFingerprint(protected.Frames) != "9e56740eebde7497" {
		t.Fatal("real-day reference or documented landmark delta changed")
	}
	t.Logf("real-day fingerprints: reference=%s protected=%s", cityFramesFingerprint(sim.Frames), cityFramesFingerprint(protected.Frames))
	for i, res := range g.Reserved {
		if res && protected.Owner[i] >= 0 {
			t.Fatal("reserved plots owned", i)
		}
	}
	for _, p := range protected.P {
		if p.main < 0 {
			continue
		}
		seen := map[int]bool{p.main: true}
		todo := []int{p.main}
		for len(todo) > 0 {
			u := todo[len(todo)-1]
			todo = todo[:len(todo)-1]
			for _, v := range g.NB[u] {
				if p.plots[v] && !seen[v] {
					seen[v] = true
					todo = append(todo, v)
				}
			}
		}
		if len(seen) != len(p.plots) {
			t.Fatalf("disconnected protected territory: %s", p.name)
		}
		if g.area(p) > cityRules.Cap*protected.CA {
			t.Fatal("area cap", p.name)
		}
		for i := range p.plots {
			if g.Island[i] != (p.name == "Delamain") {
				t.Fatal("island crossed", p.name, i)
			}
		}
	}
}
func TestCityDeterminismAndHistory(t *testing.T) {
	a, b := t.TempDir(), t.TempDir()
	for _, r := range []string{a, b} {
		names := []string{"a", "b", "c"}
		if r == b {
			names = []string{"c", "b", "a"}
		}
		for _, n := range names {
			cityFixture(t, r, n, "/repo/"+n, "- 01:00 [worker] DONE fixture\n")
		}
	}
	x, y := getCity(t, a), getCity(t, b)
	if !reflect.DeepEqual(x, y) || !reflect.DeepEqual(x, getCity(t, a)) {
		t.Fatal("restart/order changed city")
	}
	h := &Hub{root: a}
	past, e := h.cityAt("2026-10-07")
	if e != nil || len(past.Projects) != 0 {
		t.Fatalf("past %+v %v", past, e)
	}
	for _, p := range past.PlotOwners {
		if p.Owner != "" {
			t.Fatal("future project in past")
		}
	}
	for _, p := range x.Projects {
		if p.MainPlot == nil {
			t.Fatal("missing main", p.ID)
		}
		found := false
		for _, o := range x.PlotOwners {
			if o.ID == p.MainPlot.ID && o.Owner == p.ID {
				found = true
			}
		}
		if !found {
			t.Fatal("main outside territory")
		}
		if p.Tower >= 0 {
			g, _ := loadCityGraph()
			owned := false
			for _, i := range p.Plots {
				if i == g.PadPlot[p.Tower] {
					owned = true
				}
			}
			if !owned {
				t.Fatal("tower outside territory", p.ID)
			}
		}
	}
}
func TestCityHoursAndClosure(t *testing.T) {
	r := t.TempDir()
	cityFixture(t, r, "one", "/repo", `- 00:00 [hub-1] started headless agent a (sol)
- 01:00 [hub-1] started headless agent a (sol)
- 08:00 [a] DONE capped
- 09:00 [hub-1] started headless agent open (sol)
`)
	a, e := (&Hub{root: r}).readCityArchive()
	if e != nil {
		t.Fatal(e)
	}
	if a.Capped != 1 || a.Unclosed != 1 || a.Projects["/repo"].Daily["2026-10-08"].Hours != 6 {
		t.Fatalf("%+v", a)
	}
	m := a.Metas["one"]
	m.Closed = json.RawMessage(`"2026-10-09T23:00:00+03:00"`)
	a.Metas["one"] = m
	a.Latest = cityDay("2026-10-09")
	before, e := buildCity(a, cityDay("2026-10-08"), true)
	if e != nil || before.Projects[0].Closed || len(before.Projects[0].Plots) == 0 {
		t.Fatal("dated closure erased earlier territory", e)
	}
	c, e := buildCity(a, a.Latest, true)
	if e != nil {
		t.Fatal(e)
	}
	if !c.Projects[0].Closed || len(c.Projects[0].Plots) != 0 || c.Projects[0].MainPlot != nil {
		t.Fatal("closed project retained land")
	}
}
func TestCityErrorsAndMethods(t *testing.T) {
	r := t.TempDir()
	cityFixture(t, r, "one", "/repo", "")
	h := &Hub{root: r}
	mux := h.routes()
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("POST", "/city", nil))
	if w.Code != 405 {
		t.Fatal(w.Code)
	}
	for _, date := range []string{"bad", "2026-10-09"} {
		w = httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/city?date="+date, nil))
		if w.Code != 400 {
			t.Fatalf("date %s: %d", date, w.Code)
		}
	}
	os.WriteFile(filepath.Join(r, "one", "stage.json"), []byte("bad"), 0644)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/city", nil))
	if w.Code != 500 {
		t.Fatal(w.Code)
	}
}

// Opt-in live audit: go test never reads a user's home unless explicitly requested.
func TestCityLiveReferenceAudit(t *testing.T) {
	out := os.Getenv("CITY_AUDIT_OUT")
	if out == "" {
		t.Skip("set CITY_AUDIT_OUT for read-only live audit")
	}
	root := os.Getenv("CITY_AUDIT_ROOT")
	if root == "" {
		home, _ := os.UserHomeDir()
		root = filepath.Join(home, "agent-hub")
	}
	a, e := (&Hub{root: root}).readCityArchive()
	if e != nil {
		t.Fatal(e)
	}
	var work struct {
		Projects map[string]*citySource `json:"projects"`
	}
	b, _ := os.ReadFile("tests/city/work.json")
	json.Unmarshal(b, &work)
	g, e := loadCityGraph()
	if e != nil {
		t.Fatal(e)
	}
	baseline := simulateCityRules(g, work.Projects, 29, false, nil, true)
	protected := simulateCityRules(g, work.Projects, 29, true, nil, true)
	current := simulateCity(g, a.Projects, dayIndex(a.Latest)+1, true, a)
	checkCityFrames(t, g, simulateCity(g, a.Projects, dayIndex(a.Latest)+1, true, nil))
	type delta struct {
		Plot int    `json:"plot"`
		From string `json:"from"`
		To   string `json:"to"`
	}
	differences := func(x, y *citySim) []delta {
		d := []delta{}
		for i, o := range x.Owner {
			from, to := "", ""
			if o >= 0 {
				from = x.P[o].name
			}
			if y.Owner[i] >= 0 {
				to = y.P[y.Owner[i]].name
			}
			if from != to {
				d = append(d, delta{g.Plots[i].ID, from, to})
			}
		}
		return d
	}
	daily := map[string]any{}
	for name, p := range a.Projects {
		ref := work.Projects[name]
		for date, d := range p.Daily {
			var old *cityDaily
			if ref != nil {
				old = ref.Daily[date]
			}
			if !reflect.DeepEqual(d, old) {
				daily[name+"/"+date] = map[string]any{"reference": old, "live": d}
			}
		}
	}
	audit := map[string]any{"date": a.Latest.Format("2006-01-02"), "reference": "1c646beb11913ac2", "referenceToProtected": differences(baseline, protected), "protectedToLive": differences(protected, current), "changedDailyInputs": daily, "cappedRuns": a.Capped, "unclosedRuns": a.Unclosed, "unassignedDone": a.UnassignedDone}
	audit["referenceRealFrames"] = cityFramesFingerprint(baseline.Frames)
	audit["protectedRealFrames"] = cityFramesFingerprint(protected.Frames)
	reservations := []int{}
	for i := range g.Reserved {
		if g.Reserved[i] && !g.BaseReserved[i] {
			reservations = append(reservations, g.Plots[i].ID)
		}
	}
	audit["additionalLandmarkPlotIDs"] = reservations
	b, e = json.MarshalIndent(audit, "", "  ")
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(out, b, 0644); e != nil {
		t.Fatal(e)
	}
	t.Logf("reference -> protected: %d owner changes; protected -> live: %d; daily inputs changed: %d", len(differences(baseline, protected)), len(differences(protected, current)), len(daily))
}
