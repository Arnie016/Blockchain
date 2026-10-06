/* Last Call — renderer. 3/4 view: floors are cached in chunks, then walls, furniture, props and
   people are drawn back-to-front; a half-res light buffer is multiplied over the scene and neon,
   beams and lasers are added on top. The same renderView() feeds the CCTV monitors. */
(function () {
  'use strict';
  const { U, Map: M, People: Pp } = LC;
  const T = M.T;
  const R = (LC.R2D = { zoomMul: 1, is3D: false });
  LC.R = R;
  let canvas, ctx, dpr = 1;
  const lightCv = document.createElement('canvas');
  const lg = lightCv.getContext('2d');
  const LS = 0.5; // light buffer scale

  R.init = (cv) => {
    canvas = cv; ctx = cv.getContext('2d', { alpha: false });
    R.canvas = cv; R.ctx = ctx;
    R.resize();
  };
  R.resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    R.cw = w; R.ch = h; R.dpr = dpr;
    lightCv.width = Math.ceil(canvas.width * LS); lightCv.height = Math.ceil(canvas.height * LS);
    R.baseZoom = U.clamp(Math.sqrt((w * h) / (35 * 20.5 * T * T)), 0.62, 2.1);
    chunkCache.clear();
  };
  R.cam = { x: 46 * T, y: 44 * T, zoom: 1.2, shake: 0, tx: 46 * T, ty: 44 * T };
  // world -> css px (for HUD overlays)
  R.toScreen = (x, y, z = 0) => {
    const c = R.cam, z2 = c.zoom;
    return { x: (x - c.vx) * z2 + R.cw / 2, y: (y - z - c.vy) * z2 + R.ch / 2 };
  };
  R.toWorld = (sx, sy) => {
    const c = R.cam;
    return { x: (sx - R.cw / 2) / c.zoom + c.vx, y: (sy - R.ch / 2) / c.zoom + c.vy };
  };

  /* ================= floors ================= */
  const FLOOR = {
    asphalt: '#26282e', pavement: '#6d6a72', parking: '#25262b', steel: '#9ca2a8', tileM: '#dde3e1', tileH: '#cfcad6', tileW: '#efdfe6',
    carpetR: '#5c1f2c', wood: '#6e4529', stage: '#16141c', led: '#101018', dark: '#1d1924', concrete: '#5c5c62', carpetO: '#465a4c',
    velvet: '#3c1842', deck: '#6b5142', checker: '#e6e2da', carpetP: '#382a5c', mat: '#2a2a30', redcarpet: '#9c1234',
  };
  function tileFloor(g, f, tx, ty) {
    const x = tx * T, y = ty * T, h = U.hash(tx, ty), h2 = U.hash(ty, tx, 7);
    g.fillStyle = FLOOR[f] || '#222';
    g.fillRect(x, y, T + 0.5, T + 0.5);
    switch (f) {
      case 'asphalt': case 'parking':
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + h * 26, y + h2 * 26, 2, 2); g.fillRect(x + h2 * 28, y + h * 22, 1.5, 1.5);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + ((h * 97) % 1) * 24, y + ((h2 * 53) % 1) * 24, 5, 3);
        if (h < 0.06) { g.fillStyle = 'rgba(20,40,60,0.35)'; g.beginPath(); g.ellipse(x + 16, y + 16, 14, 8, 0, 0, 7); g.fill(); }
        break;
      case 'pavement':
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        if (tx % 2 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + T); g.stroke(); }
        if (ty % 2 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + T, y); g.stroke(); }
        if (h < 0.15) { g.fillStyle = 'rgba(30,30,30,0.35)'; g.beginPath(); g.arc(x + h2 * 30, y + h * 150 % 30, 1.6, 0, 7); g.fill(); }
        break;
      case 'steel':
        g.strokeStyle = 'rgba(60,64,70,0.4)'; g.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const px = x + 4 + i * 8, py = y + 4 + j * 8; g.beginPath(); if ((i + j) % 2) { g.moveTo(px - 2, py - 1); g.lineTo(px + 2, py + 1); } else { g.moveTo(px - 2, py + 1); g.lineTo(px + 2, py - 1); } g.stroke(); }
        break;
      case 'tileM': case 'tileH': case 'tileW':
        g.fillStyle = f === 'tileW' ? '#e8d3dc' : f === 'tileH' ? '#c2bccb' : '#d0d8d6';
        g.fillRect(x + 16, y, 16, 16); g.fillRect(x, y + 16, 16, 16);
        g.strokeStyle = 'rgba(90,100,110,0.35)'; g.lineWidth = 0.8; g.strokeRect(x + 0.5, y + 0.5, 15, 15); g.strokeRect(x + 16.5, y + 16.5, 15, 15);
        if (h < 0.12) { g.fillStyle = 'rgba(160,150,90,0.12)'; g.beginPath(); g.arc(x + h2 * 32, y + 16, 6, 0, 7); g.fill(); }
        break;
      case 'carpetR': case 'carpetP': case 'carpetO': case 'velvet':
        g.fillStyle = f === 'velvet' ? 'rgba(255,200,90,0.12)' : 'rgba(0,0,0,0.18)';
        g.beginPath(); g.moveTo(x + 16, y + 4); g.lineTo(x + 28, y + 16); g.lineTo(x + 16, y + 28); g.lineTo(x + 4, y + 16); g.closePath(); g.fill();
        if (f === 'velvet') { g.fillStyle = 'rgba(255,210,120,0.18)'; g.fillRect(x + 15, y + 15, 2, 2); }
        break;
      case 'wood': case 'deck': {
        const plank = f === 'deck' ? 8 : 10.67;
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1;
        for (let i = 0; i < T / plank; i++) {
          const py = y + i * plank;
          g.beginPath(); g.moveTo(x, py); g.lineTo(x + T, py); g.stroke();
          const off = ((tx * 13 + i * 7 + ty * 3) % 4) * 8;
          g.beginPath(); g.moveTo(x + off, py); g.lineTo(x + off, py + plank); g.stroke();
          g.fillStyle = 'rgba(255,220,180,' + (U.hash(tx * 3 + i, ty) * 0.06).toFixed(3) + ')'; g.fillRect(x, py + 1, T, plank - 2);
        }
        break;
      }
      case 'checker':
        g.fillStyle = '#17171b';
        g.fillRect(x, y, 16, 16); g.fillRect(x + 16, y + 16, 16, 16);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + h * 20, y + h2 * 20, 10, 1);
        break;
      case 'concrete':
        g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 0.8;
        if (h < 0.2) { g.beginPath(); g.moveTo(x + h2 * 32, y); g.lineTo(x + h * 32, y + 20); g.lineTo(x + h2 * 20, y + 32); g.stroke(); }
        break;
      case 'mat':
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + 4 + i * 8, y + 4 + j * 8, 1.6, 0, 7); g.fill(); }
        break;
      case 'dark': case 'stage':
        g.fillStyle = 'rgba(200,170,255,0.06)'; g.fillRect(x + h * 30, y + h2 * 30, 1.5, 1.5); g.fillRect(x + h2 * 26, y + h * 14, 1, 1);
        break;
      case 'redcarpet':
        g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(x, y + h * 30, T, 1);
        if (tx === 44 || tx === 47) { g.fillStyle = '#d8a63a'; g.fillRect(tx === 44 ? x : x + T - 2.5, y, 2.5, T); }
        break;
    }
  }
  function staticDecals(g, x0, y0, x1, y1) {
    // parking bay lines
    g.strokeStyle = 'rgba(235,235,225,0.55)'; g.lineWidth = 2;
    for (const c of M.cars) {
      if (c.x1 < x0 || c.x0 > x1 || c.y1 < y0 || c.y0 > y1) continue;
      g.beginPath(); g.moveTo(c.x0 - 6, c.y0 - 4); g.lineTo(c.x0 - 6, c.y1 + 4); g.moveTo(c.x1 + 6, c.y0 - 4); g.lineTo(c.x1 + 6, c.y1 + 4); g.stroke();
    }
    // taxi bay
    if (x1 > 40 * T && x0 < 54 * T && y1 > 55 * T && y0 < 59 * T) {
      g.strokeStyle = 'rgba(255,210,60,0.7)'; g.lineWidth = 2; g.setLineDash([10, 8]); g.strokeRect(41 * T, 55.4 * T, 12 * T, 3.4 * T); g.setLineDash([]);
      g.fillStyle = 'rgba(255,210,60,0.75)'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('TAXI', 47 * T, 57.8 * T);
    }
    // curb
    if (y0 < 54 * T && y1 > 53.6 * T) { g.fillStyle = '#8a8690'; g.fillRect(x0, 53.72 * T, x1 - x0, 0.28 * T); g.fillStyle = 'rgba(255,220,60,0.5)'; g.fillRect(40 * T, 53.72 * T, 14 * T, 0.12 * T); }
    // bathroom drains + dance floor rim
    g.fillStyle = 'rgba(40,40,50,0.6)';
    [[9, 25], [9, 35], [9, 29.5]].forEach(([dx, dy]) => { g.beginPath(); g.arc(dx * T, dy * T, 4, 0, 7); g.fill(); });
    g.strokeStyle = '#2a2436'; g.lineWidth = 4; g.strokeRect(M.LED.x0 * T - 2, M.LED.y0 * T - 2, (M.LED.x1 - M.LED.x0) * T + 4, (M.LED.y1 - M.LED.y0) * T + 4);
    // VIP gold edge
    g.strokeStyle = 'rgba(230,190,90,0.6)'; g.lineWidth = 2; g.strokeRect(62 * T + 3, 18 * T + 3, 14 * T - 6, 14 * T - 6);
    // alley graffiti + manhole
    g.fillStyle = '#1a1b1f'; g.beginPath(); g.arc(46 * T, 3.5 * T, 14, 0, 7); g.fill();
    g.strokeStyle = '#34363c'; g.lineWidth = 1; g.beginPath(); g.arc(46 * T, 3.5 * T, 10, 0, 7); g.stroke();
  }

  // floor chunks cached at the current zoom
  const CH = 8, CHP = CH * T;
  const chunkCache = new Map();
  function chunk(cx, cy, s) {
    const key = cx + ',' + cy + ',' + s.toFixed(3);
    let c = chunkCache.get(key);
    if (c) return c;
    if (chunkCache.size > 90) chunkCache.delete(chunkCache.keys().next().value);
    c = document.createElement('canvas');
    const px = Math.ceil(CHP * s);
    c.width = px; c.height = px;
    const g = c.getContext('2d');
    g.scale(s, s); g.translate(-cx * CHP, -cy * CHP);
    for (let ty = cy * CH; ty < (cy + 1) * CH; ty++) for (let tx = cx * CH; tx < (cx + 1) * CH; tx++) {
      if (tx >= M.W || ty >= M.H) continue;
      const f = M.floor[M.ti(tx, ty)];
      if (f) tileFloor(g, f, tx, ty);
      else { g.fillStyle = '#0c0b10'; g.fillRect(tx * T, ty * T, T + 0.5, T + 0.5); }
    }
    staticDecals(g, cx * CHP, cy * CHP, (cx + 1) * CHP, (cy + 1) * CHP);
    chunkCache.set(key, c);
    return c;
  }
  // low-res whole map floor for CCTV feeds
  let smallFloor = null;
  function getSmallFloor() {
    if (smallFloor) return smallFloor;
    const s = 0.4;
    smallFloor = document.createElement('canvas');
    smallFloor.width = Math.ceil(M.W * T * s); smallFloor.height = Math.ceil(M.H * T * s);
    const g = smallFloor.getContext('2d');
    g.scale(s, s);
    for (let ty = 0; ty < M.H; ty++) for (let tx = 0; tx < M.W; tx++) { const f = M.floor[M.ti(tx, ty)]; if (f) tileFloor(g, f, tx, ty); else { g.fillStyle = '#0c0b10'; g.fillRect(tx * T, ty * T, T, T); } }
    staticDecals(g, 0, 0, M.W * T, M.H * T);
    return smallFloor;
  }
  R.invalidateFloors = () => { chunkCache.clear(); smallFloor = null; };

  /* ================= LED floor ================= */
  const LEDC = [[255, 46, 136], [46, 230, 255], [150, 70, 255], [255, 180, 50], [60, 255, 170], [255, 90, 60]];
  function ledColor(tx, ty, G) {
    const m = G.music || {};
    const beat = m.beatPhase || 0, bt = m.beatTime || 0, pat = m.pattern || 0, pal = m.palette || 0;
    const on = 1 - Math.min(1, beat * 1.6);
    let k = 0, ci = pal;
    const cx = (M.LED.x0 + M.LED.x1) / 2, cy = (M.LED.y0 + M.LED.y1) / 2;
    switch (pat) {
      case 0: k = 0.5 + 0.5 * Math.sin((tx + ty) * 0.7 - bt * 3.14); ci = pal + ((tx + ty + ((bt / 2) | 0)) % 3 === 0 ? 1 : 0); break;
      case 1: k = ((tx + ty + ((bt | 0) % 2)) % 2) ? 0.95 * (0.5 + on * 0.5) : 0.08; ci = pal + (((bt | 0) % 4) >> 1); break;
      case 2: { const d = Math.hypot(tx - cx, (ty - cy) * 1.3); k = Math.max(0, Math.sin(d * 0.8 - bt * 3.14 * 1.5)); ci = pal + (d > 7 ? 1 : 0); break; }
      case 3: k = U.hash(tx, ty, (bt * 2) | 0) > 0.72 ? 1 : 0.05; ci = pal + ((U.hash(ty, tx, (bt | 0)) * 3) | 0); break;
      default: k = Math.abs(((bt * 2.5) % 17) - (tx - M.LED.x0) * 0.7) < 1.6 ? 1 : 0.1; ci = pal + 2;
    }
    if (m.drop > 0) k = Math.max(k, m.drop);
    return [LEDC[ci % LEDC.length], U.clamp(k, 0, 1) * (0.35 + 0.65 * (m.energy === undefined ? 1 : m.energy))];
  }
  function drawLED(g, G, x0, y0, x1, y1, forLight) {
    const off = G.lightsOn > 0.5 || !G.power;
    const tx0 = Math.max(M.LED.x0, Math.floor(x0 / T)), tx1 = Math.min(M.LED.x1 - 1, Math.floor(x1 / T));
    const ty0 = Math.max(M.LED.y0, Math.floor(y0 / T)), ty1 = Math.min(M.LED.y1 - 1, Math.floor(y1 / T));
    if (tx0 > tx1 || ty0 > ty1) return;
    if (off) {
      if (forLight) return;
      g.fillStyle = '#3a3a42';
      g.fillRect(tx0 * T, ty0 * T, (tx1 - tx0 + 1) * T, (ty1 - ty0 + 1) * T);
      g.fillStyle = '#4a4a54';
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) g.fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
      return;
    }
    if (!forLight) { g.fillStyle = '#0a0a10'; g.fillRect(tx0 * T, ty0 * T, (tx1 - tx0 + 1) * T, (ty1 - ty0 + 1) * T); }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const [c, k] = ledColor(tx, ty, G);
      if (k < 0.04) continue;
      if (forLight) { g.fillStyle = U.rgba(c, (k * 0.38).toFixed(3)); g.fillRect(tx * T - 4, ty * T - 4, T + 8, T + 8); }
      else {
        // four LED cells per tile, the pattern thins them out so people read on top
        g.fillStyle = U.rgba(c, (0.16 + k * 0.62).toFixed(3));
        const x = tx * T, y = ty * T;
        g.fillRect(x + 2, y + 2, 12, 12); g.fillRect(x + 18, y + 18, 12, 12);
        g.fillStyle = U.rgba(c, (0.06 + k * 0.32).toFixed(3));
        g.fillRect(x + 18, y + 2, 12, 12); g.fillRect(x + 2, y + 18, 12, 12);
      }
    }
  }

  /* ================= walls, doors ================= */
  const WALLC = {
    ext: ['#2c2632', '#4d2e30'], wall: ['#342c3c', '#1f1a26'], stall: ['#9aa8b2', '#72808c'], low: ['#24222c', '#121018'], fence: ['#7a5636', '#5a3e26'], rope: null,
  };
  function drawSeg(g, s, G) {
    if (s.kind === 'door') return;
    if (s.kind === 'rope') return drawRopeLine(g, s.ax, s.ay, s.bx, s.by);
    const [topC, frontC] = WALLC[s.kind] || WALLC.wall;
    const t = s.thick, h = s.h;
    if (s.ay === s.by) {
      const x0 = Math.min(s.ax, s.bx) - t, x1 = Math.max(s.ax, s.bx) + t, y = s.ay;
      g.fillStyle = frontC; g.fillRect(x0, y + t - h, x1 - x0, h);
      g.fillStyle = topC; g.fillRect(x0, y - t - h, x1 - x0, t * 2);
      if (s.kind === 'ext') {
        // brick courses on the facade
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        for (let yy = y + t - h + 5; yy < y + t; yy += 6) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
      } else if (s.kind === 'fence') {
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
        for (let xx = x0; xx < x1; xx += 7) { g.beginPath(); g.moveTo(xx, y + t - h); g.lineTo(xx, y + t); g.stroke(); }
      } else if (s.kind === 'low') {
        g.fillStyle = 'rgba(255,60,160,0.8)'; g.fillRect(x0, y + t - 3, x1 - x0, 1.5);
      }
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x0, y - t - h, x1 - x0, 1.2);
    } else {
      const x = s.ax, y0 = Math.min(s.ay, s.by), y1 = Math.max(s.ay, s.by);
      g.fillStyle = frontC; g.fillRect(x - t, y1 - h + t, t * 2, h);
      g.fillStyle = topC; g.fillRect(x - t, y0 - h - t, t * 2, y1 - y0 + t * 2);
      if (s.kind === 'fence') { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (let yy = y0; yy < y1; yy += 7) { g.beginPath(); g.moveTo(x - t, yy - h); g.lineTo(x + t, yy - h); g.stroke(); } }
    }
  }
  function drawRopeLine(g, x0, y0, x1, y1) {
    g.strokeStyle = '#8a0f2a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y0 - 14); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 6, x1, y1 - 14); g.stroke();
    for (const [px, py] of [[x0, y0], [x1, y1]]) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px, py, 5, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#d9b04a'; g.fillRect(px - 1.8, py - 18, 3.6, 18);
      g.beginPath(); g.arc(px, py - 19, 3, 0, 7); g.fill();
    }
  }
  function drawDoor(g, d, G) {
    if (d.kind === 'arch') return;
    if (d.kind === 'rope') {
      if (d.id === 'vipRope' && !(G.vipRopeOpen > 0.5)) drawRopeLine(g, d.x0, d.y0 + 3, d.x1, d.y1 - 3);
      else if (d.id === 'vipRope') { drawRopeLine(g, d.x0, d.y0 + 3, d.x0 + 4, d.y0 + 16); }
      return;
    }
    const open = d.open;
    g.fillStyle = '#0d0b12';
    if (d.axis === 'h') { g.fillRect(d.x0 - 3, d.y0 - 30, 3, 32); g.fillRect(d.x1, d.y0 - 30, 3, 32); }
    const leafC = d.kind === 'alarm' ? '#9a2a2a' : d.kind === 'stall' ? '#8595a2' : d.kind === 'gate' ? '#6a4a30' : '#3c3446';
    const leaves = d.kind === 'double' ? [[d.x0, d.y0, 1], [d.x1, d.y1, -1]] : [[d.x0, d.y0, 1]];
    for (const [hx, hy, dir] of leaves) {
      const len = d.kind === 'double' ? d.len / 2 : d.len;
      const ang = (d.axis === 'h' ? 0 : Math.PI / 2) + (dir > 0 ? 0 : Math.PI) + open * (Math.PI / 2) * dir * (d.axis === 'h' ? 1 : -1);
      const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
      const hgt = d.kind === 'stall' ? 20 : d.kind === 'gate' ? 14 : 28;
      g.fillStyle = leafC;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.lineTo(ex, ey - hgt); g.lineTo(hx, hy - hgt); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      if (d.kind === 'alarm' && open < 0.5) { g.fillStyle = '#e8e8e8'; g.fillRect(Math.min(hx, ex) + 4, hy - 18, Math.abs(ex - hx) - 8, 3); }
    }
    // feet under a closed stall door
    if (d.kind === 'stall' && open < 0.5 && d.occupants > 0) {
      const n = Math.min(12, d.occupants * 2);
      for (let i = 0; i < n; i++) {
        const fx = d.x0 + 3 + ((i * 7.3) % (d.len - 6)), fy = d.y0 - (d.flipFeet ? -3 : 3);
        g.fillStyle = ['#111', '#e22', '#eee', '#6b3f22', '#223'][i % 5];
        g.beginPath(); g.ellipse(fx + Math.sin(G.t * 9 + i) * (d.shake || 0), fy, 2.6, 1.6, 0, 0, 7); g.fill();
      }
    }
  }

  /* ================= furniture ================= */
  function box(g, x0, y0, x1, y1, z, top, front) {
    g.fillStyle = front; g.fillRect(x0, y1 - z, x1 - x0, z);
    g.fillStyle = top; g.fillRect(x0, y0 - z, x1 - x0, y1 - y0);
  }
  function drawFurn(g, f, G) {
    const { x0, y0, x1, y1, z } = f;
    const w = x1 - x0, hh = y1 - y0, t = G.t;
    switch (f.kind) {
      case 'hedge':
        for (let y = y0; y < y1; y += 14) { g.fillStyle = (y / 14) % 2 ? '#1f3a22' : '#26452a'; g.beginPath(); g.ellipse(x0 + w / 2 + Math.sin(y) * 3, y - 10, w * 0.7, 12, 0, 0, 7); g.fill(); }
        break;
      case 'dumpster':
        box(g, x0, y0, x1, y1, z, U.shade(f.color, 0.12), f.color);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 3, y0 - z + 3, w - 6, 3);
        g.fillStyle = '#ddd'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('NO DUMPING', x0 + w / 2, y1 - z / 2 + 3);
        break;
      case 'crate': case 'boxes':
        box(g, x0, y0, x1, y1, z, f.kind === 'boxes' ? '#b08a5a' : '#8a6a42', f.kind === 'boxes' ? '#8e6c44' : '#6c5030');
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.strokeRect(x0 + 2, y1 - z + 2, w - 4, z - 4);
        if (f.kind === 'boxes') { box(g, x0 + 6, y0 + 4, x1 - 8, y1 - 10, z + 16, '#c09a68', '#9a7a50'); }
        break;
      case 'pallets':
        for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#8a6a42' : '#7a5a36'; g.fillRect(x0, y0 + i * (hh / 5) - z, w, hh / 5 - 1); }
        break;
      case 'kcounter': case 'kisland':
        box(g, x0, y0, x1, y1, z, '#c8cdd2', '#8c9298');
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0, y0 - z, w, 2);
        if (f.kind === 'kisland') { g.fillStyle = '#e8e2d0'; g.fillRect(x0 + 14, y0 - z + 8, 20, 12); g.fillStyle = '#c33'; g.beginPath(); g.arc(x1 - 30, y0 - z + 20, 6, 0, 7); g.fill(); }
        break;
      case 'stove':
        box(g, x0, y0, x1, y1, z, '#3a3d42', '#2a2c30');
        for (let i = 0; i < 4; i++) { const cx = x0 + 14 + i * 22, cy = y0 - z + hh / 2; g.fillStyle = '#16171a'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill(); g.strokeStyle = G.lightsOn > 0.5 ? '#553' : '#d0402a'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.stroke(); }
        break;
      case 'fridge': box(g, x0, y0, x1, y1, z, '#d8dde2', '#b4bcc4'); g.fillStyle = '#888'; g.fillRect(x0 + w / 2 - 1, y1 - z + 6, 2, z - 12); break;
      case 'kshelf': case 'supply':
        box(g, x0, y0, x1, y1, z, '#5a5a62', '#44444c');
        for (let i = 0; i < 3; i++) for (let j = 0; j < (f.kind === 'supply' ? 7 : 4); j++) { g.fillStyle = f.kind === 'supply' ? ['#ffd21f', '#3a8ad8', '#e44', '#fff', '#3c3'][((i * 7 + j) * 3) % 5] : ['#c84', '#e8e0c0', '#4a8', '#d63'][(i + j) % 4]; g.fillRect(x0 + 3 + j * ((w - 6) / (f.kind === 'supply' ? 7 : 4)), y1 - z + 4 + i * (z / 3), 5, z / 3 - 5); }
        break;
      case 'fryer': box(g, x0, y0, x1, y1, z, '#6a6e74', '#50545a'); g.fillStyle = '#c89a2a'; g.fillRect(x0 + 5, y0 - z + 5, w - 10, hh - 10); break;
      case 'toilet': {
        const flip = f.flip;
        g.fillStyle = '#e8eef0';
        if (!flip) { g.fillRect(x0 + 2, y0 - 14, w - 4, 8); g.beginPath(); g.ellipse(x0 + w / 2, y0 + hh * 0.55 - 6, w * 0.38, hh * 0.45, 0, 0, 7); g.fill(); g.fillStyle = '#9ab'; g.beginPath(); g.ellipse(x0 + w / 2, y0 + hh * 0.55 - 6, w * 0.22, hh * 0.25, 0, 0, 7); g.fill(); }
        else { g.beginPath(); g.ellipse(x0 + w / 2, y0 + hh * 0.3 - 6, w * 0.38, hh * 0.45, 0, 0, 7); g.fill(); g.fillStyle = '#9ab'; g.beginPath(); g.ellipse(x0 + w / 2, y0 + hh * 0.3 - 6, w * 0.22, hh * 0.25, 0, 0, 7); g.fill(); g.fillStyle = '#e8eef0'; g.fillRect(x0 + 2, y1 - 12, w - 4, 10); }
        break;
      }
      case 'urinal': g.fillStyle = '#eef3f4'; g.beginPath(); g.ellipse(x0 + w / 2, y0 + 2 - 10, w / 2, 9, 0, 0, 7); g.fill(); g.fillStyle = '#bcd'; g.beginPath(); g.ellipse(x0 + w / 2, y0 - 6, w / 3.5, 4, 0, 0, 7); g.fill(); break;
      case 'sink':
        box(g, x0, y0, x1, y1, z, '#e8eef0', '#c6ced2');
        g.fillStyle = '#a8b8c2'; g.beginPath(); g.ellipse(x0 + w / 2, y0 + hh / 2 - z, w * 0.32, hh * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = '#bbb'; g.fillRect(x1 - 5, y0 + hh / 2 - z - 2, 5, 3);
        break;
      case 'vanity': box(g, x0, y0, x1, y1, z, '#e0c8d0', '#c8a8b4'); g.fillStyle = 'rgba(200,230,255,0.6)'; g.fillRect(x0 + 4, y0 - z - 16, w - 8, 14); break;
      case 'vending':
        box(g, x0, y0, x1, y1, z, '#2a3a5a', '#1c2842');
        g.fillStyle = G.power ? 'rgba(120,200,255,0.9)' : '#223'; g.fillRect(x0 + 4, y1 - z + 4, w - 12, z - 12);
        break;
      case 'backbar':
        box(g, x0, y0, x1, y1, z, '#2a1c14', '#1a120c');
        for (let r = 0; r < 3; r++) for (let x = x0 + 6; x < x1 - 6; x += 9) {
          const hsh = U.hash(x | 0, r);
          g.fillStyle = ['#2f7a3a', '#c8a040', '#8a2030', '#e0e8f0', '#3a5ab0', '#d86a20'][(hsh * 6) | 0];
          g.fillRect(x, y1 - z + 4 + r * 12, 5, 9);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1, y1 - z + 5 + r * 12, 1, 5);
        }
        break;
      case 'counter': case 'counterEnd':
        box(g, x0, y0, x1, y1, z, '#1c1a20', '#3a2416');
        g.fillStyle = 'rgba(255,255,255,0.08)';
        for (let x = x0 + 10; x < x1; x += 37) { g.beginPath(); g.moveTo(x, y0 - z); g.lineTo(x + 18, y1 - z); g.lineTo(x + 20, y1 - z); g.lineTo(x + 2, y0 - z); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
        for (let x = x0 + 16; x < x1; x += 16) { g.beginPath(); g.moveTo(x, y1 - z + 3); g.lineTo(x, y1); g.stroke(); }
        if (f.kind === 'counter') for (const gl of LC.W.barTop) Pp.drawGlass(g, gl.x, gl.y - z + 2, { c: gl.c, fill: gl.full ? 0.8 : 0.1 });
        break;
      case 'pillar':
        g.fillStyle = '#2a2332'; g.fillRect(x0, y1 - z, w, z);
        g.fillStyle = '#3a3146'; g.fillRect(x0, y0 - z, w, hh);
        g.fillStyle = 'rgba(255,60,170,0.55)'; g.fillRect(x0 + w / 2 - 1, y1 - z + 4, 2, z - 8);
        break;
      case 'booth':
        box(g, x0, y0 + hh * 0.45, x1, y1, z + 10, '#7a1a2a', '#5a1020');
        box(g, x0, y0, x1, y0 + hh * 0.55, 8, '#9a2436', '#6a1826');
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        for (let x = x0 + w / 3; x < x1 - 2; x += w / 3) { g.beginPath(); g.moveTo(x, y0 - 8); g.lineTo(x, y0 + hh * 0.55 - 8); g.stroke(); }
        break;
      case 'ltable': case 'vtable':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x0 + w / 2, y1 - 2, w / 2, 4, 0, 0, 7); g.fill();
        box(g, x0, y0, x1, y1, z, f.kind === 'vtable' ? 'rgba(200,230,255,0.55)' : '#2e2228', f.kind === 'vtable' ? 'rgba(160,190,220,0.4)' : '#1e161a');
        if (f.kind === 'vtable') { g.fillStyle = '#c0c8d0'; g.beginPath(); g.arc(x0 + w * 0.3, y0 + hh / 2 - z, 5, 0, 7); g.fill(); g.fillStyle = '#1f4a2a'; g.fillRect(x0 + w * 0.3 - 1.5, y0 + hh / 2 - z - 14, 3, 12); g.fillStyle = '#d8b04a'; g.fillRect(x0 + w * 0.3 - 1.5, y0 + hh / 2 - z - 16, 3, 3); }
        else { g.fillStyle = '#e8d8b0'; g.fillRect(x0 + w / 2 - 1.5, y0 + hh / 2 - z - 5, 3, 5); }
        break;
      case 'djdesk':
        box(g, x0, y0, x1, y1, z, '#16141c', '#0c0a10');
        for (const dx of [0.2, 0.8]) {
          const cx = x0 + w * dx, cy = y0 + hh / 2 - z;
          g.fillStyle = '#2a2830'; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill();
          g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill();
          g.strokeStyle = '#e8375a'; g.lineWidth = 1.2; const a = (G.music && G.music.stopped ? 0 : t * 6) + dx * 3;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); g.stroke();
        }
        g.fillStyle = '#26242c'; g.fillRect(x0 + w * 0.38, y0 - z + 3, w * 0.24, hh - 6);
        for (let i = 0; i < 6; i++) { g.fillStyle = Math.sin(t * 8 + i) > 0 && G.power ? '#3dff8a' : '#1a3a24'; g.fillRect(x0 + w * 0.4 + i * 6, y0 - z + 6, 3, 3); }
        g.fillStyle = G.power ? 'rgba(170,210,255,0.85)' : '#223'; g.fillRect(x0 + w * 0.44, y0 - z - 12, w * 0.12, 10);
        break;
      case 'stack':
        box(g, x0, y0, x1, y1, z, '#1a1a1e', '#0e0e12');
        for (let i = 0; i < 3; i++) {
          const cy = y1 - z + 10 + i * 16, pump = G.music && !G.music.stopped ? (1 - Math.min(1, (G.music.beatPhase || 0) * 3)) * 1.5 : 0;
          g.fillStyle = '#26262c'; g.beginPath(); g.arc(x0 + w / 2, cy, 7 + pump, 0, 7); g.fill();
          g.fillStyle = '#101014'; g.beginPath(); g.arc(x0 + w / 2, cy, 3, 0, 7); g.fill();
        }
        break;
      case 'fspeaker': {
        const pump = G.music && !G.music.stopped ? (1 - Math.min(1, (G.music.beatPhase || 0) * 3)) * 1.4 : 0;
        box(g, x0, y0, x1, y1, z, '#1c1c22', '#101014');
        g.fillStyle = '#2a2a32'; g.beginPath(); g.arc(x0 + w / 2, y1 - z / 2, 8 + pump, 0, 7); g.fill();
        g.fillStyle = '#0c0c10'; g.beginPath(); g.arc(x0 + w / 2, y1 - z / 2, 3.5, 0, 7); g.fill();
        if (f.distort) { g.fillStyle = 'rgba(255,80,40,0.8)'; g.fillRect(x0 + 3, y0 - z + 3, 4, 4); }
        break;
      }
      case 'truss':
        g.fillStyle = '#8a8e96'; g.fillRect(x0 + 2, y1 - z, 3, z); g.fillRect(x1 - 5, y1 - z, 3, z);
        g.strokeStyle = '#6a6e76'; g.lineWidth = 1;
        for (let y = y1 - z; y < y1; y += 8) { g.beginPath(); g.moveTo(x0 + 3, y); g.lineTo(x1 - 3, y + 8); g.stroke(); }
        break;
      case 'flamingo': drawFlamingo(g, x0 + w / 2, y1 - 2, 1, G); break;
      case 'lockers':
        box(g, x0, y0, x1, y1, z, '#4a5a6a', '#3a4a5a');
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
        for (let x = x0 + w / 6; x < x1; x += w / 6) { g.beginPath(); g.moveTo(x, y1 - z); g.lineTo(x, y1); g.stroke(); }
        break;
      case 'coffee': box(g, x0, y0, x1, y1, z, '#2a2a2e', '#1c1c20'); g.fillStyle = '#ff3a3a'; g.fillRect(x0 + 5, y1 - z + 5, 3, 3); break;
      case 'couch': case 'vcouch': case 'ccouch': {
        const col = f.kind === 'vcouch' ? '#ece8e0' : f.kind === 'ccouch' ? '#5a3a8a' : f.color || '#4a4550';
        if (f.vertical) { box(g, x0, y0, x1, y1, z, U.shade(col, 0.08), U.shade(col, -0.25)); g.fillStyle = U.shade(col, -0.12); g.fillRect(f.flip ? x0 : x1 - 7, y0 - z - 8, 7, hh); }
        else { box(g, x0, y0, x1, y1, z, U.shade(col, 0.08), U.shade(col, -0.25)); g.fillStyle = U.shade(col, -0.12); g.fillRect(x0, f.flip ? y1 - z - 12 : y0 - z - 10, w, 10); }
        if (f.kind === 'vcouch') { g.fillStyle = 'rgba(220,180,80,0.8)'; g.fillRect(x0, y1 - 3, w, 2); }
        break;
      }
      case 'cctvdesk':
        box(g, x0, y0, x1, y1, z, '#3a3a40', '#2a2a30');
        for (let i = 0; i < 3; i++) { g.fillStyle = '#111'; g.fillRect(x0 + 6 + i * 32, y0 - z - 20, 28, 20); g.fillStyle = G.power ? (i === 1 ? '#6a8a70' : '#5a7090') : '#111'; g.fillRect(x0 + 8 + i * 32, y0 - z - 18, 24, 15); }
        break;
      case 'breaker': box(g, x0, y0, x1, y1, z, '#6a6e74', '#50545a'); g.fillStyle = G.power ? '#3c3' : '#e33'; g.fillRect(x0 + 3, y1 - z + 4, w - 6, 5); break;
      case 'alarmpanel': box(g, x0, y0, x1, y1, z, '#8a1a1a', '#6a1010'); g.fillStyle = G.alarm && Math.sin(t * 12) > 0 ? '#ff4040' : '#401010'; g.beginPath(); g.arc(x0 + w / 2, y1 - z / 2, 4, 0, 7); g.fill(); break;
      case 'mdesk':
        box(g, x0, y0, x1, y1, z, '#6a4428', '#4a2e1a');
        g.fillStyle = '#eee'; g.fillRect(x0 + 12, y0 - z + 6, 18, 12); g.fillRect(x0 + 16, y0 - z + 4, 18, 12);
        g.fillStyle = '#e8d070'; g.beginPath(); g.arc(x1 - 16, y0 - z + 10, 6, 0, 7); g.fill();
        break;
      case 'safe': box(g, x0, y0, x1, y1, z, '#3a3a40', '#2a2a30'); g.strokeStyle = '#999'; g.lineWidth = 1.5; g.beginPath(); g.arc(x0 + w / 2, y1 - z / 2, 5, 0, 7); g.stroke(); break;
      case 'filing': box(g, x0, y0, x1, y1, z, '#7a7e84', '#5a5e64'); g.fillStyle = '#333'; for (let i = 0; i < 3; i++) g.fillRect(x0 + w / 2 - 4, y1 - z + 6 + i * 10, 8, 2); break;
      case 'bench': box(g, x0, y0, x1, y1, z, '#8a6440', '#5e4228'); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; if (f.vertical) { g.beginPath(); g.moveTo(x0 + w / 2, y0 - z); g.lineTo(x0 + w / 2, y1 - z); g.stroke(); } else { g.beginPath(); g.moveTo(x0, y0 + hh / 2 - z); g.lineTo(x1, y0 + hh / 2 - z); g.stroke(); } break;
      case 'ashtray': g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x0 + w / 2, y1, 7, 3, 0, 0, 7); g.fill(); g.fillStyle = '#6a6e74'; g.fillRect(x0 + 2, y1 - z, w - 4, z); g.fillStyle = '#8a8e94'; g.beginPath(); g.ellipse(x0 + w / 2, y1 - z, w / 2 + 1, 3, 0, 0, 7); g.fill(); break;
      case 'heater':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x0 + w / 2, y1, 8, 3, 0, 0, 7); g.fill();
        g.fillStyle = '#5a5e64'; g.fillRect(x0 + w / 2 - 1.5, y1 - z, 3, z);
        g.fillStyle = '#7a7e84'; g.beginPath(); g.ellipse(x0 + w / 2, y1 - z, 12, 4, 0, 0, 7); g.fill();
        g.fillStyle = G.power ? 'rgba(255,120,40,0.9)' : '#553'; g.fillRect(x0 + w / 2 - 3, y1 - z + 6, 6, 10);
        break;
      case 'planter': box(g, x0, y0, x1, y1, z, '#6a4a2e', '#4e3620'); for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#2e6a36' : '#3a7a42'; g.beginPath(); g.ellipse(x0 + 10 + i * (w - 20) / 4, y0 - z - 4, 9, 7, 0, 0, 7); g.fill(); } break;
      case 'coatcounter':
        box(g, x0, y0, x1, y1, z, '#6a4428', '#4a2e1a');
        g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(x0 + w / 2, y0 + 20 - z, 3, 0, 7); g.fill();
        break;
      case 'coatrack':
        for (let y = y0 + 4; y < y1; y += 9) { g.fillStyle = ['#3a4a6a', '#8a2a3a', '#1a1a1e', '#6a6a2a', '#e0d8c8', '#2a5a4a', '#7a4a8a'][((y / 9) | 0) % 7]; g.fillRect(x0 + 2, y - z, w - 3, 8); }
        g.fillStyle = '#888'; g.fillRect(x0 + w / 2 - 1, y0 - z - 4, 2, hh);
        break;
      case 'atm': box(g, x0, y0, x1, y1, z, '#4a4e56', '#34383e'); g.fillStyle = G.power ? '#6ab8ff' : '#222'; g.fillRect(x0 + 5, y1 - z + 6, w - 10, 10); break;
      case 'lava': g.fillStyle = '#2a2230'; g.fillRect(x0 + 4, y1 - 8, w - 8, 8); g.fillStyle = 'rgba(255,90,200,0.85)'; g.beginPath(); g.ellipse(x0 + w / 2, y1 - 16, 5, 9, 0, 0, 7); g.fill(); g.fillStyle = '#ffb0e8'; g.beginPath(); g.arc(x0 + w / 2, y1 - 14 - Math.abs(Math.sin(t * 0.7)) * 8, 2.5, 0, 7); g.fill(); break;
      case 'podium': box(g, x0, y0, x1, y1, z, '#4a3020', '#3a2418'); g.fillStyle = '#eee'; g.fillRect(x0 + 5, y0 - z + 3, w - 10, 8); break;
      case 'lamp':
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x0 + w / 2, y1, 6, 2.5, 0, 0, 7); g.fill();
        g.fillStyle = '#3a3c42'; g.fillRect(x0 + w / 2 - 2, y1 - z, 4, z);
        g.fillStyle = '#4a4c52'; g.fillRect(x0 + w / 2 - 2, y1 - z, 14, 4);
        g.fillStyle = G.power || true ? '#ffd28a' : '#333'; g.fillRect(x0 + w / 2 + 6, y1 - z + 4, 7, 2);
        break;
      case 'bin': box(g, x0, y0, x1, y1, z, '#2a3a2a', '#1e2c1e'); break;
      case 'bikerack': g.strokeStyle = '#7a7e86'; g.lineWidth = 2; for (let x = x0 + 6; x < x1; x += 16) { g.beginPath(); g.arc(x, y1, 7, Math.PI, 0); g.stroke(); } break;
      case 'car': drawCar(g, f, G); break;
      case 'kebab': drawKebab(g, f, G); break;
      default: box(g, x0, y0, x1, y1, z, '#555', '#333');
    }
  }
  function drawFlamingo(g, x, y, s, G, glow) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 16, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#20202a'; g.fillRect(-12, -6, 24, 6);
    g.strokeStyle = '#e0508a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-2, -6); g.lineTo(-2, -26); g.moveTo(3, -6); g.lineTo(5, -16); g.lineTo(0, -24); g.stroke();
    g.fillStyle = '#ff6fa8';
    g.beginPath(); g.ellipse(0, -32, 13, 8, -0.15, 0, 7); g.fill();
    g.fillStyle = '#ff8fbf'; g.beginPath(); g.ellipse(-6, -34, 6, 4, -0.3, 0, 7); g.fill();
    g.strokeStyle = '#ff6fa8'; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(9, -34); g.quadraticCurveTo(18, -44, 10, -50); g.quadraticCurveTo(4, -56, 9, -61); g.stroke();
    g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(10, -62, 4, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(13, -63); g.lineTo(19, -59); g.lineTo(13, -60); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(11, -63, 0.9, 0, 7); g.fill();
    g.restore();
  }
  R.drawFlamingo = drawFlamingo;
  function drawCar(g, f, G) {
    const { x0, y0, x1, y1 } = f, w = x1 - x0, h = y1 - y0;
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0 - 2, y0 + 4, w + 4, h, 10); g.fill();
    g.fillStyle = f.color; rr(g, x0, y0 - 14, w, h, 10); g.fill();
    g.fillStyle = U.shade(f.color, -0.25); g.fillRect(x0, y1 - 18, w, 6);
    g.fillStyle = 'rgba(30,40,55,0.95)';
    const fy = f.flip ? y0 - 14 + h * 0.62 : y0 - 14 + h * 0.18;
    rr(g, x0 + 5, fy, w - 10, h * 0.2, 4); g.fill();
    g.fillStyle = U.shade(f.color, 0.12); rr(g, x0 + 6, y0 - 14 + h * 0.36, w - 12, h * 0.26, 5); g.fill();
    g.fillStyle = f.flip ? '#ff3030' : '#fff6d0';
    g.fillRect(x0 + 4, f.flip ? y1 - 17 : y0 - 13, 7, 3); g.fillRect(x1 - 11, f.flip ? y1 - 17 : y0 - 13, 7, 3);
  }
  function drawKebab(g, f, G) {
    const { x0, y0, x1, y1, z } = f, w = x1 - x0;
    box(g, x0, y0, x1, y1, z, '#e8e4dc', '#c8c2b8');
    const open = G.kebabOpen;
    g.fillStyle = open ? '#ffe7a8' : '#555'; g.fillRect(x0 + 30, y1 - z + 8, w - 60, 18);
    g.fillStyle = '#d23a2a'; for (let i = 0; i < 8; i++) g.fillRect(x0 + 24 + i * ((w - 48) / 8), y1 - z + 2, (w - 48) / 16, 6);
    g.fillStyle = '#222'; g.beginPath(); g.arc(x0 + 26, y1, 8, 0, 7); g.arc(x1 - 26, y1, 8, 0, 7); g.fill();
  }
  function rr(g, x, y, w, h, r) { Pp.rr(g, x, y, w, h, r); }

  /* ================= props ================= */
  const WEIRD_ART = {
    chicken(g) { g.fillStyle = '#ddd'; g.beginPath(); g.ellipse(0, -2, 12, 5, 0, 0, 7); g.fill(); g.fillStyle = '#c47a2a'; g.beginPath(); g.ellipse(0, -7, 8, 6, 0, 0, 7); g.fill(); g.fillStyle = '#a85a1a'; g.beginPath(); g.ellipse(-8, -6, 3, 2, 0.5, 0, 7); g.ellipse(8, -6, 3, 2, -0.5, 0, 7); g.fill(); },
    gnome(g) { g.fillStyle = '#3a6adf'; g.beginPath(); g.ellipse(0, -6, 6, 7, 0, 0, 7); g.fill(); g.fillStyle = '#f0c8a8'; g.beginPath(); g.arc(0, -14, 4, 0, 7); g.fill(); g.fillStyle = '#eee'; g.beginPath(); g.moveTo(-4, -13); g.lineTo(0, -5); g.lineTo(4, -13); g.fill(); g.fillStyle = '#e33'; g.beginPath(); g.moveTo(-5, -16); g.lineTo(0, -28); g.lineTo(5, -16); g.fill(); },
    cart(g) { g.strokeStyle = '#b8bcc4'; g.lineWidth = 1.5; g.strokeRect(-14, -22, 26, 16); for (let i = -12; i < 12; i += 5) { g.beginPath(); g.moveTo(i, -22); g.lineTo(i, -6); g.stroke(); } g.beginPath(); g.moveTo(12, -22); g.lineTo(18, -26); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(-11, -2, 2.5, 0, 7); g.arc(9, -2, 2.5, 0, 7); g.fill(); },
    microwave(g) { box(g, -11, -8, 11, 0, 14, '#d0d0d4', '#a8a8ae'); g.fillStyle = '#222'; g.fillRect(-9, -13, 12, 9); },
    goldfish(g) { g.fillStyle = 'rgba(200,230,255,0.55)'; g.beginPath(); g.ellipse(0, -8, 7, 8, 0, 0, 7); g.fill(); g.fillStyle = '#ff8a1a'; g.beginPath(); g.ellipse(Math.sin(LC.now() * 3) * 2, -8, 3, 1.8, 0, 0, 7); g.fill(); },
    cake(g) { box(g, -10, -7, 10, 0, 10, '#f4e0e8', '#e8b8c8'); g.fillStyle = '#ff5a8a'; g.fillRect(-10, -14, 20, 2); g.fillStyle = '#ffd24a'; for (let i = -6; i <= 6; i += 4) { g.fillRect(i, -22, 1.5, 6); } },
    bowling(g) { g.fillStyle = '#2a2a6a'; g.beginPath(); g.arc(0, -7, 7, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(-2, -9, 1, 0, 7); g.arc(1, -10, 1, 0, 7); g.arc(0, -7, 1, 0, 7); g.fill(); },
    arm(g) { g.strokeStyle = '#f0d0b8'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12, -3); g.lineTo(4, -4); g.lineTo(12, -9); g.stroke(); },
    doormat(g) { g.fillStyle = '#8a6a3a'; g.fillRect(-14, -8, 28, 12); g.fillStyle = '#3a2a1a'; g.font = 'bold 5px sans-serif'; g.textAlign = 'center'; g.fillText('WELCOME', 0, 0); },
    sombrero(g) { g.fillStyle = '#e8c35a'; g.beginPath(); g.ellipse(0, -3, 15, 6, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -6, 6, Math.PI, 0); g.fill(); g.fillStyle = '#d23a3a'; g.fillRect(-6, -7, 12, 2); },
    trophy(g) { g.fillStyle = '#e8c04a'; g.fillRect(-2, -8, 4, 8); g.beginPath(); g.moveTo(-7, -20); g.lineTo(7, -20); g.lineTo(4, -10); g.lineTo(-4, -10); g.fill(); g.fillRect(-6, -2, 12, 3); },
    pineapple(g) { g.fillStyle = '#d8a02a'; g.beginPath(); g.ellipse(0, -8, 6, 8, 0, 0, 7); g.fill(); g.fillStyle = '#3a8a3a'; g.beginPath(); g.moveTo(-5, -15); g.lineTo(0, -26); g.lineTo(5, -15); g.fill(); },
    duck(g) { g.fillStyle = '#ffd82a'; g.beginPath(); g.ellipse(0, -8, 12, 8, 0, 0, 7); g.fill(); g.beginPath(); g.arc(7, -18, 6, 0, 7); g.fill(); g.fillStyle = '#ff8a1a'; g.beginPath(); g.moveTo(12, -18); g.lineTo(18, -16); g.lineTo(12, -15); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(8, -19, 1, 0, 7); g.fill(); },
    suitcase(g) { box(g, -10, -6, 10, 0, 16, '#8a2a3a', '#6a1a2a'); g.fillStyle = '#222'; g.fillRect(-3, -24, 6, 3); },
    guitar(g) { g.fillStyle = '#b8742a'; g.beginPath(); g.ellipse(-4, -6, 7, 5, 0, 0, 7); g.ellipse(3, -6, 5, 4, 0, 0, 7); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(6, -7, 16, 2.4); },
    scooter(g) { g.strokeStyle = '#3ad0b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, -2); g.lineTo(10, -2); g.lineTo(12, -24); g.moveTo(8, -24); g.lineTo(16, -24); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(-12, -1, 3, 0, 7); g.arc(10, -1, 3, 0, 7); g.fill(); },
  };
  R.WEIRD_ART = WEIRD_ART;
  function drawProp(g, p, G) {
    const b = p.body, x = b.x, y = b.y, k = p.fallen;
    g.save();
    g.translate(x, y - (p.z0 || 0));
    if (p.carriedBy) g.translate(0, -(p.carryZ || 14));
    if (k > 0) { g.rotate(p.fallDir > -Math.PI / 2 && p.fallDir < Math.PI / 2 ? k * 1.4 : -k * 1.4); }
    switch (p.kind) {
      case 'stool':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, 7); g.fill();
        g.fillStyle = '#8a8e96'; g.fillRect(-1.2, -16, 2.4, 16); g.fillRect(-5, -6, 10, 1.5);
        g.fillStyle = '#1e1e24'; g.beginPath(); g.ellipse(0, -17, 7.5, 3.5, 0, 0, 7); g.fill();
        g.fillStyle = '#b3123a'; g.beginPath(); g.ellipse(0, -18, 7, 3, 0, 0, 7); g.fill();
        break;
      case 'chair':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 8, 3.5, 0, 0, 7); g.fill();
        g.fillStyle = '#2a2026'; g.fillRect(-6, -10, 1.6, 10); g.fillRect(4.4, -10, 1.6, 10);
        g.fillStyle = '#5a3a2e'; rr(g, -7, -13, 14, 5, 2); g.fill();
        { const back = Math.sin(p.face) < 0; g.fillStyle = '#4a2e24'; if (back) rr(g, -7, -26, 14, 11, 2); else rr(g, -7, -19, 14, 3, 1.5); g.fill(); }
        break;
      case 'table':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 1, p.high ? 10 : 14, 4.5, 0, 0, 7); g.fill();
        g.fillStyle = '#2a2a30'; g.fillRect(-2, p.high ? -30 : -21, 4, p.high ? 30 : 21); g.fillRect(-7, -2, 14, 2);
        g.fillStyle = '#18161c'; g.beginPath(); g.ellipse(0, p.high ? -30 : -21, p.high ? 11 : 15, p.high ? 5 : 7, 0, 0, 7); g.fill();
        g.fillStyle = '#3a2e36'; g.beginPath(); g.ellipse(0, p.high ? -31 : -22, p.high ? 10 : 14, p.high ? 4.5 : 6.2, 0, 0, 7); g.fill();
        for (let i = 0; i < p.glasses; i++) Pp.drawGlass(g, -6 + i * 4, (p.high ? -32 : -23) + (i % 2) * 2, { c: [230, 170, 60], fill: 0.15 });
        break;
      case 'plant': {
        const big = p.big, s = big ? 1.3 : 1;
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 9 * s, 3.5 * s, 0, 0, 7); g.fill();
        g.fillStyle = '#b8643a'; g.beginPath(); g.moveTo(-7 * s, -12 * s); g.lineTo(7 * s, -12 * s); g.lineTo(5 * s, 0); g.lineTo(-5 * s, 0); g.closePath(); g.fill();
        g.fillStyle = '#9a4e2a'; g.fillRect(-7.5 * s, -13 * s, 15 * s, 3 * s);
        const sway = Math.sin(G.t * 1.3 + p.seed * 9) * 0.06;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.42 + sway;
          g.fillStyle = i % 2 ? '#2f8a3e' : '#3aa24a';
          g.beginPath(); g.ellipse(Math.cos(a) * 9 * s, -14 * s + Math.sin(a) * 12 * s, 3.5 * s, 9 * s, a + Math.PI / 2, 0, 7); g.fill();
        }
        if (p.hat) { g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(-5, -28 * s); g.lineTo(0, -38 * s); g.lineTo(5, -28 * s); g.fill(); }
        break;
      }
      case 'cone': Pp.drawCone(g, 0, 0, 1); break;
      case 'sign':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 8, 3, 0, 0, 7); g.fill();
        g.fillStyle = '#ffd21f'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-3, -24); g.lineTo(3, -24); g.lineTo(7, 0); g.closePath(); g.fill();
        g.strokeStyle = '#c9a200'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#111'; g.font = 'bold 3.4px sans-serif'; g.textAlign = 'center'; g.fillText('CAUTION', 0, -18);
        g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.arc(-1, -13.5, 1.2, 0, 7); g.moveTo(-1, -12); g.lineTo(1, -8); g.lineTo(3.5, -7); g.moveTo(0, -10); g.lineTo(-3, -9); g.moveTo(1, -8); g.lineTo(-1.5, -5); g.stroke();
        g.fillText('WET FLOOR', 0, -2.5);
        break;
      case 'extinguisher':
        if (p.mounted) { g.fillStyle = '#333'; g.fillRect(-4, -26, 8, 3); }
        g.fillStyle = '#d82020'; rr(g, -3.5, p.mounted ? -24 : -15, 7, 15, 3); g.fill();
        g.fillStyle = '#222'; g.fillRect(-2, p.mounted ? -27 : -18, 4, 3);
        g.strokeStyle = '#222'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1, p.mounted ? -26 : -17); g.quadraticCurveTo(7, p.mounted ? -22 : -13, 5, p.mounted ? -14 : -5); g.stroke();
        break;
      case 'beanbag':
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 1, 14, 5, 0, 0, 7); g.fill();
        g.fillStyle = ['#e8375a', '#2f7ae5', '#f5c542', '#1fbf8f', '#a64dff'][(p.seed * 5) | 0]; g.beginPath(); g.ellipse(0, -7, 14, 9, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.ellipse(-4, -11, 6, 3, -0.3, 0, 7); g.fill();
        break;
      case 'crocodile': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 1, 24, 6, 0, 0, 7); g.fill();
        g.fillStyle = '#3fbf4a'; g.beginPath(); g.ellipse(0, -8, 22, 7, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(22, -8, 9, 4, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-20, -8); g.lineTo(-34, -5); g.lineTo(-20, -4); g.fill();
        g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(16 + i * 3, -6); g.lineTo(17.5 + i * 3, -3); g.lineTo(19 + i * 3, -6); g.fill(); }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(16, -14, 3, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(17, -14, 1.4, 0, 7); g.fill();
        g.fillStyle = '#2f9a3a'; for (let i = -14; i < 14; i += 6) { g.beginPath(); g.moveTo(i, -14); g.lineTo(i + 3, -18); g.lineTo(i + 6, -14); g.fill(); }
        break;
      }
      case 'balloon': {
        const c = p.color || '#ff4fa8';
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -p.z + 8); g.lineTo(0, -p.z + 28); g.stroke();
        g.fillStyle = c; g.beginPath(); g.ellipse(0, -p.z, 6, 7.5, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-2, -p.z - 3, 1.5, 2.2, -0.4, 0, 7); g.fill();
        break;
      }
      case 'weird': { const art = WEIRD_ART[p.what] || WEIRD_ART.gnome; g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 11, 4, 0, 0, 7); g.fill(); art(g); break; }
    }
    g.restore();
  }
  R.drawProp = drawProp;

  /* ================= mess & items ================= */
  function blob(g, m, n, sc = 1) {
    for (let i = 0; i < n; i++) {
      const a = (m.seed + i * 2.39) % 6.28, d = (i === 0 ? 0 : m.r * 0.45) * sc;
      const rx = m.r * (i === 0 ? 0.8 : 0.5 + ((m.seed * (i + 3)) % 0.3)) * sc, ry = rx * 0.62;
      g.beginPath(); g.ellipse(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d * 0.6, rx, ry, a * 0.3, 0, 7); g.fill();
    }
  }
  function drawMess(g, m, G) {
    const a = 0.3 + 0.7 * U.clamp(m.amt, 0, 1);
    switch (m.kind) {
      case 'spill': case 'water':
        g.fillStyle = U.rgba(m.kind === 'water' ? [150, 200, 255] : m.sticky ? m.c.map((v) => v * 0.55) : m.c, (0.55 * a).toFixed(3)); blob(g, m, 4);
        g.fillStyle = 'rgba(255,255,255,' + (0.18 * a).toFixed(3) + ')'; g.beginPath(); g.ellipse(m.x - m.r * 0.2, m.y - m.r * 0.15, m.r * 0.35, m.r * 0.1, -0.3, 0, 7); g.fill();
        break;
      case 'wet':
        g.fillStyle = 'rgba(170,210,255,' + (0.16 * Math.min(1, m.ttl / 6)).toFixed(3) + ')'; blob(g, m, 3);
        g.fillStyle = 'rgba(255,255,255,' + (0.14 * Math.min(1, m.ttl / 6)).toFixed(3) + ')'; g.fillRect(m.x - m.r * 0.5, m.y - 1, m.r * 0.6, 1.2);
        break;
      case 'vomit':
        g.fillStyle = 'rgba(176,172,82,' + (0.85 * a).toFixed(3) + ')'; blob(g, m, 5);
        g.fillStyle = 'rgba(210,150,70,' + (0.8 * a).toFixed(3) + ')';
        for (let i = 0; i < 9; i++) { const aa = m.seed + i * 1.7, d = (m.r * 0.6 * ((i * 37) % 10)) / 10; g.fillRect(m.x + Math.cos(aa) * d, m.y + Math.sin(aa) * d * 0.6, 2.5, 2); }
        break;
      case 'glass':
        for (let i = 0; i < 7; i++) {
          const aa = m.seed + i * 0.9, d = (m.r * ((i * 29) % 10)) / 10;
          const sx = m.x + Math.cos(aa) * d, sy = m.y + Math.sin(aa) * d * 0.6;
          g.fillStyle = 'rgba(200,230,255,' + (0.75 * a).toFixed(3) + ')';
          g.beginPath(); g.moveTo(sx, sy - 2); g.lineTo(sx + 2.5, sy + 1); g.lineTo(sx - 1.5, sy + 1.5); g.fill();
          if (Math.sin(G.t * 3 + i + m.seed) > 0.9) { g.fillStyle = '#fff'; g.fillRect(sx, sy - 1, 1.3, 1.3); }
        }
        break;
      case 'trash':
        g.fillStyle = '#d02a2a'; g.beginPath(); g.ellipse(m.x - 4, m.y, 4, 2.6, m.seed, 0, 7); g.fill();
        g.fillStyle = '#eee'; g.fillRect(m.x + 2, m.y - 3, 5, 4); g.fillStyle = '#e8e0d0'; g.fillRect(m.x - 1, m.y + 3, 4, 3);
        g.strokeStyle = '#4af'; g.lineWidth = 1; g.beginPath(); g.moveTo(m.x - 6, m.y + 4); g.lineTo(m.x, m.y + 6); g.stroke();
        break;
      case 'food':
        g.fillStyle = '#f0c040'; for (let i = 0; i < 6; i++) { const aa = m.seed + i; g.save(); g.translate(m.x + Math.cos(aa) * 6, m.y + Math.sin(aa) * 3); g.rotate(aa); g.fillRect(-3, -0.8, 6, 1.6); g.restore(); }
        g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(m.x, m.y, 5, 3, 0.4, 0, 7); g.fill(); g.fillStyle = '#5a9a3a'; g.fillRect(m.x - 2, m.y - 2, 3, 2);
        break;
      case 'powder': g.fillStyle = 'rgba(240,240,245,' + (0.5 * a).toFixed(3) + ')'; blob(g, m, 5); break;
      case 'dirt': g.fillStyle = 'rgba(80,55,35,' + (0.8 * a).toFixed(3) + ')'; blob(g, m, 4, 0.8); break;
      case 'confetti': for (let i = 0; i < 16; i++) { const aa = m.seed + i * 2.1, d = (m.r * ((i * 13) % 10)) / 10; g.fillStyle = ['#ff4fa8', '#4af0ff', '#ffe14a', '#8aff6a', '#b56aff'][i % 5]; g.fillRect(m.x + Math.cos(aa) * d, m.y + Math.sin(aa) * d * 0.6, 2.2, 1.4); } break;
      case 'debris':
        for (let i = 0; i < 6; i++) { const aa = m.seed + i * 1.3, d = (m.r * ((i * 31) % 10)) / 10; g.save(); g.translate(m.x + Math.cos(aa) * d, m.y + Math.sin(aa) * d * 0.6); g.rotate(aa); g.fillStyle = i % 2 ? U.rgb(m.c) : U.rgb(m.c.map((v) => v * 0.7)); g.fillRect(-5, -1.5, 10, 3); g.restore(); }
        break;
    }
  }
  function drawItem(g, it, G) {
    g.save(); g.translate(it.x, it.y); g.rotate(it.rot || 0);
    switch (it.kind) {
      case 'shoe': g.fillStyle = U.rgb(it.c); g.beginPath(); g.ellipse(0, 0, 6, 2.6, 0, 0, 7); g.fill(); g.fillRect(-6, -3, 4, 3); break;
      case 'jacket': g.fillStyle = U.rgb(it.c); g.beginPath(); g.moveTo(-9, -4); g.lineTo(9, -5); g.lineTo(11, 4); g.lineTo(-8, 5); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-1, -4, 1.4, 9); break;
      case 'phone': g.fillStyle = '#111'; g.fillRect(-2.5, -4, 5, 8); if (Math.sin(G.t * 2 + it.id) > 0.6) { g.fillStyle = '#9fd8ff'; g.fillRect(-1.8, -3.2, 3.6, 6.4); } break;
      case 'wallet': g.fillStyle = '#6a3a1e'; g.fillRect(-4, -3, 8, 6); break;
      case 'hat': g.fillStyle = U.rgb(it.c); g.beginPath(); g.ellipse(0, 0, 7, 3.5, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -1, 4, Math.PI, 0); g.fill(); break;
      case 'keys': g.strokeStyle = '#d8c070'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 2.4, 0, 7); g.moveTo(2, 0); g.lineTo(7, 1); g.stroke(); break;
      case 'sunglasses': g.fillStyle = '#111'; g.beginPath(); g.ellipse(-2.5, 0, 2.4, 1.6, 0, 0, 7); g.ellipse(2.5, 0, 2.4, 1.6, 0, 0, 7); g.fill(); break;
      case 'tiara': g.fillStyle = '#e8d8ff'; g.beginPath(); g.moveTo(-6, 1); g.lineTo(-4, -3); g.lineTo(-2, 0); g.lineTo(0, -4); g.lineTo(2, 0); g.lineTo(4, -3); g.lineTo(6, 1); g.fill(); break;
      case 'tie': g.fillStyle = U.rgb(it.c); g.beginPath(); g.moveTo(-1.5, -6); g.lineTo(1.5, -6); g.lineTo(2.5, 5); g.lineTo(0, 7); g.lineTo(-2.5, 5); g.fill(); break;
      case 'wig': g.fillStyle = U.rgb(it.c); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i) * 4, Math.sin(i) * 2.5, 3, 0, 7); g.fill(); } break;
      default: g.fillStyle = '#ddd'; g.fillRect(-3, -2, 6, 4);
    }
    g.restore();
  }

  /* ================= overhead ================= */
  function drawOverhead(g, G, v) {
    // truss above the dance floor
    const tr = M.truss, z = tr.z;
    g.strokeStyle = 'rgba(150,154,164,0.9)'; g.lineWidth = 4;
    g.strokeRect(tr.x0, tr.y0 - z, tr.x1 - tr.x0, tr.y1 - tr.y0);
    g.strokeStyle = 'rgba(110,114,124,0.8)'; g.lineWidth = 1;
    for (let x = tr.x0; x < tr.x1; x += 12) { g.beginPath(); g.moveTo(x, tr.y0 - z - 2); g.lineTo(x + 6, tr.y0 - z + 2); g.moveTo(x, tr.y1 - z - 2); g.lineTo(x + 6, tr.y1 - z + 2); g.stroke(); }
    // moving heads
    for (const mh of movers(G)) { g.fillStyle = '#1a1a20'; g.fillRect(mh.x - 5, mh.y - z - 5, 10, 8); g.fillStyle = mh.on ? U.rgb(mh.c) : '#333'; g.beginPath(); g.arc(mh.x + Math.cos(mh.a) * 3, mh.y - z + Math.sin(mh.a) * 2, 2.6, 0, 7); g.fill(); }
    // mirror ball
    const bx = (tr.x0 + tr.x1) / 2, by = (tr.y0 + tr.y1) / 2;
    g.strokeStyle = '#777'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by - z - 30); g.lineTo(bx, by - z - 10); g.stroke();
    g.fillStyle = '#b8bcc8'; g.beginPath(); g.arc(bx, by - z, 11, 0, 7); g.fill();
    for (let i = 0; i < 18; i++) { const a = i * 0.9 + G.t * 0.8; g.fillStyle = Math.sin(a * 3) > 0 ? '#fff' : '#8a8e9a'; g.fillRect(bx + Math.cos(a) * 7 - 1, by - z + Math.sin(i * 1.7) * 7 - 1, 2.2, 2.2); }
    // patio string lights
    g.strokeStyle = 'rgba(40,30,20,0.7)'; g.lineWidth = 0.8;
    for (let y = 20; y <= 46; y += 3) { g.beginPath(); g.moveTo(77 * T, y * T - 60); g.quadraticCurveTo(82 * T, y * T - 48, 87.5 * T, y * T - 60); g.stroke(); }
    // hanging lamps over the bar
    for (let x = 18; x <= 30; x += 3) { g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(x * T - 7, 12 * T - 64); g.lineTo(x * T + 7, 12 * T - 64); g.lineTo(x * T + 4, 12 * T - 72); g.lineTo(x * T - 4, 12 * T - 72); g.fill(); g.fillStyle = G.power ? '#ffcf8a' : '#333'; g.fillRect(x * T - 4, 12 * T - 64, 8, 2); }
  }
  // moving head fixtures on the truss
  function movers(G) {
    const tr = M.truss, m = G.music || {}, out = [];
    const on = G.power && !(G.lightsOn > 0.5) && !m.stopped;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const top = i < n / 2, k = (i % (n / 2)) / (n / 2 - 1);
      const x = tr.x0 + 30 + k * (tr.x1 - tr.x0 - 60), y = top ? tr.y0 : tr.y1;
      const bt = m.beatTime || 0;
      const a = Math.sin(bt * 0.4 + i * 0.9) * 1.2 + (top ? Math.PI / 2 : -Math.PI / 2);
      const reach = 90 + Math.sin(bt * 0.3 + i) * 60 + (m.hanging ? Math.sin(G.t * 7 + i) * 60 : 0);
      out.push({ x, y, a, tx: x + Math.cos(a) * reach * 0.6, ty: y + Math.sin(a) * reach, c: LEDC[(i + (m.palette || 0)) % LEDC.length], on: on && (m.energy || 0) > 0.3 });
    }
    return out;
  }

  /* ================= bubbles, emotes (screen space) ================= */
  const BUB_FONT = '600 13px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  function drawBubbles(g, G, P) {
    P = P || R;
    const list = [];
    for (const c of G.chars) {
      if (!c.bubble && !c.emote) continue;
      if (P.is3D && c.hidden) continue;
      const s = P.toScreen(c.x, c.y, (c.z || 0) + 50 * ((c.look && c.look.height) || 1) + (c.pose === 'lie' || c.pose === 'fallen' ? -30 : 0));
      if (s.behind || s.x < -80 || s.x > P.cw + 80 || s.y < -60 || s.y > P.ch + 60) continue;
      // in 3D, far-away chatter is dropped unless it matters
      if (P.is3D && c.bubble && !c.bubble.pri && !c.emote) { const p = G.player; if (p && U.dist(p.x, p.y, c.x, c.y) > 520) continue; }
      list.push({ c, s });
    }
    g.save();
    g.setTransform(P.dpr || dpr, 0, 0, P.dpr || dpr, 0, 0);
    g.font = BUB_FONT;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    // emotes
    for (const { c, s } of list) if (c.emote) drawEmote(g, c.emote, s.x, s.y - 4, G.t);
    g.textAlign = 'left';
    // bubbles: sort by priority, avoid overlaps
    const boxes = [];
    const bl = list.filter((e) => e.c.bubble).sort((a, b) => (b.c.bubble.pri || 0) - (a.c.bubble.pri || 0));
    let shown = 0;
    for (const { c, s } of bl) {
      const b = c.bubble;
      if (shown > 14 && !b.pri) continue;
      const lines = wrap(g, b.text, b.kind === 'radio' ? 240 : 190);
      const lh = 16, pad = 7;
      let w = 0; for (const l of lines) w = Math.max(w, g.measureText(l).width);
      w += pad * 2; const h = lines.length * lh + pad;
      let bx = U.clamp(s.x - w / 2, 6, P.cw - w - 6), by = s.y - h - (c.emote ? 30 : 12);
      for (let k = 0; k < 6; k++) {
        const hit = boxes.find((o) => bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y);
        if (!hit) break;
        by = hit.y - h - 4;
      }
      by = U.clamp(by, 6, P.ch - h - 6);
      boxes.push({ x: bx, y: by, w, h });
      const age = G.t - b.t0, fade = Math.min(1, age * 8, (b.dur - age) * 3);
      if (fade <= 0) continue;
      g.globalAlpha = U.clamp(fade, 0, 1) * (b.dim ? 0.7 : 1);
      const kind = b.kind;
      g.fillStyle = kind === 'shout' ? '#fff1f1' : kind === 'player' ? '#ffd23f' : kind === 'think' ? 'rgba(235,235,255,0.9)' : kind === 'radio' ? '#16221c' : '#f7f4ff';
      g.strokeStyle = kind === 'shout' ? '#ff3a4a' : kind === 'player' ? '#1a1400' : 'rgba(20,10,40,0.8)';
      g.lineWidth = kind === 'shout' ? 2 : 1.2;
      rr(g, bx, by, w, h, kind === 'think' ? 12 : 7); g.fill(); g.stroke();
      // tail
      const tx = U.clamp(s.x, bx + 10, bx + w - 10);
      g.beginPath(); g.moveTo(tx - 5, by + h - 0.5); g.lineTo(tx, by + h + 7); g.lineTo(tx + 5, by + h - 0.5); g.closePath(); g.fill();
      g.fillStyle = kind === 'shout' ? '#b0001a' : kind === 'player' ? '#1a1400' : kind === 'radio' ? '#8dffb0' : '#1c1428';
      if (kind === 'shout') g.font = '700 13px "Barlow Semi Condensed", sans-serif';
      lines.forEach((l, i) => g.fillText(l, bx + pad, by + pad / 2 + lh / 2 + i * lh + 1));
      g.font = BUB_FONT;
      shown++;
    }
    g.globalAlpha = 1;
    g.restore();
  }
  const wrapCache = new Map();
  function wrap(g, text, maxW) {
    const key = text + '|' + maxW;
    const hit = wrapCache.get(key);
    if (hit) return hit;
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (wrapCache.size > 600) wrapCache.clear();
    wrapCache.set(key, lines);
    return lines;
  }
  function drawEmote(g, e, x, y, t) {
    const k = e.kind, age = t - (e.t0 || 0);
    const pop = Math.min(1, age * 6);
    g.save(); g.translate(x, y); g.scale(pop, pop);
    const bob = Math.sin(t * 5) * 1.5;
    g.translate(0, bob);
    switch (k) {
      case '!': g.fillStyle = '#ff3a4a'; g.font = '800 22px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('!', 0, 0); break;
      case '?': g.fillStyle = '#ffd23f'; g.font = '800 22px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('?', 0, 0); break;
      case '...': g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-8 + i * 8, 0, 2.4, 0, 7); g.fill(); } break;
      case 'anger': g.strokeStyle = '#ff2a3a'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2 + 0.785); g.beginPath(); g.moveTo(3, 3); g.quadraticCurveTo(8, 0, 3, -3); g.stroke(); g.restore(); } break;
      case 'music': g.fillStyle = '#9fe8ff'; g.font = '700 18px sans-serif'; g.textAlign = 'center'; g.fillText('♪', Math.sin(t * 3) * 3, 0); break;
      case 'zzz': g.fillStyle = '#c8d8ff'; g.font = '800 14px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('z', 0, 0); g.font = '800 11px sans-serif'; g.fillText('z', 8, -9); break;
      case 'sweat': g.fillStyle = '#7fd0ff'; g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(6, -1, 0, 2); g.quadraticCurveTo(-6, -1, 0, -10); g.fill(); break;
      case 'heart': g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(-4, -3, 4.5, 0, 7); g.arc(4, -3, 4.5, 0, 7); g.fill(); g.beginPath(); g.moveTo(-8.4, -2); g.lineTo(0, 8); g.lineTo(8.4, -2); g.fill(); break;
      case 'sick': g.fillStyle = '#9adf5a'; g.beginPath(); g.arc(0, -2, 8, 0, 7); g.fill(); g.fillStyle = '#2a4a1a'; g.fillRect(-4, -4, 2, 2); g.fillRect(2, -4, 2, 2); g.fillRect(-3, 1, 6, 1.5); break;
      case '$': g.fillStyle = '#6aff8a'; g.font = '800 20px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('$', 0, 0); break;
      case 'eye': g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -2, 9, 5.5, 0, 0, 7); g.fill(); g.fillStyle = '#16121c'; g.beginPath(); g.arc(0, -2, 3, 0, 7); g.fill(); break;
      case 'phone': g.fillStyle = '#ff3030'; g.beginPath(); g.arc(0, -2, 4, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 9px sans-serif'; g.textAlign = 'center'; g.fillText('REC', 0, 12); break;
      case 'conga': g.fillStyle = '#ffe14a'; g.font = '800 12px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('CONGA', 0, 0); break;
      case 'skull': g.fillStyle = '#eee'; g.beginPath(); g.arc(0, -3, 6, 0, 7); g.fill(); g.fillRect(-3.5, 1, 7, 4); g.fillStyle = '#111'; g.fillRect(-3, -4, 2.4, 2.4); g.fillRect(0.6, -4, 2.4, 2.4); break;
      case 'star': g.fillStyle = '#ffe14a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r2 = i % 2 ? 3.5 : 8; g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } g.fill(); break;
    }
    g.restore();
  }

  /* ================= lighting ================= */
  const spriteCache = new Map();
  function glowSprite(c) {
    const key = c.join(',');
    let s = spriteCache.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 128;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, U.rgba(c, 1)); gr.addColorStop(0.35, U.rgba(c, 0.55)); gr.addColorStop(1, U.rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    spriteCache.set(key, s);
    return s;
  }
  R.glowSprite = glowSprite;
  function roomClip(g, roomId) {
    const r = M.room(roomId);
    if (!r) return;
    g.beginPath();
    for (const [x0, y0, x1, y1] of r.rects) g.rect(x0 * T - 4, y0 * T - 34, (x1 - x0) * T + 8, (y1 - y0) * T + 38);
    g.clip();
  }
  M.lights.forEach((l) => {
    const r = M.room(l.room);
    l.needsClip = !!r && !r.rects.some(([x0, y0, x1, y1]) => l.x - l.r >= x0 * T && l.x + l.r <= x1 * T && l.y - l.r >= y0 * T && l.y + l.r <= y1 * T);
  });

  function ambientFor(room, G) {
    let a = room.amb;
    const on = G.lightsOn || 0;
    if (!room.outdoor && on > 0) a = U.mix(a, [236, 240, 226], on);
    if (!G.power && !room.outdoor) a = U.mix(a, [8, 8, 14], 0.85);
    if (room.id === 'mens' && G.power && on < 0.5) { const f = Math.sin(G.t * 23) > 0.93 || Math.sin(G.t * 3.1) > 0.985 ? 0.55 : 1; a = a.map((v) => v * f); }
    if (G.alarm && !room.outdoor) { const s = Math.sin(G.t * 9) > 0.6 ? 1 : 0; if (s) a = U.mix(a, [255, 40, 40], 0.35); }
    return a;
  }

  function renderLights(v, G, target) {
    const g = target.g, cv = target.cv, sc = target.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#060509'; g.fillRect(0, 0, cv.width, cv.height);
    const z = v.zoom * sc;
    g.setTransform(z, 0, 0, z, cv.width / 2 - v.x * z, cv.height / 2 - v.y * z);
    const hw = cv.width / 2 / z, hh = cv.height / 2 / z;
    const vx0 = v.x - hw - 60, vx1 = v.x + hw + 60, vy0 = v.y - hh - 60, vy1 = v.y + hh + 120;
    for (const room of M.rooms) {
      g.fillStyle = U.rgb(ambientFor(room, G));
      for (const [x0, y0, x1, y1] of room.rects) {
        if (x1 * T < vx0 || x0 * T > vx1 || y1 * T < vy0 || y0 * T > vy1) continue;
        g.fillRect(x0 * T, y0 * T - 36, (x1 - x0) * T, (y1 - y0) * T + 36);
      }
    }
    g.globalCompositeOperation = 'lighter';
    const club = !(G.lightsOn > 0.5);
    const dim = club ? 1 : 0.25;
    for (const l of M.lights) {
      if (l.x + l.r < vx0 || l.x - l.r > vx1 || l.y + l.r < vy0 || l.y - l.r > vy1) continue;
      let i = l.i * dim;
      if (l.kebab) i = G.kebabOpen ? 0.9 : 0;
      if (!G.power && !(l.room && M.room(l.room).outdoor) && !l.sign) i *= 0.05;
      if (l.flick === 'bulb') i *= Math.sin(G.t * 17) > 0.96 ? 0.3 : 1;
      if (l.candle) i *= 0.85 + Math.sin(G.t * 9 + l.x) * 0.1;
      if (l.lava) i *= 0.8 + Math.sin(G.t * 0.7 + l.x) * 0.2;
      if (l.sign) i *= G.signFlicker ? 0.25 : 1;
      if (i <= 0.01) continue;
      if (l.needsClip) { g.save(); roomClip(g, l.room); }
      g.globalAlpha = Math.min(1, i);
      g.drawImage(glowSprite(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      if (l.needsClip) g.restore();
    }
    g.globalAlpha = 1;
    if (club && G.power) {
      // LED floor glow + mirror ball specks + moving head pools
      drawLED(g, G, vx0, vy0, vx1, vy1, true);
      for (const mh of movers(G)) {
        if (!mh.on) continue;
        g.globalAlpha = 0.7;
        g.drawImage(glowSprite(mh.c), mh.tx - 40, mh.ty - 26, 80, 52);
      }
      const bx = (M.truss.x0 + M.truss.x1) / 2, by = (M.truss.y0 + M.truss.y1) / 2;
      g.globalAlpha = 0.6;
      g.fillStyle = '#fff';
      for (let i = 0; i < 46; i++) {
        const a = i * 2.4 + G.t * 0.35, d = 60 + ((i * 53) % 420);
        const sx = bx + Math.cos(a) * d * 1.3, sy = by + Math.sin(a) * d * 0.75;
        if (!M.inRoom(sx, sy, 'dance') && !M.inRoom(sx, sy, 'hall')) continue;
        g.fillRect(sx, sy, 3.5, 3.5);
      }
      g.globalAlpha = 1;
    }
    // dynamic lights (phones, flashlight, sparklers, fire, headlights, strobes)
    for (const dl of G.dynLights) {
      if (dl.x + dl.r < vx0 || dl.x - dl.r > vx1 || dl.y + dl.r < vy0 || dl.y - dl.r > vy1) continue;
      if (dl.cone) { drawCone(g, dl); continue; }
      g.globalAlpha = Math.min(1, dl.i);
      g.drawImage(glowSprite(dl.c), dl.x - dl.r, dl.y - dl.r, dl.r * 2, dl.r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  function drawCone(g, dl) {
    g.save();
    if (dl.clipRoom) roomClip(g, dl.clipRoom);
    const gr = g.createRadialGradient(dl.x, dl.y, 4, dl.x, dl.y, dl.r);
    gr.addColorStop(0, U.rgba(dl.c, Math.min(1, dl.i)));
    gr.addColorStop(0.7, U.rgba(dl.c, Math.min(1, dl.i) * 0.5));
    gr.addColorStop(1, U.rgba(dl.c, 0));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(dl.x, dl.y); g.arc(dl.x, dl.y, dl.r, dl.a - dl.w, dl.a + dl.w); g.closePath(); g.fill();
    g.restore();
  }

  /* ================= neon + beams (additive, after lighting) ================= */
  const neonCache = new Map();
  let fontsReady = false;
  R.fontsReady = () => { fontsReady = true; neonCache.clear(); };
  function neonSprite(n) {
    const key = n.kind + (n.text || '') + n.c + fontsReady;
    let s = neonCache.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    const g = s.getContext('2d');
    if (n.kind === 'logo') {
      s.width = 360; s.height = 150;
      g.translate(180, 120);
      g.shadowColor = n.c; g.shadowBlur = 14;
      g.strokeStyle = '#ffd0e6'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      g.font = '400 44px "Tilt Neon", "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#ffd0e6'; g.fillText('FLAMINGO', 24, -8);
      // flamingo line art
      g.beginPath(); g.ellipse(-128, -34, 16, 10, -0.2, 0, 7);
      g.moveTo(-116, -40); g.quadraticCurveTo(-100, -64, -114, -74); g.quadraticCurveTo(-124, -84, -112, -92);
      g.moveTo(-112, -92); g.lineTo(-102, -86);
      g.moveTo(-130, -24); g.lineTo(-130, 4); g.moveTo(-124, -26); g.lineTo(-118, -12); g.lineTo(-126, -4);
      g.stroke();
      g.shadowBlur = 0;
    } else if (n.kind === 'text') {
      const size = n.size || 14;
      g.font = '400 ' + size * 2 + 'px "Tilt Neon", "Arial Rounded MT Bold", sans-serif';
      const w = Math.ceil(g.measureText(n.text).width) + 40;
      s.width = w; s.height = size * 2 + 36;
      g.font = '400 ' + size * 2 + 'px "Tilt Neon", "Arial Rounded MT Bold", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = n.c; g.shadowBlur = 12; g.fillStyle = n.c; g.fillText(n.text, w / 2, s.height / 2);
      g.shadowBlur = 4; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(n.text, w / 2, s.height / 2);
    }
    neonCache.set(key, s);
    return s;
  }
  function drawAdditive(g, G, v) {
    const club = !(G.lightsOn > 0.5);
    g.globalCompositeOperation = 'lighter';
    const hw = R.viewW / 2 + 200, hh = R.viewH / 2 + 200;
    // neon signs
    for (const n of M.neon) {
      const nx = n.kind === 'strip' ? (n.x0 + n.x1) / 2 : n.x, ny = n.y;
      if (Math.abs(nx - v.x) > hw + 900 || Math.abs(ny - v.y) > hh + 200) continue;
      if (n.kebab && !G.kebabOpen) continue;
      const pw = G.power || n.exit || (n.kind === 'logo');
      if (!pw) continue;
      let a = club ? 1 : 0.35;
      if (n.kind === 'logo' && G.signFlicker) a *= 0.2;
      if (n.kind === 'strip') {
        if (!club || !G.power) continue;
        g.globalAlpha = 0.55;
        g.strokeStyle = n.c; g.lineWidth = 3;
        g.beginPath(); g.moveTo(n.x0, n.y - (n.under ? 8 : 22)); g.lineTo(n.x1, n.y - (n.under ? 8 : 22)); g.stroke();
        g.globalAlpha = 0.15; g.lineWidth = 12; g.stroke();
        continue;
      }
      const s = neonSprite(n);
      const sc = n.kind === 'logo' ? 0.62 : 0.5;
      g.globalAlpha = a;
      g.drawImage(s, nx - (s.width * sc) / 2, ny - (n.wall ? 34 : 18) - (s.height * sc) / 2 - (n.kind === 'logo' ? 24 : 0), s.width * sc, s.height * sc);
    }
    g.globalAlpha = 1;
    if (club && G.power) {
      // volumetric beams from moving heads
      for (const mh of movers(G)) {
        if (!mh.on) continue;
        const sx = mh.x, sy = mh.y - M.truss.z;
        const gr = g.createLinearGradient(sx, sy, mh.tx, mh.ty);
        gr.addColorStop(0, U.rgba(mh.c, 0.32)); gr.addColorStop(1, U.rgba(mh.c, 0.04));
        g.fillStyle = gr;
        const dx = mh.tx - sx, dy = mh.ty - sy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        g.beginPath(); g.moveTo(sx + nx * 2, sy + ny * 2); g.lineTo(mh.tx + nx * 26, mh.ty + ny * 16); g.lineTo(mh.tx - nx * 26, mh.ty - ny * 16); g.lineTo(sx - nx * 2, sy - ny * 2); g.closePath(); g.fill();
      }
      // lasers on drops
      const m = G.music || {};
      if (m.laser > 0.05) {
        const ox = 46 * T, oy = 9 * T - 40;
        g.lineWidth = 1.6;
        for (let i = 0; i < 9; i++) {
          const a = Math.PI / 2 + Math.sin(G.t * 1.7 + i * 0.7) * 0.9;
          const ex = ox + Math.cos(a) * 1100, ey = oy + Math.sin(a) * 700;
          g.strokeStyle = U.rgba(i % 2 ? [60, 255, 120] : [255, 50, 80], (0.5 * m.laser).toFixed(3));
          g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.stroke();
        }
      }
      // flamingo statue rim glow
      g.globalAlpha = 0.35;
      g.drawImage(glowSprite([255, 80, 160]), M.flamingo.cx - 40, M.flamingo.cy - 90, 80, 90);
      g.globalAlpha = 1;
    }
    // dynamic glows (phones, flashlight beam haze, sparklers, heaters)
    for (const dl of G.dynLights) {
      if (!dl.glow) continue;
      if (dl.cone) {
        g.save();
        if (dl.clipRoom) roomClip(g, dl.clipRoom);
        const gr = g.createRadialGradient(dl.x, dl.y - 20, 2, dl.x, dl.y - 20, dl.r * 0.9);
        gr.addColorStop(0, 'rgba(255,248,220,0.22)'); gr.addColorStop(1, 'rgba(255,248,220,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(dl.x, dl.y - 20); g.arc(dl.x, dl.y - 20, dl.r * 0.9, dl.a - dl.w * 0.8, dl.a + dl.w * 0.8); g.closePath(); g.fill();
        g.restore();
      } else {
        g.globalAlpha = dl.glow;
        g.drawImage(glowSprite(dl.c), dl.x - dl.gr, dl.y - (dl.gz || 0) - dl.gr, dl.gr * 2, dl.gr * 2);
      }
    }
    // spark-like particles glow
    for (const p of LC.W.parts) {
      if (p.kind !== 'spark') continue;
      g.globalAlpha = 1 - p.life / p.max;
      g.drawImage(glowSprite([255, 200, 90]), p.x - 6, p.y - p.z - 6, 12, 12);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /* ================= particles ================= */
  function drawParticles(g, G) {
    for (const p of LC.W.parts) {
      const k = p.life / p.max;
      const x = p.x, y = p.y - p.z;
      switch (p.kind) {
        case 'drop': g.fillStyle = U.rgba(p.c || [200, 170, 80], 0.8); g.fillRect(x - 1, y - 1, 2.2, 2.2); break;
        case 'shard': g.fillStyle = 'rgba(220,240,255,' + (0.9 - k * 0.5).toFixed(2) + ')'; g.save(); g.translate(x, y); g.rotate(p.rot); g.fillRect(-2, -0.6, 4, 1.2); g.restore(); break;
        case 'splinter': g.fillStyle = U.rgb(p.c || [140, 95, 60]); g.save(); g.translate(x, y); g.rotate(p.rot); g.fillRect(-3, -0.8, 6, 1.6); g.restore(); break;
        case 'dust': g.fillStyle = 'rgba(200,200,190,' + (0.5 * (1 - k)).toFixed(2) + ')'; g.beginPath(); g.arc(x, y, 2 + k * 4, 0, 7); g.fill(); break;
        case 'smoke': case 'vape': g.fillStyle = 'rgba(210,210,220,' + (0.28 * (1 - k)).toFixed(3) + ')'; g.beginPath(); g.arc(x, y, 4 + k * 14 * p.size, 0, 7); g.fill(); break;
        case 'powder': g.fillStyle = 'rgba(245,245,250,' + (0.55 * (1 - k)).toFixed(3) + ')'; g.beginPath(); g.arc(x, y, 8 + k * 26, 0, 7); g.fill(); break;
        case 'stink': g.strokeStyle = 'rgba(150,210,90,' + (0.6 * (1 - k)).toFixed(2) + ')'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 4, x, y - 8); g.quadraticCurveTo(x - 4, y - 12, x, y - 16); g.stroke(); break;
        case 'confetti': g.fillStyle = U.rgb(p.c || [255, 80, 160]); g.save(); g.translate(x, y); g.rotate(p.rot); g.fillRect(-2, -1, 4, 2); g.restore(); break;
        case 'note': g.fillStyle = 'rgba(160,230,255,' + (1 - k).toFixed(2) + ')'; g.font = '12px sans-serif'; g.fillText('♪', x, y); break;
        case 'zzz': g.fillStyle = 'rgba(200,215,255,' + (1 - k).toFixed(2) + ')'; g.font = '800 ' + (8 + k * 6).toFixed(0) + 'px sans-serif'; g.fillText('z', x + Math.sin(k * 6) * 4, y); break;
        case 'heart': g.fillStyle = 'rgba(255,70,110,' + (1 - k).toFixed(2) + ')'; g.font = '11px sans-serif'; g.fillText('♥', x, y); break;
        case 'puff': g.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)).toFixed(2) + ')'; g.beginPath(); g.arc(x, y, 3 + k * 10, 0, 7); g.fill(); break;
        case 'cough': g.fillStyle = 'rgba(220,220,230,' + (0.5 * (1 - k)).toFixed(2) + ')'; g.beginPath(); g.arc(x + k * 10, y, 2 + k * 5, 0, 7); g.fill(); break;
        case 'pow': {
          const s = 0.6 + k * 0.8;
          g.save(); g.translate(x, y); g.scale(s, s); g.rotate(p.rot * 0.2);
          g.fillStyle = 'rgba(255,230,60,' + (1 - k).toFixed(2) + ')';
          g.beginPath(); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r2 = i % 2 ? 6 : 13; g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } g.fill();
          g.fillStyle = 'rgba(200,20,40,' + (1 - k).toFixed(2) + ')'; g.font = '900 9px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.text || 'POW', 0, 1);
          g.restore();
          break;
        }
      }
    }
  }

  /* ================= the scene ================= */
  const list = [];
  const K_SEG = 0, K_FURN = 1, K_PROP = 2, K_CHAR = 3, K_DOOR = 4, K_BAR = 5;
  R.renderView = (g, v, G, opts = {}) => {
    const cw = opts.w, ch = opts.h;
    const z = v.zoom;
    const hw = cw / 2 / z, hh = ch / 2 / z;
    const vx0 = v.x - hw, vx1 = v.x + hw, vy0 = v.y - hh, vy1 = v.y + hh + 60;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#0a090e'; g.fillRect(0, 0, cw, ch);

    // floors
    if (opts.cctv) {
      g.setTransform(z, 0, 0, z, cw / 2 - v.x * z, ch / 2 - v.y * z);
      const sf = getSmallFloor();
      const sx0 = Math.max(0, vx0), sy0 = Math.max(0, vy0 - 40), sx1 = Math.min(M.W * T, vx1), sy1 = Math.min(M.H * T, vy1);
      if (sx1 > sx0 && sy1 > sy0) g.drawImage(sf, sx0 * 0.4, sy0 * 0.4, (sx1 - sx0) * 0.4, (sy1 - sy0) * 0.4, sx0, sy0, sx1 - sx0, sy1 - sy0);
    } else {
      const s = Math.round(z * 1000) / 1000;
      const cx0 = Math.max(0, Math.floor(vx0 / CHP)), cx1 = Math.min(Math.ceil((M.W * T) / CHP) - 1, Math.floor(vx1 / CHP));
      const cy0 = Math.max(0, Math.floor((vy0 - 40) / CHP)), cy1 = Math.min(Math.ceil((M.H * T) / CHP) - 1, Math.floor(vy1 / CHP));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = true;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = chunk(cx, cy, s);
        const sx0 = Math.round((cx * CHP - v.x) * z + cw / 2), sx1 = Math.round(((cx + 1) * CHP - v.x) * z + cw / 2);
        const sy0 = Math.round((cy * CHP - v.y) * z + ch / 2), sy1 = Math.round(((cy + 1) * CHP - v.y) * z + ch / 2);
        g.drawImage(c, sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
      g.setTransform(z, 0, 0, z, cw / 2 - v.x * z, ch / 2 - v.y * z);
    }
    drawLED(g, G, vx0, vy0, vx1, vy1, false);
    // grime (dried stains)
    const gr = LC.W.grime;
    if (gr.canvas) {
      g.globalAlpha = 0.55 + (G.lightsOn || 0) * 0.4;
      g.globalCompositeOperation = 'multiply';
      g.drawImage(gr.canvas, 0, 0, M.W * T, M.H * T);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // mess + items + wet-floor reach hints
    for (const m of LC.W.mess) if (m.x > vx0 - 50 && m.x < vx1 + 50 && m.y > vy0 - 50 && m.y < vy1 + 50) drawMess(g, m, G);
    for (const it of LC.W.items) if (it.x > vx0 - 20 && it.x < vx1 + 20 && it.y > vy0 - 20 && it.y < vy1 + 20) drawItem(g, it, G);
    if (!opts.cctv && G.player && G.player.tool === 'sign') {
      g.strokeStyle = 'rgba(255,210,31,0.35)'; g.setLineDash([5, 5]); g.lineWidth = 1.5;
      for (const p of LC.W.props) if (p.kind === 'sign' && !p.carriedBy) { g.beginPath(); g.ellipse(p.body.x, p.body.y, 72, 50, 0, 0, 7); g.stroke(); }
      g.setLineDash([]);
    }
    if (!opts.cctv && opts.underlay) opts.underlay(g);

    // sortable scene
    list.length = 0;
    for (const s of M.segs) {
      if (s.kind === 'door') continue;
      const sx0 = Math.min(s.ax, s.bx), sx1 = Math.max(s.ax, s.bx), sy0 = Math.min(s.ay, s.by), sy1 = Math.max(s.ay, s.by);
      if (sx1 < vx0 - 20 || sx0 > vx1 + 20 || sy1 < vy0 - 10 || sy0 > vy1 + 60) continue;
      if (s.ay === s.by) list.push({ y: s.ay + s.thick, k: K_SEG, o: s });
      else {
        // vertical walls are cut per tile so people beside them sort correctly
        for (let y = sy0; y < sy1; y += T) {
          const y2 = Math.min(sy1, y + T);
          list.push({ y: y2, k: K_SEG, o: { ax: s.ax, ay: y, bx: s.bx, by: y2, kind: s.kind, thick: s.thick, h: s.h } });
        }
      }
    }
    for (const d of M.doors) if (d.cx > vx0 - 60 && d.cx < vx1 + 60 && d.cy > vy0 - 60 && d.cy < vy1 + 60) list.push({ y: Math.max(d.y0, d.y1) + (d.axis === 'h' ? 3 : 0), k: K_DOOR, o: d });
    for (const f of M.furn) if (f.x1 > vx0 - 40 && f.x0 < vx1 + 40 && f.y1 > vy0 - 20 && f.y0 - f.z < vy1 + 40) list.push({ y: f.y1, k: K_FURN, o: f });
    for (const p of LC.W.props) {
      const b = p.body;
      if (p.worn) continue;
      if (b.x < vx0 - 40 || b.x > vx1 + 40 || b.y < vy0 - 20 || b.y > vy1 + 60) continue;
      list.push({ y: p.carriedBy ? p.carriedBy.y + 2 : p.kind === 'balloon' ? b.y + 400 : b.y + (p.mounted ? -6 : 0), k: K_PROP, o: p });
    }
    for (const c of G.chars) {
      if (c.hidden || c.x < vx0 - 40 || c.x > vx1 + 40 || c.y < vy0 - 20 || c.y > vy1 + 60) continue;
      let sy = c.y;
      if (c.z > 60) sy += 400; else if (c.z > 4) sy += 22;
      if (c.sortBias) sy += c.sortBias;
      list.push({ y: sy, k: K_CHAR, o: c });
    }
    for (const b of LC.W.barriers) list.push({ y: Math.max(b.y0, b.y1), k: K_BAR, o: b });
    list.sort((a, b) => a.y - b.y);
    const drawChar = opts.drawChar;
    for (const e of list) {
      switch (e.k) {
        case K_SEG: drawSeg(g, e.o, G); break;
        case K_FURN: drawFurn(g, e.o, G); break;
        case K_PROP: drawProp(g, e.o, G); break;
        case K_CHAR: drawChar(g, e.o, opts); break;
        case K_DOOR: drawDoor(g, e.o, G); break;
        case K_BAR: drawRopeLine(g, e.o.x0, e.o.y0, e.o.x1, e.o.y1); break;
      }
    }
    if (vy0 < M.truss.y1 + 100 && vy1 > M.truss.y0 - 200) drawOverhead(g, G, v);
    drawParticles(g, G);
    if (opts.overlayWorld) opts.overlayWorld(g);

    // lighting
    if (opts.lighting !== false) {
      const target = opts.lightTarget || { g: lg, cv: lightCv, scale: LS };
      if (target.cv.width !== Math.ceil(cw * target.scale) || target.cv.height !== Math.ceil(ch * target.scale)) { target.cv.width = Math.ceil(cw * target.scale); target.cv.height = Math.ceil(ch * target.scale); }
      renderLights(v, G, target);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.drawImage(target.cv, 0, 0, cw, ch);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = opts.cctv ? 0.1 : 0.2;
      g.drawImage(target.cv, 0, 0, cw, ch);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.setTransform(z, 0, 0, z, cw / 2 - v.x * z, ch / 2 - v.y * z);
      R.viewW = cw / z; R.viewH = ch / z;
      drawAdditive(g, G, v);
    }
    if (opts.overlayLit) opts.overlayLit(g);
  };

  // main frame
  R.draw = (G, hooks) => {
    const c = R.cam;
    const shake = c.shake > 0 ? c.shake : 0;
    c.vx = c.x + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
    c.vy = c.y + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
    const v = { x: c.vx, y: c.vy, zoom: c.zoom * dpr };
    R.renderView(ctx, v, G, Object.assign({ w: canvas.width, h: canvas.height }, hooks));
    drawBubbles(ctx, G);
    if (hooks && hooks.screen) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); hooks.screen(ctx); }
  };
  R.drawBubbles = drawBubbles;
  R.drawEmote = drawEmote;
  R.drawCharDefault = (g, c) => Pp.draw(g, c, c.x, c.y);
})();
