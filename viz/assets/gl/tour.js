// Self-playing, looping tour of the city's events (?demo=celebration&tour=1). It presses the test panel's own buttons, so
// nothing is written to the journal. The timeline bar replaces the panel: drag it to any scene, it plays on from there.
// A scene is the unit of seeking: flights and fires are live simulation, not a recording, so a drag restarts a scene.
(async () => {
  const LANG = new URLSearchParams(location.search).get('lang') === 'en' ? 1 : 0, say = (ru, en) => (LANG ? en : ru);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let panel;
  while (!(panel = document.getElementById('celebration-panel')) || !layerCity?.live?.aq) await wait(200);
  panel.hidden = true; panel.style.display = 'none';
  const live = layerCity.live, aq = live.aq, gpu = live.gpu;
  const city = () => [...machines.values()].find(m => m.cityData?.projects?.length)?.cityData;
  while (!city()) await wait(200);
  await wait(1500);

  const press = q => panel.querySelector(q)?.click();
  const pick = id => { const s = document.getElementById('celebration-project'); if (s.value !== id) { s.value = id; s.dispatchEvent(new Event('change')); } };
  const mode = m => document.querySelector(`#growth-controls button[data-mode="${m}"]`)?.click();
  const project = id => city().projects.find(p => p.id === id);
  const ground = id => gpu.growth.plots.get(project(id)?.mainPlot?.id)?.ground;
  const land = id => city().plotOwners.filter(o => o.owner === id).map(o => gpu.growth.plots.get(o.id)?.ground).filter(Boolean);
  const box = (pts, pad = 40) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [[Math.min(...xs) - pad, Math.min(...ys) - pad], [Math.max(...xs) + pad, Math.max(...ys) + pad]]; };
  const sky = id => { const [x, y] = ground(id); return [[x - 170, y - 175], [x + 170, y + 75]]; };           // as fireworks frame themselves
  const trip = (id, kind) => { const s = aq.demo.cabs(id), to = s && aq.demo.target(s.T, kind); return to ? box([ground(id), to.pad.g], 70) : sky(id); };
  const hub = () => [...towers.values()].find(t => t.kind !== 'owner' && t.project && t.open !== false)?.project;
  const whole = () => [[0, 0], [1800, 780]];

  // A scene lasts as its event does (hold: seconds after the camera has arrived), or the camera leaves before the taxi lands.
  // Minas Tirith is the nearest to the owner; Clip Factory's border is compact, so its capture stays in one place.
  const Q = q => () => press(q);
  const firework = kind => Q(`[data-kind="${kind}"]`), taxi = kind => Q(`[data-taxi="${kind}"]`);
  const out = () => aq.response.extinguishDemo(), alerts = () => document.getElementById('gl-alert-demo')?.click();
  const scenes = [
    { label: say('Город', 'The city'), view: whole, hold: 3 },
    { label: say('Работа: уровень 1', 'Work: level 1'), id: 'Stravel', view: id => box(land(id), 30), hold: 6, work: 1 },
    { label: say('PR открыт', 'PR opened'), id: 'Stravel', view: sky, hold: 6, work: 2, act: firework('pr-opened') },
    { label: say('PR смёржен', 'PR merged'), id: 'Stravel', view: sky, hold: 9, work: 2, act: firework('pr-merged') },
    { label: say('Работа: уровень 3', 'Work: level 3'), id: 'Stravel', view: id => box(land(id), 30), hold: 5, work: 3 },
    { label: say('Релиз', 'Release'), id: 'Stravel', view: sky, hold: 20, work: 3, act: firework('release') },
    { label: say('Работа окончена', 'Work ended'), id: 'Stravel', view: id => box(land(id), 30), hold: 4, work: 0 },
    { label: say('Доставка в проекте', 'Delivery in project'), id: 'Delamain', view: id => trip(id, 'project'), hold: 9, act: taxi('project'), follow: true },
    { label: say('Доставка соседу', 'Delivery to neighbour'), id: 'Delamain', view: id => trip(id, 'neighbour'), hold: 12, act: taxi('neighbour'), follow: true },
    { label: say('Доставка владельцу', 'Delivery to owner'), id: 'Minas Tirith', view: id => trip(id, 'owner'), hold: 11, act: taxi('owner'), follow: true },
    { label: say('Пять рейсов сразу', 'Five at once'), id: 'Stravel', view: id => box(land(id), 30), hold: 14, act: taxi('five') },
    { label: say('Патруль', 'Patrol'), id: 'Agent Harness', view: id => box(land(id), 30), hold: 9, act: taxi('patrol'), leave: taxi('patrol') },
    { label: say('Вопрос владельцу', 'Question for the owner'), id: hub, view: sky, hold: 7, act: Q('[data-district="question"]'), leave: Q('[data-district="question"]') },
    { label: say('Вопрос и блокер', 'Question and blocker'), id: hub, view: sky, hold: 7, act: alerts, leave: alerts },
    { label: say('Захват: малый', 'Capture: small'), id: 'Clip Factory', mode: 'territories', hold: 11, act: Q('[data-district="capture-small"]'), leave: out },
    { label: say('Захват: средний', 'Capture: medium'), id: 'Clip Factory', mode: 'territories', hold: 12, act: Q('[data-district="capture-medium"]'), leave: out },
    { label: say('Захват: большой', 'Capture: large'), id: 'Clip Factory', mode: 'territories', hold: 16, act: Q('[data-district="capture-large"]'), leave: out },
    { label: say('Район растёт', 'District grows'), id: 'Clip Factory', mode: 'territories', view: id => box(land(id), 30), hold: 12, act: Q('[data-district="grow"]') },
    { label: say('Проект закрыт', 'Project closed'), id: 'Clip Factory', mode: 'territories', view: id => box(land(id), 30), hold: 7, act: Q('[data-district="closed"]'), leave: Q('[data-district="closed"]') },
  ].filter(s => typeof s.id !== 'function' || (s.id = s.id()));

  const FLY = 3.2;   // a glide is at most 3.2 s: every scene reserves it, so the timeline does not depend on the distance
  let total = 0; for (const s of scenes) { s.start = total; total += FLY + s.hold; }

  const css = document.createElement('style');
  css.textContent = `
  #tour-bar{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:6px;width:min(820px,calc(100vw - 32px));box-sizing:border-box;z-index:9;font:11px ui-monospace,Menlo,monospace;color:#c8d0da;opacity:.42;transition:opacity .25s}
  #tour-bar:hover,#tour-bar:focus-within,#tour-bar.scrub{opacity:1}
  #tour-bar button{flex:none;width:28px;height:28px;padding:0;border:0;border-radius:4px;background:none;color:inherit;font:inherit;font-size:15px;cursor:pointer}
  #tour-bar button:hover{background:rgba(200,208,218,.14)}
  #tour-bar button:focus-visible,#tour-range:focus-visible,#tour-label:focus-visible{outline:2px solid #ffe9ae;outline-offset:2px}
  #tour-track{position:relative;flex:1;min-width:0;height:24px;display:flex;align-items:center}
  #tour-ticks{position:absolute;inset:0;pointer-events:none}
  #tour-ticks i{position:absolute;top:50%;width:1px;height:6px;margin-top:-3px;background:rgba(200,208,218,.5)}
  #tour-range{-webkit-appearance:none;appearance:none;position:relative;width:100%;height:24px;margin:0;background:none;cursor:pointer}
  #tour-range::-webkit-slider-runnable-track{height:2px;background:rgba(200,208,218,.3)}
  #tour-range::-moz-range-track{height:2px;background:rgba(200,208,218,.3)}
  #tour-range::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;margin-top:-4px;border:0;border-radius:50%;background:#dfe6ee}
  #tour-range::-moz-range-thumb{width:10px;height:10px;border:0;border-radius:50%;background:#dfe6ee}
  #tour-label{flex:none;width:37ch;height:28px;padding:0 4px;border:1px solid rgba(200,208,218,.25);border-radius:4px;background:rgba(3,4,9,.6);color:inherit;font:inherit;cursor:pointer}
  #tour-label option{background:#0b0d16;color:#dfe6ee}
  @media (max-width:640px){#tour-label{width:15ch}}
  body.tour #ticker{display:none}
  @media (prefers-reduced-motion:reduce){#tour-bar{transition:none}}`;
  document.head.append(css); document.body.classList.add('tour');

  const bar = document.createElement('div'); bar.id = 'tour-bar';
  bar.innerHTML = `<button id="tour-prev" type="button">‹</button><button id="tour-play" type="button"></button><button id="tour-next" type="button">›</button><div id="tour-track"><div id="tour-ticks"></div><input id="tour-range" type="range" min="0" step="0.1"></div><select id="tour-label"></select>`;
  document.body.append(bar);
  const play = bar.querySelector('#tour-play'), range = bar.querySelector('#tour-range'), label = bar.querySelector('#tour-label'), ticks = bar.querySelector('#tour-ticks');
  range.max = total; range.setAttribute('aria-label', say('Таймлайн демо', 'Demo timeline'));
  const prev = bar.querySelector('#tour-prev'), next = bar.querySelector('#tour-next'), title = s => (s.id ? `${s.label} · ${s.id}` : s.label);
  prev.setAttribute('aria-label', say('Предыдущая сцена', 'Previous scene')); next.setAttribute('aria-label', say('Следующая сцена', 'Next scene'));
  label.setAttribute('aria-label', say('Сцена', 'Scene')); scenes.forEach((s, i) => label.append(new Option(title(s), i)));
  for (const s of scenes.slice(1)) { const i = document.createElement('i'); i.style.left = `${s.start / total * 100}%`; ticks.append(i); }

  let t = 0, cur = -1, token = 0, playing = true, scrubbing = false, last = 0, debounce = 0;
  const sceneAt = v => { let i = 0; while (i + 1 < scenes.length && scenes[i + 1].start <= v) i++; return i; };
  const caption = i => { if (+label.value !== i && document.activeElement !== label) label.value = i; const text = title(scenes[i]); if (range.getAttribute('aria-valuetext') !== text) range.setAttribute('aria-valuetext', text); };
  const syncPlay = () => { play.textContent = playing ? '❚❚' : '▶'; play.setAttribute('aria-label', playing ? say('Пауза', 'Pause') : say('Дальше', 'Play')); };

  function enter(i) {
    const me = ++token, s = scenes[cur = i];
    if (s.mode) mode(s.mode); if (s.id) pick(s.id);
    if (s.work != null) press(`[data-work="${s.work}"]`);   // events come out of work: the more of it, the more light at the tower
    const box = s.view?.(s.id), ms = box ? aq.glideTo(box) : 0;
    setTimeout(() => { if (me !== token) return; s.act?.(); if (s.follow) chase(me); }, Math.min(ms, FLY * 1000));
  }
  // A delivery is watched from close by: the camera pins the cab that took it, as a click on its row does.
  function chase(me, tries = 12) {
    if (me !== token) return;
    const cab = aq.fl.find(f => f.demo && f.cargo === 1 && f.worker)?.worker;
    if (cab) { aq.stopGlide(); if (pinned !== cab) pin(cab); } else if (tries) setTimeout(() => chase(me, tries - 1), 250);
  }
  function leave() { const s = scenes[cur]; token++; if (pinned) pin(null); if (cur >= 0) s?.leave?.(); }
  // A drag lands anywhere: nothing may stay on from the scene it left, and a scene's toggles start from off.
  function jump(i) {
    leave();
    press('[data-taxi="reset"]'); press('[data-district="reset"]'); mode('activity');
    t = scenes[i].start; enter(i);
  }
  function tick(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (playing && !scrubbing) {
      t += dt;
      if (t >= total) jump(0);
      else if (sceneAt(t) !== cur) { leave(); enter(sceneAt(t)); }
      range.value = t;
    }
    caption(scrubbing ? sceneAt(+range.value) : cur);
    requestAnimationFrame(tick);
  }

  // Arrows, the list and the keys go straight to a scene; they wrap round, as the loop does.
  function go(i) { jump((i + scenes.length) % scenes.length); range.value = t; label.value = cur; }
  prev.addEventListener('click', () => go(cur - 1)); next.addEventListener('click', () => go(cur + 1));
  label.addEventListener('change', () => { go(+label.value); label.blur(); });
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || !['ArrowLeft', 'ArrowRight'].includes(e.key) || e.target.closest?.('input,select,textarea')) return;
    e.preventDefault(); go(cur + (e.key === 'ArrowLeft' ? -1 : 1));
  });
  function settle() { clearTimeout(debounce); debounce = 0; const i = sceneAt(+range.value); if (i !== cur) jump(i); else t = +range.value; }
  range.addEventListener('input', () => { scrubbing = true; bar.classList.add('scrub'); clearTimeout(debounce); debounce = setTimeout(settle, 220); });
  const release = () => { if (!scrubbing) return; scrubbing = false; bar.classList.remove('scrub'); settle(); };
  range.addEventListener('change', release); range.addEventListener('pointerup', release);
  play.addEventListener('click', () => { playing = !playing; syncPlay(); });
  live.canvas?.addEventListener('pointerdown', () => aq.stopGlide()); live.canvas?.addEventListener('wheel', () => aq.stopGlide(), { passive: true });

  syncPlay(); last = performance.now(); enter(0); requestAnimationFrame(tick);
})();
