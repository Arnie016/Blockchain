/* Last Call — loose objects: furniture that tips and breaks, mess on the floor, lost property,
   barrier ropes, wet floor signs, and a particle pool for glass, smoke and bad decisions. */
(function () {
  'use strict';
  const { U, Map: M, Phys: Ph } = LC;
  const T = M.T;
  const Wd = (LC.W = { props: [], mess: [], items: [], barriers: [], parts: [], barTop: [] });

  const PROP = {
    stool: { r: 7, m: 3, z: 18, tip: 150, hp: 60, seat: true, cost: 60 },
    chair: { r: 8, m: 4, z: 20, tip: 165, hp: 70, seat: true, cost: 90 },
    table: { r: 13, m: 11, z: 22, tip: 270, hp: 140, surface: true, cost: 240 },
    plant: { r: 9, m: 6, z: 36, tip: 190, hp: 90, cost: 150 },
    cone: { r: 7, m: 1, z: 20, tip: 110, hp: 1e9, cost: 0 },
    sign: { r: 7, m: 1.4, z: 24, tip: 90, hp: 1e9, cost: 0 },
    extinguisher: { r: 5, m: 3, z: 16, tip: 1e9, hp: 1e9, cost: 0 },
    beanbag: { r: 13, m: 5, z: 12, tip: 1e9, hp: 1e9, seat: true, cost: 0 },
    crocodile: { r: 20, m: 2, z: 16, tip: 1e9, hp: 70, cost: 0 },
    weird: { r: 9, m: 3, z: 14, tip: 1e9, hp: 1e9, cost: 0 },
    balloon: { r: 6, m: 0.3, z: 90, tip: 1e9, hp: 1, cost: 0 },
  };
  Wd.PROP = PROP;

  Wd.addProp = (kind, x, y, o = {}) => {
    const d = PROP[kind] || PROP.weird;
    const p = Object.assign({
      id: U.uid(), kind, home: { x, y }, fallen: 0, fallDir: 0, broken: false, hp: d.hp, z: d.z,
      carriedBy: null, heldBy: null, glasses: 0, occ: null, face: o.face || 0, seed: Math.random(),
    }, o);
    p.def = d;
    const r = o.big ? d.r + 2 : o.high ? 11 : d.r;
    p.body = Ph.add({ x, y, r, m: d.m * (o.big ? 1.3 : 1), fric: kind === 'balloon' ? 1 : 7, kind: 'prop', ent: p });
    if (o.mounted) { p.body.ghost = true; p.body.pinned = true; }
    if (kind === 'table') p.glasses = U.randi(0, 1);
    Wd.props.push(p);
    return p;
  };
  Wd.removeProp = (p) => {
    Ph.remove(p.body);
    const i = Wd.props.indexOf(p);
    if (i >= 0) Wd.props.splice(i, 1);
  };
  Wd.propsNear = (x, y, r, pred) => Wd.props.filter((p) => !p.broken && U.dist2(x, y, p.body.x, p.body.y) < (r + p.body.r) ** 2 && (!pred || pred(p)));
  Wd.nearestProp = (x, y, r, pred) => {
    let best = null, bd = r * r;
    for (const p of Wd.props) {
      if (p.broken || (pred && !pred(p))) continue;
      const d = U.dist2(x, y, p.body.x, p.body.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  Wd.init = () => {
    Wd.props.length = 0; Wd.mess.length = 0; Wd.items.length = 0; Wd.parts.length = 0; Wd.barriers.length = 0;
    for (const s of M.propSpawns) Wd.addProp(s.kind, s.x, s.y, s);
    // drinks lined up on the bar top
    Wd.barTop = [];
    for (let x = 16.6; x < 29.8; x += 0.75) if (Math.random() < 0.55) Wd.barTop.push({ x: x * T, y: 10.45 * T, c: U.pick(DRINKS).c, full: Math.random() < 0.5 });
    grime.clear();
  };

  /* ---------------- drinks ---------------- */
  const DRINKS = [
    { name: 'beer', c: [232, 170, 60] }, { name: 'vodka soda', c: [210, 235, 245] }, { name: 'cocktail', c: [255, 80, 150] },
    { name: 'blue thing', c: [60, 160, 255] }, { name: 'red wine', c: [150, 20, 50] }, { name: 'shot', c: [240, 200, 120] },
    { name: 'mystery green', c: [120, 230, 90] }, { name: 'water', c: [200, 230, 255], water: true },
  ];
  Wd.DRINKS = DRINKS;
  Wd.randomDrink = () => U.weighted(DRINKS, (d) => (d.water ? 0.2 : d.name === 'beer' ? 3 : d.name === 'shot' ? 1.4 : 1));

  /* ---------------- mess ---------------- */
  const MESS = {
    spill: { slip: 1, tool: 'mop', weight: 1 },
    vomit: { slip: 1.6, tool: 'mop', weight: 3.2 },
    water: { slip: 1.2, tool: 'mop', weight: 1.2 },
    wet: { slip: 0.9, tool: null, weight: 0 },
    glass: { slip: 0, tool: 'broom', weight: 1.6, sharp: true },
    trash: { slip: 0, tool: 'broom', weight: 0.5 },
    food: { slip: 0.4, tool: 'broom', weight: 1 },
    powder: { slip: 0.2, tool: 'broom', weight: 2 },
    dirt: { slip: 0, tool: 'broom', weight: 1.2 },
    confetti: { slip: 0, tool: 'broom', weight: 0.4 },
    debris: { slip: 0, tool: 'broom', weight: 2.5 },
  };
  Wd.MESS = MESS;
  const MC = 64, MGW = Math.ceil((M.W * T) / MC), MGH = Math.ceil((M.H * T) / MC);
  const mgrid = new Array(MGW * MGH);
  for (let i = 0; i < mgrid.length; i++) mgrid[i] = [];
  const mcell = (x, y) => U.clamp(Math.floor(y / MC), 0, MGH - 1) * MGW + U.clamp(Math.floor(x / MC), 0, MGW - 1);

  Wd.addMess = (kind, x, y, o = {}) => {
    if (!M.roomAt(x, y)) return null;
    // merge small liquid spills that land on each other
    if ((kind === 'spill' || kind === 'water') && !o.noMerge) {
      for (const m of mgrid[mcell(x, y)]) if (m.kind === kind && U.dist2(x, y, m.x, m.y) < (m.r * 0.8) ** 2) { m.r = Math.min(40, m.r + (o.r || 10) * 0.35); m.amt = Math.min(1, m.amt + 0.3); return m; }
    }
    const m = Object.assign({ id: U.uid(), kind, x, y, r: 12, amt: 1, age: 0, seed: Math.random() * 1000, c: [200, 160, 60], ttl: 0 }, o);
    m.def = MESS[kind];
    if (kind === 'wet') m.ttl = o.ttl || 26;
    Wd.mess.push(m);
    mgrid[mcell(x, y)].push(m);
    if (kind !== 'wet') LC.stat('messMade');
    return m;
  };
  Wd.removeMess = (m) => {
    const i = Wd.mess.indexOf(m);
    if (i >= 0) Wd.mess.splice(i, 1);
    const c = mgrid[mcell(m.x, m.y)], j = c.indexOf(m);
    if (j >= 0) c.splice(j, 1);
  };
  Wd.messNear = (x, y, r, pred) => {
    const out = [];
    const x0 = Math.floor((x - r - 40) / MC), x1 = Math.floor((x + r + 40) / MC), y0 = Math.floor((y - r - 40) / MC), y1 = Math.floor((y + r + 40) / MC);
    for (let cy = Math.max(0, y0); cy <= Math.min(MGH - 1, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(MGW - 1, x1); cx++) {
      for (const m of mgrid[cy * MGW + cx]) if (U.dist2(x, y, m.x, m.y) < (r + m.r) ** 2 && (!pred || pred(m))) out.push(m);
    }
    return out;
  };
  // the most slippery unguarded patch under (x,y)
  Wd.slipAt = (x, y) => {
    let best = null;
    for (const m of mgrid[mcell(x, y)]) {
      if (!m.def.slip || m.sticky) continue;
      if (U.dist2(x, y, m.x, m.y) > (m.r * 0.85) ** 2) continue;
      if (Wd.signNear(m.x, m.y, 72)) continue;
      if (!best || m.def.slip > best.def.slip) best = m;
    }
    return best;
  };
  Wd.signNear = (x, y, r) => {
    for (const p of Wd.props) if (p.kind === 'sign' && !p.carriedBy && !p.fallen && U.dist2(x, y, p.body.x, p.body.y) < r * r) return p;
    return null;
  };
  Wd.spill = (x, y, c, amount = 1) => {
    Wd.addMess('spill', x + U.rand(-4, 4), y + U.rand(-4, 4), { r: 8 + amount * 9, c: c || [230, 170, 60] });
    for (let i = 0; i < 6 * amount; i++) Wd.part('drop', x, y, { z: 20, vx: U.rand(-80, 80), vy: U.rand(-80, 80), vz: U.rand(60, 180), c: c || [230, 170, 60] });
    LC.stat('drinksSpilled');
  };
  Wd.breakGlass = (x, y, o = {}) => {
    Wd.addMess('glass', x + U.rand(-3, 3), y + U.rand(-3, 3), { r: 9 + U.rand(0, 4) });
    if (o.c) Wd.addMess('spill', x, y, { r: 10 + U.rand(0, 8), c: o.c });
    for (let i = 0; i < 9; i++) Wd.part('shard', x, y, { z: o.z || 18, vx: U.rand(-120, 120), vy: U.rand(-120, 120), vz: U.rand(80, 220) });
    LC.sfx('glass', x, y, { vol: o.vol || 1 });
    LC.stat('glassesBroken');
    LC.stat('clubDamage', 4);
    if (LC.Social) LC.Social.noise(x, y, 'glass', 1);
  };
  Wd.messScore = () => {
    let s = 0;
    for (const m of Wd.mess) if (M.inClub(m.x, m.y)) s += m.def.weight * (0.3 + 0.7 * m.amt) * (m.r / 14);
    for (const p of Wd.props) {
      if (p.fallen && !p.carriedBy) s += 1.2;
      if (p.kind !== 'sign' && p.def.cost && U.dist2(p.body.x, p.body.y, p.home.x, p.home.y) > (T * 3) ** 2) s += 0.4;
    }
    return s;
  };
  // clean at (x,y): returns true when something got cleaner
  Wd.clean = (tool, x, y, r, rate, dt) => {
    const list = Wd.messNear(x, y, r, (m) => m.def.tool === tool);
    if (!list.length) return null;
    list.sort((a, b) => U.dist2(x, y, a.x, a.y) - U.dist2(x, y, b.x, b.y));
    const m = list[0];
    m.amt -= (rate * dt) / Math.max(0.6, m.r / 16);
    if (Math.random() < dt * 8) Wd.part(tool === 'mop' ? 'drop' : 'dust', m.x + U.rand(-m.r, m.r) * 0.5, m.y + U.rand(-m.r, m.r) * 0.5, { vz: 40, vx: U.rand(-30, 30), vy: U.rand(-30, 30), c: [180, 200, 220] });
    if (m.amt <= 0) {
      Wd.removeMess(m);
      if (tool === 'mop') {
        grime.stain(m.x, m.y, m.r * 0.8, m.c, 0.05);
        Wd.addMess('wet', m.x, m.y, { r: m.r + 10, c: [160, 190, 220] });
      }
      LC.stat(m.kind === 'vomit' ? 'vomitCleaned' : m.kind === 'glass' ? 'glassSwept' : 'messCleaned');
      return { done: true, m };
    }
    return { done: false, m };
  };

  /* ---------------- tipping & breaking furniture ---------------- */
  Wd.tip = (p, dir, force = 1) => {
    if (p.fallen || p.carriedBy || p.kind === 'beanbag' || p.kind === 'balloon') return;
    p.fallen = 0.001; p.fallDir = dir;
    p.body.vx += Math.cos(dir) * 60 * force; p.body.vy += Math.sin(dir) * 60 * force;
    if (p.occ && p.occ.sitOn === p && LC.NPC) LC.NPC.knockDown(p.occ, dir, 0.7);
    if (p.glasses > 0) {
      for (let i = 0; i < p.glasses; i++) Wd.breakGlass(p.body.x + U.rand(-10, 10), p.body.y + U.rand(-10, 10), { c: U.pick(DRINKS).c, vol: 0.7 });
      p.glasses = 0;
    }
    if (p.kind === 'plant') { Wd.addMess('dirt', p.body.x + Math.cos(dir) * 14, p.body.y + Math.sin(dir) * 14, { r: 14 }); LC.sfx('thud', p.body.x, p.body.y); }
    else LC.sfx(p.kind === 'table' ? 'crash' : 'clatter', p.body.x, p.body.y);
    LC.stat('furnitureTipped');
    if (LC.Social) LC.Social.noise(p.body.x, p.body.y, 'crash', p.kind === 'table' ? 1 : 0.6);
  };
  Wd.damage = (p, amount, dir) => {
    if (p.broken || !p.def.cost) return;
    p.hp -= amount;
    if (p.hp <= 0) Wd.breakProp(p, dir);
  };
  Wd.breakProp = (p, dir = 0) => {
    if (p.broken) return;
    p.broken = true;
    if (p.occ && LC.NPC) LC.NPC.knockDown(p.occ, dir, 0.8);
    Wd.addMess('debris', p.body.x, p.body.y, { r: 14 + p.body.r * 0.6, c: p.kind === 'plant' ? [90, 140, 70] : [120, 80, 50], src: p.kind });
    if (p.kind === 'plant') Wd.addMess('dirt', p.body.x + 6, p.body.y + 4, { r: 16 });
    for (let i = 0; i < 12; i++) Wd.part('splinter', p.body.x, p.body.y, { z: 12, vx: U.rand(-140, 140), vy: U.rand(-140, 140), vz: U.rand(80, 240), c: [140, 95, 60] });
    LC.sfx('smash', p.body.x, p.body.y);
    LC.stat('brokenFurniture');
    LC.stat('clubDamage', p.def.cost || 50);
    Wd.removeProp(p);
    if (LC.Social) LC.Social.noise(p.body.x, p.body.y, 'crash', 1.3);
    if (LC.Director) LC.Director.crash(p.body.x, p.body.y, p.kind);
  };
  Wd.standUp = (p) => { p.fallen = 0; };
  // a prop worn as a hat (traffic cone, wet floor sign)
  Wd.wear = (p, n, as) => {
    if (p.carriedBy) { const c = p.carriedBy; if (c.carry === p) c.carry = null; p.carriedBy = null; }
    p.worn = n; p.wornAs = as; n.hatOverride = as; p.body.ghost = true; p.fallen = 0; p.z0 = 0;
  };
  Wd.unwear = (p) => {
    const n = p.worn;
    if (!n) return;
    if (n.hatOverride === p.wornAs) n.hatOverride = null;
    p.worn = null; p.body.ghost = false;
    p.body.x = n.x + 10; p.body.y = n.y + 8;
  };

  /* ---------------- lost property ---------------- */
  const ITEMS = {
    shoe: 'a shoe', jacket: 'a jacket', phone: 'a phone', wallet: 'a wallet', hat: 'a hat', keys: 'some keys',
    sunglasses: 'sunglasses', tiara: 'a tiara', tie: 'a tie', earring: 'one earring', id: 'an ID card', wig: 'a wig',
  };
  Wd.ITEMS = ITEMS;
  Wd.addItem = (kind, x, y, o = {}) => {
    const it = Object.assign({ id: U.uid(), kind, x, y, label: ITEMS[kind] || kind, owner: null, c: o.c || [60, 60, 70], rot: U.rand(-1, 1) }, o);
    Wd.items.push(it);
    return it;
  };
  Wd.removeItem = (it) => { const i = Wd.items.indexOf(it); if (i >= 0) Wd.items.splice(i, 1); };
  Wd.itemNear = (x, y, r) => {
    let best = null, bd = r * r;
    for (const it of Wd.items) { const d = U.dist2(x, y, it.x, it.y); if (d < bd) { bd = d; best = it; } }
    return best;
  };

  /* ---------------- barrier ropes ---------------- */
  Wd.addBarrier = (x0, y0, x1, y1) => {
    const seg = { ax: x0, ay: y0, bx: x1, by: y1, kind: 'rope', thick: 3, h: 16, active: true };
    M.segs.push(seg);
    // block nav tiles under the rope for everyone (restored on removal)
    const blocked = [];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 0; i <= n; i++) {
      const tx = Math.floor((x0 + ((x1 - x0) * i) / n) / T), ty = Math.floor((y0 + ((y1 - y0) * i) / n) / T);
      const k = M.ti(tx, ty);
      if (M.walk[k] === 1 && !blocked.includes(k)) { blocked.push(k); M.walk[k] = 0; }
    }
    const b = { id: U.uid(), x0, y0, x1, y1, seg, blocked, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    Wd.barriers.push(b);
    LC.Phys.reindex && LC.Phys.reindex();
    return b;
  };
  Wd.removeBarrier = (b) => {
    const i = M.segs.indexOf(b.seg);
    if (i >= 0) M.segs.splice(i, 1);
    for (const k of b.blocked) M.walk[k] = 1;
    Wd.barriers.splice(Wd.barriers.indexOf(b), 1);
    LC.Phys.reindex && LC.Phys.reindex();
  };

  /* ---------------- particles ---------------- */
  const MAXP = 900;
  Wd.part = (kind, x, y, o = {}) => {
    if (Wd.parts.length >= MAXP) Wd.parts.shift();
    const p = { kind, x, y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.max || PLIFE[kind] || 1, c: o.c, size: o.size || 1, rot: U.rand(0, 6), vr: U.rand(-8, 8), text: o.text };
    Wd.parts.push(p);
    return p;
  };
  const PLIFE = { drop: 0.9, shard: 1.4, splinter: 1.6, dust: 0.7, smoke: 3.2, powder: 2.4, confetti: 3.5, stink: 1.8, spark: 0.6, note: 1.6, zzz: 2.2, heart: 1.4, puff: 0.6, cough: 1, pow: 0.45, vape: 3 };

  /* ---------------- grime: dried stains baked into a low-res canvas ---------------- */
  const GS = 4;
  const grime = (Wd.grime = {
    canvas: null, ctx: null, scale: GS,
    clear() {
      if (typeof document === 'undefined') return;
      if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.width = (M.W * T) / GS; this.canvas.height = (M.H * T) / GS; this.ctx = this.canvas.getContext('2d'); }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.dirty = true;
    },
    stain(x, y, r, c, a) {
      if (!this.ctx) return;
      const g = this.ctx;
      g.fillStyle = U.rgba(c ? c.map((v) => v * 0.6) : [60, 50, 40], a);
      g.beginPath();
      g.ellipse(x / GS, y / GS, Math.max(1, r / GS), Math.max(1, (r * 0.7) / GS), 0, 0, 7);
      g.fill();
      this.dirty = true;
    },
  });

  /* ---------------- update ---------------- */
  Wd.update = (dt) => {
    // particles
    for (let i = Wd.parts.length - 1; i >= 0; i--) {
      const p = Wd.parts[i];
      p.life += dt;
      if (p.life >= p.max) { Wd.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const floaty = p.kind === 'smoke' || p.kind === 'stink' || p.kind === 'note' || p.kind === 'zzz' || p.kind === 'heart' || p.kind === 'powder' || p.kind === 'vape' || p.kind === 'cough';
      if (floaty) { p.vz = p.kind === 'powder' ? 6 : 18; p.z += p.vz * dt; p.vx *= 0.98; p.vy *= 0.98; }
      else if (p.kind !== 'pow') {
        p.vz -= 700 * dt; p.z += p.vz * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; if (p.kind === 'drop') p.life = p.max; }
      }
      p.rot += p.vr * dt;
    }
    // mess: wet patches dry, old spills get sticky, vomit stinks
    for (let i = Wd.mess.length - 1; i >= 0; i--) {
      const m = Wd.mess[i];
      m.age += dt;
      if (m.kind === 'wet') {
        m.ttl -= dt;
        if (m.ttl <= 0) { Wd.removeMess(m); continue; }
      } else if (m.kind === 'spill' && m.age > 200 && !m.sticky) { m.sticky = true; }
      if (m.kind === 'vomit' && Math.random() < dt * 0.9) Wd.part('stink', m.x + U.rand(-m.r, m.r) * 0.6, m.y + U.rand(-m.r, m.r) * 0.5, { z: 4, vx: U.rand(-6, 6) });
    }
    // props: falling animation, carried props follow carriers, balloons float
    for (const p of Wd.props) {
      if (p.fallen > 0 && p.fallen < 1) p.fallen = Math.min(1, p.fallen + dt * 5);
      if (p.worn) {
        const w = p.worn;
        if (w.gone || w.hatOverride !== p.wornAs) { p.worn = null; p.body.ghost = false; if (w.hatOverride === p.wornAs) w.hatOverride = null; p.body.x = w.x; p.body.y = w.y + 10; }
        else { p.body.x = w.x; p.body.y = w.y; p.body.vx = 0; p.body.vy = 0; p.body.ghost = true; continue; }
      }
      if (p.carriedBy) {
        const c = p.carriedBy;
        const hx = c.x + Math.cos(c.face || 0) * (c.r + p.body.r * 0.4), hy = c.y + Math.sin(c.face || 0) * (c.r + p.body.r * 0.3) + 2;
        p.body.x = hx; p.body.y = hy; p.body.vx = 0; p.body.vy = 0;
        p.body.ghost = true;
      } else if (!p.mounted && p.body.ghost && !p.heldAsAnchor) p.body.ghost = false;
      if (p.kind === 'balloon') { p.z = U.damp(p.z, 110, 0.5, dt); p.body.vx += Math.sin(LC.now() * 0.7 + p.seed * 9) * 3 * dt; }
    }
    // tip props that got slammed this step
    for (const c of Ph.contacts) {
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? c.a : c.b, b = k === 0 ? c.b : c.a;
        if (a.kind !== 'prop' || !a.ent) continue;
        const p = a.ent;
        if (p.carriedBy || p.fallen || p.broken) continue;
        // the prop is shoved along -n when it is body a, along +n when it is body b
        const dir = k === 0 ? Math.atan2(-c.ny, -c.nx) : Math.atan2(c.ny, c.nx);
        const force = c.speed * (b.m || 1);
        if (force > p.def.tip * (p.kind === 'table' ? 8 : 5)) Wd.tip(p, dir, 1);
        if (force > 1200) Wd.damage(p, force * 0.04, dir);
      }
    }
  };
})();
