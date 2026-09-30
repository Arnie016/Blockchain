/* Last Call — incidents: things people do that become your problem. The framework handles
   noticing (you see it, you stare at it, a camera catches it, or somebody radios), the
   objective list with its sarcastic titles and payoffs, stare-downs, and the hooks the rest of
   the game calls when you mop, grab, return or confiscate something. Definitions live in
   incdefs.js. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd, Phys: Ph } = LC;
  const T = M.T, S = M.S, P = M.P;
  const I = (LC.Incidents = { defs: {} });
  const L = () => LC.Lines;

  /* ================= objectives ================= */
  const O = (LC.Objectives = { list: [], flashes: [], toasts: [] });
  O.add = (inc, how) => {
    if (O.list.find((e) => e.inc === inc)) return;
    const e = { inc, title: inc.title, where: inc.roomName(), t: LC.G.t, done: false, reported: how === 'radio' };
    O.list.unshift(e);
    if (how !== 'radio') O.flash(inc.title, inc.sub || U.pick(L().objectiveSubs));
    else O.flash(inc.title, 'Reported: ' + e.where + '. Go and look.');
    LC.sfx('objective', 0, 0, { ui: true });
  };
  O.flash = (title, sub) => { O.flashes.push({ title, sub, t: 0 }); };
  O.toast = (title, sub, ok = true) => { O.toasts.push({ title, sub, ok, t: 0 }); };
  O.done = (inc, text, ok) => {
    const e = O.list.find((q) => q.inc === inc);
    if (e) { e.done = true; e.ok = ok; e.payoff = text; e.doneT = LC.G.t; }
    O.toast((ok ? 'RESOLVED: ' : 'FAILED: ') + inc.title, text, ok);
  };
  O.update = (dt) => {
    const G = LC.G;
    for (let i = O.list.length - 1; i >= 0; i--) {
      const e = O.list[i];
      if (e.done && G.t - e.doneT > 7) O.list.splice(i, 1);
      else if (!e.done) { e.where = e.inc.roomName(); e.title = e.inc.title; }
    }
    for (const f of O.flashes) f.t += dt;
    while (O.flashes.length && O.flashes[0].t > 2.8) O.flashes.shift();
    // only the first flash animates; the rest wait their turn
    for (let i = 1; i < O.flashes.length; i++) O.flashes[i].t = 0;
    for (const t of O.toasts) t.t += dt;
    while (O.toasts.length && O.toasts[0].t > 4.2) O.toasts.shift();
    for (let i = 1; i < O.toasts.length; i++) O.toasts[i].t = Math.min(O.toasts[i].t, 0);
  };

  /* ================= lifecycle ================= */
  I.active = [];
  I.lastStart = {};
  function roomName() { const r = M.roomAt(this.x, this.y); return r ? r.name : 'Somewhere'; }
  function makeInc(type, n, data = {}) {
    const def = I.defs[type];
    const inc = {
      id: U.uid(), type, def, n, others: [], x: n ? n.x : data.x || 0, y: n ? n.y : data.y || 0, t0: LC.G.t, state: 'active',
      noticed: false, reported: false, seeT: 0, esc: 1, data, roomName,
    };
    inc.title = typeof def.title === 'function' ? def.title(inc) : def.title;
    inc.sub = typeof def.sub === 'function' ? def.sub(inc) : def.sub;
    return inc;
  }
  I.start = (type, n, data = {}) => {
    const G = LC.G, def = I.defs[type];
    if (!def) return null;
    if (n && (n.gone || n.incident)) return null;
    const inc = makeInc(type, n, data);
    if (def.setup && def.setup(inc) === false) return null;
    I.active.push(inc);
    I.lastStart[type] = G.t;
    if (n) {
      n.incident = inc;
      if (def.script) N.setTask(n, runScript(def, n, inc), 'inc:' + type, 3);
    }
    LC.stat('incidents');
    if (G.debugInc) console.log('incident', type, n && n.name);
    return inc;
  };
  // an incident whose behaviour is driven elsewhere (arguments, fights, vomit, sleepers)
  I.emergent = (type, n, data = {}) => {
    const inc = makeInc(type, n, data);
    if (!I.defs[type]) return null;
    if (I.defs[type].setup) I.defs[type].setup(inc);
    I.active.push(inc);
    if (n && !n.incident && type !== 'vomit') n.incident = inc;
    return inc;
  };
  function* runScript(def, n, inc) {
    try { yield* def.script(n, inc); }
    finally { if (def.cleanup) def.cleanup(n, inc); }
    // the script ran out: the incident ends however the definition says
    if (inc.state === 'active' && def.onScriptEnd) def.onScriptEnd(inc);
  }
  function detach(inc) {
    if (inc.n && inc.n.incident === inc) inc.n.incident = null;
    for (const o of inc.others) if (o.incident === inc) o.incident = null;
    if (inc.n) { inc.n.frozen = false; }
  }
  I.resolve = (inc, how, text) => {
    const G = LC.G;
    if (!inc || inc.state !== 'active') return;
    inc.state = 'resolved'; inc.how = how;
    const def = inc.def;
    const pool = (def.resolved && (def.resolved[how] || def.resolved.any)) || ['Sorted.'];
    const msg = text || (typeof pool === 'function' ? pool(inc) : U.pick(pool));
    if (inc.noticed || inc.reported || how === 'eject') O.done(inc, how === 'stare' ? 'RESOLVED WITH EYE CONTACT. ' + msg : msg, true);
    if (how !== 'self' && how !== 'quiet') LC.stat('incidentsResolved');
    LC.stat('resolvedBy_' + how);
    if (def.onResolve) def.onResolve(inc, how);
    const n = inc.n;
    detach(inc);
    if (n && !n.gone && how !== 'eject' && n.taskName === 'inc:' + inc.type) N.cancelTask(n);
    if (n) n.complied = false;
    if (how !== 'quiet' && how !== 'self') LC.Player.flashExpr(how === 'stare' ? 'smug' : 'tired', 1.2);
    remove(inc);
  };
  I.fail = (inc, how, text) => {
    if (!inc || inc.state !== 'active') return;
    inc.state = 'failed'; inc.how = how;
    const def = inc.def;
    const pool = def.failed || ['That went badly.'];
    const msg = text || (typeof pool === 'function' ? pool(inc) : U.pick(pool));
    if (inc.noticed || inc.reported) O.done(inc, msg, false);
    else if (def.loud) O.toast('MISSED: ' + inc.title, msg, false);
    LC.stat('incidentsFailed');
    if (!inc.noticed) LC.stat('incidentsMissed');
    if (def.onFail) def.onFail(inc, how);
    const n = inc.n;
    detach(inc);
    if (n && !n.gone && n.taskName === 'inc:' + inc.type) N.cancelTask(n);
    remove(inc);
  };
  // ends without a verdict (actor wandered off or left the club)
  I.drop = (inc) => {
    if (!inc || inc.state !== 'active') return;
    inc.state = 'dropped';
    const e = O.list.find((q) => q.inc === inc);
    if (e) { e.done = true; e.ok = true; e.payoff = 'They left. Problem solved itself.'; e.doneT = LC.G.t; }
    detach(inc);
    remove(inc);
  };
  function remove(inc) {
    const i = I.active.indexOf(inc);
    if (i >= 0) I.active.splice(i, 1);
    const G = LC.G;
    if (G && G.history) G.history.push({ type: inc.type, state: inc.state, how: inc.how, title: inc.title, noticed: inc.noticed, regular: inc.n ? inc.n.regular : (inc.data.opener && inc.data.opener.regular) || null, t: G.clock, esc: inc.esc });
  }
  I.escalate = (inc, lvl) => {
    if (!inc) return;
    inc.esc = Math.max(inc.esc, lvl);
    if (inc.n) inc.n.esc = Math.max(inc.n.esc || 1, lvl);
  };
  I.of = (n) => n && n.incident && n.incident.state === 'active' ? n.incident : null;
  I.count = (pred) => I.active.filter(pred || (() => true)).length;
  // how much trouble is currently in play; old unresolved problems fade into the background
  I.load = () => {
    let s = 0;
    const t = LC.G.t;
    for (const inc of I.active) s += (inc.def.sev || 1) * (inc.def.weightLoad || 1) * (t - inc.t0 > 120 ? 0.6 : 1);
    return s;
  };

  /* ================= noticing ================= */
  I.notice = (inc, how) => {
    if (!inc || inc.state !== 'active') return;
    if (inc.noticed) return;
    if (how === 'radio' || how === 'told') {
      if (inc.reported) return;
      inc.reported = true;
      O.add(inc, 'radio');
      return;
    }
    inc.noticed = true;
    inc.noticedHow = how;
    LC.stat('incidentsNoticed');
    if (inc.def.onNotice) inc.def.onNotice(inc, how);
    const wasReported = inc.reported;
    const e = O.list.find((q) => q.inc === inc);
    if (e) { e.reported = false; }
    if (!e) O.add(inc, how);
    else O.flash(inc.title, 'Found it.');
    if (how === 'sight' && !wasReported) LC.Player.mutter(L().mutterNotice, 0.55);
    if (how === 'cctv') LC.Player.mutter(inc.def.cctvLine ? [inc.def.cctvLine] : ['...where are you going with that?', 'Oh, for— camera ' + (LC.CCTV.current() || '4') + '.', 'I can see you.'], 1);
    if (inc.n) inc.n.noticed = LC.G.t;
  };
  I.cctvSee = (inc) => I.notice(inc, 'cctv');
  function updateNotice(inc, dt) {
    const G = LC.G, p = G.player;
    if (inc.noticed || !p) return;
    const def = inc.def;
    if (def.stareOnly) return;
    const r = def.noticeR || 430;
    const d = U.dist(p.x, p.y, inc.x, inc.y);
    if (d > r) { inc.seeT = Math.max(0, inc.seeT - dt); return; }
    // on screen?
    const s = LC.R.toScreen(inc.x, inc.y, 20);
    if (s.x < -20 || s.x > LC.R.cw + 20 || s.y < -20 || s.y > LC.R.ch + 40) { inc.seeT = Math.max(0, inc.seeT - dt); return; }
    const z = inc.n ? inc.n.z || 0 : 0;
    if (!M.sight(p.x, p.y - 20, inc.x, inc.y - 20 - Math.min(z, 40)) && !(z > 40 && d < 700)) { inc.seeT = Math.max(0, inc.seeT - dt); return; }
    // dark corners need the torch or a close look
    if (def.dark || (inc.n && inc.n.hiding)) {
      const lit = p.flash && Math.abs(U.angDiff(p.face, Math.atan2(inc.y - p.y, inc.x - p.x))) < 0.45 && d < 330;
      if (!lit && d > 90) return;
    }
    inc.seeT += dt;
    if (inc.seeT >= (def.noticeT || 0.45)) I.notice(inc, 'sight');
  }

  /* ================= stare-downs ================= */
  // returns true when the stare was about an incident
  I.onStare = (n, t, dt) => {
    const inc = I.of(n);
    if (!inc) return false;
    const def = inc.def, st = def.stare;
    const p = LC.G.player;
    if (def.stareOnly && !inc.noticed && t > (def.noticeT || 1) && U.dist(p.x, p.y, n.x, n.y) < (def.noticeR || 240)) I.notice(inc, 'sight');
    if (!st) return false;
    if (U.dist(p.x, p.y, n.x, n.y) > (st.r || 300)) return false;
    if (st.when && !st.when(inc, n)) return false;
    const ss = inc.stareState || (inc.stareState = { stage: 0 });
    if (t >= (st.t1 || 0.7) && ss.stage === 0) {
      ss.stage = 1;
      n.frozen = true; N.stop(n);
      n.exprLock = true; n.expr = 'blank';
      N.faceTo(n, p.x, p.y);
      N.emote(n, '...', 2.5);
      if (!inc.noticed) I.notice(inc, 'sight');
      if (st.l1) N.say(n, U.pick(st.l1), { pri: 3 });
      LC.stat('stareDowns');
    }
    if (t >= (st.t2 || 1.8) && ss.stage === 1) {
      ss.stage = 2;
      n.expr = 'embarrassed';
      if (st.look) n.face = st.look(inc, n);
      if (st.l2) N.say(n, U.pick(st.l2), { pri: 3, dur: 2.6 });
    }
    if (t >= (st.t3 || 3.2) && ss.stage === 2) {
      ss.stage = 3;
      n.frozen = false; n.exprLock = false;
      if (st.backDown) st.backDown(inc, n);
      I.resolve(inc, 'stare');
      LC.stat('staresWon');
    }
    return true;
  };
  // the stare broke before they gave in
  function updateStareBreak(inc) {
    const ss = inc.stareState;
    if (!ss || ss.stage === 0 || ss.stage === 3) return;
    const n = inc.n;
    if (n && !(n.stared > 0)) {
      n.frozen = false; n.exprLock = false;
      if (inc.def.stare.resume) N.say(n, U.pick(inc.def.stare.resume), { pri: 2 });
      inc.stareState = { stage: 0 };
    }
  }

  /* ================= talking ================= */
  I.talk = (ctx, inc) => {
    const def = inc.def;
    if (!def.talk) return false;
    const spec = def.talk(inc, ctx);
    if (!spec) return false;
    ctx.open = U.pick(spec.open);
    ctx.opts = spec.opts.map((o) => ({
      text: o.text, tag: o.tag, say: o.say,
      fn: o.fn ? () => o.fn(inc, ctx) : () => {
        const n = inc.n;
        if (inc.state !== 'active') return;
        if (o.tag === 'OUT') { if (o.pre) o.pre(inc); LC.Dialogue.eject(n, o.line ? U.pick(o.line) : null); I.escalate(inc, 3); return; }
        const ok = LC.Dialogue.attempt(n, o.tag, o.bonus || 0);
        LC.Dialogue.respond(n, o.tag, ok, o);
        if (ok) {
          if (def.comply) def.comply(inc, o.tag);
          else I.resolve(inc, o.tag === 'SNARK' ? 'snark' : o.tag === 'WARN' ? 'warn' : 'talk');
        } else {
          I.escalate(inc, 2);
          if (def.defy) def.defy(inc, o.tag);
        }
      },
    }));
    return true;
  };

  /* ================= hooks from the rest of the game ================= */
  I.messCleaned = (m) => { for (const inc of I.active.slice()) if (inc.data.mess === m) I.resolve(inc, 'mop'); };
  I.signPlaced = (x, y) => { for (const inc of I.active) if (inc.data.mess && U.dist(x, y, inc.data.mess.x, inc.data.mess.y) < 80) inc.data.signed = true; };
  I.propTaken = (pr, from) => { for (const inc of I.active.slice()) if (inc.def.onPropTaken) inc.def.onPropTaken(inc, pr, from); };
  I.propDropped = (pr) => { for (const inc of I.active.slice()) if (inc.def.onPropDropped) inc.def.onPropDropped(inc, pr); };
  I.propReturned = (pr) => {
    LC.stat('propsReturned');
    for (const inc of I.active.slice()) if (inc.def.onPropReturned) inc.def.onPropReturned(inc, pr);
  };
  I.itemFound = (it) => { for (const inc of I.active) if (inc.data.item === it && !inc.noticed) I.notice(inc, 'sight'); };
  I.itemHandedIn = (it) => { for (const inc of I.active.slice()) if (inc.data.item === it) I.resolve(inc, 'lostfound', 'Handed in to lost property. They can find it themselves.'); };
  I.watered = (n) => { const inc = I.of(n); if (inc && inc.def.onWater) inc.def.onWater(inc); };
  I.aided = (n) => { for (const inc of I.active.slice()) if (inc.type === 'injured' && inc.n === n) I.resolve(inc, 'aid'); };
  I.separated = (f, n) => { if (f.inc) f.inc.data.separatedBy = true; };
  I.emergencyToggled = (open) => { for (const inc of I.active.slice()) if (inc.def.onEmergency) inc.def.onEmergency(inc, open); };
  I.argumentEnded = (arg, how) => {
    const inc = arg.inc;
    if (!inc || inc.state !== 'active') return;
    if (how === 'fight') I.fail(inc, 'fight', 'It became a fight. They always do.');
    else if (how === 'calmed' || arg.separated) { LC.stat('fightsPrevented'); I.resolve(inc, 'talk', U.pick(['Nobody hit anybody. Write that down.', 'Crisis averted. Drinks were still spilled.', 'Everyone went back to their drinks, grumbling.'])); }
    else I.resolve(inc, 'self', 'They got bored and went back to dancing.');
  };
  I.fightEnded = (f, how) => {
    const inc = f.inc;
    if (!inc || inc.state !== 'active') return;
    if (how === 'separated' || f.separated || inc.data.separatedBy) { LC.stat('fightsStopped'); I.resolve(inc, 'separate', U.pick(['Fight over. Nobody won. Especially the furniture.', 'Separated. Glaring continues at a safe distance.', 'Broken up. Like the chair.'])); }
    else { LC.stat('fightsNotPrevented'); I.fail(inc, 'burnout', U.pick(['They stopped on their own. Out of breath, mostly.', 'It ended when everyone got tired. Just like a real sport.'])); }
  };
  I.openStall = (stall) => {
    const inc = I.active.find((q) => q.data.stall === stall);
    const d = M.door(stall.door);
    if (inc && inc.def.onOpenStall) { inc.def.onOpenStall(inc); return; }
    d.target = 1;
    const who = stall.occ[0];
    if (who) {
      N.say(who, U.pick(['OCCUPIED!', "DO YOU MIND?!", "I'm IN here!", '...hi.']), { pri: 3, kind: 'shout' });
      LC.stat('stallsOpenedOnInnocentPeople');
      LC.Player.say(U.pick(['Sorry. Sorry.', 'Wrong one.', 'Carry on.']));
      setTimeout(() => { if (stall.occ.length) d.target = 0; }, 900);
    }
  };
  I.follow = (n, dest) => {
    // walk them somewhere safe; you lead, they follow
    N.cancelTask(n);
    N.interrupt(n, oFollowPlayer(n, dest), 'follow', 6);
  };
  function* oFollowPlayer(n, dest) {
    const G = LC.G, p = G.player;
    n.followingPlayer = true;
    n.perm = n.perm | P.OUT;
    try {
      let t = 0;
      while (t < 90 && !n.gone) {
        t += G.dt;
        const d = U.dist(n.x, n.y, p.x, p.y);
        if (d > 34) { const a = Math.atan2(p.y - n.y, p.x - n.x); n.body.vx += Math.cos(a) * 95 * G.dt * 7; n.body.vy += Math.sin(a) * 95 * G.dt * 7; }
        if (d > 420) { N.say(n, 'Wait for meeee', { pri: 1 }); if (d > 700) break; }
        if (dest === 'taxi' && U.dist(n.x, n.y, S.taxi.x, S.taxi.y) < 90) {
          N.say(n, U.pick(['Thank you. You are a good door.', 'I love you. Goodnight.', 'Is this my taxi? This is my taxi now.']), { pri: 3 });
          LC.stat('peopleRescued');
          LC.stat('taxisCalled');
          O.toast('SENT HOME.', U.pick(['In a taxi. With a bag, just in case.', 'Rescued from themselves. For tonight.', 'The driver has been warned.']));
          const inc = I.of(n);
          if (inc) I.resolve(inc, 'taxi', 'Sent home in a taxi. Rescued.');
          n.followingPlayer = false;
          N.setTask(n, N.tLeave(n, { noCoat: true, exit: S.exits[2] }), 'leave');
          return;
        }
        if (n.lostFriendOf && U.dist(n.x, n.y, n.lostFriendOf.x, n.lostFriendOf.y) < 80) { I.reunite(n.lostFriendOf, n); return; }
        yield;
      }
    } finally { n.followingPlayer = false; }
  }
  I.returnItem = (n, it) => {
    const p = LC.G.player;
    p.pocket.splice(p.pocket.indexOf(it), 1);
    N.say(n, U.pick(L().lostThanks), { pri: 3 });
    N.emote(n, 'heart', 2);
    if (it.kind === 'shoe') n.lostShoe = false;
    LC.stat('peopleRescued');
    LC.stat('itemsReturned');
    const inc = n.lost && n.lost.inc;
    n.lost = null;
    if (inc) I.resolve(inc, 'returned');
    if (n.regular && LC.Regulars) LC.Regulars.itemReturned(n, it);
  };
  I.reunite = (seeker, friend) => {
    seeker.lost = null; friend.lostFriendOf = null;
    N.say(seeker, U.pick(['DAVE!', 'THERE you are!', 'WHERE WERE YOU?']), { pri: 3, kind: 'shout' });
    setTimeout(() => { if (!friend.gone) N.say(friend, U.pick(['I was in the kitchen.', 'I made a friend. It was a coat.', "I don't want to talk about it."]), { pri: 3 }); }, 1400);
    LC.stat('peopleRescued', 2);
    N.endOverride(friend);
    for (const inc of I.active.slice()) if (inc.type === 'lostFriend' && (inc.n === seeker || inc.data.friend === friend)) I.resolve(inc, 'reunited');
  };

  /* ================= door duty helpers ================= */
  const FAKE_NAMES = ['Definitely A. Adult', 'Tom Cruise', 'Mr. Twenty-Five', 'McLovin', 'Jeff Bezos', 'Name Namerson', 'Your Mum'];
  I.makeId = (n) => {
    const fake = !!n.flags.fakeId;
    const age = fake ? U.pick([16, 17, 17, 34, 52]) : U.randi(19, 41);
    const year = 2026 - age;
    return {
      name: fake && Math.random() < 0.45 ? U.pick(FAKE_NAMES) : n.name + ' ' + U.pick(['Smith', 'Okafor', 'Novak', 'Patel', 'Kowalski', 'Reyes', 'Murphy', 'Chen', 'Haddad', 'Ferreira']),
      dob: U.randi(1, 28) + '/' + U.randi(1, 12) + '/' + (fake && age >= 30 ? year : fake ? 2026 - U.pick([21, 22, 25]) : year),
      age: fake && Math.random() < 0.5 ? age : undefined,
      realAge: age,
      hairC: fake && Math.random() < 0.6 ? U.pick(['#e64f93', '#4a78e6', '#ecdcae', '#17110d']) : n.look.hairC,
      skin: n.look.skin,
      hair: n.look.hair,
      fake,
      tell: fake ? U.pick(['The hologram is a sticker of a dolphin.', 'Laminated with sellotape.', 'Height: 7ft 2.', 'Issued by "The Government".', 'The photo is wearing the same outfit.', 'Expires: never.']) : null,
    };
  };
  I.wand = (n) => {
    const found = n.flags.contraband;
    LC.sfx(found ? 'detector' : 'beep', n.x, n.y);
    if (found) {
      LC.stat('contrabandFound');
      LC.stat('randomObjects');
      N.say(n, U.pick(["It's not mine.", "That's... for a friend.", "It's a medical cone.", 'Everyone brings one!']), { pri: 3 });
      LC.Player.say('...' + found + '?');
      n.flags.contraband = null;
      O.toast('CONFISCATED: ' + found.toUpperCase(), U.pick(['It goes in the pile.', 'Nobody knows how it fit in the jacket.', 'Coat check will be thrilled.']));
      if (found === 'traffic cone') n.flags.hadCone = false;
    } else N.say(n, U.pick(['See? Clean.', 'Just keys and dreams.', 'That tickles.']), { pri: 3 });
  };

  /* ================= update ================= */
  I.update = (dt) => {
    const G = LC.G;
    for (const inc of I.active.slice()) {
      if (inc.state !== 'active') continue;
      if (inc.n) {
        if (inc.n.gone) {
          if (inc.def.onGone) inc.def.onGone(inc);
          else I.drop(inc);
          continue;
        }
        inc.x = inc.n.x; inc.y = inc.n.y;
      } else if (inc.data.pos) { inc.x = inc.data.pos.x; inc.y = inc.data.pos.y; }
      updateNotice(inc, dt);
      updateStareBreak(inc);
      if (inc.def.update) inc.def.update(inc, dt);
      if (inc.state === 'active' && inc.def.timeout && G.t - inc.t0 > inc.def.timeout) {
        if (inc.def.onTimeout) inc.def.onTimeout(inc); else I.fail(inc, 'timeout');
      }
    }
    O.update(dt);
  };

  // helper for scripts
  I.alive = (inc, n) => inc.state === 'active' && !n.gone && !n.complied;
})();
