/* Last Call — you. Walk the floor, stare at people until they reconsider, carry a mop, and
   drag grown adults toward the door while they hold onto the furniture. */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph, NPC: N, W: Wd, People: Pp } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Pl = (LC.Player = {});
  const L = () => LC.Lines;

  const TOOLS = [
    { id: 'hands', name: 'Hands', hint: 'Grab people. Pick things up.' },
    { id: 'mop', name: 'Mop', hint: 'Spills and vomit. Leaves the floor wet.' },
    { id: 'broom', name: 'Broom', hint: 'Glass, trash, food, debris.' },
    { id: 'sign', name: 'Wet Floor Sign', count: 'sign', hint: 'Stops slips. People respect it more than you.' },
    { id: 'water', name: 'Water', count: 'water', hint: 'Sobers people up. Slightly.' },
    { id: 'breath', name: 'Breathalyzer', hint: 'Reads blood alcohol and poor choices.' },
    { id: 'zip', name: 'Zip Ties', count: 'zip', hint: 'Serious emergencies only.' },
    { id: 'rope', name: 'Barrier Rope', count: 'rope', hint: 'Close something off.' },
    { id: 'aid', name: 'First Aid', count: 'aid', hint: 'For the fallen. There will be fallen.' },
  ];
  Pl.TOOLS = TOOLS;
  const REACH = 54;

  Pl.create = (look) => {
    const G = LC.G;
    const lk = Object.assign(Pp.randomLook({ fem: false }), {
      top: 'jacket', topC: '#15151a', topC2: '#23232a', bot: 'pants', botC: '#17171c', shoes: '#111', hat: null, glasses: null, sash: null, glow: false, chain: false, bag: false, earrings: false,
      skin: '#b8835a', hair: 'short', hairC: '#1d1612', beard: 'stubble', build: 1.1, height: 1.03,
    }, look || {});
    const p = {
      kind: 'player', name: 'Unit Four', look: lk, security: true, earpiece: true,
      x: S.doorStaff.x - 40, y: S.inside.y - 40, z: 0, face: -Math.PI / 2, back: true, pose: 'stand', act: null, expr: 'tired', t: 0, walk: 0, beat: 0,
      tool: 'hands', inv: { sign: 3, water: 4, zip: 2, rope: 2, aid: 3 },
      stamina: 1, will: 1, grab: null, carry: null, pocket: [], stare: { n: null, t: 0, bubbled: false },
      down: 0, stagger: 0, flash: false, aim: { x: 0, y: 0 }, sob: 1, drunk: 0, heldTool: null, room: null, prompt: '', energy: 0.6,
    };
    p.body = Ph.add({ x: p.x, y: p.y, r: 9.5, m: 9, fric: 10, kind: 'char', ent: p });
    G.chars.push(p);
    G.player = p;
    return p;
  };

  /* ---------------- helpers ---------------- */
  Pl.sprinting = () => { const p = LC.G.player; return p && p.sprinting; };
  Pl.say = (text, o = {}) => {
    const p = LC.G.player;
    p.bubble = { text, t0: LC.G.t, dur: o.dur || 1.4 + text.length * 0.05, kind: 'player', pri: 3 };
    if (LC.Audio && LC.Audio.ready && !o.silent) LC.Audio.voice(p, text, false);
  };
  Pl.mutter = (pool, chance = 1) => { if (Math.random() < chance) Pl.say(U.pick(pool)); };
  Pl.toolDef = (id) => TOOLS.find((t) => t.id === id);
  Pl.setTool = (id) => {
    const p = LC.G.player;
    if (!p || p.grab) return;
    if (p.carry && id !== 'hands') Pl.dropCarry();
    p.tool = id;
    LC.sfx('click', p.x, p.y, { vol: 0.4 });
  };
  Pl.cycleTool = (d) => {
    const p = LC.G.player;
    const i = TOOLS.findIndex((t) => t.id === p.tool);
    Pl.setTool(TOOLS[(i + d + TOOLS.length) % TOOLS.length].id);
  };

  // what the cursor is over
  Pl.npcAt = (x, y, maxD = 380) => {
    const G = LC.G, p = G.player;
    let best = null, bd = 26 * 26;
    for (const c of G.chars) {
      if (c === p || c.gone || c.hidden) continue;
      const cy = c.y - (c.z || 0) - (c.pose === 'fallen' || c.pose === 'lie' ? 6 : 18);
      const d = U.dist2(x, y, c.x, cy);
      if (d < bd && U.dist2(p.x, p.y, c.x, c.y) < maxD * maxD) { bd = d; best = c; }
    }
    return best;
  };
  Pl.target = () => {
    const G = LC.G, p = G.player, a = p.aim;
    const inReach = (x, y, r = REACH) => U.dist2(p.x, p.y, x, y) < r * r;
    const n = Pl.npcAt(a.x, a.y);
    if (n && inReach(n.x, n.y, REACH + 10)) return { kind: 'npc', n };
    const pr = Wd.nearestProp(a.x, a.y, 20, (q) => !q.carriedBy && !q.broken && q.kind !== 'balloon');
    if (pr && inReach(pr.body.x, pr.body.y)) return { kind: 'prop', p: pr };
    const it = Wd.itemNear(a.x, a.y, 20);
    if (it && inReach(it.x, it.y)) return { kind: 'item', it };
    // fall back to what's in front of you
    const fx = p.x + Math.cos(p.face) * 30, fy = p.y + Math.sin(p.face) * 22;
    const n2 = Pl.npcAt(fx, fy - 18);
    if (n2 && inReach(n2.x, n2.y, REACH)) return { kind: 'npc', n: n2 };
    return null;
  };

  /* ---------------- interactables ---------------- */
  function interactable(p) {
    const G = LC.G;
    const near = (x, y, r = 48) => U.dist2(p.x, p.y, x, y) < r * r;
    const em = M.door('emergency');
    if (near(em.cx, em.cy + 12, 56)) return { label: em.target > 0.5 ? 'Close the emergency exit' : 'Open the emergency exit', fn: () => { em.target = em.target > 0.5 ? 0 : 1; if (LC.Incidents) LC.Incidents.emergencyToggled(em.target > 0.5); } };
    const gate = M.door('patioGate');
    if (near(gate.cx - 16, gate.cy, 50)) return { label: gate.target > 0.5 ? 'Lock the gate' : 'Unlock the gate', fn: () => { gate.target = gate.target > 0.5 ? 0 : 1; } };
    for (const s of S.stalls) {
      const d = M.door(s.door);
      if (near(s.front.x, s.front.y, 30)) {
        if (s.occ.length && d.target < 0.5) return { label: 'Open the stall', fn: () => LC.Incidents.openStall(s) };
      }
    }
    if (near(S.breaker.x, S.breaker.y, 44) && !G.power) return { label: 'Reset the breaker', fn: () => LC.Events.restorePower() };
    if (near(S.alarm.x, S.alarm.y, 44) && G.alarm) return { label: 'Silence the fire alarm', fn: () => LC.Events.silenceAlarm() };
    if (near(S.cctv.x, S.cctv.y, 44)) return { label: 'Watch the cameras', fn: () => LC.CCTV.show() };
    if (near(S.supply.x, S.supply.y, 50)) return { label: 'Restock supplies', fn: () => Pl.restock() };
    if (p.pocket.length && near(S.coat.x, S.coat.y, 56)) return { label: 'Hand in lost property', fn: () => Pl.handInLost() };
    if (p.carry) {
      const pr = p.carry;
      if (pr.kind === 'extinguisher') {
        const mount = M.propSpawns.find((s) => s.kind === 'extinguisher' && U.dist2(p.x, p.y, s.x, s.y) < 60 * 60 && !Wd.props.some((q) => q !== pr && q.mounted && U.dist2(q.body.x, q.body.y, s.x, s.y) < 16));
        if (mount) return { label: 'Put it back on the wall', fn: () => { Pl.dropCarry({ x: mount.x, y: mount.y }); pr.mounted = true; pr.body.ghost = true; pr.body.pinned = true; if (LC.Incidents) LC.Incidents.propReturned(pr); } };
      }
      if (U.dist2(p.x, p.y, pr.home.x, pr.home.y) < 70 * 70 && pr.kind !== 'cone' && pr.kind !== 'weird' && pr.kind !== 'sign' && pr.kind !== 'crocodile') return { label: 'Put it back', fn: () => { Pl.dropCarry({ x: pr.home.x, y: pr.home.y }); if (LC.Incidents) LC.Incidents.propReturned(pr); } };
    }
    return null;
  }
  Pl.restock = () => {
    const p = LC.G.player;
    p.inv = { sign: Math.max(p.inv.sign, 3 + countSignsOut()), water: 6, zip: Math.max(p.inv.zip, 2), rope: Math.max(p.inv.rope, 2), aid: Math.max(p.inv.aid, 3) };
    p.inv.sign = Math.min(p.inv.sign, 6 - countSignsOut());
    Pl.say('Restocked.');
    LC.sfx('click', p.x, p.y);
  };
  function countSignsOut() { return Wd.props.filter((q) => q.kind === 'sign' && !q.worn).length; }
  Pl.handInLost = () => {
    const p = LC.G.player;
    const n = p.pocket.length;
    for (const it of p.pocket) { LC.stat('lostPropertyHandedIn'); if (LC.Incidents) LC.Incidents.itemHandedIn(it); }
    p.pocket = [];
    Pl.say(n === 1 ? 'One for the pile.' : n + ' for the pile.');
    if (LC.Staff.coat) N.say(LC.Staff.coat, U.pick(['Lovely. Another one.', 'Straight on the pile.', 'Is it sticky? It\'s sticky.']), { pri: 1 });
  };

  /* ---------------- tools ---------------- */
  function useTool(p, held, pressed) {
    const G = LC.G, a = p.aim, tool = p.tool;
    const reachPt = () => {
      const d = U.dist(p.x, p.y, a.x, a.y);
      if (d <= REACH) return { x: a.x, y: a.y };
      return { x: p.x + ((a.x - p.x) / d) * REACH, y: p.y + ((a.y - p.y) / d) * REACH };
    };
    switch (tool) {
      case 'hands': {
        if (!pressed) return;
        if (p.grab) { Pl.release(); return; }
        if (p.carry) { Pl.dropCarry(); return; }
        const t = Pl.target();
        if (!t) return;
        if (t.kind === 'npc') Pl.grabNPC(t.n);
        else if (t.kind === 'prop') Pl.pickProp(t.p);
        else if (t.kind === 'item') Pl.pocketItem(t.it);
        return;
      }
      case 'mop': case 'broom': {
        if (!held) { p.cleaning = 0; return; }
        const pt = reachPt();
        p.act = tool;
        const r = Wd.clean(tool, pt.x, pt.y, 26, tool === 'mop' ? 1.1 : 1.5, G.dt);
        p.cleaning = r ? 1 : 0;
        if (r && Math.random() < G.dt * 3) LC.sfx(tool === 'mop' ? 'mop' : 'sweep', pt.x, pt.y, { vol: 0.5 });
        if (r && r.done) {
          if (LC.Incidents) LC.Incidents.messCleaned(r.m);
          if (r.m.kind === 'vomit') Pl.mutter(['Lovely.', 'Living the dream.', 'This is fine.'], 0.5);
        }
        return;
      }
      case 'sign': {
        if (!pressed) return;
        const t = Wd.nearestProp(a.x, a.y, 24, (q) => q.kind === 'sign' && !q.carriedBy);
        if (t && U.dist(p.x, p.y, t.body.x, t.body.y) < REACH + 10) { Wd.removeProp(t); p.inv.sign++; LC.sfx('click', p.x, p.y); return; }
        if (p.inv.sign <= 0) { Pl.say('Out of signs. Supply shelf, backstage.'); return; }
        const pt = reachPt();
        if (!Ph.free(pt.x, pt.y, 7)) return;
        Wd.addProp('sign', pt.x, pt.y);
        p.inv.sign--;
        LC.stat('signsPlaced');
        LC.sfx('sign', pt.x, pt.y);
        if (LC.Incidents) LC.Incidents.signPlaced(pt.x, pt.y);
        return;
      }
      case 'water': {
        if (!pressed) return;
        const t = Pl.target();
        if (!t || t.kind !== 'npc') { if (p.inv.water > 0 && !t) { Pl.say(U.pick(['I need this more than they do.', 'Hydration.'])); p.inv.water--; } return; }
        if (p.inv.water <= 0) { Pl.say('Out of water.'); return; }
        p.inv.water--;
        Pl.giveWater(t.n);
        return;
      }
      case 'breath': {
        if (!pressed) return;
        const t = Pl.target();
        if (t && t.kind === 'npc' && t.n.kind === 'guest') { LC.HUD.breathCard(t.n); LC.stat('breathTests'); LC.sfx('beep', p.x, p.y); if (t.n.override === null && !t.n.seat) { N.faceTo(t.n, p.x, p.y); N.say(t.n, U.pick(['Blow into... what?', 'Is this a kazoo?', 'Do I win something?', "I've had two. Twelve. Two."]), { pri: 1 }); } }
        return;
      }
      case 'zip': {
        if (!pressed) return;
        const t = p.grab ? { kind: 'npc', n: p.grab.npc } : Pl.target();
        if (!t || t.kind !== 'npc' || t.n.kind !== 'guest') return;
        if (p.inv.zip <= 0) { Pl.say('No zip ties left.'); return; }
        const n = t.n;
        if (n.restrained) return;
        const violent = n.overrideName === 'fight' || (p.grab && p.grab.type === 'fighter') || n.flags.violent;
        p.inv.zip--;
        n.restrained = true;
        LC.stat('zipTies');
        LC.sfx('zip', n.x, n.y);
        if (!violent) { LC.stat('securityComplaints'); Pl.say('...was that necessary?'); N.say(n, "ZIP TIES?! I was DANCING!", { pri: 2 }); }
        if (n.overrideName === 'fight' && LC.Social) LC.Social.removeFighter(n);
        if (!p.grab) Pl.grabNPC(n);
        return;
      }
      case 'rope': {
        if (!pressed) return;
        const b = Wd.barriers.find((q) => U.dist(a.x, a.y, q.cx, q.cy) < 30);
        if (b && U.dist(p.x, p.y, b.cx, b.cy) < REACH + 20) { Wd.removeBarrier(b); p.inv.rope++; return; }
        if (p.inv.rope <= 0) { Pl.say('No rope left.'); return; }
        const pt = reachPt();
        const ang = p.face + Math.PI / 2, half = 36;
        Wd.addBarrier(pt.x - Math.cos(ang) * half, pt.y - Math.sin(ang) * half, pt.x + Math.cos(ang) * half, pt.y + Math.sin(ang) * half);
        p.inv.rope--;
        LC.stat('ropesPlaced');
        return;
      }
      case 'aid': {
        if (!pressed) return;
        const t = Pl.target();
        if (!t || t.kind !== 'npc') return;
        if (p.inv.aid <= 0) { Pl.say('First aid kit is empty.'); return; }
        const n = t.n;
        if (n.injured > 0 || n.needsAid || n.overrideName === 'fallen' || n.expr === 'sick') {
          p.inv.aid--;
          n.injured = 0; n.needsAid = false; n.daze = 0;
          N.endOverride(n);
          N.say(n, U.pick(['Thanks. I think.', 'Am I dead?', 'You smell like mop.', "I'm FINE. Thank you. I'm fine."]), { pri: 2 });
          LC.stat('peopleRescued');
          if (LC.Incidents) LC.Incidents.aided(n);
        } else Pl.say(U.pick(["They're fine. Unfortunately.", 'Nothing to patch up.']));
        return;
      }
    }
  }
  Pl.giveWater = (n) => {
    const G = LC.G;
    N.giveDrink(n, Wd.DRINKS.find((d) => d.water));
    n.sob = U.clamp(n.sob + 0.12, 0, 1);
    n.mood.anger = Math.max(0, n.mood.anger - 0.4);
    LC.stat('waterGiven');
    N.say(n, U.pick(['Water? Wow. Okay.', "Oh. I'm a plant now.", "Thank you. I didn't know I needed that.", "It's... just water?"]), { pri: 2 });
    if (LC.Incidents) LC.Incidents.watered(n);
  };

  /* ---------------- carrying ---------------- */
  Pl.pickProp = (pr) => {
    const p = LC.G.player;
    if (pr.kind === 'table' || pr.kind === 'beanbag') {
      if (pr.fallen) { Wd.standUp(pr); LC.stat('furnitureRighted'); Pl.say('Up you get.'); }
      return;
    }
    if (pr.fallen) { Wd.standUp(pr); LC.stat('furnitureRighted'); return; }
    if (pr.carriedBy && pr.carriedBy !== p) {
      // take it off whoever has it
      const h = pr.carriedBy;
      N.drop(h);
      if (LC.Incidents) LC.Incidents.propTaken(pr, h);
      N.say(h, U.pick(['Hey! That was mine!', 'I was LOOKING after it!', 'Fine. Take it.']), { pri: 2 });
    }
    if (pr.worn) Wd.unwear(pr);
    pr.carriedBy = p; pr.mounted = false; pr.body.pinned = false;
    p.carry = pr;
    if (LC.Incidents) LC.Incidents.propTaken(pr, null);
  };
  Pl.dropCarry = (place) => {
    const p = LC.G.player, pr = p.carry;
    if (!pr) return;
    pr.carriedBy = null; p.carry = null; pr.body.ghost = false;
    const fx = p.x + Math.cos(p.face) * 20, fy = p.y + Math.sin(p.face) * 14;
    const spot = place || (Ph.free(fx, fy, pr.body.r) ? { x: fx, y: fy } : { x: p.x, y: p.y + 14 });
    pr.body.x = spot.x; pr.body.y = spot.y; pr.body.vx = 0; pr.body.vy = 0;
    if (LC.Incidents) LC.Incidents.propDropped(pr);
  };
  Pl.pocketItem = (it) => {
    const p = LC.G.player;
    Wd.removeItem(it);
    p.pocket.push(it);
    LC.stat('itemsFound');
    Pl.say('Found ' + it.label + '.');
    if (LC.Incidents) LC.Incidents.itemFound(it);
  };

  /* ---------------- grabbing people ---------------- */
  Pl.grabNPC = (n) => {
    const G = LC.G, p = G.player;
    if (p.grab || n.kind === 'staff' || n.police) { if (n.kind === 'staff') Pl.say(U.pick(['Not staff.', "That's Tank. No."])); return; }
    if (n.z > 20) { Pl.say(U.pick(['Get down here first.', "I'm not climbing up there."])); return; }
    if (n.hidden) return;
    LC.Eject.startEscort(p, n);
  };
  Pl.release = (quiet) => {
    const p = LC.G.player;
    if (!p.grab) return;
    LC.Eject.endEscort(p, quiet ? 'quiet' : 'released');
  };

  /* ---------------- knockdown / hit ---------------- */
  Pl.knockDown = (dir, force = 1) => {
    const p = LC.G.player;
    if (p.down > 0) return;
    if (p.grab) Pl.release(true);
    if (p.carry) Pl.dropCarry();
    p.down = 1.2 * force; p.fallDir = dir; p.fallK = 0;
    p.body.vx += Math.cos(dir) * 160; p.body.vy += Math.sin(dir) * 120;
    LC.sfx('thud', p.x, p.y);
    LC.R.cam.shake = 6;
    LC.stat('timesYouFell');
  };
  Pl.hit = (by, dir) => {
    const p = LC.G.player;
    p.stagger = 0.45;
    p.body.vx += Math.cos(dir) * 140; p.body.vy += Math.sin(dir) * 100;
    LC.R.cam.shake = 8;
    LC.stat('timesYouGotHit');
    if (p.grab) { p.grab.hold -= 0.35; }
    Pl.say(U.pick(['OW.', 'Right.', 'Okay. OKAY.', 'That was a mistake.']));
  };

  /* ---------------- shove ---------------- */
  function shove(p) {
    const G = LC.G;
    const fx = p.x + Math.cos(p.face) * 22, fy = p.y + Math.sin(p.face) * 16;
    const hits = Ph.query(fx, fy, 22, (b) => b.kind === 'char' && b.ent !== p && b.ent.kind !== 'staff');
    if (!hits.length) {
      const pr = Ph.query(fx, fy, 18, (b) => b.kind === 'prop');
      if (pr.length) { const b = pr[0]; b.vx += Math.cos(p.face) * 240 / b.m * 3; b.vy += Math.sin(p.face) * 180 / b.m * 3; }
      return;
    }
    LC.sfx('shove', fx, fy);
    for (const b of hits) {
      const n = b.ent;
      b.vx += Math.cos(p.face) * 230; b.vy += Math.sin(p.face) * 170;
      if (n.kind !== 'guest') continue;
      LC.stat('shoves');
      if (n.drink && Math.random() < 0.5) N.spillDrink(n, p.face, 1);
      if (n.seat) N.standUp(n);
      const arg = LC.Social.argumentOf(n);
      if (arg) { LC.Social.calmArgument(arg, 0.3); arg.separated = true; n.mood.anger += 0.1; }
      const f = LC.Social.fightOf(n);
      if (f) { f.separated = true; LC.Social.removeFighter(n); n.daze = (n.daze || 0) + 0.2; N.say(n, U.pick(['GET OFF!', "HE STARTED IT!", 'Fine! FINE!']), { pri: 2 }); if (LC.Incidents) LC.Incidents.separated(f, n); }
      else if (Math.random() < 0.5) N.say(n, U.pick(L().shoveReact), { pri: 1 });
      if (n.filming || LC.Events && LC.Events.influencerWatching(p)) LC.stat('securityComplaints');
      if (!n.incident && !arg && !f && Math.random() < 0.25) LC.stat('customerComplaints');
      if ((1 - n.sob) > 0.7 && Math.random() < 0.35) N.knockDown(n, p.face, 0.7);
    }
    if (Math.random() < 0.3) Pl.say(U.pick(L().shove));
  }

  /* ---------------- staring ---------------- */
  function stare(p, dt) {
    const G = LC.G, a = p.aim;
    const n = Pl.npcAt(a.x, a.y, 420);
    const st = p.stare;
    const visible = n && M.sight(p.x, p.y - 20, n.x, n.y - 20);
    if (!visible || n.kind === 'staff' || (G.dialog && G.dialog.n === n)) {
      st.t = Math.max(0, st.t - dt * 2);
      if (st.t === 0) { if (st.n && st.n.stared) st.n.stared = 0; st.n = null; st.bubbled = false; }
      return;
    }
    if (st.n !== n) { if (st.n) st.n.stared = 0; st.n = n; st.t = 0; st.bubbled = false; }
    // a torch in the face speeds things up considerably
    const lit = p.flash && Math.abs(U.angDiff(p.face, Math.atan2(n.y - p.y, n.x - p.x))) < 0.45 && U.dist(p.x, p.y, n.x, n.y) < 340;
    st.t += dt * (lit ? 1.8 : 1);
    n.stared = st.t;
    n.staredBy = p;
    if (LC.Incidents && LC.Incidents.onStare(n, st.t, dt)) return;
    // at closing, a long look (or the torch) is all the encouragement most people need
    if (G.closing && n.lingering && !n.toldToLeave && st.t > (lit ? 0.9 : 1.8) && U.dist(p.x, p.y, n.x, n.y) < 300) {
      LC.Director.herd(n, 'stare');
      LC.stat('stareDowns');
      st.bubbled = true;
      return;
    }
    // people who are not up to anything get uncomfortable
    if (st.t > 2.6 && !st.bubbled && n.kind === 'guest' && !n.override && U.dist(p.x, p.y, n.x, n.y) < 260) {
      st.bubbled = true;
      N.faceTo(n, p.x, p.y);
      N.say(n, U.pick(L().stareNormal), { pri: 1 });
      N.emote(n, 'sweat', 1.5);
      LC.stat('awkwardStares');
    }
  }

  /* ---------------- update ---------------- */
  Pl.update = (dt, input) => {
    const G = LC.G, p = G.player, b = p.body;
    p.t += dt;
    p.room = M.roomAt(b.x, b.y);
    // aim
    const mw = LC.R.toWorld(input.mx, input.my);
    p.aim.x = mw.x; p.aim.y = mw.y;
    // knocked down
    if (p.down > 0) {
      p.down -= dt;
      p.pose = 'fallen'; p.fallSide = Math.cos(p.fallDir || 0) >= 0 ? 1 : -1;
      p.fallK = p.down > 0.35 ? Math.min(1, (p.fallK || 0) + dt * 5) : Math.max(0, p.down / 0.35);
      p.expr = 'ko';
      b.vx *= 0.9; b.vy *= 0.9;
      p.x = b.x; p.y = b.y;
      if (p.down <= 0) { p.fallK = 0; p.pose = 'stand'; }
      return;
    }
    if (p.stagger > 0) p.stagger -= dt;
    // movement
    let mx = input.dx, my = input.dy;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const wantSprint = input.sprint && ml > 0.1 && p.stamina > 0.05 && !p.carryHeavy;
    p.sprinting = wantSprint;
    p.stamina = U.clamp(p.stamina + (wantSprint ? -0.2 : 0.11) * dt, 0, 1);
    let speed = wantSprint ? 196 : 122;
    if (p.grab) speed *= LC.Eject.playerSpeedFactor(p);
    if (p.carry) speed *= p.carry.kind === 'crocodile' || p.carry.kind === 'plant' ? 0.8 : 0.9;
    if (p.stagger > 0) speed *= 0.3;
    if (G.dialog) speed *= 0.2;
    const acc = Math.min(1, 14 * dt);
    b.vx += (mx * speed - b.vx) * acc; b.vy += (my * speed - b.vy) * acc;
    p.x = b.x; p.y = b.y;
    const sp = Math.hypot(b.vx, b.vy);
    // face the cursor (or the direction of travel on touch)
    const aimAng = Math.atan2(p.aim.y - p.y, p.aim.x - p.x);
    const target = input.touch && ml > 0.2 && !input.aimed ? Math.atan2(my, mx) : aimAng;
    p.face += U.angDiff(p.face, target) * Math.min(1, dt * 14);
    p.back = Math.sin(p.face) < -0.45;
    // pose
    if (sp > 18) { p.pose = sp > 160 ? 'run' : 'walk'; p.walk += sp * dt * 0.1; }
    else p.pose = 'stand';
    p.act = null;
    if (p.grab) p.pose = sp > 18 ? 'walk' : 'hold';
    else if (p.carry) p.pose = p.carry.kind === 'plant' || p.carry.kind === 'crocodile' || p.carry.kind === 'weird' ? 'carryUp' : 'carry';
    p.heldTool = p.grab || p.carry ? null : p.tool;
    // tools
    if (!G.dialog && !LC.CCTV.isOpen()) {
      useTool(p, input.lmb, input.lmbPressed);
      if ((p.tool === 'mop' || p.tool === 'broom') && input.lmb && !p.carry && !p.grab) p.pose = p.tool;
      if (input.ePressed) {
        const it = interactable(p);
        const t = Pl.target();
        if (p.grab) LC.Dialogue.open(p.grab.npc);
        else if (t && t.kind === 'npc') LC.Dialogue.open(t.n);
        else if (it) it.fn();
        else if (LC.Door.playerOnDuty() && G.queue[0]) LC.Dialogue.open(G.queue[0]);
      }
      if (input.spacePressed) {
        if (p.grab) LC.Eject.peelOrThrow(p);
        else shove(p);
      }
    }
    // prompt text
    p.prompt = prompt(p);
    // slip on your own mopping
    if (sp > 150 && !p.grab) {
      const m = Wd.slipAt(b.x, b.y);
      if (m && Math.random() < dt * m.def.slip * 1.6) { Pl.knockDown(Math.atan2(b.vy, b.vx), 1.1); Pl.mutter(L().mutterSlip); LC.stat('youSlipped'); }
    }
    stare(p, dt);
    // expression wears down over the night
    const late = U.clamp((G.clock - 60) / 360, 0, 1);
    p.expr = p.stagger > 0 ? 'shock' : p.exprT > 0 ? p.exprTemp : late > 0.75 ? 'dead' : 'tired';
    if (p.exprT > 0) p.exprT -= dt;
    if (p.bubble && G.t - p.bubble.t0 > p.bubble.dur) p.bubble = null;
    p.beat = G.music.beatPhase || 0;
  };
  Pl.flashExpr = (e, t = 1.5) => { const p = LC.G.player; p.exprTemp = e; p.exprT = t; };

  function prompt(p) {
    const G = LC.G;
    if (G.dialog) return '';
    if (p.grab) {
      const g = p.grab;
      if (g.anchor) return '[SPACE] peel their fingers off  ·  [CLICK] let go';
      const out = LC.Eject.nearExit(g.npc);
      return (out ? '[SPACE] throw them out  ·  ' : 'Drag them outside  ·  ') + '[E] talk  ·  [CLICK] let go' + (p.inv.zip > 0 ? '  ·  [7] zip ties' : '');
    }
    const it = interactable(p);
    const t = Pl.target();
    const parts = [];
    if (t && t.kind === 'npc') {
      parts.push('[E] talk');
      if (p.tool === 'hands') parts.push('[CLICK] grab');
      else if (p.tool === 'water') parts.push('[CLICK] give water');
      else if (p.tool === 'breath') parts.push('[CLICK] breathalyze');
      else if (p.tool === 'aid') parts.push('[CLICK] first aid');
      else if (p.tool === 'zip') parts.push('[CLICK] zip tie');
      parts.push('[SPACE] shove');
    } else if (it) parts.push('[E] ' + it.label.toLowerCase());
    else if (t && t.kind === 'prop' && p.tool === 'hands') parts.push(t.p.fallen ? '[CLICK] stand it up' : t.p.kind === 'table' ? '' : '[CLICK] pick up');
    else if (t && t.kind === 'item' && p.tool === 'hands') parts.push('[CLICK] pick up ' + t.it.label);
    else if (p.carry) parts.push('[CLICK] put down' + (it ? '' : ''));
    else if (LC.Door.playerOnDuty() && G.queue[0]) parts.push('[E] check the next ID');
    if (it && t) parts.push('');
    return parts.filter(Boolean).join('  ·  ');
  }

  /* ---------------- held tools art ---------------- */
  Pl.drawTool = (g, tool, hand, ch) => {
    const x = hand.x, y = hand.y;
    const mopping = ch.pose === 'mop' || ch.pose === 'broom';
    const sw = mopping ? Math.sin(ch.t * 9) * 6 : 0;
    switch (tool) {
      case 'mop': case 'broom':
        g.strokeStyle = '#8a6a44'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 2, y - 10); g.lineTo(x + 8 + sw, y + 22); g.stroke();
        if (tool === 'mop') { g.fillStyle = '#c8c8c0'; for (let i = -3; i <= 3; i++) { g.fillRect(x + 8 + sw + i * 1.4, y + 21, 1.3, 6); } }
        else { g.fillStyle = '#d8b050'; g.fillRect(x + 3 + sw, y + 21, 11, 4); g.fillStyle = '#6a4a24'; g.fillRect(x + 3 + sw, y + 20, 11, 1.5); }
        break;
      case 'sign': g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(x - 3, y + 8); g.lineTo(x, y - 6); g.lineTo(x + 3, y + 8); g.fill(); break;
      case 'water': g.fillStyle = 'rgba(170,215,255,0.85)'; g.fillRect(x - 1.6, y - 7, 3.2, 8); g.fillStyle = '#3a8ad8'; g.fillRect(x - 1.8, y - 8.5, 3.6, 1.8); break;
      case 'breath': g.fillStyle = '#222'; g.fillRect(x - 2, y - 7, 4, 8); g.fillStyle = '#6aff8a'; g.fillRect(x - 1.2, y - 5.5, 2.4, 2); break;
      case 'zip': g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.arc(x, y - 2, 3, 0, 7); g.arc(x + 1, y - 2, 2, 0, 7); g.stroke(); break;
      case 'rope': g.strokeStyle = '#a0102a'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y - 1, 3.4, 0, 7); g.stroke(); break;
      case 'aid': g.fillStyle = '#2a9a4a'; g.fillRect(x - 3.5, y - 4, 7, 6); g.fillStyle = '#fff'; g.fillRect(x - 0.6, y - 3.3, 1.2, 4.6); g.fillRect(x - 2.3, y - 1.6, 4.6, 1.2); break;
    }
    if (ch.flash) { g.fillStyle = '#1a1a1e'; g.fillRect(hand.lx - 1.5, hand.ly - 5, 3, 7); g.fillStyle = '#fff6d8'; g.fillRect(hand.lx - 1.5, hand.ly - 6, 3, 1.5); }
  };
})();
