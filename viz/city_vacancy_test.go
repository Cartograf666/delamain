package main

import (
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"
)

func TestCityActualVacancyHistory(t *testing.T) {
	g, err := loadCityGraph()
	if err != nil {
		t.Fatal(err)
	}
	work := frozenCityWork(t)
	s := simulateCity(g, work, 90, true, nil)
	checkCityFrames(t, g, s)
	// Reconstruct canonical occupation independently from the daily frame deltas.
	code := make([]int, len(g.Plots))
	lastChanged := make([]int, len(code))
	previousOwner := make([]int, len(code))
	for i := range lastChanged {
		lastChanged[i] = -999
		previousOwner[i] = -1
	}
	freed := 0
	for day, frame := range s.Frames {
		released := make([]int, len(s.P))
		for k := 0; k < len(frame); k += 2 {
			i, next := frame[k], frame[k+1]
			beforeOwner, afterOwner := (code[i]&31)-1, (next&31)-1
			if beforeOwner != afterOwner {
				if afterOwner >= 0 && afterOwner == previousOwner[i] && day-lastChanged[i] <= 1 {
					t.Fatalf("ownership bounced day %d plot %d", day, i)
				}
				lastChanged[i] = day
				previousOwner[i] = beforeOwner
				if beforeOwner >= 0 && afterOwner < 0 {
					released[beforeOwner]++
					freed++
				}
			}
			code[i] = next
		}
		for pi, p := range s.P {
			count, area := 0, 0.
			for i, c := range code {
				if c >= 128 {
					t.Fatalf("day %d plot %d still empty but owned", day, i)
				}
				if c&31 == pi+1 {
					count++
					area += g.Area[i]
				}
			}
			row := s.Series[day][pi]
			if row.N != count || row.A != roundEven(area/s.CA, 4) || row.Dark != 0 {
				t.Fatalf("day %d %s series differs from actual footprints: %+v count=%d area=%f", day, p.name, row, count, area)
			}
		}
	}
	if freed == 0 {
		t.Fatal("negative-only vacancy test: nothing was released")
	}
	for i, owner := range s.Owner {
		if (owner >= 0) != (code[i]&31 != 0) || s.Dark[i] {
			t.Fatalf("canonical occupation differs plot %d", i)
		}
		if owner < 0 && s.Level[i] != 0 {
			t.Fatalf("vacant house retained growth level %d", i)
		}
		if owner >= 0 && !s.P[owner].plots[i] {
			t.Fatal("hidden owner missing from territory", i)
		}
	}
	short := simulateCity(g, work, 29, true, nil)
	if !reflect.DeepEqual(short.Frames, s.Frames[:29]) || !reflect.DeepEqual(short.Series, s.Series[:29]) {
		t.Fatal("later history rewrote prior days")
	}
	legacy := simulateCityRules(g, work, 29, true, nil, true)
	if reflect.DeepEqual(short.Frames, legacy.Frames) {
		t.Fatal("new actual vacancy did not drift from frozen legacy")
	}
	t.Logf("actual-vacancy fingerprint=%s; legacy=%s; %d actual releases in 90 days", cityFramesFingerprint(short.Frames), cityFramesFingerprint(legacy.Frames), freed)
}

func TestCityVacancySafeguards(t *testing.T) {
	// The farthest house 2 bridges the main to branch 3. Release other leaves first.
	g := starterGraph(6, [][2]int{{0, 1}, {0, 2}, {2, 3}, {0, 4}, {0, 5}})
	g.Area = []float64{1, 1, 1, 1, 1, 1}
	p := &cityTerritory{main: 0, last: 0, plots: map[int]bool{0: true, 1: true, 2: true, 3: true, 4: true, 5: true}, dist: []float64{0, 1, 5, 2, 4, 3}}
	s := &citySim{P: []*cityTerritory{p}, Avg: 1, Owner: []int{0, 0, 0, 0, 0, 0}, Level: []int{3, 2, 1, 2, 3, 2}, Dark: make([]bool, 6), Changed: []int{0, 19, 0, 0, 0, 0}, Reserved: []bool{false, false, false, false, false, true}}
	goal := func(*cityTerritory) float64 { return 3 }
	s.vacatedBy = make([]int, len(s.Owner))
	s.releaseVacancies(g, 20, goal)
	if len(p.plots) != cityRules.Floor || !p.plots[0] || !p.plots[5] || connectedCount(g, p, -1) != 3 {
		t.Fatal("minimum/main/reservation/connectivity lost")
	}
	if s.Level[0] != 3 {
		t.Fatal("occupied house floor growth changed")
	}
	for i := range s.Owner {
		if s.Owner[i] < 0 && (s.Level[i] != 0 || s.Dark[i] || s.Changed[i] != 20) {
			t.Fatal("vacancy not atomic", i)
		}
	}
	if s.Owner[1] != -1 {
		t.Fatal("old transfer cooldown incorrectly postponed genuine vacancy")
	}
}

