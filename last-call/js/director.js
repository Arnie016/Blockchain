/* Last Call — the director. Runs the clock from 9 PM to lights-on, fills the club, decides how
   much trouble the night can hold right now (a little at ten, a lot at two), keeps the radio
   talking, and turns the lights on at four so everyone can see what they've done. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd, Phys: Ph } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Dr = (LC.Director = {});
  const L = () => LC.Lines;

  /* ================= nights ================= */
  Dr.NIGHTS = [
    { day: 'Thursday', tag: 'Student Night', crowd: 0.72, chaos: 0.72, events: 2, pool: ['birthday', 'influencer', 'crocodile', 'shots40', 'teens'] },
    { day: 'Friday', tag: 'After-Work Drinks', crowd: 0.9, chaos: 0.9, events: 3, pool: ['wedding', 'lostPhone', 'influencer', 'proposal', 'powerOut', 'shots40', 'ex', 'gang', 'teens'] },
    { day: 'Saturday', tag: 'Peak Weekend', crowd: 1.08, chaos: 1.05, events: 4, pool: ['birthday', 'football', 'bachelor', 'celebrity', 'fireAlarm', 'crocodile', 'lostPhone', 'ex', 'gang', 'gang'] },
    { day: 'Sunday', tag: 'Bank Holiday Special', crowd: 1.02, chaos: 1.2, events: 4, pool: ['football', 'wedding', 'powerOut', 'celebrity', 'proposal', 'influencer', 'crocodile', 'fireAlarm', 'shots40'] },
  ];
  Dr.night = (i) => {
    if (i < Dr.NIGHTS.length) return Dr.NIGHTS[i];
    const days = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Wednesday'];
    return { day: days[i % days.length], tag: U.pick(['Foam Party (Cancelled)', 'Throwback Night', 'Silent Disco (Not Silent)', 'Industry Night', 'Mystery Theme']), crowd: 1.05, chaos: 1.1 + Math.min(0.4, (i - 4) * 0.05), events: 5, pool: ['birthday', 'football', 'bachelor', 'celebrity', 'fireAlarm', 'crocodile', 'lostPhone', 'ex', 'wedding', 'powerOut', 'proposal', 'influencer', 'shots40', 'gang', 'teens'] };
  };

  // minutes since 9 PM: how fast time moves (seconds per game minute), how much trouble is allowed, how full it gets
  const PHASES = [
    { t: 0, name: 'DOORS OPEN', rate: 1.0, load: 0.4, crowd: 8, gap: 55 },
    { t: 60, name: 'FILLING UP', rate: 1.35, load: 1.2, crowd: 60, gap: 38 },
    { t: 150, name: 'WARMING UP', rate: 1.7, load: 2.3, crowd: 112, gap: 26 },
    { t: 240, name: 'CHAOS BEGINS', rate: 1.9, load: 3.4, crowd: 136, gap: 18 },
    { t: 300, name: 'PEAK STUPIDITY', rate: 1.9, load: 4.6, crowd: 140, gap: 13 },
    { t: 360, name: 'DECISION-MAKING OFFLINE', rate: 1.7, load: 5.2, crowd: 118, gap: 12 },
    { t: 420, name: 'LIGHTS ON', rate: 2.2, load: 1.5, crowd: 0, gap: 30 },
  ];
  Dr.PHASES = PHASES;
  Dr.phase = () => { const c = LC.G.clock; let p = PHASES[0]; for (const q of PHASES) if (c >= q.t) p = q; return p; };
  function lerpPhase(key) {
    const c = LC.G.clock;
    for (let i = 0; i < PHASES.length - 1; i++) {
      const a = PHASES[i], b = PHASES[i + 1];
      if (c >= a.t && c < b.t) return U.lerp(a[key], b[key], (c - a.t) / (b.t - a.t));
    }
    return PHASES[PHASES.length - 1][key];
  }
  Dr.targetLoad = () => lerpPhase('load') * LC.G.night.chaos;
  Dr.chaos = () => U.clamp(0.35 + (LC.G.clock - 60) / 300, 0.35, 1.3) * LC.G.night.chaos;

  /* ================= radio ================= */
  const R = (LC.Radio = { log: [], queue: [], lastT: -99, used: new Set() });
  const WHO = {
    marcus: { tag: 'HEAD SECURITY', c: '#ffd23f', pitch: 0.8 }, jolene: { tag: 'BAR', c: '#ff9ad0', pitch: 1.3 }, krank: { tag: 'DJ', c: '#7fe0ff', pitch: 0.9 },
    petrakis: { tag: 'MANAGER', c: '#c9a2ff', pitch: 0.95 }, ines: { tag: 'COAT CHECK', c: '#ffcf7a', pitch: 1.25 }, bogdan: { tag: 'KITCHEN', c: '#b8f08a', pitch: 0.7 },
    dolores: { tag: 'CLEANER', c: '#7fe0d0', pitch: 1.1 }, rico: { tag: 'VIP', c: '#ffe08a', pitch: 1.0 }, tank: { tag: 'SECURITY', c: '#ffd23f', pitch: 0.65 }, priya: { tag: 'SECURITY', c: '#ffd23f', pitch: 1.2 }, you: { tag: 'YOU', c: '#ffffff', pitch: 0.9 },
  };
  R.WHO = WHO;
  R.say = (who, text) => R.queue.push({ who, text, delay: 0 });
  R.convo = (lines) => { lines.forEach(([who, text], i) => R.queue.push({ who, text, delay: i ? 1.2 + lines[i - 1][1].length * 0.035 : 0 })); };
  R.report = (inc, room) => {
    if (!inc || inc.noticed || inc.reported) return;
    const pool = L().radioReport[room] || L().radioReport.hall;
    R.convo(U.pick(pool));
    I().notice(inc, 'radio');
  };
  R.maybe = (kind) => {
    if (kind === 'fight' && Math.random() < 0.6) R.say('marcus', U.pick(['Is that a fight? I can hear it from the door.', 'Fight on the floor. Want backup? Press your radio, Unit Four.', 'Somebody is fighting. Of course they are.']));
  };
  const I = () => LC.Incidents;
  R.update = (dt) => {
    const G = LC.G;
    if (R.queue.length) {
      const q = R.queue[0];
      q.delay -= dt;
      if (q.delay <= 0) {
        R.queue.shift();
        R.log.push({ who: q.who, text: q.text, t: G.t });
        if (R.log.length > 30) R.log.shift();
        R.lastT = G.t;
        if (q.who === 'you') LC.Player.say(q.text, { silent: true });
        if (LC.Audio && LC.Audio.ready) LC.Audio.radio(q.text, WHO[q.who] ? WHO[q.who].pitch : 1);
      }
    }
  };
  function idleChatter() {
    const G = LC.G;
    const pool = G.clock > 300 ? L().radioLate.concat(L().radioIdle) : L().radioIdle;
    const opts = pool.filter((c) => !R.used.has(c));
    if (!opts.length) return;
    const c = U.pick(opts);
    R.used.add(c);
    R.convo(c);
  }

  /* ================= spawning ================= */
  const GROUP_SIZES = [[1, 1.2], [2, 3], [3, 2.6], [4, 1.8], [5, 0.9], [6, 0.4]];
  Dr.spawnGroup = (size, o = {}) => {
    const G = LC.G;
    const from = o.from || U.weighted(S.exits, (e) => (e.taxi ? 1.2 : 1));
    const grp = { id: U.uid(), members: [], leader: null, plan: null, planT: 0, theme: o.theme || null };
    const theme = o.theme;
    const baseC = U.pick(['#e8375a', '#2f7ae5', '#1fbf8f', '#f5c542', '#a64dff', '#141418']);
    for (let i = 0; i < size; i++) {
      const fem = o.fem !== undefined ? (typeof o.fem === 'function' ? o.fem(i) : o.fem) : Math.random() < 0.5;
      const look = LC.People.randomLook({ fem });
      if (theme && theme.look) theme.look(look, i);
      const n = N.create({
        x: from.x + U.rand(-24, 24) + (from.edge ? (from.x < 100 ? -10 : 10) : 0), y: from.y + U.rand(-16, 16), fem, look,
        sob: o.sob ? o.sob(i) : undefined, tr: theme && theme.tr ? theme.tr(i) : undefined,
      });
      n.group = grp;
      grp.members.push(n);
      if (theme && theme.setup) theme.setup(n, i);
      if (Math.random() < 0.06) n.flags.fakeId = true;
      if (Math.random() < 0.04) n.flags.contraband = U.pick(['traffic cone', 'rotisserie chicken', 'garden gnome', 'hip flask', 'second hip flask', 'live goldfish', 'whole pineapple', 'bowling ball', 'deflated crocodile']);
      if (n.flags.contraband === 'traffic cone') n.flags.hadCone = true;
      N.setTask(n, N.tArrive(n), 'arrive');
    }
    grp.leader = grp.members[0];
    G.groups.push(grp);
    return grp;
  };
  function spawnTick(dt) {
    const G = LC.G;
    if (G.closing) return;
    Dr.spawnT -= dt;
    if (Dr.spawnT > 0) return;
    Dr.spawnT = U.rand(1.2, 3.2);
    const target = Math.min(150, lerpPhase('crowd') * G.night.crowd);
    const inside = G.npcs.filter((n) => n.kind === 'guest' && (n.state === 'inside' || n.state === 'queue' || n.state === 'arriving' || n.state === 'admitted')).length;
    if (inside >= target) return;
    const size = U.weighted(GROUP_SIZES, (g) => g[1])[0];
    Dr.spawnGroup(size);
  }

  /* ================= incident scheduling ================= */
  function pickActor(def) {
    const G = LC.G;
    const cands = [];
    for (const n of G.npcs) {
      if (n.kind !== 'guest' || n.state !== 'inside' || n.regular) continue;
      const s = def.cand ? def.cand(n) : 0;
      if (s > 0) cands.push([n, s]);
    }
    if (!cands.length) return null;
    const c = U.weighted(cands, (c) => c[1]);
    return c ? c[0] : null;
  }
  function scheduleTick(dt) {
    const G = LC.G, Inc = I();
    if (G.closing) return;
    Dr.schedT -= dt;
    if (Dr.schedT > 0) return;
    Dr.schedT = 2;
    const load = Inc.load(), target = Dr.targetLoad();
    const gap = lerpPhase('gap') / G.night.chaos;
    if (load >= target || G.t - Dr.lastInc < gap) return;
    const types = Inc.SCHEDULED.filter((t) => {
      const d = Inc.defs[t];
      if (!d || (d.min || 0) > G.clock) return false;
      if (Inc.lastStart[t] && G.t - Inc.lastStart[t] < (d.cooldown || 120)) return false;
      if (Inc.active.some((a) => a.type === t)) return false;
      return true;
    });
    if (!types.length) return;
    for (let tries = 0; tries < 4; tries++) {
      const type = U.weighted(types, (t) => Inc.defs[t].weight || 1);
      const n = pickActor(Inc.defs[type]);
      if (!n) continue;
      if (Inc.start(type, n)) { Dr.lastInc = G.t; return; }
    }
  }
  Dr.allow = (kind) => {
    const G = LC.G, Inc = I();
    if (G.closing && kind !== 'sleeper') return false;
    const load = Inc.load(), target = Dr.targetLoad();
    switch (kind) {
      case 'argument': if (G.clock < 50) return false; if (G.args.length >= Math.max(1, Math.round(target * 0.5))) return false; if (G.t - (Dr.lastArg || -99) < 14 / G.night.chaos) return false; Dr.lastArg = G.t; return load < target + 1.2;
      case 'fight': return G.fights.length < (G.clock > 240 ? 2 : 1) && G.clock > 100;
      case 'vomit': return G.clock > 130 && Inc.count((q) => q.type === 'vomit') < 4;
      case 'sleeper': return G.clock > 170 && Inc.count((q) => q.type === 'sleeper') < 3;
      case 'sneakBack': return Inc.count((q) => q.type === 'kitchen' || q.type === 'gateClimb') < 1;
      default: return load < target + 1;
    }
  };

  /* ================= hooks ================= */
  Dr.onEnter = (n) => {
    const G = LC.G;
    if (n.flags.hadCone && !I().active.some((q) => q.type === 'cone')) I().start('cone', n);
    if (n.flags.banned) { LC.stat('bannedGotBackIn'); }
    if (n.regular && LC.Regulars) LC.Regulars.entered(n);
  };
  Dr.onSlip = (n) => {
    const G = LC.G;
    for (const inc of I().active) if (inc.type === 'vomit' && U.dist(inc.x, inc.y, n.x, n.y) < 50) inc.data.slips = (inc.data.slips || 0) + 1;
    const near = Ph.query(n.x, n.y, 150, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n);
    if (near.length && Math.random() < 0.6) N.shout(U.pick(near).ent, U.pick(['OHHHH', 'Whoa!', 'SHAMEEE', 'Down he goes!', 'Is he okay? He\'s okay.']), { dim: true });
    const p = G.player;
    if (p && U.dist(p.x, p.y, n.x, n.y) < 300 && Math.random() < 0.5) LC.Player.say(U.pick(['...and there it is.', 'Wet floor. Sign. I KNEW it.', 'Told you.']));
  };
  Dr.onVomit = (n, x, y) => {
    const G = LC.G;
    const m = Wd.messNear(x, y, 20, (q) => q.kind === 'vomit').pop();
    if (I().count((q) => q.type === 'vomit') < 4) I().emergent('vomit', null, { mess: m, x, y });
    // sympathetic vomiting
    const near = Ph.query(x, y, 80, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n && !b.ent.override && (1 - b.ent.sob) > 0.6);
    if (near.length && Math.random() < 0.15) { const o = near[0].ent; setTimeout(() => { if (!o.gone && !o.override) N.interrupt(o, N.oVomit(o), 'vomit', 6); }, 1800); }
    const p = G.player;
    if (p && U.dist(p.x, p.y, x, y) < 200) LC.Player.mutter(['Oh, come ON.', 'Right in front of me.', 'Classic.'], 0.6);
  };
  function* oSleep(n, where) {
    n.asleep = true;
    n.exprLock = true; n.expr = 'sleep';
    try {
      if (where === 'floor') { n.poseLock = true; n.pose = 'fallen'; n.fallK = 1; n.fallSide = Math.random() < 0.5 ? 1 : -1; }
      for (;;) {
        if (Math.random() < LC.G.dt * 0.6) LC.W.part('zzz', n.x + 6, n.y - 30 - (n.z || 0), { vx: 6 });
        if (Math.random() < LC.G.dt * 0.03) N.say(n, U.pick(['...zzz...', '...mm, no, the ducks...', '...five more minutes...', '...snrrk...']), { dim: true });
        yield;
      }
    } finally { n.asleep = false; n.exprLock = false; n.poseLock = false; n.fallK = 0; if (n.pose === 'fallen') n.pose = 'stand'; }
  }
  Dr.sleeper = (n, where, quiet) => {
    if (n.asleep || n.gone) return;
    N.cancelTask(n);
    N.interrupt(n, oSleep(n, where), 'sleep', 8);
    n.asleep = true;
    LC.stat('sleepers');
    const inc = I().emergent('sleeper', n, { where: where === 'seat' ? 'seat' : n.seat ? 'seat' : where });
    if (inc && (M.inRoom(n.x, n.y, 'mens') || M.inRoom(n.x, n.y, 'womens'))) inc.data.where = 'stall';
  };
  Dr.wake = (n, dragged) => {
    if (!n.asleep && n.overrideName !== 'sleep') return;
    n.asleep = false;
    if (n.overrideName === 'sleep') N.endOverride(n);
    if (!dragged) N.standUp(n);
    n.sob = Math.min(1, n.sob + 0.06);
    LC.stat('peopleWoken');
  };
  Dr.maybeTwelveWaters = (n) => {
    if (Dr.twelve) return;
    Dr.twelve = true;
    R.convo([['jolene', 'Security.'], ['you', 'Yeah?'], ['jolene', 'Someone ordered twelve waters.'], ['you', 'So?'], ['jolene', "They haven't paid for any of the other drinks."]]);
  };
  Dr.sinkLeft = (n, sink) => {
    if (Dr.flood) return;
    Dr.flood = { sink, t: 0 };
    LC.stat('sinksLeftRunning');
  };
  Dr.crash = (x, y, kind) => { Dr.heard(x, y, 'crash', 1.4); };
  Dr.heard = (x, y, kind, loud) => {
    const G = LC.G, p = G.player;
    if (!p) return;
    const d = U.dist(p.x, p.y, x, y);
    if (d > 900 * loud || d < 60) return;
    const s = LC.R.toScreen(x, y, 20);
    const onScreen = s.x > 0 && s.x < LC.R.cw && s.y > 0 && s.y < LC.R.ch;
    if (onScreen) return;
    const word = kind === 'glass' ? 'SMASH' : kind === 'fight' ? 'SHOUTING' : kind === 'crash' ? 'CRASH' : 'NOISE';
    const a = Math.atan2(y - p.y, x - p.x), cues = LC.HUD.cues;
    // the same racket from the same direction is one cue, not a pile of them
    const same = cues.find((c) => c.text === word && Math.abs(U.angDiff(c.a, a)) < 0.6);
    if (same) { same.t = Math.min(same.t, 0.25); same.a = a; same.x = x; same.y = y; }
    else { cues.push({ text: word, a, t: 0, x, y }); if (cues.length > 4) cues.shift(); }
    if (kind === 'crash' && G.t - (Dr.lastGreat || -99) > 25) {
      Dr.lastGreat = G.t;
      setTimeout(() => { LC.Player.say('...great.'); LC.Objectives.flash('...great.', 'Something broke. Somewhere behind you.'); }, 700);
    }
  };
  Dr.disaster = (f) => {
    const G = LC.G;
    LC.stat('disasters');
    LC.Objectives.flash('COMPLETE NIGHTCLUB DISASTER', 'Escalation level 6. Everyone is involved now.');
    if (f.inc) I().escalate(f.inc, 6);
    R.say('petrakis', U.pick(['I am calling the police. I am calling them NOW.', 'That is IT. Police.']));
    LC.Staff.callPolice(f.x, f.y, 'fight');
    for (const b of LC.Staff.bouncers) if (!b.job) { const m = [...f.members.keys()][0]; if (m) LC.Staff.callBackup(f.x, f.y, m, 'fight'); }
  };
  Dr.managerOpinion = () => {
    const G = LC.G;
    const o = [];
    if (M.flamingo.tipped) o.push('MY FLAMINGO. What happened to my FLAMINGO?');
    if ((G.stats.stolenLost || 0) > 0) o.push('Where is the plant? There was a plant.');
    if (Wd.messScore() > 60) o.push('Why is my floor sticky? Why is it ALL sticky?');
    if (G.functioning < 45) o.push('Is this a nightclub or a crime scene?');
    if (G.fights.length) o.push('Is that a FIGHT? In my CLUB?');
    if (!o.length) o.push(U.pick(['Smile more. At the customers.', 'Good crowd. Keep it that way.', 'Why is the DJ so tall?', 'Have you seen the flamingo lately? Look at it. Majestic.', 'Is it me or is it too loud? It is too loud. Leave it.']));
    return U.pick(o);
  };
  Dr.congaStarted = () => { LC.Objectives.flash('SUDDENLY, A CONGA LINE', 'This is not a parade. It is becoming a parade.'); LC.stat('congas'); };
  Dr.onEject = (n, by) => { if (by === 'player') LC.Player.flashExpr('smug', 1.4); };
  Dr.bribeTaken = (n) => { if (Math.random() < 0.35) setTimeout(() => { R.say('petrakis', 'Unit Four. Was that money? Come to my office after your shift.'); LC.stat('securityComplaints'); }, 6000); };
  Dr.deadline = (n) => { setTimeout(() => { if (!n.gone && n.state === 'inside') R.say('marcus', U.pick(["Your 'five more minutes' guy is still at the bar.", 'Unit Four, the negotiator is on his fourth drink.'])); }, 60000); };

  /* ================= closing ================= */
  function startClosing() {
    const G = LC.G;
    G.closing = true;
    G.closingT = G.t;
    G.barOpen = false;
    LC.Audio && LC.Audio.ready && LC.Audio.recordStop();
    G.music.stopped = true;
    LC.Objectives.flash('GET EVERYONE OUT.', 'Lights are on. Music is off. Everyone is suddenly very tired.');
    R.convo([['marcus', "That's four. Lights on."], ['krank', 'Goodnight, Flamingo!'], ['marcus', 'Unit Four, clear the floor.']]);
    // the queue gives up
    for (const n of G.queue.slice()) { LC.Door.deny(n, 'closing'); }
    // everyone stands around blinking, then drifts out; a few decide to hide or linger
    let hiders = 0;
    for (const n of G.npcs) {
      if (n.kind !== 'guest' || n.state !== 'inside') continue;
      if (!n.incident && !n.override && hiders < 3 && (1 - n.sob) > 0.5 && Math.random() < 0.05) { hiders++; I().start('hider', n); continue; }
      if (n.incident || n.asleep) continue;
      const linger = Math.random() < 0.12 + (1 - n.sob) * 0.2;
      N.setTask(n, tClosing(n, linger), 'closing');
    }
    Dr.closeRadioT = 30;
  }
  // telling one of them works on the whole group, and on anyone nearby still swaying
  Dr.herd = (n, how) => {
    const G = LC.G;
    if (n.toldToLeave) return;
    n.toldToLeave = true;
    LC.stat('herded');
    if (how === 'stare') { N.say(n, U.pick(L().herdStare), { pri: 3 }); N.faceTo(n, G.player.x, G.player.y); }
    let k = 0;
    for (const m of G.npcs) {
      if (m === n || m.kind !== 'guest' || m.toldToLeave || !m.lingering) continue;
      const friend = n.group && m.group === n.group;
      if (!friend && U.dist(m.x, m.y, n.x, n.y) > 140) continue;
      m.toldToLeave = true;
      LC.stat('herded');
      if (k++ < 2) setTimeout(() => { if (!m.gone) N.say(m, U.pick(L().herdFollow), { pri: 2, dim: true }); }, 600 + k * 700);
    }
  };
  // the head of security watches the cameras so you don't have to
  function closingRadio(dt, inside) {
    const G = LC.G;
    Dr.closeRadioT -= dt;
    if (Dr.closeRadioT > 0 || !inside.length || inside.length > 7) return;
    Dr.closeRadioT = 24;
    const by = new Map();
    for (const n of inside) { const r = M.roomAt(n.x, n.y); const k = r ? r.name : 'somewhere'; by.set(k, (by.get(k) || 0) + 1); }
    const word = (c) => ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][c] || String(c);
    const parts = [...by.entries()].map(([room, c]) => word(c) + ' in the ' + room.toLowerCase().replace("men's bathroom", "men's").replace("women's bathroom", "women's"));
    const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    R.say('marcus', U.pick([
      'Unit Four. Cameras say ' + list + '.',
      'Still got ' + list + '. The cleaners are staring at me.',
      inside.length === 1 ? 'Last one. ' + list.replace(/^one /, '') + '. Then we can all go home.' : 'Nearly there. ' + list + '.',
    ]));
  }
  // the lights come on and the magic leaves the room
  function* tClosing(n, linger) {
    const G = LC.G;
    N.standUp(n);
    n.act = 'stand';
    yield* N.wait(n, U.rand(0.5, 3));
    if (Math.random() < 0.35) N.say(n, U.pick(L().lightsOnReact), { dim: true });
    n.exprLock = true; n.expr = U.pick(['tired', 'shock', 'confused', 'sad']);
    yield* N.wait(n, U.rand(2, 8));
    n.exprLock = false;
    if (linger && !n.toldToLeave) {
      // the last ones standing: still swaying to music that isn't there
      n.lingering = true;
      let t = 0;
      const limit = U.rand(40, 85);
      try {
        while (t < limit && !n.toldToLeave) {
          t += G.dt;
          n.act = Math.sin(t * 0.4 + n.seed) > 0.3 ? 'dance' : 'stand';
          if (Math.random() < G.dt * 0.04) N.say(n, U.pick(L().closingAsk), { dim: true });
          yield;
        }
      } finally { n.lingering = false; }
    }
    yield* N.tLeave(n);
  }
  function lightsTick(dt) {
    const G = LC.G;
    if (!G.closing) return;
    const k = G.t - G.closingT;
    // fluorescent tubes stutter on
    G.lightsOn = k < 1.6 ? (Math.sin(k * 40) > 0.2 || k > 1.2 ? U.clamp(k / 1.2, 0, 1) : 0) : 1;
  }
  function endCheck() {
    const G = LC.G;
    if (!G.closing || G.ending) return;
    const inside = G.npcs.filter((n) => n.kind === 'guest' && !n.gone && M.inClub(n.x, n.y) && n.state !== 'left');
    G.stillInside = inside.length;
    G.stillInsideList = inside;
    // anyone who isn't asleep, hiding or being dealt with drifts toward the door eventually
    for (const n of inside) {
      if (n.asleep || n.hiding || n.override || n.incident || n.escorted) continue;
      if (n.state === 'inside' && !n.task) N.setTask(n, tClosing(n, false), 'closing');
      else if (n.state === 'leaving' && n.taskName !== 'leave' && n.taskName !== 'closing') N.setTask(n, N.tLeave(n), 'leave');
    }
    closingRadio(LC.G.dt, inside);
    if ((inside.length === 0 && G.t - G.closingT > 8) || G.clock >= 480) {
      G.ending = true;
      if (!inside.length) G.stats.clearedAt = Math.round(G.clock);
      if (G.clock >= 480) { LC.stat('stillInsideAt5', inside.length); LC.Objectives.flash("IT'S FIVE. THEY'RE STILL HERE.", 'The cleaners are here. So is everyone else.'); }
      else LC.Objectives.flash('CLUB CLEARED.', U.clock(G.clock) + '. Somehow.');
      setTimeout(() => LC.Game.endNight(), 3500);
    }
  }

  /* ================= functioning meter ================= */
  function functioningTick(dt) {
    const G = LC.G;
    const mess = Wd.messScore();
    const inc = I().load();
    let raw = 100 - mess * 0.3 - inc * 3.2 - G.fights.length * 8 - G.args.length * 1.5;
    if (G.alarm) raw -= 18;
    if (!G.power) raw -= 14;
    if (G.music.hijacked) raw -= 8;
    if (G.emergencyOpen) raw -= 6;
    if (G.police.length) raw -= 10;
    G.functioningRaw = U.clamp(raw, 0, 100);
    G.functioning = U.damp(G.functioning, G.functioningRaw, 0.6, dt);
    G.funcSamples = (G.funcSamples || 0) + dt;
    G.funcSum = (G.funcSum || 0) + G.functioning * dt;
    G.funcMin = Math.min(G.funcMin === undefined ? 100 : G.funcMin, G.functioning);
    if (G.functioning < 3 && !G.closing) {
      G.collapseT = (G.collapseT || 0) + dt;
      if (G.collapseT > 25 && !G.shutdown) {
        G.shutdown = true;
        LC.stat('shutDown');
        LC.Objectives.flash('THE CLUB HAS STOPPED FUNCTIONING', 'The police are closing it. Early.');
        R.say('petrakis', 'That is it. We are closed. Everybody OUT.');
        LC.Staff.callPolice(46 * T, 36 * T, 'shutdown');
        G.clock = Math.max(G.clock, 419.5);
      }
    } else G.collapseT = 0;
  }

  /* ================= update ================= */
  Dr.start = (G) => {
    Dr.spawnT = 0.5; Dr.schedT = 6; Dr.lastInc = 0; Dr.radioT = 18; Dr.reportT = 5; Dr.twelve = false; Dr.flood = null; Dr.lastArg = -99;
    R.log = []; R.queue = []; R.used = new Set(); R.lastT = -99;
    // opening radio
    R.convo([['marcus', 'Evening, Unit Four. Doors are open.'], ['you', 'Great.'], ['marcus', 'Keep the club functioning. That\'s the whole job.'], ['you', 'And the other whole job?'], ['marcus', 'Mop.']]);
    // one or two early arrivals
    Dr.spawnGroup(2, { from: S.exits[0] });
    Dr.spawnGroup(1, { from: S.exits[2] });
  };
  Dr.update = (dt) => {
    const G = LC.G;
    const ph = Dr.phase();
    // the clock
    if (!G.ending) G.clock += dt / (ph.rate * G.shiftScale);
    if (ph.name !== G.phaseName) {
      G.phaseName = ph.name;
      if (G.clock > 1) LC.HUD.phaseBanner(ph.name, U.clock(G.clock));
      if (ph.name === 'LIGHTS ON' && !G.closing) startClosing();
      if (ph.name === 'CHAOS BEGINS') { G.kebabOpen = true; R.say('marcus', "Kebab van's open. God help us."); }
    }
    if (G.clock > 390 && !G.lastOrders) { G.lastOrders = true; R.convo([['jolene', 'LAST ORDERS!'], ['marcus', 'She means it.']]); LC.sfx('bell', 24 * T, 9 * T); }
    if (G.clock > 405) G.barOpen = false;
    spawnTick(dt);
    scheduleTick(dt);
    lightsTick(dt);
    functioningTick(dt);
    endCheck();
    // radio
    Dr.radioT -= dt;
    if (Dr.radioT <= 0) {
      Dr.radioT = U.rand(45, 80) * (G.clock > 300 ? 0.75 : 1);
      if (G.t - R.lastT > 20 && !G.closing) idleChatter();
    }
    Dr.reportT -= dt;
    if (Dr.reportT <= 0) {
      Dr.reportT = 6;
      // somebody always sees what you didn't
      const inc = I().active.find((q) => !q.noticed && !q.reported && (q.def.sev || 1) >= 1.5 && G.t - q.t0 > 34 && q.def.radio !== null);
      if (inc && G.t - R.lastT > 8) {
        const r = M.roomAt(inc.x, inc.y);
        R.report(inc, inc.def.radio || (r ? r.id : 'hall'));
      }
    }
    // a sink left running floods the toilets
    if (Dr.flood) {
      const f = Dr.flood;
      f.t += dt;
      if (Math.random() < dt * 0.8) Wd.addMess('water', f.sink.x - 20 + U.rand(-30, 10), f.sink.y + U.rand(-20, 40), { r: 12 + Math.random() * 8 });
      if (f.t > 50) Dr.flood = null;
    }
    // manager checks for his flamingo
    G.signFlicker = Math.sin(G.t * 0.7) > 0.97 && Math.random() < 0.5;
  };
})();
