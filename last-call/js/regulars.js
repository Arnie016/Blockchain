/* Last Call — the regulars. Same faces every weekend, and they remember what happened last
   time even when they'd rather not. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd, Phys: Ph } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Rg = (LC.Regulars = {});
  const I = () => LC.Incidents;
  const G = () => LC.G;
  const D = LC.Incidents.defs;

  const KEY = 'lastcall.regulars.v1';
  Rg.state = null;
  Rg.load = () => { Rg.state = U.load(KEY, null) || { vince: { seen: 0, tries: 0, ejected: 0 }, gerald: { seen: 0, idx: 0 }, couple: { seen: 0, status: 'together' }, luke: { seen: 0, lost: 0, found: 0 }, dom: { seen: 0, progress: 0 }, margot: { seen: 0, hasPlant: false, thefts: 0, caught: 0 } }; };
  Rg.save = () => U.save(KEY, Rg.state);
  Rg.reset = () => { U.save(KEY, null); Rg.load(); };

  const DEF = {
    vince: { name: 'Vince', fem: false, at: 95, look: { hair: 'slick', hairC: '#17110d', top: 'suit', topC: '#c8a040', bot: 'pants', botC: '#1a1a1e', glasses: 'sun', chain: true, hat: null, build: 1.05 }, tr: { ego: 0.98, confidence: 0.95, commonSense: 0.2, aggression: 0.3, fear: 0.2 } },
    gerald: { name: 'Gerald', fem: false, at: 120, nights: [1, 2, 3, 4, 5, 6], look: { hair: 'bald', top: 'shirt', topC: '#e8ecf2', topC2: '#6a7a9a', bot: 'pants', botC: '#3a3a44', glasses: 'nerd', hat: null, beard: 'mustache', build: 1.12 }, tr: { ego: 0.4, confidence: 0.5, commonSense: 0.5, aggression: 0.1, energy: 0.3, social: 0.9 } },
    kayleigh: { name: 'Kayleigh', fem: true, at: 130, look: { hair: 'pony', hairC: '#ecdcae', top: 'dress', topC: '#ff7ab8', bot: 'none', hat: null, glasses: null }, tr: { ego: 0.7, aggression: 0.6, loyalty: 0.9 } },
    brandon: { name: 'Brandon', fem: false, at: 130, look: { hair: 'short', hairC: '#3f281b', top: 'shirt', topC: '#3a5ab0', bot: 'jeans', botC: '#2d4a7a', hat: 'cap', topC2: '#e8375a', glasses: null }, tr: { ego: 0.75, aggression: 0.55, loyalty: 0.9 } },
    luke: { name: 'Luke', fem: false, at: 150, look: { hair: 'curly', hairC: '#7d5028', top: 'tee', topC: '#f0f0f2', bot: 'jeans', botC: '#1c2230', hat: 'beanie', topC2: '#2fd0b0', glasses: null }, tr: { commonSense: 0.3, energy: 0.6 } },
    dom: { name: 'Dom', fem: false, at: 170, nights: [0, 2, 3, 4, 5, 6], look: { hair: 'spiky', hairC: '#d6b06a', top: 'tank', topC: '#ff6b35', bot: 'shorts', botC: '#e8e0d0', glasses: 'sun', skin: '#cf9366', hat: null }, tr: { ego: 0.8, energy: 0.95, commonSense: 0.25 } },
    margot: { name: 'Margot', fem: true, at: 110, look: { hair: 'bob', hairC: '#a3a3a8', top: 'blouse', topC: '#3a8a5a', bot: 'skirt', botC: '#4a2f4f', glasses: 'nerd', hat: null, bag: true }, tr: { commonSense: 0.6, ego: 0.5, embarrassment: 0.2, fear: 0.3 } },
  };

  Rg.start = () => {
    if (!Rg.state) Rg.load();
    const g = G(), ni = g.nightIndex;
    Rg.pending = [];
    Rg.people = {};
    for (const [id, d] of Object.entries(DEF)) {
      if (d.nights && !d.nights.includes(ni)) continue;
      if ((id === 'kayleigh' || id === 'brandon') && Rg.state.couple.status === 'broken' && ni % 2 === 1 && id === 'brandon') continue;
      Rg.pending.push({ id, at: d.at + U.rand(-15, 25) });
    }
  };
  Rg.update = () => {
    const g = G();
    if (!Rg.pending || g.closing) return;
    for (let i = Rg.pending.length - 1; i >= 0; i--) {
      const p = Rg.pending[i];
      if (g.clock < p.at) continue;
      Rg.pending.splice(i, 1);
      spawn(p.id);
    }
  };
  function spawn(id) {
    const d = DEF[id];
    const grp = LC.Director.spawnGroup(1, { from: U.pick(S.exits), fem: d.fem });
    const n = grp.members[0];
    Object.assign(n.look, d.look);
    Object.assign(n.tr, d.tr);
    n.name = d.name; n.regular = id; n.fem = d.fem;
    const st = stateOf(id);
    n.regularKnown = st.seen > 0;
    st.seen++;
    Rg.people[id] = n;
    // Margot brings the plant back
    if (id === 'margot' && Rg.state.margot.hasPlant) {
      const pl = Wd.addProp('plant', n.x, n.y, { big: false });
      pl.home = { x: 43 * T, y: 46.9 * T };
      N.pickUp(n, pl);
      n.act_keepWhileMoving = true; n.act = 'carryUp';
      n.flags.plantReturn = pl;
    }
    if (id === 'kayleigh' || id === 'brandon') { const o = Rg.people[id === 'kayleigh' ? 'brandon' : 'kayleigh']; if (o && !o.gone) { n.group = o.group; o.group.members.push(n); } }
  }
  function stateOf(id) { return id === 'kayleigh' || id === 'brandon' ? Rg.state.couple : Rg.state[id]; }

  Rg.label = (n) => (n.regularKnown ? n.name.toUpperCase() + '. AGAIN.' : null);

  /* ---------------- once inside ---------------- */
  Rg.entered = (n) => {
    const id = n.regular;
    const later = (secs, fn) => setTimeout(() => { if (!n.gone && n.state === 'inside' && !G().closing) fn(); }, secs * 1000);
    switch (id) {
      case 'vince': later(U.rand(40, 90), () => { if (!n.incident) { const inc = I().start('vipSneak', n); if (inc && n.regularKnown) inc.title = 'VINCE IS TRYING VIP. AGAIN.'; Rg.state.vince.tries++; } }); break;
      case 'margot':
        if (n.flags.plantReturn) { n.act_keepWhileMoving = false; N.drop(n, { x: 43 * T, y: 46.9 * T }); n.flags.plantReturn = null; n.act = null; LC.stat('plantsReturnedByMargot'); Rg.state.margot.hasPlant = false; }
        later(U.rand(90, 160), () => { if (!n.incident) { const inc = I().start('plant', n); if (inc && Rg.state.margot.thefts > 0) inc.title = 'MARGOT. THE PLANT. AGAIN.'; } });
        break;
      case 'gerald': later(Math.max(10, (220 - G().clock) * 1.8), () => startSpeech(n)); break;
      case 'kayleigh': case 'brandon':
        later(U.rand(50, 100), () => {
          const a = Rg.people.kayleigh, b = Rg.people.brandon;
          if (!a || !b || a.gone || b.gone || a.state !== 'inside' || b.state !== 'inside' || LC.Social.inArgument(a)) return;
          N.setTask(a, (function* () {
            yield* N.go(a, b.x + 22, b.y + 8, { arrive: 26 });
            const arg = LC.Social.startArgument(a, b, 'bump');
            if (!arg) return;
            arg.heat = 0.45; arg.couple = true;
            if (arg.inc) { arg.inc.title = U.pick(['KAYLEIGH AND BRANDON ARE AT IT AGAIN', 'COUPLES THERAPY IS NOT INCLUDED']); arg.inc.sub = 'Every weekend. Every single weekend.'; }
            const script = [['a', 'You SAID you would text.'], ['b', 'I DID text!'], ['a', "You texted 'k'."], ['b', 'K is a TEXT.'], ['a', 'K is a LETTER, Brandon.']];
            let i = 0;
            const iv = setInterval(() => { if (arg.over || i >= script.length) { clearInterval(iv); return; } const [w, t] = script[i++]; N.shout(w === 'a' ? a : b, t); }, 2600);
          })(), 'couple', 2);
        });
        break;
      case 'luke': later(U.rand(60, 140), () => loseJacket(n)); break;
      case 'dom': later(U.rand(40, 90), () => { if (!n.incident) { const inc = I().start('dj', n); if (inc) { inc.title = 'DOM IS SURE THE DJ REMEMBERS HIM'; inc.data.dom = true; } } }); break;
    }
  };
  function loseJacket(n) {
    const p = M.randomPoint(U.pick(['lounge', 'chill', 'patio', 'dance', 'mens']), P.ALL) || { x: n.x + 40, y: n.y };
    const it = Wd.addItem('jacket', p.x, p.y, { owner: n.id, c: [60, 90, 150], label: "Luke's jacket" });
    Rg.state.luke.lost++;
    const inc = I().emergent('lukeJacket', n, { item: it });
    n.lost = { kind: 'jacket', item: it, inc };
    N.setTask(n, (function* () {
      while (inc.state === 'active') {
        const q = M.randomPoint(U.pick(['dance', 'bar', 'hall', 'lounge', 'lobby']), n.perm);
        if (q) yield* N.go(n, q.x, q.y, { arrive: 16 });
        N.say(n, U.pick(["Has anyone seen my jacket? It's jacket-coloured.", 'I had a jacket. I KNOW I had a jacket.', 'Jacket? Jacket?']), { pri: 1 });
        yield* N.wait(n, U.rand(3, 6));
      }
    })(), 'inc:lukeJacket', 3);
  }
  D.lukeJacket = {
    title: (inc) => (Rg.state && Rg.state.luke.lost > 1 ? 'LUKE HAS LOST HIS JACKET. AGAIN.' : "IT'S JACKET-COLOURED"), sub: 'Find the jacket. It is jacket-coloured.', brief: 'looking for a jacket',
    sev: 0.5, timeout: 320, noticeR: 260, noticeT: 1,
    resolved: { any: ['Reunited with the jacket. See you next week, Luke.'], lostfound: ['Handed in. He will lose it again on the way out.'] },
    failed: ['Went home without the jacket. Again.'],
    onGone(inc) { I().drop(inc); },
  };

  /* ---------------- Gerald's lecture ---------------- */
  const PHILOSOPHY = [
    ['What is a bouncer, really, but a door with feelings?', 'We are all just queueing for something.', 'The flamingo. Why does it stand on one leg? Because it CAN.', 'I have been to this club forty times. I have never been to this club.'],
    ['If a man is thrown out of a club and nobody films it, did it happen?', 'The music is loud so we do not have to hear ourselves think.', 'My manager says I am "a lot". I AM a lot. I contain MULTITUDES.', 'Every drink is a question. Every hangover is an answer.'],
    ['I have realised. The flamingo is US.', 'We dance because the alternative is spreadsheets.', 'Lights on at four. Like a birth. A terrible birth.', 'The sticky floor holds us all together. Literally.'],
    ['I quit my job. I am a philosopher now. Unpaid.', 'We are the flamingo AND the pond.', 'Security. You. You understand. You see everything.', 'Is a kebab a sandwich? Is a man a kebab?'],
  ];
  D.philosopher = {
    title: 'PLEASE STOP THE TED TALK', sub: 'Gerald from Accounts has found a chair and a crowd.', brief: 'philosophising on a chair',
    sev: 1.5, noticeR: 480,
    talk: () => ({
      open: ['Security! Come. Join us. Think.', 'Are we the club, or is the club us?', 'Do not interrupt. I am having a breakthrough.'],
      opts: [
        { text: 'Is the flamingo us?', tag: 'SNARK', fn: (inc) => { N.say(inc.n, 'YES. EXACTLY. You get it.', { pri: 3 }); I().escalate(inc, 1); } },
        { text: 'Gerald. Get down.', tag: 'WARN', yes: ['...fair. A philosopher must also descend.'] },
        { text: "That's deep. Get off the chair.", tag: 'CALM', bonus: 0.2, yes: ['Thank you. You are the only one who listens.'] },
        { text: 'Class dismissed. Out.', tag: 'OUT' },
      ],
    }),
    comply(inc) { I().resolve(inc, 'talk'); },
    resolved: { any: ['Gerald has left the podium. The crowd disperses, changed.'], eject: ['Gerald has been escorted out. He is still talking.'] },
    failed: ['The lecture ended when Gerald fell asleep mid-sentence.'],
  };
  function startSpeech(n) {
    if (n.incident || n.override) return;
    const inc = I().start('philosopher', n);
    if (!inc) return;
    const set = PHILOSOPHY[Math.min(Rg.state.gerald.idx, PHILOSOPHY.length - 1)];
    Rg.state.gerald.idx++;
    N.setTask(n, (function* () {
      const ch = Wd.nearestProp(n.x, n.y, 900, (q) => q.kind === 'chair' && !q.occ && !q.fallen && M.inClub(q.body.x, q.body.y));
      if (ch) {
        yield* N.go(n, ch.body.x, ch.body.y + 14, { arrive: 14 });
        n.body.ghost = true; n.body.pinned = true; n.body.x = ch.body.x; n.body.y = ch.body.y;
        for (let t = 0; t < 0.6; t += G().dt) { n.z = 18 * t / 0.6; yield; }
      }
      n.act = 'argue';
      let i = 0;
      while (inc.state === 'active' && i < 14) {
        N.shout(n, set[i % set.length], { dur: 4 });
        // an audience gathers and blocks the way
        for (const b of Ph.query(n.x, n.y, 170, (b) => b.kind === 'char' && b.ent.kind === 'guest' && b.ent !== n && !b.ent.override && !b.ent.incident).slice(0, 5)) {
          const o = b.ent;
          if (Math.random() < 0.4) N.interrupt(o, (function* () { for (let t = 0; t < 5; t += G().dt) { N.faceTo(o, n.x, n.y); o.act = 'stand'; if (Math.random() < G().dt * 0.1) N.say(o, U.pick(['Wow.', 'He is RIGHT.', 'I feel seen.', 'What?', 'Deep.']), { dim: true }); yield; } })(), 'listen', 3);
        }
        for (let t = 0; t < 5 && inc.state === 'active'; t += G().dt) yield;
        i++;
      }
      if (inc.state === 'active') { n.asleep = false; I().fail(inc, 'done'); }
    })(), 'inc:philosopher', 3);
  }
  const oldCleanup = null; void oldCleanup;

  /* ---------------- special dialogue ---------------- */
  Rg.talk = (ctx, n) => {
    const id = n.regular;
    if (!n.regularKnown && id !== 'margot' && id !== 'dom') return false;
    if (n.incident && n.incident.state === 'active' && n.incident.type !== 'lukeJacket') return false;
    if (id === 'vince') {
      ctx.title = 'VINCE';
      ctx.open = U.pick(['Evening, big man.', 'Me and you. We go way back.', 'Is Rico on the rope tonight? Asking for a friend. I am the friend.']);
      ctx.opts = [
        { text: 'No.', tag: 'WARN', fn: () => LC.Dialogue.seq(n, [['npc', "I haven't even done anything."], ['you', "You're walking towards VIP."], ['npc', "...I'm walking towards the toilet. Which is in VIP."]]) },
        { text: 'There is still no list, Vince.', tag: 'SNARK', fn: () => N.say(n, "There's always a list. You're just not on it.", { pri: 3 }) },
        { text: 'Behave tonight.', tag: 'CALM', fn: () => N.say(n, 'I always behave. VIP behaviour.', { pri: 3 }) },
      ];
      return true;
    }
    if (id === 'margot') {
      ctx.title = 'MARGOT';
      if (n.flags.plantReturn || G().stats.plantsReturnedByMargot) {
        ctx.open = 'Hello, dear.';
        ctx.opts = [{ text: 'No.', tag: 'WARN', fn: () => LC.Dialogue.seq(n, [['npc', "I haven't even done anything."], ['you', 'You brought the plant back.'], ['npc', '...it missed you.']]) }, { text: 'Is that... the plant?', tag: 'SNARK', fn: () => N.say(n, 'It needed to see its friends.', { pri: 3 }) }];
        return true;
      }
      if (!n.regularKnown) return false;
      ctx.open = U.pick(['Lovely plants you have here.', 'Is that a fern? It is a ficus. I knew that.']);
      ctx.opts = [{ text: "Don't.", tag: 'WARN', fn: () => N.say(n, 'Don\'t what, dear?', { pri: 3 }) }, { text: 'I am watching the plants, Margot.', tag: 'SNARK', fn: () => { N.say(n, 'So am I.', { pri: 3 }); } }];
      return true;
    }
    if (id === 'gerald') {
      ctx.title = 'GERALD FROM ACCOUNTS';
      ctx.open = U.pick(['Security. What do you think happens after the lights come on?', 'Have you ever looked at a mop and seen yourself?', 'I am only on my third drink. Spiritually, my ninth.']);
      ctx.opts = [{ text: 'Cleaning. Lots of cleaning.', tag: 'SNARK', fn: () => N.say(n, 'Yes. YES. We are all being cleaned.', { pri: 3 }) }, { text: 'Drink some water, Gerald.', tag: 'HELP', fn: () => { const p = G().player; if (p.inv.water > 0) { p.inv.water--; LC.Player.giveWater(n); } else N.say(n, 'Water. The first drink.', { pri: 3 }); } }, { text: 'Not tonight, Gerald.', tag: 'CALM', fn: () => N.say(n, 'Every night is tonight.', { pri: 3 }) }];
      return true;
    }
    if (id === 'kayleigh' || id === 'brandon') {
      ctx.title = n.name.toUpperCase();
      ctx.open = id === 'kayleigh' ? U.pick(["Has he texted? He hasn't texted.", 'We are FINE. We are so fine.']) : U.pick(["She's mad about the text again.", "I sent a K. K is a response."]);
      ctx.opts = [{ text: 'Not again.', tag: 'WARN', fn: () => N.say(n, id === 'kayleigh' ? 'He STARTED it.' : 'She started it. With the K thing.', { pri: 3 }) }, { text: 'Have you tried talking? Using full words?', tag: 'SNARK', fn: () => N.say(n, '...full words?', { pri: 3 }) }, { text: "Go and dance. Separately.", tag: 'CALM', fn: () => { N.say(n, 'Fine. SEPARATELY.', { pri: 3 }); N.setTask(n, N.tDance(n), 'dance'); } }];
      return true;
    }
    if (id === 'luke') {
      ctx.title = 'LUKE';
      const have = G().player.pocket.find((it) => it.owner === n.id || it.kind === 'jacket');
      ctx.open = n.lost ? 'Have you seen my jacket? It\'s jacket-coloured.' : 'Still got my jacket! For now!';
      ctx.opts = [];
      if (have) ctx.opts.push({ text: 'This one?', tag: 'HELP', fn: () => { if (have.owner === n.id) I().returnItem(n, have); else N.say(n, "That's not mine. That's from LAST week. ...I'll take it.", { pri: 3 }); } });
      ctx.opts.push({ text: 'Have you tried not taking it off?', tag: 'SNARK', fn: () => N.say(n, 'Then how would I LOSE it?', { pri: 3 }) });
      ctx.opts.push({ text: "I'll keep an eye out.", tag: 'HELP', fn: () => { N.say(n, 'You are a legend.', { pri: 3 }); if (n.lost && n.lost.inc) I().notice(n.lost.inc, 'told'); } });
      return true;
    }
    if (id === 'dom') {
      ctx.title = 'DOM';
      ctx.open = U.pick(['He remembers me. Ibiza. 2014.', "Tell the DJ Dom's here. He'll know.", 'We did a shot together. Once. It was a moment.']);
      ctx.opts = [{ text: "He doesn't remember you, Dom.", tag: 'SNARK', fn: () => N.say(n, 'He DOES. He just forgot.', { pri: 3 }) }, { text: 'Stay out of the booth.', tag: 'WARN', fn: () => N.say(n, 'I would NEVER. Unless invited. Which I will be.', { pri: 3 }) }];
      return true;
    }
    return false;
  };
  Rg.ejected = (n) => { if (n.regular === 'vince') Rg.state.vince.ejected++; };
  Rg.itemReturned = (n) => { if (n.regular === 'luke') Rg.state.luke.found++; };

  // what the regulars take home from tonight
  Rg.endNight = () => {
    const s = Rg.state;
    if (!s) return [];
    const notes = [];
    const g = G();
    const plantInc = (g.history || []).find((h) => h.type === 'plant' && h.regular === 'margot');
    if (plantInc && plantInc.state === 'failed') { s.margot.hasPlant = true; s.margot.thefts++; notes.push('Margot got away with the plant. She will be back. So will the plant.'); }
    else if (plantInc) { s.margot.caught++; notes.push('Margot did not get the plant. She has not given up.'); }
    if (Rg.people && Rg.people.vince) notes.push(s.vince.tries > 2 ? 'Vince has now attempted VIP ' + s.vince.tries + ' times. Rico has started a tally.' : 'Vince tried VIP. Vince will always try VIP.');
    if (Rg.people && Rg.people.kayleigh && Rg.people.brandon) {
      s.couple.status = s.couple.status === 'together' ? (Math.random() < 0.5 ? 'broken' : 'together') : 'together';
      notes.push(s.couple.status === 'broken' ? 'Kayleigh and Brandon have broken up. Again. See you Saturday.' : 'Kayleigh and Brandon are back together. The K has been forgiven.');
    }
    if (Rg.people && Rg.people.luke) notes.push('Luke\'s jacket count: lost ' + s.luke.lost + ', found ' + s.luke.found + '.');
    if (Rg.people && Rg.people.gerald) notes.push('Gerald has reached a new stage of philosophy. HR has been informed.');
    if (Rg.people && Rg.people.dom) { s.dom.progress++; if (s.dom.progress >= 3) notes.push('The DJ said "...Dom?" Dom cried for twenty minutes.'); else notes.push('The DJ still does not remember Dom.'); }
    Rg.save();
    return notes;
  };
})();
