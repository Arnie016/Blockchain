/* Last Call — heads-up display. DOM for text (clock, meter, objectives, radio, tools, dialogue,
   cards); the canvas gets the in-world overlays (stare meter, grip bar, name tags). */
(function () {
  'use strict';
  const { U, Map: M } = LC;
  const H = (LC.HUD = {});
  const $ = (id) => document.getElementById(id);
  let el = {};
  let lastObjKey = '', lastRadioKey = '', lastHotKey = '', lastPrompt = '', dialogCtx = null;

  H.init = () => {
    el = {
      hud: $('hud'), clock: $('clock'), phase: $('phase'), night: $('nightLabel'), meter: $('meterFill'), meterVal: $('meterVal'), meterBox: $('meterBox'), inside: $('inside'), stam: $('stamFill'),
      obj: $('obj'), flash: $('flash'), flashT: $('flashT'), flashS: $('flashS'), toasts: $('toasts'), radio: $('radio'), prompt: $('prompt'),
      dialog: $('dialog'), dTitle: $('dTitle'), dInfo: $('dInfo'), dLine: $('dLine'), dOpts: $('dOpts'), dEsc: $('dEsc'), card: $('card'), banner: $('banner'),
      hotbar: $('hotbar'), will: $('willFill'), face: $('face'), pocket: $('pocket'),
    };
    buildHotbar();
    el.dOpts.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) LC.Dialogue.pick(+b.dataset.i); });
    el.hotbar.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) LC.Player.setTool(b.dataset.tool); });
  };

  /* ---------------- tool icons ---------------- */
  function icon(id) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32); g.lineCap = 'round'; g.lineJoin = 'round';
    switch (id) {
      case 'hands': g.fillStyle = '#e2ad86'; g.beginPath(); g.ellipse(0, 6, 12, 13, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { g.save(); g.translate(-9 + i * 6, -6); g.rotate(-0.15 + i * 0.1); g.fillRect(-2.5, -14, 5, 16); g.beginPath(); g.arc(0, -14, 2.5, 0, 7); g.fill(); g.restore(); } g.save(); g.translate(12, 4); g.rotate(0.9); g.fillRect(-2.5, -12, 5, 12); g.restore(); break;
      case 'mop': g.strokeStyle = '#a07a4e'; g.lineWidth = 4; g.beginPath(); g.moveTo(-14, -22); g.lineTo(8, 14); g.stroke(); g.fillStyle = '#d8d8cc'; for (let i = -4; i <= 4; i++) g.fillRect(8 + i * 2.2, 12, 1.8, 14); break;
      case 'broom': g.strokeStyle = '#a07a4e'; g.lineWidth = 4; g.beginPath(); g.moveTo(-14, -22); g.lineTo(6, 12); g.stroke(); g.fillStyle = '#e0b85a'; g.beginPath(); g.moveTo(-2, 10); g.lineTo(16, 10); g.lineTo(20, 24); g.lineTo(-6, 24); g.fill(); break;
      case 'sign': g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(-14, 24); g.lineTo(-5, -24); g.lineTo(5, -24); g.lineTo(14, 24); g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 2.2; g.beginPath(); g.arc(-1, -6, 2.6, 0, 7); g.moveTo(-1, -3); g.lineTo(3, 6); g.lineTo(8, 8); g.moveTo(1, 1); g.lineTo(-5, 3); g.moveTo(3, 6); g.lineTo(-3, 12); g.stroke(); break;
      case 'water': g.fillStyle = 'rgba(170,215,255,0.9)'; g.fillRect(-8, -14, 16, 36); g.fillStyle = '#3a8ad8'; g.fillRect(-9, -20, 18, 7); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-5, -8, 3, 24); break;
      case 'breath': g.fillStyle = '#2a2a30'; g.fillRect(-10, -20, 20, 40); g.fillStyle = '#6aff8a'; g.fillRect(-7, -15, 14, 10); g.fillStyle = '#111'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillText('.08', 0, -7); g.fillStyle = '#555'; g.fillRect(-3, -28, 6, 9); break;
      case 'zip': g.strokeStyle = '#1a1a1e'; g.lineWidth = 3; g.beginPath(); g.ellipse(-4, 0, 12, 16, 0.3, 0, 7); g.stroke(); g.beginPath(); g.ellipse(6, 2, 12, 16, -0.3, 0, 7); g.stroke(); g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.ellipse(-4, 0, 12, 16, 0.3, 0, 7); g.stroke(); break;
      case 'rope': g.strokeStyle = '#b0122e'; g.lineWidth = 4; g.beginPath(); g.moveTo(-20, -6); g.quadraticCurveTo(0, 14, 20, -6); g.stroke(); g.fillStyle = '#d9b04a'; g.fillRect(-23, -18, 5, 40); g.fillRect(18, -18, 5, 40); break;
      case 'aid': g.fillStyle = '#2a9a4a'; g.fillRect(-18, -14, 36, 30); g.fillStyle = '#fff'; g.fillRect(-3, -9, 6, 20); g.fillRect(-10, -2, 20, 6); g.fillStyle = '#1a6a32'; g.fillRect(-6, -20, 12, 6); break;
    }
    return c;
  }
  function buildHotbar() {
    el.hotbar.innerHTML = '';
    LC.Player.TOOLS.forEach((t, i) => {
      const d = document.createElement('button');
      d.className = 'slot'; d.dataset.tool = t.id; d.type = 'button';
      d.setAttribute('aria-label', t.name);
      d.title = t.name + ' — ' + t.hint;
      const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1;
      const n = document.createElement('span'); n.className = 'n';
      d.append(icon(t.id), k, n);
      el.hotbar.appendChild(d);
    });
  }

  /* ---------------- text + panels ---------------- */
  H.phaseBanner = (name, time) => {
    el.banner.innerHTML = '<span class="bt">' + time + '</span><span class="bn">' + name + '</span>';
    el.banner.classList.remove('on'); void el.banner.offsetWidth; el.banner.classList.add('on');
  };
  H.showDialog = (ctx) => {
    dialogCtx = ctx;
    const n = ctx.n;
    el.dTitle.textContent = ctx.title || n.name;
    el.dInfo.textContent = ctx.info || '';
    el.dLine.textContent = ctx.open ? '“' + ctx.open + '”' : '';
    el.dOpts.innerHTML = '';
    ctx.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.i = i; b.className = 'opt';
      b.innerHTML = '<span class="ok">' + (i + 1) + '</span><span class="ot"></span><span class="tag ' + (o.tag || 'ASK').toLowerCase() + '">' + tagName(o.tag) + '</span>';
      b.querySelector('.ot').textContent = o.text;
      el.dOpts.appendChild(b);
    });
    // escalation ladder
    const lvl = Math.max(1, (n.incident && n.incident.esc) || n.esc || 1);
    el.dEsc.innerHTML = ['ASK', 'WARN', 'ESCORT', 'RESISTING', 'BACKUP', 'DISASTER'].map((s, i) => '<span class="' + (i + 1 === lvl ? 'cur' : i + 1 < lvl ? 'past' : '') + '">' + (i + 1) + ' ' + s + '</span>').join('');
    if (ctx.id) {
      H.idCard(ctx.id, n);
    }
    el.dialog.hidden = false;
    document.body.classList.add('dlg');
  };
  function tagName(t) { return { CALM: 'CALM', WARN: 'WARN', OUT: 'THROW OUT', SNARK: 'SARCASM', HELP: 'HELP', ASK: 'ASK', TAKE: 'TAKE BRIBE' }[t] || t; }
  H.hideDialog = () => { el.dialog.hidden = true; dialogCtx = null; document.body.classList.remove('dlg'); if (el.card.dataset.kind === 'id') el.card.hidden = true; };

  const BAC_VERDICT = [[0.02, 'Sober. Suspiciously.'], [0.06, 'Pleasantly warm.'], [0.1, 'Legally a lamp.'], [0.14, 'Speaks fluent nonsense.'], [0.19, 'Legally a houseplant.'], [0.25, 'Mostly vodka, partly person.'], [9, 'How are you standing?']];
  function traitWord(v, words) { return words[Math.min(words.length - 1, Math.floor(v * words.length))]; }
  H.breathCard = (n) => {
    const bac = Math.max(0, (1 - n.sob) * 0.28 + U.rand(-0.004, 0.004));
    const verdict = BAC_VERDICT.find((b) => bac < b[0])[1];
    const cs = LC.NPC.cs(n), ag = LC.NPC.aggr(n);
    el.card.dataset.kind = 'breath';
    el.card.innerHTML =
      '<div class="ch">BREATHALYZER · ' + esc(n.name.toUpperCase()) + '</div>' +
      '<div class="bac">' + bac.toFixed(2) + '<small>% BAC</small></div>' +
      '<div class="verdict">' + verdict + '</div>' +
      '<dl>' +
      '<dt>Common sense</dt><dd>' + traitWord(cs, ['not detected', 'trace amounts', 'present', 'surprisingly high']) + '</dd>' +
      '<dt>Aggression</dt><dd>' + traitWord(Math.min(1, ag), ['puppy', 'simmering', 'looking for a reason', 'has found a reason']) + '</dd>' +
      '<dt>Ego</dt><dd>' + traitWord(n.tr.ego, ['modest', 'healthy', 'load-bearing', 'visible from space']) + '</dd>' +
      '<dt>Fear of security</dt><dd>' + traitWord(n.tr.fear, ['none whatsoever', 'mild', 'respectful', 'terrified of you']) + '</dd>' +
      '</dl>';
    el.card.hidden = false;
    clearTimeout(H.cardT);
    H.cardT = setTimeout(() => { el.card.hidden = true; }, 5200);
  };
  H.idCard = (id, n) => {
    el.card.dataset.kind = 'id';
    el.card.innerHTML =
      '<div class="ch">ID CHECK</div><div class="idrow"><canvas id="idFace" width="84" height="96"></canvas><div class="idtext">' +
      '<div class="idn">' + esc(id.name) + '</div><div>DOB ' + esc(id.dob) + '</div>' + (id.age !== undefined ? '<div>Age ' + id.age + '</div>' : '') +
      (id.tell ? '<div class="tell">' + esc(id.tell) + '</div>' : '') + (n.flags.banned ? '<div class="tell">You have seen this face tonight. The hat is new.</div>' : '') +
      '</div></div><div class="idq">Compare the photo to the person. Arms out runs the metal detector.</div>';
    el.card.hidden = false;
    clearTimeout(H.cardT);
    const cv = document.getElementById('idFace');
    if (cv) {
      const g = cv.getContext('2d');
      g.fillStyle = '#c9d4dc'; g.fillRect(0, 0, 84, 96);
      g.save(); g.translate(42, 132); g.scale(2.3, 2.3);
      LC.People.draw(g, { look: Object.assign({}, n.look, { hairC: id.hairC, hat: null, glasses: null }), pose: 'stand', expr: 'blank', face: Math.PI / 2 }, 0, 0, { noShadow: true, noHeld: true });
      g.restore();
    }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  /* ---------------- per frame ---------------- */
  H.cues = [];
  H.update = (dt) => {
    const G = LC.G, p = G.player;
    if (!p) return;
    el.clock.textContent = U.clock(G.clock);
    el.phase.textContent = G.phaseName || '';
    const f = Math.round(G.functioning);
    el.meterVal.textContent = f + '%';
    el.meter.style.width = f + '%';
    el.meterBox.dataset.state = f > 66 ? 'ok' : f > 33 ? 'warn' : 'bad';
    const inside = G.npcs.filter((n) => n.kind === 'guest' && (n.state === 'inside' || n.state === 'admitted')).length;
    el.inside.textContent = inside + ' inside · ' + G.queue.length + ' queuing';
    el.stam.style.width = Math.round(p.stamina * 100) + '%';
    el.will.style.width = Math.round(U.clamp(1 - (G.clock - 20) / 440, 0.04, 1) * G.functioning / 100 * 100 + 8) + '%';
    // objectives
    const O = LC.Objectives;
    const key = O.list.map((e) => e.title + e.where + e.done + e.reported).join('|');
    if (key !== lastObjKey) {
      lastObjKey = key;
      el.obj.innerHTML = O.list.slice(0, 6).map((e) => '<li class="' + (e.done ? (e.ok ? 'done' : 'fail') : e.reported ? 'rep' : '') + '"><b>' + esc(e.title) + '</b><span>' + (e.done ? esc(e.payoff || '') : esc(e.where) + (e.reported ? ' · reported' : '')) + '</span></li>').join('');
    }
    // big flash
    const fl = O.flashes[0];
    if (fl) {
      if (el.flashT.textContent !== fl.title) { el.flashT.textContent = fl.title; el.flashS.textContent = fl.sub || ''; }
      const k = fl.t;
      el.flash.style.opacity = k < 0.2 ? k / 0.2 : k > 2.3 ? Math.max(0, (2.8 - k) / 0.5) : 1;
      el.flash.style.transform = 'translateX(-50%) scale(' + (k < 0.2 ? 1.12 - k * 0.6 : 1) + ')';
    } else el.flash.style.opacity = 0;
    // toasts
    const tt = O.toasts.filter((t) => t.t >= 0).slice(0, 3);
    el.toasts.innerHTML = tt.map((t) => '<div class="toast ' + (t.ok ? 'ok' : 'bad') + '" style="opacity:' + (t.t > 3.6 ? Math.max(0, (4.2 - t.t) / 0.6) : Math.min(1, t.t * 5)).toFixed(2) + '"><b>' + esc(t.title) + '</b><span>' + esc(t.sub || '') + '</span></div>').join('');
    // radio
    const R = LC.Radio;
    const rl = R.log.slice(-4);
    const rk = rl.map((r) => r.t).join(',');
    if (rk !== lastRadioKey) {
      lastRadioKey = rk;
      el.radio.innerHTML = rl.map((r) => { const w = R.WHO[r.who] || { tag: r.who, c: '#fff' }; return '<li><i style="color:' + w.c + '">' + w.tag + '</i> ' + esc(r.text) + '</li>'; }).join('');
    }
    [...el.radio.children].forEach((li, i, a) => { const r = rl[i]; if (r) li.style.opacity = (0.45 + 0.55 * U.clamp(1 - (G.t - r.t) / 14, 0, 1)).toFixed(2); });
    // hotbar
    const hk = p.tool + JSON.stringify(p.inv) + !!p.grab + !!p.carry;
    if (hk !== lastHotKey) {
      lastHotKey = hk;
      for (const b of el.hotbar.children) {
        const t = LC.Player.toolDef(b.dataset.tool);
        b.classList.toggle('sel', p.tool === t.id);
        b.querySelector('.n').textContent = t.count ? p.inv[t.count] : '';
        b.classList.toggle('empty', !!t.count && p.inv[t.count] <= 0);
      }
    }
    // prompt
    const pr = p.prompt || '';
    if (pr !== lastPrompt) { lastPrompt = pr; el.prompt.textContent = pr; el.prompt.style.opacity = pr ? 1 : 0; }
    el.pocket.textContent = p.pocket.length ? 'Pockets: ' + p.pocket.map((i) => i.label).join(', ') : '';
    // sound cues fade
    for (const c of H.cues) c.t += dt;
    H.cues = H.cues.filter((c) => c.t < 1.8);
    drawFace(G, p, dt);
  };
  let faceT = 0;
  function drawFace(G, p, dt) {
    faceT += dt;
    if (faceT < 0.1) return;
    faceT = 0;
    const g = el.face.getContext('2d');
    g.clearRect(0, 0, 96, 96);
    g.save(); g.translate(48, 152); g.scale(3.1, 3.1);
    LC.People.draw(g, Object.assign({}, p, { pose: 'stand', z: 0, back: false, face: Math.PI / 2, heldTool: null, bubble: null }), 0, 0, { noShadow: true, noHeld: true });
    g.restore();
  }

  /* ---------------- canvas overlays (screen space, css px) ---------------- */
  H.drawScreen = (g) => {
    const G = LC.G, p = G.player;
    if (!p) return;
    // stare meter at the cursor
    const st = p.stare;
    if (st.n && st.t > 0.15 && !G.dialog) {
      const s = LC.R.toScreen(st.n.x, st.n.y, (st.n.z || 0) + 58);
      const k = Math.min(1, st.t / 3.4);
      g.save();
      g.translate(s.x, s.y);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 11, 0, 7); g.stroke();
      g.strokeStyle = st.n.incident && st.n.incident.def.stare ? '#ffd23f' : 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 6, 3.6, 0, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.fill();
      g.restore();
      // regulars get a name tag once you know them
      const tag = st.n.regular && LC.Regulars.label(st.n);
      if (tag && st.t > 0.6) { g.font = '800 13px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.fillText(tag, s.x, s.y - 18); }
    }
    // noticed troublemakers get a small chevron so you can find them in a crowd
    for (const inc of LC.Incidents.active) {
      if (!inc.noticed || !inc.n || inc.n.gone || inc.n.hidden) continue;
      const n = inc.n;
      const s = LC.R.toScreen(n.x, n.y, (n.z || 0) + 64);
      if (s.x < 0 || s.x > LC.R.cw || s.y < 0 || s.y > LC.R.ch) continue;
      const b = Math.sin(G.t * 5) * 2;
      g.fillStyle = '#ff4d5a';
      g.beginPath(); g.moveTo(s.x - 6, s.y - 8 + b); g.lineTo(s.x + 6, s.y - 8 + b); g.lineTo(s.x, s.y + b); g.closePath(); g.fill();
    }
    // grip bar while they hold onto something
    if (p.grab && p.grab.anchor) {
      const n = p.grab.npc;
      const s = LC.R.toScreen(n.x, n.y, 70);
      const w = 64, k = U.clamp(p.grab.grip / 1.7, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(s.x - w / 2 - 2, s.y - 2, w + 4, 12);
      g.fillStyle = '#ff4d5a'; g.fillRect(s.x - w / 2, s.y, w * k, 8);
      g.font = '800 12px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('GRIP — MASH SPACE', s.x, s.y - 6);
    }
    // off-screen noises
    for (const c of H.cues) {
      const cx = LC.R.cw / 2, cy = LC.R.ch / 2;
      const r = Math.min(cx, cy) - 40;
      const x = cx + Math.cos(c.a) * r, y = cy + Math.sin(c.a) * r * 0.85;
      g.globalAlpha = Math.max(0, 1 - c.t / 1.8);
      g.font = '900 ' + (18 + c.t * 6).toFixed(0) + 'px "Big Shoulders Display", sans-serif';
      g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText(c.text, x, y);
      g.globalAlpha = 1;
    }
    // hold-E hint at the door
    if (LC.Door.playerOnDuty() && G.queue[0] && !G.dialog) {
      const s = LC.R.toScreen(G.queue[0].x, G.queue[0].y, 60);
      g.font = '700 13px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23f';
      g.fillText('DOOR DUTY: [E] check ID', s.x, s.y - 10);
    }
  };
})();
