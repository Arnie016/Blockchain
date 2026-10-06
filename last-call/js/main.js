/* Last Call — the loop. Input, night setup, the fixed-step simulation, camera, dynamic lights,
   screens (title with a live club behind it, pause, report), and a few debug hooks. */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph, W: Wd, NPC: N, People: Pp } = LC;
  const T = M.T, S = M.S, P = M.P;
  const Game = (LC.Game = {});
  const $ = (id) => document.getElementById(id);
  const STEP = 1 / 60;

  const settings = Object.assign({ shift: 1, muted: false, zoom: 1, look: 0, view: '3d' }, U.load('lastcall.settings.v1', {}));
  const saveSettings = () => U.save('lastcall.settings.v1', settings);
  Game.settings = settings;
  let state = 'title';
  Game.state = () => state;

  /* ================= input ================= */
  const In = (LC.Input = { keys: new Set(), pressed: new Set(), mx: innerWidth / 2, my: innerHeight / 2, lmb: false, lmbPressed: false, touch: false, joy: { x: 0, y: 0, on: false }, aimed: false });
  const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const k = e.code;
    if (k === 'Tab' || k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
    if (!In.keys.has(k)) In.pressed.add(k);
    In.keys.add(k);
    if (state !== 'play') { if (state === 'pause' && (k === 'Escape' || k === 'KeyP')) resume(); return; }
    const G = LC.G;
    if (G.dialog && /^Digit[1-4]$/.test(k)) { LC.Dialogue.pick(+k.slice(5) - 1); In.pressed.delete(k); return; }
    if (!G.dialog && /^Digit[1-5]$/.test(k) && LC.Fun) { LC.Fun.use(+k.slice(5)); return; }
    switch (k) {
      case 'Tab': LC.CCTV.toggle(); break;
      case 'Escape': if (G.dialog) LC.Dialogue.close(); else if (LC.CCTV.isOpen()) LC.CCTV.close(); else pause(); break;
      case 'KeyP': pause(); break;
      case 'KeyF': G.player.flash = !G.player.flash; LC.sfx('click', 0, 0, { ui: true }); break;
      case 'KeyQ': callBackup(); break;
      case 'KeyZ': if (LC.R.is3D) LC.R.cycleZoom(); else { settings.zoom = settings.zoom === 1 ? 0.72 : 1; saveSettings(); } break;
      case 'KeyM': toggleMute(); break;
      case 'KeyH': { const h = $('helpCard'); h.hidden = !h.hidden; break; }
    }
    if (LC.CCTV.isOpen()) {
      if (k === 'ArrowRight' || k === 'KeyD') document.getElementById('camNext').click();
      if (k === 'ArrowLeft' || k === 'KeyA') document.getElementById('camPrev').click();
      if (k === 'Backspace') document.getElementById('camBack').click();
    }
  });
  addEventListener('keyup', (e) => In.keys.delete(e.code));
  addEventListener('blur', () => { In.keys.clear(); In.lmb = false; });
  const canvas = $('game');
  // 3D: click locks the mouse for GTA-style looking; if the browser refuses, right-drag looks
  const locked = () => document.pointerLockElement === canvas;
  In.locked = locked;
  let dragLook = null;
  function tryLock() {
    if (!LC.R.is3D || locked() || In.touchDevice) return false;
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { In.noLock = true; }); } catch (e) { In.noLock = true; }
    return true;
  }
  Game.unlock = () => { if (locked() && document.exitPointerLock) document.exitPointerLock(); };
  document.addEventListener('pointerlockerror', () => { In.noLock = true; });
  canvas.addEventListener('mousemove', (e) => {
    if (LC.R.is3D && locked()) { LC.R.look(e.movementX || 0, e.movementY || 0); In.mx = LC.R.cw / 2; In.my = LC.R.ch * 0.46; In.aimed = true; In.touch = false; return; }
    if (dragLook) { LC.R.look((e.clientX - dragLook.x) * 1.4, (e.clientY - dragLook.y) * 1.4); dragLook.x = e.clientX; dragLook.y = e.clientY; }
    In.mx = e.clientX; In.my = e.clientY; In.touch = false; In.aimed = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    LC.Audio.resume();
    if (LC.R.is3D && state === 'play' && !locked() && !In.noLock && e.button === 0 && !(LC.G && LC.G.dialog) && !LC.CCTV.isOpen()) { if (tryLock()) return; }
    if (LC.R.is3D && e.button === 2 && !locked()) { dragLook = { x: e.clientX, y: e.clientY }; return; }
    if (e.button === 0) { In.lmb = true; In.lmbPressed = true; }
    if (e.button === 2) In.pressed.add('Space');
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) In.lmb = false; if (e.button === 2) dragLook = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let wheelT = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (LC.R.is3D) { LC.R.zoomBy(e.deltaY); return; }
    if (state !== 'play' || performance.now() - wheelT < 90) return;
    wheelT = performance.now();
    LC.Player.cycleTool(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  /* ---------------- touch ---------------- */
  const touch = { joyId: null, ox: 0, oy: 0, aimId: null, lastTap: 0, lx: 0, ly: 0 };
  function setupTouch() {
    const tl = $('touch');
    tl.hidden = false;
    document.body.classList.add('touch');
    const knob = $('joyKnob'), base = $('joyBase');
    canvas.addEventListener('touchstart', (e) => {
      LC.Audio.resume();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && t.clientY > innerHeight * 0.35 && touch.joyId === null) {
          touch.joyId = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY;
          base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px'; base.hidden = false;
          knob.style.transform = 'translate(-50%,-50%)';
        } else if (touch.aimId === null && LC.R.is3D) {
          // 3D: drag on the right to look around, tap to look at something
          touch.aimId = t.identifier; touch.lkx = t.clientX; touch.lky = t.clientY; touch.moved = 0;
          In.mx = t.clientX; In.my = t.clientY; In.aimed = true; In.touch = true;
        } else if (touch.aimId === null) {
          touch.aimId = t.identifier;
          In.mx = t.clientX; In.my = t.clientY; In.aimed = true; In.touch = true;
          // with bare hands a tap only looks; grabbing a stranger takes a double-tap
          const now = performance.now();
          const dbl = now - touch.lastTap < 420 && Math.hypot(t.clientX - touch.lx, t.clientY - touch.ly) < 60;
          touch.lastTap = dbl ? 0 : now; touch.lx = t.clientX; touch.ly = t.clientY;
          const hands = LC.G && LC.G.player && LC.G.player.tool === 'hands';
          if (!hands || dbl) { In.lmb = true; In.lmbPressed = true; }
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.joyId) {
          let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy;
          const d = Math.hypot(dx, dy), max = 56;
          if (d > max) { dx *= max / d; dy *= max / d; }
          In.joy.x = dx / max; In.joy.y = dy / max; In.joy.on = true;
          knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        } else if (t.identifier === touch.aimId) {
          if (LC.R.is3D) { const dx = t.clientX - touch.lkx, dy = t.clientY - touch.lky; touch.moved += Math.abs(dx) + Math.abs(dy); LC.R.look(dx * 2.2, dy * 2.2); touch.lkx = t.clientX; touch.lky = t.clientY; if (touch.moved > 12) { In.mx = LC.R.cw / 2; In.my = LC.R.ch * 0.46; } }
          else { In.mx = t.clientX; In.my = t.clientY; }
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.joyId) { touch.joyId = null; In.joy.x = 0; In.joy.y = 0; In.joy.on = false; base.hidden = true; }
        if (t.identifier === touch.aimId) { touch.aimId = null; In.lmb = false; }
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    const bind = (id, fn) => { const b = $(id); b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); LC.Audio.resume(); fn(); }, { passive: false }); b.addEventListener('click', fn); };
    bind('tTalk', () => In.pressed.add('KeyE'));
    bind('tShove', () => In.pressed.add('Space'));
    const use = $('tUse');
    use.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); In.lmb = true; In.lmbPressed = true; }, { passive: false });
    use.addEventListener('touchend', () => { In.lmb = false; });
    const vis = $('tVis');
    vis.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); In.vision = true; }, { passive: false });
    vis.addEventListener('touchend', () => { In.vision = false; });
    bind('tFlash', () => { if (LC.G && LC.G.player) LC.G.player.flash = !LC.G.player.flash; });
    bind('tRadio', () => callBackup());
    bind('tCam', () => LC.CCTV.toggle());
    bind('tPause', () => pause());
  }
  if ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) { In.touchDevice = true; document.body.classList.add('touchdev'); }

  function inputFrame() {
    const k = In.keys;
    let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (In.joy.on) { dx = In.joy.x; dy = In.joy.y; }
    if (LC.CCTV.isOpen()) { dx = 0; dy = 0; }
    if (LC.R.is3D && (dx || dy)) { const b = LC.R.moveBasis(dx, dy); dx = b.dx; dy = b.dy; }
    if (LC.R.is3D && locked()) { In.mx = LC.R.cw / 2; In.my = LC.R.ch * 0.46; }
    return {
      dx, dy, sprint: k.has('ShiftLeft') || k.has('ShiftRight') || (In.joy.on && Math.hypot(In.joy.x, In.joy.y) > 0.96),
      mx: In.mx, my: In.my, lmb: In.lmb && !LC.CCTV.isOpen(), lmbPressed: In.lmbPressed && !LC.CCTV.isOpen(),
      ePressed: In.pressed.has('KeyE'), spacePressed: In.pressed.has('Space'), xPressed: In.pressed.has('KeyX'), bPressed: In.pressed.has('KeyB'), touch: In.touch, aimed: In.aimed,
    };
  }

  /* ================= night setup ================= */
  function resetWorld() {
    for (const b of Wd.barriers.slice()) Wd.removeBarrier(b);
    Ph.bodies.length = 0;
    Wd.init();
    for (const d of M.doors) { d.open = d.kind === 'arch' || d.kind === 'rope' ? 1 : 0; d.target = d.kind === 'stall' ? 1 : 0; d.occupants = 0; d.shake = 0; if (d.seg) d.seg.active = d.open < 0.5; }
    for (const s of S.bar) { s.occ = null; s.waiting = null; s.claimedBy = null; }
    for (const s of S.seats) s.occ = null;
    for (const s of S.stalls) { s.occ = []; s.broken = false; s.locked = false; }
    for (const u of S.urinals) u.occ = null;
    for (const w of S.weird) w.taken = false;
    for (const f of M.furn) { f.distort = false; f.blown = false; f.tipped = false; }
    M.flamingo.tipped = false;
    LC.Incidents.active.length = 0;
    LC.Incidents.lastStart = {};
    LC.Objectives.list.length = 0; LC.Objectives.flashes.length = 0; LC.Objectives.toasts.length = 0;
    LC.Social.procession = null;
    LC.Events.croc = null; LC.Events.influencer = null;
    LC.HUD.cues = [];
    LC.Door.calling = null;
  }
  function makeG(nightIndex, demo) {
    const night = LC.Director.night(nightIndex);
    const G = (LC.G = {
      t: 0, clock: 0, dt: STEP, nightIndex, night, shiftScale: demo ? 1 : settings.shift, demo: !!demo,
      chars: [], npcs: [], groups: [], queue: [], args: [], fights: [], police: [], events: [], history: [],
      dynLights: [], music: { energy: 0.3, beatPhase: 0, beatTime: 0, pattern: 0, palette: nightIndex % 6, drop: 0, laser: 0, stopped: false, hijacked: false, special: null },
      power: true, lightsOn: 0, alarm: false, barOpen: true, kebabOpen: false, vipRopeOpen: 0, closing: false, ending: false, emergencyOpen: false,
      functioning: 100, stats: {}, dialog: null, player: null, phaseName: '', aura: 0,
    });
    resetWorld();
    if (LC.Fun) LC.Fun.reset();
    LC.Staff.spawn();
    LC.Player.create(PLAYER_LOOKS[settings.look % PLAYER_LOOKS.length]);
    LC.Director.start(G);
    LC.Events.schedule(night);
    LC.Regulars.start();
    const p = G.player;
    LC.R.cam.x = p.x; LC.R.cam.y = p.y; LC.R.cam.zoom = LC.R.baseZoom * settings.zoom;
    return G;
  }
  const PLAYER_LOOKS = [
    { fem: false, skin: '#b8835a', hair: 'short', hairC: '#1d1612', beard: 'stubble' },
    { fem: true, skin: '#6e3f27', hair: 'braids', hairC: '#17110d', beard: null, earrings: true },
    { fem: false, skin: '#efc3a3', hair: 'buzz', hairC: '#a8743a', beard: 'full' },
    { fem: true, skin: '#e2ad86', hair: 'bun', hairC: '#3f281b', beard: null },
  ];
  Game.PLAYER_LOOKS = PLAYER_LOOKS;

  /* ================= per step ================= */
  let lastRoom = null;
  // one misbehaving system (or guest) must not stop the rest of the club
  const errCount = {};
  function oops(name, e) { errCount[name] = (errCount[name] || 0) + 1; if (errCount[name] <= 3) console.error('[' + name + ']', e); }
  function guard(name, fn, dt) { try { fn(dt); } catch (e) { oops(name, e); } }
  function step(dt, input) {
    const G = LC.G;
    G.dt = dt; G.t += dt;
    if (!G.demo) guard('player', (d) => LC.Player.update(d, input), dt);
    const list = G.npcs.slice();
    for (let i = 0; i < list.length; i++) {
      try { N.update(list[i], dt); } catch (e) { oops('npc', e); N.cancelTask && N.cancelTask(list[i]); }
    }
    guard('eject', LC.Eject.update, dt);
    guard('door', LC.Door.update, dt);
    guard('doors', (d) => M.updateDoors(d, G.chars), dt);
    guard('phys', Ph.step, dt);
    guard('social', LC.Social.update, dt);
    guard('world', Wd.update, dt);
    guard('incidents', LC.Incidents.update, dt);
    guard('director', LC.Director.update, dt);
    guard('events', LC.Events.update, dt);
    guard('regulars', LC.Regulars.update, dt);
    guard('radio', LC.Radio.update, dt);
    guard('dialogue', LC.Dialogue.update, dt);
    if (LC.Fun) guard('fun', LC.Fun.update, dt);
    if (G.vipRopeOpen && G.vipRopeT && G.t > G.vipRopeT) { G.vipRopeOpen = 0; G.vipRopeT = 0; }
    const p = G.player;
    if (p && !G.demo) {
      const r = p.room ? p.room.id : null;
      if (r !== lastRoom) {
        if (r === 'mens' || r === 'womens') LC.stat('bathroomVisits');
        if (p.room && lastRoom !== null) showRoomName(p.room.name);
        lastRoom = r;
      }
    }
  }
  let roomT = 0;
  function showRoomName(name) { const el = $('roomName'); el.textContent = name; el.style.opacity = 1; roomT = 1.6; }

  /* ================= dynamic lights (rebuilt every frame) ================= */
  function buildLights() {
    const G = LC.G, L = G.dynLights;
    L.length = 0;
    const p = G.player;
    if (p && !G.demo) {
      if (p.flash) L.push({ cone: true, x: p.x, y: p.y - 18, r: 340, a: p.face, w: 0.42, c: [255, 246, 220], i: 1.25, glow: 1, clipRoom: p.room && !p.room.outdoor ? p.room.id : null });
      L.push({ x: p.x, y: p.y - 10, r: 150, c: [150, 140, 170], i: G.power ? 0.32 : 0.12 });
    }
    for (const n of G.npcs) {
      if (n.phoneUp) {
        L.push({ x: n.x, y: n.y - 26, r: n.torch ? 90 : 36, c: n.torch ? [230, 240, 255] : [140, 190, 255], i: n.torch ? 0.8 : 0.45, glow: n.filming ? 0.35 : 0.2, gr: 10, gz: 26 });
      }
      if (n.smoking) L.push({ x: n.x + 5, y: n.y - 26, r: 12, c: [255, 120, 40], i: 0.6, glow: 0.4, gr: 5 });
    }
    // sparklers on VIP bottles
    if (G.power && G.lightsOn < 0.5) for (const t of M.vipTables) if (Math.sin(G.t * 0.3 + t.cx) > 0.93) { L.push({ x: t.cx, y: t.cy - 20, r: 60, c: [255, 210, 120], i: 0.9, glow: 0.8, gr: 16, gz: 16 }); if (Math.random() < 0.3) Wd.part('spark', t.cx + U.rand(-4, 4), t.cy, { z: 22, vx: U.rand(-30, 30), vy: U.rand(-30, 30), vz: U.rand(40, 120) }); }
    // blue lights when the police are here
    if (G.police.length) { const b = Math.sin(G.t * 10) > 0; L.push({ x: 46 * T, y: 55 * T, r: 360, c: b ? [40, 80, 255] : [255, 40, 60], i: 0.9, glow: 0.4, gr: 60 }); }
    // the emergency exit stands open, cold and green
    if (M.door('emergency').open > 0.5) L.push({ x: 34 * T, y: 7.6 * T, r: 120, c: [80, 255, 150], i: 0.5 });
    // strobe during the alarm
    if (G.alarm && Math.sin(G.t * 14) > 0.7) L.push({ x: p ? p.x : 46 * T, y: p ? p.y : 20 * T, r: 900, c: [255, 255, 255], i: 0.35 });
    if (!G.power) { for (const x of [20, 46, 70]) L.push({ x: x * T, y: 20 * T, r: 110, c: [255, 60, 40], i: 0.35 }); }
  }

  /* ================= camera ================= */
  function camera(dt) {
    if (LC.R.is3D) { LC.R.updateCamera(dt, LC.G); return; }
    const G = LC.G, c = LC.R.cam, p = G.player;
    let tx, ty;
    if (G.demo) {
      const k = G.t * 0.04;
      tx = (46 + Math.sin(k) * 14) * T; ty = (24 + Math.sin(k * 0.7) * 10) * T;
    } else {
      const ax = p.aim.x - p.x, ay = p.aim.y - p.y, al = Math.hypot(ax, ay) || 1;
      const la = Math.min(170, al * 0.22);
      tx = p.x + (ax / al) * la; ty = p.y - 16 + (ay / al) * la * 0.8;
      if (LC.CCTV.isOpen()) { tx = p.x; ty = p.y; }
    }
    c.x = U.damp(c.x, tx, G.demo ? 1 : 6, dt); c.y = U.damp(c.y, ty, G.demo ? 1 : 6, dt);
    const zt = LC.R.baseZoom * (G.demo ? 0.85 : settings.zoom);
    c.zoom = U.damp(c.zoom, zt, 4, dt);
    const hw = LC.R.cw / 2 / c.zoom, hh = LC.R.ch / 2 / c.zoom;
    c.x = U.clamp(c.x, Math.min(hw, M.W * T / 2), Math.max(M.W * T - hw, M.W * T / 2));
    c.y = U.clamp(c.y, Math.min(hh - 40, M.H * T / 2), Math.max(M.H * T - hh, M.H * T / 2));
    c.shake = Math.max(0, c.shake - dt * 22);
  }

  /* ================= drawing hooks ================= */
  Game.drawChar = (g, c) => {
    if (c.hidden) return;
    Pp.draw(g, c, c.x, c.y, { drawTool: LC.Player.drawTool });
  };
  const hooks = {
    drawChar: Game.drawChar,
    screen: (g) => { if (state === 'play') LC.HUD.drawScreen(g); },
  };

  /* ================= backup ================= */
  let lastBackup = -99;
  function callBackup() {
    const G = LC.G, p = G.player;
    if (state !== 'play') return;
    if (G.t - lastBackup < 15) { LC.Player.say(U.pick(['Backup is still coming. Allegedly.', 'They heard me the first time.'])); return; }
    // pointing at a mess? that's a job for Dolores
    const ctx = p.ctx;
    if (!p.grab && ctx && ctx.clean) {
      const r = LC.Staff.orderClean(ctx.clean);
      const what = ctx.title.toLowerCase();
      if (r === true) { LC.Radio.convo([['you', 'Dolores, ' + what + ', ' + (p.room ? p.room.name.toLowerCase() : 'here') + '.'], ['dolores', U.pick(['On my way. Slowly.', 'Of course there is.', 'I am sixty-three.'])]]); lastBackup = G.t - 10; if (LC.Aura) LC.Aura.add(15, 'Delegated'); }
      else LC.Radio.convo([['you', 'Dolores?'], ['dolores', 'I am mopping something ELSE.']]);
      return;
    }
    let target = p.grab ? p.grab.npc : (p.aimWho && p.aimWho.kind === 'guest' && U.dist(p.x, p.y, p.aimWho.x, p.aimWho.y) < 500 ? p.aimWho : null), kind = target && !p.grab ? 'eject' : 'assist';
    if (!target) {
      const f = LC.Social.fightNear(p.x, p.y, 380);
      if (f) { target = [...f.members.keys()][0]; kind = 'fight'; }
    }
    if (!target) {
      const inc = LC.Incidents.active.filter((q) => q.noticed && q.n && !q.n.gone && U.dist(q.n.x, q.n.y, p.x, p.y) < 320).sort((a, b) => U.dist(a.n.x, a.n.y, p.x, p.y) - U.dist(b.n.x, b.n.y, p.x, p.y))[0];
      if (inc) { target = inc.n; kind = 'eject'; }
    }
    const room = p.room ? p.room.name.toLowerCase() : 'somewhere';
    const b = LC.Staff.callBackup(p.x, p.y, target, kind);
    lastBackup = G.t;
    LC.stat('backupCalls');
    if (!b) { LC.Radio.convo([['you', 'Requesting backup, ' + room + '.'], ['marcus', 'Everyone is busy. You ARE the backup.']]); return; }
    const who = b.name === 'Tank' ? 'tank' : 'priya';
    LC.Radio.convo([['you', 'Unit Four requesting backup, ' + room + '.'], [who, U.pick(['On my way.', 'Coming.', "Two minutes. I'm mid-sandwich.", 'Define backup.', 'Say less.'])]]);
    if (!target) { LC.stat('securityComplaints'); setTimeout(() => LC.Radio.say('marcus', U.pick(['Unit Four, you called backup for a man eating crisps.', 'Backup for WHAT, exactly?'])), 9000); }
    else { target.esc = Math.max(target.esc || 1, 5); if (target.incident) LC.Incidents.escalate(target.incident, 5); }
  }
  Game.callBackup = callBackup;
  Game.callBackupAt = (x, y) => {
    const G = LC.G;
    const t = G.npcs.filter((n) => n.kind === 'guest' && n.state === 'inside' && U.dist(n.x, n.y, x, y) < 120).sort((a, b) => (!!b.incident - !!a.incident) || U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y))[0];
    const b = LC.Staff.callBackup(x, y, t || null, t && (t.incident || LC.Social.fightOf(t)) ? 'eject' : 'assist');
    LC.Radio.convo(b ? [['you', 'Backup, where I am looking.'], [b.name === 'Tank' ? 'tank' : 'priya', U.pick(['Moving.', 'On it.', 'Eyes on.'])]] : [['you', 'Backup?'], ['marcus', 'Everyone is busy.']]);
  };

  /* ================= screens ================= */
  function toggleMute() {
    settings.muted = !settings.muted; saveSettings();
    LC.Audio.setMuted(settings.muted);
    document.querySelectorAll('[data-mute]').forEach((b) => { b.textContent = settings.muted ? 'Sound: off' : 'Sound: on'; });
  }
  function pause() {
    if (state !== 'play') return;
    Game.unlock();
    state = 'pause';
    $('pause').hidden = false;
    LC.Dialogue.close();
  }
  function resume() {
    state = 'play';
    $('pause').hidden = true;
    LC.Audio.resume();
  }
  Game.pause = pause; Game.resume = resume;

  async function ensureAudio() {
    if (LC.Audio.ready) { LC.Audio.resume(); return; }
    const btn = $('startBtn');
    const label = btn.textContent;
    btn.disabled = true;
    try { await LC.Audio.init((p) => { btn.textContent = 'Tuning the speakers ' + Math.round(p * 100) + '%'; }); } catch (e) { console.warn('audio init failed', e); }
    btn.textContent = label;
    btn.disabled = false;
    LC.Audio.setMuted(settings.muted);
    LC.Audio.resume();
  }
  Game.start = async (nightIndex) => {
    await ensureAudio();
    $('title').hidden = true; $('report').hidden = true; $('pause').hidden = true;
    makeG(nightIndex, false);
    lastRoom = null;
    $('hud').hidden = false;
    if (In.touchDevice) setupTouchOnce();
    state = 'play';
    $('nightLabel').textContent = 'NIGHT ' + (nightIndex + 1) + ' · ' + LC.G.night.day.toUpperCase() + ' · ' + LC.G.night.tag.toUpperCase();
    LC.HUD.phaseBanner('DOORS OPEN', '9:00 PM · ' + LC.G.night.day);
    if (nightIndex === 0) LC.G.tut = { i: 0, s: null, done: false };
  };
  let touchReady = false;
  function setupTouchOnce() { if (!touchReady) { touchReady = true; setupTouch(); } }
  Game.endNight = () => {
    const G = LC.G;
    if (state === 'report') return;
    state = 'report';
    LC.Dialogue.close();
    LC.CCTV.close();
    $('hud').hidden = true;
    const notes = LC.Regulars.endNight();
    LC.Report.show(G, notes);
  };
  Game.toTitle = () => {
    $('report').hidden = true; $('pause').hidden = true; $('hud').hidden = true;
    LC.CCTV.close();
    startDemo();
    buildTitle();
    $('title').hidden = false;
  };
  function startDemo() {
    state = 'title';
    const G = makeG(Math.min(2, LC.Report.progress().unlocked), true);
    G.clock = 175;
    G.player.hidden = true; G.player.body.ghost = true; G.player.body.pinned = true;
    G.player.x = G.player.body.x = 46 * T; G.player.y = G.player.body.y = 60 * T;
    // a warm room to look at
    for (let i = 0; i < 16; i++) {
      const grp = LC.Director.spawnGroup(U.randi(2, 4), { from: S.exits[0] });
      for (const n of grp.members) {
        const p = U.pick(S.dance.concat(S.dance, S.bar));
        n.body.x = p.x + U.rand(-10, 10); n.body.y = p.y + U.rand(-10, 10);
        n.state = 'inside'; n.perm = P.GUEST; N.cancelTask(n); LC.Door.remove(n);
        n.sob = U.rand(0.4, 0.9);
      }
    }
    for (let i = 0; i < 240; i++) step(STEP, { dx: 0, dy: 0, mx: 0, my: 0 });
  }
  function buildTitle() {
    const prog = LC.Report.progress();
    const sel = $('nightSel');
    sel.innerHTML = '';
    const max = Math.max(0, prog.unlocked);
    for (let i = 0; i <= max; i++) {
      const n = LC.Director.night(i);
      const o = document.createElement('option');
      o.value = i;
      const best = prog.best['n' + i];
      o.textContent = 'Night ' + (i + 1) + ' · ' + n.day + ' · ' + n.tag + (best ? ' · best ' + best.grade : '');
      sel.appendChild(o);
    }
    sel.value = Math.min(max, prog.unlocked);
    $('shiftSel').value = String(settings.shift);
    document.querySelectorAll('[data-mute]').forEach((b) => { b.textContent = settings.muted ? 'Sound: off' : 'Sound: on'; });
    $('lookBtn').textContent = 'Uniform: ' + ['A', 'B', 'C', 'D'][settings.look % 4];
  }

  /* ================= frame ================= */
  let last = performance.now(), acc = 0;
  Game.debugSpeed = 1;
  let frameErrors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { tick(now); } catch (e) { if (frameErrors++ < 5) console.error(e); }
  }
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const G = LC.G;
    if (G && (state === 'play' || state === 'title')) {
      const scale = (G.dialog ? 0.3 : 1) * Game.debugSpeed;
      acc += dt * scale;
      const input = inputFrame();
      let steps = 0;
      const max = Game.debugSpeed > 1 ? 400 : 5;
      while (acc >= STEP && steps < max) {
        step(STEP, input);
        acc -= STEP; steps++;
        if (steps === 1) { input.ePressed = false; input.spacePressed = false; input.lmbPressed = false; input.xPressed = false; input.bPressed = false; }
      }
      if (steps >= max) acc = 0;
      In.pressed.clear(); In.lmbPressed = false;
      LC.Audio.update(dt);
      if (state === 'play') { LC.HUD.update(dt); LC.CCTV.update(dt); }
      if (roomT > 0) { roomT -= dt; if (roomT <= 0) $('roomName').style.opacity = 0; }
    }
    if (G) {
      camera(dt);
      buildLights();
      if (!LC.CCTV.isOpen() || state !== 'play') LC.R.draw(G, hooks);
      else if (LC.R.is3D) LC.R.draw(G, { skip: true });
    }
  }

  /* ================= boot ================= */
  function boot() {
    // 3D unless asked otherwise or the browser can't; the 2D renderer is the fallback
    let use3D = settings.view !== '2d' && LC.R3 && LC.R3.ok;
    if (use3D) {
      try { LC.R = LC.R3; LC.R3.init(canvas); } catch (e) { console.warn('3D renderer unavailable, using 2D', e); use3D = false; const gl = $('game3d'); if (gl) gl.remove(); }
    }
    if (!use3D) { LC.R = LC.R2D; LC.R2D.init(canvas); }
    document.body.classList.toggle('view3d', !!use3D);
    LC.HUD.init();
    LC.CCTV.init();
    LC.Regulars.load();
    addEventListener('resize', () => LC.R.resize());
    $('startBtn').addEventListener('click', () => Game.start(+$('nightSel').value || 0));
    $('shiftSel').addEventListener('change', (e) => { settings.shift = +e.target.value; saveSettings(); });
    document.querySelectorAll('[data-mute]').forEach((b) => b.addEventListener('click', toggleMute));
    $('lookBtn').addEventListener('click', () => { settings.look = (settings.look + 1) % 4; saveSettings(); buildTitle(); });
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => Game.start(LC.G.nightIndex));
    $('quitBtn').addEventListener('click', () => Game.toTitle());
    $('rpNext').addEventListener('click', () => Game.start(LC.G.nightIndex + 1));
    $('rpReplay').addEventListener('click', () => Game.start(LC.G.nightIndex));
    $('rpTitle').addEventListener('click', () => Game.toTitle());
    $('resetBtn').addEventListener('click', () => { const b = $('resetBtn'); if (b.dataset.armed) { LC.Report.saveProgress({ unlocked: 0, best: {}, totals: {}, nights: 0 }); LC.Regulars.reset(); b.textContent = 'Progress reset'; delete b.dataset.armed; buildTitle(); } else { b.dataset.armed = '1'; b.textContent = 'Click again to reset progress'; } });
    startDemo();
    buildTitle();
    const fontsDone = () => { LC.R.fontsReady(); LC.R.invalidateFloors(); window.lastCallReady = true; };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fontsDone); else fontsDone();
    requestAnimationFrame(frame);
  }

  /* ================= debug hooks (used by tests) ================= */
  LC.debug = {
    ff: (minutes) => { const G = LC.G; const target = G.clock + minutes; let n = 0; while (G.clock < target && n < 200000 && !G.ending) { step(STEP, { dx: 0, dy: 0, mx: In.mx, my: In.my }); n++; } return n; },
    run: (secs) => { for (let i = 0; i < secs * 60; i++) step(STEP, { dx: 0, dy: 0, mx: In.mx, my: In.my }); },
    start: (i) => Game.start(i || 0),
    inc: (type) => { const d = LC.Incidents.defs[type]; const n = LC.G.npcs.find((q) => q.kind === 'guest' && q.state === 'inside' && !q.incident && (!d.cand || d.cand(q) > 0)) || LC.G.npcs.find((q) => q.kind === 'guest' && q.state === 'inside' && !q.incident); return n ? LC.Incidents.start(type, n) : null; },
    event: (type) => { const G = LC.G; G.events.push({ type, at: G.clock, done: false }); },
    tp: (x, y) => { const p = LC.G.player; p.body.x = x * T; p.body.y = y * T; p.x = p.body.x; p.y = p.body.y; LC.R.cam.x = p.x; LC.R.cam.y = p.y; if (LC.R.rig) { const w = LC.R.toW(p.x, p.y, 0, { x: 0, y: 0, z: 0 }); LC.R.rig.fx = w.x; LC.R.rig.fz = w.z; } },
    look: (yaw, pitch, dist) => { const r = LC.R.rig; if (!r) return; if (yaw !== undefined) r.yaw = yaw; if (pitch !== undefined) r.pitch = pitch; if (dist !== undefined) { r.dist = r.tdist = dist; } },
    state: () => state,
    step,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
