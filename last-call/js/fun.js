/* Last Call — chaos. A numbered crowd-control toolbar (tape, dispersal zones, airhorn, backup,
   clear), crowds that react to fights, a rotating set of floor events with effects, the
   late-night masquerade of the Red Death, exit guidance, and a talk generator so no two
   conversations go the same way. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd } = LC;
  const T = M.T, S = M.S, P = M.P;
  const F = (LC.Fun = { zones: [], placed: [], active: [] });
  const G = () => LC.G;
  const I = () => LC.Incidents;
  const free = (n) => n.kind === 'guest' && n.state === 'inside' && !n.override && !n.seat && !n.incident && !n.escorted && !n.asleep && !n.restrained;

  /* ================= toolbar: 1-5 ================= */
  F.TOOLS = [
    { k: 1, id: 'tape', name: 'Tape off', hint: 'Rope off a square where you look', cd: 4 },
    { k: 2, id: 'zone', name: 'Dispersal zone', hint: 'Everyone clears the circle for 25s. Breaks up fights.', cd: 18 },
    { k: 3, id: 'horn', name: 'Airhorn', hint: 'Stuns everyone nearby. Fights stop. Ears ring.', cd: 22 },
    { k: 4, id: 'backup', name: 'Backup here', hint: 'Bouncer runs to where you look', cd: 15 },
    { k: 5, id: 'clear', name: 'Clear', hint: 'Remove the nearest tape or zone', cd: 0.5 },
  ];
  const cool = {};
  F.cooldown = (id) => Math.max(0, (cool[id] || 0) - (G() ? G().t : 0));
  function aimPt() { const p = G().player, a = p.aim, d = U.dist(p.x, p.y, a.x, a.y), r = Math.min(d, 260); return d < 1 ? { x: p.x, y: p.y } : { x: p.x + (a.x - p.x) / d * r, y: p.y + (a.y - p.y) / d * r }; }
  F.use = (k) => {
    const g = G(), p = g.player, t = F.TOOLS[k - 1];
    if (!t || !p) return;
    if (F.cooldown(t.id) > 0) { LC.Player.say(U.pick(['Not yet.', 'Recharging. Like me.', 'Give it a second.'])); return; }
    cool[t.id] = g.t + t.cd;
    const pt = aimPt();
    if (t.id === 'tape') {
      const r = 46, segs = [];
      const c = [[-r, -r], [r, -r], [r, r], [-r, r]];
      for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; segs.push(Wd.addBarrier(pt.x + a[0], pt.y + a[1], pt.x + b[0], pt.y + b[1])); }
      F.placed.push({ kind: 'tape', x: pt.x, y: pt.y, segs });
      LC.Player.say(U.pick(['Crime scene. Probably.', 'Nobody goes in there.', 'Taped. Like my life.']));
      LC.sfx('zip', pt.x, pt.y);
    } else if (t.id === 'zone') {
      F.zones.push({ x: pt.x, y: pt.y, r: 130, t0: g.t, dur: 25 });
      LC.Player.say(U.pick(['CLEAR THE AREA.', 'Everybody back. BACK.', 'Nothing to see. Move.']));
      LC.sfx('alarmBeep', pt.x, pt.y);
      LC.Objectives.flash('DISPERSAL ZONE', 'Everyone inside the red circle is leaving it. Right now.');
    } else if (t.id === 'horn') {
      LC.sfx('crash', p.x, p.y, { vol: 1.3 }); LC.R.cam.shake = 10;
      if (LC.R.flash) LC.R.flash(0.35);
      for (let i = 0; i < 26; i++) Wd.part('puff', p.x, p.y, { z: 40, vx: Math.cos(i / 4.1) * 260, vy: Math.sin(i / 4.1) * 200, vz: 20 });
      let stopped = 0;
      for (const n of g.npcs) {
        if (n.kind !== 'guest' || U.dist(n.x, n.y, p.x, p.y) > 300) continue;
        n.exprLock = false; n.expr = 'shock'; N.emote(n, '!', 1.5);
        const f = LC.Social.fightOf(n); if (f) { LC.Social.removeFighter(n); stopped++; }
        const a = LC.Social.argumentOf(n); if (a) LC.Social.calmArgument(a, 1);
        if (Math.random() < 0.25) N.say(n, U.pick(HORN), { pri: 1 });
      }
      LC.stat('airhorns');
      if (stopped) { LC.Aura.add(90, 'Airhorned a fight to death'); LC.stat('fightsStopped'); } else LC.Aura.add(-20, 'Airhorn for no reason');
    } else if (t.id === 'backup') {
      LC.Game.callBackupAt && LC.Game.callBackupAt(pt.x, pt.y);
    } else if (t.id === 'clear') {
      let best = null, bd = 1e9, list = null;
      for (const q of F.placed) { const d = U.dist(q.x, q.y, p.x, p.y); if (d < bd) { bd = d; best = q; list = F.placed; } }
      for (const q of F.zones) { const d = U.dist(q.x, q.y, p.x, p.y); if (d < bd) { bd = d; best = q; list = F.zones; } }
      if (!best || bd > 400) { LC.Player.say('Nothing to clear.'); return; }
      if (best.segs) best.segs.forEach((b) => Wd.removeBarrier(b));
      list.splice(list.indexOf(best), 1);
    }
  };
  const HORN = ['MY EARS!', 'WHAT?!', 'WAS THAT THE DROP?', 'I heard colours.', 'Mum?', 'WHO DID THAT', 'I can taste that sound.', "I'm SOBER now. Thanks."];

  /* ================= crowds react ================= */
  const FILM = ['WORLDSTAR!', 'Get it on video!', 'Ohhh he SWUNG!', "I'm live, I'm LIVE!", 'Hit him! No don\'t!', 'Somebody call someone!', 'This is better than the DJ.', 'Fight fight fight!'];
  const FLEE = ['NOPE.', 'Not my business!', 'MOVE MOVE MOVE', 'My drink! Save the drink!', "I'm too pretty for this.", 'AAAAH'];
  const HELP = ['Break it up!', 'Lads, LADS.', "He's not worth it!", 'Security! SECURITY!', 'Leave it, Dave!', "It's not worth it, babe!"];
  function crowdTick(g) {
    for (const f of g.fights) {
      for (const n of g.npcs) {
        if (!free(n) || f.members.has(n) || U.dist(n.x, n.y, f.x, f.y) > 230 || n.fightReact === f.id) continue;
        n.fightReact = f.id;
        const r = Math.random(), brave = n.tr.aggression + n.tr.loyalty * 0.4;
        if (r < 0.35) {
          N.setTask(n, (function* () { const a = Math.random() * 6.28, d = U.rand(70, 110); yield* N.go(n, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.8, { arrive: 14 }); let t = 0; while (!f.over && t < 25) { t += g.dt; n.phoneUp = true; n.filming = true; N.faceTo(n, f.x, f.y); n.act = 'phone'; if (Math.random() < g.dt * 0.25) N.shout(n, U.pick(FILM)); yield; } n.phoneUp = false; n.filming = false; })(), 'film');
        } else if (r < 0.6) {
          N.setTask(n, (function* () { N.shout(n, U.pick(FLEE)); const a = Math.atan2(n.y - f.y, n.x - f.x); yield* N.go(n, n.x + Math.cos(a) * 220, n.y + Math.sin(a) * 220, { arrive: 30, hurry: true }); })(), 'flee');
          if (n.drink && Math.random() < 0.5) N.spillDrink(n, Math.random() * 6, 1);
        } else if (r < 0.75 && brave > 0.8) {
          // a hero tries to help (sometimes it works, sometimes there are now three people fighting)
          N.setTask(n, (function* () { yield* N.go(n, f.x, f.y, { arrive: 30, hurry: true }); N.shout(n, U.pick(HELP)); const m = [...f.members.keys()][0]; if (m && Math.random() < 0.5) { LC.Social.removeFighter(m); LC.Aura && LC.stat('crowdHeroes'); } else if (m && LC.Social.bystanderHit) LC.Social.bystanderHit(n, m, f); })(), 'help');
        } else if (r < 0.88) { N.emote(n, 'anger', 1.5); N.shout(n, U.pick(['Ooooh!', 'HE FELL OVER', 'Unbelievable.', '*gasp*'])); }
      }
    }
  }
  function zoneTick(g) {
    for (let i = F.zones.length - 1; i >= 0; i--) {
      const z = F.zones[i];
      if (g.t - z.t0 > z.dur) { F.zones.splice(i, 1); continue; }
      for (const n of g.npcs) {
        if (n.kind !== 'guest' || n.state !== 'inside' || n.escorted || n.seat) continue;
        const d = U.dist(n.x, n.y, z.x, z.y);
        if (d > z.r) continue;
        const f = LC.Social.fightOf(n); if (f) { LC.Social.removeFighter(n); LC.stat('fightsPrevented'); LC.Aura.add(40, 'Dispersed a fight'); }
        if (n.taskName === 'dispersed') continue;
        const a = d < 2 ? Math.random() * 6.28 : Math.atan2(n.y - z.y, n.x - z.x);
        N.setTask(n, (function* () { if (Math.random() < 0.3) N.say(n, U.pick(['Okay okay!', 'Why is the floor red?', 'Am I in trouble?', 'Moving! Moving!']), { pri: 1 }); yield* N.go(n, z.x + Math.cos(a) * (z.r + 50), z.y + Math.sin(a) * (z.r + 50), { arrive: 24, hurry: true }); yield* N.wait(n, 3); })(), 'dispersed');
      }
    }
  }

  /* ================= the floor show: events that just happen ================= */
  const danceSpots = () => S.dance;
  function pickGuests(k, room) { return U.shuffle(G().npcs.filter((n) => free(n) && (!room || M.inRoom(n.x, n.y, room)))).slice(0, k); }
  function watch(n, x, y, dur, lines) {
    N.setTask(n, (function* () { const a = Math.random() * 6.28, d = U.rand(60, 95); yield* N.go(n, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, { arrive: 14 }); let t = 0; while (t < dur) { t += G().dt; N.faceTo(n, x, y); n.act = Math.sin(t * 6 + n.seed * 9) > 0.6 ? 'wave' : 'stand'; if (lines && Math.random() < G().dt * 0.12) N.shout(n, U.pick(lines)); yield; } })(), 'watch');
  }
  function burst(kind, x, y, n, o = {}) { for (let i = 0; i < n; i++) Wd.part(kind, x + U.rand(-10, 10), y + U.rand(-10, 10), Object.assign({ z: o.z || 40, vx: U.rand(-1, 1) * (o.s || 160), vy: U.rand(-1, 1) * (o.s || 160), vz: U.rand(80, 320), c: o.c && U.pick(o.c) }, o.o || {})); }
  const CONF = [[255, 79, 168], [74, 240, 255], [255, 225, 74], [138, 255, 106], [181, 106, 255]];
  const SHOW = {
    danceOff(g) {
      const [a, b] = pickGuests(2, 'dance'); if (!a || !b) return null;
      const c = U.pick(danceSpots());
      for (const w of pickGuests(12, 'dance')) if (w !== a && w !== b) watch(w, c.x, c.y, 28, ['GO GO GO!', 'He is DONE.', 'ROBOT! DO THE ROBOT!', 'She ate that.', 'Ooooooh!']);
      [a, b].forEach((n, i) => N.setTask(n, (function* () { yield* N.go(n, c.x + (i ? 24 : -24), c.y, { arrive: 8 }); let t = 0; while (t < 28) { t += g.dt; n.act = 'dance'; n.danceStyle = ((t * 0.7) | 0 + i) % 6; n.energy = 1.4; yield; } N.shout(n, i ? 'I WON.' : 'I WON!'); })(), 'danceoff'));
      setTimeout(() => burst('confetti', c.x, c.y, 60, { c: CONF }), 27000);
      return { title: 'DANCE-OFF', sub: a.name + ' vs ' + b.name + '. Nobody asked for this. Everybody is watching.', x: c.x, y: c.y };
    },
    moshPit(g) {
      const crew = pickGuests(12, 'dance'); if (crew.length < 6) return null;
      const c = U.pick(danceSpots());
      crew.forEach((n) => N.setTask(n, (function* () { yield* N.go(n, c.x + U.rand(-50, 50), c.y + U.rand(-40, 40), { arrive: 20 }); let t = 0; while (t < 35 && !F.zones.some((z) => U.dist(z.x, z.y, n.x, n.y) < z.r)) { t += g.dt; n.act = 'dance'; n.danceStyle = 5; if (Math.random() < g.dt * 1.2) { const a = Math.random() * 6.28; n.body.vx += Math.cos(a) * 260; n.body.vy += Math.sin(a) * 200; } if (Math.random() < g.dt * 0.03) N.knockDown(n, Math.random() * 6, 0.7); if (Math.random() < g.dt * 0.08) N.shout(n, U.pick(['CIRCLE PIT!', 'WALL OF DEATH!', 'AAAAAA', 'For the plot!'])); yield; } })(), 'mosh'));
      return { title: 'A MOSH PIT HAS FORMED', sub: 'To house music. People are flying. Use a dispersal zone (2) or the airhorn (3).', x: c.x, y: c.y, danger: true };
    },
    crowdSurf(g) {
      const [n] = pickGuests(1, 'dance'); if (!n) return null;
      const a = U.pick(danceSpots()), b = U.pick(danceSpots());
      N.setTask(n, (function* () { yield* N.go(n, a.x, a.y, { arrive: 12 }); N.shout(n, 'CATCH ME!'); n.body.ghost = true; n.body.pinned = true; let t = 0; const dur = 18; while (t < dur) { t += g.dt; const k = t / dur; n.body.x = a.x + (b.x - a.x) * k; n.body.y = a.y + (b.y - a.y) * k; n.z = 52 + Math.sin(t * 5) * 4; n.act = 'lie'; n.fallK = 1; if (Math.random() < g.dt * 0.2) N.shout(n, U.pick(['I AM A GOD', 'WHEEE', 'HANDS! MORE HANDS!'])); yield; } n.body.ghost = false; n.body.pinned = false; n.z = 0; n.act = null; n.fallK = 0; if (Math.random() < 0.6) { N.knockDown(n, 0, 1); n.needsAid = true; I().emergent('injured', n, {}); N.shout(n, 'nobody... caught me...'); } })(), 'surf');
      return { title: 'SOMEONE IS CROWD-SURFING', sub: 'There are not enough hands. There are never enough hands.', who: n };
    },
    limbo(g) {
      const line = pickGuests(9, 'hall'); if (line.length < 4) return null;
      const x0 = 40 * T, y = 36 * T;
      line.forEach((n, i) => N.setTask(n, (function* () { yield* N.go(n, x0 + i * 26, y, { arrive: 10 }); let t = 0; while (t < 25) { t += g.dt; const turn = ((t * 0.6) | 0) % line.length === i; n.act = turn ? 'crouch' : 'wave'; if (turn && Math.random() < g.dt * 0.6) N.shout(n, U.pick(['HOW LOW', 'my BACK', 'LIMBOOO'])); if (turn && Math.random() < g.dt * 0.08) N.knockDown(n, 1.5, 0.6); yield; } })(), 'limbo'));
      return { title: 'IMPROMPTU LIMBO', sub: 'The bar is a mop. Your mop.', x: x0 + 100, y };
    },
    champagne(g) {
      const vt = U.pick(M.vipTables), cx = vt.cx, cy = vt.cy;
      let k = 0; const iv = setInterval(() => { if (++k > 24 || !G()) { clearInterval(iv); return; } burst('drop', cx, cy, 14, { c: [[255, 236, 160]], s: 220 }); Wd.spill(cx + U.rand(-90, 90), cy + U.rand(-70, 70), [255, 236, 160], 0.8); }, 400);
      return { title: 'CHAMPAGNE SHOWER IN VIP', sub: 'A man with a bottle and no plan. The floor is now a slip-and-slide.', x: cx, y: cy };
    },
    foam(g) {
      const c = { x: 46 * T, y: 21 * T };
      let k = 0; const iv = setInterval(() => { if (++k > 40 || !G()) { clearInterval(iv); return; } for (let i = 0; i < 4; i++) { const x = c.x + U.rand(-300, 300), y = c.y + U.rand(-220, 220); Wd.part('powder', x, y, { z: 10, size: 2.2 }); if (Math.random() < 0.3) Wd.addMess('water', x, y, { r: 14 }); } }, 250);
      LC.Radio.convo([['krank', 'FOAM PARTYYYYY'], ['petrakis', 'We do not OWN a foam cannon.'], ['krank', 'We do now.']]);
      return { title: 'FOAM PARTY (UNAUTHORISED)', sub: 'DJ Krank found a foam cannon. Everything is slippery. Signs, mop, prayer.', x: c.x, y: c.y };
    },
    confetti(g) {
      const c = U.pick(danceSpots());
      for (let i = 0; i < 4; i++) setTimeout(() => { burst('confetti', c.x, c.y, 80, { c: CONF, s: 260, z: 90 }); Wd.addMess('confetti', c.x + U.rand(-100, 100), c.y + U.rand(-80, 80), { r: 30 }); }, i * 700);
      LC.sfx('pop', c.x, c.y, { vol: 1.2 });
      return { title: 'CONFETTI CANNON', sub: 'Someone fired it at head height. Into a man. He is fine. He is sparkly.', x: c.x, y: c.y };
    },
    karaoke(g) {
      const [n] = pickGuests(1); if (!n) return null;
      N.setTask(n, (function* () { yield* N.go(n, S.djTouch.x, S.djTouch.y + 40, { perm: P.ALL, arrive: 14 }); let t = 0; while (t < 26) { t += g.dt; n.act = 'wave'; if (Math.random() < g.dt * 2) Wd.part('note', n.x, n.y, { z: 50, vx: U.rand(-20, 20) }); if (Math.random() < g.dt * 0.3) N.shout(n, U.pick(SONG)); yield; } })(), 'karaoke');
      for (const w of pickGuests(8, 'dance')) watch(w, S.djTouch.x, S.djTouch.y + 60, 24, ['OFF! OFF!', 'ENCORE!', 'Is this a hate crime?', 'He is FLAT.']);
      return { title: 'THERE IS NO KARAOKE. HE IS DOING KARAOKE.', sub: n.name + ' found the DJ mic.', who: n };
    },
    armWrestle(g) {
      const [a, b] = pickGuests(2, 'bar'); if (!a || !b) return null;
      const tb = Wd.props.find((p) => p.kind === 'table' && !p.fallen && !p.carriedBy && M.inRoom(p.body.x, p.body.y, 'bar')); if (!tb) return null;
      [a, b].forEach((n, i) => N.setTask(n, (function* () { yield* N.go(n, tb.body.x + (i ? 22 : -22), tb.body.y, { arrive: 8 }); let t = 0; while (t < 16) { t += g.dt; N.faceTo(n, tb.body.x, tb.body.y); n.act = 'grab'; n.exprLock = true; n.expr = t > 8 ? 'furious' : 'angry'; yield; } n.exprLock = false; if (i) { Wd.tip(tb, 0, 1); N.shout(n, 'REMATCH!'); if (LC.Director.allow('argument')) LC.Social.startArgument(a, b, 'bump'); } })(), 'wrestle'));
      for (const w of pickGuests(6, 'bar')) watch(w, tb.body.x, tb.body.y, 16, ['GO ON!', 'Twenty quid on the small one.', 'Veins! VEINS!']);
      return { title: 'ARM WRESTLING. ON A COCKTAIL TABLE.', sub: 'The table was not built for this. Neither were they.', x: tb.body.x, y: tb.body.y };
    },
    flashMob(g) {
      const crew = pickGuests(16, 'dance'); if (crew.length < 8) return null;
      const st = U.randi(0, 5);
      crew.forEach((n, i) => N.setTask(n, (function* () { yield* N.wait(n, U.rand(0, 1)); const sp = S.dance[i * 3 % S.dance.length]; yield* N.go(n, sp.x, sp.y, { arrive: 10 }); let t = 0; while (t < 20) { t += g.dt; n.act = t > 16 ? 'stand' : 'dance'; n.danceStyle = st; n.energy = 1.4; n.face = Math.PI / 2; yield; } N.say(n, U.pick(['*freezes*', 'Nailed it.', '...was that the plan?'])); })(), 'flashmob'));
      setTimeout(() => burst('spark', 46 * T, 21 * T, 40, { s: 400, z: 120 }), 16000);
      return { title: 'FLASH MOB', sub: 'Sixteen strangers. One choreography. Zero permission.', x: 46 * T, y: 21 * T };
    },
  };
  const SONG = ['IIIIII WILL ALWAYS LOVE YOUUUUU', "IT'S RAINING MEN", 'ISN\'T SHE LOVELYYY', 'SWEET CAROLINE (BA BA BAAA)', 'MY HEART WILL GO OOOON', 'WONDERWALL. ALL OF IT.'];
  F.startShow = (name) => {
    const g = G(), fn = SHOW[name];
    if (!fn) return null;
    const r = fn(g);
    if (!r) return null;
    LC.Objectives.flash(r.title, r.sub);
    LC.stat('floorShows');
    F.active.push(Object.assign({ name, t0: g.t }, r));
    return r;
  };
  F.SHOWS = Object.keys(SHOW);

  /* ================= the masquerade of the Red Death ================= */
  // after 2 AM the night turns: red fog outside, masked strangers, and a figure in red
  F.redDeath = () => {
    const g = G();
    if (g.redDeath) return;
    g.redDeath = { t0: g.t, figure: null };
    LC.Radio.convo([['marcus', 'Unit Four. There is a fog outside. It is red.'], ['you', 'Red.'], ['marcus', 'And a group in masks. Plague doctor masks. They say it is a masquerade.'], ['petrakis', 'We are not HAVING a masquerade.'], ['marcus', 'They say we are now.']]);
    LC.Objectives.flash('THE MASQUE OF THE RED DEATH', 'Something has come in from the fog. Do not let it touch the guests.');
    const grp = LC.Director.spawnGroup(7, { theme: { look: (lk, i) => { lk.top = 'suit'; lk.topC = i === 0 ? '#7a0010' : '#141414'; lk.bot = 'pants'; lk.botC = i === 0 ? '#5a000c' : '#111'; lk.hat = i === 0 ? 'veil' : 'police'; lk.glasses = 'sun'; lk.beard = null; lk.height = i === 0 ? 1.12 : 1; }, setup: (n, i) => { n.sob = 1; n.name = i === 0 ? 'The Figure in Red' : U.pick(['A Plague Doctor', 'The Masked Guest', 'Someone in a Beak']); n.flags.masked = true; } } });
    const fig = grp.members[0];
    g.redDeath.figure = fig;
    for (const m of grp.members) {
      LC.Door.remove(m);
      N.setTask(m, (function* () { yield* N.go(m, S.inside.x, S.inside.y, { perm: P.ALL, arrive: 20 }); m.state = 'inside'; m.perm = P.GUEST; m.arrivedAt = g.clock;
        if (m === fig) { const inc = I().start('redDeath', m); if (inc) I().notice(inc, 'radio'); return; }
        for (;;) { const sp = U.pick(S.dance); yield* N.go(m, sp.x, sp.y, { arrive: 20 }); m.act = 'stand'; N.faceTo(m, G().player.x, G().player.y); if (Math.random() < 0.3) N.say(m, U.pick(['The hour is late.', 'Dance, while you can.', 'We were invited. By the fog.', '...', 'Have you seen the clock? It is ebony.']), { pri: 1 }); yield* N.wait(m, U.rand(4, 9)); } })(), 'masque');
    }
  };
  LC.Incidents.defs.redDeath = {
    title: () => 'THE FIGURE IN RED', sub: 'Wherever it walks, people faint. Throw it out before the whole floor goes down.', brief: 'spreading something', sev: 3, timeout: 200, noticeR: 900, loud: true,
    *script(n, inc) {
      for (;;) {
        if (!LC.Incidents.alive(inc, n)) return;
        const v = G().npcs.filter((o) => free(o) && U.dist(o.x, o.y, n.x, n.y) < 600)[0];
        if (!v) { yield* N.wait(n, 1); continue; }
        N.goTo(n, v.x, v.y, { arrive: 14, speed: 55 });
        let t = 0;
        while (t < 8 && U.dist(n.x, n.y, v.x, v.y) > 22 && LC.Incidents.alive(inc, n)) { t += G().dt; n.act = 'point'; if (Math.random() < G().dt * 3) Wd.part('smoke', n.x, n.y, { z: 30, c: [200, 20, 30], size: 1.4 }); yield; }
        if (U.dist(n.x, n.y, v.x, v.y) <= 24 && !v.gone) { N.shout(v, U.pick(['...so cold...', 'Who turned the music red?', 'I feel... ebony.', 'Is it 4 already?'])); N.knockDown(v, Math.random() * 6, 1.2); v.needsAid = true; I().emergent('injured', v, {}); LC.stat('redDeathVictims'); for (let i = 0; i < 20; i++) Wd.part('smoke', v.x, v.y, { z: 20, vx: U.rand(-60, 60), vy: U.rand(-60, 60), c: [180, 10, 20], size: 1.2 }); }
        yield* N.wait(n, 2);
      }
    },
    talk: () => ({ open: ['...', 'The clock strikes.', 'All dance. All fall.', 'You cannot eject what is already inside.'],
      opts: [{ text: 'Mask off. And out.', tag: 'WARN', bonus: -0.3 }, { text: 'Love the costume. Hate the vibe.', tag: 'SNARK', bonus: -0.25 }, { text: 'Is that fog machine yours?', tag: 'CALM', bonus: -0.3 }, { text: 'Out.', tag: 'OUT' }] }),
    comply(inc) { I().resolve(inc, 'talk', 'It bowed. It left. The fog went with it. Nobody will talk about this.'); endRed(); },
    onResolve() { endRed(); LC.Aura.add(250, 'Threw out Death itself'); },
    onTimeout(inc) { I().fail(inc, 'timeout', 'It left on its own, at its own pace. Several guests are still lying down.'); endRed(); },
    resolved: { any: ['The Red Death has left the building. The fog lifts.'], eject: ['You threw Death out of a nightclub. Put that on your CV.'] },
  };
  function endRed() { const g = G(); if (!g.redDeath) return; g.redDeath.over = true; for (const n of g.npcs) if (n.flags && n.flags.masked && !n.gone && n.state === 'inside') N.setTask(n, N.tLeave(n, { noCoat: true }), 'leave'); }

  /* ================= talk generator ================= */
  // openers x player lines x replies: thousands of ways a chat can go
  const OPEN = ['Heyyy, security!', 'Am I in trouble? I feel like I\'m in trouble.', 'Do you work here or are you just very serious?', 'Settle something. Is a hot dog a sandwich?', 'My ex is here. Act natural.', 'Is the toilet supposed to be ankle deep?', 'Can you hold my drink? Forever?', 'I have never been this happy and I hate it.', 'Rate my outfit. Out of ten. Lie.', 'Is it true the flamingo is haunted?', 'I lost my friend. She looks like me but sadder.', 'What time is it? Don\'t answer. I don\'t want to know.', 'Do you know any good afterparties? Asking for everyone.', 'I just got dumped by text. In emojis.', 'Is the DJ single?', 'This is my first night out in three years. I have twins.', 'I think I just did something legendary.', 'I am a LinkedIn influencer.', 'Do you ever just... dance? Alone? At work?', 'I found a tooth on the floor. Not mine.', 'How many people have you thrown out tonight?', 'Is that a real earpiece?', "I'm a vegan. Is the floor vegan?", 'Quick, look busy, my boss is here.', 'They played my song. I cried. In a good way.', 'Your aura is crazy. Positive. I think.', 'Can I tell you a secret? I am thirty-nine.', 'I just proposed. She said "maybe".', "I've had nine Red Bulls. I can see sounds.", 'I bet you could fit four of me in that jacket.'];
  const MINE = {
    ASK: ['Evening.', 'You good?', 'Having a nice night?', 'What are we celebrating?', 'Who are you here with?', 'Talk to me.', 'Everything alright here?', "What's your name, again?"],
    SNARK: ['I get paid by the hour. Keep going.', 'Fascinating. Truly.', 'I have been awake since Tuesday.', 'Bold of you to assume I care.', 'Write it down. I will read it never.', 'Is this going to be on the test?', 'That is the least worrying thing I have heard tonight.', 'Riveting. Next.', 'I came here to mop, not to feel.', 'Sir, this is a nightclub.', 'You are describing a cry for help.', 'Put that in your memoir.', 'My will to live just dropped a percent.', 'Noted. Ignored.'],
    HELP: ['Have some water.', 'Sit down for a minute.', 'Let\'s find your friends.', 'Breathe. Then drink water.', 'Want a taxi?', 'You need a snack and a nap.'],
    WARN: ['Keep it sensible.', 'One more and you\'re out.', 'Easy. I\'m watching you.', 'Behave and we\'re friends.'],
  };
  const REPLY = {
    ASK: ['Best night EVER.', "I'm thriving. I'm also crying. Both.", 'My cousin\'s divorce party!', 'Nobody. I came alone. On purpose. Ish.', 'I am Gemma. Or Jenna. One of those.', 'I love you, man.', 'Fine! FINE! Why is everyone asking?', "Ask me again in an hour.", 'The vibes are immaculate.', 'I lost a shoe but gained a friend.'],
    SNARK: ['Wow. Okay. Wow.', 'Rude. I like you.', 'You are SO funny. I am going to cry.', 'I\'m telling my mum.', 'That was mean and accurate.', 'Ha! ...wait.', 'Okay, Shakespeare.', 'I will remember this when I am famous.', 'Do you do weddings?', 'Is that allowed?'],
    HELP: ['Water? Groundbreaking.', 'You are the best person here.', 'Okay but only because you asked nicely.', 'My hero. My big quiet hero.', 'I am drinking it. Watch me drink it.'],
    WARN: ['Yes sir. Yes boss.', 'I am being SO good.', 'Okay. Okay okay okay.', 'Message received. Partially.'],
  };
  F.chat = (ctx, n) => {
    const p = G().player;
    ctx.open = U.pick(OPEN);
    const tags = U.shuffle(['ASK', 'SNARK', 'SNARK', 'HELP', 'WARN']).slice(0, 3);
    ctx.opts = tags.map((tag) => ({ text: U.pick(MINE[tag]), tag, fn: () => {
      if (tag === 'HELP' && p.inv.water > 0 && Math.random() < 0.6) { LC.Player.useWater(n); return; }
      N.say(n, U.pick(REPLY[tag]), { pri: 2 });
      if (tag === 'SNARK') { if (Math.random() < 0.6) { LC.Aura.add(25, 'Nailed a one-liner'); N.emote(n, 'sweat', 1.5); } else { LC.Aura.add(-15, 'Joke did not land'); n.mood.anger = Math.min(1, n.mood.anger + 0.2); } }
      if (tag === 'ASK' && Math.random() < 0.15 && LC.Incidents) { // sometimes chatting turns up a lead
        const inc = LC.Incidents.active.find((q) => !q.noticed && !q.reported);
        if (inc) { setTimeout(() => N.say(n, 'Oh! Also. ' + (inc.def.brief ? 'Someone is ' + inc.def.brief + ' in the ' + inc.roomName().toLowerCase() + '.' : 'Something weird is happening in the ' + inc.roomName().toLowerCase() + '.'), { pri: 2 }), 1600); LC.Incidents.notice(inc, 'told'); }
      }
    } }));
    ctx.opts.push({ text: U.pick(["You're leaving.", 'Out. Now.', 'Night\'s over for you.', 'Exit is that way. Use it.']), tag: 'OUT', fn: () => { N.say(n, U.pick(['What?! What did I DO?', 'I literally just said hi.', 'Is this because of the hot dog thing?']), { pri: 3 }); LC.Dialogue.eject(n); } });
    return true;
  };

  /* ================= exits ================= */
  F.exits = () => ['entrance', 'emergency', 'kitchenBack', 'staffDoor', 'patioGate'].map((id) => M.door(id)).filter((d) => d && !(d.kind === 'gate' && d.locked && d.open < 0.5));
  F.nearestExit = (x, y) => { let b = null, bd = 1e9; for (const d of F.exits()) { const dd = U.dist(x, y, d.cx, d.cy); if (dd < bd) { bd = dd; b = d; } } return b; };

  /* ================= overlay: zones + exit arrow ================= */
  F.drawOverlay = (g) => {
    const G2 = G(), R = LC.R, p = G2.player;
    if (!p || G2.demo) return;
    for (const z of F.zones) {
      const k = 1 - (G2.t - z.t0) / z.dur;
      g.strokeStyle = 'rgba(255,40,60,' + (0.4 + 0.4 * Math.sin(G2.t * 8)).toFixed(2) + ')'; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 32; i++) { const a = i / 32 * 6.283, s = R.toScreen(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 2); if (s.behind) continue; i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }
      g.stroke();
      const c = R.toScreen(z.x, z.y, 10);
      if (!c.behind) { g.font = '900 14px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ff3a4a'; g.fillText('DISPERSAL · ' + Math.ceil(k * z.dur) + 's', c.x, c.y); }
    }
    // dragging someone: the way out, loud and clear
    const showExit = p.grab || (p.ctx && p.ctx.tone === 'trouble');
    if (showExit) {
      const d = F.nearestExit(p.x, p.y);
      if (d) {
        const e = R.edgePoint ? R.edgePoint(d.cx, d.cy, 80, 80) : R.toScreen(d.cx, d.cy, 80);
        const bob = Math.sin(G2.t * 6) * 5;
        g.save(); g.translate(e.x, e.y + (e.on ? bob : 0)); if (!e.on) g.rotate(e.a + Math.PI / 2);
        g.fillStyle = '#3dff8a'; g.strokeStyle = '#002a10'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, e.on ? 18 : -22); g.lineTo(16, e.on ? -6 : 8); g.lineTo(6, e.on ? -6 : 8); g.lineTo(6, e.on ? -22 : 20); g.lineTo(-6, e.on ? -22 : 20); g.lineTo(-6, e.on ? -6 : 8); g.lineTo(-16, e.on ? -6 : 8); g.closePath(); g.fill(); g.stroke();
        g.restore();
        const label = 'EXIT · ' + Math.round(U.dist(p.x, p.y, d.cx, d.cy) / T) + 'm' + (p.grab ? (LC.Eject.nearExit(p.grab.npc) ? ' · SPACE TO THROW' : ' · DRAG THEM HERE') : '');
        g.font = '900 16px "Big Shoulders Display", sans-serif'; g.textAlign = 'center';
        const lx = U.clamp(e.x, 110, R.cw - 110), ly = U.clamp(e.y + (e.on ? -32 : e.y > R.ch / 2 ? -34 : 40), 20, R.ch - 12);
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(label, lx, ly); g.fillStyle = '#3dff8a'; g.fillText(label, lx, ly);
      }
    }
  };

  /* ================= update ================= */
  let showT = 70, crowdT = 0;
  F.update = (dt) => {
    const g = G();
    if (!g || g.demo) return;
    crowdT -= dt;
    if (crowdT <= 0) { crowdT = 0.5; crowdTick(g); }
    zoneTick(g);
    for (let i = F.active.length - 1; i >= 0; i--) if (g.t - F.active[i].t0 > 40) F.active.splice(i, 1);
    if (g.closing) return;
    // floor shows get more frequent as the night goes on
    showT -= dt;
    if (showT <= 0 && g.clock > 70) {
      showT = U.rand(55, 95) * (g.clock > 300 ? 0.6 : 1);
      const left = F.SHOWS.filter((s) => !F.active.some((a) => a.name === s));
      for (let k = 0; k < 4; k++) if (F.startShow(U.pick(left))) break;
    }
    if (!g.redDeath && g.clock > 300 + (g.nightIndex % 3) * 20 && g.nightIndex >= 1) F.redDeath();
    // the fog outside
    if (g.redDeath && !g.redDeath.over && Math.random() < dt * 6) Wd.part('smoke', U.rand(0, 96) * T, U.rand(49, 66) * T, { z: 10, c: [160, 10, 25], size: 3 });
  };
  F.reset = () => { F.zones.length = 0; F.placed.length = 0; F.active.length = 0; showT = 70; for (const k in cool) delete cool[k]; };
})();
