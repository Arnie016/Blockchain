/* Last Call — the security camera tablet. Every camera renders the live club in grainy
   night-vision; watch a feed long enough and whatever is going on in it becomes your problem. */
(function () {
  'use strict';
  const { U, Map: M } = LC;
  const C = (LC.CCTV = { on: false });
  const $ = (id) => document.getElementById(id);
  let root, grid, big, bigCv, bigLabel, feeds = [], focus = -1, rr = 0, watch = new Map();
  const FW = 320, FH = 190;
  let noiseCv = null;

  C.isOpen = () => C.on;
  C.current = () => (focus >= 0 ? M.cams[focus].id : null);

  function makeNoise() {
    noiseCv = document.createElement('canvas');
    noiseCv.width = 256; noiseCv.height = 256;
    const g = noiseCv.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  C.init = () => {
    root = $('cctv'); grid = $('camGrid'); big = $('camBig'); bigCv = $('camBigCv'); bigLabel = $('camBigLabel');
    makeNoise();
    feeds = M.cams.map((cam, i) => {
      const wrap = document.createElement('button');
      wrap.type = 'button'; wrap.className = 'feed'; wrap.dataset.i = i;
      wrap.setAttribute('aria-label', 'Camera ' + cam.id + ' ' + cam.label);
      const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
      wrap.appendChild(cv);
      grid.appendChild(wrap);
      const lc = document.createElement('canvas');
      return { cam, cv, g: cv.getContext('2d'), light: { cv: lc, g: lc.getContext('2d'), scale: 0.5 }, t: 0 };
    });
    grid.addEventListener('click', (e) => { const b = e.target.closest('.feed'); if (b) C.focus(+b.dataset.i); });
    $('camBack').addEventListener('click', () => C.focus(-1));
    $('camClose').addEventListener('click', () => C.close());
    $('camPrev').addEventListener('click', () => C.focus((focus - 1 + feeds.length) % feeds.length));
    $('camNext').addEventListener('click', () => C.focus((focus + 1) % feeds.length));
  };
  C.toggle = () => (C.on ? C.close() : C.show());
  C.show = () => {
    const G = LC.G;
    if (!G || G.dialog) return;
    C.on = true;
    if (LC.Game.unlock) LC.Game.unlock();
    root.hidden = false;
    C.focus(-1);
    LC.sfx('ui', 0, 0, { ui: true });
    LC.stat('cctvChecks');
  };
  C.close = () => { C.on = false; root.hidden = true; focus = -1; };
  C.focus = (i) => {
    focus = i;
    big.hidden = i < 0;
    grid.hidden = i >= 0;
    if (i >= 0) { const c = M.cams[i]; bigLabel.textContent = 'CAM ' + c.id + ' · ' + c.label + (c.note ? ' (' + c.note + ')' : ''); }
  };

  function renderFeed(f, g, w, h) {
    const G = LC.G, cam = f.cam;
    if (!G.power) {
      g.fillStyle = '#0a0c0a'; g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.35; g.drawImage(noiseCv, Math.random() * 60, Math.random() * 60, w, h, 0, 0, w, h); g.globalAlpha = 1;
      g.fillStyle = '#9fd8a8'; g.font = '16px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.fillText('NO SIGNAL', w / 2, h / 2);
      return;
    }
    const zoom = w / (cam.vw * M.T);
    const view = { x: cam.x, y: cam.y, zoom };
    LC.R.renderView(g, view, G, { w, h, cctv: true, lighting: true, lightTarget: f.light, drawChar: LC.Game.drawChar });
    g.setTransform(1, 0, 0, 1, 0, 0);
    // night vision: drain the colour, tint green, add grain and scanlines
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'hsl(0,0%,50%)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(40,70,40,0.55)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#b8e8c0'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.09; g.drawImage(noiseCv, Math.random() * 60, Math.random() * 60, Math.min(196, w), Math.min(196, h), 0, 0, w, h); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    const fs = Math.max(10, Math.min(18, Math.round(w / 30)));
    g.font = fs + 'px "Share Tech Mono", monospace';
    g.fillStyle = '#d8ffe0'; g.textAlign = 'left';
    g.fillText('CAM ' + cam.id + ' ' + cam.label, 8, fs + 4);
    g.textAlign = 'right';
    const secs = Math.floor((G.clock % 1) * 60);
    g.fillText(U.clock(G.clock, false).padStart(5, '0') + ':' + String(secs).padStart(2, '0'), w - 8, fs + 4);
    if (Math.sin(G.t * 4) > 0) { g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(w - 10, h - 12, 4, 0, 7); g.fill(); g.fillStyle = '#d8ffe0'; g.fillText('REC', w - 18, h - 8); }
  }
  // how long you've looked at a feed containing something
  function track(f, secs) {
    const cam = f.cam, T = M.T;
    const hw = (cam.vw * T) / 2, hh = hw * (FH / FW);
    for (const inc of LC.Incidents.active) {
      if (inc.noticed || inc.def.stareOnly) continue;
      if (Math.abs(inc.x - cam.x) > hw || Math.abs(inc.y - cam.y) > hh) continue;
      if (inc.n && inc.n.hidden && !inc.data.stall) continue;
      const k = inc.id;
      const v = (watch.get(k) || 0) + secs;
      watch.set(k, v);
      if (v > (focus >= 0 ? 0.7 : 1.8)) { watch.delete(k); LC.Incidents.cctvSee(inc); }
    }
  }
  C.update = (dt) => {
    if (!C.on) return;
    if (focus >= 0) {
      const f = feeds[focus];
      const w = bigCv.clientWidth || 800, h = bigCv.clientHeight || 450;
      if (bigCv.width !== w || bigCv.height !== h) { bigCv.width = w; bigCv.height = h; }
      renderFeed(f, bigCv.getContext('2d'), w, h);
      track(f, dt);
    } else {
      // two feeds a frame, round robin
      for (let k = 0; k < 2; k++) { const f = feeds[rr++ % feeds.length]; renderFeed(f, f.g, FW, FH); }
      for (const f of feeds) track(f, dt);
    }
  };
})();