func TestCityVacancyExcessEmptiesImmediately(t *testing.T) {
	// A controlled day with 20 genuinely newly empty houses: original excess/Avg
	// criterion, no six-per-day queue and no acquisition-tenure delay.
	edges := [][2]int{}
	for i := 1; i < 30; i++ {
		edges = append(edges, [2]int{0, i})
	}
	g := starterGraph(30, edges)
	g.Area = make([]float64, 30)
	p := &cityTerritory{main: 0, last: 0, plots: map[int]bool{}, dist: make([]float64, 30)}
	s := &citySim{P: []*cityTerritory{p}, Avg: 1, Owner: make([]int, 30), Level: make([]int, 30), Dark: make([]bool, 30), Changed: make([]int, 30), Reserved: make([]bool, 30)}
	for i := range s.Owner {
		p.plots[i] = true
		g.Area[i] = 1
		p.dist[i] = float64(i)
		s.Level[i] = 2
		s.Changed[i] = 5
	}
	s.vacatedBy = make([]int, len(s.Owner))
	s.releaseVacancies(g, cityRules.DarkAfter, func(*cityTerritory) float64 { return 10 })
	if len(p.plots) != 10 || p.freed != 20 {
		t.Fatalf("newly empty houses stayed owned: n=%d freed=%d", len(p.plots), p.freed)
	}
	for i := 10; i < 30; i++ {
		if s.Owner[i] != -1 || s.Level[i] != 0 || s.Dark[i] {
			t.Fatal("empty peripheral plot still occupied", i)
		}
	}
	if !p.plots[0] || connectedCount(g, p, -1) != 10 {
		t.Fatal("main or connectivity lost")
	}
}

// Uses the immutable archive captured for this task; ordinary test runs stay
// hermetic. It validates every dated API result, not just the final serialization.
func TestCityActualVacancyArchive(t *testing.T) {
	root := os.Getenv("CITY_AUDIT_ROOT")
	if root == "" {
		t.Skip("set CITY_AUDIT_ROOT")
	}
	a, err := (&Hub{root: root}).readCityArchive()
	if err != nil {
		t.Fatal(err)
	}
	g, err := loadCityGraph()
	if err != nil {
		t.Fatal(err)
	}
	s := simulateCity(g, a.Projects, dayIndex(a.Latest)+1, true, a)
	checkCityFrames(t, g, s)
	legacy := simulateCityRules(g, a.Projects, len(s.Frames), true, a, true)
	for day := 0; day < len(s.Frames); day++ {
		at := cityDay(cityRules.Start).AddDate(0, 0, day)
		c, err := buildCity(a, at, true)
		if err != nil {
			t.Fatal(err)
		}
		byOwner := map[string][]int{}
		areas := map[string]float64{}
		for _, o := range c.PlotOwners {
			if o.Owner != "" {
				if o.Dark || o.Reserved {
					t.Fatalf("%s empty or reserved owned: %+v", c.Date, o)
				}
				byOwner[o.Owner] = append(byOwner[o.Owner], o.ID)
				areas[o.Owner] += g.Area[o.Index]
			} else if o.Dark || o.Level != 0 {
				t.Fatalf("%s vacancy not reset: %+v", c.Date, o)
			}
		}
		for _, p := range c.Projects {
			if len(p.Plots) != len(byOwner[p.ID]) || p.Area != roundEven(areas[p.ID], 3) || math.Abs(p.Share-roundEven(areas[p.ID]/s.CA, 4)) > 1e-8 {
				t.Fatalf("%s %s API count/area/share differs", c.Date, p.ID)
			}
			for _, index := range p.Plots {
				id := g.Plots[index].ID
				found := false
				for _, x := range byOwner[p.ID] {
					found = found || id == x
				}
				if !found {
					t.Fatal("territory has shadow parcel", id)
				}
			}
			if day == len(s.Frames)-1 && p.ID == "Agent Harness" {
				var old citySeries
				for pi, q := range legacy.P {
					if q.name == p.ID {
						old = legacy.Series[day][pi]
					}
				}
				t.Logf("%s Agent Harness legacy n=%d dark=%d -> actual n=%d dark=0 area=%.3f share=%.4f", c.Date, old.N, old.Dark, len(p.Plots), p.Area, p.Share)
			}
		}
	}
	if out := os.Getenv("CITY_VACANCY_OUT"); out != "" {
		c, err := buildCity(a, a.Latest, true)
		if err != nil {
			t.Fatal(err)
		}
		b, _ := json.MarshalIndent(c, "", "  ")
		if err = os.WriteFile(out, b, 0644); err != nil {
			t.Fatal(err)
		}
	}
}
