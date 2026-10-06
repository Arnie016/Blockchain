/* Last Call — talking. Short, fast choices. Time slows while you pick; each option carries an
   approach (CALM, WARN, OUT, SNARK, HELP) and whether it works depends on who you're talking to. */
(function () {
  'use strict';
  const { U, Map: M, NPC: N, W: Wd } = LC;
  const S = M.S;
  const D = (LC.Dialogue = {});
  const L = () => LC.Lines;

  const COMPLY = {
    CALM: ['Okay. Okay. Fair.', "Yeah... you're right.", 'Fine. For you.', 'Alright. Sorry.', "You're very calming. Like a big dad."],
    WARN: ['Alright, alright!', 'Going. Going.', "Chill, I'm stopping.", 'Okay! Jeez.', 'Fine. FINE.'],
    SNARK: ['...wow. Okay.', 'Rude. But fair.', '*quietly stops*', 'That was mean. I deserved it.', "I'll just... go."],
  };
  const DEFY = {
    CALM: ['Nah.', "You're not my dad.", 'Make me.', "I'm having FUN.", 'In a minute.', 'Shhh. Shhh.'],
    WARN: ['Or what?', 'What, you gonna warn me AGAIN?', 'Pfft.', "I'm shaking. Look. Shaking.", 'Noted. Ignored.'],
    SNARK: ['What did you just say to me?', "Oh, you're FUNNY.", 'Is that meant to be a joke?', 'Say that again.', 'Wow. Security has jokes.'],
  };
  D.COMPLY = COMPLY; D.DEFY = DEFY;

  // does this approach work on this person
  D.chance = (n, tag, bonus = 0) => {
    const tr = n.tr, dr = 1 - n.sob, aggr = N.aggr(n), cs = N.cs(n);
    let p = 0.4;
    if (tag === 'CALM') p = 0.3 + cs * 0.35 + tr.social * 0.18 + tr.fear * 0.1 - aggr * 0.35 - tr.ego * 0.15 - dr * 0.12;
    else if (tag === 'WARN') p = 0.3 + tr.fear * 0.35 + tr.embarrassment * 0.15 + (n.warnings || 0) * 0.24 - tr.ego * 0.25 - aggr * 0.2;
    else if (tag === 'SNARK') p = 0.2 + tr.embarrassment * 0.45 - tr.ego * 0.3 + (1 - cs) * 0.08;
    else if (tag === 'HELP') p = 0.65;
    if ((n.stared || 0) > 1.2) p += 0.1;
    if (n.mood.anger > 0.7) p -= 0.15;
    if (LC.Aura) p += LC.Aura.bonus();
    return U.clamp(p + bonus, 0.05, 0.95);
  };
  D.attempt = (n, tag, bonus) => Math.random() < D.chance(n, tag, bonus);

  /* ---------------- open / close ---------------- */
  D.open = (n) => {
    const G = LC.G, p = G.player;
    if (!n || n.gone) return;
    if (G.dialog) D.close();
    if (n.kind === 'staff') { staffTalk(n); return; }
    if (n.police) { LC.Player.say('Evening, officers.'); N.say(n, U.pick(["Evening.", "Keep it tidy in there.", "We've been here twice this month."]), { pri: 2 }); return; }
    if (U.dist(p.x, p.y, n.x, n.y) > 130 && !(n.z > 20 && U.dist(p.x, p.y, n.x, n.y) < 200)) return;
    const ctx = { n, opts: [], t0: performance.now(), title: n.name, info: describe(n) };
    let built = false;
    if (p.grab && p.grab.npc === n) built = escortTalk(ctx, p.grab);
    else if (n.state === 'queue') built = doorTalk(ctx);
    if (!built && n.incident && n.incident.state === 'active' && LC.Incidents) built = LC.Incidents.talk(ctx, n.incident);
    if (!built && n.regular && LC.Regulars) built = LC.Regulars.talk(ctx, n);
    if (!built && (n.overrideName === 'argue' || n.overrideName === 'fight')) built = argueTalk(ctx);
    if (!built && n.asleep) built = sleeperTalk(ctx);
    if (!built && n.lost) built = lostTalk(ctx);
    if (!built && n.flags.banned && n.state === 'inside') built = bannedTalk(ctx);
    if (!built && LC.G.closing) built = closingTalk(ctx);
    if (!built && (1 - n.sob) > 0.72) built = drunkTalk(ctx);
    if (!built && LC.Fun && Math.random() < 0.75) built = LC.Fun.chat(ctx, n);
    if (!built) normalTalk(ctx);
    if (!ctx.opts.length) return;
    G.dialog = ctx;
    if (!n.escorted && n.overrideName !== 'fight' && n.state !== 'queue' && !(n.z > 20)) N.interrupt(n, oTalk(n, ctx), 'talk', 7);
    if (ctx.open) N.say(n, ctx.open, { pri: 3, dur: 6, noSlur: false });
    LC.HUD.showDialog(ctx);
    LC.sfx('ui', p.x, p.y, { vol: 0.5 });
  };
  D.close = () => {
    const G = LC.G;
    const ctx = G.dialog;
    if (!ctx) return;
    G.dialog = null;
    LC.HUD.hideDialog();
    if (ctx.n.overrideName === 'talk' && !ctx.keepOverride) N.endOverride(ctx.n);
  };
  D.pick = (i) => {
    const G = LC.G, ctx = G.dialog;
    if (!ctx) return;
    const o = ctx.opts[i];
    if (!o) return;
    D.close();
    if (o.say !== false) LC.Player.say(o.say || o.text);
    LC.stat('dialogueChoices');
    if (o.tag === 'SNARK') LC.stat('sarcasticRemarks');
    // replies land a beat after your line
    const n = ctx.n;
    setTimeout(() => { if (!n.gone) o.fn(ctx); }, 550 + Math.min(900, (o.say || o.text).length * 14));
  };
  D.update = () => {
    const G = LC.G, ctx = G.dialog;
    if (!ctx) return;
    const p = G.player, n = ctx.n;
    if (n.gone || (U.dist(p.x, p.y, n.x, n.y) > 170 && !(n.z > 20)) || performance.now() - ctx.t0 > 11000) D.close();
  };
  function* oTalk(n, ctx) {
    const G = LC.G, p = G.player;
    while (G.dialog === ctx) { N.faceTo(n, p.x, p.y); n.act = n.act === 'sit' ? 'sit' : 'stand'; yield; }
    // linger a moment so the reply is visible
    yield* N.wait(n, 1.2);
  }

  function describe(n) {
    const bits = [];
    const dr = 1 - n.sob;
    if (n.kind !== 'guest') return n.role;
    if (n.regular && n.regularKnown) bits.push('regular');
    bits.push(dr > 0.85 ? 'absolutely gone' : dr > 0.7 ? 'very drunk' : dr > 0.5 ? 'drunk' : dr > 0.3 ? 'tipsy' : 'sober-ish');
    if (n.mood.anger > 0.6) bits.push('furious');
    if (n.flags.banned && n.state === 'inside') bits.push('you have met before');
    if (n.incident && n.incident.noticed) bits.push(n.incident.def.brief || 'up to something');
    if ((n.warnings || 0) > 0) bits.push(n.warnings + (n.warnings === 1 ? ' warning' : ' warnings'));
    return bits.join(' · ');
  }
  D.describe = describe;

  // reply helper used by option handlers
  D.respond = (n, tag, ok, o = {}) => {
    const lines = ok ? o.yes || COMPLY[tag] : o.no || DEFY[tag];
    if (lines) N.say(n, U.pick(lines), { pri: 3, kind: !ok && tag === 'SNARK' ? 'shout' : 'say' });
    if (ok) { n.complied = true; n.mood.anger = Math.max(0, n.mood.anger - 0.3); n.mood.shame = Math.min(1, n.mood.shame + (tag === 'SNARK' ? 0.6 : 0.2)); if (tag === 'SNARK') LC.Player.flashExpr('smug', 1.5); }
    else {
      if (tag === 'WARN') { n.warnings = (n.warnings || 0) + 1; n.flags.warned = true; n.esc = Math.max(n.esc || 1, 2); LC.stat('warnings'); }
      if (tag === 'SNARK') { n.mood.anger = Math.min(1, n.mood.anger + 0.35); }
      if (tag === 'CALM') n.mood.anger = Math.min(1, n.mood.anger + 0.05);
    }
    if (tag === 'WARN' && ok) { n.warnings = (n.warnings || 0) + 1; n.flags.warned = true; LC.stat('warnings'); }
  };
  // "You're leaving." -> grab them if they're in reach
  D.eject = (n, line) => {
    const p = LC.G.player;
    n.flags.warned = true;
    n.flags.toldToLeave = true;
    if (line) N.say(n, line, { pri: 3 });
    if (!p.grab && !n.gone && U.dist(p.x, p.y, n.x, n.y) < 90 && !(n.z > 20)) {
      p.tool = 'hands';
      setTimeout(() => { if (!n.gone && !p.grab && n.state === 'inside') LC.Player.grabNPC(n); }, 500);
    }
  };
  // a short scripted exchange: [['npc'|'you', text], ...] then fn
  D.seq = (n, steps, done) => {
    let t = 0;
    for (const [who, text] of steps) {
      setTimeout(() => { if (n.gone) return; if (who === 'you') LC.Player.say(text); else N.say(n, text, { pri: 3 }); }, t);
      t += 700 + text.length * 38;
    }
    if (done) setTimeout(() => { if (!n.gone) done(); }, t);
  };

  /* ---------------- talk types ---------------- */
  function staffTalk(n) {
    const lines = {
      bartender: ['Water? Take the jug.', "If you're here to tell me about the bar dancer, I know.", 'I have been making mojitos for nine hours. Speak quickly.'],
      dj: ["Don't. Don't request anything.", 'The crowd is good tonight. I said it. Sorry.', 'Is it true someone is riding the flamingo?'],
      coat: ['I have eleven phones, one goldfish, and a hat that smells like soup.', 'Lost property is behind me. It is growing.'],
      door: ['Queue is fine. The people in it are not.', "You look tired. You've looked tired since 2019.", 'Go on. Floor needs you.'],
      bouncer: ['Radio if you need me.', 'I will help you as soon as I finish this thought.', 'Busy night?'],
      host: ['Nobody gets in. Except the people who get in.', "I'm on a break. Spiritually."],
      manager: ['Why are you talking to me? Is something on fire?', 'The flamingo cost more than your car.', 'Is the plant still here? Check the plant.'],
      chef: ['Kitchen is closed. It was never open.', 'There is a man. Eating garnish. Again.'],
    };
    N.say(n, U.pick(lines[n.role] || ['Busy.']), { pri: 2 });
    LC.Player.say(U.pick(['Evening.', 'Alright?', 'How are we doing?']));
  }

  function normalTalk(ctx) {
    const n = ctx.n;
    ctx.open = U.pick(['Heyyyy.', 'Oh. Hi. Am I in trouble?', 'Great night, right?', 'Are you a real bouncer?', 'Is the DJ taking requests?', "I'm being SO good tonight.", 'Do you like my outfit? Be honest. Lie.', 'Is it true there is a flamingo?']);
    ctx.opts = [
      { text: 'Evening.', tag: 'ASK', fn: () => N.say(n, U.pick(['Evening!', 'Hi!', 'Nice jacket.', 'You too!']), { pri: 2 }) },
      { text: 'You alright?', tag: 'ASK', fn: () => N.say(n, U.pick(["I'm great! I'm the best!", 'Never better.', "I'm... yeah. Yeah!", 'I think I need water. Is that bad?']), { pri: 2 }) },
      { text: 'Drink some water.', tag: 'HELP', fn: () => { const p = LC.G.player; if (p.inv.water > 0) { p.inv.water--; LC.Player.giveWater(n); } else { n.wantsWater = true; N.say(n, U.pick(['Water? What am I, a plant?', 'Fine. Fine.', 'Ooh. Hydration.']), { pri: 2 }); } } },
      { text: "You're leaving.", tag: 'OUT', fn: () => { N.say(n, U.pick(['What?! What did I do?', "You can't just— can you just?"]), { pri: 3 }); D.eject(n); } },
    ];
    return true;
  }
  function drunkTalk(ctx) {
    const n = ctx.n;
    ctx.open = U.pick(['I love you, man.', "I'm not drunk. You're drunk.", 'Is the floor moving or is it me? Is it you?', 'Where are my friends. Are YOU my friends?', 'I could fight a horse. A small horse.']);
    ctx.opts = [
      { text: 'Drink this.', tag: 'HELP', fn: () => { const p = LC.G.player; if (p.inv.water > 0) { p.inv.water--; LC.Player.giveWater(n); } else N.say(n, "Drink what? You don't have anything.", { pri: 2 }); } },
      { text: "Let's get you a taxi.", tag: 'HELP', fn: () => { if (D.attempt(n, 'HELP', 0.15)) { N.say(n, U.pick(['A taxi. Yes. I love taxis.', 'Okay. Okay. Is it a nice taxi?']), { pri: 3 }); LC.Incidents.follow(n, 'taxi'); } else N.say(n, U.pick(['No! The night is YOUNG.', 'One more song.']), { pri: 3 }); } },
      { text: 'Sit down for a bit.', tag: 'CALM', fn: () => { const ok = D.attempt(n, 'CALM', 0.1); D.respond(n, 'CALM', ok, { yes: ['Sitting. Sitting is good.', 'Okay. Chair.'] }); if (ok) N.setTask(n, N.tSit(n, { dur: 60 }), 'sit'); } },
      { text: "You're done for tonight.", tag: 'OUT', fn: () => D.eject(n, U.pick(['Nooo. Okay. Yes. No.', "I'm DONE? I've only just started!"])) },
    ];
    return true;
  }
  function sleeperTalk(ctx) {
    const n = ctx.n;
    ctx.open = U.pick(['...zzz...', '...five more minutes...', '...mm, no, the ducks...', '...snrrk...']);
    ctx.opts = [
      { text: 'Rise and shine.', tag: 'SNARK', fn: () => { LC.Director.wake(n); N.say(n, U.pick(['WHERE AM I', "I wasn't asleep.", 'Is it Tuesday?']), { pri: 3 }); } },
      { text: 'Water. Now.', tag: 'HELP', fn: () => { LC.Director.wake(n); const p = LC.G.player; if (p.inv.water > 0) { p.inv.water--; LC.Player.giveWater(n); } } },
      { text: 'Taxi time.', tag: 'HELP', fn: () => { LC.Director.wake(n); N.say(n, U.pick(['Taxi. Yes. Bed.', 'Carry me.']), { pri: 3 }); LC.Incidents.follow(n, 'taxi'); } },
      { text: "You can't sleep here.", tag: 'OUT', fn: () => { LC.Director.wake(n); D.eject(n, 'I can sleep anywhere. That\'s my talent.'); } },
    ];
    return true;
  }
  function lostTalk(ctx) {
    const n = ctx.n, lost = n.lost, p = LC.G.player;
    const have = p.pocket.find((it) => it.owner === n.id || (lost.kind === it.kind && lost.any));
    ctx.open = U.pick(L().lostAsk[lost.kind] || ['Have you seen my thing?']);
    ctx.opts = [];
    if (have) ctx.opts.push({ text: 'This one?', tag: 'HELP', fn: () => LC.Incidents.returnItem(n, have) });
    if (lost.kind === 'friend' && lost.friend && lost.friend.followingPlayer) ctx.opts.push({ text: 'Found him.', tag: 'HELP', fn: () => LC.Incidents.reunite(n, lost.friend) });
    ctx.opts.push({ text: 'What does it look like?', tag: 'ASK', fn: () => N.say(n, lost.kind === 'shoe' ? 'Like this one. But the other one.' : lost.kind === 'friend' ? "He's got a face. Hair. Probably." : lost.kind === 'jacket' ? "It's jacket-coloured." : "It looks like a phone. It's got my whole LIFE on it.", { pri: 3 }) });
    ctx.opts.push({ text: "I'll keep an eye out.", tag: 'HELP', fn: () => { N.say(n, U.pick(['You are a HERO.', 'Thank you thank you thank you']), { pri: 3 }); if (lost.inc) LC.Incidents.notice(lost.inc, 'told'); } });
    if (ctx.opts.length < 4) ctx.opts.push({ text: 'Have you tried being less drunk?', tag: 'SNARK', fn: () => N.say(n, U.pick(["I have not tried that.", 'Rude. Accurate.']), { pri: 3 }) });
    return true;
  }
  function bannedTalk(ctx) {
    const n = ctx.n;
    ctx.open = U.pick(["Hi! First time here.", "Evening! Lovely club. Never been.", 'Hello, stranger.']);
    ctx.opts = [
      { text: "Didn't I throw you out?", tag: 'WARN', fn: () => { N.say(n, U.pick(["No. That was my twin.", "I've never been here in my life.", 'I think you are thinking of a different hat.']), { pri: 3 }); n.esc = Math.max(n.esc || 1, 2); } },
      { text: 'Nice hat.', tag: 'SNARK', fn: () => { N.say(n, U.pick(["It's a disguise— it's a hat. Just a hat.", 'Thanks. It is new. For reasons.']), { pri: 3 }); n.mood.shame += 0.4; } },
      { text: 'Out. Again.', tag: 'OUT', fn: () => D.eject(n, U.pick(['How did you KNOW?', 'The hat was supposed to work!'])) },
    ];
    return true;
  }
  function closingTalk(ctx) {
    const n = ctx.n;
    const go = () => LC.Director.herd(n, 'talk');
    ctx.open = U.pick(L().closingAsk);
    const t = LC.G.clock;
    ctx.opts = [
      { text: 'No.', tag: 'WARN', fn: () => { const ok = D.attempt(n, 'WARN', 0.25); if (ok) { N.say(n, 'Why?', { pri: 3 }); setTimeout(() => LC.Player.say("Because it's " + U.clock(LC.G.clock) + '.'), 1300); setTimeout(() => { if (!n.gone) { N.say(n, '...fair.', { pri: 3 }); go(); N.setTask(n, N.tLeave(n), 'leave'); } }, 3200); } else D.respond(n, 'WARN', false); } },
      { text: "Party's over.", tag: 'CALM', fn: () => { const ok = D.attempt(n, 'CALM', 0.3); D.respond(n, 'CALM', ok, { yes: ['Okay. Okay. Bye flamingo.', 'Fine. Where is the afterparty?'] }); if (ok) { go(); N.setTask(n, N.tLeave(n), 'leave'); } } },
      { text: 'The lights are on. Look at the floor.', tag: 'SNARK', fn: () => { N.say(n, U.pick(['Oh god. Oh no.', 'Was it like that the whole time?', "I'm going. I'm going."]), { pri: 3 }); go(); N.setTask(n, N.tLeave(n), 'leave'); } },
      { text: 'Out.', tag: 'OUT', fn: () => D.eject(n) },
    ];
    void t;
    return true;
  }
  function argueTalk(ctx) {
    const n = ctx.n;
    const arg = LC.Social.argumentOf(n), f = LC.Social.fightOf(n);
    ctx.open = f ? U.pick(['HE STARTED IT!', 'Stay out of this!', 'Not NOW!']) : U.pick(['He spilled my DRINK!', "Tell him! Tell him he's wrong!", 'This is between me and HIM.', 'Did you SEE that?']);
    ctx.opts = [
      { text: 'Everyone take a breath.', tag: 'CALM', fn: () => { const ok = D.attempt(n, 'CALM', f ? -0.3 : 0); D.respond(n, 'CALM', ok); if (ok) { if (arg) LC.Social.calmArgument(arg, 0.45); if (f) LC.Social.removeFighter(n); } else if (arg) arg.heat += 0.1; } },
      { text: 'You. Bar. Now. You. Dance floor.', tag: 'WARN', fn: () => { const ok = D.attempt(n, 'WARN', 0.1); D.respond(n, 'WARN', ok, { yes: ['Fine! I was going to the bar anyway.', 'Whatever. HE can go to the bar.'] }); if (ok) { if (arg) { LC.Social.calmArgument(arg, 0.7); arg.separated = true; } if (f) LC.Social.removeFighter(n); N.setTask(n, N.tDrink(n), 'drink'); } } },
      { text: "Whoever's still shouting in five seconds leaves.", tag: 'WARN', fn: () => { const ok = D.attempt(n, 'WARN', 0.2); D.respond(n, 'WARN', ok); if (ok && arg) LC.Social.calmArgument(arg, 0.5); if (ok && f) LC.Social.removeFighter(n); } },
      { text: 'Is this about the drink? It is always about the drink.', tag: 'SNARK', fn: () => { const ok = D.attempt(n, 'SNARK'); D.respond(n, 'SNARK', ok, { yes: ['...it was about the drink.', 'It was a GOOD drink.'] }); if (ok && arg) LC.Social.calmArgument(arg, 0.4); if (!ok && arg) arg.heat += 0.15; } },
    ];
    return true;
  }

  /* ---------------- escort negotiations ---------------- */
  function escortTalk(ctx, g) {
    const n = ctx.n, type = g.type;
    const keep = () => { /* keep dragging */ };
    if (type === 'father') {
      ctx.open = 'Do you know who my father is?';
      ctx.opts = [
        { text: 'I barely know who you are.', tag: 'SNARK', fn: () => { N.say(n, U.pick(["I'm— I'm SOMEBODY.", 'Rude!']), { pri: 3 }); n.mood.shame += 0.5; } },
        { text: 'Great. Call him. He can pick you up.', tag: 'SNARK', fn: () => N.say(n, U.pick(["He's... in Monaco.", "He doesn't pick up for me."]), { pri: 3 }) },
        { text: 'Does he also get thrown out?', tag: 'SNARK', fn: () => N.say(n, U.pick(['...only once.', 'That was ONE time.']), { pri: 3 }) },
        { text: "Exit's behind you.", tag: 'OUT', fn: keep },
      ];
      return true;
    }
    if (type === 'owner') {
      ctx.open = 'I know the owner.';
      ctx.opts = [
        { text: "Great. He's outside. Let's go find him.", tag: 'OUT', fn: () => N.say(n, "...he's outside?", { pri: 3 }) },
        { text: "The owner is a holding company in Luxembourg.", tag: 'SNARK', fn: () => { N.say(n, U.pick(['...I know HIM too.', 'Is it? Oh.']), { pri: 3 }); n.mood.shame += 0.5; } },
        { text: "What's his name?", tag: 'ASK', fn: () => N.say(n, U.pick(['...Greg?', 'Mr... Owner.', "It's— I don't have to tell YOU."]), { pri: 3 }) },
        { text: 'Tell him I said hi.', tag: 'OUT', fn: keep },
      ];
      return true;
    }
    if (type === 'briber') {
      ctx.open = 'Okay. Twenty quid and this never happened.';
      ctx.opts = [
        { text: "It's still happening.", tag: 'OUT', fn: () => N.say(n, 'Thirty?', { pri: 3 }) },
        { text: 'Put your money away.', tag: 'WARN', fn: () => N.say(n, U.pick(["It's not money. It's a gesture.", "Worth a try."]), { pri: 3 }) },
        { text: 'Is that a real twenty?', tag: 'SNARK', fn: () => N.say(n, "It's... a Monopoly twenty. It's a nice one.", { pri: 3 }) },
        { text: '...fine. Behave.', tag: 'TAKE', fn: () => { LC.stat('bribesTaken', 20); LC.Player.release(true); N.say(n, U.pick(['Pleasure doing business.', 'You won\'t regret this.']), { pri: 3 }); n.flags.bribed = true; if (n.incident) n.incident.bribed = true; LC.Director.bribeTaken(n); } },
      ];
      return true;
    }
    if (type === 'negotiator') {
      ctx.open = U.pick(['What if I leave in ten minutes?', 'Okay. Hear me out. What if I stay?']);
      ctx.opts = [
        { text: "You're leaving in zero minutes.", tag: 'OUT', fn: () => N.say(n, "That's not a counter-offer, that's a threat.", { pri: 3 }) },
        { text: 'Five minutes. Starting now.', tag: 'CALM', fn: () => { LC.Player.release(true); n.flags.warned = true; n.deadline = LC.G.t + 60; N.say(n, "Deal. You won't regret it.", { pri: 3 }); LC.Director.deadline(n); } },
        { text: 'What if you stop talking?', tag: 'SNARK', fn: () => N.say(n, "...that's fair.", { pri: 3 }) },
        { text: 'Keep walking.', tag: 'OUT', fn: keep },
      ];
      return true;
    }
    // everyone else just gets told
    ctx.open = U.pick(L().ej[type] ? L().ej[type].during : ['Where are we going?']);
    ctx.opts = [
      { text: "You're leaving.", tag: 'OUT', fn: () => N.say(n, U.pick(['For WHAT?!', 'I KNOW I am.', "I'm AWARE."]), { pri: 3 }) },
      { text: "Exit's that way. So are you.", tag: 'SNARK', fn: () => N.say(n, U.pick(['Wow.', 'Poetry.', 'Did you practise that?']), { pri: 3 }) },
      { text: 'Walk nicely and this is quick.', tag: 'CALM', fn: () => { if (D.attempt(n, 'CALM', 0.1)) { g.type = 'peaceful'; N.say(n, 'Fine. Nicely.', { pri: 3 }); } else N.say(n, 'NEVER.', { pri: 3 }); } },
      { text: '(let go)', tag: 'CALM', say: 'Fine. Behave.', fn: () => LC.Player.release() },
    ];
    return true;
  }

  /* ---------------- door duty ---------------- */
  function doorTalk(ctx) {
    const n = ctx.n, G = LC.G;
    if (G.queue[0] !== n) { ctx.open = U.pick(["I'm next! Am I next?", "We've been here ages."]); ctx.opts = [{ text: 'Back of the queue.', tag: 'WARN', fn: () => N.say(n, 'I AM in the queue.', { pri: 2 }) }]; return true; }
    const id = n.idCard || (n.idCard = LC.Incidents.makeId(n));
    ctx.open = U.pick(['Evening!', "Hi! I'm very sober.", "Here's my ID. It's me.", 'I know the DJ.', 'Is it a good crowd?']);
    ctx.id = id;
    ctx.opts = [
      { text: 'In you go.', tag: 'CALM', fn: () => { LC.Door.admit(n, 'player'); if (id.fake) LC.stat('fakeIdsAdmitted'); if (n.flags.banned) LC.stat('bannedAdmitted'); N.say(n, U.pick(['Yes! Thank you!', "You won't regret this.", 'Legend.']), { pri: 2 }); } },
      { text: 'Not tonight.', tag: 'OUT', fn: () => { LC.Door.deny(n, 'player'); if (id.fake) { LC.stat('fakeIdsCaught'); N.say(n, U.pick(['How did you know?', 'It says 1987! Right there!', "That's a real hologram!"]), { pri: 2 }); } else if (n.flags.banned) { LC.stat('bannedCaught'); N.say(n, U.pick(["It's a different hat!", 'Worth a try.']), { pri: 2 }); } else { LC.stat('refusedEntry'); N.say(n, U.pick(['What? Why?', 'Is it the shoes?', 'Unbelievable.']), { pri: 2 }); } } },
      { text: 'Arms out.', tag: 'WARN', say: 'Arms out. Metal detector.', fn: () => LC.Incidents.wand(n) },
    ];
    if (n.flags.banned) ctx.opts.push({ text: "Didn't I throw you out earlier?", tag: 'SNARK', fn: () => { N.say(n, U.pick(['That was my twin.', "I've never been here.", 'Different hat, different man.']), { pri: 3 }); } });
    LC.stat('idsLookedAt');
    return true;
  }
})();
