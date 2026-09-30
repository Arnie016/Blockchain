/* Last Call — staff and the door. Marcus works the queue, the bartenders pour, the DJ plays,
   Tank and Priya come when you call for backup (eventually), and the manager wanders out to
   have opinions. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd } = LC;
  const T = M.T, S = M.S, P = M.P;
  const St = (LC.Staff = {});
  const L = () => LC.Lines;

  /* ================= the queue ================= */
  const Door = (LC.Door = { calling: null, t: 0, rate: 3 });
  Door.join = (n) => { if (!LC.G.queue.includes(n)) LC.G.queue.push(n); };
  Door.remove = (n) => { const q = LC.G.queue, i = q.indexOf(n); if (i >= 0) q.splice(i, 1); if (Door.calling === n) Door.calling = null; };
  Door.spotFor = (n) => {
    const q = LC.G.queue, i = q.indexOf(n);
    if (i < 0) return null;
    if (i === 0) return { x: S.idCheck.x, y: S.idCheck.y, head: true };
    const s = S.queue[Math.min(i - 1, S.queue.length - 1)];
    return { x: s.x + (i - 1 >= S.queue.length ? U.rand(-6, 6) : 0), y: s.y + (i - 1 >= S.queue.length ? (i - S.queue.length) * 3 : 0) };
  };
  Door.admit = (n, by) => {
    Door.remove(n);
    n.state = 'admitted';
    LC.stat('admitted');
    if (by === 'player') LC.stat('idsChecked');
  };
  Door.deny = (n, by) => {
    Door.remove(n);
    n.state = 'denied';
    LC.stat(by === 'player' ? 'deniedByYou' : 'denied');
  };
  Door.playerOnDuty = () => {
    const p = LC.G.player;
    return p && U.dist(p.x, p.y, S.doorStaff.x, S.doorStaff.y) < 70 && !p.grab;
  };
  Door.update = (dt) => {
    const G = LC.G, q = G.queue;
    for (let i = q.length - 1; i >= 0; i--) if (q[i].gone || q[i].state !== 'queue') q.splice(i, 1);
    const head = q[0];
    if (!head) return;
    if (Door.calling !== head) { Door.calling = head; Door.t = 0; }
    if (U.dist(head.x, head.y, S.idCheck.x, S.idCheck.y) > 40) return;
    if (Door.playerOnDuty() || !St.marcus || St.marcus.away) return;
    Door.t += dt;
    if (Door.t < Door.rate) return;
    Door.t = 0;
    Door.rate = U.rand(0.7, 1.5) * (q.length > 12 ? 0.6 : q.length > 5 ? 0.8 : 1);
    // Marcus mostly lets people in. Mostly the right people.
    let deny = 0.03;
    if ((1 - head.sob) > 0.6) deny += 0.35;
    if (head.flags.fakeId) deny += 0.25;
    if (head.flags.banned) deny += head.flags.disguise ? 0.15 : 0.7;
    if (head.flags.contraband) deny += 0.1;
    if (Math.random() < deny) {
      N.say(St.marcus, U.pick(L().marcusDeny), { pri: 1 });
      Door.deny(head, 'marcus');
    } else {
      if (Math.random() < 0.18) N.say(St.marcus, U.pick(L().marcusAdmit), { dim: true });
      // the rest of the group goes in together
      const grp = head.group;
      Door.admit(head, 'marcus');
      if (grp) for (const m of q.slice(0, 6)) if (m.group === grp && U.dist(m.x, m.y, S.idCheck.x, S.idCheck.y) < 160) Door.admit(m, 'marcus');
    }
  };

  /* ================= staff creation ================= */
  const UNI = {
    bar: { top: 'shirt', topC: '#141418', topC2: '#e8e8ea', bot: 'pants', botC: '#121214' },
    sec: { top: 'jacket', topC: '#111114', topC2: '#1e1e22', bot: 'pants', botC: '#121214', shoes: '#111' },
    dj: { top: 'hoodie', topC: '#2a2a33', bot: 'jeans', botC: '#1c2230', glasses: 'sun' },
    coat: { top: 'suit', topC: '#3a2440', bot: 'pants', botC: '#1a1a1e' },
    host: { top: 'suit', topC: '#1a1a24', bot: 'pants', botC: '#121214' },
    boss: { top: 'suit', topC: '#6a5a8a', bot: 'pants', botC: '#2a2a3a', chain: true, hair: 'slick' },
    chef: { top: 'shirt', topC: '#f0f0f0', topC2: '#f0f0f0', bot: 'pants', botC: '#333' },
    cop: { top: 'shirt', topC: '#1f2d4d', topC2: '#1f2d4d', bot: 'pants', botC: '#1a2438', hat: 'cap' },
  };
  function mk(role, name, fem, x, y, uni, extra = {}) {
    const look = LC.People.randomLook({ fem, look: Object.assign({ hat: null, glasses: null, sash: null, glow: false, bag: false }, UNI[uni]) });
    if (uni === 'cop') look.topC2 = '#1f2d4d';
    const n = N.create({ x, y, fem, look, kind: 'staff', role, name, perm: P.ALL, state: 'staff', sob: 1, tr: { commonSense: 0.9, aggression: 0.2, fear: 0.2, ego: 0.3 } });
    n.speed = 105;
    n.security = uni === 'sec';
    n.earpiece = uni === 'sec';
    n.headphones = uni === 'dj';
    n.hatOverride = uni === 'chef' ? 'bucket' : null;
    Object.assign(n, extra);
    return n;
  }
  St.spawn = () => {
    const G = LC.G;
    St.bartenders = [
      mk('bartender', 'Jolene', true, 20 * T, 8.9 * T, 'bar', { homeX: 20 * T }),
      mk('bartender', 'Sam', false, 27 * T, 8.9 * T, 'bar', { homeX: 27 * T }),
    ];
    St.bartenders.forEach((b) => N.setTask(b, tBartender(b), 'bartend'));
    St.dj = mk('dj', 'DJ Krank', false, S.dj.x, S.dj.y, 'dj');
    N.setTask(St.dj, tDJ(St.dj), 'dj');
    St.coat = mk('coat', 'Ines', true, S.coatStaff.x, S.coatStaff.y, 'coat');
    N.setTask(St.coat, tStand(St.coat, S.coatStaff, Math.PI * 0), 'coat');
    St.marcus = mk('door', 'Marcus', false, S.doorStaff.x, S.doorStaff.y, 'sec', { tr: Object.assign(N.traits(), { commonSense: 1 }) });
    St.marcus.look.build = 1.25; St.marcus.look.height = 1.08; St.marcus.look.hair = 'bald'; St.marcus.look.beard = 'full';
    N.setTask(St.marcus, tStand(St.marcus, S.doorStaff, Math.PI), 'door');
    St.bouncers = [
      mk('bouncer', 'Tank', false, S.bouncerPosts[0].x, S.bouncerPosts[0].y, 'sec'),
      mk('bouncer', 'Priya', true, S.bouncerPosts[1].x, S.bouncerPosts[1].y, 'sec'),
    ];
    St.bouncers[0].look.build = 1.3;
    St.bouncers.forEach((b, i) => { b.post = S.bouncerPosts[i]; N.setTask(b, tBouncerIdle(b), 'post'); });
    St.host = mk('host', 'Rico', false, S.vipHost.x, S.vipHost.y, 'host');
    N.setTask(St.host, tHost(St.host), 'host');
    St.boss = mk('manager', 'Mr. Petrakis', false, S.manager.x, S.manager.y, 'boss');
    St.boss.look.build = 1.2;
    N.setTask(St.boss, tManager(St.boss), 'manager');
    St.chef = mk('chef', 'Bogdan', false, S.chef.x, S.chef.y, 'chef');
    N.setTask(St.chef, tChef(St.chef), 'chef');
    St.all = [...St.bartenders, St.dj, St.coat, St.marcus, ...St.bouncers, St.host, St.boss, St.chef];
    G.police = [];
  };

  /* ================= behaviours ================= */
  function* tStand(n, spot, face) {
    for (;;) {
      if (U.dist(n.x, n.y, spot.x, spot.y) > 10) yield* N.go(n, spot.x, spot.y, { arrive: 5 });
      n.act = n.role === 'door' ? 'crossed' : 'stand';
      n.face = face;
      if (n.role === 'coat') {
        const c = LC.G.npcs.find((o) => o.kind === 'guest' && U.dist(o.x, o.y, S.coat.x, S.coat.y) < 40);
        if (c) n.face = 0;
      }
      yield* N.wait(n, 0.5);
    }
  }
  function* tBartender(n) {
    const G = LC.G;
    for (;;) {
      if (!G.barOpen) { yield* N.go(n, n.homeX, 8.9 * T, { arrive: 6 }); n.act = 'crossed'; yield* N.wait(n, 2); continue; }
      let best = null;
      for (let i = 0; i < S.bar.length; i++) {
        const s = S.bar[i];
        if (!s.waiting || s.claimedBy || s.waiting.gone) continue;
        const w = G.t - s.waitT - Math.abs(S.barStaff[i].x - n.homeX) / 200;
        if (!best || w > best.w) best = { s, i, w };
      }
      if (best) {
        const { s, i } = best;
        s.claimedBy = n;
        try {
          yield* N.go(n, S.barStaff[i].x, S.barStaff[i].y, { arrive: 6, speed: 125 });
          n.act = 'hold'; n.face = Math.PI / 2;
          yield* N.wait(n, U.rand(1.1, 2.2) * (G.barRush ? 1.8 : 1));
          const c = s.waiting;
          if (c && !c.gone && U.dist(c.x, c.y, s.x, s.y) < 32) {
            N.giveDrink(c, c.wantsWater ? Wd.DRINKS.find((d) => d.water) : null);
            LC.stat('drinksServed');
            LC.sfx('pour', s.x, s.y, { vol: 0.5 });
            if (Math.random() < 0.08) N.say(n, U.pick(L().bartender), { dim: true });
          }
          s.waiting = null;
        } finally { s.claimedBy = null; }
      } else {
        yield* N.go(n, n.homeX + U.rand(-40, 40), 8.8 * T, { arrive: 8 });
        n.act = 'stand'; n.face = Math.PI / 2;
        // restock the bar top
        if (Wd.barTop.length < 14 && Math.random() < 0.3) Wd.barTop.push({ x: U.rand(16.6, 29.6) * T, y: 10.45 * T, c: Wd.randomDrink().c, full: true });
        yield* N.wait(n, U.rand(0.6, 1.6));
      }
    }
  }
  function* tDJ(n) {
    const G = LC.G;
    for (;;) {
      if (U.dist(n.x, n.y, S.dj.x, S.dj.y) > 8) yield* N.go(n, S.dj.x, S.dj.y, { arrive: 4 });
      n.face = Math.PI / 2;
      const m = G.music;
      n.act = m.stopped ? 'crossed' : m.drop > 0.3 || (m.energy > 0.8 && (G.t % 8) < 4) ? 'dance' : 'hold';
      n.danceStyle = 1;
      yield;
    }
  }
  function* tBouncerIdle(n) {
    const G = LC.G;
    for (;;) {
      if (n.job) { yield* tBackupJob(n); continue; }
      if (U.dist(n.x, n.y, n.post.x, n.post.y) > 12) yield* N.go(n, n.post.x, n.post.y, { arrive: 6 });
      n.act = 'crossed'; n.face = Math.PI / 2 + (n.role === 'bouncer' ? 0.3 : 0);
      // late at night they wander the floor a little
      if (G.clock > 240 && Math.random() < G.dt * 0.01) {
        const p = M.randomPoint(U.pick(['hall', 'bar', 'dance']), P.ALL);
        if (p) { yield* N.go(n, p.x, p.y, { arrive: 14 }); yield* N.wait(n, 4); }
      }
      yield* N.wait(n, 0.4);
    }
  }
  function* tHost(n) {
    const G = LC.G;
    for (;;) {
      // Rico takes breaks. VIP gets less VIP.
      if (G.clock > 90 && Math.random() < G.dt * 0.006) {
        n.away = true;
        const p = U.pick([S.smoke[3], { x: S.bar[8].x, y: S.bar[8].y + 30 }]);
        yield* N.go(n, p.x, p.y, { arrive: 12 });
        n.act = 'stand'; n.phoneUp = true;
        yield* N.wait(n, U.rand(25, 55));
        n.phoneUp = false; n.away = false;
      }
      if (U.dist(n.x, n.y, S.vipHost.x, S.vipHost.y) > 8) yield* N.go(n, S.vipHost.x, S.vipHost.y, { arrive: 5 });
      n.act = 'crossed'; n.face = Math.PI;
      if (G.vipRopeT && G.t > G.vipRopeT) { G.vipRopeOpen = 0; G.vipRopeT = 0; }
      yield* N.wait(n, 0.4);
    }
  }
  function* tManager(n) {
    const G = LC.G;
    for (;;) {
      if (U.dist(n.x, n.y, S.manager.x, S.manager.y) > 10) yield* N.go(n, S.manager.x, S.manager.y, { arrive: 6 });
      n.act = 'stand'; n.face = Math.PI / 2;
      yield* N.wait(n, U.rand(70, 140));
      if (G.closing) continue;
      // a lap of the floor with opinions
      const stops = U.shuffle(['dance', 'bar', 'hall', 'lobby', 'vip']).slice(0, 3);
      for (const r of stops) {
        const p = M.randomPoint(r, P.ALL);
        if (!p) continue;
        yield* N.go(n, p.x, p.y, { arrive: 16 });
        n.act = 'crossed';
        const opinion = LC.Director ? LC.Director.managerOpinion(n) : null;
        if (opinion) N.say(n, opinion, { pri: 1 });
        yield* N.wait(n, U.rand(3, 6));
      }
    }
  }
  function* tChef(n) {
    const G = LC.G;
    for (;;) {
      if (G.clock > 240) {
        // kitchen closes at 1
        yield* N.go(n, S.kitchenBackIn.x, S.kitchenBackIn.y, { arrive: 8 });
        yield* N.go(n, S.kitchenBackOut.x, S.kitchenBackOut.y - 20, { arrive: 10 });
        N.remove(n); yield; return;
      }
      const p = M.randomPoint('kitchen', P.ALL);
      if (p) yield* N.go(n, p.x, p.y, { arrive: 10 });
      n.act = 'hold';
      yield* N.wait(n, U.rand(3, 8));
    }
  }

  /* ================= backup ================= */
  St.freeBouncer = (x, y) => {
    const free = (St.bouncers || []).filter((b) => !b.job && !b.gone);
    if (!free.length) return null;
    free.sort((a, b) => U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y));
    return free[0];
  };
  // job: { kind: 'assist'|'fight'|'eject', target, x, y }
  St.callBackup = (x, y, target, kind) => {
    const b = St.freeBouncer(x, y);
    if (!b) return null;
    b.job = { kind: kind || 'assist', target, x, y, t0: LC.G.t };
    N.setTask(b, tBouncerIdle(b), 'post');
    return b;
  };
  function* tBackupJob(b) {
    const G = LC.G, job = b.job;
    try {
      const tgt = () => job.target && !job.target.gone ? job.target : null;
      // run over
      for (let k = 0; k < 40; k++) {
        const t = tgt();
        const tx = t ? t.x : job.x, ty = t ? t.y : job.y;
        if (U.dist(b.x, b.y, tx, ty) < 30) break;
        N.goTo(b, tx, ty, { arrive: 24, hurry: true, speed: 165 });
        yield* N.wait(b, 0.5);
        if (G.t - job.t0 > 40) return;
      }
      const t = tgt();
      if (!t) return;
      N.stop(b);
      if (job.kind === 'assist' && G.player && G.player.grab && G.player.grab.npc === t) {
        // grab the other arm until the player lets go
        b.assisting = t; t.assisted = b;
        N.say(b, U.pick(L().backupArrive), { pri: 1 });
        while (G.player.grab && G.player.grab.npc === t && !t.gone) {
          const a = Math.atan2(t.y - G.player.y, t.x - G.player.x) + Math.PI / 2;
          N.goTo(b, t.x + Math.cos(a) * 18, t.y + Math.sin(a) * 18, { arrive: 6, speed: 170 });
          b.act = 'hold'; N.faceTo(b, t.x, t.y);
          yield* N.wait(b, 0.2);
        }
        return;
      }
      // take them out ourselves
      if (LC.Eject) yield* LC.Eject.staffEscort(b, t, job.kind);
    } finally {
      if (b.assisting) { b.assisting.assisted = null; b.assisting = null; }
      b.job = null;
    }
  }

  /* ================= police ================= */
  St.callPolice = (x, y, reason) => {
    const G = LC.G;
    if (G.police.length) return;
    LC.stat('policeVisits');
    for (let i = 0; i < 2; i++) {
      const c = mk('police', i ? 'Officer Dunn' : 'Officer Okafor', !!i, (45 + i * 2) * T, 60 * T, 'cop');
      c.police = true;
      G.police.push(c);
      N.setTask(c, tPolice(c, x, y, reason, i), 'police');
    }
    if (LC.Radio) LC.Radio.say('marcus', U.pick(L().policeArrive));
  };
  function* tPolice(c, x, y, reason, i) {
    const G = LC.G;
    yield* N.wait(c, i * 0.8);
    yield* N.go(c, x + (i ? 20 : -20), y + 20, { arrive: 20, speed: 120, timeout: 90 });
    c.act = 'crossed';
    N.say(c, U.pick(L().policeLine), { pri: 2 });
    // haul out whoever is still fighting nearby
    const f = LC.Social && LC.Social.fightNear(x, y, 200);
    if (f && LC.Eject) {
      const tgt = [...f.members].find((m) => !m.gone && !m.policed);
      if (tgt) { tgt.policed = true; yield* LC.Eject.staffEscort(c, tgt, 'police'); }
    } else yield* N.wait(c, 6);
    yield* N.go(c, (45 + i * 2) * T, 60 * T, { arrive: 20, perm: P.ALL, timeout: 90 });
    const k = G.police.indexOf(c);
    if (k >= 0) G.police.splice(k, 1);
    N.remove(c);
    yield;
  }
})();
