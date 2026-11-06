"use strict";
// Optional renderer. Loaded only for ?layers=1; geometry and telemetry remain the page's.
async function prepareLayerCity() {
  const response = await fetch(`${ASSET}/assets/style/manifest.json`);
  if (!response.ok) throw new Error(`Layer manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported layer manifest schema");
  const images = new Map();
  for (const layer of Object.values(manifest.layers)) {
    for (const sprite of Object.values(layer.sprites || {})) for (const state of Object.values(sprite.states)) {
      if (!state.file || !state.anchor || !state.size || !(state.baseWidth > 0)) throw new Error("Incomplete sprite placement metadata");
      if (!images.has(state.file)) images.set(state.file, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth === state.size[0] && image.naturalHeight === state.size[1]
          ? resolve(image) : reject(new Error(`Sprite size differs from manifest: ${state.file}`));
        image.onerror = () => reject(new Error(`Layer sprite missing: ${state.file}`));
        image.src = new URL(state.file, `${ASSET}/`).href;
      }));
    }
  }
  await Promise.all([...images].map(async ([file, promise]) => images.set(file, await promise)));
  return new LayerCity(manifest, images);
}

class LayerCity {
  constructor(manifest, images) {
    this.manifest = manifest; this.images = images;
    this.cache = new Map(); this.loads = new Map(); this.sources = new Map();
    this.rebuilds = { surface: 0, buildings: 0, keys: 0, haze: 0 };
    this.revision = 0;
  }
  // Same worker signal already used by the HUD; capacity is explicit, not inferred from a random lot.
  applyState(src, state) {
    this.sources.set(src, state);
    const counts = new Map();
    for (const s of this.sources.values()) for (const stage of s.stages) {
      const d = districtFor(stage.repo || ""), n = stage.workers.filter(w => w.role !== "hub").length;
      counts.set(d, (counts.get(d) || 0) + n);
    }
    let changed = false;
    const load = this.manifest.load || { workersAtFull: 10, hysteresis: .025 };
    for (const d of DISTRICTS) {
      const old = this.loads.get(d.id);
      if (!counts.has(d.id)) { if (this.loads.delete(d.id)) changed = true; continue; }
      const value = clamp(counts.get(d.id) / load.workersAtFull, 0, 1);
      const level = LayerCity.quantize(value, old?.level, load.hysteresis);
      this.loads.set(d.id, { value, level, workers: counts.get(d.id) });
      if (!old || old.level !== level) changed = true;
    }
    if (changed) this.revision++;
  }
  static quantize(value, previous, hysteresis = .025) {
    const v = clamp(value, 0, 1), nearest = Math.floor(v * 4 + .5) * 25;
    if (previous === undefined || nearest === previous) return nearest;
    const boundary = previous / 100 + (nearest > previous ? .125 : -.125);
    return nearest > previous ? (v >= boundary + hysteresis ? nearest : previous)
      : (v <= boundary - hysteresis ? nearest : previous);
  }
  stateFor(lot) {
    return this.loads.get(lot.d)?.level ?? Math.floor((hash(`${lot.h}:layer-load`) / 4294967296) * 5) * 25;
  }
  edge(lot) {
    const g = this.manifest.layers.ground;
    const r = Math.hypot((lot.x - CX) / 44, (lot.y - CY) / 58);
    const t = clamp((r - (g.edgeStart ?? .62)) / ((g.edgeEnd ?? 1) - (g.edgeStart ?? .62)), 0, 1);
    return { t, scale: lot.d === "core" ? 1 : 1 - (1 - (g.minScale ?? .58)) * t,
      keep: lot.d === "core" || inCity(lot.x, lot.y) && hash(`${lot.h}:layer-keep`) / 4294967296 < 1 - (1 - (g.minDensity ?? .28)) * t };
  }
  // Largest unrotated square contained in the current rotated/curved inset parcel.
  // All sprites are scaled uniformly, including in districts whose street grid is rotated.
  lotWidth(lot) {
    const q = lot.quad.map(n => ({ x: n.x + (lot.x - n.x) * .32, y: n.y + (lot.y - n.y) * .32 }));
    let half = Infinity;
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length], dx = b.x - a.x, dy = b.y - a.y;
      half = Math.min(half, Math.abs(dx * (lot.y - a.y) - dy * (lot.x - a.x)) / (Math.abs(dx) + Math.abs(dy)));
    }
    return half * 4;
  }
  lotSprite(lot) {
    const layer = this.manifest.layers.buildings, ids = layer.districts[lot.d];
    const id = ids[hash(`${lot.h}:layer-type`) % ids.length], sprite = layer.sprites[id];
    const state = sprite.states[String(lot.d === "core" ? this.stateFor(lot) : 100)] || sprite.states["100"];
    const variation = lot.d === "core" ? .9 + hash(`${lot.h}:layer-scale`) / 4294967296 * .2 : 1;
    const width = (sprite.widthFactor ? this.lotWidth(lot) * sprite.widthFactor : sprite.worldWidth) * variation * this.edge(lot).scale;
    return { sprite, state, width };
  }
  keySprite(tower) {
    const layer = this.manifest.layers.keyBuildings, isOwner = tower.kind === "owner";
    const id = isOwner ? layer.owner : layer.hubs[hash(tower.key) % layer.hubs.length];
    const sprite = layer.sprites[id], state = sprite.states["100"];
    return { id, sprite, state, width: sprite.worldWidth || (isOwner ? 6.5 : TOWER_STEP) * 2 * (sprite.widthFactor || 1) };
  }
  placement(lot, item) {
    // Anchor = front plinth vertex. The image's architectural base centre remains at the parcel centre.
    const [x, y] = P(lot.x + item.width / 4, lot.y + item.width / 4);
    const scale = item.width * unit() / item.state.baseWidth;
    return { x: x - item.state.anchor[0] * scale, y: y - item.state.anchor[1] * scale,
      w: item.state.size[0] * scale, h: item.state.size[1] * scale, scale };
  }
  paint(lot, item) {
    const p = this.placement(lot, item);
    if (p.x + p.w < -staticPad || p.x > W + staticPad || p.y + p.h < -staticPad || p.y > H + staticPad) return;
    ctx.globalAlpha = item.sprite.opacity ?? 1;
    ctx.drawImage(this.images.get(item.state.file), p.x, p.y, p.w, p.h);
    ctx.globalAlpha = 1;
  }
  towerLift(tower) {
    const item = this.keySprite(tower);
    // Crown height measured from the supplied anchor; used for beams, hit targets and follow.
    return Math.max(0, (item.state.anchor[1] - (item.state.crownY || 0)) * item.width / item.state.baseWidth - item.width / 4);
  }
  hitKey(px, py) {
    for (const tower of [...towers.values(), owner].reverse()) {
      const lot = tower.kind === "owner" ? G.owner : tower.lot; if (!lot) continue;
      const p = this.placement(lot, this.keySprite(tower));
      if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return tower;
    }
    return null;
  }
  drawBackdrop() {
    ctx.fillStyle = this.manifest.layers.ground.edge || "#172232"; ctx.fillRect(0, 0, W, H);
  }
  // Overscanned, tiered bitmaps use exactly the existing static-city camera contract.
  cached(name, signature, draw) {
    let cached = this.cache.get(name);
    const renderZ = Math.pow(1.25, Math.ceil(Math.log(cam.z) / Math.log(1.25)));
    const key = [W, H, DPR, renderZ, signature].join(":");
    let dx = cached ? (cached.x - cam.x) * unit() : 0, dy = cached ? (cached.y - cam.y) * unit() : 0;
    const ratio = cached ? cam.z / cached.z : 1;
    const mx = cached ? cached.pad * ratio - W / 2 * (1 - ratio) : 0;
    const my = cached ? cached.pad * ratio - (H / 2 + 30) * (1 - ratio) : 0;
    if (!cached || cached.key !== key || Math.abs(dx) > mx * .75 || Math.abs(dy) > my * .75) {
      const pad = Math.ceil(Math.max(W, H) * .2), z = cam.z, main = ctx;
      const canvas = document.createElement("canvas"); canvas.width = (W + 2 * pad) * DPR; canvas.height = (H + 2 * pad) * DPR;
      try {
        cam.z = renderZ; ctx = canvas.getContext("2d");
        ctx.setTransform(DPR, 0, 0, DPR, pad * DPR, pad * DPR); staticPad = pad;
        draw();
      } finally { ctx = main; cam.z = z; staticPad = 0; }
      cached = { key, canvas, pad, z: renderZ, x: cam.x, y: cam.y };
      this.cache.set(name, cached); this.rebuilds[name]++; dx = dy = 0;
    }
    const scale = cam.z / cached.z, ox = W / 2, oy = H / 2 + 30;
    ctx.drawImage(cached.canvas, ox + (-cached.pad - ox) * scale + dx, oy + (-cached.pad - oy) * scale + dy,
      (W + 2 * cached.pad) * scale, (H + 2 * cached.pad) * scale);
  }
  keySignature() { return [...towers.values()].filter(t => t.lot).map(t => `${t.key}:${t.lot.h}`).sort().join("|"); }
  drawStatic() {
    const signature = this.keySignature(), excluded = new Set([...towers.values()].map(t => t.lot).concat(G.owner));
    this.cached("surface", signature + ":" + this.revision, () => {
      this.drawGround(); this.drawRoads();
      // Emission spills are ground light, before the architectural pass.
      for (const lot of G.lots) if (!excluded.has(lot) && this.edge(lot).keep && lot.d === "core") {
        const level = this.stateFor(lot), [x, y] = P(lot.x, lot.y);
        if (level) { ctx.save(); ctx.translate(x, y); ctx.scale(1, .5); glow(0, 0, unit() * 2.3, C.cyan, .025 * level / 100); ctx.restore(); }
      }
      for (const tower of [...towers.values(), owner]) {
        const lot = tower.kind === "owner" ? G.owner : tower.lot; if (!lot) continue;
        const item = this.keySprite(tower), [x, y] = P(lot.x, lot.y);
        const light = this.manifest.layers.lightHaze;
        const color = item.sprite.spillColor || (tower.kind === "owner" ? light.spillOwner :
          [light.spillBlue, light.spillGreen][this.manifest.layers.keyBuildings.hubs.indexOf(item.id)]);
        ctx.save(); ctx.translate(x, y); ctx.scale(1, light.spillVerticalRadiusRatio);
        glow(0, 0, item.width * unit() * light.spillRadiusWidthFactor, color,
          tower.kind === "owner" ? light.ownerSpillOpacity : light.hubSpillOpacity);
        if (tower.kind === "owner") glow(0, 0, item.width * unit() * .65, light.spillOwnerWarm, light.ownerSpillOpacity * .5);
        ctx.restore();
      }
    });
    this.drawCabShadows();
    this.cached("buildings", signature + ":" + this.revision, () => {
      const items = G.lots.filter(lot => !excluded.has(lot) && this.edge(lot).keep)
        .map(lot => ({ lot, item: this.lotSprite(lot) }));
      items.sort((a, b) => a.lot.x + a.lot.y + a.item.width / 2 - b.lot.x - b.lot.y - b.item.width / 2);
      for (const { lot, item } of items) this.paint(lot, item);
    });
  }
  drawCabShadows() {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    for (const cab of cabs.values()) {
      if (cab.landed) continue;
      const [x, y] = P(cab.x, cab.y), width = unit() * 3.4;
      ctx.beginPath(); ctx.ellipse(x, y, width * .35, width * .16, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawGround() {
    const g = this.manifest.layers.ground;
    const [gx, gy] = P(CX, CY), ground = ctx.createRadialGradient(gx, gy, 0, gx, gy, unit() * 110);
    ground.addColorStop(0, g.center); ground.addColorStop(1, g.edge);
    ctx.fillStyle = ground; ctx.fillRect(-staticPad, -staticPad, W + 2 * staticPad, H + 2 * staticPad);
    // Extend the map plane beyond the former world oval, including a panned edge view.
    const step = g.gridStep || 4;
    const extent = (W + H + staticPad * 4) / unit(), cx = cam.x / 2 + cam.y, cy = cam.y - cam.x / 2;
    const x0 = Math.floor((cx - extent) / step) * step, x1 = cx + extent;
    const y0 = Math.floor((cy - extent) / step) * step, y1 = cy + extent;
    ctx.strokeStyle = rgba(g.gridColor || "#506078", g.gridAlpha ?? .11); ctx.lineWidth = g.gridWidthCSS ?? .5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(...P(x, y0)); ctx.lineTo(...P(x, y1)); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(...P(x0, y)); ctx.lineTo(...P(x1, y)); }
    ctx.stroke();
    for (const lot of G.lots) if (this.edge(lot).keep) {
      const q = lot.quad.map(n => P(n.x + (lot.x - n.x) * .32, n.y + (lot.y - n.y) * .32));
      poly(q, rgba(g.tileColor || "#1b293a", (g.tileOpacity ?? .7) * (1 - this.edge(lot).t * .7)));
    }
  }
  drawRoads() {
    const roads = this.manifest.layers.roads;
    ctx.lineCap = "round";
    for (const highway of [false, true]) {
      ctx.strokeStyle = rgba(highway ? roads.highwayColor : roads.color, highway ? roads.highwayAlpha : roads.alpha);
      ctx.lineWidth = unit() * (highway ? roads.highwayWidthWorld : roads.minorWidthWorld); ctx.beginPath();
      for (const n of G.nodes) for (const edge of n.adj) if (edge.to.id > n.id && !!edge.hw === highway) {
        ctx.moveTo(...P(n.x, n.y)); ctx.lineTo(...P(edge.to.x, edge.to.y));
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(roads.markColor, highway ? roads.highwayMarkOpacity : roads.markOpacity);
      ctx.lineWidth = highway ? roads.highwayMarkWidthCSS : roads.markWidthCSS; ctx.beginPath();
      for (const n of G.nodes) for (const edge of n.adj) if (edge.to.id > n.id && !!edge.hw === highway) {
        const dx = edge.to.x - n.x, dy = edge.to.y - n.y, length = edge.len || 1;
        // Two thin lane guides on highways, one centre guide on local streets.
        for (const side of highway ? [-1, 1] : [0]) {
          const offset = (highway ? roads.highwayLaneOffset : roads.laneOffset) * side;
          ctx.moveTo(...P(n.x - dy / length * offset, n.y + dx / length * offset));
          ctx.lineTo(...P(edge.to.x - dy / length * offset, edge.to.y + dx / length * offset));
        }
      }
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }
  drawKeys(tall, now) {
    this.cached("keys", this.keySignature(), () => {
      for (const tower of tall) this.paint(tower.kind === "owner" ? G.owner : tower.lot, this.keySprite(tower));
    });
    // Selection/questions remain live, while the supplied key architecture is static 100%.
    for (const tower of tall) {
      const lot = tower.kind === "owner" ? G.owner : tower.lot, [x, y] = P(lot.x, lot.y);
      selRing(tower, x, y, unit() * this.keySprite(tower).width * .65, now);
      const bl = blink(tower, now);
      if (bl >= 0 || tower.pulse > .01) glow(x, P(lot.x, lot.y, this.towerLift(tower))[1], unit() * 1.2,
        bl >= 0 ? C.gold : tower.color, bl >= 0 ? .1 + bl * .4 : tower.pulse * .3);
      tower.pulse *= .965;
    }
  }
  drawHaze() {
    this.cached("haze", "", () => {
      const settings = this.manifest.layers.lightHaze;
      // Stage-1's faint distant cool veil, composited above the city and its movers.
      for (const [x, y, radius] of [[54, 20, 34], [84, 90, 22], [28, 106, 18]]) {
        const p = P(x, y); glow(...p, unit() * radius, settings.color || "#91a6bc", Math.min(.035, settings.alpha ?? .035));
      }
    });
  }
  // Every mover repeats a deterministic graph walk and its reverse: fixed connected trajectories.
  route(node, seed) {
    const nodes = [node]; let previous = null;
    for (let i = 0; i < 24; i++) {
      let choices = node.adj.filter(e => e.to !== previous);
      if (!choices.length) choices = node.adj;
      if (!choices.length) break;
      const next = choices[hash(`${seed}:${i}`) % choices.length].to;
      nodes.push(next); previous = node; node = next;
    }
    return nodes.concat(nodes.slice(0, -1).reverse());
  }
  advance(mover, dt, speed, node, seed, stopAt) {
    if (!mover.layerRoute) { mover.layerRoute = this.route(node, seed); mover.layerSegment = 0; mover.layerT = 0; }
    const path = mover.layerRoute;
    if (path.length < 2) { mover.x = node.x; mover.y = node.y; return; }
    let distance = dt * speed;
    for (let guard = 0; guard < 100; guard++) {
      const a = path[mover.layerSegment], b = path[mover.layerSegment + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const remaining = (1 - mover.layerT) * length;
      if (distance < remaining) {
        mover.layerT += distance / length;
        mover.x = a.x + (b.x - a.x) * mover.layerT; mover.y = a.y + (b.y - a.y) * mover.layerT;
        mover.dir = [b.x - a.x, b.y - a.y]; return;
      }
      distance -= remaining; mover.layerT = 0;
      const next = mover.layerSegment + 1;
      if (next === stopAt) {
        mover.layerSegment = next; mover.x = path[next].x; mover.y = path[next].y; return true;
      }
      mover.layerSegment = next % (path.length - 1);
    }
  }
  drive(car, dt) { this.advance(car, dt, car.speed, car.a, `ground:${car.a.id}`); }
  fly(cab, now, dt) {
    cab.px = cab.x; cab.py = cab.y;
    const home = cab.home.lot, node = nearest(home.x, home.y, null, 30) || G.nodes[0];
    if (cab.leaving && !cab.layerReturn) {
      // Reverse the traversed graph edges to the original home-access node, then land.
      const route = cab.layerRoute || [node], index = cab.layerSegment || 0;
      const points = [{ x: cab.x, y: cab.y }, ...route.slice(0, index + 1).reverse()]
        .filter((p, i, all) => !i || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) > 1e-8);
      const access = points.at(-1), accessIndex = points.length - 1;
      points.push({ x: home.x, y: home.y });
      cab.layerReturn = { layerRoute: points, layerSegment: 0, layerT: 0, access, accessIndex };
    }
    if (cab.layerReturn) {
      const back = cab.layerReturn;
      if (!cab.leaving && back.layerSegment >= back.accessIndex) {
        // Reappeared on the short landing connector: reverse it continuously to the road.
        back.layerRoute = [{ x: cab.x, y: cab.y }, back.access, { x: home.x, y: home.y }];
        back.layerSegment = 0; back.layerT = 0; back.accessIndex = 1;
      }
      const target = cab.leaving ? back.layerRoute.length - 1 : back.accessIndex;
      const reached = this.advance(back, dt, CRUISE, node, cab.key, target);
      cab.x = back.x; cab.y = back.y;
      if (cab.leaving) {
        const connector = Math.hypot(home.x - back.access.x, home.y - back.access.y);
        cab.z = back.layerSegment < back.accessIndex ? cab.alt : cab.alt * clamp(Math.hypot(home.x - cab.x, home.y - cab.y) / (connector || 1), 0, 1);
        if (reached) cab.landed = true;
      } else {
        cab.z = Math.min(cab.alt, (cab.z ?? cab.alt) + dt * CRUISE);
        if (reached) { cab.layerRoute = null; delete cab.layerReturn; }
      }
      return;
    }
    this.advance(cab, dt, CRUISE * (cab.working ? 1.3 : 1), node, cab.key);
    cab.z = Math.min(cab.alt, (cab.z ?? cab.alt) + dt * CRUISE); // continuous climb after a cancelled landing
  }
}
