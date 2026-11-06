package main

import (
	"container/heap"
	"embed"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed citydata/graph.json
var cityGraphFiles embed.FS

type cityPlot struct {
	ID int     `json:"id"`
	X0 float64 `json:"x0"`
	Y0 float64 `json:"y0"`
	X1 float64 `json:"x1"`
	Y1 float64 `json:"y1"`
	H  float64 `json:"h"`
	K  string  `json:"k"`
	X  float64 `json:"X"`
	Y  float64 `json:"Y"`
}
type cityEdge struct {
	to   int
	cost float64
}
type cityPad struct {
	P [2]float64 `json:"p"`
	G [2]float64 `json:"g"`
	D int        `json:"d"`
	K string     `json:"k"`
	H float64    `json:"h"`
}
type cityGraph struct {
	Plots                          []cityPlot
	Adj                            [][]cityEdge
	NB, Room                       [][]int
	BaseReserved, Reserved, Island []bool
	Area                           []float64
	CA, Avg                        float64
	Home                           int
	Core                           [2]float64
	Seeds                          [][2]float64
	Ox, Oy                         float64
	Pads                           []cityPad
	PadPlot                        []int
	Zones                          []string
	OwnerPad                       int
}

var graphOnce sync.Once
var graphValue *cityGraph
var graphError error

func loadCityGraph() (*cityGraph, error) {
	graphOnce.Do(func() { graphValue, graphError = readCityGraph() })
	return graphValue, graphError
}
func readCityGraph() (*cityGraph, error) {
	var raw struct {
		Plots []cityPlot          `json:"plots"`
		Edges [][]json.RawMessage `json:"edges"`
		Comp  []int               `json:"comp"`
		Core  [2]float64          `json:"core"`
		Seeds [][2]float64        `json:"seeds"`
		Ox    float64             `json:"ox"`
		Oy    float64             `json:"oy"`
	}
	b, e := cityGraphFiles.ReadFile("citydata/graph.json")
	if e != nil {
		return nil, e
	}
	if e = json.Unmarshal(b, &raw); e != nil {
		return nil, e
	}
	g := &cityGraph{Plots: raw.Plots, Core: raw.Core, Seeds: raw.Seeds, Ox: raw.Ox, Oy: raw.Oy}
	n := len(g.Plots)
	g.Adj = make([][]cityEdge, n)
	g.NB = make([][]int, n)
	g.Room = make([][]int, n)
	g.BaseReserved = make([]bool, n)
	g.Reserved = make([]bool, n)
	g.Island = make([]bool, n)
	g.Area = make([]float64, n)
	costs := cityRules.EdgeCosts
	for _, ed := range raw.Edges {
		var i, j int
		var k string
		var d float64
		json.Unmarshal(ed[0], &i)
		json.Unmarshal(ed[1], &j)
		json.Unmarshal(ed[2], &k)
		json.Unmarshal(ed[3], &d)
		g.Adj[i] = append(g.Adj[i], cityEdge{j, d * costs[k]})
		g.Adj[j] = append(g.Adj[j], cityEdge{i, d * costs[k]})
		g.NB[i] = append(g.NB[i], j)
		g.NB[j] = append(g.NB[j], i)
	}
	g.Home = g.nearest(g.Seeds[4][0], g.Seeds[4][1])
	for i, p := range g.Plots {
		sort.Ints(g.NB[i])
		g.Area[i] = (p.X1 - p.X0) * (p.Y1 - p.Y0)
		g.BaseReserved[i] = p.K != "b" || math.Hypot(p.X-g.Core[0], p.Y-g.Core[1]) < cityRules.CoreRadius
		g.Reserved[i] = g.BaseReserved[i]
		g.Island[i] = raw.Comp[i] == raw.Comp[g.Home]
		for j, q := range g.Plots {
			if math.Hypot(p.X-q.X, p.Y-q.Y) < cityRules.RoomRadius {
				g.Room[i] = append(g.Room[i], j)
			}
		}
	}
	var pads struct {
		Names []string  `json:"names"`
		Pads  []cityPad `json:"pads"`
	}
	b, e = assets.ReadFile("assets/gl/live-data.json")
	if e != nil {
		return nil, e
	}
	if e = json.Unmarshal(b, &pads); e != nil {
		return nil, e
	}
	g.Pads = pads.Pads
	g.Zones = pads.Names
	g.PadPlot = make([]int, len(pads.Pads))
	for i, p := range pads.Pads {
		a := p.G[0]/.75 - g.Ox
		b := 2 * ((p.G[1]+40)/.75 - g.Oy)
		g.PadPlot[i] = g.nearest((a+b)/2, (b-a)/2)
		if p.H > pads.Pads[g.OwnerPad].H {
			g.OwnerPad = i
		}
		if strings.HasPrefix(p.K, "n:") {
			g.Reserved[g.PadPlot[i]] = true
		}
	}
	return g, nil
}
func (g *cityGraph) nearest(x, y float64) int {
	best := 0
	d := math.Inf(1)
	for i, p := range g.Plots {
		v := math.Hypot(p.X-x, p.Y-y)
		if v < d {
			best = i
			d = v
		}
	}
	return best
}
func roundEven(x float64, n int) float64 { v := math.Pow10(n); return math.RoundToEven(x*v) / v }

type distanceItem struct {
	d float64
	i int
}
type distanceHeap []distanceItem

func (h distanceHeap) Len() int { return len(h) }
func (h distanceHeap) Less(i, j int) bool {
	return h[i].d < h[j].d || h[i].d == h[j].d && h[i].i < h[j].i
}
func (h distanceHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *distanceHeap) Push(v any)   { *h = append(*h, v.(distanceItem)) }
func (h *distanceHeap) Pop() any     { a := *h; v := a[len(a)-1]; *h = a[:len(a)-1]; return v }
func (g *cityGraph) dijkstra(src int) []float64 {
	d := make([]float64, len(g.Plots))
	for i := range d {
		d[i] = math.Inf(1)
	}
	d[src] = 0
	h := &distanceHeap{{0, src}}
	for h.Len() > 0 {
		v := heap.Pop(h).(distanceItem)
		if v.d > d[v.i] {
			continue
		}
		for _, a := range g.Adj[v.i] {
			if v.d+a.cost < d[a.to] {
				d[a.to] = v.d + a.cost
				heap.Push(h, distanceItem{d[a.to], a.to})
			}
		}
	}
	return d
}

type cityTerritory struct {
	name                              string
	born, last, main, host, hostUntil int
	W, done, hours                    float64
	plots                             map[int]bool
	dist                              []float64
	recent                            []float64
	taken, lost, freed, pushed        int
	closed                            bool
}

func (p *cityTerritory) recentWork() float64 {
	s := 0.
	for _, v := range p.recent {
		s += v
	}
	return s
}
func (g *cityGraph) area(p *cityTerritory) float64 {
	s := 0.
	for _, i := range sortedPlots(p) {
		s += g.Area[i]
	}
	return s
}
func sortedPlots(p *cityTerritory) []int {
	a := make([]int, 0, len(p.plots))
	for i := range p.plots {
		a = append(a, i)
	}
	sort.Ints(a)
	return a
}
func connectedCount(g *cityGraph, p *cityTerritory, i int) int {
	seen := map[int]bool{p.main: true}
	todo := []int{p.main}
	for len(todo) > 0 {
		u := todo[len(todo)-1]
		todo = todo[:len(todo)-1]
		for _, v := range g.NB[u] {
			if v != i && p.plots[v] && !seen[v] {
				seen[v] = true
				todo = append(todo, v)
			}
		}
	}
	return len(seen)
}
func connectedWithout(g *cityGraph, p *cityTerritory, i int) bool {
	return connectedCount(g, p, i) == len(p.plots)-1
}
func byDistance(p *cityTerritory, list []int, reverse bool) {
	sort.Slice(list, func(a, b int) bool {
		i, j := list[a], list[b]
		if p.dist[i] == p.dist[j] {
			return i < j
		}
		if reverse {
			return p.dist[i] > p.dist[j]
		}
		return p.dist[i] < p.dist[j]
	})
}

// CityCapture is a direct transfer of an occupied plot on the requested day.
type CityCapture struct {
	PlotID int    `json:"plotId"`
	From   string `json:"from"`
	To     string `json:"to"`
}

type citySim struct {
	Captures              []CityCapture
	P                     []*cityTerritory
	Owner, Level, Changed []int
	Dark                  []bool
	vacatedBy             []int // former occupant only; vacant Owner is always -1
	Frames                [][]int
	Series                [][]citySeries
	Reserved              []bool
	CA, Avg               float64
}
type citySeries struct {
	N      int     `json:"n"`
	A      float64 `json:"a"`
	W      float64 `json:"W"`
	Light  float64 `json:"light"`
	Idle   int     `json:"idle"`
	Dark   int     `json:"dark"`
	Taken  int     `json:"taken"`
	Lost   int     `json:"lost"`
	Freed  int     `json:"freed"`
	Pushed int     `json:"pushed"`
	Done   int     `json:"done"`
	Hours  float64 `json:"hours"`
}

// starter plans the whole seed before any ownership changes. Search the
// connected frontier in distance order, backtracking when an edge is too thin.
// A bite may use free land and its host's land, never another donor or a main.
func (s *citySim) starter(g *cityGraph, main, host int, home, hasHome bool) []int {
	allowed := func(i int) bool {
		if s.Reserved[i] || hasHome && g.Island[i] != home {
			return false
		}
		return s.Owner[i] < 0 || host >= 0 && s.Owner[i] == host && i != s.P[host].main
	}
	if !allowed(main) {
		return nil
	}
	dist := g.dijkstra(main)
	chosen := map[int]bool{main: true}
	var search func([]int) []int
	search = func(seed []int) []int {
		if len(seed) == cityRules.Floor {
			if host >= 0 {
				q := s.P[host]
				remaining := &cityTerritory{main: q.main, plots: map[int]bool{}}
				for i := range q.plots {
					if !chosen[i] {
						remaining.plots[i] = true
					}
				}
				if len(remaining.plots) < cityRules.Floor {
					return nil
				}
				if connectedCount(g, remaining, -1) != len(remaining.plots) {
					return nil
				}
			}
			return append([]int{}, seed...)
		}
		front := map[int]bool{}
		for _, u := range seed {
			for _, v := range g.NB[u] {
				if !chosen[v] && allowed(v) {
					front[v] = true
				}
			}
		}
		list := make([]int, 0, len(front))
		for v := range front {
			list = append(list, v)
		}
		byDistance(&cityTerritory{dist: dist}, list, false)
		for _, v := range list {
			chosen[v] = true
			if result := search(append(seed, v)); result != nil {
				return result
			}
			delete(chosen, v)
		}
		return nil
	}
	return search([]int{main})
}

// simulateCity uses actual vacancy: a house leaves ownership when it empties.
func simulateCity(g *cityGraph, source map[string]*citySource, days int, protect bool, archive *cityArchive) *citySim {
	return simulateCityRules(g, source, days, protect, archive, false)
}

// legacy preserves the frozen fight reference, whose empty houses stayed owned.
// It is only used by parity tests; the HTTP path always uses the current rule.
func simulateCityRules(g *cityGraph, source map[string]*citySource, days int, protect bool, archive *cityArchive, legacy bool) *citySim {
	n := len(g.Plots)
	s := &citySim{Captures: []CityCapture{}, Owner: make([]int, n), Level: make([]int, n), Changed: make([]int, n), Dark: make([]bool, n), Frames: [][]int{}, Series: [][]citySeries{}, Reserved: append([]bool{}, g.BaseReserved...)}
	if protect {
		s.Reserved = append([]bool{}, g.Reserved...)
	}
	count := 0
	for i := range s.Owner {
		s.Owner[i] = -1
		s.Changed[i] = -999
		if !s.Reserved[i] {
			s.CA += g.Area[i]
			count++
		}
	}
	s.vacatedBy = make([]int, n)
	for i := range s.vacatedBy {
		s.vacatedBy[i] = -1
	}
	s.Avg = s.CA / float64(count)
	for name, v := range source {
		born := int(^uint(0) >> 1)
		for d := range v.Daily {
			i := dayIndex(cityDay(d))
			if i < born {
				born = i
			}
		}
		s.P = append(s.P, &cityTerritory{name: name, born: born, last: -1, main: -1, host: -1, hostUntil: -1, plots: map[int]bool{}})
	}
	sort.Slice(s.P, func(i, j int) bool {
		a, b := s.P[i], s.P[j]
		if a.born != b.born {
			return a.born < b.born
		}
		return a.name < b.name
	})
	hasHome := false
	for _, p := range s.P {
		if p.name == "Delamain" {
			hasHome = true
		}
	}
	target := func(p *cityTerritory) float64 {
		return math.Max(float64(cityRules.Floor)*s.Avg, cityRules.Cap*s.CA*p.W/(p.W+cityRules.K))
	}
	own := func(i, pi, day int) {
		q := s.Owner[i]
		p := s.P[pi]
		if q >= 0 {
			if day == days-1 && q != pi && !s.Dark[i] {
				s.Captures = append(s.Captures, CityCapture{PlotID: g.Plots[i].ID, From: s.P[q].name, To: p.name})
			}
			delete(s.P[q].plots, i)
			s.P[q].lost++
			p.taken++
			s.Level[i] = 0
		}
		s.Owner[i] = pi
		s.vacatedBy[i] = -1
		p.plots[i] = true
		s.Changed[i] = day
		s.Dark[i] = false
	}
	var starter []int
	plan := func(p *cityTerritory, main, host int) bool {
		starter = s.starter(g, main, host, p.name == "Delamain", hasHome)
		return len(starter) == cityRules.Floor
	}
	place := func(p *cityTerritory) int {
		if p.name == "Delamain" {
			if !s.Reserved[g.Home] && plan(p, g.Home, -1) {
				return g.Home
			}
			best, distance := -1, math.Inf(1)
			for i, plot := range g.Plots {
				if g.Island[i] && !s.Reserved[i] && plan(p, i, -1) {
					d := math.Hypot(plot.X-g.Plots[g.Home].X, plot.Y-g.Plots[g.Home].Y)
					if d < distance {
						best, distance = i, d
					}
				}
			}
			if best >= 0 {
				plan(p, best, -1)
			}
			return best
		}
		free := make([]bool, n)
		mains := []int{}
		for i := range free {
			free[i] = s.Owner[i] < 0 && !s.Reserved[i] && !(hasHome && g.Island[i])
		}
		for _, q := range s.P {
			if q.main >= 0 {
				mains = append(mains, q.main)
			}
		}
		for _, gap := range cityRules.PlaceGaps {
			cand := []int{}
			for i, f := range free {
				if !f {
					continue
				}
				ok := true
				for _, m := range mains {
					if math.Hypot(g.Plots[i].X-g.Plots[m].X, g.Plots[i].Y-g.Plots[m].Y) < gap {
						ok = false
						break
					}
				}
				if ok {
					cand = append(cand, i)
				}
			}
			best, room := -1, 0
			for k := 0; k < len(cand); k += 3 {
				i := cand[k]
				r := 0
				for _, j := range g.Room[i] {
					if free[j] {
						r++
					}
				}
				if r >= cityRules.MinimumRoom && (best < 0 || r > room) && plan(p, i, -1) {
					best = i
					room = r
				}
			}
			if best >= 0 {
				plan(p, best, -1)
				return best
			}
		}
		hosts := []int{}
		for qi, q := range s.P {
			if q.main >= 0 && q.name != "Delamain" && len(q.plots) > cityRules.Floor+2 {
				hosts = append(hosts, qi)
			}
		}
		sort.Slice(hosts, func(a, b int) bool {
			i, j := hosts[a], hosts[b]
			ai, aj := g.area(s.P[i]), g.area(s.P[j])
			if ai != aj {
				return ai > aj
			}
			return s.P[i].name < s.P[j].name
		})
		for _, qi := range hosts {
			q := s.P[qi]
			list := sortedPlots(q)
			byDistance(q, list, true)
			for _, i := range list {
				if i != q.main && plan(p, i, qi) {
					p.host = qi
					return i
				}
			}
		}
		return -1
	}
	prev := make([]int, n)
	for day := 0; day < days; day++ {
		order := []int{}
		for pi, p := range s.P {
			if archive != nil && projectClosed(source[p.name], archive, cityDay(cityRules.Start).AddDate(0, 0, day)) {
				for i := range p.plots {
					s.Owner[i] = -1
					s.Level[i] = 0
					s.Dark[i] = false
					s.Changed[i] = day
				}
				p.plots = map[int]bool{}
				p.main = -1
				p.closed = true
				continue
			}
			if p.closed {
				continue
			}
			if day >= p.born && p.main < 0 {
				m := place(p)
				if m < 0 {
					continue
				}
				p.main = m
				p.dist = g.dijkstra(m)
				own(m, pi, day)
				for _, i := range starter[1:] {
					own(i, pi, day)
				}
				if p.host >= 0 {
					p.hostUntil = day + cityRules.BiteDays
				}
				p.last = day
			}
			if p.main < 0 {
				continue
			}
			daily, ok := source[p.name].Daily[cityDay(cityRules.Start).AddDate(0, 0, day).Format("2006-01-02")]
			dn, hr := 0., 0.
			if ok {
				dn = float64(daily.Done)
				hr = daily.Hours
			}
			a := dn + cityRules.HourW*hr
			p.recent = append(p.recent, a)
			if len(p.recent) > 7 {
				p.recent = p.recent[len(p.recent)-7:]
			}
			if ok {
				p.last = day
			}
			if a > 0 {
				p.W += a
				p.done += dn
				p.hours += hr
			} else if day-p.last > cityRules.Grace {
				p.W *= math.Pow(.5, 1/float64(cityRules.HalfLife))
			}
			order = append(order, pi)
		}
		sort.Slice(order, func(a, b int) bool {
			p, q := s.P[order[a]], s.P[order[b]]
			if p.recentWork() != q.recentWork() {
				return p.recentWork() > q.recentWork()
			}
			if p.W != q.W {
				return p.W > q.W
			}
			return p.name < q.name
		})
		clear(s.Dark)
		if !legacy {
			s.releaseVacancies(g, day, target)
		}
		for _, p := range s.P {
			if !legacy {
				break
			}
			if p.main < 0 || day-p.last < cityRules.DarkAfter {
				continue
			}
			extra := g.area(p) - target(p)
			if extra <= 0 {
				continue
			}
			limit := min(max(0, len(p.plots)-cityRules.Floor), int(extra/s.Avg))
			list := []int{}
			for i := range p.plots {
				if i != p.main {
					list = append(list, i)
				}
			}
			byDistance(p, list, true)
			for k := 0; k < len(list) && k < limit; k++ {
				s.Dark[list[k]] = true
			}
		}
		for _, p := range s.P {
			if !legacy || p.main < 0 || day-p.last < cityRules.DarkAfter+cityRules.RelDelay {
				continue
			}
			list := []int{}
			for i := range p.plots {
				if s.Dark[i] && i != p.main {
					list = append(list, i)
				}
			}
			byDistance(p, list, true)
			gone := 0
			for _, i := range list {
				if gone >= cityRules.RelRate || len(p.plots) <= cityRules.Floor {
					break
				}
				if connectedWithout(g, p, i) {
					delete(p.plots, i)
					s.Owner[i] = -1
					s.Dark[i] = false
					s.Level[i] = 0
					s.Changed[i] = day
					p.freed++
					gone++
				}
			}
		}
		for _, pi := range order {
			p := s.P[pi]
			if day-p.last > cityRules.Grace {
				continue
			}
			have := g.area(p)
			goal := math.Min(target(p), have+cityRules.Step*s.CA*math.Max(.15, 1-have/(cityRules.Cap*s.CA)))
			grabs, pushes := cityRules.Take, cityRules.Push
			for have < goal {
				set := map[int]bool{}
				for u := range p.plots {
					for _, v := range g.NB[u] {
						if s.Owner[v] != pi && !s.Reserved[v] {
							set[v] = true
						}
					}
				}
				front := []int{}
				free := []int{}
				for v := range set {
					front = append(front, v)
					if s.Owner[v] < 0 && (legacy || s.vacatedBy[v] != pi || day-s.Changed[v] >= cityRules.Cool) {
						free = append(free, v)
					}
				}
				if len(free) > 0 {
					byDistance(p, free, false)
					v := free[0]
					if have+g.Area[v] > cityRules.Cap*s.CA {
						break
					}
					own(v, pi, day)
					have += g.Area[v]
					continue
				}
				if grabs <= 0 {
					break
				}
				host := -1
				if p.hostUntil >= 0 && day <= p.hostUntil {
					host = p.host
				}
				prey := []int{}
				for _, v := range front {
					q := s.Owner[v]
					if q >= 0 && (s.Dark[v] || q == host) && day-s.Changed[v] >= cityRules.Cool && len(s.P[q].plots) > cityRules.Floor && v != s.P[q].main {
						prey = append(prey, v)
					}
				}
				sort.Slice(prey, func(a, b int) bool {
					i, j := prey[a], prey[b]
					q, r := s.P[s.Owner[i]], s.P[s.Owner[j]]
					if q.last != r.last {
						return q.last < r.last
					}
					if q.W != r.W {
						return q.W < r.W
					}
					if p.dist[i] != p.dist[j] {
						return p.dist[i] < p.dist[j]
					}
					return i < j
				})
				chosen := -1
				for _, v := range prey {
					if have+g.Area[v] <= cityRules.Cap*s.CA && connectedWithout(g, s.P[s.Owner[v]], v) {
						chosen = v
						break
					}
				}
				if chosen >= 0 {
					own(chosen, pi, day)
					have += g.Area[chosen]
					grabs--
					continue
				}
				if pushes <= 0 {
					break
				}
				fit := map[int]bool{}
				live := []int{}
				for _, v := range front {
					qi := s.Owner[v]
					if qi < 0 || s.Dark[v] || v == s.P[qi].main || day-s.Changed[v] < cityRules.Cool {
						continue
					}
					if _, ok := fit[qi]; !ok {
						q := s.P[qi]
						room := false
						for u := range q.plots {
							for _, w := range g.NB[u] {
								if s.Owner[w] < 0 && !s.Reserved[w] {
									room = true
									break
								}
							}
							if room {
								break
							}
						}
						fit[qi] = p.recentWork() >= cityRules.PushRatio*q.recentWork()+cityRules.PushExtra && q.name != "Delamain" && len(q.plots) > cityRules.Floor+2 && (g.area(q) > target(q) || room)
					}
					if fit[qi] {
						live = append(live, v)
					}
				}
				sort.Slice(live, func(a, b int) bool {
					i, j := live[a], live[b]
					q, r := s.P[s.Owner[i]], s.P[s.Owner[j]]
					if q.recentWork() != r.recentWork() {
						return q.recentWork() < r.recentWork()
					}
					if p.dist[i] != p.dist[j] {
						return p.dist[i] < p.dist[j]
					}
					return i < j
				})
				for _, v := range live {
					if have+g.Area[v] <= cityRules.Cap*s.CA && connectedWithout(g, s.P[s.Owner[v]], v) {
						chosen = v
						break
					}
				}
				if chosen < 0 {
					break
				}
				own(chosen, pi, day)
				have += g.Area[chosen]
				pushes--
				p.pushed++
			}
		}
		for _, pi := range order {
			p := s.P[pi]
			I := p.recentWork()
			L := 0
			if I >= cityRules.Intensity[2] {
				L = 3
			} else if I >= cityRules.Intensity[1] {
				L = 2
			} else if I >= cityRules.Intensity[0] {
				L = 1
			}
			if L == 0 {
				continue
			}
			ring := sortedPlots(p)
			byDistance(p, ring, false)
			for l, f := range cityRules.InnerFractions {
				if L >= l+1 {
					limit := int(math.Ceil(float64(len(ring)) * f))
					for _, i := range ring[:limit] {
						s.Level[i] = max(s.Level[i], l+1)
					}
				}
			}
		}
		frame := []int{}
		for i := range prev {
			code := 0
			if s.Owner[i] >= 0 {
				code = s.Owner[i] + 1 + s.Level[i]*32
			}
			if s.Dark[i] {
				code += 128
			}
			if code != prev[i] {
				frame = append(frame, i, code)
			}
			prev[i] = code
		}
		s.Frames = append(s.Frames, frame)
		row := make([]citySeries, len(s.P))
		for pi, p := range s.P {
			if p.main < 0 {
				continue
			}
			idle := day - p.last
			light := 1.
			if idle > cityRules.Grace {
				light = math.Max(cityRules.MinLight, 1-float64(idle-cityRules.Grace)/float64(cityRules.LightFade))
			}
			dark := 0
			for i := range p.plots {
				if s.Dark[i] {
					dark++
				}
			}
			row[pi] = citySeries{len(p.plots), roundEven(g.area(p)/s.CA, 4), roundEven(p.W, 1), roundEven(light, 2), idle, dark, p.taken, p.lost, p.freed, p.pushed, int(p.done), roundEven(p.hours, 1)}
		}
		s.Series = append(s.Series, row)
	}
	return s
}

// releaseVacancies applies the original emptiness criterion to actual ownership.
// Empty houses do not wait in a dark-but-owned queue: release the excess-area
// count on this day, choosing removable outskirts so the main, minimum occupied
// neighbourhood and donor connectivity survive. Normal growth/transfer pace and
// cooldown remain unchanged. Former occupants cannot reclaim their own freshly
// vacated houses during Cool; other projects can use this free land immediately.
func (s *citySim) releaseVacancies(g *cityGraph, day int, target func(*cityTerritory) float64) {
	for pi, p := range s.P {
		if p.main < 0 || day-p.last < cityRules.DarkAfter {
			continue
		}
		extra := g.area(p) - target(p)
		limit := min(max(0, len(p.plots)-cityRules.Floor), int(extra/s.Avg))
		if limit <= 0 {
			continue
		}
		list := sortedPlots(p)
		byDistance(p, list, true)
		gone := 0
		for _, i := range list {
			if gone >= limit || len(p.plots) <= cityRules.Floor {
				break
			}
			if i == p.main || s.Reserved[i] || !connectedWithout(g, p, i) {
				continue
			}
			delete(p.plots, i)
			s.vacatedBy[i] = pi
			s.Owner[i], s.Level[i], s.Dark[i], s.Changed[i] = -1, 0, false, day
			p.freed++
			gone++
		}
	}
}

type CityProject struct {
	TagPrefixes   []string   `json:"tagPrefixes"`
	ID            string     `json:"id"`
	Stages        []string   `json:"stages"`
	District      string     `json:"district"`
	Zone          string     `json:"zone"`
	Tower         int        `json:"tower"`
	MainPlot      *cityPlot  `json:"mainPlot"`
	FinishedTasks int        `json:"finishedTasks"`
	Hours         float64    `json:"hours"`
	FirstActivity string     `json:"firstActivity"`
	LastActivity  string     `json:"lastActivity"`
	Colour        string     `json:"colour"`
	Plots         []int      `json:"plots"`
	Area          float64    `json:"area"`
	Share         float64    `json:"share"`
	DaysOfSilence int        `json:"daysOfSilence"`
	Light         float64    `json:"light"`
	Pressing      []string   `json:"pressing"`
	LastLines     []CityLine `json:"lastLines"`
	Goals         []string   `json:"goals"`
	Closed        bool       `json:"closed"`
}
type CityOwner struct {
	ID       int    `json:"id"`
	Index    int    `json:"index"`
	Owner    string `json:"owner"`
	Dark     bool   `json:"dark"`
	Level    int    `json:"level"`
	Reserved bool   `json:"reserved"`
}
type CityBase struct {
	Name  string     `json:"name"`
	Seed  [2]float64 `json:"seed"`
	Owner string     `json:"owner"`
	Share float64    `json:"share"`
}
type City struct {
	AggressiveCaptures []CityCapture `json:"aggressiveCaptures"`
	BaseDistricts      []CityBase    `json:"baseDistricts"`
	RulesVersion       int           `json:"rulesVersion"`
	Date               string        `json:"date"`
	Projects           []CityProject `json:"projects"`
	PlotOwners         []CityOwner   `json:"plotOwners"`
	StagesWithoutRepo  int           `json:"stagesWithoutRepo"`
	CappedRuns         int           `json:"cappedRuns"`
	UnclosedRuns       int           `json:"unclosedRuns"`
	Reference          string        `json:"reference"`
}

func buildCity(a *cityArchive, at time.Time, protect bool) (City, error) {
	g, e := loadCityGraph()
	if e != nil {
		return City{}, e
	}
	days := dayIndex(at) + 1
	if days > dayIndex(a.Latest)+1 {
		return City{}, fmt.Errorf("date exceeds journal archive")
	}
	if days < 0 {
		days = 0
	}
	s := simulateCity(g, a.Projects, days, protect, a)
	c := City{AggressiveCaptures: s.Captures, RulesVersion: cityRules.Version, Date: at.Format("2006-01-02"), Projects: []CityProject{}, PlotOwners: []CityOwner{}, StagesWithoutRepo: a.NoRepo, CappedRuns: a.Capped, UnclosedRuns: a.Unclosed, Reference: "fight/1c646beb11913ac2 legacy baseline; v4 actual vacancy; landmarks protected; contiguous starters"}
	for si, seed := range g.Seeds {
		counts := map[int]int{}
		total, best, who := 0, 0, -1
		for i, plot := range g.Plots {
			if math.Hypot(plot.X-seed[0], plot.Y-seed[1]) < cityRules.ClaimRadius {
				total++
				o := s.Owner[i]
				if o >= 0 {
					counts[o]++
					if counts[o] > best {
						best, who = counts[o], o
					}
				}
			}
		}
		base := CityBase{Name: []string{"DOCKS", "SPRAWL", "FOUNDRY", "RIVIERA", "WASTES", "BAZAAR", "HEIGHTS", "SMELTER"}[si], Seed: seed}
		if total > 0 {
			base.Share = roundEven(float64(best)/float64(total), 4)
			if float64(best) >= cityRules.ClaimShare*float64(total) && who >= 0 {
				base.Owner = s.P[who].name
			}
		}
		c.BaseDistricts = append(c.BaseDistricts, base)
	}
	for pi, p := range s.P {
		src := a.Projects[p.name]
		if p.born >= days {
			continue
		}
		v := CityProject{ID: p.name, Stages: src.Stages, District: p.name, Tower: -1, Colour: fmt.Sprintf("#%06x", cityHash(p.name)&0xffffff), Plots: sortedPlots(p), Pressing: []string{}, LastLines: []CityLine{}, Goals: []string{}, Closed: p.closed}
		v.Area = roundEven(g.area(p), 3)
		v.TagPrefixes = []string{}
		if containsString(src.Stages, "codex-backlog-20261023") {
			for prefix, name := range cityRules.Backlog {
				if name == p.name {
					v.TagPrefixes = append(v.TagPrefixes, prefix)
				}
			}
			sort.Strings(v.TagPrefixes)
		}
		for _, l := range src.Lines {
			if l.At[:10] <= c.Date {
				if v.FirstActivity == "" {
					v.FirstActivity = l.At
				}
				v.LastActivity = l.At
				v.LastLines = append(v.LastLines, l)
			}
		}
		if len(v.LastLines) > 5 {
			v.LastLines = v.LastLines[len(v.LastLines)-5:]
		}
		for d, x := range src.Daily {
			if d <= c.Date {
				v.FinishedTasks += x.Done
				v.Hours += x.Hours
			}
		}
		v.Hours = roundEven(v.Hours, 2)
		for _, stage := range src.Stages {
			goal := a.Metas[stage].Goal
			if goal != "" && !containsString(v.Goals, goal) {
				v.Goals = append(v.Goals, goal)
			}
		}
		if days > 0 {
			row := s.Series[days-1][pi]
			v.Share = row.A
			v.DaysOfSilence = row.Idle
			v.Light = row.Light
		}
		if p.main >= 0 {
			plot := g.Plots[p.main]
			v.MainPlot = &plot
			best := math.Inf(1)
			for j, pad := range g.Pads {
				if j == g.OwnerPad || !p.plots[g.PadPlot[j]] {
					continue
				}
				d := p.dist[g.PadPlot[j]]
				if d < best {
					best = d
					v.Tower = j
					v.Zone = strings.ToLower(g.Zones[pad.D])
				}
			}
			if v.Tower < 0 {
				j := 0
				d := math.Inf(1)
				for k := range g.Pads {
					q := g.Plots[g.PadPlot[k]]
					dd := math.Hypot(q.X-plot.X, q.Y-plot.Y)
					if dd < d {
						j = k
						d = dd
					}
				}
				v.Zone = strings.ToLower(g.Zones[g.Pads[j].D])
			}
			for qi, q := range s.P {
				if qi == pi || q.main < 0 || p.name == "Delamain" || len(p.plots) <= cityRules.Floor+2 || q.recentWork() < cityRules.PushRatio*p.recentWork()+cityRules.PushExtra || days-1-q.last > cityRules.Grace {
					continue
				}
				room := false
				for i := range p.plots {
					for _, j := range g.NB[i] {
						if s.Owner[j] < 0 && !s.Reserved[j] {
							room = true
							break
						}
					}
				}
				target := math.Max(float64(cityRules.Floor)*s.Avg, cityRules.Cap*s.CA*p.W/(p.W+cityRules.K))
				if g.area(p) <= target && !room {
					continue
				}
				touch := false
				for i := range p.plots {
					if i == p.main || days-1-s.Changed[i] < cityRules.Cool || s.Reserved[i] || s.Dark[i] {
						continue
					}
					for _, j := range g.NB[i] {
						if s.Owner[j] == qi && connectedWithout(g, p, i) {
							touch = true
							break
						}
					}
					if touch {
						break
					}
				}
				if touch {
					v.Pressing = append(v.Pressing, q.name)
				}
			}
			sort.Strings(v.Pressing)
		}
		c.Projects = append(c.Projects, v)
	}
	sort.Slice(c.Projects, func(i, j int) bool { return c.Projects[i].ID < c.Projects[j].ID })
	for i, p := range g.Plots {
		owner := ""
		if s.Owner[i] >= 0 {
			owner = s.P[s.Owner[i]].name
		}
		c.PlotOwners = append(c.PlotOwners, CityOwner{p.ID, i, owner, s.Dark[i], s.Level[i], s.Reserved[i]})
	}
	return c, nil
}
