/* Last Call — the rare, ridiculous nights-within-the-night: birthday groups, a football team,
   a wedding afterparty, a stag do that loses the groom, a celebrity (probably), an influencer
   going live, forty shots, an inflatable crocodile, a proposal, an ex, the fire alarm, and a
   power cut. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd, Phys: Ph } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Ev = (LC.Events = {});
  const I = () => LC.Incidents;
  const G = () => LC.G;
  const D = LC.Incidents.defs;

  const WINDOWS = {
    birthday: [80, 200], influencer: [80, 300], crocodile: [230, 350], shots40: [170, 320], wedding: [110, 230], football: [140, 260],
    bachelor: [160, 280], celebrity: [180, 300], fireAlarm: [240, 350], powerOut: [260, 350], lostPhone: [200, 330], proposal: [210, 330], ex: [180, 330],
  };
  Ev.schedule = (night) => {
    const g = G();
    const pool = U.shuffle(night.pool.slice());
    g.events = pool.slice(0, night.events).map((type) => ({ type, at: U.rand(WINDOWS[type][0], WINDOWS[type][1]), done: false }));
    g.events.sort((a, b) => a.at - b.at);
  };
  Ev.update = (dt) => {
    const g = G();
    if (g.closing) { alarmTick(); powerTick(); return; }
    for (const e of g.events) {
      if (e.done || g.clock < e.at) continue;
      e.done = true;
      LC.stat('events');
      if (EV[e.type]) EV[e.type]();
    }
    if (Ev.croc) crocTick(dt);
    alarmTick();
    powerTick();
  };
  Ev.influencerWatching = (p) => {
    const inf = Ev.influencer;
    return inf && !inf.gone && inf.filming && inf.state === 'inside' && U.dist(inf.x, inf.y, p.x, p.y) < 260;
  };

  const EV = {};
  const themed = (size, theme, o = {}) => LC.Director.spawnGroup(size, Object.assign({ theme, from: S.exits[U.randi(0, 2)] }, o));

  /* ---------------- birthday ---------------- */
  EV.birthday = () => {
    const name = U.pick(['KAYLEIGH', 'JESS', 'DANI', 'PRIYA', 'BECCA', 'CHLOE']);
    const grp = themed(U.randi(14, 20), {
      look: (lk, i) => { lk.hat = i === 0 ? 'crown' : Math.random() < 0.6 ? 'party' : lk.hat; if (i === 0) { lk.sash = true; lk.sashC = '#ffd1e8'; } },
      setup: (n, i) => { n.tr.energy = Math.max(n.tr.energy, 0.6); n.flags.birthday = true; if (i === 0) n.name = U.cap(name.toLowerCase()); },
    }, { fem: (i) => Math.random() < 0.75 });
    LC.Radio.convo([['marcus', 'Birthday group. ' + grp.members.length + ' of them.'], ['you', 'How many cakes?'], ['marcus', 'One. And a lot of balloons.']]);
    LC.Objectives.flash('BIRTHDAY GROUP: ' + grp.members.length + ' PEOPLE', 'One cake. Zero plans. A lot of balloons.');
    // once they're in, balloons go up and the DJ plays the song
    setTimeout(() => {
      if (G().closing) return;
      for (let i = 0; i < 16; i++) {
        const b = Wd.addProp('balloon', U.rand(38, 54) * T, U.rand(16, 27) * T, { color: U.pick(['#ff4fa8', '#4af0ff', '#ffe14a', '#b56aff', '#ff6a3a']) });
        b.z = U.rand(20, 60);
      }
      for (let i = 0; i < 40; i++) Wd.part('confetti', U.rand(38, 54) * T, U.rand(16, 27) * T, { z: 80, vx: U.rand(-40, 40), vy: U.rand(-30, 30), vz: U.rand(-40, 20), c: [U.randi(150, 255), U.randi(60, 255), U.randi(60, 255)], max: 3.5 });
      for (let i = 0; i < 5; i++) Wd.addMess('confetti', U.rand(38, 54) * T, U.rand(16, 27) * T, { r: 24 });
      LC.Objectives.flash('SOMEONE RELEASED BALLOONS INTO THE CEILING', 'They will be up there until 2031.');
      LC.Audio && LC.Audio.ready && LC.Audio.special('birthday');
      G().music.special = 'birthday';
      setTimeout(() => { G().music.special = null; }, 22000);
      for (const n of grp.members) if (!n.gone && n.state === 'inside' && !n.override) N.shout(n, 'HAPPY BIRTHDAY ' + name + '!', { dim: true });
      const cakeSpot = M.randomPoint('hall', P.GUEST);
      if (cakeSpot) { const c = Wd.addProp('weird', cakeSpot.x, cakeSpot.y, { what: 'cake', label: 'birthday cake' }); c.body.m = 4; }
    }, 70000);
  };

  /* ---------------- influencer ---------------- */
  D.influencer = {
    title: 'THE INFLUENCER IS LIVE', sub: 'Everything you do is content now.', brief: 'livestreaming',
    sev: 1, timeout: 420, noticeR: 380,
    talk: () => ({
      open: ['Chat, say hi to security!', "I'm LIVE right now, so...", 'Can you do something funny?', 'Chat says you look tired.'],
      opts: [
        { text: 'No filming in here.', tag: 'WARN', yes: ["Ugh. Fine. Chat, I'm being SILENCED."] },
        { text: 'Chat, this is a nightclub.', tag: 'SNARK', yes: ['...chat agrees with you. Traitors.'], no: ['Chat LOVES you. Say it again.'] },
        { text: 'Put it away and enjoy the night.', tag: 'CALM' },
        { text: "You're leaving. Tell chat.", tag: 'OUT' },
      ],
    }),
    comply(inc) { const n = inc.n; n.filming = false; n.phoneUp = false; N.cancelTask(n); I().resolve(inc, 'talk'); },
    resolved: { any: ['Stream ended. 48,000 viewers are disappointed.'], eject: ['Ejected. Live. Trending for eleven minutes.'] },
    failed: ['Went viral. You are in it. You look tired.'],
  };
  EV.influencer = () => {
    const grp = themed(2, { look: (lk, i) => { if (i === 0) { lk.top = 'sequin'; lk.glasses = 'sun'; } }, setup: (n, i) => { if (i === 0) { n.tr.ego = 0.95; n.tr.social = 0.2; n.name = U.pick(['Brynnlee', 'Jaxxon', 'Skyy', 'Tayte']); } } });
    const inf = grp.members[0];
    Ev.influencer = inf;
    const wait = setInterval(() => {
      if (inf.gone) { clearInterval(wait); return; }
      if (inf.state !== 'inside') return;
      clearInterval(wait);
      const inc = I().start('influencer', inf);
      if (!inc) return;
      N.setTask(inf, (function* () {
        inf.phoneUp = true; inf.filming = true;
        while (inc.state === 'active') {
          const p = M.randomPoint(U.pick(['dance', 'bar', 'hall', 'vip', 'mens']), inf.perm | P.VIP);
          if (p) yield* N.go(inf, p.x, p.y, { perm: inf.perm | P.VIP, arrive: 16 });
          inf.act = 'phone';
          for (let t = 0; t < U.rand(6, 12) && inc.state === 'active'; t += G().dt) {
            if (Math.random() < G().dt * 0.2) N.say(inf, U.pick(['Chat, look at THIS', 'Oh my god, chat.', "This club is SO chaotic, chat", 'Link in bio', 'Chat says the bouncer looks tired', 'Smash that like on the flamingo']), { dim: true });
            yield;
          }
        }
      })(), 'inc:influencer', 3);
    }, 1000);
  };

  /* ---------------- forty shots ---------------- */
  EV.shots40 = () => {
    LC.Radio.convo([['jolene', 'Someone just ordered forty shots.'], ['marcus', 'For how many people?'], ['jolene', 'One.'], ['marcus', '...'], ['jolene', 'He is making friends.']]);
    G().barRush = true;
    setTimeout(() => { G().barRush = false; }, 60000);
    const drinkers = G().npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && !n.override && M.inRoom(n.x, n.y, 'bar')).slice(0, 12);
    for (const n of drinkers) {
      N.giveDrink(n, Wd.DRINKS.find((d) => d.name === 'shot'));
      n.sob = Math.max(0.05, n.sob - 0.12);
      if (Math.random() < 0.5) N.shout(n, U.pick(['SHOTS SHOTS SHOTS', 'WHO IS THIS GUY? I LOVE THIS GUY', 'FORTY!']), { dim: true });
    }
    LC.stat('shotsBought', 40);
  };

  /* ---------------- inflatable crocodile ---------------- */
  D.crocodile = {
    title: 'WHERE DID THE CROCODILE COME FROM?', sub: 'Nobody knows. Confiscate it.', brief: 'crowd-surfing a crocodile',
    sev: 1, timeout: 330, noticeR: 520,
    update(inc) {
      const c = Ev.croc;
      if (!c || c.broken || !Wd.props.includes(c)) { I().resolve(inc, 'popped', 'The crocodile has died. Everyone is grieving.'); return; }
      inc.data.pos = { x: c.body.x, y: c.body.y };
      const r = M.roomAt(c.body.x, c.body.y);
      if (!c.carriedBy && r && ((r.outdoor && r.id !== 'patio') || r.id === 'backstage' || r.id === 'office')) { LC.stat('randomObjects'); I().resolve(inc, 'confiscated'); Ev.croc = null; }
    },
    resolved: { confiscated: ['Crocodile confiscated. It will live backstage now.'], any: ['Crocodile situation resolved.'] },
    failed: ['The crocodile lives here now.'],
  };
  EV.crocodile = () => {
    const p = { x: U.rand(40, 52) * T, y: U.rand(18, 26) * T };
    const c = Wd.addProp('crocodile', p.x, p.y);
    Ev.croc = c; Ev.crocT = 0;
    const inc = I().emergent('crocodile', null, { pos: p });
    inc.data.pos = p;
    LC.stat('randomObjects');
  };
  function crocTick(dt) {
    const c = Ev.croc;
    if (!c || !Wd.props.includes(c)) { Ev.croc = null; return; }
    Ev.crocT += dt;
    // passed around over the heads of the crowd
    if (c.carriedBy && c.carriedBy.kind === 'player') return;
    if (!c.carriedBy || Math.random() < dt * 0.25) {
      const near = Ph.query(c.body.x, c.body.y, 90, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent.state === 'inside' && !b.ent.override && !b.ent.carry);
      if (c.carriedBy && c.carriedBy.kind === 'guest') N.drop(c.carriedBy);
      if (near.length && M.inClub(c.body.x, c.body.y)) { const n = U.pick(near).ent; N.pickUp(n, c); n.act = 'carryUp'; if (Math.random() < 0.3) N.shout(n, U.pick(['CROCODILE!', 'HE LIVES!', 'PASS IT BACK!', 'Is it real? IT IS REAL.']), { dim: true }); setTimeout(() => { if (n.carry === c && !n.gone) N.drop(n); }, U.rand(2500, 5000)); }
    }
    if (Ev.crocT > 90 && Math.random() < dt * 0.006) {
      Wd.breakProp(c); LC.sfx('pop', c.body.x, c.body.y);
      Ev.croc = null;
    }
  }

  /* ---------------- wedding afterparty ---------------- */
  D.speech = {
    title: 'THE BEST MAN IS GIVING A SPEECH', sub: 'On a table. To strangers.', brief: 'giving a speech on a table',
    sev: 1, noticeR: 480,
    talk: () => ({ open: ["And ANOTHER thing about Gary—", 'Ladies and gentlemen—', 'I have seven more pages!'], opts: [{ text: 'Wrap it up.', tag: 'WARN' }, { text: 'Lovely speech. Get down.', tag: 'CALM', bonus: 0.15 }, { text: "Nobody here knows Gary.", tag: 'SNARK', yes: ['...nobody knows Gary?'] }, { text: 'Speech over. Night over.', tag: 'OUT' }] }),
    comply(inc) { I().resolve(inc, 'talk'); I().oClimbDown && N.interrupt(inc.n, I().oClimbDown(inc.n, 0.8), 'climbdown', 9); },
    resolved: { any: ['The speech is over. Gary will never know.'] },
    failed: ['Seven pages. Nobody clapped.'],
  };
  EV.wedding = () => {
    const grp = themed(U.randi(10, 14), {
      look: (lk, i) => {
        if (i === 0) { lk.top = 'dress'; lk.topC = '#f8f6f0'; lk.bot = 'none'; lk.hat = 'veil'; }
        else if (i === 1) { lk.top = 'suit'; lk.topC = '#1a1a24'; lk.hat = null; }
        else if (i < 6) { lk.top = lk.fem ? 'dress' : 'suit'; lk.topC = lk.fem ? '#c86aa8' : '#2a2a3a'; if (lk.fem) lk.bot = 'none'; }
      },
      setup: (n, i) => { n.sob = Math.min(n.sob, U.rand(0.35, 0.6)); if (i === 2) n.flags.bestMan = true; if (i === 0) n.name = 'The Bride'; if (i === 1) n.name = 'The Groom'; },
    }, { fem: (i) => (i === 0 ? true : i === 1 ? false : Math.random() < 0.5) });
    LC.Radio.convo([['marcus', 'Wedding afterparty just walked in.'], ['you', 'How bad?'], ['marcus', "The groom is wearing the bride's shoes."]]);
    LC.Objectives.flash('A WEDDING AFTERPARTY HAS ARRIVED', 'Somebody is already crying. It is the groom.');
    setTimeout(() => {
      const bm = grp.members.find((m) => m.flags.bestMan && !m.gone && m.state === 'inside');
      if (!bm || bm.incident || bm.override) return;
      const tb = Wd.nearestProp(bm.x, bm.y, 800, (q) => q.kind === 'table' && !q.fallen && !q.broken);
      if (!tb) return;
      const inc = I().start('speech', bm);
      if (!inc) return;
      N.setTask(bm, (function* () {
        yield* N.go(bm, tb.body.x, tb.body.y + 16, { arrive: 14 });
        bm.body.ghost = true; bm.body.pinned = true; bm.body.x = tb.body.x; bm.body.y = tb.body.y;
        for (let t = 0; t < 0.8; t += G().dt) { bm.z = 23 * t / 0.8; yield; }
        bm.act = 'argue';
        const lines = ['Can I have everyone\'s attention?', 'I have known Gary since primary school.', 'Gary once ate a whole candle.', 'Gary, if you\'re watching— he\'s right there.', 'Anyway. Page two.', 'To Gary! And to... whatever her name is!'];
        for (let i = 0; inc.state === 'active'; i++) { N.shout(bm, lines[i % lines.length]); for (let t = 0; t < 4 && inc.state === 'active'; t += G().dt) yield; if (i > 12) { I().fail(inc, 'done'); break; } }
      })(), 'inc:speech', 3);
    }, 80000);
  };

  /* ---------------- football team ---------------- */
  EV.football = () => {
    const club = U.pick([['#d8202a', '#ffffff'], ['#1f4fd8', '#ffffff'], ['#10a050', '#ffe14a'], ['#f5c542', '#111111']]);
    let num = 2;
    const grp = themed(U.randi(12, 16), {
      look: (lk) => { lk.top = 'jersey'; lk.topC = club[0]; lk.topC2 = club[1]; lk.build = U.rand(1.1, 1.3); lk.hat = null; },
      setup: (n) => { n.number = num++; n.tr.energy = Math.max(n.tr.energy, 0.75); n.tr.loyalty = Math.max(n.tr.loyalty, 0.8); n.tr.ego = Math.min(1, n.tr.ego + 0.2); n.sob = Math.min(n.sob, U.rand(0.4, 0.65)); n.flags.team = true; },
    }, { fem: false });
    LC.Radio.convo([['marcus', 'An entire football team is in the queue.'], ['you', 'Did they win?'], ['marcus', 'They lost eight-nil. They are celebrating anyway.']]);
    LC.Objectives.flash('AN ENTIRE FOOTBALL TEAM HAS ARRIVED', 'They lost 8-0. They are celebrating anyway.');
    const chants = ['ONE OF OUR OWN!', 'EIGHT-NIL! EIGHT-NIL!', 'WE LOVE YOU FLAMINGO WE DO', "WHO ARE YA? WHO ARE YA?", 'OLE OLE OLE'];
    const iv = setInterval(() => {
      if (G().closing || grp.members.every((m) => m.gone)) { clearInterval(iv); return; }
      const m = U.pick(grp.members.filter((q) => !q.gone && q.state === 'inside'));
      if (m && !m.override) { const c = U.pick(chants); for (const o of grp.members) if (!o.gone && o.state === 'inside' && !o.override && U.dist(o.x, o.y, m.x, m.y) < 260 && Math.random() < 0.6) N.shout(o, c, { dim: true }); }
    }, 16000);
  };

  /* ---------------- stag do + missing groom ---------------- */
  EV.bachelor = () => {
    const grp = themed(U.randi(8, 10), {
      look: (lk, i) => { lk.top = 'tee'; lk.topC = '#ff4fd8'; if (i === 0) { lk.hat = 'veil'; lk.sash = true; lk.sashC = '#ffffff'; } },
      setup: (n, i) => { n.sob = Math.min(n.sob, U.rand(0.35, 0.55)); if (i === 0) n.name = U.pick(['Dave', 'Gary', 'Steve', 'Rob']); },
    }, { fem: false });
    LC.Radio.convo([['marcus', 'Stag do. Matching pink t-shirts. The groom is wearing a veil.'], ['you', 'Of course he is.']]);
    // they lose the groom
    setTimeout(() => {
      const groom = grp.members[0];
      const seeker = grp.members.find((m, i) => i > 0 && !m.gone && m.state === 'inside' && !m.incident && !m.override);
      if (!groom || groom.gone || !seeker || groom.state !== 'inside') return;
      const inc = I().start('lostFriend', seeker);
      if (inc && inc.data.friend !== groom) {
        // point the search at the groom
        inc.data.friend.lostFriendOf = null;
        inc.data.friend = groom; groom.lostFriendOf = seeker; seeker.lost = { kind: 'friend', friend: groom, inc };
        inc.title = 'THE STAG DO HAS LOST THE GROOM';
        N.setTask(groom, (function* () { const p = M.randomPoint(U.pick(['parking', 'alley', 'kitchen']), P.ALL); if (p) yield* N.go(groom, p.x, p.y, { perm: P.ALL }); LC.Director.sleeper(groom, 'floor', true); })(), 'wander', 2);
      }
    }, 90000);
  };

  /* ---------------- celebrity (probably) ---------------- */
  D.celebrity = {
    title: 'CELEBRITY (PROBABLY)', sub: 'He was in a yogurt advert once. Get him to VIP before the crowd eats him.', brief: 'famous, apparently',
    sev: 2, noticeR: 520, timeout: 300,
    talk: () => ({ open: ['Hi! Yes. It is me.', 'Please, no photos. Okay, one photo.', 'Do you know where VIP is? I am VIP.'], opts: [{ text: 'Follow me. VIP.', tag: 'HELP', fn: (inc) => { N.say(inc.n, 'Finally, someone competent.', { pri: 3 }); LC.Incidents.follow(inc.n, 'vip'); inc.data.escorting = true; } }, { text: 'Were you in the yogurt advert?', tag: 'SNARK', fn: (inc) => N.say(inc.n, "I WAS the yogurt advert.", { pri: 3 }) }, { text: 'Stop signing things.', tag: 'WARN' }] }),
    update(inc) { const n = inc.n; if (n && M.inRoom(n.x, n.y, 'vip')) { if (n.overrideName === 'follow') N.endOverride(n); I().resolve(inc, 'vip'); } },
    resolved: { any: ['Delivered to VIP. The crowd has forgotten him already.'] },
    failed: ['Mobbed by fans. Left early. Tweeted about it.'],
  };
  EV.celebrity = () => {
    const grp = themed(3, { look: (lk, i) => { if (i === 0) { lk.glasses = 'sun'; lk.top = 'suit'; lk.topC = '#e8e0d0'; lk.chain = true; } else { lk.top = 'suit'; lk.topC = '#111'; lk.glasses = 'sun'; } }, setup: (n, i) => { if (i === 0) { n.vip = true; n.name = U.pick(['Darren Vale', 'Chase Montague', 'Rex Starling']); n.tr.ego = 1; } } }, { fem: false });
    const star = grp.members[0];
    LC.Radio.convo([['marcus', 'Heads up. Celebrity at the door.'], ['you', 'Who?'], ['marcus', 'He was in a yogurt advert once.'], ['you', 'Which one?'], ['marcus', 'He will tell you.']]);
    const iv = setInterval(() => {
      if (star.gone || G().closing) { clearInterval(iv); return; }
      if (star.state !== 'inside') return;
      if (!star.celebInc) { star.celebInc = I().start('celebrity', star); if (star.celebInc) { N.setTask(star, (function* () { for (;;) { yield* N.tWander(star); } })(), 'inc:celebrity', 3); } }
      // fans gather
      const fans = Ph.query(star.x, star.y, 240, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== star && !b.ent.override && b.ent.state === 'inside');
      for (const b of fans.slice(0, 6)) {
        const f = b.ent;
        if (Math.random() < 0.3) N.interrupt(f, (function* () { f.phoneUp = true; f.filming = true; for (let t = 0; t < 6; t += G().dt) { const a = Math.atan2(f.y - star.y, f.x - star.x); const tx = star.x + Math.cos(a) * 40, ty = star.y + Math.sin(a) * 30; f.body.vx += (tx - f.x) * 0.1; f.body.vy += (ty - f.y) * 0.1; N.faceTo(f, star.x, star.y); f.act = 'phone'; if (Math.random() < G().dt * 0.2) N.shout(f, U.pick(['OH MY GOD', "IT'S HIM", 'Who is it?', 'SIGN MY ARM', 'The yogurt guy!']), { dim: true }); yield; } f.phoneUp = false; f.filming = false; })(), 'fan', 3);
      }
    }, 3000);
  };

  /* ---------------- proposal ---------------- */
  EV.proposal = () => {
    const cands = G().npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && n.group && n.group.members.length >= 2 && !n.override && !n.incident);
    if (!cands.length) return;
    const a = U.pick(cands), b = a.group.members.find((m) => m !== a && !m.gone && m.state === 'inside');
    if (!b) return;
    LC.Objectives.flash('SOMEONE IS PROPOSING ON THE DANCE FLOOR', 'Do not get involved. Or do. Up to you.');
    const spot = { x: 46 * T, y: 22 * T };
    N.interrupt(b, (function* () { yield* N.go(b, spot.x, spot.y - 20, { arrive: 14 }); b.act = 'stand'; for (let t = 0; t < 14; t += G().dt) { N.faceTo(b, a.x, a.y); yield; } })(), 'proposed', 6);
    N.interrupt(a, (function* () {
      yield* N.go(a, spot.x, spot.y + 10, { arrive: 14 });
      a.act = 'sit'; a.z = 0; N.faceTo(a, b.x, b.y);
      N.shout(a, U.pick(['Will you... marry me?', 'I know it\'s a nightclub. Will you marry me?']));
      // a ring of phones
      for (const q of Ph.query(spot.x, spot.y, 200, (q) => q.kind === 'char' && q.ent.kind === 'guest' && q.ent !== a && q.ent !== b && !q.ent.override).slice(0, 12)) {
        const o = q.ent;
        N.interrupt(o, (function* () { o.phoneUp = true; o.filming = true; for (let t = 0; t < 10; t += G().dt) { N.faceTo(o, spot.x, spot.y); o.act = 'phone'; yield; } o.phoneUp = false; o.filming = false; })(), 'watch', 3);
      }
      yield* N.wait(a, 3);
      const yes = Math.random() < 0.65;
      N.shout(b, yes ? U.pick(['YES! YES!', 'OBVIOUSLY YES']) : U.pick(['...can we talk about this outside?', 'In a CLUB?', 'I need some air.']));
      if (yes) { for (let i = 0; i < 30; i++) Wd.part('confetti', spot.x, spot.y, { z: 40, vx: U.rand(-80, 80), vy: U.rand(-60, 60), vz: U.rand(60, 160), c: [255, U.randi(100, 255), U.randi(100, 255)] }); LC.stat('proposalsAccepted'); a.mood.joy = 1; b.mood.joy = 1; }
      else { a.exprLock = true; a.expr = 'cry'; N.say(a, '*sob*', { pri: 2 }); LC.stat('proposalsRejected'); a.sob = Math.max(0.1, a.sob - 0.2); }
      yield* N.wait(a, 4);
      a.exprLock = false;
    })(), 'proposing', 6);
  };

  /* ---------------- the ex ---------------- */
  EV.ex = () => {
    const cands = G().npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && !n.override && !n.incident);
    if (!cands.length) return;
    const t = U.pick(cands);
    const grp = LC.Director.spawnGroup(1, { from: S.exits[0] });
    const ex = grp.members[0];
    ex.tr.ego = 0.9; ex.tr.aggression = Math.max(ex.tr.aggression, 0.6);
    const iv = setInterval(() => {
      if (ex.gone || t.gone || G().closing) { clearInterval(iv); return; }
      if (ex.state !== 'inside' || ex.override) return;
      clearInterval(iv);
      N.setTask(ex, (function* () {
        yield* N.go(ex, t.x + 20, t.y + 10, { arrive: 24 });
        N.shout(ex, U.pick(['Oh. It\'s YOU.', "Didn't know you'd be here.", 'Wow. Nice shirt. Did HE buy it?']));
        N.shout(t, U.pick(['Are you FOLLOWING me?', 'Of course you are here.', 'Unbelievable.']));
        LC.Objectives.flash("SOMEONE'S EX HAS APPEARED", 'This will end well.');
        if (LC.Social) { const arg = LC.Social.startArgument(t, ex, 'bump'); if (arg) arg.heat = 0.6; }
      })(), 'ex', 3);
    }, 1500);
  };

  /* ---------------- lost phone ---------------- */
  D.lostPhone = {
    title: (inc) => 'NOBODY STOLE YOUR PHONE, ' + inc.n.name.toUpperCase(), sub: 'Find it before they accuse everyone in the building.', brief: 'accusing everyone',
    sev: 1.5, timeout: 320, noticeR: 380,
    resolved: { any: (inc) => 'Phone found ' + inc.data.where + '. Nobody wants to touch it.', lostfound: ['Handed in. It will find its way home. Probably.'] },
    failed: ['Went home without the phone. Blamed you in a review.'],
    onGone(inc) { I().drop(inc); },
  };
  EV.lostPhone = () => {
    const cands = G().npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && !n.override && !n.incident && (1 - n.sob) > 0.35);
    if (!cands.length) return;
    const n = U.pick(cands);
    const spots = [
      { p: { x: U.pick(S.stalls).x, y: U.pick(S.stalls).y }, where: 'in a toilet' },
      { p: { x: M.flamingo.cx + 18, y: M.flamingo.y1 + 4 }, where: 'under the flamingo' },
      { p: { x: 43 * T, y: 47.4 * T }, where: 'in a plant pot' },
      { p: { x: U.pick(M.booths).booth.cx, y: M.booths[0].booth.y0 + 8 }, where: 'down the back of a booth' },
      { p: { x: 84.8 * T, y: 58.4 * T }, where: 'at the kebab van' },
    ];
    const s = U.pick(spots);
    const it = Wd.addItem('phone', s.p.x, s.p.y, { owner: n.id });
    const inc = I().start('lostPhone', n, { item: it, where: s.where });
    if (!inc) return;
    n.lost = { kind: 'phone', item: it, inc };
    N.setTask(n, (function* () {
      while (inc.state === 'active') {
        const targets = Ph.query(n.x, n.y, 200, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n && !b.ent.override);
        if (targets.length && Math.random() < 0.5 && LC.Director.allow('argument')) {
          const v = U.pick(targets).ent;
          yield* N.go(n, v.x + 16, v.y + 10, { arrive: 20 });
          N.shout(n, U.pick(['YOU took my phone!', 'Check his pockets!', 'Where is it?!', 'Somebody in this ROOM has my phone']));
          if (Math.random() < 0.5) LC.Social.startArgument(n, v, 'bump');
        }
        const p = M.randomPoint(U.pick(['bar', 'dance', 'hall', 'lounge']), n.perm);
        if (p) yield* N.go(n, p.x, p.y, { arrive: 16 });
        yield* N.wait(n, U.rand(3, 6));
      }
    })(), 'inc:lostPhone', 3);
  };

  /* ---------------- fire alarm ---------------- */
  D.fireAlarm = {
    title: (inc) => inc.data.reason === 'light' ? 'THEY THOUGHT IT WAS THE BATHROOM LIGHT' : 'SOMEBODY SET OFF THE FIRE ALARM', sub: 'Silence it at the alarm panel, backstage.', brief: '',
    sev: 4, noticeR: 99999,
    update(inc) { if (!G().alarm) I().resolve(inc, 'silenced'); },
    resolved: { any: ['Alarm silenced. Now everyone has to come back in. One at a time.'] },
    failed: ['The fire brigade came. They were not impressed.'],
  };
  Ev.fireAlarm = (reason) => {
    const g = G();
    if (g.alarm || g.closing) return;
    g.alarm = true; g.alarmT = g.t;
    LC.stat('fireAlarms');
    LC.Audio && LC.Audio.ready && LC.Audio.alarm(true);
    g.music.stopped = true;
    const inc = I().emergent('fireAlarm', null, { reason: reason === 'light' ? 'light' : reason, pos: { x: S.alarm.x, y: S.alarm.y } });
    I().notice(inc, 'sight');
    LC.Radio.convo([['marcus', 'FIRE ALARM. Unit Four, the panel is backstage.'], ['petrakis', 'Is there a fire? Tell me there is not a fire.'], ['you', reason === 'light' ? 'Someone thought it was the bathroom light.' : "There's no fire. There's " + reason + '.']]);
    const em = M.door('emergency'); em.target = 1;
    // everyone files out
    for (const n of g.npcs) {
      if (n.kind !== 'guest' || n.state !== 'inside' || n.asleep) continue;
      N.cancelTask(n);
      N.interrupt(n, (function* () {
        n.perm = n.perm | P.OUT | P.EMERG;
        n.exprLock = true; n.expr = 'scared';
        const out = Math.random() < 0.6 ? S.curb[U.randi(0, S.curb.length - 1)] : U.pick(S.parkingLoiter);
        yield* N.go(n, out.x + U.rand(-30, 30), out.y + U.rand(-20, 20), { perm: n.perm, hurry: true, arrive: 30, timeout: 50 });
        n.exprLock = false;
        n.act = 'stand';
        while (g.alarm) { if (Math.random() < g.dt * 0.05) N.say(n, U.pick(['Is it a real fire?', 'I left my drink inside!', "It's FREEZING", 'Best night ever', 'Who did it? Was it Kevin?']), { dim: true }); yield; }
        if (g.closing) { N.setTask(n, N.tLeave(n, { noCoat: Math.random() < 0.5 }), 'leave'); return; }
        // back in through the door, once the fuss is over
        yield* N.wait(n, U.rand(1, 10));
        n.perm = P.GUEST | (n.vip ? P.VIP : 0);
        yield* N.go(n, S.inside.x + U.rand(-40, 40), S.inside.y + U.rand(-30, 10), { perm: n.perm | P.OUT, arrive: 20, timeout: 60 });
      })(), 'evacuate', 7);
    }
    Ev.alarmWatch = g.t;
  };
  // nobody silenced it: the fire brigade turns up, then Marcus does it himself
  function alarmTick() {
    const g = G();
    if (!g.alarm) return;
    const k = g.t - g.alarmT;
    if (k > 60 && !g.alarmBrigade) { g.alarmBrigade = true; LC.Staff.callPolice(46 * T, 50 * T, 'fire'); LC.Radio.say('marcus', 'Fire brigade is here. They are asking for "the person in charge". I pointed at you.'); }
    if (k > 95) {
      const inc = I().active.find((q) => q.type === 'fireAlarm');
      Ev.silenceAlarm(true);
      LC.Radio.say('marcus', 'I silenced it. Panel is backstage, Unit Four. It has a big red sign on it.');
      if (inc) I().fail(inc, 'marcus');
    }
  }
  function powerTick() {
    const g = G();
    if (g.power || !g.powerOffT) return;
    if (g.t - g.powerOffT > 100) {
      const inc = I().active.find((q) => q.type === 'powerOut');
      Ev.restorePower(true);
      LC.Radio.say('petrakis', 'I found the breaker. It was labelled BREAKER. We will talk about this.');
      if (inc) I().fail(inc, 'manager');
    }
  }
  EV.fireAlarm = () => {
    // someone looking for the light switch
    const cands = G().npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && !n.override && !n.incident && (1 - n.sob) > 0.5);
    const n = U.pick(cands);
    if (!n) { Ev.fireAlarm('light'); return; }
    N.setTask(n, (function* () {
      yield* N.go(n, 15 * T, 29.5 * T, { arrive: 16 });
      n.act = 'point';
      N.say(n, "Why is it so dark in— there's the switch.", { pri: 1 });
      yield* N.wait(n, 1.2);
      Ev.fireAlarm('light');
      N.say(n, '...that was not the light.', { pri: 2 });
    })(), 'alarm', 2);
  };
  Ev.silenceAlarm = (byStaff) => {
    const g = G();
    if (!g.alarm) return;
    g.alarm = false;
    g.alarmBrigade = false;
    LC.Audio && LC.Audio.ready && LC.Audio.alarm(false);
    g.music.stopped = g.closing || !g.power;
    M.door('emergency').target = 0;
    if (!byStaff) { LC.Player.say('Silenced.'); LC.Radio.say('krank', 'Music back on. Everyone back in. One at a time. Please.'); }
  };

  /* ---------------- power cut ---------------- */
  D.powerOut = {
    title: 'WHO TURNED OFF THE LIGHTS?', sub: 'Breaker panel, backstage. Bring your torch [F].', brief: '',
    sev: 4, noticeR: 99999,
    update(inc) { if (G().power) I().resolve(inc, 'restored'); },
    resolved: { any: ['Power restored. Several things went missing in the dark. Several people are holding hands who were not before.'] },
    failed: ['Dark all night.'],
  };
  EV.powerOut = () => {
    const g = G();
    if (!g.power || g.closing) return;
    g.power = false;
    g.powerOffT = g.t;
    g.music.stopped = true;
    LC.stat('powerCuts');
    LC.Audio && LC.Audio.ready && LC.Audio.powerDown();
    const inc = I().emergent('powerOut', null, { pos: { x: S.breaker.x, y: S.breaker.y } });
    I().notice(inc, 'sight');
    LC.Radio.convo([['krank', '...did anyone else hear that?'], ['marcus', 'Power is out. Unit Four, breaker panel, backstage.'], ['you', "I can't see anything."], ['marcus', 'You have a torch.'], ['you', 'Right.']]);
    // phones come out
    for (const n of g.npcs) if (n.kind === 'guest' && n.state === 'inside' && Math.random() < 0.5) { n.phoneUp = true; n.torch = true; }
    // the dark is when things go missing
    setTimeout(() => { if (!g.power) { const n = g.npcs.find((q) => q.kind === 'guest' && q.state === 'inside' && !q.incident && !q.override && (1 - q.sob) > 0.3); if (n) I().start('bottleThief', n); } }, 6000);
  };
  Ev.restorePower = (byStaff) => {
    const g = G();
    if (g.power) return;
    g.power = true;
    g.powerOffT = 0;
    g.music.stopped = g.closing || g.alarm;
    LC.Audio && LC.Audio.ready && LC.Audio.powerUp();
    for (const n of g.npcs) { if (n.torch) { n.torch = false; n.phoneUp = false; } }
    if (!byStaff) LC.Player.say('And... there.');
    for (const n of g.npcs) if (n.kind === 'guest' && n.state === 'inside' && Math.random() < 0.12) N.shout(n, U.pick(['WOOOO', 'NOOO it was nice in the dark', 'Who is holding my hand?']), { dim: true });
  };
})();
