/* Last Call — circle physics: people and loose furniture pushing each other around,
   thin walls, solid furniture boxes, contact events that the social sim turns into grudges. */
(function () {
  'use strict';
  const { U, Map: M } = LC;
  const Ph = (LC.Phys = { bodies: [], contacts: [] });
  const CELL = 48;
  const GW = Math.ceil((M.W * M.T) / CELL), GH = Math.ceil((M.H * M.T) / CELL);
  const grid = new Array(GW * GH);
  for (let i = 0; i < grid.length; i++) grid[i] = [];
  const used = [];

  // static geometry indexes (walls + furniture) on a coarse grid
  const SC = 128, SW = Math.ceil((M.W * M.T) / SC), SH = Math.ceil((M.H * M.T) / SC);
  const segGrid = new Array(SW * SH), boxGrid = new Array(SW * SH);
  for (let i = 0; i < segGrid.length; i++) { segGrid[i] = []; boxGrid[i] = []; }
  function indexStatic() {
    for (const s of M.segs) {
      const pad = 24;
      const x0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - pad) / SC)), x1 = Math.min(SW - 1, Math.floor((Math.max(s.ax, s.bx) + pad) / SC));
      const y0 = Math.max(0, Math.floor((Math.min(s.ay, s.by) - pad) / SC)), y1 = Math.min(SH - 1, Math.floor((Math.max(s.ay, s.by) + pad) / SC));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) segGrid[y * SW + x].push(s);
    }
    for (const f of M.furn) {
      if (!f.solid) continue;
      const pad = 24;
      const x0 = Math.max(0, Math.floor((f.x0 - pad) / SC)), x1 = Math.min(SW - 1, Math.floor((f.x1 + pad) / SC));
      const y0 = Math.max(0, Math.floor((f.y0 - pad) / SC)), y1 = Math.min(SH - 1, Math.floor((f.y1 + pad) / SC));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) boxGrid[y * SW + x].push(f);
    }
  }
  indexStatic();
  Ph.reindex = () => {
    for (let i = 0; i < segGrid.length; i++) { segGrid[i].length = 0; boxGrid[i].length = 0; }
    indexStatic();
  };
  Ph.segsNear = (x, y) => {
    const cx = U.clamp(Math.floor(x / SC), 0, SW - 1), cy = U.clamp(Math.floor(y / SC), 0, SH - 1);
    return segGrid[cy * SW + cx];
  };
  Ph.boxesNear = (x, y) => {
    const cx = U.clamp(Math.floor(x / SC), 0, SW - 1), cy = U.clamp(Math.floor(y / SC), 0, SH - 1);
    return boxGrid[cy * SW + cx];
  };

  Ph.add = (b) => {
    const d = { vx: 0, vy: 0, z: 0, vz: 0, m: 1, fric: 8, ghost: false, stat: false, kind: 'prop', wallHit: 0 };
    for (const k in d) if (b[k] === undefined) b[k] = d[k];
    Ph.bodies.push(b);
    return b;
  };
  Ph.remove = (b) => {
    const i = Ph.bodies.indexOf(b);
    if (i >= 0) Ph.bodies.splice(i, 1);
  };

  function cellOf(x, y) {
    const cx = U.clamp(Math.floor(x / CELL), 0, GW - 1), cy = U.clamp(Math.floor(y / CELL), 0, GH - 1);
    return cy * GW + cx;
  }
  function rebuild() {
    for (const c of used) grid[c].length = 0;
    used.length = 0;
    for (const b of Ph.bodies) {
      if (b.ghost) continue;
      const c = cellOf(b.x, b.y);
      if (grid[c].length === 0) used.push(c);
      grid[c].push(b);
    }
  }
  // bodies within r of (x,y)
  Ph.query = (x, y, r, filter) => {
    const out = [];
    const x0 = U.clamp(Math.floor((x - r) / CELL), 0, GW - 1), x1 = U.clamp(Math.floor((x + r) / CELL), 0, GW - 1);
    const y0 = U.clamp(Math.floor((y - r) / CELL), 0, GH - 1), y1 = U.clamp(Math.floor((y + r) / CELL), 0, GH - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = grid[cy * GW + cx];
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        const rr = r + b.r;
        if (U.dist2(x, y, b.x, b.y) <= rr * rr && (!filter || filter(b))) out.push(b);
      }
    }
    return out;
  };

  function collideWalls(b) {
    const segs = Ph.segsNear(b.x, b.y);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.active) continue;
      if (b.passLow && (s.kind === 'low' || s.kind === 'fence')) continue;
      const c = U.segClosest(b.x, b.y, s.ax, s.ay, s.bx, s.by);
      const dx = b.x - c.x, dy = b.y - c.y;
      const d2 = dx * dx + dy * dy, min = b.r + s.thick;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2), nx, ny;
      if (d < 1e-4) {
        // exactly on the line: push to the side we came from
        const sx = s.bx - s.ax, sy = s.by - s.ay, sl = Math.hypot(sx, sy) || 1;
        nx = -sy / sl; ny = sx / sl;
        if (b.vx * nx + b.vy * ny > 0) { nx = -nx; ny = -ny; }
        d = 0;
      } else { nx = dx / d; ny = dy / d; }
      const pen = min - d;
      b.x += nx * pen; b.y += ny * pen;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.wallHit = Math.max(b.wallHit, -vn);
        b.vx -= vn * nx * 1.15; b.vy -= vn * ny * 1.15;
      }
    }
  }
  function collideBoxes(b) {
    const boxes = Ph.boxesNear(b.x, b.y);
    for (let i = 0; i < boxes.length; i++) {
      const f = boxes[i];
      if (b.passFurn && b.passFurn === f) continue;
      const cx = U.clamp(b.x, f.x0, f.x1), cy = U.clamp(b.y, f.y0, f.y1);
      let dx = b.x - cx, dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r) continue;
      let nx, ny, pen;
      if (d2 < 1e-6) {
        // centre inside the box: leave by the nearest face
        const l = b.x - f.x0, r = f.x1 - b.x, t = b.y - f.y0, bo = f.y1 - b.y;
        const m = Math.min(l, r, t, bo);
        if (m === l) { nx = -1; ny = 0; pen = l + b.r; } else if (m === r) { nx = 1; ny = 0; pen = r + b.r; } else if (m === t) { nx = 0; ny = -1; pen = t + b.r; } else { nx = 0; ny = 1; pen = bo + b.r; }
      } else {
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d; pen = b.r - d;
      }
      b.x += nx * pen; b.y += ny * pen;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.wallHit = Math.max(b.wallHit, -vn); b.vx -= vn * nx * 1.1; b.vy -= vn * ny * 1.1; }
      if (f.onBump && -vn > 60) f.onBump(b, -vn);
    }
  }
  function collidePair(a, b) {
    if (a.link === b || b.link === a) return;
    if (a.noBodies || b.noBodies) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-8) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
    const ia = a.stat ? 0 : 1 / a.m, ib = b.stat ? 0 : 1 / b.m, is = ia + ib;
    if (is <= 0) return;
    // soft separation keeps crowds from jittering
    const k = 0.8 * pen / is;
    a.x -= nx * k * ia; a.y -= ny * k * ia;
    b.x += nx * k * ib; b.y += ny * k * ib;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const j = (-(1 + 0.15) * rv) / is;
      a.vx -= j * nx * ia; a.vy -= j * ny * ia;
      b.vx += j * nx * ib; b.vy += j * ny * ib;
      if (-rv > 45) Ph.contacts.push({ a, b, speed: -rv, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, nx, ny });
    }
  }

  Ph.step = (dt) => {
    Ph.contacts.length = 0;
    const bs = Ph.bodies;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      b.wallHit = 0;
      if (b.stat || b.pinned) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const f = Math.exp(-b.fric * dt);
      b.vx *= f; b.vy *= f;
      if (b.z > 0 || b.vz !== 0) {
        b.vz -= 900 * dt; b.z += b.vz * dt;
        if (b.z <= 0) { b.landed = -b.vz; b.z = 0; b.vz = 0; }
      }
    }
    rebuild();
    for (let it = 0; it < 2; it++) {
      for (const c of used) {
        const cell = grid[c];
        const cx = c % GW, cy = (c / GW) | 0;
        for (let i = 0; i < cell.length; i++) {
          const a = cell[i];
          for (let j = i + 1; j < cell.length; j++) collidePair(a, cell[j]);
          // neighbour cells (half of them, so each pair is tested once)
          for (let k = 0; k < 4; k++) {
            const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? 0 : 1), ny = cy + (k === 0 ? 0 : 1);
            if (nx < 0 || nx >= GW || ny >= GH) continue;
            const nc = grid[ny * GW + nx];
            for (let j = 0; j < nc.length; j++) collidePair(a, nc[j]);
          }
        }
      }
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (b.ghost || b.stat || b.pinned) continue;
        if (!b.noWalls) collideWalls(b);
        if (!b.noBoxes) collideBoxes(b);
      }
    }
  };

  // is a circle at (x,y,r) clear of walls and furniture
  Ph.free = (x, y, r) => {
    for (const s of Ph.segsNear(x, y)) {
      if (!s.active) continue;
      const c = U.segClosest(x, y, s.ax, s.ay, s.bx, s.by);
      if (U.dist2(x, y, c.x, c.y) < (r + s.thick) * (r + s.thick)) return false;
    }
    for (const f of Ph.boxesNear(x, y)) {
      const cx = U.clamp(x, f.x0, f.x1), cy = U.clamp(y, f.y0, f.y1);
      if (U.dist2(x, y, cx, cy) < r * r) return false;
    }
    return true;
  };
  // nearest furniture box within reach (for people grabbing onto things)
  Ph.nearestBox = (x, y, reach, pred) => {
    let best = null, bd = reach * reach;
    for (const f of Ph.boxesNear(x, y)) {
      if (pred && !pred(f)) continue;
      const cx = U.clamp(x, f.x0, f.x1), cy = U.clamp(y, f.y0, f.y1);
      const d2 = U.dist2(x, y, cx, cy);
      if (d2 < bd) { bd = d2; best = { f, x: cx, y: cy }; }
    }
    return best;
  };
})();
