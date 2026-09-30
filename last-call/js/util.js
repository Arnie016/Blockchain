/* Last Call — shared helpers. Everything hangs off window.LC. */
(function () {
  'use strict';
  const LC = (window.LC = window.LC || {});
  const U = (LC.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.chance = (p) => Math.random() < p;
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // weighted pick; wf returns a weight >= 0
  U.weighted = (items, wf) => {
    let tot = 0;
    const ws = items.map((it) => { const w = Math.max(0, wf(it) || 0); tot += w; return w; });
    if (tot <= 0) return null;
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  U.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  // deterministic hash in [0,1)
  U.hash = (x, y, s = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // closest point on segment ab to p
  U.segClosest = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { x: ax + dx * t, y: ay + dy * t, t };
  };
  // do segments p1p2 and p3p4 intersect
  U.segHit = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (d === 0) return false;
    const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  };
  // game clock: minutes since 21:00 -> "11:47 PM"
  U.clock = (min, withAmPm = true) => {
    const tot = 21 * 60 + Math.floor(min);
    const h = Math.floor(tot / 60) % 24, m = tot % 60;
    const h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + (withAmPm ? (h >= 12 ? ' PM' : ' AM') : '');
  };
  U.fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  U.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  U.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  U.ease = {
    out: (t) => 1 - (1 - t) * (1 - t),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  };
  U.rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  U.rgb = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  U.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  U.hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.shade = (h, k) => {
    const c = U.hex(h);
    return U.rgb(k >= 0 ? U.mix(c, [255, 255, 255], k) : U.mix(c, [0, 0, 0], -k));
  };
  U.uid = (() => { let n = 1; return () => n++; })();

  // cross-module shortcuts (safe before the game or audio exist)
  LC.stat = (k, n = 1) => { const s = LC.G && LC.G.stats; if (s) s[k] = (s[k] || 0) + n; };
  LC.sfx = (name, x, y, o) => { const A = LC.Audio; if (A && A.ready) A.sfx(name, x, y, o); };
  LC.now = () => (LC.G ? LC.G.t : 0);

  // safe storage
  U.load = (key, def) => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  };
  U.save = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage blocked */ }
  };
})();
