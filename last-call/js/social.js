/* Last Call — people being people to each other: bumps, spilled drinks, grudges, arguments
   that recruit friends (and strangers who just like arguing), fights with a ring of phones
   around them, crowd reactions to breaking glass, and the conga line. */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph, NPC: N, W: Wd } = LC;
  const T = M.T;
  const So = (LC.Social = {});
  const L = () => LC.Lines;

  /* ================= bumps ================= */
  function handleBump(bumper, victim, speed, nx, ny) {
    const G = LC.G;
    if (victim.kind === 'player') {
      if (bumper.kind === 'guest' && bumper.bumpT <= 0 && Math.random() < 0.3) {
        bumper.bumpT = 5;
        N.say(bumper, U.pick((1 - bumper.sob) > 0.6 ? L().bumpSecurityDrunk : L().bumpSecurity), { pri: 0 });
      }
      return;
    }
    if (victim.kind !== 'guest' || victim.bumpT > 0 || victim.seat || victim.override || victim.asleep) return;
    victim.bumpT = 3.5;
    const dir = Math.atan2(ny, nx);
    let spilled = false;
    if (victim.drink && speed > 55 && Math.random() < 0.3 + speed / 450) { N.spillDrink(victim, dir, 0.8); spilled = true; }
    if (bumper.kind === 'player') {
      if (Math.random() < (spilled ? 0.7 : 0.2)) N.say(victim, U.pick(spilled ? L().playerSpilled : L().playerBumped), { pri: 0 });
      if (spilled) LC.stat('drinksYouSpilled');
      if (LC.Player && LC.Player.sprinting() && Math.random() < 0.12) LC.stat('customerComplaints');
      return;
    }
    if (bumper.kind !== 'guest') return;
    const same = bumper.group && bumper.group === victim.group;
    const annoy = 0.08 + (spilled ? 0.45 : 0) + N.aggr(victim) * 0.42 + victim.tr.ego * 0.2 + (1 - victim.sob) * 0.18 - victim.tr.social * 0.25 - (same ? 0.7 : 0) + (victim.grudge === bumper ? 0.3 : 0);
    if (annoy > 0.58 && !bumper.override && !So.inArgument(bumper) && LC.Director && LC.Director.allow('argument')) {
      So.startArgument(victim, bumper, spilled ? 'spill' : 'bump');
    } else if (annoy > 0.34) {
      N.emote(victim, 'anger', 1.4);
      N.faceTo(victim, bumper.x, bumper.y);
      if (Math.random() < 0.5) N.say(victim, U.pick(L().bumpMild), { dim: true });
      if (Math.random() < bumper.tr.social) N.say(bumper, U.pick(L().sorry), { dim: true });
      victim.grudge = bumper;
      victim.mood.anger = Math.min(1, victim.mood.anger + 0.2);
    } else if (spilled && Math.random() < 0.5) N.say(victim, U.pick(L().spillSelf), { dim: true });
  }

  /* ================= arguments ================= */
  So.inArgument = (n) => LC.G.args.some((a) => a.roles.has(n));
  So.argumentOf = (n) => LC.G.args.find((a) => a.roles.has(n));
  So.startArgument = (a, b, cause) => {
    const G = LC.G;
    if (So.inArgument(a) || So.inArgument(b)) return null;
    const arg = { id: U.uid(), a, b, roles: new Map(), heat: 0.22 + N.aggr(a) * 0.1, t: 0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, cause, recruitT: 1.5, calm: 0, over: false };
    arg.roles.set(a, 'a'); arg.roles.set(b, 'b');
    G.args.push(arg);
    N.interrupt(a, oArgue(a, arg), 'argue', 6);
    N.interrupt(b, oArgue(b, arg), 'argue', 6);
    N.shout(a, U.pick(cause === 'spill' ? L().argueSpillOpen : L().argueOpen));
    LC.stat('arguments');
    if (LC.Incidents) arg.inc = LC.Incidents.emergent('argument', a, { arg });
    return arg;
  };
  function sideOf(arg, n) { const r = arg.roles.get(n); return r === 'a' || r === 'supA' ? 'a' : r === 'b' || r === 'supB' ? 'b' : null; }
  function* oArgue(n, arg) {
    const G = LC.G;
    n.exprLock = true;
    try {
      let lineT = U.rand(0.8, 2.2);
      while (!arg.over && arg.roles.has(n) && !n.gone) {
        const role = arg.roles.get(n);
        const main = role === 'a' || role === 'b';
        const opp = role === 'a' || role === 'supA' ? arg.b : role === 'b' || role === 'supB' ? arg.a : (Math.random() < 0.5 ? arg.a : arg.b);
        if (!opp || opp.gone) break;
        const self = role === 'supA' ? arg.a : role === 'supB' ? arg.b : n;
        // stand-off distance
        const want = main ? 26 : 44;
        const ang = Math.atan2(n.y - opp.y, n.x - opp.x);
        const tx = (main ? opp.x : self.x) + Math.cos(ang) * (main ? want : 18), ty = (main ? opp.y : self.y) + Math.sin(ang) * (main ? want : 18);
        const d = U.dist(n.x, n.y, tx, ty);
        if (d > 14) { n.body.vx += ((tx - n.x) / d) * 60 * G.dt * 8; n.body.vy += ((ty - n.y) / d) * 60 * G.dt * 8; }
        n.face = Math.atan2(opp.y - n.y, opp.x - n.x);
        n.act = role === 'peace' ? 'shrug' : 'argue';
        n.expr = role === 'peace' ? 'sad' : arg.heat > 0.65 ? 'furious' : 'angry';
        lineT -= G.dt;
        if (lineT <= 0) {
          lineT = U.rand(1.6, 3.2);
          const pool = role === 'peace' ? L().peacemaker : role === 'random' ? L().argueRandom : main ? (arg.heat > 0.6 ? L().argueHot : L().argue) : L().argueSupport;
          if (main || Math.random() < 0.6) (role === 'peace' ? N.say : N.shout)(n, U.pick(pool));
        }
        yield;
      }
    } finally { n.exprLock = false; n.act = null; }
  }
  function recruit(arg) {
    const G = LC.G;
    const near = Ph.query(arg.x, arg.y, 190, (b) => b.kind === 'char' && b.ent.kind === 'guest');
    for (const b of near) {
      const n = b.ent;
      if (arg.roles.has(n) || n.override || n.seat || n.asleep || n.state !== 'inside') continue;
      if (arg.roles.size >= 8) break;
      const friendOf = n.group && n.group === arg.a.group ? 'a' : n.group && n.group === arg.b.group ? 'b' : null;
      if (friendOf && Math.random() < n.tr.loyalty) {
        const peace = n.tr.social > 0.55 && N.aggr(n) < 0.45;
        arg.roles.set(n, peace ? 'peace' : friendOf === 'a' ? 'supA' : 'supB');
        N.interrupt(n, oArgue(n, arg), 'argue', 6);
        N.say(n, U.pick(peace ? L().peacemaker : L().argueJoinFriend), { pri: 1 });
      } else if (!friendOf && N.cs(n) < 0.3 && n.tr.energy > 0.55 && (1 - n.sob) > 0.45 && Math.random() < 0.35) {
        // somebody unrelated joins for no reason
        arg.roles.set(n, 'random');
        N.interrupt(n, oArgue(n, arg), 'argue', 6);
        N.shout(n, U.pick(L().argueRandomJoin));
        LC.stat('strangersJoined');
      }
    }
  }
  So.calmArgument = (arg, amount) => { arg.calm += amount; arg.heat -= amount; };
  So.endArgument = (arg, how) => {
    const G = LC.G;
    if (arg.over) return;
    arg.over = true;
    for (const [n] of arg.roles) {
      if (n.overrideName === 'argue') N.endOverride(n);
      n.mood.anger = how === 'fight' ? 1 : Math.max(0, n.mood.anger - 0.3);
    }
    const i = G.args.indexOf(arg);
    if (i >= 0) G.args.splice(i, 1);
    if (arg.inc && LC.Incidents) LC.Incidents.argumentEnded(arg, how);
  };
  function updateArgument(arg, dt) {
    const G = LC.G;
    arg.t += dt;
    for (const [n] of arg.roles) if (n.gone || n.state !== 'inside') arg.roles.delete(n);
    if (!arg.roles.has(arg.a) || !arg.roles.has(arg.b)) { So.endArgument(arg, 'dissolved'); return; }
    arg.x = (arg.a.x + arg.b.x) / 2; arg.y = (arg.a.y + arg.b.y) / 2;
    let sup = 0, peace = 0, rnd = 0;
    for (const [, r] of arg.roles) { if (r === 'supA' || r === 'supB') sup++; else if (r === 'peace') peace++; else if (r === 'random') rnd++; }
    const k = (LC.Director ? LC.Director.chaos() : 1);
    arg.heat += dt * (0.012 + (N.aggr(arg.a) + N.aggr(arg.b)) * 0.022 + ((2 - arg.a.sob - arg.b.sob) * 0.01) + sup * 0.008 + rnd * 0.012 - peace * 0.02) * k;
    arg.recruitT -= dt;
    if (arg.recruitT <= 0) { arg.recruitT = 2; recruit(arg); }
    if (arg.heat >= 1 && (!LC.Director || LC.Director.allow('fight'))) {
      const f = So.startFight([...arg.roles].filter(([, r]) => r !== 'peace').map(([n, r]) => [n, r === 'a' || r === 'supA' ? 0 : r === 'b' || r === 'supB' ? 1 : Math.random() < 0.5 ? 0 : 1]), arg);
      So.endArgument(arg, f ? 'fight' : 'dissolved');
      return;
    }
    if (arg.heat >= 1) arg.heat = 0.9;
    if (arg.heat <= 0 || arg.t > 60) So.endArgument(arg, arg.calm > 0.2 ? 'calmed' : 'dissolved');
  }

  /* ================= fights ================= */
  So.fightNear = (x, y, r) => LC.G.fights.find((f) => U.dist(f.x, f.y, x, y) < r);
  So.fightOf = (n) => LC.G.fights.find((f) => f.members.has(n));
  So.startFight = (pairs, arg) => {
    const G = LC.G;
    const f = { id: U.uid(), members: new Map(), t: 0, x: 0, y: 0, crowd: new Set(), hits: 0, over: false, broken0: G.stats.brokenFurniture || 0, level: 5 };
    for (const [n, side] of pairs) {
      if (n.gone || n.kind !== 'guest') continue;
      f.members.set(n, side);
    }
    if (f.members.size < 2) return null;
    G.fights.push(f);
    for (const [n] of f.members) N.interrupt(n, oFight(n, f), 'fight', 7);
    const [x, y] = center(f);
    f.x = x; f.y = y;
    LC.stat('fights');
    LC.sfx('crowdOoh', x, y);
    So.noise(x, y, 'fight', 1.5);
    if (LC.Incidents) f.inc = LC.Incidents.emergent('fight', [...f.members.keys()][0], { fight: f, fromArg: arg });
    return f;
  };
  function center(f) {
    let x = 0, y = 0, c = 0;
    for (const [n] of f.members) { x += n.x; y += n.y; c++; }
    return c ? [x / c, y / c] : [f.x, f.y];
  }
  So.removeFighter = (n, how) => {
    const f = So.fightOf(n);
    if (!f) return;
    f.members.delete(n);
    if (n.overrideName === 'fight' && how !== 'keep') N.endOverride(n);
  };
  So.endFight = (f, how) => {
    const G = LC.G;
    if (f.over) return;
    f.over = true;
    for (const [n] of f.members) if (n.overrideName === 'fight') N.endOverride(n);
    for (const n of f.crowd) if (n.overrideName === 'watch') N.endOverride(n);
    const i = G.fights.indexOf(f);
    if (i >= 0) G.fights.splice(i, 1);
    if (f.inc && LC.Incidents) LC.Incidents.fightEnded(f, how);
  };
  function* oFight(n, f) {
    const G = LC.G;
    n.exprLock = true;
    n.act = 'fight';
    try {
      let cd = U.rand(0.2, 0.6), shoutT = U.rand(1, 3);
      while (!f.over && f.members.has(n) && !n.gone) {
        const side = f.members.get(n);
        let opp = null, od = 1e9;
        for (const [o, s] of f.members) if (s !== side && !o.gone) { const d = U.dist(n.x, n.y, o.x, o.y); if (d < od) { od = d; opp = o; } }
        if (!opp) break;
        n.face = Math.atan2(opp.y - n.y, opp.x - n.x);
        n.expr = 'furious';
        n.act = 'fight';
        if (od > 24) {
          const sp = 105 + N.aggr(n) * 30;
          n.body.vx += ((opp.x - n.x) / od) * sp * G.dt * 7; n.body.vy += ((opp.y - n.y) / od) * sp * G.dt * 7;
          if (od > 260) { f.members.delete(n); break; }
        }
        cd -= G.dt;
        if (cd <= 0 && od < 34) {
          // wind up, swing
          n.punchSide = Math.random() < 0.5;
          let t = 0;
          while (t < 0.26) { t += G.dt; n.punch = -0.3 * (t / 0.26); yield; }
          t = 0;
          while (t < 0.09) { t += G.dt; n.punch = t / 0.09; yield; }
          const hx = n.x + Math.cos(n.face) * 22, hy = n.y + Math.sin(n.face) * 16;
          const hitOpp = !opp.gone && U.dist(hx, hy, opp.x, opp.y) < 22 && Math.random() < 0.6 + (1 - opp.sob) * 0.2 - (1 - n.sob) * 0.25;
          if (hitOpp) landHit(n, opp, f);
          else {
            // wild swing, maybe into a stranger
            const by = Ph.query(hx, hy, 16, (b) => b.kind === 'char' && b.ent !== n && b.ent !== opp && b.ent.kind === 'guest');
            if (by.length) { landHit(n, by[0].ent, f); So.bystanderHit(by[0].ent, n, f); }
            else if (Math.random() < 0.4) N.say(n, U.pick(L().fightMiss), { dim: true });
          }
          yield* N.wait(n, 0.12);
          n.punch = 0;
          cd = U.rand(0.45, 1.0) * (1.2 - N.aggr(n) * 0.4);
        }
        shoutT -= G.dt;
        if (shoutT <= 0) { shoutT = U.rand(2, 4); N.shout(n, U.pick(L().fightShout)); }
        yield;
      }
    } finally { n.exprLock = false; n.act = null; n.punch = 0; }
  }
  function landHit(n, v, f) {
    const G = LC.G;
    const dir = Math.atan2(v.y - n.y, v.x - n.x);
    v.body.vx += Math.cos(dir) * 210; v.body.vy += Math.sin(dir) * 150;
    v.daze = (v.daze || 0) + 0.2 + N.aggr(n) * 0.12 + Math.random() * 0.1;
    v.mood.anger = 1;
    f.hits++;
    LC.stat('punches');
    LC.sfx('punch', v.x, v.y);
    Wd.part('pow', (n.x + v.x) / 2, (n.y + v.y) / 2, { z: 34, text: U.pick(['POW', 'WHAP', 'OOF', 'BAP', 'THWACK']) });
    if (v.drink) N.spillDrink(v, dir, 1.2);
    LC.R.cam.shake = Math.max(LC.R.cam.shake, LC.G.player && U.dist(G.player.x, G.player.y, v.x, v.y) < 300 ? 2.5 : 0);
    if (v.kind === 'player') { if (LC.Player) LC.Player.hit(n, dir); return; }
    if (v.daze >= 1) {
      v.injured = 1;
      LC.stat('knockedOut');
      So.removeFighter(v, 'keep');
      N.interrupt(v, N.oFallen(v, dir, 2.2, false), 'fallen', 9);
      v.needsAid = true;
      if (LC.Incidents) LC.Incidents.emergent('injured', v, {});
    }
  }
  So.bystanderHit = (v, by, f) => {
    if (!f || f.members.has(v) || v.kind !== 'guest') return;
    if (N.aggr(v) > 0.45 && Math.random() < 0.7) {
      f.members.set(v, f.members.get(by) === 0 ? 1 : 0);
      N.interrupt(v, oFight(v, f), 'fight', 7);
      N.shout(v, U.pick(L().fightBystanderJoin));
      LC.stat('strangersJoined');
    } else N.say(v, U.pick(L().fightBystanderHurt), { pri: 1 });
  };
  function* oWatch(n, f) {
    const G = LC.G;
    const film = Math.random() < 0.55;
    n.phoneUp = film; n.filming = film;
    const a0 = Math.atan2(n.y - f.y, n.x - f.x);
    const rad = U.rand(66, 105);
    let chantT = U.rand(1, 4), t = 0;
    try {
      while (!f.over && t < 30 && !n.gone) {
        t += G.dt;
        const tx = f.x + Math.cos(a0) * rad, ty = f.y + Math.sin(a0) * rad * 0.8;
        const d = U.dist(n.x, n.y, tx, ty);
        if (d > 10) { n.body.vx += ((tx - n.x) / d) * 70 * G.dt * 6; n.body.vy += ((ty - n.y) / d) * 70 * G.dt * 6; }
        n.face = Math.atan2(f.y - n.y, f.x - n.x);
        n.act = film ? 'phone' : 'argue';
        chantT -= G.dt;
        if (chantT <= 0) { chantT = U.rand(2.5, 5); N.shout(n, U.pick(L().fightChant), { dim: true }); }
        yield;
      }
    } finally { n.phoneUp = false; n.filming = false; n.act = null; f.crowd.delete(n); }
  }
  function* oFlee(n, x, y) {
    const G = LC.G;
    n.exprLock = true; n.expr = 'scared';
    try {
      const a = Math.atan2(n.y - y, n.x - x);
      const p = M.nearest(n.x + Math.cos(a) * 180, n.y + Math.sin(a) * 180, n.perm, 5);
      if (p) yield* N.go(n, p.x, p.y, { hurry: true, arrive: 20, timeout: 6 });
      yield* N.wait(n, U.rand(1, 3));
    } finally { n.exprLock = false; }
  }
  function updateFight(f, dt) {
    const G = LC.G;
    f.t += dt;
    for (const [n] of f.members) if (n.gone || n.state !== 'inside' && n.state !== 'staff' || n.overrideName !== 'fight' && n.overrideName !== 'escorted') f.members.delete(n);
    const [x, y] = center(f);
    f.x = x; f.y = y;
    const sides = new Set(f.members.values());
    if (f.members.size < 2 || sides.size < 2) { So.endFight(f, f.separated ? 'separated' : 'burnout'); return; }
    // crowd forms a ring (or legs it)
    if (Math.random() < dt * 2) {
      const near = Ph.query(x, y, 230, (b) => b.kind === 'char' && b.ent.kind === 'guest');
      for (const b of near) {
        const n = b.ent;
        if (f.members.has(n) || f.crowd.has(n) || n.override || n.seat || n.asleep || n.state !== 'inside') continue;
        if (n.tr.fear > 0.62 || N.cs(n) > 0.75) N.interrupt(n, oFlee(n, x, y), 'flee', 4);
        else if (f.crowd.size < 16) { f.crowd.add(n); N.interrupt(n, oWatch(n, f), 'watch', 4); }
      }
    }
    // it escalates into a complete nightclub disaster
    const broken = (G.stats.brokenFurniture || 0) - f.broken0;
    if (!f.disaster && (f.members.size >= 5 || f.t > 40 || broken >= 2 || f.hits > 22)) {
      f.disaster = true;
      if (LC.Director) LC.Director.disaster(f);
    }
    if (f.t > 90) So.endFight(f, 'burnout');
  }

  /* ================= noise ================= */
  So.noise = (x, y, kind, loud = 1) => {
    const G = LC.G;
    if (!G) return;
    const near = Ph.query(x, y, 170 * loud, (b) => b.kind === 'char' && b.ent.kind === 'guest');
    let cheered = false;
    for (const b of near) {
      const n = b.ent;
      if (n.override || n.asleep) continue;
      if (!n.seat) n.face = Math.atan2(y - n.y, x - n.x);
      if (Math.random() < 0.25) N.emote(n, '!', 1);
      if (!cheered && kind === 'glass' && Math.random() < 0.35 && (1 - n.sob) > 0.3) { N.shout(n, U.pick(L().glassCheer), { dim: true }); cheered = true; }
    }
    if (LC.Director) LC.Director.heard(x, y, kind, loud);
  };

  /* ================= escort procession + conga ================= */
  // friends follow and complain, strangers mistake it for a conga line
  So.procession = null;
  So.startProcession = (target) => {
    const pr = { target, line: [target], friends: new Set(), conga: new Set(), t: 0 };
    So.procession = pr;
    if (target.group) {
      for (const m of target.group.members) {
        if (m === target || m.gone || m.override || m.state !== 'inside' || U.dist(m.x, m.y, target.x, target.y) > 320) continue;
        if (Math.random() < m.tr.loyalty * 0.9) { pr.friends.add(m); pr.line.push(m); N.interrupt(m, oFollowFriend(m, pr), 'followFriend', 5); }
      }
    }
    return pr;
  };
  So.endProcession = (outside) => {
    const pr = So.procession;
    if (!pr) return;
    So.procession = null;
    pr.outside = outside;
    pr.over = true;
    return pr;
  };
  function* oFollowFriend(n, pr) {
    const G = LC.G;
    let lineT = U.rand(0.5, 1.5);
    try {
      while (!pr.over && !n.gone) {
        const idx = pr.line.indexOf(n);
        const ahead = pr.line[Math.max(0, idx - 1)] || pr.target;
        const d = U.dist(n.x, n.y, ahead.x, ahead.y);
        if (d > 30) { n.body.vx += ((ahead.x - n.x) / d) * 110 * G.dt * 7; n.body.vy += ((ahead.y - n.y) / d) * 110 * G.dt * 7; }
        n.face = Math.atan2(pr.target.y - n.y, pr.target.x - n.x);
        n.act = 'argue';
        lineT -= G.dt;
        if (lineT <= 0) { lineT = U.rand(2, 3.5); N.shout(n, U.pick(L().friendComplain)); }
        // tug of war: loyal friends pull their mate back
        if (n.tr.loyalty > 0.7 && N.aggr(n) > 0.45 && d < 36 && Math.random() < G.dt * 0.6 && G.player) {
          const a = Math.atan2(n.y - pr.target.y, n.x - pr.target.x);
          pr.target.body.vx += Math.cos(a) * 90; pr.target.body.vy += Math.sin(a) * 90;
          N.say(n, U.pick(L().friendTug), { pri: 1 });
        }
        yield;
      }
      // they're thrown out. do we go too?
      if (pr.outside && Math.random() < n.tr.loyalty) {
        N.say(n, U.pick(L().friendLeaveToo), { pri: 1 });
        N.cancelTask(n);
        n.flags.leftWithFriend = true;
        yield* N.go(n, LC.Map.S.idCheck.x + U.rand(-20, 20), LC.Map.S.idCheck.y + 30, { arrive: 20, perm: n.perm | LC.Map.P.OUT });
        n.state = 'outside';
        LC.stat('leftInSolidarity');
        if (LC.Eject) LC.Eject.loiterOutside(n, pr.target);
      }
    } finally { n.act = null; }
  }
  function* oConga(n, pr) {
    const G = LC.G;
    N.shout(n, U.pick(L().congaJoin));
    N.emote(n, 'conga', 2);
    n.exprLock = true; n.expr = 'happy';
    try {
      while (!pr.over && !n.gone) {
        const idx = pr.line.indexOf(n);
        const ahead = pr.line[Math.max(0, idx - 1)];
        if (!ahead) break;
        const d = U.dist(n.x, n.y, ahead.x, ahead.y);
        if (d > 22) { n.body.vx += ((ahead.x - n.x) / d) * 120 * G.dt * 7; n.body.vy += ((ahead.y - n.y) / d) * 120 * G.dt * 7; }
        n.face = Math.atan2(ahead.y - n.y, ahead.x - n.x);
        n.act = 'carry';
        if (Math.random() < G.dt * 0.25) N.shout(n, U.pick(L().congaChant), { dim: true });
        yield;
      }
      // momentum carries the conga out the door
      if (pr.outside && Math.random() < 0.75) {
        yield* N.go(n, LC.Map.S.idCheck.x + U.rand(-30, 30), LC.Map.S.idCheck.y + U.rand(20, 50), { arrive: 20, perm: n.perm | LC.Map.P.OUT });
        n.act = 'stand';
        yield* N.wait(n, 1.2);
        N.say(n, U.pick(L().congaConfused), { pri: 1 });
        N.emote(n, '?', 2);
        LC.stat('confusedOutside');
        n.state = 'outside';
        if (LC.Eject) LC.Eject.loiterOutside(n, null, true);
      }
    } finally { n.exprLock = false; n.act = null; }
  }
  function updateProcession(dt) {
    const pr = So.procession;
    if (!pr) return;
    pr.t += dt;
    for (let i = pr.line.length - 1; i > 0; i--) if (pr.line[i].gone) pr.line.splice(i, 1);
    if (Math.random() < dt * 0.9 && pr.line.length >= 2 && pr.conga.size < 7) {
      const tail = pr.line[pr.line.length - 1];
      const near = Ph.query(tail.x, tail.y, 150, (b) => b.kind === 'char' && b.ent.kind === 'guest');
      for (const b of near) {
        const n = b.ent;
        if (pr.line.includes(n) || n.override || n.seat || n.asleep || n.state !== 'inside') continue;
        if (N.cs(n) < 0.32 && n.tr.energy > 0.5 && (1 - n.sob) > 0.4 && Math.random() < 0.5) {
          pr.conga.add(n); pr.line.push(n);
          N.interrupt(n, oConga(n, pr), 'conga', 5);
          LC.stat('congaJoiners');
          if (pr.conga.size === 1 && LC.Director) LC.Director.congaStarted(pr);
          break;
        }
      }
    }
  }

  /* ================= update ================= */
  So.update = (dt) => {
    const G = LC.G;
    for (const c of Ph.contacts) {
      const ea = c.a.ent, eb = c.b.ent;
      if (!ea || !eb || c.a.kind !== 'char' || c.b.kind !== 'char') continue;
      const va = c.a.vx * c.nx + c.a.vy * c.ny, vb = -(c.b.vx * c.nx + c.b.vy * c.ny);
      if (va >= vb) handleBump(ea, eb, c.speed, c.nx, c.ny);
      else handleBump(eb, ea, c.speed, -c.nx, -c.ny);
    }
    for (let i = G.args.length - 1; i >= 0; i--) updateArgument(G.args[i], dt);
    for (let i = G.fights.length - 1; i >= 0; i--) updateFight(G.fights[i], dt);
    updateProcession(dt);
  };
  So.oFlee = oFlee;
})();
