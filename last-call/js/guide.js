/* Last Call — telling you what to do. Aura (your standing with the room, with +/- popups),
   "read the room" vision, a how-to hint per problem, the radar minimap, markers over known
   trouble, the context prompt panel and the kit display. */
(function () {
  'use strict';
  const { U, Map: M } = LC;
  const T = M.T;
  const $ = (id) => document.getElementById(id);
  const Gd = (LC.Guide = {});

  /* ================= aura ================= */
  const A = (LC.Aura = { pops: [] });
  const RANKS = [[-400, 'Negative aura. People pity you.'], [0, 'No aura. Furniture energy.'], [300, 'Some aura.'], [800, 'Respected.'], [1500, 'Feared and adored.'], [2600, 'Legendary doorman.']];
  A.rank = (v) => { let r = RANKS[0][1]; for (const [k, t] of RANKS) if (v >= k) r = t; return r; };
  A.add = (n, reason) => {
    const G = LC.G;
    if (!G || G.demo || !n) return;
    G.aura = (G.aura || 0) + n;
    LC.stat(n > 0 ? 'auraGained' : 'auraLost', Math.abs(n));
    if (reason) A.pops.push({ n, reason, t: 0 });
    if (A.pops.length > 4) A.pops.shift();
  };
  // aura makes people listen
  A.bonus = () => U.clamp(((LC.G && LC.G.aura) || 0) / 4000, -0.12, 0.15);
  // hook common events
  const onResolve = (inc, how) => {
    if (how === 'self' || how === 'quiet') return;
    const k = { stare: [120, 'Stared them down'], snark: [70, 'Sarcasm landed'], talk: [50, 'Talked them down'], warn: [40, 'Warning heeded'], eject: [70, 'Thrown out'], separate: [150, 'Broke up a fight'], mop: [20, null], aid: [60, null] }[how] || [40, null];
    A.add(k[0], k[1]);
  };
  Gd.onResolve = onResolve;

  /* ================= hints ================= */
  const HINT = {
    fight: 'Pull them apart: grab one (Click) or shove (Space). Q radios backup.',
    argument: 'Get in there before it turns into a fight: talk (E) or shove them apart.',
    vomit: 'Hold Click on it to mop. Then E for a wet floor sign.',
    injured: 'Walk over and press E to patch them up.',
    sleeper: 'E to wake them. If they won\'t go, grab them (Click) and walk them out.',
    harasser: 'He won\'t leave her alone. Talk (E), or grab him (Click) and walk him out the front.',
    kissing: 'Talk (E) or stare. Still at it? Grab one (Click) and separate them.',
    breakup: 'Calm it down (E) or walk one of them away (Click).',
    gang: 'Trouble in numbers. Radio backup (Q), then throw out the leader (Click).',
    teens: 'They\'re children. Check them (E) and walk them out (Click).',
    airbnb: 'Go to the stall and press E to open it.',
    emergency: 'Go to the fire exit and press E to close it.',
    fireAlarm: 'The alarm panel is backstage. Go there and press E.',
    powerOut: 'The breaker is backstage. Go there and press E.',
    smokeIndoors: 'Tell them to take it outside (E), or stare them down.',
    vipSneak: 'Talk (E), or grab (Click) and walk them out of VIP.',
    dj: 'Get them out of the DJ booth: talk (E) or grab (Click).',
    lostPhone: 'Find the phone (look on the floor) and give it back (E).',
    lostShoe: 'Find the shoe on the floor, pick it up (Click), bring it back (E).',
    lostFriend: 'Find their friend, then talk to them (E).',
    fireAlarmLight: '',
  };
  const DEF_HINT = 'Stare at them, talk (E), or grab them (Click) and walk them to an exit.';
  Gd.hint = (inc) => {
    if (HINT[inc.type]) return HINT[inc.type];
    const d = inc.def;
    if (d.onPropTaken) return 'Take it off them (Click) or talk (E). Staring works too.';
    if (inc.data && inc.data.mess) return HINT.vomit;
    return DEF_HINT;
  };
  const CAT = (inc) => {
    const t = inc.type;
    if (t === 'fight' || t === 'argument' || t === 'gang') return { c: '#ff4d5a', g: '✊' };
    if (t === 'injured' || t === 'sleeper') return { c: '#3dff8a', g: '+' };
    if (t === 'kissing' || t === 'breakup') return { c: '#ff6fb8', g: '♥' };
    if (t === 'harasser') return { c: '#ff8a3a', g: '!' };
    if (inc.data && inc.data.mess || t === 'vomit') return { c: '#c8e05a', g: '~' };
    if (t === 'fireAlarm' || t === 'powerOut' || t === 'emergency') return { c: '#ffd23f', g: '⚡' };
    return { c: '#ffd23f', g: '!' };
  };
  Gd.cat = CAT;
  // the jobs you know about, nearest first
  Gd.jobs = () => {
    const G = LC.G, p = G.player;
    const out = [];
    for (const inc of LC.Incidents.active) {
      if (!inc.noticed && !inc.reported) continue;
      const x = inc.n && !inc.n.gone ? inc.n.x : inc.data.pos ? inc.data.pos.x : inc.x, y = inc.n && !inc.n.gone ? inc.n.y : inc.data.pos ? inc.data.pos.y : inc.y;
      out.push({ inc, x, y, d: p ? U.dist(p.x, p.y, x, y) : 0, z: inc.n ? inc.n.z || 0 : 0 });
    }
    out.sort((a, b) => (b.inc.type === 'fight') - (a.inc.type === 'fight') || a.d - b.d);
    return out;
  };

  /* ================= read the room ================= */
  Gd.vision = 0;
  const VCOL = { trouble: [1.4, 0.15, 0.2], drunk: [1.1, 0.8, 0.05], love: [1.2, 0.25, 0.8], staff: [0.15, 0.5, 1.3], vip: [1.0, 0.75, 0.2], fine: null, angry: [1.3, 0.45, 0.05] };
  Gd.category = (c) => {
    if (c.kind === 'staff' || c.police) return 'staff';
    if (c.kind !== 'guest') return null;
    if (c.incident || LC.Social.fightOf(c) || LC.Social.argumentOf(c)) return 'trouble';
    if (c.couple && c.couple.on) return 'love';
    if (c.mood && c.mood.anger > 0.5) return 'angry';
    if ((1 - c.sob) > 0.72) return 'drunk';
    if (c.vip) return 'vip';
    return 'fine';
  };
  function glowFor(c) {
    const G = LC.G, p = G.player;
    if (p && p.aimWho === c && !G.demo) return [0.18, 0.18, 0.14];
    if (Gd.vision <= 0.02) return null;
    const cat = Gd.category(c);
    if (!cat) return null;
    const k = VCOL[cat];
    if (!k) return null;
    const v = Gd.vision * (0.6 + Math.sin(G.t * 4) * 0.15);
    return [k[0] * v, k[1] * v, k[2] * v];
  }

  /* ================= training: the first shift ================= */
  const TUT = [
    { t: 'Walk to the bar', h: 'WASD to walk, the mouse to look around. Follow the marker.', start(G) { return { x: 24 * T, y: 13.5 * T }; }, done(G, s) { const p = G.player; return U.dist(p.x, p.y, s.x, s.y) < 110; } },
    { t: 'Read the room', h: 'Hold R. Red is trouble, yellow is drunk, pink is romance.', start() { return null; }, done() { return Gd.vision > 0.85; } },
    { t: 'Stare someone down', h: 'Someone is standing on a speaker. Keep them in your crosshair until they climb down. Or press E to talk.', start(G) {
      const p = G.player; const n = G.npcs.filter((q) => q.kind === 'guest' && q.state === 'inside' && !q.incident && !q.override).sort((a, b) => U.dist(a.x, a.y, p.x, p.y) - U.dist(b.x, b.y, p.x, p.y))[0];
      const inc = n && LC.Incidents.start('speaker', n); if (inc) LC.Incidents.notice(inc, 'told'); return { inc };
    }, done(G, s) { return !s.inc || s.inc.state !== 'active'; } },
    { t: 'Clean up a spill', h: 'Look at the spill and HOLD click to mop it. Then press E for a wet floor sign.', start(G) { const p = G.player; const m = LC.W.addMess('vomit', p.x + Math.cos(p.face) * 50, p.y + Math.sin(p.face) * 50, { r: 15 }); return { m, x: m && m.x, y: m && m.y }; }, done(G, s) { return !s.m || !LC.W.mess.includes(s.m); } },
    { t: 'Throw someone out', h: 'Kevin has had enough. Click to grab him, walk him to the front door, press Space to throw him out.', start(G) {
      const p = G.player; const n = G.npcs.filter((q) => q.kind === 'guest' && q.state === 'inside' && !q.incident && !q.override && !q.seat).sort((a, b) => U.dist(a.x, a.y, p.x, p.y) - U.dist(b.x, b.y, p.x, p.y))[0];
      if (n) { n.name = 'Kevin'; n.sob = 0.15; n.flags.tutorialTarget = true; }
      return { n };
    }, done(G, s) { return !s.n || s.n.gone || s.n.state !== 'inside' || s.n.flags.ejected; } },
  ];
  Gd.tutTick = (G) => {
    const tu = G.tut;
    if (!tu || tu.done) return;
    if (LC.Input.pressed.has('KeyJ')) { tu.done = true; LC.Radio.say('marcus', 'Skipping training. Bold. Good luck, Unit Four.'); return; }
    if (!tu.s) { const st = TUT[tu.i]; tu.s = st.start(G) || {}; tu.t0 = G.t; LC.Objectives.flash('TRAINING ' + (tu.i + 1) + '/' + TUT.length + ': ' + st.t.toUpperCase(), st.h); }
    const st = TUT[tu.i];
    if (st.done(G, tu.s) || G.t - tu.t0 > 150) {
      LC.Aura.add(50, 'Training: ' + st.t);
      tu.i++; tu.s = null;
      if (tu.i >= TUT.length) { tu.done = true; LC.Radio.convo([['marcus', "That's the job. Notice things. Fix things. Throw people out."], ['marcus', 'The rest is improvisation. Q if you need us.']]); }
    }
  };
  Gd.tutText = (G) => {
    const tu = G.tut;
    if (!tu || tu.done || !TUT[tu.i]) return null;
    return { title: 'TRAINING ' + (tu.i + 1) + '/' + TUT.length + ' · ' + TUT[tu.i].t, hint: TUT[tu.i].h + ' (J skips)', s: tu.s };
  };

  /* ================= per-frame ================= */
  let lastPrompt = '', lastKit = '', lastAura = null, lastJobs = '';
  const KEYNAME = { CLICK: 'CLICK', HOLD: 'HOLD CLICK', SPACE: 'SPACE', LOOK: 'LOOK', E: 'E', X: 'X', B: 'B', Q: 'Q' };
  const TKEY = { CLICK: 'USE', HOLD: 'HOLD USE', SPACE: 'SHOVE', E: 'TALK', LOOK: 'LOOK', X: 'X', Q: 'RADIO' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let hb = false;
  Gd.update = (dt) => {
    const G = LC.G, p = G.player;
    if (!p) return;
    if (!hb) { hb = true; const el = $('hotbar'); el.style.pointerEvents = 'auto'; const go = (e) => { const b = e.target.closest('[data-k]'); if (b) { e.preventDefault(); LC.Fun.use(+b.dataset.k); } }; el.addEventListener('click', go); el.addEventListener('touchstart', go, { passive: false }); }
    const R3 = LC.R3;
    // vision: hold R
    const want = LC.Input.keys.has('KeyR') || LC.Input.vision ? 1 : 0;
    Gd.vision = U.damp(Gd.vision, want, 10, dt);
    if (R3 && R3.People) R3.People.glowFor = glowFor;
    if (want && !Gd.usedVision) { Gd.usedVision = true; LC.stat('roomReads'); }
    // reading the room notices trouble in view
    if (Gd.vision > 0.6) for (const inc of LC.Incidents.active) {
      if (inc.noticed || !inc.n || inc.n.hidden) continue;
      if (U.dist(p.x, p.y, inc.n.x, inc.n.y) < 520 && M.sight(p.x, p.y - 20, inc.n.x, inc.n.y - 20)) { const s = LC.R.toScreen(inc.n.x, inc.n.y, 30); if (!s.behind && s.x > 0 && s.x < LC.R.cw && s.y > 0 && s.y < LC.R.ch) LC.Incidents.notice(inc, 'sight'); }
    }
    document.body.classList.toggle('vision', Gd.vision > 0.3);
    // prompt panel
    const ctx = !G.dialog && p.ctx;
    const touch = document.body.classList.contains('touch');
    let html = '';
    if (ctx && ctx.acts && ctx.acts.length) {
      html = (ctx.title ? '<div class="pt ' + (ctx.tone || '') + '"><b>' + esc(ctx.title) + '</b>' + (ctx.sub ? '<span>' + esc(ctx.sub) + '</span>' : '') + '</div>' : '') +
        '<div class="pa">' + ctx.acts.map((a) => '<span><kbd>' + (touch ? TKEY[a.key] || a.key : KEYNAME[a.key] || a.key) + '</kbd>' + esc(a.label) + '</span>').join('') + '</div>';
    } else if (!G.dialog && G.t < 240 && !G.demo) html = '<div class="pa dim"><span><kbd>WASD</kbd>walk</span><span><kbd>MOUSE</kbd>look</span><span><kbd>R</kbd>read the room</span><span><kbd>H</kbd>help</span></div>';
    if (html !== lastPrompt) { lastPrompt = html; const el = $('prompt'); el.innerHTML = html; el.style.opacity = html ? 1 : 0; }
    // toolbar 1-5 + kit counts
    const tb = LC.Fun ? LC.Fun.TOOLS.map((t) => t.id + Math.ceil(LC.Fun.cooldown(t.id))).join() : '';
    const kit = JSON.stringify(p.inv) + tb;
    if (kit !== lastKit) {
      lastKit = kit;
      const ICON = { tape: '⛔', zone: '◎', horn: '📢', backup: '🛡', clear: '✖' };
      const tools = LC.Fun ? LC.Fun.TOOLS.map((t) => { const c = Math.ceil(LC.Fun.cooldown(t.id)); return '<div class="slot tool' + (c ? ' empty' : '') + '" data-k="' + t.k + '" title="' + t.name + ' — ' + t.hint + '"><span class="k">' + t.k + '</span><span class="ic">' + ICON[t.id] + '</span><span class="nm">' + t.name + '</span>' + (c ? '<span class="cd">' + c + '</span>' : '') + '</div>'; }).join('') : '';
      const items = [['water', 'Water'], ['aid', 'First aid'], ['sign', 'Wet floor signs'], ['zip', 'Zip ties (X)']];
      $('hotbar').innerHTML = tools + '<span class="sep"></span>' + items.map(([k, label]) => '<div class="slot' + (p.inv[k] <= 0 ? ' empty' : '') + '" title="' + label + '" data-ic="' + k + '"><span class="n">' + p.inv[k] + '</span></div>').join('');
      for (const d of $('hotbar').querySelectorAll('[data-ic]')) d.prepend(LC.HUD.icon(d.dataset.ic));
    }
    // aura
    const av = Math.round(G.aura || 0);
    if (av !== lastAura) { lastAura = av; $('auraVal').textContent = (av > 0 ? '+' : '') + av.toLocaleString(); $('auraRank').textContent = A.rank(av); $('aura').dataset.s = av < 0 ? 'neg' : av > 800 ? 'hi' : ''; }
    for (const q of A.pops) q.t += dt;
    while (A.pops.length && A.pops[0].t > 2.6) A.pops.shift();
    $('auraPops').innerHTML = A.pops.map((q) => '<div class="' + (q.n > 0 ? 'up' : 'down') + '" style="opacity:' + Math.min(1, (2.6 - q.t) * 2).toFixed(2) + '"><b>' + (q.n > 0 ? '+' : '') + q.n + ' AURA</b> ' + esc(q.reason) + '</div>').join('');
    // job hints under the objective list (training takes priority on the first night)
    Gd.tutTick(G);
    const jobs = Gd.jobs();
    const top = jobs[0], tut = Gd.tutText(G);
    const jk = tut ? 'T' + tut.title : top ? top.inc.id + Math.round(top.d / 32) : '';
    if (jk !== lastJobs) {
      lastJobs = jk;
      $('jobHint').innerHTML = tut ? '<b>' + esc(tut.title) + '</b><br><span>' + esc(tut.hint) + '</span>' : top ? '<b>NEXT:</b> ' + esc(top.inc.title) + ' · ' + Math.round(top.d / T) + ' m<br><span>' + esc(Gd.hint(top.inc)) + '</span>' : '';
      $('jobHint').hidden = !tut && !top;
    }
    drawMinimap(G, jobs);
  };

  /* ================= minimap ================= */
  let base = null;
  const MS = 5;   // px per tile on the base map
  function buildBase() {
    base = document.createElement('canvas');
    base.width = M.W * MS; base.height = M.H * MS;
    const g = base.getContext('2d');
    g.fillStyle = '#0d0b12'; g.fillRect(0, 0, base.width, base.height);
    const RC = { alley: '#1c1d24', street: '#2a2830', parking: '#1a1a20', kitchen: '#3a3e44', mens: '#3a4a52', womens: '#4a3a4a', bathhall: '#38343e', lounge: '#4a1c26', bar: '#4e321c', dj: '#3a2450', dance: '#3a2456', hall: '#2c2236', backstage: '#34343a', office: '#3a3226', vip: '#4a2a14', patio: '#3a2e26', lobby: '#4a2a36', chill: '#2e2450' };
    for (const r of M.rooms) { g.fillStyle = RC[r.id] || '#2a2a30'; for (const [x0, y0, x1, y1] of r.rects) g.fillRect(x0 * MS, y0 * MS, (x1 - x0) * MS, (y1 - y0) * MS); }
    g.strokeStyle = 'rgba(230,220,255,0.75)'; g.lineWidth = 1.6;
    for (const s of M.segs) { if (s.kind === 'door' || s.kind === 'rope' || s.kind === 'stall') continue; g.beginPath(); g.moveTo(s.ax / T * MS, s.ay / T * MS); g.lineTo(s.bx / T * MS, s.by / T * MS); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
    const LBL = { bar: 'BAR', dance: 'DANCE', vip: 'VIP', mens: 'WC', womens: 'WC', lobby: 'ENTRANCE', patio: 'SMOKING', backstage: 'BACK', kitchen: 'KITCHEN', lounge: 'BOOTHS', chill: 'CHILL', street: 'STREET' };
    for (const r of M.rooms) if (LBL[r.id]) { const [x0, y0, x1, y1] = r.rects[0]; g.fillText(LBL[r.id], (x0 + x1) / 2 * MS, (y0 + y1) / 2 * MS + 4); }
  }
  function drawMinimap(G, jobs) {
    const cv = $('minimap');
    if (!cv) return;
    if (!base) buildBase();
    const S = cv.width, h = S / 2, g = cv.getContext('2d'), p = G.player;
    const zoom = 1.0;    // base px -> minimap px
    const yaw = LC.R.is3D ? LC.R.lookAngle() : -Math.PI / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(h, h, h - 2, 0, 7); g.clip();
    g.fillStyle = '#07060b'; g.fillRect(0, 0, S, S);
    g.translate(h, h); g.rotate(-yaw - Math.PI / 2); g.scale(zoom, zoom);
    g.translate(-p.x / T * MS, -p.y / T * MS);
    g.drawImage(base, 0, 0);
    const wp = (x, y) => [x / T * MS, y / T * MS];
    // staff
    for (const c of G.npcs) { if (c.kind !== 'staff' && !c.police) continue; const [x, y] = wp(c.x, c.y); g.fillStyle = c.police ? '#4a7aff' : '#5ab8ff'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    // exits
    if (LC.Fun) for (const d of LC.Fun.exits()) { const [x, y] = wp(d.cx, d.cy); g.fillStyle = '#3dff8a'; g.fillRect(x - 5, y - 5, 10, 10); g.fillStyle = '#002a10'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('X', x, y + 3); }
    // vision shows the crowd
    if (Gd.vision > 0.3) for (const c of G.npcs) { if (c.kind !== 'guest' || c.state !== 'inside') continue; const cat = Gd.category(c); if (cat === 'fine') continue; const [x, y] = wp(c.x, c.y); g.fillStyle = cat === 'trouble' ? '#ff4d5a' : cat === 'love' ? '#ff6fb8' : cat === 'drunk' ? '#ffd23f' : '#ff9a3a'; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
    g.restore();
    // blips (clamped to the rim)
    const ca = Math.cos(-yaw - Math.PI / 2), sa = Math.sin(-yaw - Math.PI / 2);
    for (const j of jobs) {
      let dx = (j.x - p.x) / T * MS * zoom, dy = (j.y - p.y) / T * MS * zoom;
      let x = dx * ca - dy * sa, y = dx * sa + dy * ca;
      const d = Math.hypot(x, y), lim = h - 10;
      if (d > lim) { x *= lim / d; y *= lim / d; }
      const cat = CAT(j.inc);
      g.fillStyle = cat.c; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.arc(h + x, h + y, 7, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cat.g, h + x, h + y + 0.5);
    }
    // you
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(h, h - 8); g.lineTo(h + 6, h + 6); g.lineTo(h, h + 3); g.lineTo(h - 6, h + 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(h, h, h - 2, 0, 7); g.stroke();
  }

  /* ================= markers over known trouble (screen overlay) ================= */
  Gd.drawMarkers = (g) => {
    const G = LC.G, p = G.player, R = LC.R;
    if (!p || G.demo) return;
    const jobs = Gd.jobs();
    jobs.forEach((j, i) => {
      if (j.inc.n && j.inc.n.hidden && !j.inc.data.stall) return;
      const cat = CAT(j.inc);
      const e = R.edgePoint ? R.edgePoint(j.x, j.y, j.z + 62, 70) : (() => { const s = R.toScreen(j.x, j.y, j.z + 62); return { x: s.x, y: s.y, on: s.x > 0 && s.x < R.cw && s.y > 0 && s.y < R.ch, a: 0 }; })();
      const b = Math.sin(G.t * 4 + i) * 3;
      g.save();
      g.translate(e.x, e.y + (e.on ? b : 0));
      if (!e.on) g.rotate(e.a + Math.PI / 2);
      g.fillStyle = cat.c; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2;
      g.beginPath();
      if (e.on) { g.moveTo(0, 6); g.lineTo(-9, -6); g.lineTo(-5, -12); g.lineTo(5, -12); g.lineTo(9, -6); }
      else { g.moveTo(0, -14); g.lineTo(10, 6); g.lineTo(-10, 6); }
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      if (i < 3) {
        g.font = '800 12px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillStyle = cat.c;
        const label = (i === 0 ? '▶ ' : '') + j.inc.title.slice(0, 26) + ' · ' + Math.round(j.d / T) + 'm';
        const lx = e.on ? e.x : U.clamp(e.x, 90, R.cw - 90), ly = e.on ? e.y - 18 + b : U.clamp(e.y + (e.y > R.ch / 2 ? -22 : 26), 16, R.ch - 10);
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(label, lx, ly); g.fillText(label, lx, ly);
      }
    });
    const tut = Gd.tutText(G);
    if (tut && tut.s) {
      const s0 = tut.s;
      const tx = s0.n ? s0.n.x : s0.x, ty = s0.n ? s0.n.y : s0.y;
      if (tx !== undefined && !(s0.n && s0.n.gone)) {
        const e = R.edgePoint ? R.edgePoint(tx, ty, 70, 70) : R.toScreen(tx, ty, 70);
        const b = Math.sin(G.t * 5) * 4;
        g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2;
        g.beginPath(); g.arc(e.x, e.y + b, 11, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#111'; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', e.x, e.y + b + 1); g.textBaseline = 'alphabetic';
      }
    }
    // vision label
    if (Gd.vision > 0.3) {
      g.globalAlpha = Gd.vision; g.font = '900 15px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('READING THE ROOM — red: trouble · yellow: drunk · pink: romance · orange: angry · blue: staff', R.cw / 2, 92);
      g.globalAlpha = 1;
    }
  };
})();
