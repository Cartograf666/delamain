// Real Go endpoint + accepted WebGL page, isolated home, owned child cleanup.
// Run from the repo root: node viz/tests/city.test.cjs [evidence-directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {once} = require('node:events');
const crypto = require('node:crypto');
const {chromium} = require('playwright');
const out = path.resolve(process.argv[2] || '/tmp/viz-state-19');
fs.mkdirSync(out, {recursive: true});
const home = fs.mkdtempSync(path.join(out, 'fixture-'));
const binary = path.join(out, 'hub-viz');
const port = 8800 + Number(process.env.AGENT_HUB_SLOT || 19);
const origin = `http://127.0.0.1:${port}`;
const stages = [['alpha', '/fixture/santinel'], ['beta', '/fixture/santinel'], ['gamma', '/fixture/new-project'], ['solo', '']];
for (const [name, repo] of stages) {
  const dir = path.join(home, name), work = path.join(dir, 'coordinator/work');
  fs.mkdirSync(work, {recursive: true});
  fs.writeFileSync(path.join(dir, 'stage.json'), JSON.stringify({repo}));
  fs.writeFileSync(path.join(work, 'journal-2026-10-08.md'), '- 01:00 [worker] @hub DONE fixture archive\n');
}
execFileSync('go', ['build', '-o', binary, '.'], {cwd: path.resolve('viz'), stdio: 'inherit'});
let server, browser;
const evidence = {port, fixtureHome: home, pids: [], errors: [], checks: []};
const record = name => evidence.checks.push(name);
async function stop() {
  if (server) {
    const current = server; server = null;
    const ended = once(current, 'exit'); current.kill('SIGTERM'); await ended;
  }
}
async function start(root) {
  server = spawn(binary, ['-addr', `127.0.0.1:${port}`], {env: {...process.env, AGENT_HUB_HOME: root}, stdio: ['ignore', 'ignore', 'pipe']});
  evidence.pids.push(server.pid);
  server.stderr.on('data', b => fs.appendFileSync(path.join(out, 'server.log'), b));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('Go server exited');
    try { if ((await fetch(origin + '/city')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('Server startup timed out');
}
function state(order) {
  return {machine: 'fixture', limits: {}, stages: order.map(name => ({name, repo: stages.find(s => s[0] === name)?.[1] || '', open: true, hub: {}, workers: []}))};
}
async function places(page) {
  return page.evaluate(() => Object.fromEntries([...towers.values()].map(t => [t.stage, {district: t.district, tower: layerCity.live.lots.indexOf(t.lot)}]).sort((a,b) => a[0].localeCompare(b[0]))));
}
async function openPage(order, cityBody) {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  page.on('pageerror', e => evidence.errors.push(String(e)));
  await page.route('**/state', r => r.fulfill({json: state(order)}));
  await page.route('**/events', r => r.abort());
  if (cityBody) await page.route('**/city', r => r.fulfill({json: cityBody}));
  await page.goto(origin + '/?map=1&live=1&lang=ru&follow=0');
  await page.waitForFunction(n => typeof layerCity !== 'undefined' && layerCity?.live?.metrics.frames > 2 && towers.size === n && [...towers.values()].every(t => t.lot), order.length);
  return page;
}
async function defaultPixels(html, query) {
  const p = await browser.newPage({viewport: {width: 1200, height: 800}});
  const requested = [];
  p.on('request', r => requested.push(r.url()));
  await p.route(origin + '/?**', r => r.fulfill({contentType: 'text/html', body: html}));
  await p.route('**/state', r => r.fulfill({json: state(stages.map(s => s[0]))}));
  await p.route('**/events', r => r.abort());
  await p.addInitScript(() => {
    let seed = 17; Math.random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2**32;};
    const D = Date; globalThis.Date = class extends D {constructor(...a) {super(...(a.length ? a : [1793836800000]));} static now() {return 1793836800000;}};
    let clock = 0, n = 0; const raf = new Map(); performance.now = () => clock;
    requestAnimationFrame = cb => {raf.set(++n, cb); return n;}; cancelAnimationFrame = id => raf.delete(id); setInterval = () => 0;
    window.step = t => {clock = t; const q = [...raf.values()]; raf.clear(); q.forEach(cb => cb(t));};
  });
  await p.goto(origin + '/?lang=ru&follow=0' + query);
  await p.waitForFunction(() => typeof towers !== 'undefined' && towers.size === 4);
  await p.evaluate(() => ready);
  await p.evaluate(() => {for (let i = 1; i < 30; i++) step(i*25);});
  const pixels = await p.evaluate(() => Array.from(ctx.getImageData(0, 0, cv.width, cv.height).data));
  assert(!requested.some(u => u.endsWith('/city')), 'Default page requested /city');
  await p.close();
  return crypto.createHash('sha256').update(Buffer.from(pixels)).digest('hex');
}
(async () => {
  try {
    await start(home);
    const city = await fetch(origin + '/city').then(r => r.json());
    assert.equal(city.projects.length, 3);
    assert.equal(city.stagesWithoutRepo, 1);
    assert.equal(city.projects.find(p => p.id === '/fixture/santinel').finishedTasks, 2);
    assert.equal((await fetch(origin + '/history?hours=100000').then(r => r.json())).lines?.length || 0, 0);
    const past=await fetch(origin+'/city?date=2026-10-07').then(r=>r.json());
    assert(past.plotOwners.every(p=>!p.owner));
    record('full archive city, historic date before project birth; history remains capped to a week');
    browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-gpu']});
    const order = stages.map(s => s[0]);
    let p = await openPage(order);
    evidence.initial = await places(p);
    evidence.virtualRoofAnchors = await p.evaluate(() => [...towers.values()].filter(t => cityProject(t.machine,t.stage)?.tower < 0).map(t => {
      const main = cityProject(t.machine,t.stage).mainPlot;
      const expected = layerCity.world(main.X,main.Y);
      return {stage:t.stage, error:Math.hypot(t.lot.x-expected.x,t.lot.y-expected.y)};
    }));
    assert(evidence.virtualRoofAnchors.length > 0);
    assert(evidence.virtualRoofAnchors.every(p => p.error < 1e-8), 'Virtual roof left the owned main plot');
    const expected = Object.fromEntries(city.projects.flatMap(p => p.stages.map(s => [s, {district: p.zone, tower: p.tower}])));
    assert.deepEqual(evidence.initial, expected);
    assert.deepEqual(evidence.initial.alpha, evidence.initial.beta);
    await p.reload();
    await p.waitForFunction(() => typeof layerCity !== 'undefined' && layerCity?.live?.metrics.frames > 2 && [...towers.values()].every(t => t.lot));
    assert.deepEqual(await places(p), expected); await p.close();
    p = await openPage([...order].reverse());
    assert.deepEqual(await places(p), expected); await p.close();
    record('real WebGL places equal /city after reload and reversed stage order; two stages share a place');
    await stop(); await start(home);
    assert.deepEqual(await fetch(origin + '/city').then(r => r.json()), city);
    p = await openPage(order); assert.deepEqual(await places(p), expected); await p.close();
    record('server restart preserves endpoint and actual page placement');
    // More projects than authored key pads: the territory model stays deterministic.
    for (let i = 0; i < 100; i++) {
      const name = 'extra-' + i, dir = path.join(home, name);
      fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'stage.json'), JSON.stringify({repo: '/fixture/' + name}));
      fs.mkdirSync(path.join(dir,'coordinator/work'),{recursive:true}); fs.writeFileSync(path.join(dir,'coordinator/work/journal-2026-10-08.md'),'- 01:00 [worker] DONE new project\n');
    }
    const more = await fetch(origin + '/city').then(r => r.json());
    assert.equal(more.projects.length, 103);
    assert.deepEqual(await fetch(origin + '/city').then(r => r.json()),more);
    assert(new Set(more.projects.map(p => p.tower)).size < more.projects.length);
    for (let i = 0; i < 100; i++) fs.rmSync(path.join(home, 'extra-' + i), {recursive: true});
    assert.deepEqual(await fetch(origin + '/city').then(r => r.json()), city);
    record('103-project overflow remains deterministic; removing those journals restores the original territories');
    // Client authority: a valid alternative server assignment must be followed, not recomputed.
    const authoritative = structuredClone(city), source = authoritative.projects.find(p => p.id === '/fixture/santinel');
    const alternative = authoritative.projects.find(p => p.id === 'solo');
    assert.notDeepEqual({district: source.zone, tower: source.tower}, {district: alternative.zone, tower: alternative.tower});
    source.district = alternative.district; source.zone=alternative.zone; source.tower = alternative.tower; source.mainPlot=alternative.mainPlot;
    p = await openPage(order, authoritative);
    assert.deepEqual((await places(p)).alpha, {district: source.zone, tower: source.tower});
    await p.close(); record('page follows server places (authority positive control)');
    const baseline = execFileSync('git', ['show', '5c3bd1f:viz/viz.html'], {encoding: 'utf8'});
    const current = fs.readFileSync('viz/viz.html', 'utf8');
    evidence.defaultHashes = [await defaultPixels(baseline, ''), await defaultPixels(current, ''), await defaultPixels(current, '&live=1')];
    assert(evidence.defaultHashes.every(h => h === evidence.defaultHashes[0]));
    record('default canvas pixel parity with accepted 5c3bd1f, including live=1 without map=1; no /city request');
    assert.deepEqual(evidence.errors, []);
    await browser.close(); browser = null;
    await stop();
    // The live archive is read only: same server binary, no fixture writes beneath this home.
    await start(require('node:os').homedir()+'/agent-hub');
    evidence.live = {durationsMs: []};
    for (let i = 0; i < 5; i++) {
      const at = performance.now();
      const response = await fetch(origin + '/city'); assert.equal(response.status, 200);
      const body = await response.json(); evidence.live.durationsMs.push(performance.now() - at);
      fs.writeFileSync(path.join(out, 'live-city.json'), JSON.stringify(body, null, 2));
      evidence.live.projects = body.projects.length; evidence.live.stagesWithoutRepo = body.stagesWithoutRepo;
    }
    record('live full archive /city measured five times without writes or cache');
  } finally {
    if (browser) await browser.close();
    await stop();
    evidence.ownedProcessesStopped = evidence.pids.every(pid => {try {process.kill(pid, 0); return false;} catch {return true;}});
    fs.writeFileSync(path.join(out, 'city-checks.json'), JSON.stringify(evidence, null, 2));
  }
  console.log(JSON.stringify(evidence, null, 2));
})().catch(e => {console.error(e); process.exitCode = 1;});
