/* Last Call — the shift report. Numbers, a grade, and management's honest opinion. */
(function () {
  'use strict';
  const { U } = LC;
  const Rp = (LC.Report = {});
  const SAVE = 'lastcall.progress.v1';
  Rp.progress = () => U.load(SAVE, { unlocked: 0, best: {}, totals: {}, nights: 0 });
  Rp.saveProgress = (p) => U.save(SAVE, p);

  const S = (st, k) => st[k] || 0;
  Rp.score = (G) => {
    const st = G.stats;
    const avgF = G.funcSamples ? G.funcSum / G.funcSamples : 70;
    let s = 62;
    s += S(st, 'incidentsResolved') * 2.2 + S(st, 'peopleRescued') * 2 + S(st, 'stolenRecovered') * 2 + S(st, 'staresWon') * 1.2 + S(st, 'fightsPrevented') * 3 + S(st, 'fightsStopped') * 2.5;
    s += S(st, 'vomitCleaned') * 0.8 + S(st, 'messCleaned') * 0.15 + S(st, 'glassSwept') * 0.2;
    s -= S(st, 'fightsNotPrevented') * 4 + S(st, 'brokenFurniture') * 1.5 + S(st, 'clubDamage') / 200 + S(st, 'customerComplaints') * 1.2 + S(st, 'securityComplaints') * 4;
    s -= S(st, 'policeVisits') * 9 + S(st, 'incidentsMissed') * 2.2 + S(st, 'incidentsFailed') * 2 + S(st, 'innocentEjected') * 5 + S(st, 'stillInsideAt5') * 2;
    s += (avgF - 60) * 0.45;
    // an empty club by twenty past four is worth something
    if (st.clearedAt) s += U.clamp((468 - st.clearedAt) / 6, 0, 6);
    if (st.shutDown) s -= 40;
    return U.clamp(Math.round(s), 0, 100);
  };
  Rp.grade = (score) => (score >= 95 ? 'S' : score >= 84 ? 'A' : score >= 71 ? 'B' : score >= 57 ? 'C' : score >= 42 ? 'D' : 'F');
  const GRADE_LINE = {
    S: 'Suspiciously competent. Management assumes you are lying.',
    A: 'The club functioned. Management is confused and grateful.',
    B: 'Management considers this substantial progress.',
    C: 'The building is still standing. That is the bar, and you cleared it.',
    D: 'Management has written your name on a whiteboard. Not in a good column.',
    F: 'Management would like to discuss your future. Briefly.',
  };

  function summary(G) {
    const st = G.stats, lines = [];
    const add = (w, t) => lines.push({ w, t });
    const n = (k) => S(st, k);
    const g = n('glassesBroken');
    if (g <= 3) add(2, 'Only ' + g + ' glass' + (g === 1 ? ' was' : 'es were') + ' broken tonight. Management considers this substantial progress.');
    else if (g >= 15) add(2.5, g + ' glasses broken. The bar is now technically a beach.');
    if (n('fights') === 0) add(2.5, 'No fights. Nobody believes you.');
    else if (n('fights') >= 3) add(2.5, n('fights') + ' fights. Several of them were the same fight, restarting.');
    if (n('policeVisits')) add(3, 'The police visited ' + U.plural(n('policeVisits'), 'time') + '. They are starting to recognise the music.');
    if (n('signsPlaced') >= 4) add(2, 'You deployed ' + n('signsPlaced') + ' wet floor signs. Management has ordered more. The signs are winning.');
    if (n('slips') >= 5) add(2, n('slips') + ' people slipped. The floor remains undefeated.');
    if (n('vomitCleaned') >= 3) add(2, 'You mopped up ' + n('vomitCleaned') + ' separate vomits. Your mop has asked for a transfer.');
    if (n('stolenLost') >= 1) add(3, 'Something left the building that should not have. Management would like to know why the plant is gone.');
    if (n('peopleFoundSleeping') >= 2) add(2, n('peopleFoundSleeping') + ' people were found asleep. One of them was in the coats.');
    if (n('ejectedByYou') >= 10) add(2, n('ejectedByYou') + ' people ejected by you personally. The pavement outside is fully booked.');
    if (n('ejected') === 0) add(2, 'Nobody was thrown out. Either it was a lovely night or you were hiding in the toilets.');
    if (n('innocentEjected')) add(3, U.plural(n('innocentEjected'), 'person was', 'people were') + ' thrown out for, as far as anyone can tell, standing.');
    if (n('staresWon') >= 3) add(2.5, n('staresWon') + ' problems solved with eye contact alone. HR has concerns.');
    if (n('confusedOutside') >= 2) add(2.5, n('confusedOutside') + ' strangers left in a conga line and are still outside, confused.');
    if (LC.Map.flamingo.tipped) add(4, 'The flamingo fell. Management is inconsolable.');
    if (n('undetectedJacketVodka')) add(2, 'Somebody went home with a jacket full of vodka. You will never know who.');
    if (n('bathroomVisits') >= 6) add(1.5, 'You survived ' + n('bathroomVisits') + ' trips into the toilets. Some of you came back.');
    if (n('musicHijacked')) add(2, 'The DJ was hijacked. For a brief moment, it was polka night.');
    if (n('bribesTaken')) add(3, 'You accepted £' + n('bribesTaken') + ' in "gestures". It was Monopoly money.');
    if (n('fireAlarms')) add(3, 'The fire alarm went off. There was no fire. There was a man who wanted the lights on.');
    if (n('powerCuts')) add(2, 'The power went out. Nobody admits to what happened in the dark.');
    if (n('fingersPeeled') >= 2) add(2, 'You peeled ' + n('fingersPeeled') + ' sets of fingers off the furniture. The furniture thanks you.');
    if (n('furnitureEjected')) add(2.5, 'A chair was thrown out with its owner. It has been readmitted.');
    if (st.shutDown) add(5, 'The police closed the club early. Management would like a word. Several words.');
    else if (st.clearedAt && st.clearedAt < 440) add(2.2, 'Club cleared by ' + U.clock(st.clearedAt) + '. The cleaners have never seen anything like it.');
    else if (st.clearedAt && st.clearedAt > 465) add(1.5, 'The last guest left at ' + U.clock(st.clearedAt) + '. The cleaners watched. They did not help.');
    else if (n('stillInsideAt5')) add(2.5, n('stillInsideAt5') + ' people were still inside at five. The cleaners mopped around them.');
    const avgF = G.funcSamples ? G.funcSum / G.funcSamples : 70;
    if (avgF > 80) add(1.5, 'The club functioned. Mostly. Occasionally on purpose.');
    else if (avgF < 45) add(2, 'The club did not so much function as happen.');
    if (!lines.length) add(1, 'It was a night. It happened. You were there.');
    lines.sort((a, b) => b.w - a.w + (Math.random() - 0.5));
    return lines.slice(0, 4).map((l) => l.t);
  }

  const ROWS = [
    ['People ejected', 'ejected'], ['Fights prevented', 'fightsPrevented'], ['Fights not prevented', 'fights'], ['Fights you broke up', 'fightsStopped'],
    ['Broken furniture', 'brokenFurniture'], ['Drinks spilled', 'drinksSpilled'], ['Glasses broken', 'glassesBroken'], ['People rescued', 'peopleRescued'],
    ['People found sleeping', 'peopleFoundSleeping'], ['Stolen objects recovered', 'stolenRecovered'], ['Stolen objects lost', 'stolenLost'], ['Bathrooms survived', 'bathroomVisits'],
    ['Club damage', 'clubDamage', (v) => '£' + v.toLocaleString()], ['Customer complaints', 'customerComplaints'], ['Security complaints', 'securityComplaints'], ['Police visits', 'policeVisits'],
    ['Random objects discovered', 'randomObjects'], ['Vomit mopped', 'vomitCleaned'], ['Wet floor signs deployed', 'signsPlaced'], ['Stare-downs won', 'staresWon'],
    ['Sarcastic remarks', 'sarcasticRemarks'], ['Conga participants', 'congaJoiners'], ['IDs checked by you', 'idsChecked'], ['Problems you never saw', 'incidentsMissed'],
  ];

  Rp.show = (G, regNotes) => {
    const el = document.getElementById('report');
    const score = Rp.score(G), grade = Rp.grade(score);
    const st = G.stats;
    const prog = Rp.progress();
    const key = 'n' + G.nightIndex;
    const prevBest = prog.best[key];
    if (!prevBest || score > prevBest.score) prog.best[key] = { score, grade };
    prog.unlocked = Math.max(prog.unlocked, G.nightIndex + 1);
    prog.nights++;
    for (const [, k] of ROWS) prog.totals[k] = (prog.totals[k] || 0) + (st[k] || 0);
    Rp.saveProgress(prog);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const rows = ROWS.map(([label, k, fmt]) => '<div class="row' + ((st[k] || 0) === 0 ? ' zero' : '') + '"><span>' + label + '</span><b>' + (fmt ? fmt(st[k] || 0) : st[k] || 0) + '</b></div>').join('');
    const moments = (G.history || []).filter((h) => h.noticed && h.state !== 'dropped').slice(-5).reverse().map((h) => '<li class="' + (h.state === 'resolved' ? 'ok' : 'bad') + '"><i>' + U.clock(h.t) + '</i> ' + esc(h.title) + '</li>').join('');
    el.querySelector('#rpNight').textContent = 'NIGHT ' + (G.nightIndex + 1) + ' · ' + G.night.day.toUpperCase() + ' · ' + G.night.tag.toUpperCase();
    el.querySelector('#rpGrade').textContent = grade;
    el.querySelector('#rpGrade').dataset.g = grade;
    el.querySelector('#rpScore').textContent = score + '/100' + (prevBest ? ' · best ' + Math.max(prevBest.score, score) : '');
    el.querySelector('#rpVerdict').textContent = GRADE_LINE[grade];
    el.querySelector('#rpRows').innerHTML = rows;
    el.querySelector('#rpSummary').innerHTML = summary(G).map((l) => '<p>' + esc(l) + '</p>').join('');
    el.querySelector('#rpMoments').innerHTML = moments || '<li>You did not notice anything. That does not mean nothing happened.</li>';
    el.querySelector('#rpRegulars').innerHTML = (regNotes || []).map((l) => '<li>' + esc(l) + '</li>').join('') || '<li>No regulars tonight. Enjoy it while it lasts.</li>';
    el.hidden = false;
    el.scrollTop = 0;
  };
})();
