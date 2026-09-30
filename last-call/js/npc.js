/* Last Call — guests. Each person has traits, needs and a sobriety level; behaviour runs as
   generator "tasks" (get a drink, dance, queue for the toilet...) that can be pre-empted by
   "overrides" (being stared at, talked to, knocked over, dragged outside). */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph, W: Wd, People: Pp } = LC;
  const T = M.T, S = M.S, P = M.P;
  const N = (LC.NPC = {});
  const L = () => LC.Lines;

  /* ---------------- creation ---------------- */
  function traits(o = {}) {
    const r = () => U.clamp(0.5 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.62, 0, 1);
    const t = {
      confidence: r(), aggression: r() * 0.85, embarrassment: r(), loyalty: r(), commonSense: r(), social: r(),
      energy: r(), attraction: r(), ego: r(), fear: r(), angryDrunk: Math.random(),
    };
    if (Math.random() < 0.13) t.commonSense = U.rand(0, 0.12);
    return Object.assign(t, o);
  }
  N.traits = traits;

  N.create = (o = {}) => {
    const G = LC.G;
    const fem = o.fem !== undefined ? o.fem : Math.random() < 0.5;
    const look = o.look || Pp.randomLook({ fem });
    const n = {
      id: U.uid(), kind: o.kind || 'guest', role: o.role || null, name: o.name || Pp.randomName(fem), fem, look,
      x: o.x, y: o.y, z: 0, face: Math.PI / 2, back: false, pose: 'stand', act: null, expr: 'neutral',
      t: Math.random() * 10, walk: 0, beat: 0, danceStyle: U.randi(0, 4), energy: 0.6, seed: Math.random() * 100,
      voice: fem ? U.rand(1.15, 1.5) : U.rand(0.72, 1.02),
      tr: traits(o.tr), needs: { drink: U.rand(0.3, 0.8), dance: U.rand(0.1, 0.6), pee: U.rand(0, 0.25), rest: U.rand(0, 0.15), smoke: U.rand(0, 0.5), social: U.rand(0.1, 0.5) },
      mood: { anger: 0, fear: 0, shame: 0, joy: 0.3 },
      sob: o.sob !== undefined ? o.sob : Math.random() < 0.12 ? U.rand(0.45, 0.62) : U.rand(0.74, 1),
      group: null, perm: o.perm || P.OUT, state: o.state || 'arriving',
      nav: { path: null, i: 0, status: 'idle', gx: 0, gy: 0, speed: 80, stuckT: 0, lx: 0, ly: 0, perm: 0, arrive: 8, gen: 0, t0: 0, timeout: 60 },
      task: null, taskName: '', override: null, overrideName: '', overridePri: 0,
      bubble: null, emote: null, drink: null, carry: null, seat: null,
      warnings: 0, incident: null, smoker: Math.random() < 0.27, speed: U.rand(64, 90),
      wristband: true, vip: false, regular: null, injured: 0, daze: 0, asleep: false,
      bumpT: 0, lastTalkT: -99, thinkT: U.rand(0, 1), blinkT: U.rand(1, 4), blink: false, nextSip: 0, drinksHad: 0,
      coat: Math.random() < 0.3, coatChecked: false, arrivedAt: G ? G.clock : 0, noticed: 0, flags: {},
    };
    Object.assign(n, o.extra || {});
    n.body = Ph.add({ x: o.x, y: o.y, r: 7.6 * look.build + 0.8, m: 6 * look.build, fric: 9, kind: 'char', ent: n });
    G.npcs.push(n);
    G.chars.push(n);
    return n;
  };
  N.remove = (n) => {
    const G = LC.G;
    if (n.gone) return;
    if (n.running) { n.removeMe = true; return; }
    if (n.task) try { n.task.return(); } catch (e) { /* cleanup */ }
    if (n.override) try { n.override.return(); } catch (e) { /* cleanup */ }
    N.standUp(n);
    if (n.carry) N.drop(n);
    Ph.remove(n.body);
    let i = G.npcs.indexOf(n); if (i >= 0) G.npcs.splice(i, 1);
    i = G.chars.indexOf(n); if (i >= 0) G.chars.splice(i, 1);
    if (n.group) { const j = n.group.members.indexOf(n); if (j >= 0) n.group.members.splice(j, 1); }
    n.state = 'gone';
    n.gone = true;
  };

  /* ---------------- effective traits ---------------- */
  N.drunk = (n) => 1 - n.sob;
  N.cs = (n) => n.tr.commonSense * (0.35 + 0.65 * n.sob);
  N.aggr = (n) => U.clamp(n.tr.aggression + (1 - n.sob) * n.tr.angryDrunk * 0.45 + n.mood.anger * 0.5, 0, 1.5);
  N.busy = (n) => !!n.override || (n.task && n.taskPri > 1);

  /* ---------------- speech ---------------- */
  function slur(s, d) {
    if (d < 0.55) return s;
    let out = s;
    if (d > 0.62) out = out.replace(/s(?=[aeiou ])/g, (m) => (Math.random() < 0.5 ? 'sh' : m));
    if (d > 0.75) out = out.replace(/([aeiou])/, '$1$1$1');
    if (d > 0.85 && Math.random() < 0.5) out = out.replace(/ /, '... ');
    return out;
  }
  N.say = (n, text, o = {}) => {
    const G = LC.G;
    if (!text || n.gone) return;
    const t = o.noSlur || n.kind !== 'guest' ? text : slur(text, 1 - n.sob);
    n.bubble = { text: t, t0: G.t, dur: o.dur || 1.5 + t.length * 0.055, kind: o.kind || 'say', pri: o.pri || 0, dim: !!o.dim };
    if (!o.silent && LC.Audio && LC.Audio.ready) LC.Audio.voice(n, t, o.kind === 'shout');
  };
  N.shout = (n, text, o = {}) => N.say(n, text, Object.assign({ kind: 'shout', pri: 1 }, o));
  N.emote = (n, kind, dur = 2) => { n.emote = { kind, t0: LC.G.t, dur }; };
  N.faceTo = (n, x, y) => { n.face = Math.atan2(y - n.y, x - n.x); };

  /* ---------------- navigation ---------------- */
  N.goTo = (n, x, y, o = {}) => {
    const nav = n.nav, G = LC.G;
    nav.gx = x; nav.gy = y;
    nav.speed = o.speed || n.speed * (o.hurry ? 1.6 : 1);
    nav.arrive = o.arrive || 8;
    nav.perm = o.perm || n.perm;
    nav.avoidDance = !!o.avoidDance;
    nav.path = M.path(n.body.x, n.body.y, x, y, nav.perm, { avoidDance: nav.avoidDance });
    nav.i = 0; nav.stuckT = 0; nav.stuck = 0; nav.lx = n.body.x; nav.ly = n.body.y;
    nav.status = nav.path && nav.path.length ? 'moving' : 'failed';
    nav.t0 = G.t; nav.timeout = o.timeout || 70;
    nav.gen++;
    return nav.status !== 'failed';
  };
  N.stop = (n) => { n.nav.status = 'idle'; n.nav.path = null; };
  // walk somewhere; resumes by itself if an override interrupted the walk
  function* go(n, x, y, o = {}) {
    if (!N.goTo(n, x, y, o)) return false;
    let gen = n.nav.gen, retries = 0;
    for (;;) {
      const st = n.nav.status;
      if (st === 'arrived') return true;
      if (st === 'failed') return false;
      if (st === 'idle' || n.nav.gen !== gen) {
        if (retries++ > 6) return false;
        if (!N.goTo(n, x, y, o)) return false;
        gen = n.nav.gen;
      }
      yield;
    }
  }
  N.go = go;
  function* wait(n, secs, each) {
    let t = 0;
    while (t < secs) { t += LC.G.dt; if (each && each(t) === false) return false; yield; }
    return true;
  }
  N.wait = wait;
  N.within = (n, x, y, r) => U.dist2(n.x, n.y, x, y) < r * r;

  function steer(n, dt) {
    const b = n.body, nav = n.nav, G = LC.G;
    let dvx = 0, dvy = 0;
    if (n.frozen) { nav.stuckT = 0; nav.t0 += dt; }
    else if (nav.status === 'moving') {
      const p = nav.path;
      let wp = p[nav.i];
      let dx = wp.x - b.x, dy = wp.y - b.y, d = Math.hypot(dx, dy);
      let last = nav.i === p.length - 1;
      if (d < (last ? nav.arrive : 13)) {
        if (last) nav.status = 'arrived';
        else { nav.i++; wp = p[nav.i]; dx = wp.x - b.x; dy = wp.y - b.y; d = Math.hypot(dx, dy); last = nav.i === p.length - 1; }
      }
      if (nav.status === 'moving') {
        let sp = nav.speed;
        if (last && d < 36) sp *= Math.max(0.35, d / 36);
        dvx = (dx / (d || 1)) * sp; dvy = (dy / (d || 1)) * sp;
        nav.stuckT += dt;
        if (nav.stuckT > 1.3) {
          const moved = Math.hypot(b.x - nav.lx, b.y - nav.ly);
          if (moved < 9) {
            nav.stuck++;
            if (nav.stuck > 5) nav.status = 'failed';
            else {
              nav.path = M.path(b.x, b.y, nav.gx, nav.gy, nav.perm, { avoidDance: nav.avoidDance });
              nav.i = 0;
              if (!nav.path || !nav.path.length) nav.status = 'failed';
              b.vx += U.rand(-70, 70); b.vy += U.rand(-70, 70);
            }
          } else nav.stuck = 0;
          nav.stuckT = 0; nav.lx = b.x; nav.ly = b.y;
        }
        if (G.t - nav.t0 > nav.timeout) nav.status = 'failed';
      }
    }
    // walking confidently while obviously drunk
    const dr = 1 - n.sob;
    if (dr > 0.35 && (dvx || dvy)) {
      const w = Math.sin(n.t * 2.2 + n.seed) * (dr - 0.35) * 1.2;
      const c = Math.cos(w), s = Math.sin(w);
      const k = 1 - dr * 0.25;
      const nx = (dvx * c - dvy * s) * k, ny = (dvx * s + dvy * c) * k;
      dvx = nx; dvy = ny;
      if (Math.random() < dt * (dr - 0.35) * 0.5) { b.vx += U.rand(-80, 80); b.vy += U.rand(-80, 80); }
    }
    n.dvx = dvx; n.dvy = dvy;
    const acc = Math.min(1, (n.accel || 9) * dt);
    b.vx += (dvx - b.vx) * acc; b.vy += (dvy - b.vy) * acc;
  }

  /* ---------------- per-frame animation state ---------------- */
  function animate(n, dt) {
    const G = LC.G, b = n.body;
    n.t += dt;
    if (n.seat && n.seat.prop) { b.x = n.seat.prop.body.x; b.y = n.seat.prop.body.y; }
    n.x = b.x; n.y = b.y;
    const sp = Math.hypot(b.vx, b.vy);
    if (!n.poseLock) {
      if (sp > 18 && !n.seat && !n.act_keepWhileMoving) { n.pose = sp > 150 ? 'run' : 'walk'; n.walk += sp * dt * 0.1; }
      else n.pose = n.act || 'stand';
      if (n.pose === 'stand' && n.drink && n.sip > 0) n.pose = 'drink';
    }
    if (!n.faceLock && sp > 14 && !n.seat) {
      const a = Math.atan2(b.vy, b.vx);
      n.face += U.angDiff(n.face, a) * Math.min(1, dt * 10);
    }
    n.back = Math.sin(n.face) < -0.45 && !n.seat;
    n.drunk = 1 - n.sob;
    n.beat = G.music.beatPhase || 0;
    n.energy = 0.4 + n.tr.energy * 0.8;
    n.blinkT -= dt;
    if (n.blinkT < 0) { n.blink = !n.blink; n.blinkT = n.blink ? 0.12 : U.rand(2, 5); }
    if (n.sip > 0) n.sip -= dt;
    if (n.bubble && G.t - n.bubble.t0 > n.bubble.dur) n.bubble = null;
    if (n.emote && G.t - n.emote.t0 > n.emote.dur) n.emote = null;
    // resting face follows mood unless something set it
    if (!n.exprLock) {
      let e = 'neutral';
      const dr = 1 - n.sob;
      if (n.asleep) e = 'sleep';
      else if (n.mood.anger > 0.6) e = n.mood.anger > 0.85 ? 'furious' : 'angry';
      else if (n.mood.fear > 0.6) e = 'scared';
      else if (n.mood.shame > 0.6) e = 'embarrassed';
      else if (dr > 0.86) e = 'wasted';
      else if (dr > 0.62) e = 'drunk';
      else if (n.bubble && G.t - n.bubble.t0 < n.bubble.dur - 0.3) e = n.bubble.kind === 'shout' ? 'shout' : 'talk';
      else if (n.act === 'dance') e = n.mood.joy > 0.5 || (n.seed | 0) % 3 === 0 ? 'happy' : 'neutral';
      else if (n.mood.joy > 0.7) e = 'happy';
      n.expr = e;
    }
  }

  /* ---------------- needs + drinking ---------------- */
  function tickNeeds(n, dt) {
    const G = LC.G, nd = n.needs, k = dt / 60;
    const mE = G.music.stopped ? 0 : G.music.energy || 0.5;
    nd.drink = U.clamp(nd.drink + k * (0.2 + (1 - n.sob) * 0.12) * (n.drink ? 0.15 : 1), 0, 1);
    nd.dance = U.clamp(nd.dance + k * 0.16 * (0.5 + n.tr.energy) * (0.4 + mE), 0, 1);
    nd.pee = U.clamp(nd.pee + k * (0.05 + n.drinksHad * 0.022), 0, 1);
    nd.rest = U.clamp(nd.rest + k * 0.05 * (n.act === 'dance' ? 3 : 1) * (1.5 - n.tr.energy), 0, 1);
    if (n.smoker) nd.smoke = U.clamp(nd.smoke + k * 0.3, 0, 1);
    nd.social = U.clamp(nd.social + k * 0.1, 0, 1);
    n.sob = U.clamp(n.sob + dt * 0.00035, 0, 1);
    n.mood.anger = Math.max(0, n.mood.anger - dt * 0.025);
    n.mood.fear = Math.max(0, n.mood.fear - dt * 0.04);
    n.mood.shame = Math.max(0, n.mood.shame - dt * 0.03);
    n.mood.joy = U.damp(n.mood.joy, n.act === 'dance' ? 0.8 : 0.35, 0.05, dt);
    if (n.bumpT > 0) n.bumpT -= dt;
    // sip
    if (n.drink && G.t > n.nextSip && !n.override && !n.asleep) {
      n.nextSip = G.t + U.rand(5, 12) * (0.7 + n.sob * 0.6);
      const d = n.drink;
      const gulp = d.shot ? 1 : 0.15;
      d.fill -= gulp;
      n.sip = 0.8;
      n.drinksHad += gulp;
      if (d.water) n.sob = U.clamp(n.sob + 0.035, 0, 1);
      else n.sob = U.clamp(n.sob - (d.strength || 0.1) * gulp, 0, 1);
      if (d.fill <= 0.02) N.finishDrink(n);
    }
    // being very drunk has consequences
    const dr = 1 - n.sob;
    if (dr > 0.74 && !n.override && n.state === 'inside' && Math.random() < dt * (dr - 0.74) * 0.045 * (LC.Director ? LC.Director.chaos() : 1)) {
      if (LC.Director && LC.Director.allow('vomit')) N.interrupt(n, oVomit(n), 'vomit', 6);
    }
  }
  N.giveDrink = (n, d) => {
    const drink = d || Wd.randomDrink();
    n.drink = { c: drink.c, fill: 1, water: !!drink.water, shot: drink.name === 'shot', strength: drink.water ? 0 : drink.name === 'shot' ? 0.05 : drink.name === 'beer' ? 0.07 : 0.1, name: drink.name };
    n.nextSip = LC.G.t + U.rand(2, 5);
    n.needs.drink = 0;
  };
  N.finishDrink = (n) => {
    n.drink = null;
    const tbl = Wd.nearestProp(n.x, n.y, 56, (p) => p.kind === 'table' && !p.fallen && p.glasses < 4);
    if (tbl && Math.random() < 0.45 + N.cs(n) * 0.5) { tbl.glasses++; return; }
    const dr = 1 - n.sob;
    const r = Math.random();
    if (r < 0.1 + dr * 0.3) Wd.breakGlass(n.x + U.rand(-8, 8), n.y + 5, { vol: 0.8 });
    else if (r < 0.35 + dr * 0.3) Wd.addMess('trash', n.x + U.rand(-8, 8), n.y + U.rand(-2, 8), { r: 8 });
  };
  N.spillDrink = (n, dir = 0, force = 1) => {
    if (!n.drink) return;
    const d = n.drink;
    const x = n.x + Math.cos(dir) * 14 * force, y = n.y + Math.sin(dir) * 10 * force;
    Wd.spill(x, y, d.c, 0.6 + d.fill * 0.8);
    if (Math.random() < 0.3 * force) { Wd.breakGlass(x, y, {}); n.drink = null; }
    else d.fill = Math.max(0, d.fill - 0.5);
    if (n.drink && d.fill <= 0) n.drink = null;
  };

  /* ---------------- overrides ---------------- */
  // A generator can't be closed while it is the one running, so changes a person requests
  // from inside their own task or override are queued and applied after the step.
  N.interrupt = (n, gen, name, pri = 5) => {
    if (n.gone) return false;
    const cur = n.pending ? n.pending.pri : n.override && !n.pendingEnd ? n.overridePri : -1;
    if (cur > pri) return false;
    if (n.running) { n.pending = { gen, name, pri }; return true; }
    if (n.override) { const o = n.override; n.override = null; try { o.return(); } catch (e) { /* closed */ } }
    n.override = gen; n.overrideName = name; n.overridePri = pri;
    N.stop(n);
    return true;
  };
  N.endOverride = (n) => {
    if (n.running) { n.pendingEnd = true; return; }
    if (!n.override) return;
    const o = n.override;
    n.override = null; n.overrideName = ''; n.overridePri = 0;
    try { o.return(); } catch (e) { /* closed */ }
  };
  N.setTask = (n, gen, name, pri = 1) => {
    if (n.running) { n.pendingTask = { gen, name, pri }; return; }
    if (n.task) { const t = n.task; n.task = null; try { t.return(); } catch (e) { /* closed */ } }
    n.task = gen; n.taskName = name; n.taskPri = pri;
    n.act = null;
  };
  N.cancelTask = (n) => {
    if (n.running) { n.pendingCancel = true; return; }
    if (n.task) { const t = n.task; n.task = null; try { t.return(); } catch (e) { /* closed */ } }
    n.taskName = ''; n.taskPri = 0; n.act = null;
  };
  function applyPending(n) {
    if (n.pendingEnd) { n.pendingEnd = false; N.endOverride(n); }
    if (n.pendingCancel) { n.pendingCancel = false; N.cancelTask(n); }
    if (n.pendingTask) { const p = n.pendingTask; n.pendingTask = null; N.setTask(n, p.gen, p.name, p.pri); }
    if (n.pending) { const p = n.pending; n.pending = null; N.interrupt(n, p.gen, p.name, p.pri); }
  }

  /* ---------------- seats ---------------- */
  N.findSeat = (n, o = {}) => {
    const rooms = o.rooms || ['lounge', 'chill', 'patio', 'lobby', 'bar'];
    const cands = [];
    for (const s of S.seats) {
      if (s.occ || s.staff || (s.vip && !n.vip && !o.anyVip) || !rooms.includes(s.room)) continue;
      cands.push({ s, x: s.x, y: s.y, z: s.z || 6, d: U.dist(n.x, n.y, s.x, s.y) });
    }
    for (const p of Wd.props) {
      if (!(p.kind === 'chair' || p.kind === 'stool' || p.kind === 'beanbag') || p.occ || p.fallen || p.carriedBy || p.broken) continue;
      const r = M.roomAt(p.body.x, p.body.y);
      if (!r || !rooms.includes(r.id)) continue;
      cands.push({ s: p, prop: p, x: p.body.x, y: p.body.y, z: p.kind === 'stool' ? 15 : p.kind === 'chair' ? 9 : 3, d: U.dist(n.x, n.y, p.body.x, p.body.y) });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    return U.pick(cands.slice(0, 5));
  };
  N.sitDown = (n, seat) => {
    n.seat = seat;
    seat.s.occ = n;
    const b = n.body;
    b.ghost = true; b.pinned = true; b.vx = 0; b.vy = 0;
    b.x = seat.x; b.y = seat.y + (seat.prop ? 1 : 0);
    n.z = seat.z; n.act = 'sit'; n.face = Math.PI / 2;
    if (seat.prop) seat.prop.occ = n, seat.prop.body.pinned = false;
  };
  N.standUp = (n) => {
    if (!n.seat) return;
    const seat = n.seat;
    if (seat.s.occ === n) seat.s.occ = null;
    n.seat = null;
    const b = n.body;
    b.ghost = false; b.pinned = false;
    const f = M.nearest(b.x, b.y + 16, P.ALL, 3);
    if (f && U.dist(f.x, f.y, b.x, b.y) < 60) { b.x = U.lerp(b.x, f.x, 0.6); b.y = b.y + 14; }
    else b.y += 14;
    n.z = 0; if (n.act === 'sit') n.act = null;
  };

  /* ---------------- carrying ---------------- */
  N.pickUp = (n, p) => {
    if (p.carriedBy) return false;
    if (p.occ) { N.knockDown(p.occ, 0, 0.5); }
    p.carriedBy = n; p.mounted = false; p.fallen = 0; p.body.pinned = false;
    n.carry = p;
    return true;
  };
  N.drop = (n, place) => {
    const p = n.carry;
    if (!p) return null;
    p.carriedBy = null; n.carry = null;
    p.body.ghost = false;
    const fx = n.x + Math.cos(n.face) * 16, fy = n.y + Math.sin(n.face) * 12;
    const spot = place || (Ph.free(fx, fy, p.body.r) ? { x: fx, y: fy } : M.nearest(fx, fy, P.ALL, 2) || { x: n.x, y: n.y + 12 });
    p.body.x = spot.x; p.body.y = spot.y; p.body.vx = 0; p.body.vy = 0;
    return p;
  };

  /* ---------------- falls & slips ---------------- */
  function* oFallen(n, dir, force, slip) {
    N.standUp(n);
    if (n.carry) { const p = N.drop(n); if (p && Math.random() < 0.5) Wd.tip(p, dir, 1); }
    if (n.drink) N.spillDrink(n, dir, 1.4);
    n.poseLock = true; n.pose = 'fallen'; n.fallSide = Math.cos(dir) >= 0 ? 1 : -1; n.fallK = 0;
    n.exprLock = true; n.expr = slip ? 'shock' : 'ko';
    n.noSteer = true;
    const b = n.body;
    b.vx += Math.cos(dir) * 120 * force; b.vy += Math.sin(dir) * 90 * force;
    try {
      let t = 0;
      while (t < 0.22) { t += LC.G.dt; n.fallK = Math.min(1, t / 0.22); yield; }
      n.fallK = 1;
      LC.sfx('thud', n.x, n.y, { vol: 0.8 });
      const lie = (1.3 + (1 - n.sob) * 3) * force * (n.injured > 0.5 ? 2 : 1);
      n.expr = (1 - n.sob) > 0.8 ? 'wasted' : slip ? 'embarrassed' : 'ko';
      yield* wait(n, lie);
      // very drunk people sometimes just stay down
      if ((1 - n.sob) > 0.85 && LC.G.clock > 180 && Math.random() < 0.3 && LC.Director) {
        n.poseLock = true;
        LC.Director.sleeper(n, 'floor');
        return;
      }
      t = 0;
      while (t < 0.35) { t += LC.G.dt; n.fallK = 1 - t / 0.35; yield; }
      if (slip && Math.random() < 0.5) N.say(n, U.pick(L().slipGetUp), { pri: 1 });
    } finally {
      n.poseLock = false; n.exprLock = false; n.noSteer = false; n.fallK = 0;
      if (n.pose === 'fallen' && !n.asleep) n.pose = 'stand';
    }
  }
  N.oFallen = oFallen;
  N.knockDown = (n, dir, force = 1) => {
    if (n.kind === 'player') { if (LC.Player) LC.Player.knockDown(dir, force); return; }
    if (n.asleep) return;
    N.interrupt(n, oFallen(n, dir, force, false), 'fallen', 8);
  };
  N.slip = (n) => {
    const b = n.body;
    const dir = Math.atan2(b.vy, b.vx);
    LC.stat('slips');
    LC.sfx('slip', n.x, n.y);
    N.emote(n, '!', 1);
    if (N.interrupt(n, oFallen(n, dir, 1.1, true), 'fallen', 8)) {
      b.vx *= 1.7; b.vy *= 1.7;
      if (LC.Director) LC.Director.onSlip(n);
    }
  };
  function slipCheck(n, dt) {
    if (n.overrideName === 'fallen' || n.seat || n.z > 0 || n.body.ghost) return;
    const b = n.body, sp = Math.hypot(b.vx, b.vy);
    if (sp < 50) return;
    const m = Wd.slipAt(b.x, b.y);
    if (!m) return;
    const p = dt * m.def.slip * (sp / 100) * (0.4 + (1 - n.sob) * 1.6) * 1.3;
    if (Math.random() < p) N.slip(n);
  }

  /* ---------------- vomiting ---------------- */
  function* oVomit(n) {
    N.standUp(n);
    n.exprLock = true; n.expr = 'sick';
    N.emote(n, 'sick', 2.5);
    try {
      yield* wait(n, 1.2);
      // aim for a toilet if one is close. It never is.
      n.poseLock = true; n.pose = 'vomit';
      LC.sfx('vomit', n.x, n.y);
      const dir = n.face;
      const vx = n.x + Math.cos(dir) * 16, vy = n.y + Math.sin(dir) * 9 + 6;
      const inStall = S.stalls.some((s) => s.occ.includes(n) && U.dist(s.x, s.y, n.x, n.y) < 40);
      if (!inStall) {
        Wd.addMess('vomit', vx, vy, { r: 13 + Math.random() * 6 });
        LC.stat('vomits');
        if (LC.Director) LC.Director.onVomit(n, vx, vy);
      }
      for (let i = 0; i < 8; i++) Wd.part('drop', vx, vy, { z: 18, vx: Math.cos(dir) * 60 + U.rand(-30, 30), vy: Math.sin(dir) * 40 + U.rand(-20, 20), vz: 40, c: [180, 170, 80] });
      yield* wait(n, 1.6);
      n.sob = U.clamp(n.sob + 0.12, 0, 1);
      n.poseLock = false;
      n.expr = 'sad';
      if (Math.random() < 0.6) N.say(n, U.pick(L().afterVomit), { pri: 1 });
      yield* wait(n, 1.2);
    } finally { n.exprLock = false; n.poseLock = false; }
  }
  N.oVomit = oVomit;

  /* ---------------- activities ---------------- */
  function claimBarSpot(n) {
    let best = null, bd = 1e9;
    for (const s of S.bar) {
      if (s.occ) continue;
      const d = U.dist(n.x, n.y, s.x, s.y) + Math.random() * 60;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) best.occ = n;
    return best;
  }
  function* tDrink(n) {
    const G = LC.G;
    const spot = claimBarSpot(n);
    if (!spot) {
      const s = U.pick(S.bar);
      yield* go(n, s.x + U.rand(-14, 14), s.y + U.rand(30, 64), { avoidDance: true });
      n.act = 'stand'; N.faceTo(n, s.x, s.y - 40);
      yield* wait(n, U.rand(3, 6));
      if (Math.random() < 0.3) N.say(n, U.pick(L().barCrowd), { dim: true });
      return;
    }
    try {
      const ok = yield* go(n, spot.x, spot.y, { arrive: 5, avoidDance: true });
      if (!ok) return;
      n.act = 'stand'; n.face = -Math.PI / 2;
      spot.waiting = n; spot.waitT = G.t;
      let t = 0;
      while (!n.drink && t < 35) {
        t += G.dt;
        if (t > 14 && Math.random() < G.dt * 0.08) N.say(n, U.pick(L().barWait), { dim: true });
        yield;
      }
      if (n.drink && Math.random() < 0.06 && (1 - n.sob) > 0.4 && LC.Director) LC.Director.maybeTwelveWaters(n);
      yield* wait(n, U.rand(1, 3));
    } finally {
      if (spot.occ === n) spot.occ = null;
      if (spot.waiting === n) spot.waiting = null;
    }
  }
  N.tDrink = tDrink;

  N.danceSpot = (n, near) => {
    if (near) {
      for (let k = 0; k < 8; k++) {
        const x = near.x + U.rand(-40, 40), y = near.y + U.rand(-30, 30);
        if (M.onLED(x, y)) return { x, y };
      }
    }
    return U.pick(S.dance);
  };
  function* tDance(n, near) {
    const G = LC.G;
    const spot = N.danceSpot(n, near);
    const ok = yield* go(n, spot.x + U.rand(-8, 8), spot.y + U.rand(-6, 6), { arrive: 12 });
    if (!ok) return;
    n.act = 'dance';
    n.danceStyle = (1 - n.sob) > 0.7 && Math.random() < 0.5 ? 5 : U.randi(0, 4);
    const dur = U.rand(22, 75) * (0.6 + n.tr.energy);
    let t = 0;
    while (t < dur) {
      t += G.dt;
      n.needs.dance = Math.max(0, n.needs.dance - G.dt * 0.014);
      if (Math.random() < G.dt * 0.25) n.face = U.rand(0, Math.PI * 2);
      // dancing moves you around, drunk dancing moves everyone around
      if (Math.random() < G.dt * (0.35 + (1 - n.sob) * 0.8)) {
        const k = 25 + (1 - n.sob) * 60 + n.tr.energy * 20;
        n.body.vx += U.rand(-k, k); n.body.vy += U.rand(-k, k) * 0.7;
      }
      if (G.music.stopped || G.music.hijacked && Math.random() < G.dt * 0.08) break;
      if (Math.random() < G.dt * 0.02) N.emote(n, 'music', 1.5);
      yield;
    }
    n.act = null;
  }
  N.tDance = tDance;

  function bathQueueSpot(room, i) {
    return room === 'mens' ? { x: (10 + (i % 4) * 0.9) * T, y: (25 + ((i / 4) | 0) * 0.9) * T } : { x: (9 + (i % 4) * 0.9) * T, y: (33 + ((i / 4) | 0) * 0.9) * T };
  }
  function* tPee(n) {
    const G = LC.G;
    let room = n.fem ? 'womens' : 'mens';
    if ((1 - n.sob) > 0.7 && Math.random() < 0.06) room = room === 'mens' ? 'womens' : 'mens';
    // urinal
    if (room === 'mens' && !n.fem && Math.random() < 0.8) {
      const u = S.urinals.find((u) => !u.occ);
      if (u) {
        u.occ = n;
        try {
          const ok = yield* go(n, u.x, u.y + 10, { arrive: 5, avoidDance: true });
          if (ok) { n.act = 'stand'; n.face = -Math.PI / 2; yield* wait(n, U.rand(5, 10)); n.needs.pee = 0; }
        } finally { u.occ = null; }
        yield* washHands(n, room);
        return;
      }
    }
    let stall = null, waited = 0, qi = U.randi(0, 7);
    while (!stall) {
      stall = S.stalls.find((s) => s.room === room && s.occ.length === 0 && !s.locked);
      if (stall) break;
      const q = bathQueueSpot(room, qi);
      yield* go(n, q.x, q.y, { arrive: 10, avoidDance: true });
      n.act = 'stand';
      yield* wait(n, 2);
      waited += 2;
      if (waited === 20 || waited === 40) { N.say(n, U.pick(L().bathQueue), { dim: waited < 40 }); if (waited === 40) LC.stat('customerComplaints'); }
      if (waited > 70) return;
    }
    stall.occ.push(n);
    const door = M.door(stall.door);
    try {
      let ok = yield* go(n, stall.front.x, stall.front.y, { arrive: 10, avoidDance: true });
      if (!ok) return;
      door.target = 1;
      ok = yield* go(n, stall.x, stall.y, { arrive: 7 });
      if (!ok) return;
      door.target = 0; door.occupants = stall.occ.length; door.flipFeet = room === 'womens';
      n.act = 'stand'; n.face = room === 'womens' ? -Math.PI / 2 : Math.PI / 2;
      yield* wait(n, U.rand(7, 15));
      n.needs.pee = 0;
      if ((1 - n.sob) > 0.7 && Math.random() < 0.3) { yield* oVomit(n); }
      door.target = 1;
      yield* wait(n, 0.4);
      yield* go(n, stall.front.x, stall.front.y, { arrive: 10 });
    } finally {
      const i = stall.occ.indexOf(n);
      if (i >= 0) stall.occ.splice(i, 1);
      door.occupants = stall.occ.length;
      if (!stall.occ.length) door.target = 1;
    }
    yield* washHands(n, room);
  }
  function* washHands(n, room) {
    if (Math.random() > 0.55 * (0.4 + N.cs(n))) return;
    const sink = U.pick(S.sinks.filter((s) => s.room === room));
    if (!sink) return;
    const ok = yield* go(n, sink.x, sink.y, { arrive: 8 });
    if (!ok) return;
    n.act = 'stand'; n.face = 0;
    yield* wait(n, U.rand(2, 4));
    if (Math.random() < 0.02 && LC.Director) LC.Director.sinkLeft(n, sink);
    if (Math.random() < 0.1) N.say(n, U.pick(L().mirror), { dim: true });
  }
  N.tPee = tPee;

  function* tSit(n, o = {}) {
    const G = LC.G;
    const seat = N.findSeat(n, o);
    if (!seat) { yield* tWander(n); return; }
    seat.s.occ = n;
    try {
      const ok = yield* go(n, seat.x, seat.y + 16, { arrive: 14, avoidDance: true });
      if (!ok || (seat.s.occ && seat.s.occ !== n)) return;
      N.sitDown(n, seat);
      const dur = o.dur || U.rand(20, 60);
      let t = 0;
      while (t < dur) {
        t += G.dt;
        n.needs.rest = Math.max(0, n.needs.rest - G.dt * 0.02);
        if ((1 - n.sob) > 0.8 && G.clock > 150 && Math.random() < G.dt * 0.02 && LC.Director && LC.Director.allow('sleeper')) {
          LC.Director.sleeper(n, 'seat');
          return;
        }
        if (Math.random() < G.dt * 0.03) N.say(n, U.pick(L().chatter), { dim: true });
        yield;
      }
    } finally {
      if (!n.asleep) N.standUp(n);
      if (seat.s.occ === n && !n.asleep) seat.s.occ = null;
    }
  }
  N.tSit = tSit;

  function* tSmoke(n) {
    const G = LC.G;
    const spot = U.pick(S.smoke);
    const ok = yield* go(n, spot.x, spot.y, { arrive: 10, avoidDance: true });
    if (!ok) return;
    n.act = 'smoke'; n.smoking = true;
    try {
      const dur = U.rand(22, 45);
      let t = 0;
      while (t < dur) {
        t += G.dt;
        if (Math.random() < G.dt * 1.2) Wd.part('smoke', n.x + 6, n.y, { z: 34, vx: U.rand(-6, 6), vy: U.rand(-4, 2) });
        if (Math.random() < G.dt * 0.1) n.face = U.rand(0, 6.28);
        if (Math.random() < G.dt * 0.04) N.say(n, U.pick(L().smokerChat), { dim: true });
        yield;
      }
      n.needs.smoke = 0;
    } finally { n.smoking = false; n.act = null; }
  }
  N.tSmoke = tSmoke;

  function chatPartner(n) {
    if (n.group) {
      const m = n.group.members.filter((o) => o !== n && o.state === 'inside' && !o.override && !o.seat && M.inClub(o.x, o.y));
      if (m.length) return U.pick(m);
    }
    const near = Ph.query(n.x, n.y, 220, (b) => b.kind === 'char' && b.ent !== n && b.ent.kind === 'guest' && !b.ent.override && b.ent.state === 'inside');
    return near.length ? U.pick(near).ent : null;
  }
  function* tChat(n) {
    const G = LC.G;
    const other = chatPartner(n);
    if (!other) { yield* tWander(n); return; }
    const ok = yield* go(n, other.x + U.rand(-26, 26), other.y + U.rand(10, 22), { arrive: 16, avoidDance: !M.onLED(other.x, other.y) });
    if (!ok) return;
    n.act = 'stand';
    const dur = U.rand(12, 32);
    let t = 0;
    while (t < dur && !other.gone) {
      t += G.dt;
      if (U.dist(n.x, n.y, other.x, other.y) > 90) break;
      N.faceTo(n, other.x, other.y);
      if (Math.random() < G.dt * 0.07) N.say(n, U.pick(G.clock > 200 ? L().chatterLate : L().chatter), { dim: true });
      if (Math.random() < G.dt * 0.03) N.emote(n, U.pick(['music', 'heart', '...']), 1.2);
      yield;
    }
    n.needs.social = 0;
  }
  N.tChat = tChat;

  const WANDER_ROOMS = [['dance', 3], ['hall', 3], ['bar', 2], ['lounge', 1], ['chill', 1], ['patio', 1], ['lobby', 0.6]];
  function* tWander(n) {
    const G = LC.G;
    const r = U.weighted(WANDER_ROOMS, (w) => w[1]);
    const p = M.randomPoint(r[0], n.perm);
    if (!p) return;
    const ok = yield* go(n, p.x, p.y, { arrive: 14, avoidDance: r[0] !== 'dance' });
    if (!ok) return;
    n.act = 'stand';
    n.phoneUp = Math.random() < 0.35;
    try { yield* wait(n, U.rand(3, 9), () => { if (Math.random() < G.dt * 0.5) n.face = U.rand(0, 6.28); }); }
    finally { n.phoneUp = false; }
  }
  N.tWander = tWander;

  function* tVip(n) {
    const G = LC.G;
    const ok = yield* go(n, S.vipHost.x - 26, S.vipHost.y + 14, { arrive: 16 });
    if (!ok) return;
    G.vipRopeOpen = 1; G.vipRopeT = G.t + 3;
    yield* wait(n, 0.8);
    yield* tSit(n, { rooms: ['vip'], dur: U.rand(40, 100) });
  }
  function* tFood(n) {
    const G = LC.G;
    const perm = n.perm | P.OUT;
    let ok = yield* go(n, S.kebabWindow.x + U.rand(-20, 20), S.kebabWindow.y + U.rand(4, 20), { perm, arrive: 14, avoidDance: true });
    if (!ok) return;
    n.act = 'stand'; n.face = -Math.PI / 2;
    yield* wait(n, U.rand(4, 9));
    n.food = true;
    if (Math.random() < 0.25) N.say(n, U.pick(L().kebab), { dim: true });
    const back = S.inside;
    ok = yield* go(n, back.x + U.rand(-30, 30), back.y + U.rand(-10, 20), { perm, avoidDance: true });
    if (n.food && Math.random() < 0.55) { Wd.addMess('food', n.x + U.rand(-10, 10), n.y + U.rand(0, 10), { r: 10 }); }
    n.food = false;
  }
  function* tLeave(n, o = {}) {
    const G = LC.G;
    n.state = 'leaving';
    N.standUp(n);
    if (n.coatChecked && !o.noCoat) {
      yield* go(n, S.coat.x + U.rand(-4, 4), S.coat.y + U.rand(-30, 30), { arrive: 12, perm: n.perm | P.OUT });
      n.act = 'stand'; n.face = Math.PI;
      yield* wait(n, U.rand(2, 5));
      n.coatChecked = false;
    }
    if (n.drink && Math.random() < 0.5) N.finishDrink(n);
    const exit = o.exit || U.weighted(S.exits, (e) => (e.taxi ? 0.8 : 1));
    n.perm = n.perm | P.OUT;
    const ok = yield* go(n, exit.x + U.rand(-10, 10), exit.y + U.rand(-10, 10), { perm: n.perm, arrive: 22, avoidDance: true, timeout: 120 });
    if (!ok && M.isInside(n.x, n.y)) {
      // wandered into a corner: try the front door directly
      yield* go(n, S.idCheck.x, S.idCheck.y + 30, { perm: P.ALL, arrive: 20 });
    }
    if (exit.taxi && ok) { n.act = 'stand'; n.phoneUp = true; yield* wait(n, U.rand(3, 8)); n.phoneUp = false; }
    n.state = 'left';
    LC.stat('guestsLeft');
    N.remove(n);
    yield;
  }
  N.tLeave = tLeave;
  N.tWander = tWander;

  function* tArrive(n) {
    const G = LC.G;
    n.state = 'queue';
    LC.Door.join(n);
    while (n.state === 'queue') {
      const spot = LC.Door.spotFor(n);
      if (spot && U.dist(n.x, n.y, spot.x, spot.y) > 9) {
        N.goTo(n, spot.x, spot.y, { perm: P.OUT, arrive: 5, speed: n.speed * (spot.head ? 1 : 0.9) });
        while (n.nav.status === 'moving' && n.state === 'queue') {
          const s2 = LC.Door.spotFor(n);
          if (s2 && (Math.abs(s2.x - n.nav.gx) > 4 || Math.abs(s2.y - n.nav.gy) > 4)) break;
          yield;
        }
      }
      n.act = 'stand';
      n.face = spot && spot.head ? 0 : 0;
      if (Math.random() < G.dt * 0.08) n.phoneUp = !n.phoneUp;
      if (Math.random() < G.dt * 0.03) N.say(n, U.pick(L().queueChat), { dim: true });
      yield;
    }
    n.phoneUp = false;
    if (n.state === 'denied') {
      N.emote(n, '?', 1.5);
      yield* wait(n, 1);
      N.setTask(n, tLeave(n, { noCoat: true }), 'leave');
      return;
    }
    // inside
    n.perm = P.GUEST | (n.vip ? P.VIP : 0);
    n.state = 'inside';
    n.arrivedAt = G.clock;
    yield* go(n, S.inside.x + U.rand(-40, 40), S.inside.y + U.rand(-30, 10), { arrive: 16 });
    if (n.coat && Math.random() < 0.7) {
      yield* go(n, S.coat.x, S.coat.y + U.rand(-40, 40), { arrive: 12 });
      n.act = 'stand'; n.face = Math.PI;
      yield* wait(n, U.rand(2, 4));
      n.coatChecked = true;
    }
    if (LC.Director) LC.Director.onEnter(n);
  }
  N.tArrive = tArrive;

  /* ---------------- choosing what to do ---------------- */
  const TASKS = { drink: tDrink, dance: tDance, pee: tPee, sit: tSit, smoke: tSmoke, chat: tChat, wander: tWander, vip: tVip, food: tFood, leave: tLeave };
  N.TASKS = TASKS;
  function leaveScore(n, G) {
    const stayed = G.clock - n.arrivedAt;
    let s = 0;
    if (G.clock > 150) s += ((G.clock - 150) / 300) * 0.25;
    if (stayed > 120) s += 0.1;
    if ((1 - n.sob) > 0.9) s += 0.2;
    if (n.needs.rest > 0.85) s += 0.2;
    return s * (n.group && n.group.leader !== n ? 0.3 : 1);
  }
  N.think = (n) => {
    const G = LC.G, nd = n.needs, tr = n.tr, dr = 1 - n.sob;
    if (G.closing) { N.setTask(n, tLeave(n), 'leave'); return; }
    // follow the group's current plan sometimes
    if (n.group && n.group.plan && n.group.leader !== n && Math.random() < tr.loyalty * 0.7 && G.t - n.group.planT < 25) {
      const pl = n.group.plan;
      if (pl === 'dance') { N.setTask(n, tDance(n, n.group.leader), 'dance'); return; }
      if (pl === 'leave') { N.setTask(n, tLeave(n), 'leave'); return; }
    }
    const mE = G.music.stopped ? 0 : G.music.energy || 0.5;
    const opts = [
      ['drink', (nd.drink * 1.25 - (n.drink ? 1 : 0)) * (G.barOpen ? 1 : 0)],
      ['dance', nd.dance * (0.5 + tr.energy) * (0.3 + mE) * 1.25],
      ['pee', nd.pee * nd.pee * 2.6],
      ['sit', nd.rest * 1.1 + dr * 0.25],
      ['smoke', n.smoker ? nd.smoke * 1.2 : 0],
      ['chat', nd.social * 0.7 + (n.group ? 0.15 : 0)],
      ['wander', 0.14],
      ['vip', n.vip ? 0.7 : 0],
      ['food', G.kebabOpen && dr > 0.35 && !n.food ? 0.1 : 0],
      ['leave', leaveScore(n, G)],
    ];
    opts.sort((a, b) => b[1] - a[1]);
    const top = opts.slice(0, 3);
    const choice = U.weighted(top, (o) => Math.pow(Math.max(0.01, o[1]), 2)) || opts[0];
    const name = choice[0];
    N.setTask(n, TASKS[name](n), name);
    if (n.group && n.group.leader === n && (name === 'dance' || name === 'leave')) { n.group.plan = name; n.group.planT = G.t; }
  };

  /* ---------------- update ---------------- */
  N.update = (n, dt) => {
    if (n.gone) return;
    n.running = true;
    try {
      if (n.override) {
        const g = n.override;
        let r;
        try { r = g.next(); } catch (e) { console.error('override', n.overrideName, e); r = { done: true }; }
        if (r.done && n.override === g) { n.override = null; n.overrideName = ''; n.overridePri = 0; }
      } else if (n.task && !n.frozen) {
        const g = n.task;
        let r;
        try { r = g.next(); } catch (e) { console.error('task', n.taskName, e); r = { done: true }; }
        if (r.done && n.task === g) { n.task = null; n.taskName = ''; n.act = null; }
      } else if (n.brain) {
        n.brain(n, dt);
      } else if (n.kind === 'guest' && n.state === 'inside') {
        n.thinkT -= dt;
        if (n.thinkT <= 0) { n.running = false; N.think(n); n.thinkT = U.rand(0.2, 1); }
      } else if (n.kind === 'guest' && n.state === 'leaving' && !n.escorted) {
        // whatever interrupted them, they were on their way out
        n.running = false;
        N.setTask(n, tLeave(n), 'leave');
      }
    } finally { n.running = false; }
    applyPending(n);
    if (n.removeMe) { n.removeMe = false; N.remove(n); }
    if (n.gone) return;
    if (!n.body.pinned && !n.noSteer) steer(n, dt);
    if (n.kind === 'guest') tickNeeds(n, dt);
    animate(n, dt);
    if (n.kind === 'guest') slipCheck(n, dt);
  };
})();
