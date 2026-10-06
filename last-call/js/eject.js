/* Last Call — throwing people out. The escort is a physical leash between you and them; they
   pick a way to resist (argue, go limp, grab a doorframe, cry, film you, offer twenty quid),
   and once they're over the threshold they decide what to do with the rest of their night. */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph, NPC: N, W: Wd } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Ej = (LC.Eject = {});
  const L = () => LC.Lines;

  const TYPES = ['peaceful', 'argue', 'dragFeet', 'grabber', 'runner', 'hider', 'negotiator', 'owner', 'briber', 'crier', 'polite', 'noEnglish', 'filmer', 'fighter', 'limp', 'father'];
  const RESIST = { peaceful: 0.08, argue: 0.28, dragFeet: 0.55, grabber: 0.3, runner: 0.3, hider: 0.3, negotiator: 0.35, owner: 0.3, briber: 0.3, crier: 0.18, polite: 0, noEnglish: 0.2, filmer: 0.2, fighter: 0.45, limp: 0.8, father: 0.3 };
  const ANCHOR = { grabber: 0.9, dragFeet: 0.35, argue: 0.25, fighter: 0.2, father: 0.2, owner: 0.15, runner: 0.1, negotiator: 0.1, noEnglish: 0.15, hider: 0.1, filmer: 0.05, crier: 0.1 };
  const EXPR = { peaceful: 'sad', argue: 'angry', dragFeet: 'drunk', grabber: 'furious', runner: 'smug', hider: 'scared', negotiator: 'polite', owner: 'smug', briber: 'smug', crier: 'cry', polite: 'polite', noEnglish: 'confused', filmer: 'smug', fighter: 'furious', limp: 'wasted', father: 'angry' };
  const TALKERS = { negotiator: 1, owner: 1, briber: 1, father: 1 };
  Ej.TYPES = TYPES;

  Ej.chooseType = (n) => {
    if (n.ejType) return n.ejType;
    const t = n.tr, dr = 1 - n.sob, aggr = N.aggr(n);
    const friendsNear = n.group && n.group.members.some((m) => m !== n && !m.gone && U.dist(m.x, m.y, n.x, n.y) < 200);
    const w = {
      peaceful: t.fear + t.commonSense * 0.8 + (1 - t.ego) * 0.3,
      argue: t.ego * 0.8 + aggr * 0.5,
      dragFeet: dr * 0.8 + (1 - t.energy) * 0.3,
      grabber: (1 - N.cs(n)) * 0.8 + dr * 0.35,
      runner: n.sob > 0.35 ? t.energy * 0.5 + (1 - t.fear) * 0.2 : 0,
      hider: friendsNear ? t.fear * 0.5 + 0.1 : 0,
      negotiator: t.confidence * 0.5 + t.commonSense * 0.2,
      owner: t.ego * 0.5 + t.confidence * 0.2,
      briber: t.confidence * 0.3 + t.ego * 0.2,
      crier: t.embarrassment * 0.7 + dr * 0.25,
      polite: t.embarrassment * 0.5 + t.fear * 0.4,
      noEnglish: (1 - N.cs(n)) * 0.25 + t.confidence * 0.15,
      filmer: (1 - t.social) * 0.25 + t.ego * 0.3,
      fighter: Math.max(0, aggr * 1.1 - t.fear * 0.6 - 0.25),
      limp: dr > 0.6 ? dr * dr * 1.3 : 0,
      father: t.ego * t.confidence * 0.8,
    };
    return U.weighted(TYPES, (k) => w[k]) || 'argue';
  };

  /* ---------------- start / end ---------------- */
  Ej.startEscort = (p, n) => {
    const G = LC.G;
    N.standUp(n);
    if (n.carry) N.drop(n);
    const wasAsleep = n.asleep;
    if (n.asleep && LC.Director) LC.Director.wake(n, true);
    const type = wasAsleep ? 'limp' : n.restrained ? 'peaceful' : Ej.chooseType(n);
    const innocent = !n.incident && !n.flags.warned && !n.flags.banned && !n.flags.noWristband && !n.flags.tutorialTarget && !n.flags.underage && (1 - n.sob) < 0.8 && n.overrideName !== 'fight' && n.overrideName !== 'argue' && !wasAsleep && n.state === 'inside';
    const g = { npc: n, type, t: 0, hold: 1, anchor: null, grip: 0, anchorT: U.rand(1, 2.2), innocent, talked: false, lineT: 1.2, swingT: U.rand(2, 3.5), burstT: U.rand(1.5, 3), burst: 0 };
    p.grab = g;
    n.escorted = true;
    n.esc = Math.max(n.esc || 1, 3);
    if (LC.Social) {
      const arg = LC.Social.argumentOf(n);
      if (arg) { arg.roles.delete(n); arg.separated = true; }
      const f = LC.Social.fightOf(n);
      if (f) { f.separated = true; LC.Social.removeFighter(n, 'keep'); if (LC.Incidents) LC.Incidents.separated(f, n); }
      LC.Social.startProcession(n);
    }
    N.interrupt(n, oEscorted(n, g), 'escorted', 9);
    LC.stat('escorts');
    if (innocent) {
      N.say(n, U.pick(L().innocentGrab), { pri: 2 });
      LC.stat('customerComplaints');
    } else N.say(n, U.pick(L().ej[type].start), { pri: 2, kind: type === 'argue' || type === 'fighter' ? 'shout' : 'say' });
    if (n.incident && LC.Incidents) LC.Incidents.escalate(n.incident, 3);
    LC.sfx('grab', n.x, n.y);
  };
  Ej.endEscort = (p, how) => {
    const g = p.grab;
    if (!g) return;
    p.grab = null;
    const n = g.npc;
    releaseAnchor(g);
    n.escorted = false;
    if (n.overrideName === 'escorted') N.endOverride(n);
    if (LC.Social && how !== 'out') LC.Social.endProcession(false);
    if (how === 'released' && !n.gone && n.state === 'inside') {
      if (g.innocent) N.say(n, U.pick(['...thanks?', 'What was THAT about?', 'Okay. Weird.']), { pri: 1 });
      else if (n.incident && Math.random() < 0.5) N.say(n, U.pick(['Knew you wouldn\'t.', 'Ha!', 'Changed your mind?']), { pri: 1 });
    }
    if (how === 'escaped') N.interrupt(n, oRunAway(n), 'runaway', 6);
  };

  /* ---------------- the person being dragged ---------------- */
  function* oEscorted(n, g) {
    const G = LC.G;
    n.noSteer = true; n.exprLock = true; n.act_keepWhileMoving = true;
    try {
      while (G.player.grab === g && !n.gone) {
        const dt = G.dt;
        g.t += dt;
        if (g.type === 'limp' && !n.assisted) { n.poseLock = true; n.pose = 'fallen'; n.fallK = 1; n.fallSide = n.x < G.player.x ? -1 : 1; }
        else {
          n.poseLock = false;
          n.act = n.restrained ? 'restrained' : g.anchor ? 'grab' : g.type === 'crier' ? 'cry' : g.type === 'filmer' ? 'phone' : g.type === 'polite' || g.type === 'negotiator' ? 'polite' : g.type === 'fighter' && g.swing > 0 ? 'fight' : 'dragged';
        }
        n.phoneUp = g.type === 'filmer'; n.filming = g.type === 'filmer';
        n.expr = g.anchor ? 'furious' : EXPR[g.type] || 'angry';
        n.dragDir = G.player.x > n.x ? -1 : 1;
        n.z = n.assisted ? 5 : 0;
        if (g.anchor) n.grabAng = Math.atan2(g.anchor.y - n.y, g.anchor.x - n.x);
        g.lineT -= dt;
        if (g.lineT <= 0) {
          g.lineT = U.rand(2.4, 4.2);
          const pool = g.anchor && g.type === 'grabber' ? L().ej.grabber.during : L().ej[g.type].during;
          N.say(n, U.pick(pool), { pri: 2, kind: g.type === 'argue' || g.type === 'fighter' ? 'shout' : 'say' });
          if (g.type === 'crier' && Math.random() < 0.3) { LC.stat('customerComplaints'); crowdAww(n); }
        }
        // the talkers stop and make you an offer
        if (TALKERS[g.type] && !g.talked && g.t > 1.3 && !G.dialog) { g.talked = true; LC.Dialogue.open(n); }
        yield;
      }
    } finally {
      n.noSteer = false; n.exprLock = false; n.act_keepWhileMoving = false; n.poseLock = false; n.fallK = 0;
      n.phoneUp = false; n.filming = false; n.act = null; n.z = 0; n.escorted = false;
      if (n.pose === 'fallen') n.pose = 'stand';
    }
  }
  function crowdAww(n) {
    const near = Ph.query(n.x, n.y, 160, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n);
    for (const b of near.slice(0, 3)) if (!b.ent.override) { N.say(b.ent, U.pick(['Awww.', "Leave her alone!", 'That\'s so sad.', 'Bully!']), { dim: true }); N.faceTo(b.ent, n.x, n.y); }
  }
  function* oRunAway(n) {
    const G = LC.G;
    n.exprLock = true; n.expr = 'smug';
    try {
      N.say(n, U.pick(L().ej.runner.during), { pri: 2 });
      LC.stat('escapes');
      // lose yourself in a crowd or behind your friends
      let dest = null;
      if (n.group) {
        const f = n.group.members.find((m) => m !== n && !m.gone && m.state === 'inside');
        if (f) dest = { x: f.x + U.rand(-20, 20), y: f.y - 18 };
      }
      if (!dest) dest = U.pick(S.dance);
      yield* N.go(n, dest.x, dest.y, { hurry: true, speed: 175, arrive: 16, timeout: 12 });
      n.expr = 'suspicious';
      yield* N.wait(n, U.rand(4, 8));
    } finally { n.exprLock = false; }
  }

  /* ---------------- anchors ---------------- */
  function findAnchor(n) {
    const box = Ph.nearestBox(n.x, n.y, 28, (f) => f.anchor);
    let best = box ? { kind: 'static', x: box.x, y: box.y, f: box.f, d: U.dist(n.x, n.y, box.x, box.y) } : null;
    for (const d of M.doors) {
      if (d.kind === 'arch' || d.kind === 'rope' || d.kind === 'stall') continue;
      for (const [x, y] of [[d.x0, d.y0], [d.x1, d.y1]]) {
        const dd = U.dist(n.x, n.y, x, y);
        if (dd < 30 && (!best || dd < best.d)) best = { kind: 'static', x, y, door: d, d: dd };
      }
    }
    const pr = Wd.nearestProp(n.x, n.y, 30, (q) => (q.kind === 'chair' || q.kind === 'stool' || q.kind === 'table' || q.kind === 'plant' || q.kind === 'beanbag') && !q.carriedBy && !q.occ);
    if (pr) { const dd = U.dist(n.x, n.y, pr.body.x, pr.body.y); if (!best || dd < best.d + 6) best = { kind: 'prop', prop: pr, x: pr.body.x, y: pr.body.y, d: dd }; }
    return best;
  }
  function releaseAnchor(g) {
    if (!g.anchor) return;
    if (g.anchor.prop) { g.anchor.prop.heldAsAnchor = false; g.anchor.prop.body.ghost = false; }
    g.anchor = null;
  }
  Ej.peelOrThrow = (p) => {
    const g = p.grab;
    if (!g) return;
    if (g.anchor) {
      g.grip -= 0.2 + Math.random() * 0.06;
      LC.sfx('squeak', g.npc.x, g.npc.y, { vol: 0.6 });
      Wd.part('puff', g.anchor.x, g.anchor.y - 16, {});
      if (g.grip <= 0) peelOff(p, g);
      return;
    }
    const ex = Ej.nearExit(g.npc);
    if (ex) {
      // the throw
      const n = g.npc;
      const dir = Math.atan2(ex.oy - n.y, ex.ox - n.x);
      Ej.endEscort(p, 'thrown');
      n.body.vx = Math.cos(dir) * 420; n.body.vy = Math.sin(dir) * 420;
      n.thrownT = LC.G.t;
      N.interrupt(n, oThrown(n, dir, g), 'thrown', 10);
      LC.sfx('shove', n.x, n.y);
    } else {
      Pl().say(U.pick(['Walk.', 'Keep moving.', 'This way.', 'Door. That way.']));
    }
  };
  function peelOff(p, g) {
    const n = g.npc, a = g.anchor;
    LC.stat('fingersPeeled');
    releaseAnchor(g);
    const dir = Math.atan2(p.y - n.y, p.x - n.x);
    n.body.vx += Math.cos(dir) * 140; n.body.vy += Math.sin(dir) * 100;
    N.say(n, U.pick(a && a.prop ? ['NOOO my ' + a.prop.kind + '!', 'We were HAPPY together!', 'FINE!'] : ['FINE!', 'My FINGERS!', 'I was attached to that!']), { pri: 2, kind: 'shout' });
    if (Math.random() < 0.3) N.knockDown(n, dir, 0.6);
  }
  function* oThrown(n, dir, g) {
    const G = LC.G;
    n.noSteer = true;
    try {
      let t = 0;
      n.poseLock = true; n.pose = 'dragged'; n.dragDir = Math.cos(dir) > 0 ? -1 : 1;
      while (t < 0.9) {
        t += G.dt;
        const r = M.roomAt(n.x, n.y);
        if (r && r.outdoor && r.id !== 'patio') {
          n.poseLock = false;
          Ej.complete(n, 'player', { type: g.type, dir, pr: LC.Social && LC.Social.endProcession(true) });
          return;
        }
        yield;
      }
      // bounced off the door frame and is somehow still inside
      n.poseLock = false;
      N.say(n, U.pick(["Missed!", 'Ha! Still inside!', 'Physics!']), { pri: 2 });
      if (LC.Social) LC.Social.endProcession(false);
    } finally { n.noSteer = false; n.poseLock = false; }
  }
  const Pl = () => LC.Player;

  // exterior door gaps: point on the outside to aim at
  const EXITS = ['entrance', 'emergency', 'kitchenBack', 'staffDoor', 'patioGate'].map((id) => {
    const d = M.door(id);
    const out = id === 'entrance' ? { ox: d.cx, oy: d.cy + 60 } : id === 'patioGate' ? { ox: d.cx + 60, oy: d.cy } : { ox: d.cx, oy: d.cy - 60 };
    return Object.assign({ d, id }, out);
  });
  Ej.nearExit = (n) => {
    for (const e of EXITS) {
      if (e.d.kind === 'alarm' && e.d.open < 0.5) continue;
      if (e.d.kind === 'gate' && e.d.open < 0.5) continue;
      if (U.dist(n.x, n.y, e.d.cx, e.d.cy) < 62) return e;
    }
    return null;
  };

  /* ---------------- per-step physics ---------------- */
  Ej.playerSpeedFactor = (p) => {
    const g = p.grab;
    if (!g) return 1;
    let r = RESIST[g.type] || 0.3;
    if (g.type === 'argue') r += Math.sin(g.t * 2.3) * 0.12;
    if (g.burst > 0) r += 0.35;
    if (g.npc.assisted) r *= 0.3;
    if (g.npc.restrained) r *= 0.5;
    let f = U.clamp(1 - r * 0.72, 0.2, 1);
    if (g.anchor && g.anchor.prop) f *= U.clamp(1 - g.anchor.prop.body.m / 26, 0.4, 1);
    return f;
  };
  Ej.update = (dt) => {
    const G = LC.G, p = G.player;
    if (p && p.grab) stepPlayerEscort(p, p.grab, dt);
    for (const s of G.npcs) if (s.escorting) stepLeash(s, s.escorting, 26, 0.9, dt);
  };
  function stepLeash(a, b, len, share, dt) {
    const ab = a.body, bb = b.body;
    const dx = bb.x - ab.x, dy = bb.y - ab.y, d = Math.hypot(dx, dy) || 1;
    if (d > len) {
      const c = d - len, nx = dx / d, ny = dy / d;
      bb.x -= nx * c * share; bb.y -= ny * c * share;
      ab.x += nx * c * (1 - share); ab.y += ny * c * (1 - share);
      // match velocity along the leash
      const rv = (bb.vx - ab.vx) * nx + (bb.vy - ab.vy) * ny;
      if (rv > 0) { bb.vx -= rv * nx * share; bb.vy -= rv * ny * share; ab.vx += rv * nx * (1 - share); ab.vy += rv * ny * (1 - share); }
    }
    // being dragged: feet skid
    const sp = Math.hypot(bb.vx, bb.vy);
    if (sp > 40 && Math.random() < dt * 6) Wd.part('dust', bb.x + U.rand(-4, 4), bb.y + 1, { vx: -bb.vx * 0.1, vy: -bb.vy * 0.1 });
  }
  function stepPlayerEscort(p, g, dt) {
    const G = LC.G, n = g.npc;
    if (n.gone || n.state === 'ejected') { p.grab = null; return; }
    const pb = p.body, nb = n.body;
    // anchoring
    if (!g.anchor && !n.assisted && !n.restrained) {
      g.anchorT -= dt;
      if (g.anchorT <= 0) {
        g.anchorT = U.rand(1.4, 2.8);
        if (Math.random() < (ANCHOR[g.type] || 0)) {
          const a = findAnchor(n);
          if (a && a.d < 30) {
            g.anchor = a;
            g.grip = 0.8 + (1 - N.cs(n)) * 0.5 + (g.type === 'grabber' ? 0.4 : 0);
            if (a.prop) { a.prop.heldAsAnchor = true; }
            N.say(n, U.pick(a.prop ? ["This is my " + a.prop.kind + " now!", 'I LIVE HERE NOW!', "We're together. Me and the " + a.prop.kind + '.'] : a.door ? ['NOT THE DOOR!', "I'm holding the door!", 'I LIVE HERE NOW!'] : ["I'm not letting go!", 'I LIVE HERE NOW!', 'You\'ll never take me!']), { pri: 2, kind: 'shout' });
            n.esc = Math.max(n.esc || 1, 4);
            if (n.incident && LC.Incidents) LC.Incidents.escalate(n.incident, 4);
            LC.stat('grabbedFurniture');
            LC.sfx('squeak', n.x, n.y);
          }
        }
      }
    }
    if (g.anchor && (n.assisted || n.restrained)) { releaseAnchor(g); N.say(n, 'OW OKAY OKAY', { pri: 2 }); }
    const a = g.anchor;
    if (a && a.kind === 'static') {
      // they hold on; you strain
      const dx = a.x - nb.x, dy = a.y - nb.y, d = Math.hypot(dx, dy) || 1;
      if (d > 12) { nb.x += (dx / d) * (d - 12); nb.y += (dy / d) * (d - 12); }
      nb.vx *= 0.5; nb.vy *= 0.5;
      const px = pb.x - nb.x, py = pb.y - nb.y, pd = Math.hypot(px, py) || 1;
      if (pd > 30) {
        const c = pd - 30;
        pb.x -= (px / pd) * c; pb.y -= (py / pd) * c;
        const rv = pb.vx * (px / pd) + pb.vy * (py / pd);
        if (rv > 0) { pb.vx -= rv * (px / pd); pb.vy -= rv * (py / pd); }
        g.grip -= dt * 0.28 * U.clamp(rv / 60 + 0.4, 0, 1.6);
        if (Math.random() < dt * 3) Wd.part('dust', nb.x, nb.y, {});
      }
      g.grip -= dt * 0.03;
      if (g.grip <= 0) peelOff(p, g);
    } else {
      stepLeash(p, n, 21, 0.85, dt);
      if (a && a.prop) {
        // the chair comes too
        const pr = a.prop.body;
        const hx = nb.x + Math.cos(n.grabAng || 0) * 12, hy = nb.y + Math.sin(n.grabAng || 0) * 8;
        const dx = pr.x - hx, dy = pr.y - hy, d = Math.hypot(dx, dy) || 1;
        if (d > 14) { pr.x -= (dx / d) * (d - 14); pr.y -= (dy / d) * (d - 14); pr.vx = nb.vx; pr.vy = nb.vy; }
        a.x = pr.x; a.y = pr.y;
        if (Math.hypot(nb.vx, nb.vy) > 30 && Math.random() < dt * 4) LC.sfx('scrape', pr.x, pr.y, { vol: 0.5 });
        g.grip -= dt * 0.05;
        if (g.grip <= 0) peelOff(p, g);
        if (!M.isInside(pr.x, pr.y) && !M.inRoom(pr.x, pr.y, 'patio') && !a.prop.leftClub) { a.prop.leftClub = true; LC.stat('furnitureEjected'); }
      }
    }
    // struggling free
    if ((g.type === 'runner' || g.type === 'hider' || g.type === 'fighter') && !n.assisted && !n.restrained) {
      g.burstT -= dt;
      if (g.burstT <= 0 && g.burst <= 0) { g.burst = U.rand(0.8, 1.6); g.burstT = U.rand(2, 4); N.say(n, U.pick(['Get OFF!', 'Let GO!', 'Nnnngh!']), { pri: 1 }); }
      if (g.burst > 0) {
        g.burst -= dt;
        g.hold -= dt * (g.type === 'fighter' ? 0.3 : 0.45);
        const away = Math.atan2(nb.y - pb.y, nb.x - pb.x);
        nb.vx += Math.cos(away) * 260 * dt; nb.vy += Math.sin(away) * 200 * dt;
      } else g.hold = Math.min(1, g.hold + dt * 0.08);
      if (g.hold <= 0) {
        n.esc = Math.max(n.esc || 1, 4);
        Ej.endEscort(p, 'escaped');
        LC.Player.say(U.pick(['Oh, come ON.', 'Slippery.', 'Great. Cardio.']));
        return;
      }
    }
    if (g.type === 'fighter' && !n.restrained && !n.assisted) {
      g.swingT -= dt;
      if (g.swing > 0) g.swing -= dt;
      if (g.swingT <= 0) {
        g.swingT = U.rand(2.4, 4);
        g.swing = 0.4;
        n.punch = 1;
        if (Math.random() < 0.55) LC.Player.hit(n, Math.atan2(pb.y - nb.y, pb.x - nb.x));
        else N.shout(n, U.pick(L().fightMiss));
        n.flags.violent = true;
      } else if (g.swing <= 0) n.punch = 0;
    }
    // over the threshold?
    const r = M.roomAt(nb.x, nb.y);
    if (r && r.outdoor && r.id !== 'patio') {
      const pr = LC.Social ? LC.Social.endProcession(true) : null;
      const dir = Math.atan2(nb.y - pb.y, nb.x - pb.x);
      p.grab = null;
      releaseAnchor(g);
      nb.vx += Math.cos(dir) * 220; nb.vy += Math.sin(dir) * 180;
      Ej.complete(n, 'player', { type: g.type, dir, pr, innocent: g.innocent });
    }
  }

  /* ---------------- outcome ---------------- */
  Ej.complete = (n, by, o = {}) => {
    const G = LC.G;
    if (n.gone || n.state === 'ejected') return;
    const type = o.type || 'argue';
    LC.stat('ejected');
    LC.stat(by === 'player' ? 'ejectedByYou' : by === 'police' ? 'ejectedByPolice' : 'ejectedByStaff');
    if (n) n.flags.ejected = true;
    if (o.innocent) (LC.Aura && LC.Aura.add(-150, 'Threw out an innocent person')), LC.stat('innocentEjected');
    n.state = 'ejected';
    n.perm = P.OUT;
    n.flags.banned = true;
    n.ejectCount = (n.ejectCount || 0) + 1;
    n.escorted = false; n.restrained = false;
    if (n.drink) N.finishDrink(n);
    N.cancelTask(n);
    if (n.overrideName === 'escorted' || n.overrideName === 'thrown') N.endOverride(n);
    N.say(n, U.pick(L().ej[type] ? L().ej[type].out : L().ej.argue.out), { pri: 2, dur: 3 });
    const inc = n.incident;
    if (inc && LC.Incidents) LC.Incidents.resolve(inc, 'eject');
    else if (LC.Objectives && by === 'player') LC.Objectives.toast(o.innocent ? 'EJECTED. For what, exactly?' : 'EJECTED.', o.innocent ? 'They were just standing there. Management will be thrilled.' : U.pick(EJECT_PAYOFF));
    if (n.regular && LC.Regulars) LC.Regulars.ejected(n);
    const pr = o.pr;
    const conga = pr ? pr.conga.size : 0;
    if (conga >= 2 && by === 'player' && LC.Objectives) setTimeout(() => LC.Objectives.toast('EJECTED: 1. LEFT OUT OF CONFUSION: ' + conga + '.', 'The conga has left the building.'), 1600);
    N.interrupt(n, oLanded(n, o.dir || Math.PI / 2, type), 'landed', 9);
    if (LC.Director) LC.Director.onEject(n, by);
  };
  const EJECT_PAYOFF = ['Left the building. Took the attitude with them.', 'Another satisfied customer. Sort of.', 'The door has been introduced to them.', 'Gone. For now. Probably.', 'The pavement can deal with them.'];
  function* oLanded(n, dir, type) {
    const G = LC.G;
    const fell = type === 'limp' || type === 'dragFeet' || Math.random() < 0.35;
    if (fell) yield* N.oFallen(n, dir, 1, false);
    else yield* N.wait(n, 0.8);
    N.faceTo(n, S.idCheck.x, S.idCheck.y - 40);
    yield* N.wait(n, 0.6);
    N.setTask(n, tAfterEject(n, type), 'afterEject');
  }
  function* tAfterEject(n, type) {
    const G = LC.G;
    n.perm = P.OUT;
    const r = Math.random();
    const late = G.clock > 330;
    if (r < 0.2 && !late && LC.Director && LC.Director.allow('sneakBack')) {
      // round the back and through the kitchen
      n.flags.sneaking = true;
      yield* N.go(n, S.alleyLoiter[4].x, S.alleyLoiter[4].y, { perm: P.OUT, arrive: 30, timeout: 60 });
      yield* N.wait(n, U.rand(6, 14));
      if (LC.Incidents) { LC.Incidents.start(Math.random() < 0.6 ? 'kitchen' : 'gateClimb', n); return; }
    } else if (r < 0.38 && !late) {
      // new hat, new person
      yield* loiter(n, U.rand(12, 25));
      n.look.hat = U.pick(['cap', 'beanie', 'cowboy']);
      n.look.glasses = Math.random() < 0.6 ? 'sun' : n.look.glasses;
      n.flags.disguise = true;
      N.say(n, U.pick(["They'll never recognise me.", 'New me.', 'Completely different person.']), { pri: 1 });
      n.state = 'arriving';
      N.setTask(n, N.tArrive(n), 'arrive');
      return;
    } else if (r < 0.62) {
      yield* loiter(n, U.rand(20, 45));
    }
    N.setTask(n, N.tLeave(n, { noCoat: true, exit: U.pick(S.exits) }), 'leave');
  }
  function* loiter(n, secs) {
    const G = LC.G;
    const spot = U.pick(S.curb);
    yield* N.go(n, spot.x + U.rand(-20, 20), spot.y + U.rand(-8, 8), { perm: P.OUT, arrive: 14 });
    n.act = 'stand';
    N.faceTo(n, S.idCheck.x, S.idCheck.y - 40);
    let t = 0;
    while (t < secs) {
      t += G.dt;
      if (Math.random() < G.dt * 0.12) N.shout(n, U.pick(OUTSIDE_YELLS), { dim: true });
      if (Math.random() < G.dt * 0.1) n.phoneUp = !n.phoneUp;
      yield;
    }
    n.phoneUp = false;
  }
  const OUTSIDE_YELLS = ['I KNOW THE OWNER!', 'Your MUSIC is BAD!', 'I was going to LEAVE anyway!', "This is the worst club I've ever been thrown out of!", 'CAN I AT LEAST GET MY JACKET?', 'I want to speak to the FLAMINGO!', 'My Uber is four minutes away. FOUR.'];
  Ej.loiterOutside = (n, friend, confused) => {
    n.perm = P.OUT | (confused ? P.PUB : 0);
    N.setTask(n, (function* () {
      yield* loiter(n, U.rand(10, 30));
      if (confused && Math.random() < 0.6) {
        // try to get back in like nothing happened
        n.state = 'arriving';
        N.setTask(n, N.tArrive(n), 'arrive');
        return;
      }
      yield* N.tLeave(n, { noCoat: true });
    })(), 'loiter');
  };

  /* ---------------- staff escorts ---------------- */
  function* oStaffEscorted(t, b) {
    const G = LC.G;
    t.noSteer = true; t.exprLock = true; t.act_keepWhileMoving = true;
    const type = Ej.chooseType(t);
    N.say(t, U.pick(L().ej[type].start), { pri: 2 });
    let lineT = 2;
    try {
      while (b.escorting === t && !t.gone) {
        t.act = t.restrained ? 'restrained' : 'dragged';
        t.expr = EXPR[type] || 'angry';
        t.dragDir = b.x > t.x ? -1 : 1;
        lineT -= G.dt;
        if (lineT <= 0) { lineT = U.rand(2.5, 4); N.say(t, U.pick(L().ej[type].during), { pri: 1 }); }
        yield;
      }
    } finally { t.noSteer = false; t.exprLock = false; t.act_keepWhileMoving = false; t.act = null; }
  }
  Ej.staffEscort = function* (b, t, kind) {
    const G = LC.G;
    if (t.gone || t.state !== 'inside' || t.escorted) return;
    if (LC.Social) { const f = LC.Social.fightOf(t); if (f) { f.separated = true; LC.Social.removeFighter(t, 'keep'); } }
    b.escorting = t;
    t.escorted = true;
    N.interrupt(t, oStaffEscorted(t, b), 'escorted', 9);
    N.say(b, U.pick(kind === 'police' ? ['Come on. Out.', 'Walk with me.', "You're done for tonight."] : ["Come on, you. Out.", "That's enough.", 'Walk. Now.']), { pri: 1 });
    try {
      yield* N.go(b, S.idCheck.x + U.rand(-16, 16), S.idCheck.y + 36, { perm: P.ALL, speed: 92, arrive: 24, timeout: 70 });
      if (!t.gone && b.escorting === t) {
        const dir = Math.PI / 2;
        t.body.vx += Math.cos(dir) * 200; t.body.vy += Math.sin(dir) * 200;
        b.escorting = null;
        Ej.complete(t, kind === 'police' ? 'police' : 'staff', { type: 'argue', dir });
      }
    } finally { b.escorting = null; t.escorted = false; }
  };
})();
