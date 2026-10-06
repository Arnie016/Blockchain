/* Last Call — 3D world: floors, walls, ceilings, doors, furniture, neon signage, the street and
   a city skyline. Static geometry is merged by material; a room index per vertex lets the
   renderer relight every room from one uniform array. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const R3 = LC.R3;
  if (!R3 || !R3.ok) return;
  const { U, Map: M } = LC;
  const T = M.T, PX = 1 / T, ZS = R3.ZS;
  const W3 = (R3.World = {});
  const C = R3.col;
  const WH = R3.WALL_H;
  let root, dyn = {};

  /* ================= textures ================= */
  function hash(a, b, c = 0) { return U.hash(a, b, c); }
  function floorCanvas(kind) {
    return R3.canvasTex(512, 512, (g) => {
      const S = 128;
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
        const x = tx * S, y = ty * S, h = hash(tx, ty, 3), h2 = hash(ty, tx, 7);
        switch (kind) {
          case 'wood': case 'deck': {
            const n = kind === 'deck' ? 5 : 4, pl = S / n;
            for (let i = 0; i < n; i++) {
              const v = 0.82 + hash(tx * 7 + i, ty) * 0.3;
              g.fillStyle = kind === 'deck' ? 'rgb(' + (120 * v | 0) + ',' + (92 * v | 0) + ',' + (72 * v | 0) + ')' : 'rgb(' + (126 * v | 0) + ',' + (80 * v | 0) + ',' + (48 * v | 0) + ')';
              g.fillRect(x, y + i * pl, S, pl);
              g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + i * pl, S, 2);
              const off = ((tx * 13 + i * 7 + ty * 3) % 4) * 32;
              g.fillRect(x + off, y + i * pl, 2, pl);
              g.strokeStyle = 'rgba(40,20,10,0.18)'; g.lineWidth = 1;
              for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y + i * pl + 6 + k * 9); g.bezierCurveTo(x + 40, y + i * pl + 3 + k * 9, x + 80, y + i * pl + 10 + k * 9, x + S, y + i * pl + 6 + k * 9); g.stroke(); }
            }
            break;
          }
          case 'dark': case 'stage': case 'led': {
            g.fillStyle = kind === 'stage' ? '#141219' : kind === 'led' ? '#0c0b11' : '#1b1822'; g.fillRect(x, y, S, S);
            g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, S - 2, S - 2);
            for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(200,170,255,' + (0.03 + hash(k, tx + ty) * 0.06).toFixed(3) + ')'; g.fillRect(x + hash(k, tx, ty) * S, y + hash(ty, k, tx) * S, 2, 2); }
            if (h < 0.3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + h2 * S, y + h * S * 3 % S, 18, 10, 0, 0, 7); g.fill(); }
            break;
          }
          case 'mat': g.fillStyle = '#26262b'; g.fillRect(x, y, S, S); g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(x + 8 + i * 16, y + 8 + j * 16, 4, 0, 7); g.fill(); } break;
          case 'tileM': case 'tileH': case 'tileW': {
            const a = kind === 'tileW' ? ['#efdfe6', '#e3cbd6'] : kind === 'tileH' ? ['#d2cdd9', '#bfb8c8'] : ['#dfe5e3', '#ccd6d3'];
            for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = a[(i + j) % 2]; g.fillRect(x + i * 64, y + j * 64, 64, 64); }
            g.strokeStyle = 'rgba(80,90,100,0.45)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 63, 63); g.strokeRect(x + 65, y + 1, 62, 63); g.strokeRect(x + 1, y + 65, 63, 62); g.strokeRect(x + 65, y + 65, 62, 62);
            if (h < 0.15) { g.fillStyle = 'rgba(160,150,90,0.18)'; g.beginPath(); g.arc(x + h2 * S, y + 64, 22, 0, 7); g.fill(); }
            break;
          }
          case 'carpetR': case 'carpetP': case 'carpetO': case 'velvet': {
            const base = { carpetR: '#5c1f2c', carpetP: '#382a5c', carpetO: '#465a4c', velvet: '#3c1842' }[kind];
            g.fillStyle = base; g.fillRect(x, y, S, S);
            g.fillStyle = kind === 'velvet' ? 'rgba(255,200,90,0.16)' : 'rgba(0,0,0,0.2)';
            g.beginPath(); g.moveTo(x + 64, y + 14); g.lineTo(x + 114, y + 64); g.lineTo(x + 64, y + 114); g.lineTo(x + 14, y + 64); g.closePath(); g.fill();
            g.fillStyle = kind === 'velvet' ? 'rgba(255,215,120,0.3)' : 'rgba(255,255,255,0.05)'; g.fillRect(x + 60, y + 60, 8, 8);
            for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x + hash(k, tx, 1) * S, y + hash(k, ty, 2) * S, 2, 2); }
            break;
          }
          case 'checker': for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#16161a' : '#e6e2da'; g.fillRect(x + i * 64, y + j * 64, 64, 64); } g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + h * 80, y + h2 * 80, 40, 3); break;
          case 'redcarpet': g.fillStyle = '#9c1234'; g.fillRect(x, y, S, S); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + hash(k, tx, 5) * S, y + hash(k, ty, 6) * S, 3, 3); } g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y + h * S, S, 2); break;
          case 'concrete': g.fillStyle = '#5c5c62'; g.fillRect(x, y, S, S); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; if (h < 0.3) { g.beginPath(); g.moveTo(x + h2 * S, y); g.lineTo(x + h * S, y + 80); g.lineTo(x + h2 * 80, y + S); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(x, y, S, S); break;
          case 'steel': g.fillStyle = '#9ca2a8'; g.fillRect(x, y, S, S); g.strokeStyle = 'rgba(60,64,70,0.5)'; g.lineWidth = 3; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const px = x + 8 + i * 16, py = y + 8 + j * 16; g.beginPath(); if ((i + j) % 2) { g.moveTo(px - 5, py - 2); g.lineTo(px + 5, py + 2); } else { g.moveTo(px - 5, py + 2); g.lineTo(px + 5, py - 2); } g.stroke(); } break;
          case 'asphalt': case 'parking': g.fillStyle = kind === 'parking' ? '#232429' : '#26282e'; g.fillRect(x, y, S, S); for (let k = 0; k < 120; k++) { g.fillStyle = 'rgba(255,255,255,' + (0.03 + hash(k, tx, ty) * 0.05).toFixed(3) + ')'; g.fillRect(x + hash(k, tx, 9) * S, y + hash(k, ty, 8) * S, 2, 2); } if (h < 0.08) { g.fillStyle = 'rgba(20,40,60,0.45)'; g.beginPath(); g.ellipse(x + 64, y + 64, 50, 26, 0.3, 0, 7); g.fill(); } break;
          case 'pavement': g.fillStyle = '#6d6a72'; g.fillRect(x, y, S, S); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; if (tx % 2 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + S); g.stroke(); } if (ty % 2 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + S, y); g.stroke(); } for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + hash(k, tx, 2) * S, y + hash(k, ty, 3) * S, 3, 3); } if (h < 0.2) { g.fillStyle = 'rgba(30,30,30,0.4)'; g.beginPath(); g.arc(x + h2 * S, y + 40, 6, 0, 7); g.fill(); } break;
          default: g.fillStyle = '#222'; g.fillRect(x, y, S, S);
        }
      }
    }, { repeat: true, aniso: 8 });
  }
  function wallCanvas(kind) {
    return R3.canvasTex(256, 256, (g) => {
      if (kind === 'brick') {
        g.fillStyle = '#3a2224'; g.fillRect(0, 0, 256, 256);
        for (let r = 0; r < 16; r++) for (let c = 0; c < 5; c++) {
          const off = r % 2 ? 26 : 0, v = 0.75 + hash(r, c, 4) * 0.4;
          g.fillStyle = 'rgb(' + (112 * v | 0) + ',' + (52 * v | 0) + ',' + (46 * v | 0) + ')';
          g.fillRect(c * 52 - off + 2, r * 16 + 2, 48, 13);
          if (c === 0 && off) g.fillRect(256 - off + 2, r * 16 + 2, 48, 13);
        }
        g.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < 40; k++) g.fillRect(hash(k, 1) * 256, hash(k, 2) * 256, 6, 3);
      } else if (kind === 'plaster') {
        g.fillStyle = '#3a3044'; g.fillRect(0, 0, 256, 256);
        const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.03)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, 3, 256); g.fillRect(128, 0, 2, 256);
        g.fillStyle = '#1c1622'; g.fillRect(0, 238, 256, 18);
        for (let k = 0; k < 90; k++) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(hash(k, 3) * 256, hash(k, 4) * 256, 2, 2); }
      } else if (kind === 'tile') {
        g.fillStyle = '#e6ecea'; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(90,100,110,0.45)'; g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); }
        g.fillStyle = 'rgba(40,120,140,0.5)'; g.fillRect(0, 150, 256, 10);
      } else if (kind === 'steel') {
        g.fillStyle = '#8f9ba5'; g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, hash(k, 5) * 256, 256, 1); }
        g.fillStyle = 'rgba(30,30,30,0.35)'; g.font = 'bold 20px sans-serif'; g.fillText('K+J', 40 + hash(1, 9) * 100, 120); g.fillText('4 GOOD TIME', 60, 190);
      } else if (kind === 'wood') {
        for (let i = 0; i < 8; i++) { const v = 0.8 + hash(i, 6) * 0.3; g.fillStyle = 'rgb(' + (118 * v | 0) + ',' + (84 * v | 0) + ',' + (54 * v | 0) + ')'; g.fillRect(i * 32, 0, 30, 256); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(i * 32 + 30, 0, 2, 256); }
      } else if (kind === 'black') {
        g.fillStyle = '#121016'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 16; i++) g.fillRect(0, i * 16, 256, 1);
      }
    }, { repeat: true });
  }
  // neon text sprite
  function neonCanvas(n) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = (s) => '400 ' + s + 'px "Tilt Neon", "Arial Rounded MT Bold", sans-serif';
    if (n.kind === 'logo') {
      c.width = 1024; c.height = 400;
      g.translate(512, 300);
      g.shadowColor = n.c; g.shadowBlur = 30;
      g.strokeStyle = '#ffe0ef'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
      g.font = font(130); g.textAlign = 'center'; g.fillStyle = '#ffe0ef';
      g.fillText('FLAMINGO', 70, -20);
      g.beginPath(); g.ellipse(-360, -90, 44, 28, -0.2, 0, 7);
      g.moveTo(-326, -110); g.quadraticCurveTo(-280, -178, -320, -206); g.quadraticCurveTo(-348, -234, -314, -256);
      g.moveTo(-314, -256); g.lineTo(-286, -240);
      g.moveTo(-366, -62); g.lineTo(-366, 12); g.moveTo(-350, -68); g.lineTo(-334, -30); g.lineTo(-354, -10);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = n.c; g.font = font(40); g.fillText('· NIGHTCLUB ·', 70, 60);
    } else {
      const size = 96;
      g.font = font(size);
      const w = Math.ceil(g.measureText(n.text).width) + 80;
      c.width = w; c.height = size + 70;
      g.font = font(size); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = n.c; g.shadowBlur = 26; g.fillStyle = n.c; g.fillText(n.text, w / 2, c.height / 2);
      g.shadowBlur = 8; g.fillStyle = '#fff'; g.globalAlpha = 0.9; g.fillText(n.text, w / 2, c.height / 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ================= materials ================= */
  const mats = {};
  function mat(key, make) { return mats[key] || (mats[key] = make()); }
  const wallTopU = { value: WH + 0.1 };
  W3.wallTop = wallTopU;
  function wallMat(key, texKind) {
    return mat('wall_' + key, () => {
      const m = R3.litMat({ vc: true, room: true, map: texKind ? wallCanvas(texKind) : null });
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh) => {
        prev(sh);
        sh.uniforms.uWallTop = wallTopU;
        sh.vertexShader = 'uniform float uWallTop;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y = min(transformed.y, uWallTop);');
      };
      m.customProgramCacheKey = () => 'wallcut' + key;
      return m;
    });
  }

  /* ================= builders ================= */
  const gbLit = () => new R3.GB();
  let S_LIT, S_EM;   // static lit + static emissive builders for furniture
  const rix = (x, y) => R3.roomIndexAt(x, y);
  const tmpV = new THREE.Vector3();
  function wpos(x, y, z) { return R3.toW(x, y, z || 0, tmpV); }

  // a quad (two triangles) with uv, given 4 corners (counter-clockwise when viewed from the normal side)
  function quad(gb, a, b, c, d, n, color, room, uv) {
    const P = gb.p, N = gb.n, Cc = gb.c, Rr = gb.r, Uu = gb.u;
    const tri = [a, b, c, a, c, d];
    const tuv = uv ? [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]] : null;
    for (let i = 0; i < 6; i++) {
      const v = tri[i];
      P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); Cc.push(color.r, color.g, color.b); Rr.push(room);
      if (gb.uv) { const t = tuv ? tuv[i] : [0, 0]; Uu.push(t[0], t[1]); }
    }
  }

  /* ---------------- floors ---------------- */
  function buildFloors() {
    const byKind = new Map();
    for (let ty = 0; ty < M.H; ty++) for (let tx = 0; tx < M.W; tx++) {
      const f = M.floor[M.ti(tx, ty)];
      if (!f) continue;
      let gb = byKind.get(f);
      if (!gb) { gb = new R3.GB({ uv: true }); byKind.set(f, gb); }
      const L = R3.lvAt(tx * T + 16, ty * T + 16);
      const x0 = tx + L.dx, z0 = ty + L.dz, y = L.dy;
      const room = M.roomIdx[M.ti(tx, ty)];
      const ri = room >= 0 ? room : R3.ROOM_OUT;
      const white = C('#ffffff');
      quad(gb, [x0, y, z0 + 1], [x0 + 1, y, z0 + 1], [x0 + 1, y, z0], [x0, y, z0], [0, 1, 0], white, ri,
        [[tx / 4, 1 - (ty + 1) / 4], [(tx + 1) / 4, 1 - (ty + 1) / 4], [(tx + 1) / 4, 1 - ty / 4], [tx / 4, 1 - ty / 4]]);
    }
    for (const [kind, gb] of byKind) {
      const m = R3.litMat({ vc: true, room: true, map: floorCanvas(kind) });
      const mesh = new THREE.Mesh(gb.build(), m);
      mesh.name = 'floor_' + kind;
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
    }
    // the world beyond the map: dark tarmac to the horizon
    const g = new THREE.PlaneGeometry(600, 600);
    g.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: C('#16161b') }));
    ground.position.set(48, -0.02, 33);
    root.add(ground);
  }

  /* ---------------- walls ---------------- */
  const WALLK = {
    ext: { h: WH, surf: 'brick' }, wall: { h: WH, surf: 'plaster' }, stall: { h: 2.0, bottom: 0.18, surf: 'steel' },
    low: { h: 1.1, surf: 'black' }, fence: { h: 1.9, surf: 'wood' },
  };
  function surfFor(kind, roomId) {
    if (kind === 'stall' || kind === 'fence' || kind === 'low') return WALLK[kind].surf;
    const r = roomId && M.room(roomId);
    if (r && (r.bath || r.id === 'bathhall' || r.id === 'kitchen')) return 'tile';
    if (kind === 'ext') return 'brick';
    if (r && (r.id === 'bar' || r.id === 'lounge' || r.id === 'backstage')) return 'brick';
    return 'plaster';
  }
  const SURF_COL = { brick: '#b0a0a0', plaster: '#c8bcd4', tile: '#f2f4f2', steel: '#c9d2d8', wood: '#d8c0a0', black: '#ffffff' };
  function buildWalls() {
    const groups = {};
    const gbFor = (surf) => groups[surf] || (groups[surf] = new R3.GB({ uv: true }));
    const addFace = (surf, a, b, c, d, n, room, len, hgt, u0) => {
      quad(gbFor(surf), a, b, c, d, n, C(SURF_COL[surf]), room, [[u0 / 2, 0], [(u0 + len) / 2, 0], [(u0 + len) / 2, hgt], [u0 / 2, hgt]]);
    };
    for (const s of M.segs) {
      if (s.kind === 'door' || s.kind === 'rope') continue;
      const K = WALLK[s.kind] || WALLK.wall;
      const t = (s.thick || 4) * PX;
      const y0 = K.bottom || 0, y1 = K.h;
      const horiz = s.ay === s.by;
      const L = R3.lvAt((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      const ax = Math.min(s.ax, s.bx) * PX + L.dx, bx = Math.max(s.ax, s.bx) * PX + L.dx;
      const az = Math.min(s.ay, s.by) * PX + L.dz, bz = Math.max(s.ay, s.by) * PX + L.dz;
      const yy0 = y0 + L.dy, yy1 = y1 + L.dy;
      // split long walls into ~1 m pieces so per-vertex lighting has something to work with
      const len = horiz ? bx - ax : bz - az;
      const n = Math.max(1, Math.ceil(len / 1.0));
      for (let i = 0; i < n; i++) {
        const k0 = i / n, k1 = (i + 1) / n;
        if (horiz) {
          const x0 = ax - (i === 0 ? t : 0) + (bx - ax) * k0, x1 = ax + (bx - ax) * k1 + (i === n - 1 ? t : 0);
          const zN = az - t, zS = az + t;
          const midx = (x0 + x1) / 2;
          const rN = rix((midx - L.dx) * T, (az - L.dz) * T - 16), rS = rix((midx - L.dx) * T, (az - L.dz) * T + 16);
          const roomN = M.roomAt((midx - L.dx) * T, (az - L.dz) * T - 16), roomS = M.roomAt((midx - L.dx) * T, (az - L.dz) * T + 16);
          const sN = surfFor(s.kind, roomN && roomN.id), sS = surfFor(s.kind, roomS && roomS.id);
          // vertical split for lighting
          for (let v = 0; v < 2; v++) {
            const h0 = yy0 + (yy1 - yy0) * v / 2, h1 = yy0 + (yy1 - yy0) * (v + 1) / 2;
            addFace(sS, [x0, h0, zS], [x1, h0, zS], [x1, h1, zS], [x0, h1, zS], [0, 0, 1], rS, x1 - x0, (h1 - h0), x0);
            addFace(sN, [x1, h0, zN], [x0, h0, zN], [x0, h1, zN], [x1, h1, zN], [0, 0, -1], rN, x1 - x0, (h1 - h0), -x1);
          }
          addFace(sS, [x0, yy1, zS], [x1, yy1, zS], [x1, yy1, zN], [x0, yy1, zN], [0, 1, 0], rS, x1 - x0, 0.1, x0);
          if (i === 0) addFace(sS, [x0, yy0, zN], [x0, yy0, zS], [x0, yy1, zS], [x0, yy1, zN], [-1, 0, 0], rS, t * 2, yy1 - yy0, 0);
          if (i === n - 1) addFace(sS, [x1, yy0, zS], [x1, yy0, zN], [x1, yy1, zN], [x1, yy1, zS], [1, 0, 0], rS, t * 2, yy1 - yy0, 0);
        } else {
          const z0 = az - (i === 0 ? t : 0) + (bz - az) * k0, z1 = az + (bz - az) * k1 + (i === n - 1 ? t : 0);
          const xW = ax - t, xE = ax + t;
          const midz = (z0 + z1) / 2;
          const rW = rix((ax - L.dx) * T - 16, (midz - L.dz) * T), rE = rix((ax - L.dx) * T + 16, (midz - L.dz) * T);
          const roomW = M.roomAt((ax - L.dx) * T - 16, (midz - L.dz) * T), roomE = M.roomAt((ax - L.dx) * T + 16, (midz - L.dz) * T);
          const sW = surfFor(s.kind, roomW && roomW.id), sE = surfFor(s.kind, roomE && roomE.id);
          for (let v = 0; v < 2; v++) {
            const h0 = yy0 + (yy1 - yy0) * v / 2, h1 = yy0 + (yy1 - yy0) * (v + 1) / 2;
            addFace(sE, [xE, h0, z1], [xE, h0, z0], [xE, h1, z0], [xE, h1, z1], [1, 0, 0], rE, z1 - z0, h1 - h0, -z1);
            addFace(sW, [xW, h0, z0], [xW, h0, z1], [xW, h1, z1], [xW, h1, z0], [-1, 0, 0], rW, z1 - z0, h1 - h0, z0);
          }
          addFace(sE, [xW, yy1, z1], [xE, yy1, z1], [xE, yy1, z0], [xW, yy1, z0], [0, 1, 0], rE, t * 2, 0.1, 0);
          if (i === 0) addFace(sE, [xE, yy0, z0], [xW, yy0, z0], [xW, yy1, z0], [xE, yy1, z0], [0, 0, -1], rE, t * 2, yy1 - yy0, 0);
          if (i === n - 1) addFace(sE, [xW, yy0, z1], [xE, yy0, z1], [xE, yy1, z1], [xW, yy1, z1], [0, 0, 1], rE, t * 2, yy1 - yy0, 0);
        }
      }
    }
    // headers above door openings in full-height walls
    for (const d of M.doors) {
      const wk = d.wallKind;
      if (wk !== 'ext' && wk !== 'wall') continue;
      const L = R3.lvAt(d.cx, d.cy);
      const t = (wk === 'ext' ? 7 : 5) * PX;
      const top = WH, bot = 2.45;
      const x0 = d.x0 * PX + L.dx, x1 = d.x1 * PX + L.dx, z0 = d.y0 * PX + L.dz, z1 = d.y1 * PX + L.dz;
      const r1 = rix(d.cx + (d.axis === 'h' ? 0 : 16), d.cy + (d.axis === 'h' ? 16 : 0)), r0 = rix(d.cx - (d.axis === 'h' ? 0 : 16), d.cy - (d.axis === 'h' ? 16 : 0));
      const surf = surfFor(wk, (M.roomAt(d.cx + (d.axis === 'h' ? 0 : 16), d.cy + (d.axis === 'h' ? 16 : 0)) || {}).id);
      if (d.axis === 'h') {
        addFace(surf, [x0, bot + L.dy, z0 + t], [x1, bot + L.dy, z0 + t], [x1, top + L.dy, z0 + t], [x0, top + L.dy, z0 + t], [0, 0, 1], r1, x1 - x0, top - bot, x0);
        addFace(surf, [x1, bot + L.dy, z0 - t], [x0, bot + L.dy, z0 - t], [x0, top + L.dy, z0 - t], [x1, top + L.dy, z0 - t], [0, 0, -1], r0, x1 - x0, top - bot, -x1);
        addFace(surf, [x0, bot + L.dy, z0 - t], [x1, bot + L.dy, z0 - t], [x1, bot + L.dy, z0 + t], [x0, bot + L.dy, z0 + t], [0, -1, 0], r1, x1 - x0, 0.1, 0);
      } else {
        addFace(surf, [x0 + t, bot + L.dy, z1], [x0 + t, bot + L.dy, z0], [x0 + t, top + L.dy, z0], [x0 + t, top + L.dy, z1], [1, 0, 0], r1, z1 - z0, top - bot, -z1);
        addFace(surf, [x0 - t, bot + L.dy, z0], [x0 - t, bot + L.dy, z1], [x0 - t, top + L.dy, z1], [x0 - t, top + L.dy, z0], [-1, 0, 0], r0, z1 - z0, top - bot, z0);
        addFace(surf, [x0 - t, bot + L.dy, z1], [x0 - t, bot + L.dy, z0], [x0 + t, bot + L.dy, z0], [x0 + t, bot + L.dy, z1], [0, -1, 0], r1, z1 - z0, 0.1, 0);
      }
    }
    for (const surf in groups) {
      const mesh = new THREE.Mesh(groups[surf].build(), wallMat(surf, surf));
      mesh.name = 'walls_' + surf;
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
    }
  }

  /* ---------------- ceilings ---------------- */
  function buildCeilings() {
    const gb = new R3.GB({ uv: true });
    for (const r of M.rooms) {
      if (r.outdoor) continue;
      for (const [x0, y0, x1, y1] of r.rects) {
        const L = R3.lvAt((x0 + 0.5) * T, (y0 + 0.5) * T);
        const y = WH + L.dy - 0.02;
        for (let z = y0; z < y1; z += 2) for (let x = x0; x < x1; x += 2) {
          const xa = x + L.dx, xb = Math.min(x + 2, x1) + L.dx, za = z + L.dz, zb = Math.min(z + 2, y1) + L.dz;
          quad(gb, [xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb], [0, -1, 0], C('#ffffff'), r.index, [[x / 2, z / 2], [(xb - L.dx) / 2, z / 2], [(xb - L.dx) / 2, (zb - L.dz) / 2], [x / 2, (zb - L.dz) / 2]]);
        }
      }
    }
    const tex = R3.canvasTex(256, 256, (g) => {
      g.fillStyle = '#0d0b12'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 252);
      g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) g.fillRect(0, 60 * i + 20, 256, 6);
    }, { repeat: true });
    const m = R3.litMat({ vc: true, room: true, map: tex });
    const mesh = new THREE.Mesh(gb.build(), m);
    mesh.name = 'ceilings';
    root.add(mesh);
    dyn.ceil = mesh;
  }

  /* ---------------- doors ---------------- */
  function buildDoors() {
    dyn.doors = [];
    const leafGeo = R3.prim('box');
    for (const d of M.doors) {
      const L = R3.lvAt(d.cx, d.cy);
      if (d.kind === 'arch') continue;
      if (d.kind === 'rope') {
        // velvet rope between two brass posts
        const g = new THREE.Group();
        const post = (x, z) => {
          const m = new THREE.Mesh(R3.prim('cyl'), R3.litMat({ color: C('#d9b04a') }));
          m.scale.set(0.07, 0.95, 0.07); m.position.set(x, 0.475, z); g.add(m);
          const k = new THREE.Mesh(R3.prim('sph'), m.material); k.scale.setScalar(0.12); k.position.set(x, 0.98, z); g.add(k);
          const b = new THREE.Mesh(R3.prim('cyl'), m.material); b.scale.set(0.3, 0.04, 0.3); b.position.set(x, 0.02, z); g.add(b);
        };
        const x0 = d.x0 * PX + L.dx, z0 = d.y0 * PX + L.dz, x1 = d.x1 * PX + L.dx, z1 = d.y1 * PX + L.dz;
        post(x0, z0 + 0.1); post(x1, z1 - 0.1);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, 0.86, z0 + 0.1), new THREE.Vector3((x0 + x1) / 2, 0.55, (z0 + z1) / 2), new THREE.Vector3(x1, 0.86, z1 - 0.1));
        const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.035, 6), R3.litMat({ color: C('#8a0f2a') }));
        g.add(rope);
        g.position.y = L.dy;
        root.add(g);
        dyn.doors.push({ d, rope, kind: 'rope' });
        continue;
      }
      const stall = d.kind === 'stall', gate = d.kind === 'gate';
      const hgt = stall ? 1.78 : gate ? 1.7 : 2.4, bottom = stall ? 0.2 : 0;
      const colr = d.kind === 'alarm' ? '#9a2a2a' : stall ? '#8595a2' : gate ? '#7a5a3a' : d.id === 'entrance' ? '#1a1a22' : '#3c3446';
      const leaves = d.kind === 'double' ? [[d.x0, d.y0, 1], [d.x1, d.y1, -1]] : [[d.x0, d.y0, 1]];
      const len = (d.kind === 'double' ? d.len / 2 : d.len) * PX;
      const parts = [];
      for (const [hx, hy, dir] of leaves) {
        const pivot = new THREE.Group();
        pivot.position.set(hx * PX + L.dx, bottom + L.dy, hy * PX + L.dz);
        const leaf = new THREE.Mesh(leafGeo, R3.litMat({ color: C(colr) }));
        leaf.scale.set(len - 0.04, hgt, 0.06);
        leaf.position.set((len) / 2, hgt / 2, 0);
        pivot.add(leaf);
        if (d.id === 'entrance') {
          const glass = new THREE.Mesh(leafGeo, R3.basicMat({ color: C('#ff3d9a').clone().multiplyScalar(0.25) }));
          glass.scale.set(len * 0.6, 1.2, 0.07); glass.position.set(len / 2, 1.4, 0); pivot.add(glass);
        }
        if (d.kind === 'alarm') {
          const bar = new THREE.Mesh(leafGeo, R3.litMat({ color: C('#e8e8e8') }));
          bar.scale.set(len * 0.7, 0.07, 0.1); bar.position.set(len / 2, 1.05, 0.08); pivot.add(bar);
          const sign = new THREE.Mesh(leafGeo, R3.basicMat({ color: C('#3dff8a').clone().multiplyScalar(1.4) }));
          sign.scale.set(0.5, 0.18, 0.07); sign.position.set(len / 2, 2.1, 0.06); pivot.add(sign);
        }
        if (!stall && !gate) {
          const handle = new THREE.Mesh(leafGeo, R3.litMat({ color: C('#b8b8c0') }));
          handle.scale.set(0.04, 0.25, 0.14); handle.position.set(len - 0.12, 1.05, 0); pivot.add(handle);
        }
        root.add(pivot);
        parts.push({ pivot, hx, hy, dir, len });
      }
      // posts on either side of the opening
      if (!stall) {
        const pm = R3.litMat({ color: C(gate ? '#5a3e26' : '#101016') });
        for (const [px, py] of [[d.x0, d.y0], [d.x1, d.y1]]) {
          const post = new THREE.Mesh(leafGeo, pm);
          post.scale.set(0.12, gate ? 1.9 : 2.45, 0.12);
          post.position.set(px * PX + L.dx, (gate ? 0.95 : 1.225) + L.dy, py * PX + L.dz);
          root.add(post);
        }
      }
      dyn.doors.push({ d, parts, kind: d.kind });
    }
  }
  function updateDoors(G) {
    for (const e of dyn.doors) {
      const d = e.d;
      if (e.kind === 'rope') { e.rope.visible = !(G.vipRopeOpen > 0.5); continue; }
      for (const pt of e.parts) {
        // same swing maths as the 2D renderer: angle of the leaf in the sim plane
        const ang = (d.axis === 'h' ? 0 : Math.PI / 2) + (pt.dir > 0 ? 0 : Math.PI) + d.open * (Math.PI / 2) * pt.dir * (d.axis === 'h' ? 1 : -1);
        pt.pivot.rotation.y = -ang;
      }
    }
  }

  /* ---------------- furniture ---------------- */
  const WHITE = () => C('#ffffff');
  function F3(f) { const L = R3.lvAt(f.cx, f.cy); return { x0: f.x0 * PX + L.dx, x1: f.x1 * PX + L.dx, z0: f.y0 * PX + L.dz, z1: f.y1 * PX + L.dz, cx: f.cx * PX + L.dx, cz: f.cy * PX + L.dz, y: L.dy, w: (f.x1 - f.x0) * PX, d: (f.y1 - f.y0) * PX, room: rix(f.cx, f.cy) }; }
  // shorthands onto the lit / emissive static builders
  function B(x0, y0, z0, x1, y1, z1, col, room, ry) { S_LIT.box(x0, y0, z0, x1, y1, z1, C(col), room, ry); }
  function E(x0, y0, z0, x1, y1, z1, col, k, room) { const c = C(col).clone().multiplyScalar(k || 1); S_EM.box(x0, y0, z0, x1, y1, z1, c, room); }
  function P(kind, x, y, z, sx, sy, sz, col, room, ry = 0, rx = 0, rz = 0, seg) { S_LIT.add(R3.prim(kind, seg), R3.mtx(x, y, z, sx, sy, sz, ry, rx, rz), C(col), room); }
  function PE(kind, x, y, z, sx, sy, sz, col, k, room, ry = 0, rx = 0, rz = 0) { const c = C(col).clone().multiplyScalar(k || 1); S_EM.add(R3.prim(kind), R3.mtx(x, y, z, sx, sy, sz, ry, rx, rz), c, room); }

  function furniture(f) {
    const b = F3(f), r = b.room, y = b.y;
    const { x0, x1, z0, z1, cx, cz, w, d } = b;
    switch (f.kind) {
      case 'hedge':
        for (let z = z0; z < z1; z += 0.8) { P('sph', cx + Math.sin(z) * 0.15, y + 0.75, z + 0.4, w * 1.1, 1.5, 1.2, (z | 0) % 2 ? '#1f3a22' : '#28482c', r); }
        break;
      case 'dumpster':
        B(x0, y, z0, x1, y + 1.2, z1, f.color, r);
        B(x0 - 0.03, y + 1.2, z0 - 0.03, x1 + 0.03, y + 1.3, z1 + 0.03, U.shade(f.color, -0.25), r);
        for (const [wx, wz] of [[x0 + 0.2, z1 - 0.1], [x1 - 0.2, z1 - 0.1]]) P('cyl', wx, y + 0.08, wz, 0.16, 0.08, 0.16, '#111', r, 0, 0, Math.PI / 2);
        break;
      case 'crate': B(x0, y, z0, x1, y + f.z * ZS, z1, '#8a6a42', r); B(x0 + 0.05, y + f.z * ZS - 0.02, z0 + 0.05, x1 - 0.05, y + f.z * ZS + 0.01, z1 - 0.05, '#6c5030', r); break;
      case 'boxes': B(x0, y, z0, x1, y + 0.7, z1, '#9a7a50', r); B(x0 + 0.2, y + 0.7, z0 + 0.15, x1 - 0.3, y + 1.25, z1 - 0.3, '#b08a5a', r); B(x0 + 0.5, y + 1.25, z0 + 0.3, x1 - 0.6, y + 1.6, z1 - 0.6, '#c09a68', r); break;
      case 'pallets': for (let i = 0; i < 4; i++) B(x0, y + i * 0.08, z0, x1, y + i * 0.08 + 0.06, z1, i % 2 ? '#8a6a42' : '#7a5a36', r); break;
      case 'kcounter': case 'kisland': B(x0, y, z0, x1, y + 0.86, z1, '#8c9298', r); B(x0 - 0.02, y + 0.86, z0 - 0.02, x1 + 0.02, y + 0.92, z1 + 0.02, '#c8cdd2', r); if (f.kind === 'kisland') { B(x0 + 0.4, y + 0.92, z0 + 0.3, x0 + 1.1, y + 0.95, z0 + 0.8, '#e8e2d0', r); P('cyl', x1 - 0.8, y + 1.0, cz, 0.35, 0.12, 0.35, '#c33', r); } break;
      case 'stove':
        B(x0, y, z0, x1, y + 0.9, z1, '#2a2c30', r);
        for (let i = 0; i < 4; i++) { PE('torus', x0 + 0.4 + i * 0.7, y + 0.91, cz, 0.36, 0.36, 0.36, '#d0402a', 1.6, r, 0, Math.PI / 2); }
        break;
      case 'fridge': B(x0, y, z0, x1, y + 1.95, z1, '#d8dde2', r); B(cx - 0.02, y + 0.3, z1, cx + 0.02, y + 1.7, z1 + 0.04, '#888', r); break;
      case 'kshelf': case 'supply': {
        const h = f.kind === 'supply' ? 1.8 : 1.9;
        B(x0, y, z0, x1, y + 0.05, z1, '#44444c', r);
        for (let s2 = 1; s2 <= 4; s2++) B(x0, y + s2 * h / 4 - 0.03, z0, x1, y + s2 * h / 4, z1, '#5a5a62', r);
        for (const px of [x0, x1 - 0.04]) for (const pz of [z0, z1 - 0.04]) B(px, y, pz, px + 0.04, y + h, pz + 0.04, '#44444c', r);
        const cols = f.kind === 'supply' ? ['#ffd21f', '#3a8ad8', '#e44', '#fff', '#3c3'] : ['#c84', '#e8e0c0', '#4a8', '#d63'];
        const long = w > d;
        for (let s2 = 0; s2 < 4; s2++) for (let k = 0; k < 6; k++) {
          const t2 = (k + 0.5) / 6;
          const px = long ? x0 + t2 * w : cx, pz = long ? cz : z0 + t2 * d;
          B(px - 0.08, y + s2 * h / 4 + 0.01, pz - 0.08, px + 0.08, y + s2 * h / 4 + 0.28, pz + 0.08, cols[(s2 * 6 + k) % cols.length], r);
        }
        break;
      }
      case 'fryer': B(x0, y, z0, x1, y + 0.9, z1, '#50545a', r); E(x0 + 0.1, y + 0.9, z0 + 0.1, x1 - 0.1, y + 0.91, z1 - 0.1, '#c89a2a', 0.6, r); break;
      case 'toilet': {
        const back = f.flip ? z1 - 0.12 : z0 + 0.12;
        B(cx - 0.2, y, back - 0.12, cx + 0.2, y + 0.75, back + 0.12, '#e8eef0', r);
        const bz = f.flip ? z0 + 0.3 : z1 - 0.3;
        P('cyl', cx, y + 0.21, bz, 0.4, 0.42, 0.5, '#e8eef0', r);
        P('cyl', cx, y + 0.43, bz, 0.42, 0.03, 0.52, '#dce4e8', r);
        break;
      }
      case 'urinal': B(cx - 0.22, y + 0.35, z0, cx + 0.22, y + 1.15, z0 + 0.3, '#eef3f4', r); B(cx - 0.16, y + 0.45, z0 + 0.26, cx + 0.16, y + 0.95, z0 + 0.31, '#bcd', r); break;
      case 'sink':
        B(x0, y, z0, x1, y + 0.82, z1, '#c6ced2', r);
        B(x0 - 0.02, y + 0.82, z0 - 0.02, x1 + 0.02, y + 0.86, z1 + 0.02, '#e8eef0', r);
        P('cyl', cx - 0.05, y + 0.87, cz, 0.42, 0.02, 0.5, '#a8b8c2', r);
        B(x1 - 0.12, y + 0.86, cz - 0.03, x1 - 0.04, y + 1.08, cz + 0.03, '#bbb', r);
        // mirror on the wall behind
        E(x1 + 0.02, y + 1.2, z0 + 0.05, x1 + 0.05, y + 2.0, z1 - 0.05, '#9fb8c8', 0.35, r);
        break;
      case 'vanity': B(x0, y, z0, x1, y + 0.82, z1, '#c8a8b4', r); B(x0, y + 0.82, z0, x1, y + 0.86, z1, '#e0c8d0', r); E(x0 + 0.1, y + 1.2, z0 - 0.05, x1 - 0.1, y + 2.1, z0 - 0.02, '#c8e0ff', 0.45, r); for (let i = 0; i < 6; i++) PE('sph', x0 + 0.2 + i * (w - 0.4) / 5, y + 2.2, z0 - 0.04, 0.09, 0.09, 0.09, '#fff2d0', 3, r); break;
      case 'vending': B(x0, y, z0, x1, y + 1.9, z1, '#1c2842', r); E(x0 + 0.1, y + 0.4, z1 + 0.01, x1 - 0.35, y + 1.75, z1 + 0.02, '#78c8ff', 1.2, r); break;
      case 'backbar': {
        B(x0, y, z0, x1, y + 1.0, z1, '#1a120c', r);
        E(x0, y + 1.0, z1 - 0.12, x1, y + 1.03, z1 - 0.1, '#ff9a3a', 2.2, r);
        for (let s2 = 0; s2 < 3; s2++) {
          const sy = y + 1.25 + s2 * 0.42;
          B(x0, sy - 0.03, z0, x1, sy, z1, '#2a1c14', r);
          E(x0, sy, z0 + 0.02, x1, sy + 0.015, z0 + 0.05, '#ffb060', 1.6, r);
          for (let bx = x0 + 0.2; bx < x1 - 0.2; bx += 0.22) {
            const hs = hash(bx * 10 | 0, s2);
            const bc = ['#2f7a3a', '#c8a040', '#8a2030', '#e0e8f0', '#3a5ab0', '#d86a20'][(hs * 6) | 0];
            P('cyl', bx, sy + 0.16, z0 + 0.3, 0.09, 0.3, 0.09, bc, r, 0, 0, 0, 8);
            P('cyl', bx, sy + 0.36, z0 + 0.3, 0.035, 0.12, 0.035, bc, r, 0, 0, 0, 6);
          }
        }
        E(x0 + 0.1, y + 2.6, z0 + 0.02, x1 - 0.1, y + 2.62, z0 + 0.04, '#ff9a3a', 1.2, r);
        break;
      }
      case 'counter': case 'counterEnd':
        B(x0, y, z0 + 0.05, x1, y + 0.98, z1 - 0.05, '#3a2416', r);
        B(x0 - 0.05, y + 0.98, z0 - 0.08, x1 + 0.05, y + 1.05, z1 + 0.08, '#141216', r);
        B(x0, y + 0.02, z1 - 0.06, x1, y + 0.14, z1 - 0.02, '#1a1410', r);
        // brass foot rail
        P('cyl', cx, y + 0.22, z1 + 0.12, 0.05, w, 0.05, '#c8a040', r, 0, 0, Math.PI / 2, 8);
        break;
      case 'pillar':
        B(x0, y, z0, x1, y + WH, z1, '#2a2332', r);
        E(cx - 0.03, y + 0.2, z1 + 0.005, cx + 0.03, y + WH - 0.3, z1 + 0.015, '#ff3caa', 2, r);
        E(cx - 0.03, y + 0.2, z0 - 0.015, cx + 0.03, y + WH - 0.3, z0 - 0.005, '#ff3caa', 2, r);
        break;
      case 'booth': {
        // seat along the back wall, high buttoned back
        B(x0, y, z0 + 0.1, x1, y + 0.34, z1, '#6a1826', r);
        B(x0, y + 0.34, z1 - 0.35, x1, y + 1.25, z1, '#7a1a2a', r);
        for (let k = 1; k < 3; k++) B(x0 + k * w / 3 - 0.02, y + 0.4, z1 - 0.37, x0 + k * w / 3 + 0.02, y + 1.2, z1 - 0.34, '#4a0c16', r);
        break;
      }
      case 'ltable': case 'vtable': {
        const h = f.kind === 'vtable' ? 0.4 : 0.5;
        P('cyl', cx, y + h / 2, cz, 0.12, h, 0.12, '#222', r);
        if (f.kind === 'vtable') {
          B(x0, y + h - 0.03, z0, x1, y + h, z1, '#b8d8ec', r);
          P('cyl', cx - w * 0.2, y + h + 0.12, cz, 0.2, 0.24, 0.2, '#c0c8d0', r);
          P('cyl', cx - w * 0.2, y + h + 0.3, cz, 0.08, 0.36, 0.08, '#1f4a2a', r);
          PE('cyl', cx - w * 0.2, y + h + 0.5, cz, 0.05, 0.05, 0.05, '#ffd04a', 1.5, r);
        } else {
          P('cyl', cx, y + h, cz, Math.min(w, 1.4), 0.05, Math.min(d, 0.9), '#2e2228', r, 0, 0, 0, 20);
          PE('cyl', cx, y + h + 0.06, cz, 0.06, 0.08, 0.06, '#ffd08a', 3, r);
        }
        break;
      }
      case 'djdesk':
        B(x0, y, z0, x1, y + 0.88, z1, '#0c0a10', r);
        B(x0 - 0.02, y + 0.88, z0 - 0.02, x1 + 0.02, y + 0.92, z1 + 0.02, '#16141c', r);
        E(x0, y + 0.3, z1 + 0.005, x1, y + 0.34, z1 + 0.015, '#ff2e88', 2.2, r);
        B(cx - 0.6, y + 0.92, z0 + 0.25, cx + 0.6, y + 0.97, z1 - 0.25, '#26242c', r);
        E(cx - 0.3, y + 1.0, z0 + 0.3, cx + 0.3, y + 1.28, z0 + 0.34, '#aad2ff', 1.2, r);
        break;
      case 'stack':
        B(x0, y, z0, x1, y + 2.2, z1, '#0e0e12', r);
        for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) {
          const px = x0 + (k + 0.5) * w / 2, py = y + 0.4 + i * 0.7;
          P('cyl', px, py, z1 + 0.02, 0.5, 0.05, 0.5, '#26262c', r, 0, Math.PI / 2);
          P('cyl', px, py, z1 + 0.05, 0.18, 0.05, 0.18, '#101014', r, 0, Math.PI / 2);
        }
        break;
      case 'fspeaker': {
        B(x0, y, z0, x1, y + 0.96, z1, '#101014', r);
        const toward = f.cy < 20 * T ? 1 : -1;
        const fz = toward > 0 ? z1 : z0;
        P('cyl', cx, y + 0.45, fz + toward * 0.02, 0.55, 0.05, 0.55, '#2a2a32', r, 0, Math.PI / 2);
        P('cyl', cx, y + 0.45, fz + toward * 0.05, 0.2, 0.05, 0.2, '#0c0c10', r, 0, Math.PI / 2);
        break;
      }
      case 'truss': {
        const h = f.z * ZS;
        for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) P('cyl', px, y + h / 2, pz, 0.05, h, 0.05, '#8a8e96', r, 0, 0, 0, 6);
        for (let hh = 0.3; hh < h; hh += 0.45) { B(x0, y + hh, z0, x1, y + hh + 0.03, z0 + 0.03, '#6a6e76', r); B(x0, y + hh + 0.2, z1 - 0.03, x1, y + hh + 0.23, z1, '#6a6e76', r); }
        break;
      }
      case 'lockers': B(x0, y, z0, x1, y + 1.76, z1, '#3a4a5a', r); for (let k = 1; k < 6; k++) B(x0 + k * w / 6 - 0.01, y + 0.05, z1, x0 + k * w / 6 + 0.01, y + 1.7, z1 + 0.01, '#243240', r); break;
      case 'coffee': B(x0, y, z0, x1, y + 0.88, z1, '#1c1c20', r); B(cx - 0.2, y + 0.88, cz - 0.2, cx + 0.2, y + 1.3, cz + 0.2, '#2a2a2e', r); PE('sph', cx + 0.15, y + 1.2, cz + 0.21, 0.04, 0.04, 0.04, '#ff3a3a', 3, r); break;
      case 'couch': case 'vcouch': case 'ccouch': {
        const col = f.kind === 'vcouch' ? '#ece8e0' : f.kind === 'ccouch' ? '#5a3a8a' : f.color || '#4a4550';
        const seat = 0.34, back = 0.9;
        B(x0, y, z0, x1, y + seat, z1, U.shade(col, -0.1), r);
        if (f.vertical) {
          const bx = f.flip ? x0 : x1 - 0.28;
          B(bx, y + seat, z0, bx + 0.28, y + back, z1, U.shade(col, -0.2), r);
        } else {
          const bz = f.flip ? z1 - 0.28 : z0;
          B(x0, y + seat, bz, x1, y + back, bz + 0.28, U.shade(col, -0.2), r);
        }
        if (f.kind === 'vcouch') E(x0, y + 0.05, (f.vertical ? z0 : f.flip ? z0 : z1) - 0.005, x1, y + 0.08, (f.vertical ? z1 : f.flip ? z0 : z1) + 0.005, '#e8c060', 1.6, r);
        break;
      }
      case 'cctvdesk':
        B(x0, y, z0, x1, y + 0.75, z1, '#2a2a30', r);
        for (let i = 0; i < 3; i++) { const mx = x0 + 0.3 + i * (w - 0.6) / 2; B(mx - 0.4, y + 0.78, z0 + 0.1, mx + 0.4, y + 1.35, z0 + 0.16, '#111', r); dyn.screens.push({ x: mx, y: y + 1.06, z: z0 + 0.17, w: 0.7, h: 0.48, room: r, col: i === 1 ? '#6a8a70' : '#5a7090' }); }
        break;
      case 'breaker': B(x0, y + 0.8, z0, x1, y + 2.0, z1, '#50545a', r); dyn.lamps.push({ x: x0 - 0.02, y: y + 1.8, z: cz, kind: 'breaker', room: r }); break;
      case 'alarmpanel': B(x0, y + 0.9, z0, x1, y + 1.9, z1, '#6a1010', r); dyn.lamps.push({ x: x0 - 0.02, y: y + 1.7, z: cz, kind: 'alarm', room: r }); break;
      case 'mdesk': B(x0, y, z0, x1, y + 0.76, z1, '#4a2e1a', r); B(x0 + 0.4, y + 0.76, z0 + 0.2, x0 + 1.0, y + 0.78, z0 + 0.6, '#eee', r); PE('sph', x1 - 0.5, y + 1.05, z0 + 0.3, 0.2, 0.14, 0.2, '#ffd890', 2.2, r); P('cyl', x1 - 0.5, y + 0.88, z0 + 0.3, 0.03, 0.25, 0.03, '#333', r); break;
      case 'safe': B(x0, y, z0, x1, y + 0.8, z1, '#2a2a30', r); P('cyl', cx, y + 0.45, z1 + 0.02, 0.18, 0.04, 0.18, '#999', r, 0, Math.PI / 2); break;
      case 'filing': B(x0, y, z0, x1, y + 1.3, z1, '#5a5e64', r); for (let i = 0; i < 3; i++) B(x0 - 0.01, y + 0.3 + i * 0.4, cz - 0.15, x0, y + 0.33 + i * 0.4, cz + 0.15, '#222', r); break;
      case 'bench': B(x0, y + 0.4, z0, x1, y + 0.46, z1, '#8a6440', r); for (const px of [x0 + 0.1, x1 - 0.14]) for (const pz of [z0 + 0.05, z1 - 0.09]) B(px, y, pz, px + 0.04, y + 0.4, pz + 0.04, '#3a2a1a', r); break;
      case 'ashtray': P('cyl', cx, y + 0.45, cz, 0.06, 0.9, 0.06, '#6a6e74', r); P('cyl', cx, y + 0.92, cz, 0.35, 0.06, 0.35, '#8a8e94', r); break;
      case 'heater':
        P('cyl', cx, y + 1.2, cz, 0.08, 2.4, 0.08, '#5a5e64', r);
        P('cyl', cx, y + 0.05, cz, 0.5, 0.1, 0.5, '#4a4e54', r);
        P('cone', cx, y + 2.5, cz, 0.9, 0.3, 0.9, '#7a7e84', r, 0, Math.PI);
        dyn.heaters.push({ x: cx, y: y + 2.1, z: cz, room: r });
        break;
      case 'planter': B(x0, y, z0, x1, y + 0.5, z1, '#4e3620', r); for (let i = 0; i < 5; i++) P('sph', x0 + 0.3 + i * (w - 0.6) / 4, y + 0.75, cz, 0.6, 0.6, 0.5, i % 2 ? '#2e6a36' : '#3a7a42', r); break;
      case 'coatcounter': B(x0, y, z0, x1, y + 1.0, z1, '#4a2e1a', r); B(x0 - 0.04, y + 1.0, z0 - 0.02, x1 + 0.04, y + 1.05, z1 + 0.02, '#6a4428', r); PE('sph', cx, y + 1.08, z0 + 0.6, 0.06, 0.06, 0.06, '#d8b04a', 1, r); break;
      case 'coatrack':
        B(x0 + 0.05, y + 1.7, z0, x1 - 0.05, y + 1.73, z1, '#888', r);
        for (let z = z0 + 0.15; z < z1; z += 0.28) B(x0 + 0.08, y + 0.75 + hash(z * 10 | 0, 1) * 0.2, z - 0.1, x1 - 0.08, y + 1.68, z + 0.1, ['#3a4a6a', '#8a2a3a', '#1a1a1e', '#6a6a2a', '#e0d8c8', '#2a5a4a', '#7a4a8a'][((z * 4) | 0) % 7], r);
        break;
      case 'atm': B(x0, y, z0, x1, y + 1.45, z1, '#34383e', r); E(x0 + 0.15, y + 1.05, z0 - 0.01, x1 - 0.15, y + 1.3, z0, '#6ab8ff', 1.1, r); break;
      case 'lava': P('cyl', cx, y + 0.1, cz, 0.22, 0.2, 0.22, '#2a2230', r); PE('sph', cx, y + 0.45, cz, 0.18, 0.5, 0.18, f.cx < 66 * T ? '#b85aff' : '#ff5ab0', 2.2, r); break;
      case 'podium': B(x0, y, z0, x1, y + 1.05, z1, '#3a2418', r); B(x0 - 0.03, y + 1.05, z0 - 0.03, x1 + 0.03, y + 1.1, z1 + 0.03, '#4a3020', r); PE('sph', x1 - 0.12, y + 1.25, z0 + 0.12, 0.08, 0.08, 0.08, '#ffe0a0', 3, r); break;
      case 'lamp':
        P('cyl', cx, y + 2.6, cz, 0.12, 5.2, 0.12, '#3a3c42', r, 0, 0, 0, 8);
        B(cx, y + 5.1, cz - 0.05, cx + 1.2, y + 5.2, cz + 0.05, '#3a3c42', r);
        PE('box', cx + 1.1, y + 5.06, cz, 0.5, 0.08, 0.3, '#ffcf8a', 3, r);
        dyn.glows.push({ x: cx + 1.1, y: y + 4.95, z: cz, s: 2.4, c: '#ffae55', k: 0.9 });
        break;
      case 'bin': P('cyl', cx, y + 0.45, cz, 0.55, 0.9, 0.55, '#1e2c1e', r); break;
      case 'bikerack': for (let x = x0 + 0.2; x < x1; x += 0.5) P('torus', x, y + 0.3, cz, 0.7, 0.9, 0.7, '#7a7e86', r, Math.PI / 2); break;
      case 'car': {
        const dirZ = f.flip ? -1 : 1;
        B(x0 + 0.05, y + 0.25, z0 + 0.1, x1 - 0.05, y + 0.8, z1 - 0.1, f.color, r);
        B(x0 + 0.18, y + 0.8, cz - d * 0.22, x1 - 0.18, y + 1.3, cz + d * 0.18, U.shade(f.color, -0.1), r);
        B(x0 + 0.2, y + 0.82, cz - d * 0.23 * dirZ - 0.01, x1 - 0.2, y + 1.26, cz - d * 0.23 * dirZ + 0.01, '#1e2837', r);
        for (const wx of [x0 + 0.08, x1 - 0.08]) for (const wz of [z0 + 0.8, z1 - 0.8]) P('cyl', wx, y + 0.32, wz, 0.62, 0.22, 0.62, '#111', r, 0, 0, Math.PI / 2);
        const front = dirZ > 0 ? z0 + 0.1 : z1 - 0.1, backz = dirZ > 0 ? z1 - 0.1 : z0 + 0.1;
        for (const lx of [x0 + 0.3, x1 - 0.3]) { PE('box', lx, y + 0.62, front - dirZ * 0.01, 0.35, 0.1, 0.04, '#fff6d0', 0.8, r); PE('box', lx, y + 0.62, backz + dirZ * 0.01, 0.35, 0.1, 0.04, '#ff3030', 1.2, r); }
        break;
      }
      case 'kebab':
        B(x0, y + 0.35, z0, x1, y + 2.4, z1, '#e8e4dc', r);
        B(x0 + 0.1, y + 2.4, z0 + 0.1, x1 - 0.1, y + 2.5, z1 - 0.1, '#c8c2b8', r);
        for (let i = 0; i < 8; i++) B(x0 + 0.3 + i * (w - 0.6) / 8, y + 1.95, z0 - 0.5, x0 + 0.3 + (i + 0.5) * (w - 0.6) / 8, y + 2.05, z0, '#d23a2a', r);
        dyn.kebabWin = { x0: x0 + 0.9, x1: x1 - 0.9, y0: y + 1.1, y1: y + 1.8, z: z0 - 0.02, room: r };
        for (const wx of [x0 + 0.8, x1 - 0.8]) for (const wz of [z0 + 0.1, z1 - 0.1]) P('cyl', wx, y + 0.35, wz, 0.7, 0.25, 0.7, '#111', r, 0, Math.PI / 2);
        break;
      case 'flamingo': break;   // built separately so it can fall over
      default: B(x0, y, z0, x1, y + (f.z || 16) * ZS, z1, '#555', r);
    }
  }

  // the flamingo statue: its own mesh
  function buildFlamingo() {
    const f = M.flamingo, b = F3(f);
    const parts = [];
    const add = (kind, x, y, z, sx, sy, sz, col, ry = 0, rx = 0, rz = 0) => parts.push([R3.prim(kind), R3.mtx(x, y, z, sx, sy, sz, ry, rx, rz).clone(), C(col)]);
    add('cyl', 0, 0.06, 0, 1.3, 0.12, 0.9, '#20202a');
    add('cyl', -0.1, 0.62, 0, 0.05, 1.05, 0.05, '#e0508a');
    add('cyl', 0.12, 0.5, 0.05, 0.05, 0.6, 0.05, '#e0508a', 0, 0, -0.5);
    add('sph', 0, 1.25, 0, 1.0, 0.55, 0.62, '#ff6fa8', 0, 0, -0.15);
    add('sph', -0.3, 1.32, 0, 0.5, 0.3, 0.4, '#ff8fbf', 0, 0, -0.3);
    for (let i = 0; i < 7; i++) { const k = i / 6; add('sph', 0.35 + Math.sin(k * 2.8) * 0.18, 1.45 + k * 0.75, 0, 0.16, 0.2, 0.16, '#ff6fa8'); }
    add('sph', 0.42, 2.25, 0, 0.26, 0.24, 0.22, '#ff6fa8');
    add('cone', 0.62, 2.2, 0, 0.1, 0.24, 0.1, '#1a1a1a', 0, 0, -1.9);
    add('sph', 0.5, 2.3, 0.08, 0.05, 0.05, 0.05, '#111');
    add('sph', 0.5, 2.3, -0.08, 0.05, 0.05, 0.05, '#111');
    const geo = R3.merge(parts);
    const m = new THREE.Mesh(geo, R3.litMat({ vc: true }));
    const grp = new THREE.Group();
    grp.add(m);
    grp.position.set(b.cx, b.y, b.cz);
    grp.rotation.y = Math.PI / 2;
    root.add(grp);
    dyn.flamingo = grp;
  }

  /* ---------------- neon ---------------- */
  // which way each sign faces: S = +z, N = -z, W = -x, E = +x
  const FACE = { FLAMINGO: 'S', BAR: 'S', VIP: 'S', SMOKING: 'S', 'NO SMOKING': 'N', CHILL: 'N', KEBAB: 'N', MEN: 'S', WOMEN: 'N', COATS: 'S', 'STAFF ONLY': 'W' };
  function buildNeon() {
    dyn.neon = [];
    for (const n of M.neon) {
      const L = R3.lvAt(n.kind === 'strip' ? (n.x0 + n.x1) / 2 : n.x, n.y);
      if (n.kind === 'strip') {
        const x0 = n.x0 * PX + L.dx, x1 = n.x1 * PX + L.dx, z = n.y * PX + L.dz;
        const y = n.under ? 0.12 : 0.03;
        const m = new THREE.Mesh(R3.prim('box'), R3.basicMat({ color: C(n.c).clone().multiplyScalar(2.6) }));
        m.scale.set(x1 - x0, 0.04, 0.05); m.position.set((x0 + x1) / 2, y + L.dy, z + (n.under ? 0.36 : -0.08));
        root.add(m);
        dyn.neon.push({ n, mesh: m, base: C(n.c).clone().multiplyScalar(2.6), strip: true });
        continue;
      }
      let face = n.kind === 'logo' ? 'S' : n.text === 'EXIT' ? (n.y > 30 * T ? 'N' : 'S') : FACE[n.text] || 'S';
      const tex = neonCanvas(n);
      const aspect = tex.image.width / tex.image.height;
      const h = n.kind === 'logo' ? 1.5 : n.text === 'EXIT' ? 0.28 : 0.2 + (n.size || 12) * 0.028;
      const m = new THREE.Mesh(R3.prim('plane'), R3.basicMat({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: C('#ffffff').clone().multiplyScalar(n.kind === 'logo' ? 2.2 : 2.6), side: THREE.DoubleSide }));
      m.scale.set(h * aspect, h, 1);
      const off = 0.25;
      let x = n.x * PX + L.dx, z = n.y * PX + L.dz, y = (n.kind === 'logo' ? 3.85 : n.text === 'EXIT' ? 2.75 : n.kind === 'text' && !n.wall ? 2.3 : 2.9) + L.dy;
      if (n.kebab) y = 2.75 + L.dy;
      if (face === 'S') { z += off; m.rotation.y = 0; }
      else if (face === 'N') { z -= off; m.rotation.y = Math.PI; }
      else if (face === 'W') { x -= off; m.rotation.y = -Math.PI / 2; }
      else { x += off; m.rotation.y = Math.PI / 2; }
      m.position.set(x, y, z);
      m.renderOrder = 5;
      root.add(m);
      dyn.neon.push({ n, mesh: m, base: m.material.color.clone() });
    }
  }
  W3.fontsReady = () => {
    for (const e of dyn.neon || []) {
      if (e.strip) continue;
      const old = e.mesh.material.map;
      e.mesh.material.map = neonCanvas(e.n);
      e.mesh.material.needsUpdate = true;
      if (old) old.dispose();
    }
  };

  /* ---------------- sky + city ---------------- */
  function buildSky() {
    const g = new THREE.SphereGeometry(200, 24, 12);
    const cols = [];
    const pos = g.attributes.position;
    const top = C('#05060f'), mid = C('#15102a'), hor = C('#3a1f3a');
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i) / 200;
      const c = yy > 0.35 ? top.clone().lerp(mid, U.clamp((0.7 - yy) / 0.35, 0, 1)) : mid.clone().lerp(hor, U.clamp((0.35 - yy) / 0.35, 0, 1));
      cols.push(c.r * 0.9, c.g * 0.9, c.b * 0.9);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    sky.position.set(48, 0, 33);
    sky.renderOrder = -10;
    root.add(sky);
    // stars
    const sp = [];
    for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2; sp.push(48 + Math.cos(a) * Math.cos(e) * 190, Math.sin(e) * 190, 33 + Math.sin(a) * Math.cos(e) * 190); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: C('#c8c8ff'), size: 0.7, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 })));
    // skyline: blocks around the site with lit windows
    const winTex = R3.canvasTex(256, 256, (gg) => {
      gg.fillStyle = '#0a0a12'; gg.fillRect(0, 0, 256, 256);
      for (let r2 = 0; r2 < 16; r2++) for (let c2 = 0; c2 < 8; c2++) {
        const lit = hash(r2, c2, 11) < 0.32;
        gg.fillStyle = lit ? ['#ffd99a', '#fff0c8', '#9fd0ff', '#ffb070'][(hash(c2, r2, 3) * 4) | 0] : '#15151f';
        gg.fillRect(c2 * 32 + 8, r2 * 16 + 4, 16, 8);
      }
    }, { repeat: true });
    const gb = new R3.GB({ uv: true });
    const bld = (x0, z0, x1, z1, h) => {
      const w = x1 - x0, d = z1 - z0;
      const faces = [
        [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], w],
        [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], w],
        [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], d],
        [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], d],
      ];
      const ox = hash(x0 | 0, z0 | 0) * 4;
      for (const [a, b2, c2, dd, n, len] of faces) quad(gb, a, b2, c2, dd, n, C('#ffffff'), R3.ROOM_OUT, [[ox, 0], [ox + len / 8, 0], [ox + len / 8, h / 16], [ox, h / 16]]);
    };
    const rnd = (a, b2, s) => a + hash(s, 91) * (b2 - a);
    let s = 1;
    for (let x = -30; x < 126; x += rnd(8, 16, s++)) { bld(x, -26, x + rnd(6, 12, s++), -8, rnd(10, 38, s++)); bld(x, 76, x + rnd(6, 12, s++), 96, rnd(10, 32, s++)); }
    for (let z = -8; z < 76; z += rnd(8, 14, s++)) { bld(-30, z, -12, z + rnd(6, 11, s++), rnd(12, 34, s++)); bld(108, z, 128, z + rnd(6, 11, s++), rnd(10, 40, s++)); }
    const city = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }));
    root.add(city);
    // the road south of the parking lot
    const road = new THREE.Mesh(new THREE.PlaneGeometry(220, 9), new THREE.MeshLambertMaterial({ color: C('#1c1c22') }));
    road.rotation.x = -Math.PI / 2; road.position.set(48, -0.01, 71);
    root.add(road);
  }

  /* ---------------- street details ---------------- */
  function buildStreet() {
    const g = S_LIT, e = S_EM;
    const out = R3.roomIndexAt(46 * T, 50 * T);
    // curb along the front
    g.box(0, 0, 53.72, 96, 0.14, 54.0, C('#8a8690'), out);
    e.box(40, 0.141, 53.72, 54, 0.145, 53.84, C('#ffd23f').clone().multiplyScalar(0.5), out);
    // parking bay lines
    for (const c of M.cars) {
      const x0 = c.x0 * PX, x1 = c.x1 * PX, z0 = c.y0 * PX, z1 = c.y1 * PX;
      e.box(x0 - 0.22, 0.005, z0 - 0.12, x0 - 0.16, 0.01, z1 + 0.12, C('#b8b8b0').clone().multiplyScalar(0.35), out);
      e.box(x1 + 0.16, 0.005, z0 - 0.12, x1 + 0.22, 0.01, z1 + 0.12, C('#b8b8b0').clone().multiplyScalar(0.35), out);
    }
    // taxi bay
    const ty = C('#ffd23f').clone().multiplyScalar(0.55);
    for (let x = 41; x < 53; x += 0.6) { e.box(x, 0.005, 55.4, x + 0.35, 0.01, 55.47, ty, out); e.box(x, 0.005, 58.73, x + 0.35, 0.01, 58.8, ty, out); }
    // queue stanchions along the line
    for (let x = 22; x <= 44; x += 2.2) {
      g.add(R3.prim('cyl'), R3.mtx(x, 0.45, 49.9, 0.06, 0.9, 0.06), C('#d9b04a'), out);
      g.add(R3.prim('cyl'), R3.mtx(x, 0.02, 49.9, 0.28, 0.04, 0.28), C('#d9b04a'), out);
      if (x < 44) g.add(R3.prim('cyl'), R3.mtx(x + 1.1, 0.78, 49.9, 0.05, 2.2, 0.05, 0, 0, Math.PI / 2), C('#8a0f2a'), out);
    }
    // canopy over the entrance
    g.box(42.5, 2.95, 47.6, 49.5, 3.05, 49.3, C('#16141c'), out);
    for (let x = 43; x <= 49; x += 1) e.box(x - 0.08, 2.93, 48.9, x + 0.08, 2.95, 49.1, C('#ffe0a0').clone().multiplyScalar(2.5), out);
    // bar pendant lamps
    for (let x = 18; x <= 30; x += 3) {
      const rr = R3.roomIndexAt(x * T, 12 * T);
      g.add(R3.prim('cyl'), R3.mtx(x, 3.3, 12.2, 0.01, 1.8, 0.01), C('#222'), rr);
      g.add(R3.prim('cone'), R3.mtx(x, 2.35, 12.2, 0.45, 0.32, 0.45), C('#1a1410'), rr);
      e.add(R3.prim('sph'), R3.mtx(x, 2.2, 12.2, 0.16, 0.12, 0.16), C('#ffcf8a').clone().multiplyScalar(3), rr);
    }
    // patio string lights
    for (let zz = 20; zz <= 46; zz += 3) {
      const rr = R3.roomIndexAt(80 * T, zz * T);
      for (let k = 0; k <= 10; k++) {
        const x = 77 + k * 1.05, sag = Math.sin((k / 10) * Math.PI) * 0.45;
        e.add(R3.prim('sph'), R3.mtx(x, 2.7 - sag, zz, 0.08, 0.1, 0.08), C('#ffcf88').clone().multiplyScalar(2.4), rr);
      }
    }
  }

  /* ================= build + update ================= */
  W3.build = (scene) => {
    root = new THREE.Group();
    root.name = 'world';
    scene.add(root);
    dyn = { screens: [], lamps: [], heaters: [], glows: [], neon: [] };
    if (R3.buildLevelGrid) R3.buildLevelGrid();
    buildFloors();
    buildWalls();
    buildCeilings();
    buildDoors();
    S_LIT = new R3.GB();
    S_EM = new R3.GB();
    for (const f of M.furn) furniture(f);
    buildStreet();
    const lit = new THREE.Mesh(S_LIT.build(), R3.litMat({ vc: true, room: true }));
    lit.name = 'furniture';
    root.add(lit);
    const em = new THREE.Mesh(S_EM.build(), R3.basicMat({ vc: true }));
    em.name = 'furniture_glow';
    root.add(em);
    buildFlamingo();
    buildNeon();
    buildSky();
    buildDynamic();
    W3.dyn = dyn;
  };
  // screens, status lamps, the kebab window, heaters, stove: things that change with the night
  function buildDynamic() {
    const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    for (const s of dyn.screens) {
      const m = new THREE.Mesh(R3.prim('plane'), sm.clone());
      m.scale.set(s.w, s.h, 1); m.position.set(s.x, s.y, s.z);
      root.add(m); s.mesh = m; s.base = C(s.col).clone().multiplyScalar(1.4);
    }
    for (const l of dyn.lamps) {
      const m = new THREE.Mesh(R3.prim('sph'), sm.clone());
      m.scale.setScalar(0.1); m.position.set(l.x, l.y, l.z);
      root.add(m); l.mesh = m;
    }
    for (const h of dyn.heaters) {
      const m = new THREE.Mesh(R3.prim('torus'), sm.clone());
      m.scale.set(0.5, 0.5, 0.5); m.rotation.x = Math.PI / 2; m.position.set(h.x, h.y, h.z);
      root.add(m); h.mesh = m;
    }
    if (dyn.kebabWin) {
      const k = dyn.kebabWin;
      const m = new THREE.Mesh(R3.prim('plane'), sm.clone());
      m.scale.set(k.x1 - k.x0, k.y1 - k.y0, 1); m.position.set((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2, k.z); m.rotation.y = Math.PI;
      root.add(m); k.mesh = m;
    }
  }
  W3.update = (G, dt) => {
    updateDoors(G);
    // flamingo falls over
    const fl = dyn.flamingo;
    if (fl) { const tgt = M.flamingo.tipped ? 1.45 : 0; fl.rotation.x = U.damp(fl.rotation.x, tgt, 5, dt || 0.016); }
    const pw = G.power;
    for (const s of dyn.screens) s.mesh.material.color.copy(pw ? s.base : C('#050505'));
    for (const l of dyn.lamps) {
      let c = '#222';
      if (l.kind === 'breaker') c = pw ? '#3cff3c' : (Math.sin(G.t * 8) > 0 ? '#ff3030' : '#300');
      if (l.kind === 'alarm') c = G.alarm && Math.sin(G.t * 12) > 0 ? '#ff3030' : '#401010';
      l.mesh.material.color.copy(C(c)).multiplyScalar(2);
    }
    for (const h of dyn.heaters) h.mesh.material.color.copy(C(pw ? '#ff7a2a' : '#331a0a')).multiplyScalar(pw ? 2.2 + Math.sin(G.t * 3 + h.x) * 0.3 : 1);
    if (dyn.kebabWin) dyn.kebabWin.mesh.material.color.copy(C(G.kebabOpen ? '#ffe7a8' : '#333')).multiplyScalar(G.kebabOpen ? 1.8 : 0.4);
    // neon: dim when the house lights come on; die in a power cut (exit signs have batteries)
    const club = !(G.lightsOn > 0.5);
    for (const e of dyn.neon) {
      const n = e.n;
      let k = club ? 1 : 0.3;
      if (!pw && !n.exit && n.kind !== 'logo') k = 0;
      if (n.kebab && !G.kebabOpen) k = 0;
      if (n.kind === 'logo' && G.signFlicker) k *= 0.2;
      if (e.strip && (!club || !pw)) k = 0;
      e.mesh.visible = k > 0.01;
      e.mesh.material.color.copy(e.base).multiplyScalar(k);
    }
    // indoors the ceiling closes over you; from high up it lifts off
    const camY = R3.camera.position.y;
    const far = R3.rig.dist > 9 || G.demo;
    if (dyn.ceil) dyn.ceil.visible = !far && camY < R3.WALL_H - 0.1;
    wallTopU.value = far ? 1.25 : R3.WALL_H + 0.1;
  };
})();
