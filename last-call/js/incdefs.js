/* Last Call — the incidents. Each one: who would do this, what they do if nobody stops them,
   what they say when you ask, whether a long stare is enough, and how it ends. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd, Phys: Ph } = LC;
  const T = M.T, S = M.S, P = M.P;
  const I = LC.Incidents, D = I.defs;
  const G = () => LC.G;
  const SNEAK = P.PUB | P.OUT | P.STAFF | P.VIP;
  const drunk = (n) => 1 - n.sob;
  const free = (n) => n.kind === 'guest' && n.state === 'inside' && !n.override && !n.seat && !n.incident && !n.escorted && !n.asleep && !n.carry && !n.restrained && !n.flags.leftWithFriend;
  const inRooms = (n, ...rs) => { const r = M.roomAt(n.x, n.y); return !!r && rs.includes(r.id); };
  const nearest = (list, n) => list.reduce((b, s) => (!b || U.dist2(n.x, n.y, s.x, s.y) < U.dist2(n.x, n.y, b.x, b.y) ? s : b), null);

  /* ---------------- shared moves ---------------- */
  function* climbUp(n, z, dur, act = 'climb') {
    n.body.ghost = true; n.body.pinned = true; n.act = act; n.body.vx = 0; n.body.vy = 0;
    const z0 = n.z || 0;
    let t = 0;
    while (t < dur) { t += G().dt; n.z = z0 + (z - z0) * Math.min(1, t / dur); yield; }
    n.z = z;
  }
  function* oClimbDown(n, dur = 1.1) {
    const z0 = n.z || 0;
    n.act = 'climb';
    let t = 0;
    while (t < dur) { t += G().dt; n.z = z0 * (1 - Math.min(1, t / dur)); yield; }
    n.z = 0; n.body.ghost = false; n.body.pinned = false; n.act = null;
    const f = M.nearest(n.body.x, n.body.y + 14, P.ALL, 3);
    if (f && U.dist(f.x, f.y, n.body.x, n.body.y) > 10) { n.body.x = U.lerp(n.body.x, f.x, 0.8); n.body.y = U.lerp(n.body.y, f.y, 0.8); }
  }
  I.oClimbDown = oClimbDown;
  function climbDownLater(n) { if (!n.gone && n.z > 0) N.interrupt(n, oClimbDown(n, 1.1), 'climbdown', 9); }
  function* fall(n, inc, o = {}) {
    inc.data.fell = true;
    N.shout(n, U.pick(o.lines || ['uh oh', 'OH NO', 'CATCH MEEE']));
    const z0 = n.z || 0;
    let t = 0;
    while (t < 0.42) { t += G().dt; n.z = z0 * (1 - Math.pow(Math.min(1, t / 0.42), 2)); yield; }
    n.z = 0; n.body.ghost = false; n.body.pinned = false;
    if (o.land) { n.body.x = o.land.x; n.body.y = o.land.y; }
    LC.sfx('crash', n.x, n.y);
    LC.R.cam.shake = Math.max(LC.R.cam.shake, 5);
    for (const b of Ph.query(n.body.x, n.body.y, 38, (b) => b.kind === 'char' && b.ent !== n && b.ent.kind === 'guest')) N.knockDown(b.ent, Math.atan2(b.y - n.body.y, b.x - n.body.x), 1.2);
    for (let i = 0; i < 10; i++) Wd.part('dust', n.body.x + U.rand(-14, 14), n.body.y, { vx: U.rand(-40, 40), vy: U.rand(-20, 20) });
    if (LC.Social) LC.Social.noise(n.x, n.y, 'crash', 1.4);
    n.injured = 1; n.needsAid = true;
    LC.stat('injuries');
    I.fail(inc, 'fell');
    N.interrupt(n, N.oFallen(n, U.rand(0, 6), 2.4, false), 'fallen', 9);
    I.emergent('injured', n, {});
  }
  function* sitOnSpot(n, spot, z) {
    n.body.ghost = true; n.body.pinned = true;
    n.body.x = spot.x; n.body.y = spot.y;
    yield* climbUp(n, z, 0.6);
    n.act = 'sit'; n.face = Math.PI / 2;
  }
  function crowdCheer(x, y, r, lines, max = 3) {
    let k = 0;
    for (const b of Ph.query(x, y, r, (b) => b.kind === 'char' && b.ent.kind === 'guest')) {
      const o = b.ent;
      if (o.override || o.incident || o.seat || Math.random() < 0.4) continue;
      N.faceTo(o, x, y);
      N.shout(o, U.pick(lines), { dim: true });
      if (++k >= max) break;
    }
  }
  function* whistleWalk(n, x, y, o = {}) {
    const ok = yield* N.go(n, x, y, Object.assign({ speed: n.speed * 0.85 }, o));
    return ok;
  }
  function whistle(n) { if (Math.random() < G().dt * 0.4) N.emote(n, 'music', 1.2); }
  // hang around doing something until done, cut short if the incident ends
  function* hold(n, inc, secs, each) {
    let t = 0;
    while (t < secs) {
      if (!I.alive(inc, n)) return false;
      t += G().dt;
      if (each && each(t) === false) return false;
      yield;
    }
    return true;
  }
  function leaveBooth(n) {
    const p = M.randomPoint('dance', P.GUEST);
    if (p) N.setTask(n, (function* () { yield* N.go(n, p.x, p.y, { perm: SNEAK }); })(), 'wander');
  }

  /* ================= REMOVE THE HUMAN CHANDELIER ================= */
  const CHANDELIER_LINES = ['I CAN SEE MY HOUSE', 'WOOOOO', 'I AM THE LIGHTS NOW', 'LOOK AT ME, MUM', 'THIS IS THE BEST DAY OF MY LIFE', "DON'T TELL THE FLAMINGO"];
  D.chandelier = {
    title: 'REMOVE THE HUMAN CHANDELIER', sub: 'Someone has climbed the lighting rig.', brief: 'hanging from the lighting rig',
    sev: 3, min: 150, weight: 0.8, cooldown: 280, noticeR: 780, noticeT: 0.25, loud: true, radio: 'dance',
    cand: (n) => (free(n) && inRooms(n, 'dance') && drunk(n) > 0.4 && N.cs(n) < 0.45 && n.tr.energy > 0.4 ? 1 + drunk(n) : 0),
    *script(n, inc) {
      const pil = nearest(S.trussClimb, n);
      if (!(yield* N.go(n, pil.x, pil.y, { arrive: 10 }))) return;
      N.shout(n, U.pick(['WATCH THIS!', 'Hold my drink!', 'I have an idea!']));
      n.drink = null;
      yield* climbUp(n, 74, 2.6);
      n.act = 'hang';
      G().music.hanging = true;
      LC.sfx('clank', n.x, n.y);
      const tr = M.truss;
      const y = Math.abs(n.y - tr.y0) < Math.abs(n.y - tr.y1) ? tr.y0 : tr.y1;
      const dir = n.x < (tr.x0 + tr.x1) / 2 ? 1 : -1;
      let lineT = 1.5;
      const ok = yield* hold(n, inc, U.rand(50, 85), (t) => {
        n.body.x = U.clamp(n.body.x + dir * 13 * G().dt * (Math.sin(t * 1.3) > -0.3 ? 1 : 0), tr.x0 + 16, tr.x1 - 16);
        n.body.y = y; n.z = 74 + Math.sin(t * 3) * 3;
        lineT -= G().dt;
        if (lineT < 0) { lineT = U.rand(3, 5); N.shout(n, U.pick(CHANDELIER_LINES)); crowdCheer(n.x, n.y + 20, 180, ['WOOOO', 'SEND IT', 'LEGEND', 'GET DOWN! NO, STAY UP!']); }
      });
      if (!ok) return;
      yield* fall(n, inc, { land: { x: n.body.x, y: n.body.y + 10 } });
    },
    cleanup(n, inc) { G().music.hanging = false; if (!inc.data.fell) climbDownLater(n); },
    talk: () => ({
      open: ['I CAN SEE MY HOUSE FROM HERE', 'I AM ONE WITH THE LIGHTS', "Don't look at me! Look at the LIGHTS!", 'Is this VIP?'],
      opts: [
        { text: 'Come down. Slowly.', tag: 'CALM', yes: ['Okay. Okay. Slowly. SLOWLY.', 'Fine. The view was overrated.'] },
        { text: 'Down. Now.', tag: 'WARN', yes: ['Coming down! Coming down!', 'Okay! OKAY!'] },
        { text: 'How did you even get up there?', tag: 'SNARK', yes: ["...I don't know. Help.", 'Honestly? Ambition.'], no: ['TALENT.', 'Believing in myself!'] },
        { text: 'Come down so I can throw you out.', tag: 'OUT', fn: (inc) => { N.say(inc.n, U.pick(['Why would I come down for THAT?', 'That is a terrible offer.']), { pri: 3 }); I.escalate(inc, 2); } },
      ],
    }),
    stare: { r: 380, t1: 1.0, t2: 2.2, t3: 3.8, l1: ['...', 'Is security looking at me?'], l2: ["...I should come down, shouldn't I."], resume: ['...nah. WOOOO!'] },
    resolved: { talk: ['The chandelier has been returned to floor level.'], warn: ['Back on the ground, where people go.'], snark: ['Came down out of sheer embarrassment.'], stare: ['Climbed down in total silence.'], eject: ['Lights: 1. Chandelier: 0.'] },
    failed: ['The chandelier came down. So did everyone under it.'],
  };

  /* ================= THAT IS NOT A CHAIR ================= */
  D.speaker = {
    title: 'THAT IS NOT A CHAIR', sub: 'Someone is sitting on a speaker.', brief: 'sitting on a speaker',
    sev: 2, min: 60, weight: 1, cooldown: 160, noticeR: 500, radio: 'dance',
    cand: (n) => (free(n) && inRooms(n, 'dance', 'hall') && (drunk(n) > 0.25) && (N.cs(n) < 0.5 || n.tr.ego > 0.6) ? 0.6 + n.needs.rest : 0),
    setup(inc) { inc.data.spot = U.pick(S.weird.filter((w) => w.kind === 'speaker' && !w.taken)); if (!inc.data.spot) return false; inc.data.spot.taken = true; },
    *script(n, inc) {
      const s = inc.data.spot;
      if (!(yield* N.go(n, s.x, s.y + 22, { arrive: 12 }))) return;
      yield* sitOnSpot(n, s, s.z);
      N.say(n, U.pick(["Ooh. It's warm.", 'Best seat in the house.', 'It VIBRATES.']), { pri: 1 });
      const f = s.furn;
      const ok = yield* hold(n, inc, U.rand(45, 70), (t) => { if (Math.random() < G().dt * 0.08) N.say(n, U.pick(['I can feel the bass in my SOUL', 'Is this VIP?', 'Heyyy']), { dim: true }); });
      if (!ok) return;
      f.distort = true;
      LC.sfx('crackle', s.x, s.y);
      const ok2 = yield* hold(n, inc, U.rand(20, 35), () => { if (Math.random() < G().dt * 2) Wd.part('spark', s.x + U.rand(-10, 10), s.y, { z: 20, vx: U.rand(-40, 40), vy: U.rand(-40, 40), vz: 90 }); });
      if (!ok2) return;
      // the speaker gives up
      f.distort = false; f.blown = true;
      for (let i = 0; i < 14; i++) Wd.part('spark', s.x, s.y, { z: 20, vx: U.rand(-90, 90), vy: U.rand(-90, 90), vz: 160 });
      LC.sfx('smash', s.x, s.y);
      LC.stat('clubDamage', 600);
      LC.stat('brokenFurniture');
      N.shout(n, U.pick(['...was that me?', 'It was like that when I got here.']));
      I.fail(inc, 'broken');
    },
    cleanup(n, inc) { inc.data.spot.taken = false; if (inc.data.spot.furn) inc.data.spot.furn.distort = false; climbDownLater(n); },
    talk: () => ({
      open: ["It's warm. It vibrates. It's perfect.", 'Best seat in the house.', 'Is this VIP?', 'Found a chair!'],
      opts: [
        { text: "That's a speaker.", tag: 'WARN', yes: ['...oh. OH. Right.', 'Is it? Okay. Getting off.'] },
        { text: 'Is it comfortable?', tag: 'SNARK', yes: ['...not any more.', 'It was. Now I feel weird.'], no: ['Yes. Very. Thanks for asking.'] },
        { text: 'There are chairs. Everywhere. Look.', tag: 'CALM', yes: ['Oh my god there ARE chairs.'] },
        { text: 'Off. And out.', tag: 'OUT' },
      ],
    }),
    stare: { t1: 0.9, t2: 2, t3: 3.2, l1: ['...'], l2: ['...is this not a chair?'], resume: ["It's a chair now."] },
    resolved: { any: ['The speaker is a speaker again.', 'Sound quality restored. Dignity pending.'], stare: ['Slid off the speaker without a word.'], eject: ['Removed from the speaker. And the premises.'] },
    failed: ['The speaker has been sat on to death. £600.'],
  };

  /* ================= WHY IS THERE A TRAFFIC CONE IN HERE? ================= */
  D.cone = {
    title: 'WHY IS THERE A TRAFFIC CONE IN HERE?',
    timeout: 320, sub: 'Find out who brought it inside.', brief: 'wearing a traffic cone',
    sev: 1, min: 20, weight: 0.9, cooldown: 400, noticeR: 460,
    cand: (n) => (free(n) && drunk(n) > 0.3 && N.cs(n) < 0.5 ? 1 : 0),
    setup(inc) {
      const n = inc.n;
      let cone = Wd.props.find((p) => p.kind === 'cone' && !p.worn && !p.carriedBy && !M.inClub(p.body.x, p.body.y));
      if (!cone) cone = Wd.addProp('cone', n.x, n.y);
      Wd.wear(cone, n, 'cone');
      inc.data.cone = cone; inc.data.owner = n; inc.data.holders = [n];
    },
    *script(n, inc) {
      // wear it around for a while, then leave it somewhere strange
      const cone = inc.data.cone;
      yield* N.tWander(n);
      if (!I.alive(inc, n)) return;
      yield* N.tDance(n);
      if (!I.alive(inc, n) || cone.worn !== n) return;
      const spots = [
        { x: M.flamingo.cx, y: M.flamingo.y1 + 6, z0: 0, label: 'next to the flamingo' },
        { x: 46 * T, y: 11.8 * T, z0: 0, label: 'at the DJ booth' },
        { x: U.rand(36, 56) * T, y: U.rand(15, 28) * T, z0: 0, label: 'in the middle of the dance floor' },
        { x: 14.2 * T, y: 22 * T, z0: 0, label: "in the men's" },
      ];
      const s = U.pick(spots);
      if (!(yield* N.go(n, s.x, s.y + 16, { arrive: 16 }))) return;
      Wd.unwear(cone);
      cone.body.x = s.x; cone.body.y = s.y;
      N.say(n, U.pick(['There. Perfect.', 'The cone lives here now.', 'Art.']), { pri: 1 });
      inc.data.pos = { x: s.x, y: s.y };
      inc.n = null;
      n.incident = null;
      inc.data.placed = true;
    },
    update(inc, dt) {
      const cone = inc.data.cone;
      if (!cone || cone.broken) return;
      if (!inc.n) inc.data.pos = { x: cone.body.x, y: cone.body.y };
      // somebody else always picks it up
      if (!cone.worn && !cone.carriedBy && inc.data.placed && Math.random() < dt * 0.04) {
        const b = Ph.query(cone.body.x, cone.body.y, 70, (b) => b.kind === 'char' && b.ent.kind === 'guest' && free(b.ent) && drunk(b.ent) > 0.35)[0];
        if (b) { Wd.wear(cone, b.ent, 'cone'); inc.data.holders.push(b.ent); N.say(b.ent, U.pick(['Ooh. Hat.', 'Is this for me?', 'I am the cone now.']), { pri: 1 }); inc.data.wearer = b.ent; }
      }
      if (cone.worn) inc.data.pos = { x: cone.worn.x, y: cone.worn.y };
      // out of the club, or backstage in custody
      if (!cone.worn && !cone.carriedBy) {
        const r = M.roomAt(cone.body.x, cone.body.y);
        if (!r || (r.outdoor && r.id !== 'patio') || r.id === 'backstage' || r.id === 'office') I.resolve(inc, 'confiscated');
      }
    },
    talk(inc, ctx) {
      const n = ctx.n, cone = inc.data.cone;
      const owner = inc.data.owner, isOwner = n === owner;
      return {
        open: cone.worn === n ? ['What? Oh. The hat.', "It's a hat.", 'I found it. On my head.'] : ['What cone?'],
        opts: [
          { text: 'Where did you get that?', tag: 'ASK', fn: () => {
            if (isOwner) { N.say(n, U.pick(["It's my emotional support cone.", 'The car park gave it to me.', "It's MINE. I've had it since the bus stop."]), { pri: 3 }); inc.data.solved = true; LC.stat('conesTraced'); LC.Objectives.toast('MYSTERY SOLVED.', 'It was an emotional support cone.'); }
            else { const o = owner && !owner.gone ? owner : null; N.say(n, o ? 'It was here when I got here. Ask ' + (o.look.topC === '#141418' ? 'the one in black' : o.name) + '.' : 'It was here when I got here.', { pri: 3 }); if (o) N.emote(o, '!', 3); }
          } },
          { text: 'Hand over the cone.', tag: 'WARN', fn: () => { const ok = LC.Dialogue.attempt(n, 'WARN', 0.3); LC.Dialogue.respond(n, 'WARN', ok, { yes: ['Fine. Take the cone.', 'Be gentle with it.'] }); if (ok && cone.worn === n) { Wd.unwear(cone); LC.Player.pickProp(cone); } } },
          { text: 'That cone belongs to the road.', tag: 'SNARK', fn: () => { const ok = LC.Dialogue.attempt(n, 'SNARK', 0.2); LC.Dialogue.respond(n, 'SNARK', ok, { yes: ['...the road can have it back.'] }); if (ok && cone.worn === n) { Wd.unwear(cone); LC.Player.pickProp(cone); } } },
          { text: 'You and the cone are leaving.', tag: 'OUT', fn: () => LC.Dialogue.eject(n, 'Not without the cone!') },
        ],
      };
    },
    onPropTaken(inc, pr) { if (pr === inc.data.cone && !inc.noticed) I.notice(inc, 'sight'); },
    onPropDropped(inc, pr) { if (pr === inc.data.cone) { inc.data.placed = true; } },
    resolved: { confiscated: (inc) => (inc.data.solved ? 'Cone returned to the wild. Owner identified: emotional support.' : 'The cone has been returned to the wild. Its origins remain a mystery.'), eject: ['The cone left with its person.'], any: ['Cone situation contained.'] },
    failed: ['The cone lives here now.'],
    onGone(inc) { if (inc.data.cone && inc.data.cone.worn) I.resolve(inc, 'confiscated', 'The cone went home on somebody\'s head.'); },
  };

  /* ================= THE PLANT IS NOT FREE ================= */
  D.plant = {
    title: 'THE PLANT IS NOT FREE', sub: 'Stop a guest stealing the decorations.', brief: 'carrying a plant',
    sev: 2, min: 90, weight: 0.9, cooldown: 260, noticeR: 440,
    cand: (n) => (free(n) && N.cs(n) < 0.55 && drunk(n) > 0.25 && inRooms(n, 'lobby', 'hall', 'lounge', 'bar', 'patio', 'dance') ? 1 : 0),
    setup(inc) {
      const n = inc.n;
      const plants = Wd.props.filter((p) => p.kind === 'plant' && !p.carriedBy && !p.broken && M.inClub(p.body.x, p.body.y) && !p.claimed);
      if (!plants.length) return false;
      plants.sort((a, b) => U.dist2(n.x, n.y, a.body.x, a.body.y) - U.dist2(n.x, n.y, b.body.x, b.body.y));
      inc.data.plant = plants[0]; plants[0].claimed = true;
    },
    *script(n, inc) {
      const pl = inc.data.plant;
      if (!(yield* N.go(n, pl.body.x, pl.body.y + 16, { arrive: 16 }))) return;
      if (pl.carriedBy) return;
      N.pickUp(n, pl);
      n.act = 'carryUp';
      N.say(n, U.pick(["You're coming with me.", 'Shh. Shh. Quiet, plant.', 'New home, buddy.']), { dim: true });
      n.perm = n.perm | P.OUT;
      const exit = S.exits[2];
      N.goTo(n, exit.x, exit.y, { perm: n.perm, speed: n.speed * 0.8, arrive: 24, timeout: 120 });
      for (;;) {
        if (!I.alive(inc, n)) return;
        if (n.carry !== pl) return;
        whistle(n);
        if (n.nav.status === 'failed' || n.nav.status === 'idle') N.goTo(n, exit.x, exit.y, { perm: n.perm, speed: n.speed * 0.8, arrive: 24 });
        if (n.nav.status === 'arrived' || M.inRoom(n.x, n.y, 'parking')) break;
        yield;
      }
      // gone
      Wd.removeProp(pl); n.carry = null;
      LC.stat('stolenLost');
      LC.stat('clubDamage', 150);
      I.fail(inc, 'stolen');
      N.setTask(n, N.tLeave(n, { noCoat: true, exit: S.exits[1] }), 'leave');
    },
    cleanup(n, inc) { const pl = inc.data.plant; if (pl) pl.claimed = false; },
    onPropTaken(inc, pr, from) { if (pr === inc.data.plant && inc.state === 'active') { I.notice(inc, 'sight'); LC.stat('stolenRecovered'); I.resolve(inc, 'grab'); } },
    onGone(inc) { I.drop(inc); },
    talk: () => ({
      open: ['What plant?', "I'm just moving it. For the plant.", 'It wanted to come with me.', "It's a gift. From me. To me."],
      opts: [
        { text: "The one you're holding.", tag: 'SNARK', yes: ['...this plant?', 'Oh. THIS plant.'] },
        { text: 'Put. It. Back.', tag: 'WARN', yes: ['Okay, okay. Sorry, plant.', "Fine. It's heavy anyway."] },
        { text: "The plant stays here, where it's happy.", tag: 'CALM', yes: ['...it does look happy here.'] },
        { text: 'You and the plant are leaving. Only one of you is coming back.', tag: 'OUT' },
      ],
    }),
    comply(inc) { const n = inc.n; if (n.carry) N.drop(n); LC.stat('stolenRecovered'); I.resolve(inc, 'talk'); },
    stare: { t1: 0.7, t2: 1.8, t3: 3.3, l1: ['...'], l2: ['...it was leaning.', "...I'm watering it."], resume: ['*walks faster*'], backDown: (inc, n) => { if (n.carry) N.drop(n); LC.stat('stolenRecovered'); } },
    resolved: { any: ['The plant stays. It seems relieved.', 'Plant recovered. It will need therapy.'], grab: ['You took the plant back. It did not resist.'], stare: ['Put the plant down and walked away very slowly.'], eject: ['The plant stayed. The thief did not.'] },
    failed: ['The plant has left the building. Management will ask about the plant.'],
  };

  /* ================= THIS IS A BATHROOM, NOT AIRBNB ================= */
  const STALL_GIGGLES = ['SHHHH', 'hehehe', 'who touched my—', 'is that your elbow', "we should've got a bigger one", "it's so cosy", 'somebody is standing on my foot', 'NOBODY BREATHE', 'wait who invited HIM'];
  const STALL_EXITS = ["It's bigger on the inside.", 'We were just talking.', "I'm not with them.", 'Is this the queue?', 'Great stall. Five stars.', 'I came in here for the wifi.', 'Nice to meet you all.', 'We were doing a quiz.'];
  D.airbnb = {
    title: 'THIS IS A BATHROOM, NOT AIRBNB', sub: 'Several people. One stall. Twenty minutes.', brief: 'in a stall with everyone',
    sev: 2, min: 150, weight: 0.8, cooldown: 360, noticeR: 260, radio: 'mens',
    cand: (n) => (free(n) && drunk(n) > 0.35 ? 1 + (n.group && n.group.members.length > 3 ? 1 : 0) : 0),
    setup(inc) {
      const n = inc.n;
      const room = n.fem ? 'womens' : 'mens';
      const stall = S.stalls.find((s) => s.room === room && s.occ.length === 0);
      if (!stall) return false;
      inc.data.stall = stall; inc.data.room = room;
      const crew = [n];
      const pool = (n.group ? n.group.members : []).concat(LC.G.npcs.filter((o) => o.kind === 'guest' && drunk(o) > 0.35));
      for (const o of pool) { if (crew.length >= U.randi(4, 6)) break; if (!crew.includes(o) && free(o)) crew.push(o); }
      if (crew.length < 3) return false;
      inc.data.crew = crew;
      for (const o of crew) if (o !== n) { o.incident = inc; inc.others.push(o); N.setTask(o, joinStall(o, inc), 'inc:airbnb', 3); }
      stall.occ.push(...crew);
    },
    *script(n, inc) { yield* joinStall(n, inc); },
    update(inc, dt) {
      const d = inc.data;
      if (!d.stall) return;
      const door = M.door(d.stall.door);
      const inside = d.crew.filter((o) => o.inStall);
      door.occupants = inside.length;
      if (inside.length >= Math.min(3, d.crew.length) && !d.closed) { d.closed = true; d.closedT = G().t; door.target = 0; door.shake = 1.4; }
      if (d.closed && !d.opened) {
        inc.data.pos = { x: d.stall.front.x, y: d.stall.front.y };
        if (Math.random() < dt * 0.5) { const o = U.pick(inside); if (o) N.say(o, U.pick(STALL_GIGGLES), { dim: true }); }
        if (G().t - d.closedT > 26 && !inc.noticed && !d.radioed) { d.radioed = true; LC.Radio.report(inc, 'mens' === d.room ? 'mens' : 'womens'); }
        if (Math.random() < dt * 0.02) LC.stat('customerComplaints');
        if (G().t - d.closedT > 120) { d.stall.broken = true; LC.stat('clubDamage', 200); fileOut(inc, false); I.fail(inc, 'timeout'); }
      }
    },
    onOpenStall(inc) {
      const d = inc.data;
      if (d.opened) return;
      d.opened = true;
      const door = M.door(d.stall.door);
      door.target = 1; door.shake = 0;
      I.notice(inc, 'sight');
      for (const o of d.crew) { o.hidden = false; o.exprLock = true; o.expr = 'shock'; N.emote(o, '!', 1.5); }
      LC.sfx('stallOpen', d.stall.x, d.stall.y);
      const spk = d.crew[d.crew.length - 1];
      setTimeout(() => { N.say(spk, '...occupied?', { pri: 3, dur: 2.4 }); }, 900);
      setTimeout(() => { if (inc.state === 'active') LC.Dialogue.open(inc.n.gone ? spk : inc.n); }, 2400);
    },
    talk(inc, ctx) {
      if (!inc.data.opened) return { open: ['OCCUPIED!', "We're BUSY!"], opts: [{ text: 'Open up.', tag: 'WARN', fn: () => I.openStall(inc.data.stall) }] };
      const out = (tag) => () => { fileOut(inc, tag === 'OUT'); I.resolve(inc, tag === 'OUT' ? 'eject' : 'talk'); };
      return {
        open: ['...occupied?', "It's not what it looks like.", 'We can explain.'],
        opts: [
          { text: 'Out.', tag: 'WARN', fn: out('WARN') },
          { text: 'All of you.', tag: 'OUT', fn: out('OUT') },
          { text: 'How are there six of you?', tag: 'SNARK', fn: () => { N.say(ctx.n, U.pick(['Teamwork.', 'We breathed in.', 'Believe in yourself and anything is possible.']), { pri: 3 }); setTimeout(out('SNARK'), 1800); } },
          { text: "I'm not even going to ask.", tag: 'CALM', fn: out('CALM') },
        ],
      };
    },
    cleanup(n, inc) { n.hidden = false; n.inStall = false; n.exprLock = false; n.body.ghost = false; n.body.pinned = false; },
    resolved: { any: ['Bathroom reclaimed. The stall needs a moment.'], eject: (inc) => 'EJECTED: ' + inc.data.crew.length + '. They left in single file.' },
    failed: ['They left on their own terms. The stall door did not survive.'],
    onGone(inc) { if (inc.data.crew.every((o) => o.gone)) I.drop(inc); else { inc.n = inc.data.crew.find((o) => !o.gone); } },
  };
  function* joinStall(n, inc) {
    const d = inc.data, stall = d.stall;
    try {
      if (!(yield* N.go(n, stall.front.x + U.rand(-6, 6), stall.front.y + U.rand(-4, 8), { arrive: 12, avoidDance: true }))) return;
      // in you go
      M.door(stall.door).target = 1;
      n.body.ghost = true; n.body.pinned = true;
      n.body.x = stall.x + U.rand(-14, 14); n.body.y = stall.y + U.rand(-10, 10);
      n.inStall = true; n.hidden = true;
      N.say(n, U.pick(['Budge up!', 'Room for one more!', 'Coming in!']), { dim: true });
      while (inc.state === 'active' && !d.opened) yield;
      while (!n.released && inc.state === 'active') yield;
    } finally {
      n.inStall = false; n.hidden = false; n.body.ghost = false; n.body.pinned = false; n.exprLock = false;
      const i = stall.occ.indexOf(n); if (i >= 0) stall.occ.splice(i, 1);
      if (!stall.occ.length) M.door(stall.door).target = 1;
    }
  }
  function fileOut(inc, eject) {
    const d = inc.data;
    d.crew.forEach((o, k) => {
      setTimeout(() => {
        if (o.gone) return;
        o.released = true; o.hidden = false; o.inStall = false; o.body.ghost = false; o.body.pinned = false; o.exprLock = false;
        o.body.x = d.stall.front.x + U.rand(-8, 8); o.body.y = d.stall.front.y + 6;
        o.incident = null;
        N.cancelTask(o);
        N.say(o, STALL_EXITS[k % STALL_EXITS.length], { pri: 3 });
        if (eject) { LC.stat('ejected'); LC.stat('ejectedByYou'); o.flags.banned = true; N.setTask(o, N.tLeave(o, { noCoat: true }), 'leave'); }
      }, 400 + k * 700);
    });
  }

  /* ================= THE DJ IS NOT TAKING REQUESTS ================= */
  const DJ_REQUESTS = ['Play the one that goes DUN DUN DUN!', 'Do you have any songs?', 'Say KAYLEIGH! It\'s her birthday!', 'Can I press ONE button?', 'Play something we can DANCE to!', 'Do you take requests? You do now.', 'Play the song from the advert!', 'Can you make it louder but quieter?'];
  D.dj = {
    title: 'THE DJ IS NOT TAKING REQUESTS',
    timeout: 150, sub: 'Someone is in the DJ booth.', brief: 'in the DJ booth',
    sev: 2, min: 90, weight: 1, cooldown: 220, noticeR: 520, radio: 'dj',
    cand: (n) => (free(n) && inRooms(n, 'dance', 'hall') && drunk(n) > 0.3 && (n.tr.ego > 0.5 || N.cs(n) < 0.4) ? 1 : 0),
    *script(n, inc) {
      n.perm = n.perm | P.STAFF;
      if (!(yield* N.go(n, S.djTouch.x, S.djTouch.y, { perm: SNEAK, arrive: 8 }))) return;
      n.act = 'argue'; N.faceTo(n, S.dj.x, S.dj.y);
      const dj = LC.Staff.dj;
      let t = 0, lineT = 0.5;
      while (t < U.rand(20, 32)) {
        if (!I.alive(inc, n)) return;
        t += G().dt; lineT -= G().dt;
        if (lineT <= 0) { lineT = U.rand(2.5, 4); N.shout(n, U.pick(DJ_REQUESTS)); if (Math.random() < 0.5 && dj) N.say(dj, U.pick(['No.', 'Please leave.', 'SECURITY.', 'I am WORKING.', 'That is not a song.']), { pri: 1 }); }
        if (t > 8 && !inc.data.radioed) { inc.data.radioed = true; LC.Radio.report(inc, 'dj'); }
        // after enough weekends the DJ finally remembers Dom
        if (inc.data.dom && LC.Regulars.state && LC.Regulars.state.dom.progress >= 2 && t > 6 && !inc.data.remembered) {
          inc.data.remembered = true;
          if (dj) N.say(dj, '...Dom?', { pri: 3, dur: 3 });
          yield* N.wait(n, 1.6);
          N.shout(n, 'HE REMEMBERS ME!', { dur: 3 });
          n.exprLock = true; n.expr = 'cry';
          yield* N.wait(n, 2.5);
          n.exprLock = false;
          I.resolve(inc, 'self', 'The DJ remembered Dom. Dom cried. Everyone cried.');
          return;
        }
        yield;
      }
      // hands on the decks
      N.shout(n, U.pick(["I'LL DO IT MYSELF", 'Watch this!', 'Requests are OPEN']));
      LC.Audio && LC.Audio.hijack && LC.Audio.hijack(true);
      G().music.hijacked = true;
      inc.data.hijacked = true;
      LC.stat('musicHijacked');
      crowdCheer(46 * T, 16 * T, 400, ['???', 'WHAT IS THIS', 'BOOOO', 'wait I love this', 'Is this... polka?'], 5);
      n.act = 'dance'; n.danceStyle = 5;
      while (I.alive(inc, n)) yield;
    },
    cleanup(n, inc) {
      n.perm = n.perm & ~P.STAFF;
      if (inc.data.hijacked) setTimeout(() => { G().music.hijacked = false; if (LC.Audio && LC.Audio.hijack) LC.Audio.hijack(false); if (LC.Staff.dj) N.say(LC.Staff.dj, U.pick(['Sorry! Sorry. Back to it.', 'We do NOT speak of that.']), { pri: 2 }); }, 3000);
      if (!n.gone && M.inRoom(n.x, n.y, 'dj') && n.state === 'inside') leaveBooth(n);
    },
    talk: () => ({
      open: ["I'm his cousin.", 'Just one song. ONE.', "I'm helping!", 'He said I could!'],
      opts: [
        { text: 'The DJ is not taking requests.', tag: 'SNARK', yes: ['...he could have SAID.'], no: ['He is now!'] },
        { text: 'Out of the booth.', tag: 'WARN', yes: ['Okay! Okay. Great set, man.'] },
        { text: "Write it on a napkin. He'll definitely read it.", tag: 'CALM', yes: ['Oh! Good idea. Napkin.'], bonus: 0.1 },
        { text: "You're leaving the booth. And the building.", tag: 'OUT' },
      ],
    }),
    stare: { t1: 1.1, t2: 2.2, t3: 3.5, l1: ['...'], l2: ['...I was just leaving.'], resume: ['ONE MORE SONG'] },
    resolved: { any: ['The DJ booth is a DJ-only booth again.', 'Requests are closed. They were never open.'], eject: ['Removed from the booth. And the building.'] },
    failed: ['The DJ gave up and played it.'],
  };

  /* ================= SIR, PUT THE FIRE EXTINGUISHER DOWN ================= */
  D.extinguisher = {
    title: 'SIR, PUT THE FIRE EXTINGUISHER DOWN', sub: 'Self-explanatory.', brief: 'armed with a fire extinguisher',
    sev: 3, min: 210, weight: 0.6, cooldown: 420, noticeR: 520, loud: true,
    cand: (n) => (free(n) && drunk(n) > 0.45 && N.cs(n) < 0.4 && n.tr.energy > 0.45 ? 1 : 0),
    title2: (inc) => (inc.n && inc.n.fem ? "MA'AM, PUT THE FIRE EXTINGUISHER DOWN" : 'SIR, PUT THE FIRE EXTINGUISHER DOWN'),
    setup(inc) {
      const ex = Wd.props.filter((p) => p.kind === 'extinguisher' && p.mounted && !p.claimed).sort((a, b) => U.dist2(inc.n.x, inc.n.y, a.body.x, a.body.y) - U.dist2(inc.n.x, inc.n.y, b.body.x, b.body.y))[0];
      if (!ex) return false;
      ex.claimed = true; inc.data.ex = ex;
      inc.title = D.extinguisher.title2(inc);
    },
    *script(n, inc) {
      const ex = inc.data.ex;
      if (!(yield* N.go(n, ex.body.x + 14, ex.body.y + 12, { arrive: 14 }))) return;
      N.pickUp(n, ex);
      n.act = 'carry';
      N.say(n, U.pick(["It's for safety.", 'Is this loaded?', "I'm the fire department now."]), { pri: 1 });
      for (let k = 0; k < 4; k++) {
        const p = M.randomPoint(U.pick(['dance', 'hall', 'bar']), n.perm);
        if (p && !(yield* N.go(n, p.x, p.y, { arrive: 16 }))) return;
        if (!I.alive(inc, n) || n.carry !== ex) return;
        // FWOOSH
        n.face = U.rand(0, 6.28);
        N.shout(n, U.pick(['FWOOOOSH', 'EVERYBODY STAY CALM', 'SAFETY FIRST']));
        LC.sfx('extinguisher', n.x, n.y);
        const ok = yield* hold(n, inc, 1.6, () => {
          for (let i = 0; i < 3; i++) Wd.part('powder', n.x + Math.cos(n.face) * U.rand(10, 60), n.y + Math.sin(n.face) * U.rand(6, 40), { z: 14, vx: Math.cos(n.face) * 90 + U.rand(-30, 30), vy: Math.sin(n.face) * 70 + U.rand(-20, 20) });
        });
        Wd.addMess('powder', n.x + Math.cos(n.face) * 40, n.y + Math.sin(n.face) * 28, { r: 30 });
        for (const b of Ph.query(n.x + Math.cos(n.face) * 40, n.y + Math.sin(n.face) * 28, 60, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n)) {
          if (!b.ent.override) { N.say(b.ent, U.pick(['*cough*', 'MY EYES', 'WHY', 'I CAN\'T SEE']), { dim: true }); Wd.part('cough', b.ent.x, b.ent.y, { z: 30 }); }
        }
        if (Math.random() < 0.12 && LC.Events) LC.Events.fireAlarm('extinguisher powder in the smoke detector');
        if (!ok) return;
        yield* N.wait(n, U.rand(6, 11));
      }
      N.drop(n);
      N.say(n, "It's empty. Anyone got another one?", { pri: 1 });
      I.fail(inc, 'emptied');
    },
    cleanup(n, inc) { if (inc.data.ex) inc.data.ex.claimed = false; },
    onPropTaken(inc, pr) { if (pr === inc.data.ex && inc.state === 'active') { I.notice(inc, 'sight'); I.resolve(inc, 'grab'); } },
    talk: (inc) => ({
      open: ["It's for safety.", 'Is this loaded?', "I'm the fire department now.", 'Stand back. I know what I\'m doing. I don\'t.'],
      opts: [
        { text: inc.n.fem ? "Ma'am, put the fire extinguisher down." : 'Sir, put the fire extinguisher down.', tag: 'SNARK', bonus: 0.25, yes: ['...okay.', 'Putting it down. Slowly.'] },
        { text: 'Put. It. Down.', tag: 'WARN', yes: ['Okay! Jeez!'] },
        { text: 'Hand it to me. Slowly.', tag: 'CALM', yes: ['...fine. It\'s heavy anyway.'] },
        { text: "You're leaving. The extinguisher is staying.", tag: 'OUT' },
      ],
    }),
    comply(inc) { const n = inc.n; if (n.carry) N.drop(n); I.resolve(inc, 'talk'); },
    stare: { t1: 0.9, t2: 2, t3: 3.4, l1: ['...'], l2: ['...is this yours?'], backDown: (inc, n) => { if (n.carry) N.drop(n); } },
    resolved: { any: ['Fire extinguisher: disarmed.', 'Nobody was extinguished.'], grab: ['You took the extinguisher. You are now the fire department.'], eject: ['The extinguisher stayed. They did not.'] },
    failed: ['Empty. Everything within ten metres is now beige.'],
  };

  /* ================= THE BAR IS NOT A STAGE ================= */
  const BAR_CHEERS = ['WOOOO', 'YES QUEEN', 'GET IT', 'ON THE BAR! ON THE BAR!', 'LEGEND'];
  D.barDance = {
    title: 'THE BAR IS NOT A STAGE', sub: 'Someone is dancing on the bar.', brief: 'dancing on the bar',
    sev: 2, min: 150, weight: 0.9, cooldown: 240, noticeR: 520, radio: 'bar',
    cand: (n) => (free(n) && drunk(n) > 0.45 && n.tr.energy > 0.5 && N.cs(n) < 0.45 && inRooms(n, 'bar', 'dance', 'hall') ? 1 + drunk(n) : 0),
    *script(n, inc) {
      const s = U.pick(S.bar);
      if (!(yield* N.go(n, s.x, s.y + 6, { arrive: 10, avoidDance: true }))) return;
      N.shout(n, U.pick(["IT'S MY TIME", 'Hold this.', 'Watch me.']));
      n.body.ghost = true; n.body.pinned = true;
      yield* climbUp(n, 26, 0.9);
      n.body.y = 10.5 * T;
      n.act = 'dance'; n.danceStyle = U.pick([0, 4, 5]);
      let dir = Math.random() < 0.5 ? -1 : 1, cheerT = 1, radioT = 6;
      const ok = yield* hold(n, inc, U.rand(50, 80), (t) => {
        n.body.x += dir * 18 * G().dt;
        if (n.body.x < 17 * T || n.body.x > 29.5 * T) dir *= -1;
        n.z = 26;
        for (let i = Wd.barTop.length - 1; i >= 0; i--) {
          const gl = Wd.barTop[i];
          if (Math.abs(gl.x - n.body.x) < 10) { Wd.barTop.splice(i, 1); Wd.breakGlass(gl.x + U.rand(-6, 6), 11.3 * T, { c: gl.full ? gl.c : null }); }
        }
        cheerT -= G().dt;
        if (cheerT < 0) { cheerT = U.rand(2.5, 4.5); crowdCheer(n.body.x, 12 * T, 160, BAR_CHEERS); }
        radioT -= G().dt;
        if (radioT < 0 && !inc.data.radioed) { inc.data.radioed = true; LC.Radio.say('jolene', U.pick(['Someone is dancing on my bar.', 'Security. There is a person. On my bar. Dancing.'])); }
      });
      if (!ok) return;
      yield* fall(n, inc, { land: { x: n.body.x, y: 12 * T }, lines: ['WHOA WHOA WHOA', 'oh no the floor'] });
    },
    cleanup(n, inc) { if (!inc.data.fell && n.z > 0) { n.body.y = 11.9 * T; climbDownLater(n); } },
    talk: () => ({
      open: ["I'M THE DRINKS NOW", 'The bar is a STAGE!', 'Tips go in my shoe!', 'Is this not a stage?'],
      opts: [
        { text: 'Off the bar.', tag: 'WARN', yes: ['Okay, okay. Encore later.'] },
        { text: 'Come down before you fall down.', tag: 'CALM', yes: ['...fair point. Floor looks hard.'] },
        { text: 'Bold choice. Wrong, but bold.', tag: 'SNARK', yes: ['...thank you? Getting down.'], no: ['Bold is my BRAND.'] },
        { text: 'Get down. Then get out.', tag: 'OUT', fn: (inc) => { N.say(inc.n, 'Come up here and MAKE me!', { pri: 3 }); I.escalate(inc, 2); } },
      ],
    }),
    stare: { r: 320, t1: 1, t2: 2.2, t3: 3.6, l1: ['...'], l2: ['...is dancing on the bar... frowned upon?'], resume: ['WOOOO'] },
    resolved: { any: ['Off the bar. The bar thanks you.', 'Returned to floor level. The glasses were not so lucky.'], eject: ['Danced off the bar and out the door.'] },
    failed: ['Fell off the bar. Took four glasses and one onlooker.'],
  };

  /* ================= THE TABLE HAS A WEIGHT LIMIT ================= */
  D.tableDance = {
    title: 'THE TABLE HAS A WEIGHT LIMIT', sub: 'Someone climbed onto a table.', brief: 'standing on a table',
    sev: 2, min: 110, weight: 0.8, cooldown: 200, noticeR: 480,
    cand: (n) => (free(n) && drunk(n) > 0.4 && N.cs(n) < 0.45 && inRooms(n, 'bar', 'hall') ? 1 : 0),
    setup(inc) {
      const t = Wd.props.filter((p) => p.kind === 'table' && !p.fallen && !p.broken && M.inClub(p.body.x, p.body.y) && !p.claimed).sort((a, b) => U.dist2(inc.n.x, inc.n.y, a.body.x, a.body.y) - U.dist2(inc.n.x, inc.n.y, b.body.x, b.body.y))[0];
      if (!t) return false;
      t.claimed = true; inc.data.table = t;
    },
    *script(n, inc) {
      const tb = inc.data.table;
      if (!(yield* N.go(n, tb.body.x, tb.body.y + 16, { arrive: 14 }))) return;
      if (tb.fallen || tb.broken) return;
      N.shout(n, U.pick(['TABLE!', 'Up we go!', 'Everybody look at me!']));
      n.body.ghost = true; n.body.pinned = true; n.body.x = tb.body.x; n.body.y = tb.body.y;
      tb.body.pinned = true;
      yield* climbUp(n, tb.high ? 31 : 23, 0.8);
      n.act = 'dance'; n.danceStyle = U.pick([0, 1, 5]);
      const ok = yield* hold(n, inc, U.rand(20, 36), (t) => {
        n.body.x = tb.body.x + Math.sin(t * 2) * 3; n.body.y = tb.body.y;
        if (Math.random() < G().dt * 0.4) crowdCheer(n.x, n.y + 10, 150, ['TABLE! TABLE!', 'WOOO', 'Oh no']);
        if (tb.glasses > 0 && Math.random() < G().dt * 0.5) { tb.glasses--; Wd.breakGlass(tb.body.x + U.rand(-16, 16), tb.body.y + U.rand(4, 10), {}); }
        if (t > 8 && Math.random() < G().dt * 0.3) LC.sfx('creak', tb.body.x, tb.body.y);
      });
      if (!ok) return;
      tb.body.pinned = false;
      Wd.breakProp(tb);
      yield* fall(n, inc, { lines: ['CRACK?', 'oh no oh no'] });
    },
    cleanup(n, inc) { const tb = inc.data.table; if (tb) { tb.claimed = false; tb.body.pinned = false; } if (!inc.data.fell) climbDownLater(n); },
    talk: () => ({
      open: ["It's a dance floor now!", 'Tables are just tall floors.', "I'm TALLER than you now!"],
      opts: [
        { text: 'Off the table.', tag: 'WARN' },
        { text: 'That table cost more than your shoes.', tag: 'SNARK', yes: ['...these shoes were EXPENSIVE. Getting down.'] },
        { text: 'Come down. Carefully.', tag: 'CALM' },
        { text: 'Down. Then out.', tag: 'OUT', fn: (inc) => { N.say(inc.n, 'Make me!', { pri: 3 }); I.escalate(inc, 2); } },
      ],
    }),
    stare: { r: 320, t1: 1, t2: 2.1, t3: 3.4, l1: ['...'], l2: ['...I can feel it wobbling. Can you feel it wobbling?'] },
    resolved: { any: ['Table survived. Barely.'], eject: ['Off the table and out of the club.'] },
    failed: ['The table has reached its weight limit. Permanently.'],
  };

  /* ================= THERE IS NO LIST ================= */
  D.vipSneak = {
    title: 'THERE IS NO LIST',
    timeout: 210, onTimeout(inc) { const n = inc.n; I.fail(inc, 'rico', 'Rico dealt with it himself. He is disappointed in you.'); if (n && !n.gone) { N.standUp(n); N.setTask(n, N.tWander(n), 'wander'); } }, sub: 'Someone snuck into VIP.', brief: 'somewhere they are not VIP',
    sev: 1, min: 60, weight: 1, cooldown: 180, noticeR: 420, radio: 'vip',
    cand: (n) => (free(n) && !n.vip && (n.tr.ego > 0.55 || n.tr.confidence > 0.65) && inRooms(n, 'hall', 'dance', 'bar') ? 1 + n.tr.ego : 0),
    *script(n, inc) {
      if (!(yield* N.go(n, S.vipHost.x - 70, S.vipHost.y + U.rand(-30, 30), { arrive: 16 }))) return;
      n.act = 'stand';
      // wait for the host to look away
      let waited = 0;
      while (waited < 25 && LC.Staff.host && !LC.Staff.host.away && Math.random() > G().dt * 0.12) { if (!I.alive(inc, n)) return; waited += G().dt; whistle(n); yield; }
      n.act = 'crouch';
      yield* N.wait(n, 0.5);
      n.perm = n.perm | P.VIP;
      yield* N.go(n, S.vipIn.x + 20, S.vipIn.y, { perm: n.perm, arrive: 12 });
      const seat = N.findSeat(n, { rooms: ['vip'], anyVip: true });
      if (seat) {
        seat.s.occ = n;
        yield* N.go(n, seat.x, seat.y + 16, { perm: n.perm, arrive: 14 });
        N.sitDown(n, seat);
      }
      n.bottle = Math.random() < 0.6;
      let t = 0;
      while (I.alive(inc, n)) {
        t += G().dt;
        if (Math.random() < G().dt * 0.07) N.say(n, U.pick(["I'm VIP. Literally.", 'Put it on my tab. What tab? My tab.', 'I know the flamingo.', 'This is where I belong.']), { dim: true });
        if (Math.random() < G().dt * 0.03) LC.stat('customerComplaints');
        if (t > 60 && !inc.data.radioed && LC.Staff.host && !LC.Staff.host.away) { inc.data.radioed = true; LC.Radio.say('rico', "There's a man in VIP who is not VIP. He's very relaxed about it."); I.notice(inc, 'radio'); }
        yield;
      }
    },
    cleanup(n, inc) {
      n.bottle = false; n.perm = n.perm & ~P.VIP;
      if (!n.gone) N.standUp(n);
      if (!n.gone && M.inRoom(n.x, n.y, 'vip') && n.state === 'inside') N.setTask(n, (function* () { yield* N.go(n, S.vipHost.x - 60, S.vipHost.y + 20, { perm: P.GUEST | P.VIP }); })(), 'wander');
    },
    talk: () => ({
      open: ["I'm on the list.", "I'm VIP. Look at me.", 'Do you know how VIP I am?', "I'm with the band."],
      opts: [
        { text: 'There is no list.', tag: 'SNARK', yes: ['...there\'s no LIST?'], no: ['There is ALWAYS a list.'] },
        { text: 'Out of VIP.', tag: 'WARN' },
        { text: "VIP stands for 'Very Illegal Presence'. Out.", tag: 'CALM', bonus: 0.1, yes: ['Ha. Okay. Fair.'] },
        { text: "You're leaving VIP. And the club.", tag: 'OUT' },
      ],
    }),
    stare: { t1: 1.1, t2: 2.4, t3: 3.8, l1: ['...'], l2: ['...I\'ll just... go back to being normal.'] },
    resolved: { any: ['VIP is Very Important People again. Mostly.'], eject: ['Upgraded to the pavement.'] },
    failed: ['Stayed in VIP all night. Nobody could prove they weren\'t VIP.'],
  };

  /* ================= THAT'S NOT YOUR DRINK ================= */
  D.drinkThief = {
    title: "THAT'S NOT YOUR DRINK", sub: 'Someone is helping themselves.', brief: 'holding a drink that is not theirs',
    sev: 1, min: 70, weight: 1, cooldown: 150, noticeR: 300, noticeT: 1,
    cand: (n) => (free(n) && N.cs(n) < 0.5 && drunk(n) > 0.3 && !n.drink ? 1 : 0),
    *script(n, inc) {
      for (let k = 0; k < 3; k++) {
        const victims = LC.G.npcs.filter((o) => o.kind === 'guest' && o.drink && o !== n && (o.act === 'dance' || o.act === 'stand') && !o.override && M.inClub(o.x, o.y) && U.dist(n.x, n.y, o.x, o.y) < 500);
        if (!victims.length) { yield* N.wait(n, 4); continue; }
        const v = U.pick(victims);
        const bx = v.x - Math.cos(v.face) * 18, by = v.y - Math.sin(v.face) * 14;
        if (!(yield* N.go(n, bx, by, { arrive: 12 }))) continue;
        if (!I.alive(inc, n)) return;
        if (!v.drink || U.dist(n.x, n.y, v.x, v.y) > 40) continue;
        inc.data.stealing = true;
        yield* N.wait(n, 0.5);
        if (!I.alive(inc, n) || !v.drink) { inc.data.stealing = false; continue; }
        n.drink = v.drink; v.drink = null; inc.data.victim = v; inc.data.stealing = false;
        LC.stat('drinksStolen');
        whistle(n);
        const away = M.randomPoint(U.pick(['hall', 'bar', 'lounge']), n.perm);
        if (away) yield* N.go(n, away.x, away.y, { arrive: 16, speed: n.speed * 1.2 });
        // the victim works it out and blames whoever is nearest
        setTimeout(() => {
          if (v.gone || v.override || v.state !== 'inside') return;
          N.shout(v, U.pick(["WHERE'S MY DRINK?", 'WHO TOOK MY DRINK?', 'My drink was RIGHT HERE']));
          const b = Ph.query(v.x, v.y, 90, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== v && !b.ent.override)[0];
          if (b && LC.Social && LC.Director.allow('argument')) LC.Social.startArgument(v, b.ent, 'spill');
        }, U.rand(4000, 9000));
        yield* N.wait(n, U.rand(5, 10));
      }
    },
    talk: () => ({
      open: ['This? This was... donated.', 'Finders keepers.', "I'm holding it for someone.", 'It was going to waste.'],
      opts: [
        { text: 'You have three drinks. You have two hands.', tag: 'SNARK', yes: ['...maths. Fine.'] },
        { text: 'Give it back.', tag: 'WARN', yes: ['Okay, okay. Here.'] },
        { text: 'Whose drink is that?', tag: 'CALM', yes: ['...not mine. I\'ll put it back.'] },
        { text: 'Drink thief. Door. Now.', tag: 'OUT' },
      ],
    }),
    comply(inc) { const n = inc.n, v = inc.data.victim; if (n.drink && v && !v.gone && U.dist(n.x, n.y, v.x, v.y) < 200) { v.drink = n.drink; } n.drink = null; LC.stat('stolenRecovered'); I.resolve(inc, 'talk'); },
    stare: { r: 260, t1: 0.8, t2: 2, t3: 3.2, l1: ['...'], l2: ['...I was just checking it was cold.'], backDown: (inc, n) => { const v = inc.data.victim; if (n.drink && v && !v.gone) v.drink = n.drink; n.drink = null; LC.stat('stolenRecovered'); } },
    resolved: { any: ['Drink returned. Mostly. It\'s half empty.'], stare: ['Gave the drink back without a word.'], eject: ['Thief ejected. Drinks are safe. Ish.'] },
    failed: ['Three drinks stolen. Two arguments started. One very happy thief.'],
    onScriptEnd(inc) { I.fail(inc, 'done'); },
  };

  /* ================= SOMEONE HAS RETURNED THEIR DRINKS (vomit) ================= */
  D.vomit = {
    title: (inc) => U.pick(['SOMEONE HAS RETURNED THEIR DRINKS', 'CLEAN-UP ON THE DANCE FLOOR', 'THAT WAS A KEBAB', 'SOMEBODY BLEW CHUNKS']),
    sub: 'Mop. Sign. Try not to breathe.', brief: 'recently sick',
    sev: 1, weightLoad: 0.35, noticeR: 300, noticeT: 0.4,
    setup(inc) { inc.data.pos = { x: inc.data.mess.x, y: inc.data.mess.y }; inc.n = null; inc.data.slips = 0; },
    update(inc) { if (!Wd.mess.includes(inc.data.mess)) I.resolve(inc, 'mop'); },
    resolved: { any: (inc) => (inc.data.signed ? 'Cleaned. The sign did most of the work.' : U.pick(['Cleaned. You smell like it now.', 'Mopped. The smell remains, spiritually.', 'Gone. Mostly.'])) },
    failed: ['It dried.'],
  };

  /* ================= SLEEPERS ================= */
  D.sleeper = {
    title: (inc) => (inc.data.where === 'floor' ? 'THIS IS NOT A HOTEL' : inc.data.where === 'stall' ? 'SLEEPING IN A STALL. BOLD.' : 'SLEEPING BEAUTY'),
    sub: 'Someone has fallen asleep.', brief: 'asleep',
    sev: 1, weightLoad: 0.4, noticeR: 280, noticeT: 0.6,
    onNotice(inc) { LC.stat('peopleFoundSleeping'); },
    update(inc) { const n = inc.n; if (n && !n.asleep && !n.followingPlayer && n.state === 'inside' && n.sob > 0.25) I.resolve(inc, 'woken'); },
    resolved: { any: ['Awake. Technically.'], taxi: ['Poured into a taxi. Rescued.'], woken: ['Woken up. They are furious about it.'], eject: ['Carried out like a rolled-up carpet.'] },
    failed: ['Slept through closing.'],
  };

  /* ================= injured ================= */
  D.injured = {
    title: (inc) => U.pick(['MAN DOWN', 'SOMEBODY IS HAVING A LIE DOWN', 'THAT LOOKED LIKE IT HURT']),
    sub: 'First aid kit. Slot 9.', brief: 'hurt',
    sev: 1, weightLoad: 0.3, noticeR: 300, timeout: 150,
    update(inc) { if (inc.n && !inc.n.needsAid) I.resolve(inc, 'self', 'Got up on their own. Walked it off.'); },
    onTimeout(inc) { if (inc.n) inc.n.needsAid = false; I.resolve(inc, 'self', 'Walked it off. Probably fine.'); },
    resolved: { aid: ['Patched up. They are telling everyone you saved their life.'], any: ['Back on their feet.'] },
  };

  /* ================= arguments + fights (emergent) ================= */
  D.argument = {
    title: (inc) => U.pick(['USE YOUR WORDS. QUIETER ONES.', 'TWO PEOPLE HAVE HAD AN OPINION', 'THIS IS HOW IT STARTS', 'SOMEBODY SPILLED SOMETHING']),
    sub: 'Separate them before it becomes a fight.', brief: 'arguing',
    sev: 1, noticeR: 420, noticeT: 0.5, radio: null,
    update(inc) { if (inc.data.arg) { inc.data.pos = { x: inc.data.arg.x, y: inc.data.arg.y }; } },
    resolved: { any: ['Settled.'] },
    failed: ['It became a fight.'],
  };
  D.fight = {
    title: (inc) => U.pick(['PLEASE STOP HITTING EACH OTHER', 'FIGHT CLUB HAS RULES. SO DO WE.', 'THERE IS A FIGHT. OF COURSE THERE IS.', 'FISTS. AT A DISCO.']),
    sub: 'Break it up. Grab one. Radio for backup [Q].', brief: 'fighting',
    sev: 4, noticeR: 620, noticeT: 0.2, loud: true,
    onNotice(inc) { LC.Radio.maybe('fight'); },
    update(inc) { const f = inc.data.fight; if (f) inc.data.pos = { x: f.x, y: f.y }; inc.x = f.x; inc.y = f.y; },
    resolved: { any: ['Fight over.'] },
    failed: ['It burned itself out. The furniture did not.'],
  };

  /* ================= THE BOTTLES ARE NOT A BUFFET ================= */
  D.bottleThief = {
    title: 'THE BOTTLES ARE NOT A BUFFET',
    timeout: 190, sub: 'Someone went behind the bar.', brief: 'holding a stolen bottle',
    sev: 2, min: 150, weight: 0.8, cooldown: 240, noticeR: 440, radio: 'bar',
    cand: (n) => (free(n) && drunk(n) > 0.35 && N.cs(n) < 0.45 && inRooms(n, 'bar', 'hall') ? 1 : 0),
    *script(n, inc) {
      if (!(yield* N.go(n, 30.5 * T, 11.8 * T, { arrive: 10 }))) return;
      whistle(n);
      yield* N.wait(n, U.rand(1, 3));
      n.perm = n.perm | P.STAFF;
      const bx = U.rand(18, 28) * T;
      if (!(yield* N.go(n, bx, 8.5 * T, { perm: SNEAK, arrive: 10 }))) return;
      n.act = 'crouch';
      inc.data.pos = { x: n.x, y: n.y };
      yield* N.wait(n, 1.2);
      if (!I.alive(inc, n)) return;
      n.bottle = true;
      LC.stat('bottlesStolen');
      LC.Radio.say('jolene', U.pick(['Someone just took a bottle of tequila from behind the bar.', 'SECURITY. Bottle. Gone. Somebody in a ' + (n.fem ? 'dress' : 'shirt') + ' just ran off with it.']));
      I.notice(inc, 'radio');
      n.perm = n.perm & ~P.STAFF;
      const hide = M.randomPoint(U.pick(['lounge', 'chill', 'patio']), P.GUEST);
      if (hide) yield* N.go(n, hide.x, hide.y, { perm: SNEAK, hurry: true, arrive: 16 });
      n.act = 'stand';
      while (I.alive(inc, n)) {
        if (Math.random() < G().dt * 0.2) { n.sip = 0.8; n.sob = Math.max(0, n.sob - 0.025); }
        if (Math.random() < G().dt * 0.05) N.say(n, U.pick(['Tequila is a vegetable.', 'Free bar!', 'Anyone want some? No? More for me.']), { dim: true });
        yield;
      }
    },
    cleanup(n) { n.perm = n.perm & ~P.STAFF; },
    talk: () => ({
      open: ['What bottle?', 'It was a gift.', 'I paid! Spiritually.', "Finders keepers, that's the law."],
      opts: [
        { text: 'The bottles are not a buffet.', tag: 'SNARK', yes: ['...fine. Here.'] },
        { text: 'Bottle. Hand. Now.', tag: 'WARN', yes: ['Okay! Take it!'] },
        { text: "Give it to me and we'll pretend this never happened.", tag: 'CALM', bonus: 0.1 },
        { text: "You're leaving. The bottle is staying.", tag: 'OUT' },
      ],
    }),
    comply(inc) { inc.n.bottle = false; LC.stat('stolenRecovered'); I.resolve(inc, 'talk'); },
    resolved: { any: ['Bottle recovered. Slightly lighter.'], eject: ['Bottle confiscated. Thief deported to the pavement.'] },
    failed: ['The bottle is empty. So is the thief.'],
    onGone(inc) { I.drop(inc); },
  };

  /* ================= READ THE ROOM ================= */
  const CREEP = ['Can I buy you a drink?', "What's your star sign? Let me guess. Wrong.", "I'm actually a really nice guy.", 'Do you want to see me do the worm?', "You're like a... a... nice person.", "We should get married. Or a kebab."];
  D.harasser = {
    title: (inc) => U.pick(["HE WON'T TAKE THE HINT", 'BEING WEIRD TO WOMEN IS NOT A HOBBY, ' + inc.n.name.toUpperCase(), "SHE SAID NO. SHE SAID IT TWICE."]),
    timeout: 160, onTimeout(inc) { const v = inc.data.victim; I.fail(inc, 'victimLeft'); if (v && !v.gone && v.state === 'inside') N.setTask(v, N.tLeave(v), 'leave'); }, sub: 'Someone will not take the hint.', brief: 'bothering someone',
    sev: 2, min: 80, weight: 0.9, cooldown: 200, noticeR: 340, noticeT: 1.2,
    cand: (n) => (free(n) && n.tr.attraction > 0.55 && n.tr.social < 0.4 && drunk(n) > 0.3 ? 1 : 0),
    setup(inc) {
      const n = inc.n;
      let vs = LC.G.npcs.filter((o) => o.kind === 'guest' && o !== n && o.group !== n.group && o.state === 'inside' && !o.override && !o.incident && U.dist(n.x, n.y, o.x, o.y) < 600);
      const women = vs.filter((o) => o.look && o.look.fem);
      if (women.length) vs = women;
      if (!vs.length) return false;
      inc.data.victim = U.pick(vs);
    },
    *script(n, inc) {
      const v = inc.data.victim;
      let t = 0, lineT = 1, fleeT = 6, reported = false;
      while (I.alive(inc, n) && !v.gone && v.state === 'inside') {
        t += G().dt;
        const d = U.dist(n.x, n.y, v.x, v.y);
        if (d > 26) { if (n.nav.status !== 'moving' || Math.random() < G().dt * 2) N.goTo(n, v.x + U.rand(-10, 10), v.y + 14, { arrive: 20 }); }
        else { N.stop(n); N.faceTo(n, v.x, v.y); n.act = 'stand'; }
        lineT -= G().dt;
        if (lineT < 0 && d < 60) {
          lineT = U.rand(3, 5);
          N.say(n, U.pick(CREEP), { pri: 1 });
          setTimeout(() => { if (!v.gone && !v.override) { N.say(v, U.pick(['No thank you.', 'Please go away.', "I'm here with friends.", 'Can you not?', "I'm literally walking away."]), { pri: 1 }); N.emote(v, 'sweat', 2); } }, 1300);
        }
        fleeT -= G().dt;
        if (fleeT < 0 && !v.override) {
          fleeT = U.rand(8, 14);
          const away = M.randomPoint(U.pick(['bar', 'hall', 'patio', 'lounge', 'dance']), v.perm);
          if (away) N.setTask(v, (function* () { yield* N.go(v, away.x, away.y, { hurry: true }); })(), 'avoid');
          // friends step in
          if (v.group && Math.random() < 0.4) { const f = v.group.members.find((m) => m !== v && !m.gone && m.state === 'inside' && U.dist(m.x, m.y, v.x, v.y) < 250 && !m.override); if (f && LC.Director.allow('argument')) LC.Social.startArgument(f, n, 'bump'); }
        }
        if (t > 16 && !reported && !inc.noticed) { reported = true; reportToPlayer(v, inc, ['That guy will not leave me alone.', "Can you do something about him? He's following me.", 'There is a man. He keeps offering to do the worm.']); }
        yield;
      }
    },
    talk: () => ({
      open: ["We're just talking!", "She likes me. She's playing hard to get.", "I'm being CHARMING!", "It's a free country!"],
      opts: [
        { text: 'Leave them alone.', tag: 'WARN' },
        { text: 'Read the room.', tag: 'SNARK', yes: ['...what room?', 'Oh. OH. Okay.'] },
        { text: 'They said no. Go dance.', tag: 'CALM' },
        { text: "You're leaving.", tag: 'OUT' },
      ],
    }),
    stare: { t1: 1.2, t2: 2.6, t3: 4, l1: ['...'], l2: ["...I'll go and stand over there."] },
    resolved: { any: ['Left alone, finally.'], eject: ['Escorted out. The room has been read to him.'] },
    failed: ['They left early to get away from him.'],
    onGone(inc) { I.drop(inc); },
  };
  // a guest walks up to you to report something
  function reportToPlayer(v, inc, lines) {
    const p = LC.G.player;
    if (U.dist(v.x, v.y, p.x, p.y) > 700 || v.override) { I.notice(inc, 'radio'); return; }
    N.interrupt(v, (function* () {
      yield* N.go(v, p.x + U.rand(-24, 24), p.y + 20, { hurry: true, arrive: 30, timeout: 10 });
      N.faceTo(v, p.x, p.y);
      N.say(v, U.pick(lines), { pri: 3, dur: 4 });
      I.notice(inc, 'told');
      yield* N.wait(v, 2.5);
    })(), 'report', 5);
  }
  I.reportToPlayer = reportToPlayer;

  /* ================= THE STALL IS NOT A JUNGLE GYM ================= */
  D.stallClimb = {
    title: 'THE STALL IS NOT A JUNGLE GYM', sub: 'Someone is climbing between cubicles.', brief: 'climbing the stall wall',
    sev: 2, min: 180, weight: 0.6, cooldown: 300, noticeR: 260, radio: 'mens',
    cand: (n) => (free(n) && drunk(n) > 0.45 && N.cs(n) < 0.4 && !n.fem ? 1 : 0),
    *script(n, inc) {
      const x = U.pick([4, 6]) * T;
      if (!(yield* N.go(n, x + 10, 23.4 * T, { arrive: 10, avoidDance: true }))) return;
      N.say(n, U.pick(["Dave's in there. I'm going in.", 'Shortcut!', 'Hold on, lads!']), { pri: 1 });
      n.body.x = x; n.body.y = 21.4 * T;
      yield* climbUp(n, 24, 1.4);
      const ok = yield* hold(n, inc, U.rand(16, 30), (t) => { n.body.x = x + Math.sin(t * 5) * 2; if (Math.random() < G().dt * 0.4) N.shout(n, U.pick(['I can see everything!', 'Hi Dave!', 'I\'m STUCK', 'Is this the ladies?']), { dim: true }); if (Math.random() < G().dt * 0.3) LC.sfx('creak', n.x, n.y); });
      if (!ok) return;
      LC.stat('clubDamage', 150);
      yield* fall(n, inc, { land: { x: x + 16, y: 23.2 * T } });
    },
    cleanup(n, inc) { if (!inc.data.fell) climbDownLater(n); },
    talk: () => ({
      open: ["Dave's stuck in there!", "I'm helping!", "It's a shortcut!"],
      opts: [{ text: 'Get down.', tag: 'WARN' }, { text: 'Dave can use the door.', tag: 'SNARK' }, { text: 'Easy. Climb down slowly.', tag: 'CALM' }, { text: 'Down. And out.', tag: 'OUT', fn: (inc) => N.say(inc.n, 'Come up and get me!', { pri: 3 }) }],
    }),
    stare: { r: 240, t1: 1, t2: 2.1, t3: 3.4, l1: ['...'], l2: ['...this looks bad, doesn\'t it.'] },
    resolved: { any: ['Down from the partition. The partition is traumatised.'], eject: ['Climbed down and was walked out.'] },
    failed: ['The partition gave up before they did.'],
  };

  /* ================= THE CHAIR DID NOTHING TO YOU ================= */
  D.wrecker = {
    title: 'THE CHAIR DID NOTHING TO YOU', sub: 'Someone is throwing furniture.', brief: 'throwing furniture',
    sev: 3, min: 210, weight: 0.6, cooldown: 300, noticeR: 520, loud: true,
    cand: (n) => (free(n) && N.aggr(n) > 0.7 && drunk(n) > 0.45 ? 1 + N.aggr(n) : 0),
    *script(n, inc) {
      n.flags.violent = true;
      for (let k = 0; k < 3; k++) {
        const pr = Wd.nearestProp(n.x, n.y, 400, (q) => (q.kind === 'chair' || q.kind === 'stool') && !q.occ && !q.carriedBy && !q.fallen);
        if (!pr) return;
        if (!(yield* N.go(n, pr.body.x, pr.body.y + 12, { arrive: 14 }))) return;
        if (!I.alive(inc, n) || pr.carriedBy || pr.occ) continue;
        N.pickUp(n, pr);
        n.act = 'carryUp';
        N.shout(n, U.pick(['WHY IS EVERYTHING SO LOUD', 'NOBODY RESPECTS ME', 'THIS CHAIR KNOWS WHAT IT DID', 'AAARGH']));
        yield* N.wait(n, 1);
        if (!I.alive(inc, n) || n.carry !== pr) return;
        // throw
        n.face += U.rand(-0.6, 0.6);
        N.drop(n);
        pr.body.vx = Math.cos(n.face) * 380; pr.body.vy = Math.sin(n.face) * 300;
        Wd.tip(pr, n.face, 2);
        Wd.damage(pr, 40, n.face);
        LC.sfx('throw', n.x, n.y);
        for (const b of Ph.query(n.x + Math.cos(n.face) * 50, n.y + Math.sin(n.face) * 36, 30, (b) => b.kind === 'char' && b.ent !== n)) N.knockDown(b.ent, n.face, 1);
        if (LC.Social) LC.Social.noise(n.x, n.y, 'crash', 1.2);
        yield* N.wait(n, U.rand(4, 8));
      }
    },
    talk: () => ({
      open: ['WHAT?!', "Don't touch me!", 'It was looking at me.', 'I am having a VERY bad night.'],
      opts: [{ text: 'Put it down.', tag: 'WARN', bonus: -0.1 }, { text: "Hey. Hey. What's going on?", tag: 'CALM', yes: ["...my ex is here. With a guy called KYLE.", 'Nobody would dance with me.'] }, { text: 'The chair did nothing to you.', tag: 'SNARK', no: ['IT DID. IT KNOWS.'] }, { text: "You're done. Out.", tag: 'OUT' }],
    }),
    comply(inc) { const n = inc.n; if (n.carry) N.drop(n); n.flags.violent = false; I.resolve(inc, 'talk'); },
    resolved: { any: ['The furniture is safe. For now.'], talk: ['Talked down. Turns out it was about their ex.'], eject: ['Thrown out, which seems fair.'] },
    failed: ['Ran out of chairs to throw.'],
    onScriptEnd(inc) { I.fail(inc, 'done'); },
  };

  /* ================= THE KITCHEN IS NOT AN ENTRANCE ================= */
  D.kitchen = {
    title: 'THE KITCHEN IS NOT AN ENTRANCE',
    timeout: 260, sub: 'Somebody came in the back way.', brief: 'no wristband',
    sev: 2, weight: 0, cooldown: 60, noticeR: 360, radio: 'kitchen',
    *script(n, inc) {
      n.flags.noWristband = true; n.look.wristband = false;
      n.perm = SNEAK;
      n.state = 'sneaking';
      if (!(yield* N.go(n, S.kitchenBackOut.x, S.kitchenBackOut.y, { perm: SNEAK, arrive: 14, timeout: 90 }))) return;
      M.door('kitchenBack').target = 1;
      yield* N.go(n, S.kitchenBackIn.x, S.kitchenBackIn.y + 30, { perm: SNEAK, arrive: 14 });
      n.act = 'hold';
      if (LC.Staff.chef && !LC.Staff.chef.gone) LC.Radio.say('bogdan', U.pick(['There is a man in my kitchen. He is eating the garnish.', 'Security. Stranger in kitchen. He has taken a lemon.']));
      else LC.Radio.say('jolene', 'Someone just came out of the kitchen. We don\'t have a kitchen after one.');
      yield* N.wait(n, 2.5);
      yield* N.go(n, 17 * T, 9 * T, { perm: SNEAK, arrive: 14 });
      yield* N.go(n, S.barFlap.x, S.barFlap.y + 30, { perm: SNEAK, arrive: 14 });
      n.perm = P.GUEST; n.state = 'inside';
      N.say(n, U.pick(['Nailed it.', 'Free entry!', "Act natural. I'm natural."]), { dim: true });
      // blend in and party
      while (I.alive(inc, n)) {
        yield* N.tDance(n);
        if (!I.alive(inc, n)) return;
        yield* N.tWander(n);
      }
    },
    talk: () => ({
      open: ['Hi! Normal customer.', 'I came in the front. Through the kitchen. Which is the front.', 'Wristband? It\'s... in my other hand.'],
      opts: [{ text: 'Wristband?', tag: 'WARN', fn: (inc) => { N.say(inc.n, U.pick(["It's... in my other hand.", "I'm allergic to wristbands.", 'It fell off. Into the kitchen.']), { pri: 3 }); I.escalate(inc, 2); } }, { text: 'How was the garnish?', tag: 'SNARK', fn: (inc) => { N.say(inc.n, '...very fresh.', { pri: 3 }); inc.n.mood.shame += 0.5; } }, { text: 'Front door is that way. You can use it to leave.', tag: 'OUT' }],
    }),
    resolved: { any: ['Returned to the outside, where they came from.'], eject: ['Out through the front door, this time.'] },
    failed: ['Partied all night for free.'],
  };

  /* ================= over the smoking-area fence ================= */
  D.gateClimb = {
    title: 'THE FENCE IS NOT AN ENTRANCE EITHER',
    timeout: 260, sub: 'Someone is climbing into the smoking area.', brief: 'came over the fence',
    sev: 1, weight: 0, noticeR: 380, radio: 'patio',
    *script(n, inc) {
      n.flags.noWristband = true;
      n.perm = SNEAK | P.CLIMB;
      if (!(yield* N.go(n, S.gateOut.x, S.gateOut.y, { perm: SNEAK | P.CLIMB, arrive: 12, timeout: 90 }))) return;
      n.body.ghost = true; n.body.pinned = true;
      yield* climbUp(n, 18, 1);
      n.body.x = S.gateIn.x; n.body.y = S.gateIn.y;
      yield* oClimbDown(n, 0.6);
      n.body.ghost = false; n.body.pinned = false;
      N.say(n, U.pick(['PARKOUR', 'Nobody saw that.', 'In!']), { dim: true });
      n.perm = P.GUEST; n.state = 'inside';
      while (I.alive(inc, n)) { yield* N.tSmoke(n); if (!I.alive(inc, n)) return; yield* N.tDance(n); }
    },
    cleanup(n) { n.body.ghost = false; n.body.pinned = false; },
    talk: () => ({ open: ['I was always here.', 'The gate was open. In a way.'], opts: [{ text: "That fence isn't a door.", tag: 'WARN' }, { text: 'Nice climb. Now do it backwards.', tag: 'OUT' }] }),
    resolved: { any: ['Sent back the way they came. Through the door, this time.'] },
    failed: ['Got in for free. Climbing is a skill, apparently.'],
  };

  /* ================= THE EMERGENCY EXIT IS NOT A SIDE ENTRANCE ================= */
  D.emergency = {
    title: 'THE EMERGENCY EXIT IS NOT A SIDE ENTRANCE',
    timeout: 240, onTimeout(inc) { M.door('emergency').target = 0; LC.G.emergencyOpen = false; LC.Radio.say('marcus', 'I closed the fire exit myself. You are welcome.'); I.fail(inc, 'marcus'); }, sub: 'Someone is letting their friends in the back.', brief: 'let people in the fire exit',
    sev: 3, min: 150, weight: 0.8, cooldown: 400, noticeR: 520, loud: true, radio: 'hall',
    cand: (n) => (free(n) && n.tr.loyalty > 0.5 && N.cs(n) < 0.55 ? 1 : 0),
    *script(n, inc) {
      n.perm = n.perm | P.EMERG;
      if (!(yield* N.go(n, S.emergencyIn.x, S.emergencyIn.y + 16, { arrive: 12 }))) return;
      const door = M.door('emergency');
      door.target = 1;
      LC.G.emergencyOpen = true;
      LC.sfx('alarmDoor', door.cx, door.cy);
      inc.data.pos = { x: door.cx, y: door.cy + 30 };
      n.act = 'wave';
      N.shout(n, U.pick(['GUYS! IN! QUICK!', 'Go go go go!', "It's open! Nobody's looking!"]));
      // friends pile in
      const k = U.randi(2, 4);
      inc.data.sneakers = [];
      for (let i = 0; i < k; i++) {
        const f = N.create({ x: S.emergencyOut.x + U.rand(-40, 40), y: S.emergencyOut.y - U.rand(0, 40), perm: P.PUB | P.OUT | P.EMERG, state: 'sneaking', extra: { wristband: false } });
        f.flags.noWristband = true; f.look.wristband = false;
        f.incident = inc; inc.others.push(f); inc.data.sneakers.push(f);
        N.setTask(f, (function* () {
          yield* N.wait(f, i * 0.7);
          yield* N.go(f, S.emergencyIn.x + U.rand(-20, 20), S.emergencyIn.y + 40, { perm: f.perm, arrive: 16 });
          f.perm = P.GUEST; f.state = 'inside';
          N.say(f, U.pick(['We are IN.', 'Free entry!', 'Act natural.']), { dim: true });
          f.incident = inc;
          yield* N.tDance(f);
        })(), 'sneak', 2);
      }
      LC.stat('sneakedIn', k);
      yield* N.wait(n, 3);
      n.act = null;
      n.perm = n.perm & ~P.EMERG;
      inc.n = null; n.incident = null;
      inc.data.opener = n;
    },
    update(inc, dt) {
      const door = M.door('emergency');
      if (door.target > 0.5 && Math.random() < dt * 0.9) LC.sfx('alarmBeep', door.cx, door.cy);
      if (door.target > 0.5) { inc.data.openT = (inc.data.openT || 0) + dt; if (inc.data.openT > 70 && !inc.data.neighbours) { inc.data.neighbours = true; LC.Radio.say('marcus', 'Neighbours are complaining. Somebody closed the fire exit yet?'); LC.stat('customerComplaints', 2); } }
    },
    onEmergency(inc, open) {
      if (open) return;
      LC.G.emergencyOpen = false;
      const left = (inc.data.sneakers || []).filter((f) => !f.gone && f.state === 'inside');
      I.resolve(inc, 'closed', left.length ? 'Door closed. ' + left.length + ' of them got in, though. No wristbands.' : 'Door closed. Nobody got in. Somehow.');
      if (left.length) {
        const sub = I.emergent('freeloaders', left[0], { crew: left });
        if (sub) { for (const f of left) { f.incident = sub; } sub.others = left.slice(1); I.notice(sub, 'sight'); }
      }
    },
    talk: () => ({ open: ['Who, me?', 'It was open when I got here.'], opts: [{ text: 'Close that door.', tag: 'WARN' }] }),
    resolved: { any: ['Door closed.'] },
    failed: ['The fire exit stayed open all night. The neighbours have opinions.'],
  };
  D.freeloaders = {
    title: "THEY DIDN'T PAY",
    timeout: 300, sub: 'No wristbands. Find them and walk them out.', brief: 'no wristband',
    sev: 1, noticeR: 300,
    update(inc) {
      const left = inc.data.crew.filter((f) => !f.gone && f.state === 'inside');
      if (!left.length) I.resolve(inc, 'eject', 'All of them are back outside, where they came from.');
      else if (!left.includes(inc.n)) { inc.n = left[0]; }
    },
    talk: () => ({ open: ['Wristband? It\'s... in my other hand.', 'I paid! In my heart.'], opts: [{ text: 'Wristband.', tag: 'WARN', fn: (inc, ctx) => N.say(ctx.n, "It's... invisible.", { pri: 3 }) }, { text: "You didn't pay. You're leaving.", tag: 'OUT' }] }),
    resolved: { any: ['Freeloaders removed.'] },
    failed: ['Partied all night on a fire exit.'],
    onGone(inc) { const left = inc.data.crew.filter((f) => !f.gone && f.state === 'inside'); if (!left.length) I.resolve(inc, 'eject', 'All out.'); else inc.n = left[0]; },
  };

  /* ================= THE SMOKING AREA IS LITERALLY RIGHT THERE ================= */
  D.smokeIndoors = {
    title: 'THE SMOKING AREA IS LITERALLY RIGHT THERE', sub: 'Someone is smoking inside.', brief: 'smoking indoors',
    sev: 2, min: 90, weight: 0.9, cooldown: 180, noticeR: 360,
    cand: (n) => (free(n) && n.smoker && drunk(n) > 0.35 && N.cs(n) < 0.55 && M.isInside(n.x, n.y) ? 1 + n.needs.smoke : 0),
    *script(n, inc) {
      const spots = [['mens', 0.35], ['bar', 1], ['lounge', 1], ['hall', 1], ['womens', 0.3], ['dance', 0.5]];
      const r = U.weighted(spots, (s) => s[1])[0];
      const p = M.randomPoint(r, n.perm);
      if (p && !(yield* N.go(n, p.x, p.y, { arrive: 16 }))) return;
      n.act = 'smoke'; n.smoking = true;
      N.say(n, U.pick(['Just a quick one.', 'Nobody will notice.', "It's basically outside in here."]), { dim: true });
      const ok = yield* hold(n, inc, U.rand(30, 45), (t) => {
        if (Math.random() < G().dt * 1.4) Wd.part('smoke', n.x + 6, n.y, { z: 34, vx: U.rand(-6, 6), size: 1.3 });
        if (Math.random() < G().dt * 0.1) { const b = Ph.query(n.x, n.y, 70, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n)[0]; if (b && !b.ent.override) { N.say(b.ent, U.pick(['*cough*', 'Are you SMOKING in here?', 'Seriously?']), { dim: true }); LC.stat('customerComplaints'); } }
      });
      if (!ok) return;
      const bath = M.inRoom(n.x, n.y, 'mens') || M.inRoom(n.x, n.y, 'womens');
      if ((bath || Math.random() < 0.2) && LC.Events) LC.Events.fireAlarm(bath ? 'someone smoking in the toilets' : 'someone smoking by the bar');
      I.fail(inc, 'alarm');
    },
    cleanup(n) { n.smoking = false; n.act = null; },
    talk: () => ({
      open: ["It's a vape. It's basically air.", "I'm not smoking, I'm breathing aggressively.", 'Quick one. Promise.'],
      opts: [{ text: 'The smoking area is literally right there.', tag: 'SNARK', yes: ['...it is right there. Okay.'] }, { text: 'Put it out.', tag: 'WARN' }, { text: 'Outside. Take it outside.', tag: 'CALM' }, { text: 'Out. As in the door.', tag: 'OUT' }],
    }),
    comply(inc) { const n = inc.n; n.smoking = false; N.setTask(n, N.tSmoke(n), 'smoke'); I.resolve(inc, 'talk'); },
    stare: { t1: 0.9, t2: 2, t3: 3.2, l1: ['...'], l2: ['...*stubs it out on their own shoe*'], backDown: (inc, n) => { n.smoking = false; } },
    resolved: { any: ['Taken outside. Like a normal person.'], stare: ['Stubbed it out on their own shoe. Still counts.'], eject: ['Ejected. Took the smell with them.'] },
    failed: ['The smoke detector has an opinion.'],
  };

  /* ================= ridiculous seats ================= */
  const SEATS = {
    flamingo: { title: 'THE FLAMINGO IS NOT A HORSE', open: ['Giddy up!', 'HYAH!', "I'm a cowboy!", 'Look at me! I\'m majestic!'] },
    sink: { title: 'THE SINK IS NOT A SEAT', open: ["It's a chair with a tap.", 'Very clean seat. Wet, though.'] },
    coatcounter: { title: 'THE COAT CHECK IS FOR COATS', open: ["I'm a coat. Check me.", 'Is there a ticket for me?'] },
    djedge: { title: 'THAT IS ALSO NOT A CHAIR', open: ['Best view in the house!', 'I can see the DJ\'s bald spot.'] },
    viptable: { title: 'THE TABLE IS FOR BOTTLES, NOT BOTTOMS', open: ["I'm VIP. And a table.", 'This table is so comfy.'] },
    kebabvan: { title: 'GET OFF THE KEBAB VAN', open: ['I LIVE UP HERE NOW', 'The kebab is coming from INSIDE the van!'] },
    podium: { title: 'THE PODIUM IS NOT A THRONE', open: ['I am the door now.', 'ID please! Ha! Just kidding. Unless?'] },
    car: { title: "THAT'S NOT EVEN YOUR CAR", open: ["It's my friend's car. I don't know which friend.", 'Great seat.'] },
  };
  D.weirdSeat = {
    title: (inc) => (inc.data.spot && SEATS[inc.data.spot.kind] ? SEATS[inc.data.spot.kind].title : 'THAT IS NOT A SEAT'), sub: 'Someone is sitting somewhere completely ridiculous.', brief: 'sitting somewhere ridiculous',
    sev: 1, min: 100, weight: 1.2, cooldown: 110, noticeR: 440,
    cand: (n) => (free(n) && drunk(n) > 0.35 && N.cs(n) < 0.5 ? 1 : 0),
    setup(inc) {
      const n = inc.n;
      const opts = S.weird.filter((w) => w.kind !== 'speaker' && w.kind !== 'bench' && SEATS[w.kind] && !w.taken && (!w.vipOnly || n.vip || Math.random() < 0.3));
      if (!opts.length) return false;
      const w = U.pick(opts);
      w.taken = true; inc.data.spot = w;
      inc.title = SEATS[w.kind].title;
    },
    *script(n, inc) {
      const s = inc.data.spot;
      const perm = s.vipOnly ? n.perm | P.VIP : s.kind === 'kebabvan' || s.kind === 'car' || s.kind === 'podium' ? n.perm | P.OUT : n.perm;
      if (!(yield* N.go(n, s.x, s.y + 20, { perm, arrive: 16 }))) return;
      yield* sitOnSpot(n, s, s.z);
      if (s.kind === 'flamingo') { n.act = 'sit'; N.shout(n, 'YEEHAW!'); }
      const ok = yield* hold(n, inc, U.rand(55, 90), (t) => {
        if (s.kind === 'flamingo') { n.body.x = s.x + Math.sin(t * 6) * 2; n.z = s.z + Math.abs(Math.sin(t * 6)) * 3; }
        if (s.kind === 'sink' && Math.random() < G().dt * 0.4) Wd.addMess('water', s.x - 14 + U.rand(-6, 6), s.y + U.rand(-6, 10), { r: 10 });
        if (Math.random() < G().dt * 0.08) N.say(n, U.pick(SEATS[s.kind].open), { dim: true });
      });
      if (!ok) return;
      if (s.kind === 'flamingo') {
        M.flamingo.tipped = true;
        LC.stat('clubDamage', 1200);
        LC.stat('brokenFurniture');
        LC.Radio.say('petrakis', U.pick(['WHAT HAPPENED TO MY FLAMINGO?', 'Somebody tell me the flamingo is fine.']));
        yield* fall(n, inc, { lines: ['WHOA— NOT THE NECK', 'CRACK?'] });
        return;
      }
      if (s.kind === 'coatcounter') for (let i = 0; i < 3; i++) Wd.addItem('jacket', s.x + U.rand(-20, 20), s.y + U.rand(6, 24), { c: [U.randi(20, 200), U.randi(20, 200), U.randi(20, 200)] });
      I.fail(inc, 'sat');
      climbDownLater(n);
    },
    cleanup(n, inc) { inc.data.spot.taken = false; if (!inc.data.fell) climbDownLater(n); },
    talk(inc) {
      const s = inc.data.spot;
      const o = [
        { text: 'Off.', tag: 'WARN' },
        { text: s.kind === 'flamingo' ? 'That flamingo is worth more than your car.' : 'Comfortable?', tag: 'SNARK', yes: s.kind === 'flamingo' ? ['...is it?', 'Okay getting off the expensive bird.'] : ['...no. Not really.'] },
        { text: s.kind === 'flamingo' ? 'Please get off the bird.' : 'Find a real chair. They have legs.', tag: 'CALM' },
      ];
      if (s.kind === 'flamingo') o.push({ text: "You're leaving.", tag: 'OUT', fn: (inc2) => { const n = inc2.n; LC.Dialogue.seq(n, [['npc', 'For what?!'], ['you', 'You attempted to ride the decorative flamingo.'], ['npc', "It's literally built like a horse."]], () => { climbDownLater(n); setTimeout(() => LC.Dialogue.eject(n), 1300); }); } });
      else o.push({ text: 'Off. And out.', tag: 'OUT', pre: (inc2) => climbDownLater(inc2.n) });
      return { open: SEATS[s.kind].open, opts: o };
    },
    stare: { t1: 1, t2: 2.1, t3: 3.4, l1: ['...'], l2: ['...this isn\'t a seat, is it.'] },
    resolved: { any: ['Returned to an actual chair.'], eject: ['Walked out. The seat is free for nobody.'] },
    failed: (inc) => (inc.data.spot.kind === 'flamingo' ? 'The flamingo has fallen. Management is inconsolable.' : 'They sat there so long it became their seat.'),
  };

  /* ================= "...mine?" ================= */
  D.stoolCarry = {
    title: 'WHERE ARE YOU GOING WITH THAT?', sub: 'Someone is walking off with a bar stool.', brief: 'carrying a bar stool',
    sev: 1, min: 120, weight: 1, cooldown: 160, noticeR: 400,
    cand: (n) => (free(n) && N.cs(n) < 0.45 && drunk(n) > 0.4 && inRooms(n, 'bar', 'hall', 'dance') ? 1 : 0),
    setup(inc) {
      const st = Wd.nearestProp(inc.n.x, inc.n.y, 500, (q) => q.kind === 'stool' && !q.occ && !q.carriedBy && !q.fallen && !q.claimed);
      if (!st) return false;
      st.claimed = true; inc.data.stool = st;
    },
    *script(n, inc) {
      const st = inc.data.stool;
      if (!(yield* N.go(n, st.body.x, st.body.y + 12, { arrive: 14 }))) return;
      if (st.carriedBy || st.occ) return;
      N.pickUp(n, st);
      n.act = 'carry';
      n.perm = n.perm | P.OUT;
      const exit = S.exits[U.randi(0, 1)];
      N.goTo(n, exit.x, exit.y, { perm: n.perm, speed: n.speed * 0.9, arrive: 30, timeout: 140 });
      for (;;) {
        if (!I.alive(inc, n) || n.carry !== st) return;
        whistle(n);
        if (n.nav.status === 'failed' || n.nav.status === 'idle') N.goTo(n, exit.x, exit.y, { perm: n.perm, arrive: 30 });
        if (n.nav.status === 'arrived') break;
        yield;
      }
      Wd.removeProp(st); n.carry = null;
      LC.stat('stolenLost');
      LC.stat('clubDamage', 60);
      I.fail(inc, 'stolen');
      N.setTask(n, N.tLeave(n, { noCoat: true, exit }), 'leave');
    },
    cleanup(n, inc) { inc.data.stool.claimed = false; },
    onPropTaken(inc, pr) { if (pr === inc.data.stool && inc.state === 'active') { LC.stat('stolenRecovered'); I.resolve(inc, 'grab'); } },
    onGone(inc) { I.drop(inc); },
    talk: () => ({
      open: ["It's mine.", "I'm taking it home to meet my parents.", 'Found it.', 'I needed a stool for the bus.'],
      opts: [
        { text: '...mine?', tag: 'SNARK', say: '...yours?', yes: ['...no. Not mine.'] },
        { text: 'Put the stool down.', tag: 'WARN' },
        { text: 'The stool lives here.', tag: 'CALM', yes: ['...it does look at home here.'] },
        { text: 'You and the stool: out. Only you.', tag: 'OUT' },
      ],
    }),
    comply(inc) { const n = inc.n; if (n.carry) N.drop(n); LC.stat('stolenRecovered'); I.resolve(inc, 'talk'); },
    stare: {
      t1: 0.6, t2: 1.9, t3: 3.4, l1: ['...'], l2: ['...mine?'],
      look: (inc, n) => n.face + 0.9,
      resume: ['*walks faster*'],
      backDown: (inc, n) => { if (n.carry) N.drop(n); LC.stat('stolenRecovered'); },
    },
    resolved: { any: ['The stool stays.'], stare: ['Put the stool down. Walked away. Nobody spoke.'], eject: ['The stool stays. They go.'] },
    failed: ['The stool has left the building. It had a whole life here.'],
  };

  /* ================= the jacket and the vodka ================= */
  D.vodkaJacket = {
    title: 'WHY IS THAT JACKET FULL OF VODKA?', sub: 'Keep looking.', brief: 'pouring vodka into a jacket',
    sev: 0.5, min: 90, weight: 0.8, cooldown: 200, noticeR: 230, noticeT: 1.2, stareOnly: true,
    cand: (n) => (free(n) && N.cs(n) < 0.6 && inRooms(n, 'bar', 'hall', 'lounge') ? 1 : 0),
    *script(n, inc) {
      const tb = Wd.nearestProp(n.x, n.y, 400, (q) => q.kind === 'table' && !q.fallen);
      if (tb) yield* N.go(n, tb.body.x + 18, tb.body.y + 8, { arrive: 12 });
      n.bottle = true; n.act = 'hold';
      N.faceTo(n, n.x, n.y + 50);
      const ok = yield* hold(n, inc, U.rand(22, 36), () => {
        if (Math.random() < G().dt * 6) Wd.part('drop', n.x + 3, n.y - 20, { z: 0, vx: -12, vy: 4, vz: -10, c: [220, 235, 245] });
        if (Math.random() < G().dt * 0.4) n.face = n.face + U.rand(-0.4, 0.4);
      });
      n.bottle = false;
      if (!ok) return;
      n.flags.vodkaJacket = true;
      LC.stat('undetectedJacketVodka');
      I.drop(inc);
    },
    cleanup(n) { n.bottle = false; },
    stare: {
      r: 240, t1: 0.8, t2: 2.2, t3: 3.8, l1: [''], l2: [''],
      backDown: (inc, n) => {
        // slowly pours it back. No dialogue needed.
        N.cancelTask(n);
        N.interrupt(n, (function* () {
          n.bottle = true; n.act = 'hold'; n.exprLock = true; n.expr = 'embarrassed';
          let t = 0;
          while (t < 2.4) { t += G().dt; if (Math.random() < G().dt * 8) Wd.part('drop', n.x + 2, n.y - 14, { z: 0, vx: 10, vy: -4, vz: 30, c: [220, 235, 245] }); yield; }
          n.bottle = false; n.exprLock = false;
          yield* N.wait(n, 0.6);
        })(), 'pourBack', 7);
        LC.stat('vodkaReturned');
      },
    },
    resolved: { stare: ['Poured it back. No words were exchanged.'] },
  };

  /* ================= THE SIGN IS NOT A HAT ================= */
  D.signThief = {
    title: 'THE WET FLOOR SIGN IS NOT A HAT',
    timeout: 220, sub: 'Someone stole your sign.', brief: 'wearing your wet floor sign',
    sev: 1, min: 150, weight: 0.8, cooldown: 240, noticeR: 440,
    cand: (n) => (free(n) && drunk(n) > 0.45 && N.cs(n) < 0.4 && Wd.props.some((p) => p.kind === 'sign' && !p.worn && !p.carriedBy && U.dist(n.x, n.y, p.body.x, p.body.y) < 500) ? 1 : 0),
    setup(inc) {
      const s = Wd.nearestProp(inc.n.x, inc.n.y, 500, (p) => p.kind === 'sign' && !p.worn && !p.carriedBy);
      if (!s) return false;
      inc.data.sign = s;
    },
    *script(n, inc) {
      const s = inc.data.sign;
      if (!(yield* N.go(n, s.body.x, s.body.y + 12, { arrive: 14 }))) return;
      if (s.carriedBy || s.worn) return;
      Wd.wear(s, n, 'sign');
      N.say(n, U.pick(['New hat!', 'I am CAUTION.', 'Warning: WET. Me. I\'m the wet floor.']), { pri: 1 });
      while (I.alive(inc, n)) { yield* N.tDance(n); if (!I.alive(inc, n)) return; yield* N.tWander(n); }
    },
    talk: () => ({ open: ["I'm a hazard now.", 'Caution! Me!', 'Does it suit me?'], opts: [{ text: 'Give me the sign.', tag: 'WARN' }, { text: 'It suits you. Give it back.', tag: 'SNARK', bonus: 0.15 }, { text: 'People are slipping without that.', tag: 'CALM' }, { text: 'Out. Leave the sign.', tag: 'OUT' }] }),
    comply(inc) { const s = inc.data.sign; if (s.worn) { Wd.unwear(s); Wd.removeProp(s); LC.G.player.inv.sign++; } I.resolve(inc, 'talk'); },
    onPropTaken(inc, pr) { if (pr === inc.data.sign && inc.state === 'active') I.resolve(inc, 'grab'); },
    stare: { t1: 1, t2: 2.2, t3: 3.5, l1: ['...'], l2: ['...is this yours?'], backDown: (inc) => { const s = inc.data.sign; if (s.worn) Wd.unwear(s); } },
    resolved: { any: ['Sign recovered. It has seen things.'], eject: ['Ejected. The sign stays. The sign always stays.'] },
    failed: ['The sign went home with someone.'],
    onGone(inc) { const s = inc.data.sign; if (s && s.worn) Wd.unwear(s); I.drop(inc); },
  };

  /* ================= lost property quests ================= */
  D.lostShoe = {
    title: 'CINDERELLA HAS LOST A SHOE',
    timeout: 320, sub: 'One shoe on. One shoe somewhere.', brief: 'one shoe short',
    sev: 0.5, min: 300, weight: 0.8, cooldown: 400, noticeR: 260, noticeT: 1,
    cand: (n) => (free(n) && drunk(n) > 0.5 && n.fem ? 1 : free(n) && drunk(n) > 0.6 ? 0.5 : 0),
    setup(inc) {
      const n = inc.n;
      n.lostShoe = true;
      const p = M.randomPoint(U.pick(['dance', 'dance', 'lounge', 'hall', 'patio', 'womens']), P.GUEST) || { x: n.x + 60, y: n.y };
      const it = Wd.addItem('shoe', p.x, p.y, { owner: n.id, c: U.hex(n.look.shoes.length === 4 ? '#111111' : n.look.shoes) });
      inc.data.item = it;
      n.lost = { kind: 'shoe', item: it, inc };
    },
    *script(n, inc) {
      while (I.alive(inc, n)) {
        const p = M.randomPoint(U.pick(['dance', 'hall', 'bar', 'lounge']), n.perm);
        if (p) yield* N.go(n, p.x, p.y, { arrive: 16, speed: n.speed * 0.7 });
        if (Math.random() < 0.6) { N.say(n, U.pick(['Has anyone seen a shoe?', 'SHOE. I need my SHOE.', "It's like this one but LEFT."]), { pri: 1 }); }
        yield* N.wait(n, U.rand(3, 6));
      }
    },
    resolved: { any: ['Reunited with the shoe. Cinderella can go home.'], lostfound: ['Shoe handed in. She\'ll find it. Eventually.'] },
    failed: ['One shoe went home. One shoe stayed.'],
    onGone(inc) { I.drop(inc); },
  };
  D.lostFriend = {
    title: 'HAVE YOU SEEN DAVE?',
    timeout: 320, sub: "Somebody's lost their friend.", brief: 'looking for Dave',
    sev: 0.5, min: 280, weight: 0.8, cooldown: 400, noticeR: 260, noticeT: 1,
    cand: (n) => (free(n) && n.group && n.group.members.filter((m) => !m.gone && m.state === 'inside').length >= 2 ? 1 : 0),
    setup(inc) {
      const n = inc.n;
      const f = n.group.members.find((m) => m !== n && !m.gone && m.state === 'inside' && !m.incident && !m.override);
      if (!f) return false;
      inc.data.friend = f;
      f.lostFriendOf = n;
      n.lost = { kind: 'friend', friend: f, inc };
      inc.title = 'HAVE YOU SEEN ' + f.name.toUpperCase() + '?';
      // the friend is somewhere daft
      const where = U.pick([['chill', 'seat'], ['kitchen', 'floor'], ['parking', 'floor'], ['lounge', 'seat'], ['patio', 'floor']]);
      inc.data.where = where[0];
      N.setTask(f, (function* () {
        const perm = f.perm | (where[0] === 'kitchen' ? P.STAFF : 0) | P.OUT;
        const p = M.randomPoint(where[0], perm);
        if (p) yield* N.go(f, p.x, p.y, { perm, arrive: 16 });
        f.sob = Math.min(f.sob, 0.12);
        LC.Director.sleeper(f, where[1], true);
      })(), 'wander', 2);
    },
    *script(n, inc) {
      const f = inc.data.friend;
      while (I.alive(inc, n)) {
        const p = M.randomPoint(U.pick(['dance', 'hall', 'bar', 'lounge', 'lobby']), n.perm);
        if (p) yield* N.go(n, p.x, p.y, { arrive: 16 });
        N.say(n, U.pick(['Has anyone seen ' + f.name + '?', f.name.toUpperCase() + '?!', "He's got a face. Hair. Have you seen him?"]), { pri: 1 });
        yield* N.wait(n, U.rand(3, 6));
      }
    },
    resolved: { any: (inc) => 'Reunited. ' + inc.data.friend.name + ' was in the ' + (M.room(inc.data.where) ? M.room(inc.data.where).name.toLowerCase() : 'building') + '. Nobody knows why.' },
    failed: ['Went home without their friend. The friend is still here.'],
    onGone(inc) { I.drop(inc); },
  };

  /* ================= hide and seek (closing) ================= */
  D.hider = {
    title: 'HIDE AND SEEK CHAMPION', sub: 'Someone does not want to go home.', brief: 'hiding',
    sev: 1, weight: 0, noticeR: 200, dark: true,
    *script(n, inc) {
      const spot = U.pick(S.hide);
      yield* N.go(n, spot.x, spot.y, { perm: SNEAK, hurry: true, arrive: 10 });
      n.act = 'crouch'; n.hiding = true;
      while (I.alive(inc, n)) { if (Math.random() < G().dt * 0.04) N.say(n, U.pick(['shhh', '...', 'I am a coat.']), { dim: true }); yield; }
    },
    cleanup(n) { n.hiding = false; n.act = null; },
    talk: () => ({ open: ['...I am not here.', 'You found me! Two more minutes!', 'Shh! Hiding!'], opts: [{ text: 'Found you. Out.', tag: 'OUT' }, { text: "It's four in the morning.", tag: 'SNARK', fn: (inc) => { N.say(inc.n, 'Time is a construct.', { pri: 3 }); } }, { text: "Come on. Home time.", tag: 'CALM', fn: (inc) => { if (LC.Dialogue.attempt(inc.n, 'CALM', 0.3)) { N.say(inc.n, 'Fiiiine.', { pri: 3 }); I.resolve(inc, 'talk'); N.setTask(inc.n, N.tLeave(inc.n), 'leave'); } else N.say(inc.n, 'NEVER', { pri: 3 }); } }] }),
    resolved: { any: ['Found. Evicted. Game over.'] },
    failed: ['Still hiding. The cleaners will find them.'],
  };

  // what the director may start on its own

  /* ================= couples ================= */
  const KISS_SPOTS = () => [
    { x: S.emergencyIn.x, y: S.emergencyIn.y + 10, where: 'against the fire exit' },
    { x: S.coat.x + 30, y: S.coat.y, where: 'in front of the coat check' },
    { x: S.inside.x, y: S.inside.y - 20, where: 'in the middle of the entrance' },
    { x: M.flamingo.cx + 30, y: M.flamingo.cy + 20, where: 'on the flamingo' },
    { x: S.djTouch.x, y: S.djTouch.y, where: 'in the DJ booth' },
    { x: S.vipIn.x + 20, y: S.vipIn.y, where: 'in the VIP doorway' },
    { x: 13 * T, y: 29.5 * T, where: "outside the men's" },
  ];
  function partnerFor(n) {
    const g = n.group;
    const list = (g ? g.members : LC.G.npcs).filter((o) => o !== n && free(o) && U.dist(n.x, n.y, o.x, o.y) < 500);
    return list.length ? U.pick(list) : null;
  }
  D.kissing = {
    title: () => U.pick(['GET A ROOM. NOT THIS ONE.', 'PUBLIC DISPLAY OF AFFECTION, EXTREMELY PUBLIC', 'THEY HAVE BEEN KISSING FOR NINE MINUTES']),
    sub: 'Two people are making out somewhere deeply inconvenient.', brief: 'snogging in the way',
    sev: 1, min: 70, weight: 1.1, cooldown: 140, noticeR: 420, timeout: 170,
    cand: (n) => (free(n) && drunk(n) > 0.35 ? 1 : 0),
    setup(inc) {
      const b = partnerFor(inc.n);
      if (!b) return false;
      inc.others.push(b); b.incident = inc;
      inc.data.b = b;
      const sp = U.pick(KISS_SPOTS());
      inc.data.spot = sp;
      inc.sub = 'Two people are making out ' + sp.where + '.';
      inc.n.couple = b.couple = { on: true };
    },
    *script(n, inc) {
      const b = inc.data.b, sp = inc.data.spot;
      const perm = P.ALL;
      N.setTask(b, (function* () { yield* N.go(b, sp.x + 14, sp.y, { perm, arrive: 10 }); while (I.alive(inc, b) && inc.state === 'active') { b.act = 'kiss'; N.faceTo(b, n.x, n.y); b.exprLock = true; b.expr = 'kiss'; yield; } b.exprLock = false; })(), 'inc:kissing', 3);
      if (!(yield* N.go(n, sp.x - 14, sp.y, { perm, arrive: 10 }))) return;
      let t = 0;
      while (I.alive(inc, n) && !b.gone) {
        t += G().dt;
        n.act = 'kiss'; N.faceTo(n, b.x, b.y); n.exprLock = true; n.expr = 'kiss';
        if (Math.random() < G().dt * 1.2) Wd.part('heart', (n.x + b.x) / 2, n.y, { z: 46, vx: U.rand(-10, 10), vy: U.rand(-6, 6) });
        if (Math.random() < G().dt * 0.08) { LC.stat('customerComplaints'); const w = LC.G.npcs.find((o) => o.kind === 'guest' && !o.override && o !== n && o !== b && U.dist(o.x, o.y, n.x, n.y) < 120); if (w) N.say(w, U.pick(['Oh come ON.', 'Some of us are trying to get past.', 'Ew. Romantic, but ew.', 'I can hear it. I can HEAR it.']), { pri: 1 }); }
        if (b.escorted || n.escorted) { I.resolve(inc, 'separate', 'Separated. The romance can continue at a bus stop.'); return; }
        yield;
      }
    },
    cleanup(n, inc) { n.exprLock = false; n.couple = null; const b = inc.data.b; if (b && !b.gone) { b.exprLock = false; b.couple = null; if (b.taskName === 'inc:kissing') N.cancelTask(b); } },
    talk: () => ({
      open: ['Mmmf?', "We're in LOVE.", 'Do you MIND?', 'We met forty minutes ago.'],
      opts: [
        { text: 'Get a room.', tag: 'SNARK', yes: ['We HAVE a room. This one.', '...fine. Ugh.'] },
        { text: 'Not here. Move along.', tag: 'WARN' },
        { text: "You're blocking the fire exit. And my will to live.", tag: 'SNARK', yes: ['...that is fair.'] },
        { text: 'Out. Both of you.', tag: 'OUT' },
      ],
    }),
    stare: { t1: 0.7, t2: 1.8, t3: 3.0, l1: ['...'], l2: ["...he's staring.", 'Is he WATCHING us?'], look: (inc, n) => n.face + Math.PI, resume: ['*resumes kissing*'] },
    resolved: { any: ['Separated. Love will find a less stupid place.'], stare: ['Stared at them until it got weird. It worked.'], eject: ['Thrown out together. Romantic, in a way.'] },
    failed: ['Still at it. Management has asked if they are part of the decor.'],
  };

  D.breakup = {
    title: (inc) => U.pick(["IT'S OVER, " + inc.n.name.toUpperCase(), 'A BREAKUP. LIVE. ON THE DANCE FLOOR.', 'THEY ARE BREAKING UP AND EVERYONE IS WATCHING']),
    sub: 'A couple is breaking up very loudly. Drinks are at risk.', brief: 'breaking up loudly',
    sev: 2, min: 110, weight: 0.9, cooldown: 200, noticeR: 520, timeout: 120,
    cand: (n) => (free(n) && drunk(n) > 0.4 && n.mood ? 1 : 0),
    setup(inc) {
      const b = partnerFor(inc.n);
      if (!b) return false;
      inc.others.push(b); b.incident = inc; inc.data.b = b;
    },
    *script(n, inc) {
      const b = inc.data.b;
      const A = ['You LIKED her post.', 'You said you were at your MUM\'S.', 'This is about the fish, isn\'t it?', 'I CANNOT do this anymore.', 'You ALWAYS do this.', 'I gave you the GOOD seat at the cinema!'];
      const B2 = ['It was ONE like!', 'Are we doing this HERE?', 'Can we not do this in a nightclub?', 'Fine! FINE!', "I'm not crying, YOU'RE crying."];
      N.setTask(b, (function* () { while (I.alive(inc, b) && inc.state === 'active') { b.act = 'argue'; N.faceTo(b, n.x, n.y); yield; } })(), 'inc:breakup', 3);
      let t = 0, lt = 0.5, thrown = false;
      while (I.alive(inc, n) && !b.gone) {
        t += G().dt; lt -= G().dt;
        if (U.dist(n.x, n.y, b.x, b.y) > 40) N.goTo(n, b.x, b.y + 20, { arrive: 26 }); else { N.stop(n); N.faceTo(n, b.x, b.y); }
        n.act = t > 25 ? 'cry' : 'argue';
        n.exprLock = true; n.expr = t > 25 ? 'cry' : 'furious';
        if (lt < 0) { lt = U.rand(2.4, 4); if (Math.random() < 0.55) N.shout(n, U.pick(A)); else N.shout(b, U.pick(B2)); }
        if (!thrown && t > 18 && n.drink) { thrown = true; N.spillDrink(n, Math.atan2(b.y - n.y, b.x - n.x), 1); N.shout(b, 'MY HAIR!'); LC.Social.noise(b.x, b.y, 'glass', 1); }
        if (Math.random() < G().dt * 0.3) { const w = LC.G.npcs.find((o) => o.kind === 'guest' && !o.override && o !== n && o !== b && U.dist(o.x, o.y, n.x, n.y) < 160); if (w) { N.faceTo(w, n.x, n.y); N.say(w, U.pick(['Oh this is GOOD.', 'Is someone filming?', '*eats popcorn that came from nowhere*', 'Team her.', 'Team him.']), { pri: 1 }); } }
        if (b.escorted || n.escorted) { I.resolve(inc, 'separate', 'Walked one of them away. Both are texting their friends about you.'); return; }
        yield;
      }
    },
    cleanup(n, inc) { n.exprLock = false; const b = inc.data.b; if (b && !b.gone && b.taskName === 'inc:breakup') N.cancelTask(b); },
    onTimeout(inc) { const n = inc.n; I.fail(inc, 'timeout', 'One of them is now crying in the toilets. For the rest of the night.'); if (n && !n.gone) { N.setTask(n, N.tPee(n), 'pee'); n.flags.crying = true; } },
    talk: () => ({
      open: ['STAY OUT OF THIS.', 'Tell him he is WRONG.', 'Whose side are you on?!', 'Do you think it was ONE like?'],
      opts: [
        { text: 'Take a minute. Separately.', tag: 'CALM', yes: ['...yeah. Yeah. Okay.', 'I need a drink. Water. Fine.'] },
        { text: 'Maybe not on the dance floor?', tag: 'WARN' },
        { text: 'It was probably about the fish.', tag: 'SNARK', yes: ['...it WAS about the fish.'] },
        { text: 'Somebody is going home. Now.', tag: 'OUT' },
      ],
    }),
    resolved: { any: ['Separated. They will get back together on Tuesday.'], eject: ['One of them left. The other one is fine. Mostly.'] },
    failed: ['Nobody stepped in. It got worse. It always gets worse.'],
  };

  /* ================= groups that turn up looking for trouble ================= */
  D.gang = {
    title: () => U.pick(['THE LADS HAVE ARRIVED', 'THEY SAY THEY RUN THIS BLOCK', 'SIX MEN IN MATCHING TRACKSUITS']),
    sub: 'A rowdy crew skipped the queue and wants free drinks.', brief: 'running the gang',
    sev: 3, min: 0, weight: 0, noticeR: 600, timeout: 160, loud: true,
    *script(n, inc) {
      const crew = inc.data.crew;
      const bar = U.pick(S.bar);
      for (const m of crew) if (m !== n) N.setTask(m, (function* () { while (I.alive(inc, n) && !m.gone) { if (U.dist(m.x, m.y, n.x, n.y) > 50) N.goTo(m, n.x + U.rand(-40, 40), n.y + U.rand(-30, 30), { arrive: 20 }); else { m.act = 'crossed'; N.faceTo(m, n.x, n.y + 60); } if (Math.random() < G().dt * 0.12) N.shout(m, U.pick(['WE RUN THIS.', 'Whose club? OUR club.', 'Big Mike says hello.', 'You looking at me?', 'Free drinks or what?'])); yield; } })(), 'inc:gang', 3);
      yield* N.go(n, bar.x, bar.y + 30, { arrive: 20 });
      let t = 0;
      while (I.alive(inc, n)) {
        t += G().dt;
        n.act = 'argue'; N.faceTo(n, bar.x, bar.y - 60);
        if (Math.random() < G().dt * 0.25) N.shout(n, U.pick(["Put it on Big Mike's tab.", 'There is no tab? There is NOW.', 'Six shots. On the house. We ARE the house.', 'Do you know who I am? Neither do I. But FEAR it.']));
        if (Math.random() < G().dt * 0.05 && LC.Director.allow('argument')) { const v = LC.G.npcs.find((o) => free(o) && U.dist(o.x, o.y, n.x, n.y) < 160); const m = U.pick(crew.filter((q) => !q.gone && q !== n)); if (v && m) LC.Social.startArgument(m, v, 'bump'); }
        if (Math.random() < G().dt * 0.1) LC.stat('customerComplaints');
        yield;
      }
    },
    onTimeout(inc) { I.fail(inc, 'took over', 'They took over the bar. Jolene served them out of fear. Management is "reviewing".'); for (const m of inc.data.crew) if (!m.gone && m.state === 'inside') N.setTask(m, N.tLeave(m, { noCoat: true }), 'leave'); LC.stat('clubDamage', 400); },
    onResolve(inc) { const left = inc.data.crew.filter((m) => !m.gone && m !== inc.n && m.state === 'inside'); left.forEach((m, i) => setTimeout(() => { if (!m.gone && m.state === 'inside') { N.say(m, U.pick(['This club is MID.', 'We were leaving anyway.', 'Wait for us, Mike!'] ), { pri: 2 }); N.setTask(m, N.tLeave(m, { noCoat: true }), 'leave'); } }, 600 + i * 500)); },
    talk: () => ({
      open: ['You must be new.', 'We know the owner. We ARE the owner. Spiritually.', 'Walk away, security.'],
      opts: [
        { text: 'You can leave, or you can leave quickly.', tag: 'WARN', bonus: -0.15 },
        { text: 'Big Mike? Is that because of your coat?', tag: 'SNARK', bonus: -0.1 },
        { text: "Drinks are for paying customers. You're neither.", tag: 'CALM', bonus: -0.2 },
        { text: 'Out. The lot of you.', tag: 'OUT' },
      ],
    }),
    comply(inc) { I.resolve(inc, 'talk', 'Big Mike backed down. In front of his whole crew. That is going to sting.'); const n = inc.n; if (n && !n.gone) N.setTask(n, N.tLeave(n, { noCoat: true }), 'leave'); },
    resolved: { any: ['The crew is gone. The bar staff exhale.'], eject: ['Big Mike thrown out. The crew followed him like ducklings.'] },
    failed: ['They ran the place for a bit. Nobody liked it.'],
  };
  D.teens = {
    title: () => U.pick(['THESE ARE CHILDREN', 'THEY ARE SEVENTEEN AT MOST', 'FOUR TEENAGERS IN A TRENCH COAT, BASICALLY']),
    sub: 'A gang of teenagers got in with terrible fake IDs.', brief: 'definitely not 18',
    sev: 2, min: 0, weight: 0, noticeR: 480, timeout: 170,
    *script(n, inc) {
      const crew = inc.data.crew;
      for (const m of crew) if (m !== n) N.setTask(m, (function* () { while (I.alive(inc, n) && !m.gone) { if (U.dist(m.x, m.y, n.x, n.y) > 46) N.goTo(m, n.x + U.rand(-36, 36), n.y + U.rand(-26, 26), { arrive: 18 }); else { m.act = Math.sin(LC.G.t + m.seed * 9) > 0 ? 'phone' : 'smoke'; m.phoneUp = m.act === 'phone'; m.filming = m.phoneUp; if (m.act === 'smoke' && Math.random() < G().dt * 2) Wd.part('vape', m.x + 6, m.y, { z: 44, size: 1.2 }); } if (Math.random() < G().dt * 0.1) N.say(m, U.pick(['This is SO sick.', 'Get me in the video!', 'Is that a real bouncer?', 'Act natural. ACT NATURAL.', 'My mum thinks I am at revision club.'])); yield; } m.phoneUp = false; m.filming = false; })(), 'inc:teens', 3);
      const bar = U.pick(S.bar);
      yield* N.go(n, bar.x, bar.y + 30, { arrive: 20 });
      while (I.alive(inc, n)) {
        n.act = 'argue'; N.faceTo(n, bar.x, bar.y - 60);
        if (Math.random() < G().dt * 0.22) N.say(n, U.pick(['Four Jägerbombs. We are eighteen. Combined, we are seventy-two.', 'I have a beard. Look. LOOK at it.', 'Can we get a drink with an umbrella in it?', "I'm literally an adult. I pay for Spotify."]), { pri: 2 });
        yield;
      }
    },
    onTimeout(inc) { I.fail(inc, 'served', 'Someone served them. Somebody\'s mum is going to ring the club. Tomorrow. At 8 AM.'); LC.stat('securityComplaints'); for (const m of inc.data.crew) if (!m.gone && m.state === 'inside') N.setTask(m, N.tLeave(m, { noCoat: true }), 'leave'); },
    onResolve(inc) { inc.data.crew.filter((m) => !m.gone && m !== inc.n && m.state === 'inside').forEach((m, i) => setTimeout(() => { if (!m.gone && m.state === 'inside') { N.say(m, U.pick(["I'm telling my MUM.", 'This is so unfair.', 'We were going anyway, this place is cringe.']), { pri: 2 }); N.setTask(m, N.tLeave(m, { noCoat: true }), 'leave'); } }, 500 + i * 400)); },
    talk: () => ({
      open: ['We are adults.', "Hello fellow adult.", "We're twenty-five. All of us.", 'Is this the over-18s?'],
      opts: [
        { text: 'What year were you born?', tag: 'SNARK', say: 'What year were you born? Quickly.', yes: ['...2009. I mean. 1990. Something.'] },
        { text: 'Your ID says your name is Adult Man.', tag: 'SNARK', yes: ['...it was ten pounds.'] },
        { text: 'Go home. Revise.', tag: 'WARN', bonus: 0.15 },
        { text: 'Out. Now. All of you.', tag: 'OUT' },
      ],
    }),
    comply(inc) { I.resolve(inc, 'talk', 'Sent home. They will tell everyone at school it was "mid".'); const n = inc.n; if (n && !n.gone) N.setTask(n, N.tLeave(n, { noCoat: true }), 'leave'); },
    resolved: { any: ['The children have left the building.'], eject: ['Walked out the leader. The rest followed, filming.'] },
    failed: ['They stayed. They were served. Nobody is proud of tonight.'],
  };

  I.SCHEDULED = ['kissing', 'breakup', 'speaker', 'cone', 'plant', 'dj', 'vipSneak', 'drinkThief', 'harasser', 'smokeIndoors', 'weirdSeat', 'stoolCarry', 'vodkaJacket', 'tableDance', 'barDance', 'chandelier', 'airbnb', 'bottleThief', 'extinguisher', 'emergency', 'stallClimb', 'wrecker', 'signThief', 'lostShoe', 'lostFriend'];
})();
