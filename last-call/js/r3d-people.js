/* Last Call — 3D people. Every guest, member of staff and you are built from ~20 instanced body
   parts posed by a small forward-kinematics rig each frame. Faces come from an expression
   atlas, tops can carry a printed pattern (SECURITY on the back of the staff), and hair, hats,
   glasses and whatever they are holding are separate instanced pieces. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const R3 = LC.R3;
  if (!R3 || !R3.ok) return;
  const { U, Map: M } = LC;
  const T = M.T, ZS = R3.ZS;
  const P3 = (R3.People = { cctvMode: false });
  const C = R3.col;
  const MAXC = 320;

  /* ================= tiny column-major mat4 ================= */
  const mk = () => new Float32Array(16);
  const ident = (m) => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  const cp = (o, a) => { o.set(a); return o; };
  const tr = (m, x, y, z) => { m[12] += m[0] * x + m[4] * y + m[8] * z; m[13] += m[1] * x + m[5] * y + m[9] * z; m[14] += m[2] * x + m[6] * y + m[10] * z; return m; };
  const rx = (m, a) => { if (!a) return m; const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; } return m; };
  const ry = (m, a) => { if (!a) return m; const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; } return m; };
  const rz = (m, a) => { if (!a) return m; const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const x = m[i], y = m[4 + i]; m[i] = x * c + y * s; m[4 + i] = y * c - x * s; } return m; };
  const sc = (m, x, y, z) => { for (let i = 0; i < 3; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; } return m; };

  /* ================= geometry ================= */
  // capsule along -Y from 0 to -len, radius tapering r0 -> r1
  function capsule(r0, r1, len, seg = 8) {
    const pts = [];
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * r1 + 1e-4, -len - Math.cos(a) * r1 * 0.9)); }
    for (let i = 3; i >= 0; i--) { const a = (i / 3) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * r0 + 1e-4, Math.cos(a) * r0 * 0.9)); }
    pts.sort((a, b) => a.y - b.y);
    const g = new THREE.LatheGeometry(pts, seg);
    return g.index ? g.toNonIndexed() : g;
  }
  function lathe(profile, seg = 14, zs = 1) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r + 1e-4, y)), seg);
    if (zs !== 1) g.scale(1, 1, zs);
    g.computeVertexNormals();
    return g.index ? g.toNonIndexed() : g;
  }
  const sph = (r, ws = 14, hs = 10, p0 = 0, pl = Math.PI * 2, t0 = 0, tl = Math.PI) => { const g = new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl); return g.index ? g.toNonIndexed() : g; };
  const xf = (g, x, y, z, sx = 1, sy = 1, sz = 1, ryy = 0, rxx = 0, rzz = 0) => { const gg = g.clone(); gg.applyMatrix4(R3.mtx(x, y, z, sx, sy, sz, ryy, rxx, rzz).clone()); return gg; };
  function mergeG(list) {
    const parts = list.map((g) => [g, new THREE.Matrix4(), C('#ffffff')]);
    return R3.merge(parts);
  }
  const HEAD_R = 0.118;
  const GEO = {};
  function buildGeometry() {
    GEO.torso = lathe([[0.0, 0], [0.14, 0], [0.152, 0.07], [0.148, 0.19], [0.162, 0.33], [0.186, 0.43], [0.178, 0.5], [0.13, 0.545], [0.05, 0.56], [0, 0.565]], 12, 0.64);
    GEO.pelvis = lathe([[0, -0.1], [0.12, -0.1], [0.15, -0.05], [0.152, 0.03], [0.14, 0.06], [0, 0.06]], 10, 0.72);
    GEO.head = sph(HEAD_R, 14, 10);
    GEO.head.scale(0.96, 1.1, 1);
    GEO.face = sph(HEAD_R * 1.018, 9, 8, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.9, 1.8);
    GEO.face.scale(0.96, 1.1, 1);
    GEO.neck = xf(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 10).toNonIndexed(), 0, 0.03, 0);
    GEO.uarm = capsule(0.052, 0.044, 0.28);
    GEO.farm = capsule(0.043, 0.034, 0.25);
    GEO.hand = sph(0.047, 6, 5); GEO.hand.scale(0.85, 1.15, 0.8);
    GEO.thigh = capsule(0.078, 0.058, 0.43);
    GEO.shin = capsule(0.056, 0.042, 0.43);
    GEO.foot = sph(0.07, 8, 5); GEO.foot.scale(1.15, 0.72, 2.0); GEO.foot.translate(0, 0.02, 0.06);
    GEO.skirt = lathe([[0.15, 0.0], [0.19, -0.12], [0.25, -0.32], [0, -0.32]], 16, 0.8);
    GEO.dress = lathe([[0.15, 0.0], [0.2, -0.16], [0.29, -0.52], [0, -0.52]], 16, 0.8);
    GEO.shadow = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).toNonIndexed();
    // hair, relative to the head centre
    const R = HEAD_R;
    const cap = (r, t1 = 1.2) => sph(r, 16, 8, 0, Math.PI * 2, 0, t1);
    // back of the head, leaving the face open (phi measured from +x; the face is at +z)
    const backOf = (r, t0, t1) => sph(r, 14, 6, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, t0, t1 - t0);
    const shortHair = (r = R * 1.07) => [cap(r, 1.25), backOf(r * 0.99, 1.2, 1.95)];
    const sq = (list) => list.map((g) => { g.scale(0.96, 1.1, 1); return g; });
    GEO.hair = {
      short: mergeG(sq(shortHair())),
      buzz: mergeG(sq([cap(R * 1.025, 1.3), backOf(R * 1.02, 1.25, 1.9)])),
      slick: mergeG(sq([cap(R * 1.05, 1.15), backOf(R * 1.04, 1.1, 1.9), xf(sph(R * 0.5, 8, 6), 0, R * 0.95, R * 0.35, 1.6, 0.35, 1)])),
      side: mergeG(sq([...shortHair(), xf(sph(R * 0.55, 10, 6), R * 0.35, R * 0.62, R * 0.72, 1.5, 0.5, 0.6, 0, 0, -0.4)])),
      curly: mergeG(sq((() => { const l = []; for (let i = 0; i < 24; i++) { const th = 0.15 + (i % 6) * 0.3, ph = (i / 24) * Math.PI * 2 * 3.1; if (Math.sin(ph) > 0.55 && th > 1.1) continue; l.push(xf(sph(R * 0.36, 7, 5), Math.cos(ph) * Math.sin(th) * R * 1.02, Math.cos(th) * R * 1.02, Math.sin(ph) * Math.sin(th) * R * 1.02)); } return l; })())),
      afro: mergeG(sq([xf(sph(R * 1.62, 16, 10, 0, Math.PI * 2, 0, 1.45), 0, R * 0.05, -R * 0.12), xf(backOf(R * 1.5, 1.2, 2.0), 0, R * 0.05, -R * 0.12)])),
      spiky: mergeG(sq([...shortHair(R * 1.04), ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = -0.9 + i * 0.3; return xf(new THREE.ConeGeometry(R * 0.2, R * 0.6, 6).toNonIndexed(), Math.sin(a) * R * 0.7, R * 1.05, Math.cos(i * 1.7) * R * 0.3, 1, 1, 1, 0, 0, -a * 0.8); })])),
      mohawk: mergeG(sq([cap(R * 1.02, 1.25), ...[0, 1, 2, 3, 4].map((i) => xf(new THREE.ConeGeometry(R * 0.2, R * 0.75, 6).toNonIndexed(), 0, R * 1.1 - Math.abs(i - 2) * R * 0.08, R * 0.6 - i * R * 0.35, 1, 1, 1, 0, -0.4 + i * 0.2))])),
      long: mergeG(sq([...shortHair(), xf(new THREE.BoxGeometry(R * 1.9, R * 2.6, R * 0.5).toNonIndexed(), 0, -R * 0.9, -R * 0.62), xf(new THREE.BoxGeometry(R * 0.35, R * 1.8, R * 0.5).toNonIndexed(), R * 0.9, -R * 0.55, R * 0.05), xf(new THREE.BoxGeometry(R * 0.35, R * 1.8, R * 0.5).toNonIndexed(), -R * 0.9, -R * 0.55, R * 0.05)])),
      pony: mergeG(sq([...shortHair(), xf(capsule(R * 0.25, R * 0.18, R * 1.6), 0, R * 0.2, -R * 1.02, 1, 1, 1, 0, 0.7)])),
      bun: mergeG(sq([...shortHair(), xf(sph(R * 0.45, 10, 8), 0, R * 0.95, -R * 0.55)])),
      bob: mergeG(sq([...shortHair(R * 1.1), xf(new THREE.BoxGeometry(R * 0.35, R * 1.25, R * 1.6).toNonIndexed(), R * 0.92, -R * 0.2, -R * 0.15), xf(new THREE.BoxGeometry(R * 0.35, R * 1.25, R * 1.6).toNonIndexed(), -R * 0.92, -R * 0.2, -R * 0.15), xf(new THREE.BoxGeometry(R * 1.9, R * 1.3, R * 0.4).toNonIndexed(), 0, -R * 0.25, -R * 0.85)])),
      braids: mergeG(sq([...shortHair(), xf(capsule(R * 0.16, R * 0.12, R * 2.8), R * 0.55, -R * 0.2, -R * 0.75, 1, 1, 1, 0, 0.2), xf(capsule(R * 0.16, R * 0.12, R * 2.8), -R * 0.55, -R * 0.2, -R * 0.75, 1, 1, 1, 0, 0.2)])),
      pixie: mergeG(sq([...shortHair(R * 1.05), xf(sph(R * 0.6, 10, 6), -R * 0.25, R * 0.68, R * 0.62, 1.7, 0.45, 0.7, 0, 0, 0.35)])),
    };
    GEO.beard = {
      full: mergeG(sq([sph(R * 1.035, 12, 6, Math.PI / 2 - 1.25, 2.5, 1.95, 1.0)])),
      stubble: mergeG(sq([sph(R * 1.02, 12, 6, Math.PI / 2 - 1.2, 2.4, 1.9, 1.0)])),
      goatee: mergeG(sq([xf(sph(R * 0.32, 8, 6), 0, -R * 0.82, R * 0.72)])),
      mustache: mergeG(sq([xf(capsule(R * 0.12, R * 0.12, R * 0.7), R * 0.35, -R * 0.35, R * 0.93, 1, 1, 1, 0, 0, Math.PI / 2)])),
    };
    const coneG = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s).toNonIndexed();
    const cylG = (r0, r1, h, s = 14) => new THREE.CylinderGeometry(r0, r1, h, s).toNonIndexed();
    GEO.hat = {
      cap: mergeG(sq([cap(R * 1.1, 1.35), xf(cylG(R * 0.95, R * 0.95, R * 0.1, 14), 0, R * 0.35, R * 0.75, 1, 1, 0.75)])),
      beanie: mergeG(sq([xf(sph(R * 1.12, 14, 8, 0, Math.PI * 2, 0, 1.55), 0, R * 0.18, 0), xf(new THREE.TorusGeometry(R * 1.05, R * 0.12, 6, 16).toNonIndexed(), 0, R * 0.22, 0, 1, 1, 1, 0, Math.PI / 2)])),
      cowboy: mergeG([xf(cylG(R * 2.3, R * 2.3, R * 0.1, 18), 0, R * 0.62, 0, 1, 1, 0.9), xf(cylG(R * 0.95, R * 1.05, R * 0.95), 0, R * 1.1, 0)]),
      party: mergeG([xf(coneG(R * 0.55, R * 2.0), 0, R * 1.75, 0), xf(sph(R * 0.22, 8, 6), 0, R * 2.8, 0)]),
      crown: mergeG([xf(cylG(R * 0.95, R * 0.95, R * 0.45, 12), 0, R * 1.05, 0), ...[0, 1, 2, 3, 4, 5].map((i) => xf(coneG(R * 0.2, R * 0.5, 5), Math.cos(i * 1.047) * R * 0.85, R * 1.5, Math.sin(i * 1.047) * R * 0.85))]),
      veil: mergeG([xf(new THREE.TorusGeometry(R * 1.02, R * 0.1, 6, 16).toNonIndexed(), 0, R * 0.55, 0, 1, 1, 1, 0, Math.PI / 2 - 0.2), xf(new THREE.BoxGeometry(R * 2.1, R * 3.4, R * 0.06).toNonIndexed(), 0, -R * 0.8, -R * 1.1, 1, 1, 1, 0, -0.12)]),
      cone: mergeG([xf(coneG(R * 1.25, R * 3.6, 14), 0, R * 2.3, 0), xf(cylG(R * 1.7, R * 1.7, R * 0.2, 4), 0, R * 0.5, 0, 1, 1, 1, Math.PI / 4)]),
      sign: mergeG([xf(new THREE.BoxGeometry(R * 1.8, R * 3.2, R * 0.12).toNonIndexed(), 0, R * 2.0, R * 0.3, 1, 1, 1, 0, 0.18), xf(new THREE.BoxGeometry(R * 1.8, R * 3.2, R * 0.12).toNonIndexed(), 0, R * 2.0, -R * 0.3, 1, 1, 1, 0, -0.18)]),
      sombrero: mergeG([xf(cylG(R * 3.2, R * 3.2, R * 0.12, 20), 0, R * 0.62, 0), xf(coneG(R * 1.1, R * 1.4, 14), 0, R * 1.35, 0)]),
      halo: mergeG([xf(new THREE.TorusGeometry(R * 1.0, R * 0.09, 6, 20).toNonIndexed(), 0, R * 1.75, 0, 1, 1, 1, 0, Math.PI / 2)]),
      bucket: mergeG([xf(cylG(R * 1.15, R * 1.45, R * 1.3, 14), 0, R * 0.85, 0)]),
      headphones: mergeG([xf(new THREE.TorusGeometry(R * 1.08, R * 0.1, 6, 16, Math.PI).toNonIndexed(), 0, 0, 0, 1, 1.05, 1, 0, 0, 0), xf(cylG(R * 0.42, R * 0.42, R * 0.28, 10), R * 1.05, -R * 0.1, 0, 1, 1, 1, 0, 0, Math.PI / 2), xf(cylG(R * 0.42, R * 0.42, R * 0.28, 10), -R * 1.05, -R * 0.1, 0, 1, 1, 1, 0, 0, Math.PI / 2)]),
      police: mergeG(sq([cap(R * 1.12, 1.3), xf(cylG(R * 1.15, R * 1.15, R * 0.35, 14), 0, R * 0.62, 0), xf(cylG(R * 0.9, R * 0.9, R * 0.08, 14), 0, R * 0.4, R * 0.55, 1, 1, 0.7)])),
    };
    GEO.glasses = {
      sun: mergeG([xf(new THREE.BoxGeometry(R * 1.55, R * 0.42, R * 0.12).toNonIndexed(), 0, R * 0.12, R * 1.0)]),
      nerd: mergeG([xf(new THREE.TorusGeometry(R * 0.3, R * 0.05, 5, 12).toNonIndexed(), R * 0.4, R * 0.12, R * 1.0), xf(new THREE.TorusGeometry(R * 0.3, R * 0.05, 5, 12).toNonIndexed(), -R * 0.4, R * 0.12, R * 1.0)]),
    };
    // held things, in the hand's frame (hand at origin, fingers toward -y)
    GEO.item = {
      glass: xf(cylG(0.035, 0.028, 0.1, 10), 0, -0.02, 0.05),
      bottle: mergeG([xf(cylG(0.03, 0.03, 0.18, 8), 0, 0.0, 0.05), xf(cylG(0.012, 0.02, 0.08, 8), 0, 0.12, 0.05)]),
      phone: xf(new THREE.BoxGeometry(0.075, 0.14, 0.012).toNonIndexed(), 0, 0.02, 0.05),
      screen: xf(new THREE.PlaneGeometry(0.064, 0.12).toNonIndexed(), 0, 0.02, 0.0575),
      cig: xf(cylG(0.005, 0.005, 0.08, 5), 0, -0.02, 0.05, 1, 1, 1, 0, Math.PI / 2),
      ember: xf(sph(0.009, 5, 4), 0, -0.02, 0.092),
      mop: mergeG([xf(cylG(0.014, 0.014, 1.3, 6), 0, -0.35, 0.05), xf(new THREE.BoxGeometry(0.28, 0.06, 0.1).toNonIndexed(), 0, -1.0, 0.05)]),
      broom: mergeG([xf(cylG(0.014, 0.014, 1.2, 6), 0, -0.3, 0.05), xf(new THREE.BoxGeometry(0.3, 0.1, 0.08).toNonIndexed(), 0, -0.93, 0.05)]),
      torch: mergeG([xf(cylG(0.02, 0.026, 0.2, 8), 0, 0, 0.1, 1, 1, 1, 0, Math.PI / 2)]),
      water: xf(cylG(0.03, 0.03, 0.2, 8), 0, 0.02, 0.05),
      box: xf(new THREE.BoxGeometry(0.16, 0.12, 0.06).toNonIndexed(), 0, 0, 0.06),
      sign: xf(new THREE.BoxGeometry(0.28, 0.5, 0.05).toNonIndexed(), 0, -0.15, 0.08),
    };
    GEO.bag = xf(new THREE.BoxGeometry(0.16, 0.13, 0.07).toNonIndexed(), 0, 0, 0);
    GEO.sash = xf(new THREE.BoxGeometry(0.06, 0.62, 0.012).toNonIndexed(), 0, 0, 0);
    GEO.band = new THREE.TorusGeometry(0.045, 0.012, 5, 12).toNonIndexed();
    GEO.chain = new THREE.TorusGeometry(0.075, 0.008, 4, 16).toNonIndexed();
  }

  /* ================= atlases ================= */
  const EXPR = ['neutral', 'happy', 'laugh', 'drunk', 'wasted', 'angry', 'furious', 'scared', 'sad', 'cry', 'embarrassed', 'smug', 'shock', 'sleep', 'sick', 'suspicious', 'polite', 'love', 'confused', 'tired', 'dead', 'blank', 'shout', 'talk', 'ko', 'kiss', 'talk2', 'shout2'];
  const EI = {}; EXPR.forEach((e, i) => { EI[e] = i; });
  function faceAtlas() {
    return R3.canvasTex(1024, 1024, (g) => {
      EXPR.forEach((e, i) => {
        for (let b = 0; b < 2; b++) {
          const cell = i * 2 + b, cx = (cell % 8) * 128 + 64, cy = Math.floor(cell / 8) * 128 + 64;
          g.save(); g.translate(cx, cy); g.scale(9.4, 9.4);
          drawFace(g, e, b === 1);
          g.restore();
        }
      });
    });
  }
  function drawFace(g, e, blink) {
    const ex = 2.9, ey = -1.2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#1a121c'; g.fillStyle = '#1a121c'; g.lineWidth = 0.75;
    let eyes = 'dot', brow = null, mouth = 'flat', blush = 0;
    switch (e) {
      case 'happy': mouth = 'smile'; break;
      case 'laugh': eyes = 'happy'; mouth = 'open'; break;
      case 'drunk': eyes = 'half'; mouth = 'wobbly'; blush = 0.6; break;
      case 'wasted': eyes = 'spiral'; mouth = 'open'; blush = 0.8; break;
      case 'angry': brow = 'angry'; mouth = 'frown'; break;
      case 'furious': eyes = 'wide'; brow = 'angry'; mouth = 'shout'; blush = 0.4; break;
      case 'scared': eyes = 'wide'; brow = 'worried'; mouth = 'o'; break;
      case 'sad': brow = 'worried'; mouth = 'frown'; break;
      case 'cry': eyes = 'closed'; brow = 'worried'; mouth = 'wail'; break;
      case 'embarrassed': eyes = 'side'; mouth = 'wavy'; blush = 0.9; break;
      case 'smug': eyes = 'half'; mouth = 'smirk'; break;
      case 'shock': eyes = 'wide'; brow = 'up'; mouth = 'O'; break;
      case 'sleep': eyes = 'closed'; mouth = 'o'; break;
      case 'sick': eyes = 'half'; mouth = 'puff'; break;
      case 'suspicious': eyes = 'side'; brow = 'flat'; break;
      case 'polite': eyes = 'happy'; mouth = 'smile'; break;
      case 'love': eyes = 'heart'; mouth = 'smile'; blush = 0.7; break;
      case 'confused': brow = 'confused'; mouth = 'wavy'; break;
      case 'tired': eyes = 'tired'; break;
      case 'dead': eyes = 'tired'; brow = 'flat'; break;
      case 'blank': mouth = 'line'; break;
      case 'shout': brow = 'angry'; mouth = 'shout'; break;
      case 'shout2': brow = 'angry'; mouth = 'shoutBig'; break;
      case 'talk': mouth = 'o'; break;
      case 'talk2': mouth = 'flat'; break;
      case 'ko': eyes = 'x'; mouth = 'o'; break;
      case 'kiss': eyes = 'closed'; mouth = 'pucker'; blush = 0.8; break;
    }
    if (blink && (eyes === 'dot' || eyes === 'half' || eyes === 'side')) eyes = 'closed';
    if (blush) { g.fillStyle = 'rgba(255,80,110,' + (0.55 * blush).toFixed(2) + ')'; g.beginPath(); g.ellipse(-4.3, 1.2, 1.9, 1.1, 0, 0, 7); g.ellipse(4.3, 1.2, 1.9, 1.1, 0, 0, 7); g.fill(); g.fillStyle = '#1a121c'; }
    for (const s of [-1, 1]) {
      const x = s * ex, y = ey;
      g.strokeStyle = '#1a121c'; g.fillStyle = '#1a121c';
      switch (eyes) {
        case 'closed': g.beginPath(); g.moveTo(x - 1.5, y + 0.2); g.quadraticCurveTo(x, y + 0.9, x + 1.5, y + 0.2); g.stroke(); break;
        case 'happy': g.beginPath(); g.arc(x, y + 0.8, 1.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); break;
        case 'half': g.beginPath(); g.moveTo(x - 1.6, y - 0.2); g.lineTo(x + 1.6, y - 0.2); g.stroke(); g.beginPath(); g.arc(x, y + 0.4, 0.95, 0, Math.PI); g.fill(); break;
        case 'wide': g.fillStyle = '#fbfbff'; g.beginPath(); g.arc(x, y, 2.0, 0, 7); g.fill(); g.fillStyle = '#1a121c'; g.beginPath(); g.arc(x, y, 0.85, 0, 7); g.fill(); break;
        case 'spiral': g.beginPath(); for (let k = 0; k < 14; k++) { const a = k * 0.8, rr = 0.2 + k * 0.1; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.stroke(); break;
        case 'x': g.beginPath(); g.moveTo(x - 1.2, y - 1.2); g.lineTo(x + 1.2, y + 1.2); g.moveTo(x + 1.2, y - 1.2); g.lineTo(x - 1.2, y + 1.2); g.stroke(); break;
        case 'side': g.fillStyle = '#fbfbff'; g.beginPath(); g.ellipse(x, y, 1.8, 1.2, 0, 0, 7); g.fill(); g.fillStyle = '#1a121c'; g.beginPath(); g.arc(x + 1.0, y, 0.8, 0, 7); g.fill(); break;
        case 'heart': g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(x - 0.7, y - 0.4, 0.9, 0, 7); g.arc(x + 0.7, y - 0.4, 0.9, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x, y + 1.8); g.lineTo(x + 1.6, y); g.fill(); break;
        case 'tired': g.beginPath(); g.arc(x, y + 0.3, 0.95, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 1.7, y - 0.8); g.lineTo(x + 1.7, y - 0.5); g.stroke(); g.strokeStyle = 'rgba(80,40,90,0.55)'; g.beginPath(); g.arc(x, y + 1.3, 1.5, 0.2, Math.PI - 0.2); g.stroke(); break;
        default: g.beginPath(); g.ellipse(x, y, 1.0, 1.25, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x + 0.35, y - 0.45, 0.32, 0, 7); g.fill();
      }
    }
    g.strokeStyle = '#1a121c';
    if (brow) {
      g.lineWidth = 0.85; g.beginPath();
      if (brow === 'angry') { g.moveTo(-ex - 1.9, ey - 3.0); g.lineTo(-ex + 1.5, ey - 1.9); g.moveTo(ex + 1.9, ey - 3.0); g.lineTo(ex - 1.5, ey - 1.9); }
      else if (brow === 'worried') { g.moveTo(-ex - 1.7, ey - 2.1); g.lineTo(-ex + 1.5, ey - 3.1); g.moveTo(ex + 1.7, ey - 2.1); g.lineTo(ex - 1.5, ey - 3.1); }
      else if (brow === 'up') { g.moveTo(-ex - 1.5, ey - 3.6); g.lineTo(-ex + 1.5, ey - 3.6); g.moveTo(ex - 1.5, ey - 3.6); g.lineTo(ex + 1.5, ey - 3.6); }
      else if (brow === 'confused') { g.moveTo(-ex - 1.5, ey - 2.5); g.lineTo(-ex + 1.5, ey - 2.5); g.moveTo(ex - 1.5, ey - 3.7); g.lineTo(ex + 1.5, ey - 3.0); }
      else { g.moveTo(-ex - 1.5, ey - 2.5); g.lineTo(-ex + 1.5, ey - 2.5); g.moveTo(ex - 1.5, ey - 2.5); g.lineTo(ex + 1.5, ey - 2.5); }
      g.stroke(); g.lineWidth = 0.75;
    }
    const my = 3.0;
    g.beginPath();
    switch (mouth) {
      case 'smile': g.arc(0, my - 1.4, 2.3, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
      case 'open': g.fillStyle = '#5a1422'; g.arc(0, my - 0.5, 2.2, 0, Math.PI); g.fill(); break;
      case 'wobbly': g.moveTo(-2.3, my); g.quadraticCurveTo(-0.8, my + 1.5, 0, my + 0.2); g.quadraticCurveTo(1, my - 1, 2.5, my + 0.8); g.stroke(); break;
      case 'frown': g.arc(0, my + 1.6, 2.1, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
      case 'shout': g.fillStyle = '#5a1422'; g.ellipse(0, my, 2.1, 1.9, 0, 0, 7); g.fill(); break;
      case 'shoutBig': g.fillStyle = '#5a1422'; g.ellipse(0, my + 0.2, 2.3, 2.5, 0, 0, 7); g.fill(); break;
      case 'o': g.fillStyle = '#5a1422'; g.arc(0, my, 1.0, 0, 7); g.fill(); break;
      case 'O': g.fillStyle = '#5a1422'; g.ellipse(0, my, 1.6, 2.2, 0, 0, 7); g.fill(); break;
      case 'wail': g.fillStyle = '#5a1422'; g.ellipse(0, my + 0.2, 2.7, 1.7, 0, 0, 7); g.fill(); break;
      case 'wavy': g.moveTo(-2.3, my); g.lineTo(-1.1, my - 0.8); g.lineTo(0, my); g.lineTo(1.1, my - 0.8); g.lineTo(2.3, my); g.stroke(); break;
      case 'smirk': g.moveTo(-1.9, my); g.quadraticCurveTo(1, my + 0.6, 2.5, my - 1.3); g.stroke(); break;
      case 'puff': g.fillStyle = 'rgba(130,210,100,0.95)'; g.ellipse(0, my, 2.9, 1.6, 0, 0, 7); g.fill(); break;
      case 'pucker': g.fillStyle = '#c0304a'; g.ellipse(0, my, 1.0, 0.8, 0, 0, 7); g.fill(); break;
      case 'line': g.moveTo(-1.7, my); g.lineTo(1.7, my); g.stroke(); break;
      default: g.moveTo(-1.6, my); g.lineTo(1.6, my); g.stroke();
    }
    if (e === 'cry') { g.fillStyle = '#6fc4ff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * ex, ey + 2.5, 0.6, 1.2, 0, 0, 7); g.ellipse(s * ex + s * 0.3, ey + 4.8, 0.5, 1.0, 0, 0, 7); g.fill(); } }
    if (e === 'furious') { g.strokeStyle = '#ff2a2a'; g.lineWidth = 0.8; const vx = 4.2, vy = -5.2; g.beginPath(); g.moveTo(vx - 1.4, vy); g.lineTo(vx - 0.3, vy); g.lineTo(vx - 0.3, vy - 1.3); g.moveTo(vx + 1.4, vy); g.lineTo(vx + 0.3, vy); g.lineTo(vx + 0.3, vy + 1.3); g.stroke(); }
  }
  // printed tops: 0 plain, 1 SECURITY, 2 stripes, 3 hawaiian, 4 sequins, 5 jersey, 6 shirt, 7 suit, 8 hoodie, 9 POLICE, 10 STAFF, 11 chef, 12 VIP gold, 13 bride
  const PRINT = { security: 1, stripes: 2, hawaiian: 3, sequin: 4, jersey: 5, shirt: 6, suit: 7, hoodie: 8, police: 9, staff: 10, chef: 11, gold: 12, bride: 13 };
  function printAtlas() {
    return R3.canvasTex(1024, 1024, (g) => {
      const cell = (i, fn) => { g.save(); g.translate((i % 4) * 256, Math.floor(i / 4) * 256); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); fn(g); g.restore(); };
      // u: 0 = front (+z), 0.5 = back; v: 0 = waist (bottom of the cell), 1 = neck
      const back = (text, col, size) => { g.fillStyle = col; g.font = '900 ' + size + 'px "Big Shoulders Display", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 78); };
      cell(1, () => back('SECURITY', '#ffd23f', 21));
      cell(2, () => { g.fillStyle = 'rgba(255,255,255,0.9)'; for (let y = 10; y < 256; y += 40) g.fillRect(0, y, 256, 14); });
      cell(3, () => { for (let k = 0; k < 40; k++) { g.fillStyle = ['#ffe14a', '#ff5a8a', '#4af0c8'][k % 3]; g.beginPath(); g.arc(U.hash(k, 1) * 256, U.hash(k, 2) * 256, 9, 0, 7); g.fill(); g.fillStyle = 'rgba(40,120,60,0.8)'; g.beginPath(); g.ellipse(U.hash(k, 3) * 256, U.hash(k, 4) * 256, 14, 5, k, 0, 7); g.fill(); } });
      cell(4, () => { for (let k = 0; k < 220; k++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + U.hash(k, 5) * 0.6).toFixed(2) + ')'; g.fillRect(U.hash(k, 6) * 256, U.hash(k, 7) * 256, 4, 4); } });
      cell(5, () => { g.fillStyle = '#fff'; g.fillRect(0, 150, 256, 16); g.font = '900 70px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('9', 128, 110); g.fillText('9', 0, 110); g.fillText('9', 256, 110); });
      cell(6, () => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 24, 256); g.fillRect(232, 0, 24, 256); for (let y = 30; y < 256; y += 40) { g.fillStyle = '#ddd'; g.beginPath(); g.arc(12, y, 5, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 256); g.lineTo(40, 206); g.lineTo(0, 196); g.fill(); g.beginPath(); g.moveTo(256, 256); g.lineTo(216, 206); g.lineTo(256, 196); g.fill(); });
      cell(7, () => { g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(-20, 256); g.lineTo(0, 110); g.lineTo(20, 256); g.fill(); g.beginPath(); g.moveTo(236, 256); g.lineTo(256, 110); g.lineTo(276, 256); g.fill(); g.fillStyle = '#b3123a'; g.fillRect(-6, 150, 12, 100); g.fillRect(250, 150, 12, 100); });
      cell(8, () => { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-40, 20, 80, 60); g.fillRect(216, 20, 80, 60); g.strokeStyle = '#eee'; g.lineWidth = 5; g.beginPath(); g.moveTo(-14, 256); g.lineTo(-14, 190); g.moveTo(14, 256); g.lineTo(14, 190); g.stroke(); g.beginPath(); g.moveTo(242, 256); g.lineTo(242, 190); g.moveTo(270, 256); g.lineTo(270, 190); g.stroke(); });
      cell(9, () => { g.fillStyle = '#d8e8f0'; g.fillRect(0, 40, 256, 14); g.fillRect(0, 118, 256, 14); back('POLICE', '#12161e', 26); });
      cell(10, () => back('STAFF', '#ffffff', 26));
      cell(11, () => { g.fillStyle = '#222'; for (let y = 40; y < 240; y += 45) { g.beginPath(); g.arc(-10, y, 6, 0, 7); g.arc(20, y, 6, 0, 7); g.arc(246, y, 6, 0, 7); g.arc(276, y, 6, 0, 7); g.fill(); } });
      cell(12, () => { g.strokeStyle = '#ffd24a'; g.lineWidth = 6; g.beginPath(); g.arc(0, 256, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(256, 256, 70, 0, Math.PI * 2); g.stroke(); });
      cell(13, () => { g.fillStyle = '#fff'; g.font = '900 30px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.fillText('BRIDE', 128, 60); g.fillText('TO BE', 128, 100); });
    });
  }

  /* ================= instanced parts ================= */
  const parts = {};
  let charMat, faceMat, printMat, shadowMat, glowMat, glassMat;
  let root;
  function part(name, geo, mat, max, o) {
    const m = R3.inst(geo, mat, max, o);
    m.name = 'p_' + name;
    parts[name] = m;
    root.add(m);
    return m;
  }
  P3.build = (scene) => {
    root = new THREE.Group();
    root.name = 'people';
    scene.add(root);
    buildGeometry();
    charMat = R3.litMat({ inst: true });
    const fa = faceAtlas();
    faceMat = R3.basicMat({ map: fa, alphaTest: 0.3, cell: 8 });
    P3.faceTex = fa;
    const pa = printAtlas();
    P3.printTex = pa;
    printMat = R3.litMat({ inst: true, atlas: 4, atlasTex: pa });
    shadowMat = R3.basicMat({ map: R3.glowTex(), transparent: true, color: 0x000000, opacity: 0.6, depthWrite: false, polygonOffset: 2 });
    glowMat = R3.basicMat({ });
    glassMat = R3.litMat({ inst: true, transparent: true, opacity: 0.55 });
    const N = MAXC, N2 = MAXC * 2;
    part('shadow', GEO.shadow, shadowMat, N, { lit: false, order: 1 });
    part('torso', GEO.torso, printMat, N, { cell: true });
    part('pelvis', GEO.pelvis, charMat, N);
    part('head', GEO.head, charMat, N);
    part('face', GEO.face, faceMat, N, { lit: false, cell: true });
    part('neck', GEO.neck, charMat, N);
    part('uarm', GEO.uarm, charMat, N2);
    part('farm', GEO.farm, charMat, N2);
    part('hand', GEO.hand, charMat, N2);
    part('thigh', GEO.thigh, charMat, N2);
    part('shin', GEO.shin, charMat, N2);
    part('foot', GEO.foot, charMat, N2);
    part('skirt', GEO.skirt, charMat, N);
    part('dress', GEO.dress, charMat, N);
    for (const k in GEO.hair) part('hair_' + k, GEO.hair[k], charMat, N);
    for (const k in GEO.beard) part('beard_' + k, GEO.beard[k], charMat, N);
    for (const k in GEO.hat) part('hat_' + k, GEO.hat[k], k === 'halo' ? glowMat : charMat, 80, k === 'halo' ? { lit: false } : undefined);
    for (const k in GEO.glasses) part('gl_' + k, GEO.glasses[k], charMat, 80);
    part('it_glass', GEO.item.glass, glassMat, N);
    part('it_liquid', GEO.item.glass, charMat, N);
    for (const k of ['bottle', 'phone', 'cig', 'mop', 'broom', 'torch', 'water', 'box', 'sign']) part('it_' + k, GEO.item[k], charMat, k === 'phone' ? N : 60);
    part('it_screen', GEO.item.screen, glowMat, N, { lit: false });
    part('it_ember', GEO.item.ember, glowMat, 80, { lit: false });
    part('bag', GEO.bag, charMat, N);
    part('sash', GEO.sash, charMat, 60);
    part('band', GEO.band, glowMat, N2, { lit: false });
    part('chain', GEO.chain, charMat, N);
    P3.parts = parts;
  };

  /* ================= poses ================= */
  // joint state, reused
  const J = {
    rootY: 0, lie: 0, lieYaw: 0, leanX: 0, leanZ: 0, bob: 0, hipY: 0, hipR: 0, spP: 0, spR: 0, spY: 0, hdY: 0, hdP: 0, hdR: 0,
    shP: [0, 0], shA: [0, 0], shT: [0, 0], el: [0, 0], hpP: [0, 0], hpA: [0, 0], kn: [0, 0], ft: [0, 0], sit: false,
  };
  const L = 0, Rr = 1;
  function resetJ() {
    J.rootY = 0; J.lie = 0; J.lieYaw = 0; J.leanX = 0; J.leanZ = 0; J.bob = 0; J.hipY = 0; J.hipR = 0; J.spP = 0; J.spR = 0; J.spY = 0; J.hdY = 0; J.hdP = 0; J.hdR = 0; J.sit = false;
    for (let s = 0; s < 2; s++) { J.shP[s] = 0.05; J.shA[s] = 0.1; J.shT[s] = 0; J.el[s] = 0.15; J.hpP[s] = 0; J.hpA[s] = 0.02; J.kn[s] = 0.04; J.ft[s] = 0; }
  }
  function arm(s, p, a, e, t = 0) { J.shP[s] = p; J.shA[s] = a; J.el[s] = e; J.shT[s] = t; }
  function leg(s, p, k, a = 0.02) { J.hpP[s] = p; J.kn[s] = k; J.hpA[s] = a; }
  const HIP = 0.9;       // standing hip height (m), before height scaling
  function poseOf(c, t) {
    resetJ();
    const pose = c.pose || 'stand';
    const sw = c.walk || 0, beat = c.beat || 0, hf = (c.look && c.look.height) || 1;
    const drunk = c.drunk || 0;
    switch (pose) {
      case 'walk': case 'run': {
        const k = pose === 'run' ? 1.55 : 1, s1 = Math.sin(sw);
        leg(L, s1 * 0.48 * k, Math.max(0, -s1) * 0.75 * k + 0.08); leg(Rr, -s1 * 0.48 * k, Math.max(0, s1) * 0.75 * k + 0.08);
        J.ft[L] = Math.max(0, s1) * 0.3; J.ft[Rr] = Math.max(0, -s1) * 0.3;
        arm(L, -s1 * 0.42 * k, 0.1, 0.25 + (k > 1 ? 1.1 : 0.1)); arm(Rr, s1 * 0.42 * k, 0.1, 0.25 + (k > 1 ? 1.1 : 0.1));
        J.bob = Math.abs(s1) * 0.035 * k; J.spY = s1 * 0.08; J.leanX = k > 1 ? 0.14 : 0.03;
        break;
      }
      case 'dance': {
        const st = c.danceStyle || 0, b = Math.sin(beat * Math.PI * 2), b2 = Math.abs(Math.sin(beat * Math.PI)), en = 0.5 + (c.energy || 0.6);
        J.bob = -b2 * 0.07 * en; leg(L, 0.18 * b2, 0.35 * b2 + 0.1, 0.06); leg(Rr, 0.18 * b2, 0.35 * b2 + 0.1, 0.06);
        J.hipR = b * 0.06; J.leanZ = b * 0.04 * en; J.hdP = -0.1 + b2 * 0.15;
        if (st === 0) { arm(L, 2.6 + b2 * 0.3, 0.45, 0.4 + b2 * 0.5); arm(Rr, 2.6 + b2 * 0.3, 0.45, 0.4 + b2 * 0.5); }
        else if (st === 1) { arm(L, 0.3, 0.15, 1.2); arm(Rr, 2.5 + b * 0.35, 0.25, 0.25 + b2 * 0.5); J.spR = -0.08; }
        else if (st === 2) { arm(L, 0.7, 0.3 + b * 0.2, 1.5); arm(Rr, 0.7, 0.3 - b * 0.2, 1.5); J.hipR = b * 0.14; J.spR = -b * 0.1; J.spY = b * 0.2; }
        else if (st === 3) { const q = b > 0 ? 1 : 0; arm(L, q ? 1.57 : 0.2, 0.2, 1.57); arm(Rr, q ? 0.2 : 1.57, 0.2, 1.57); J.hdY = q ? 0.4 : -0.4; J.spY = q ? 0.15 : -0.15; }
        else if (st === 4) { arm(L, 2.6, 0.7, 2.3); arm(Rr, 1.2, 1.35, 0.1, b * 0.5); J.spY = b * 0.35; }
        else { arm(L, 1.4 + Math.sin(t * 9) * 1.1, 0.4 + Math.cos(t * 7) * 0.4, 0.6 + Math.sin(t * 8) * 0.5); arm(Rr, 1.4 + Math.cos(t * 8) * 1.1, 0.4 + Math.sin(t * 10) * 0.4, 0.6 + Math.cos(t * 9) * 0.5); J.hdR = Math.sin(t * 6) * 0.2; }
        break;
      }
      case 'sit': {
        J.sit = true;
        const pel = Math.max(0.28, (c.z || 0) * ZS + 0.1);
        J.hipY = pel - HIP * hf;
        const kneeH = pel - 0.03;
        const shin = 0.43 * hf;
        const hp = 1.45;
        const k = hp - Math.acos(U.clamp(kneeH / shin, 0, 1));
        leg(L, hp, Math.max(0.2, k), 0.12); leg(Rr, hp, Math.max(0.2, k), 0.12);
        arm(L, 0.55, 0.12, 0.9); arm(Rr, 0.55, 0.12, 0.9);
        J.spP = -0.08;
        break;
      }
      case 'lie': case 'fallen': case 'sleepFloor': {
        J.lie = c.fallK === undefined ? 1 : c.fallK;
        J.lieYaw = (c.fallSide || 1) * 0.5;
        arm(L, 0.3, 0.6, 0.4); arm(Rr, 0.6, 0.4, 0.6);
        leg(L, 0.2, 0.4, 0.1); leg(Rr, 0.05, 0.1, 0.12);
        J.hdR = 0.3 * (c.fallSide || 1);
        break;
      }
      case 'climb': arm(L, 2.9, 0.25, 0.3 + Math.max(0, Math.sin(t * 5)) * 0.8); arm(Rr, 2.9, 0.25, 0.3 + Math.max(0, -Math.sin(t * 5)) * 0.8); leg(L, 0.6 + Math.sin(t * 5) * 0.4, 1.0, 0.1); leg(Rr, 0.6 - Math.sin(t * 5) * 0.4, 1.0, 0.1); break;
      case 'hang': arm(L, 3.05, 0.22, 0.05); arm(Rr, 3.05, 0.22, 0.05); leg(L, Math.sin(t * 2.2) * 0.35, 0.25, 0.1); leg(Rr, Math.sin(t * 2.2 + 0.4) * 0.35, 0.3, 0.1); J.hdP = -0.2; break;
      case 'dragged': J.leanX = -0.32; arm(Rr, 1.5, 0.1, 0.1); arm(L, 1.0 + Math.sin(t * 14) * 0.8, 0.5 + Math.cos(t * 12) * 0.4, 0.5); leg(L, -0.15, 0.1); leg(Rr, 0.25, 0.3); J.ft[L] = -0.4; J.hdP = -0.25; break;
      case 'grab': arm(L, 1.25, 0.05, 0.35); arm(Rr, 1.25, 0.05, 0.35); J.spP = 0.12; J.leanX = 0.05; break;
      case 'hold': arm(L, 1.1, 0.08, 0.5); arm(Rr, 1.2, 0.08, 0.4); J.spP = 0.08; J.leanX = -0.06; break;
      case 'fight': {
        const p = c.punch || 0, sd = c.punchSide ? L : Rr, other = sd === L ? Rr : L;
        arm(other, 1.25, 0.25, 2.0); arm(sd, 1.25 + p * 0.3, 0.2, 2.0 - p * 1.9);
        J.spY = (sd === Rr ? -1 : 1) * p * 0.35; J.leanX = 0.1 + p * 0.1;
        leg(L, 0.25, 0.3, 0.12); leg(Rr, -0.15, 0.25, 0.12);
        J.bob = -Math.abs(Math.sin(t * 8)) * 0.03;
        break;
      }
      case 'vomit': J.spP = 0.95; J.hdP = 0.35; arm(L, 0.8, 0.1, 0.2); arm(Rr, 0.8, 0.1, 0.2); leg(L, 0.35, 0.45, 0.12); leg(Rr, 0.35, 0.45, 0.12); J.hipY = -0.08; break;
      case 'cry': arm(L, 2.35, -0.35, 2.4); arm(Rr, 2.35, -0.35, 2.4); J.hdP = 0.35; J.spP = 0.2 + Math.sin(t * 9) * 0.03; if (c.crouchCry) { leg(L, 1.1, 1.8, 0.2); leg(Rr, 1.1, 1.8, 0.2); J.hipY = -0.42; } break;
      case 'polite': arm(L, 0.55, -0.35, 1.2); arm(Rr, 0.55, -0.35, 1.2); J.hdP = 0.1; break;
      case 'restrained': arm(L, -0.45, -0.25, 0.8); arm(Rr, -0.45, -0.25, 0.8); J.spP = 0.12; J.hdP = 0.2; break;
      case 'phone': arm(Rr, c.filming ? 1.65 : 1.05, 0.05, c.filming ? 0.4 : 1.7); arm(L, 0.2, 0.1, 0.4); J.hdP = c.filming ? 0 : 0.35; break;
      case 'drink': { const up = c.sip > 0; arm(Rr, up ? 1.25 : 0.55, 0.05, up ? 2.35 : 1.55); J.hdP = up ? -0.25 : 0; break; }
      case 'smoke': { const up = Math.sin(t * 0.8) > 0.6; arm(Rr, up ? 1.3 : 0.5, 0.05, up ? 2.4 : 1.4); break; }
      case 'argue': { const k = Math.sin(t * 7); arm(L, 0.8 + k * 0.5, 0.35, 1.0); arm(Rr, 1.1 - k * 0.6, 0.3, 0.7); J.leanX = 0.12; J.hdP = -0.05 + k * 0.05; J.spY = k * 0.12; break; }
      case 'wave': arm(Rr, 2.9, 0.55, 0.3, Math.sin(t * 12) * 0.5); break;
      case 'crossed': arm(L, 0.95, -0.55, 1.95); arm(Rr, 0.95, -0.55, 1.95); J.spP = -0.04; break;
      case 'mop': case 'broom': { const k = Math.sin(t * 6); arm(L, 0.75, -0.1, 0.8); arm(Rr, 0.95, -0.05, 0.5); J.spP = 0.25; J.spY = k * 0.25; J.leanX = 0.05; break; }
      case 'carry': arm(L, 1.15, 0.05, 1.0); arm(Rr, 1.15, 0.05, 1.0); J.leanX = -0.05; break;
      case 'carryUp': arm(L, 2.8, 0.25, 0.5); arm(Rr, 2.8, 0.25, 0.5); break;
      case 'crouch': leg(L, 1.5, 2.1, 0.2); leg(Rr, 1.5, 2.1, 0.2); J.hipY = -0.5; J.spP = 0.35; arm(L, 0.9, 0.1, 0.8); arm(Rr, 0.9, 0.1, 0.8); break;
      case 'shrug': arm(L, 0.35, 0.55, 1.5); arm(Rr, 0.35, 0.55, 1.5); J.hdR = 0.15; break;
      case 'point': arm(Rr, 1.5, 0.1, 0.05); J.spY = U.clamp(U.angDiff(c.face || 0, c.pointAng || 0), -0.8, 0.8) * -0.6; break;
      case 'kiss': case 'hug': arm(L, 1.3, 0.25, 1.45); arm(Rr, 1.3, 0.25, 1.45); J.leanX = 0.14; J.hdP = 0.12; J.hdR = pose === 'kiss' ? 0.28 : 0; break;
      default: {
        const br = Math.sin(t * 1.7) * 0.02;
        arm(L, 0.05 + br, 0.12, 0.15); arm(Rr, 0.05 - br, 0.12, 0.15);
        if (c.drink && c.kind !== 'player') arm(Rr, 0.5, 0.05, 1.5);
        if (c.phoneUp) arm(Rr, 1.05, 0.05, 1.7);
      }
    }
    // held phone / drink / smoke override the right arm when idle-ish
    if ((pose === 'walk' || pose === 'stand' || pose === 'dance' && c.danceStyle !== 0 && c.danceStyle !== 4) && c.phoneUp) arm(Rr, 1.05, 0.05, 1.7);
    // drunks sway
    if (drunk > 0.45 && !J.lie) { J.leanZ += Math.sin(t * 1.9 + (c.seed || 0)) * 0.07 * drunk; J.hdR += Math.sin(t * 1.3 + (c.seed || 0)) * 0.12 * drunk; J.leanX += Math.sin(t * 1.1) * 0.03 * drunk; }
    if (c.lean) J.leanZ += c.lean;
    if (pose === 'hang') J.rootY = (M.truss.z * ZS) - 2.12 * hf;
    else if (pose === 'climb') J.rootY = Math.min((c.z || 0) * ZS * 0.9, M.truss.z * ZS - 2.12 * hf);
    else if (!J.sit && !J.lie) J.rootY = (c.z || 0) * ZS;
    else if (J.lie) J.rootY = (c.z || 0) * ZS;
  }

  /* ================= per-character build ================= */
  const mR = mk(), mP = mk(), mC = mk(), mH = mk(), mS = mk(), mE = mk(), mHp = mk(), mK = mk(), mO = mk(), mHd = [mk(), mk()], mHead2 = mk();
  const white = C('#ffffff');
  const tmpC = new THREE.Color();
  const lk3 = new WeakMap();
  const SLEEVE_BARE = { tank: 1, dress: 1, crop: 1 };
  const LONG_SLEEVE = { jacket: 1, hoodie: 1, suit: 1, shirt: 1, blouse: 1, jersey: 0, sequin: 1 };
  // cache linear colours per look
  function lookCols(c) {
    const lk = c.look;
    let e = lk3.get(lk);
    if (!e || e.v !== lk.topC + lk.skin + lk.hairC + lk.botC) {
      const skin = C(lk.skin), top = C(lk.topC), bot = C(lk.botC || '#222'), hair = C(lk.hairC || '#222'), shoe = C(lk.shoes || '#111');
      const bare = SLEEVE_BARE[lk.top], legsBare = lk.bot === 'none' || lk.bot === 'skirt';
      e = {
        v: lk.topC + lk.skin + lk.hairC + lk.botC, skin, top, bot, hair, shoe,
        uarm: bare ? skin : top, farm: LONG_SLEEVE[lk.top] ? top : skin,
        thigh: legsBare ? skin : bot, shin: legsBare || lk.bot === 'shorts' ? skin : bot,
        pelvis: lk.bot === 'none' ? top : lk.bot === 'skirt' ? bot : bot,
        stubble: skin.clone().lerp(hair, 0.35),
        sash: C(lk.sashC || '#f4f4f4'), top2: C(lk.topC2 || lk.topC),
      };
      lk3.set(lk, e);
    }
    return e;
  }
  function printOf(c) {
    const lk = c.look;
    if (c.police) return PRINT.police;
    if (c.security || c.kind === 'player') return PRINT.security;
    if (c.kind === 'staff') return c.chef ? PRINT.chef : PRINT.staff;
    if (lk.sash && /bride/i.test(lk.sash)) return PRINT.bride;
    return PRINT[lk.top] || 0;
  }
  // write one instance
  const ambV = new THREE.Vector3();
  let glowR = 0, glowG = 0, glowB = 0, ambR = 1, ambG = 1, ambB = 1;
  function put(name, m, col, cell) {
    const mesh = parts[name];
    const i = mesh.count;
    if (i >= mesh.userData.max) return;
    mesh.instanceMatrix.array.set(m, i * 16);
    const ca = mesh.instanceColor.array;
    ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b;
    const a = mesh.geometry.attributes;
    if (a.aAmb) { const aa = a.aAmb.array; aa[i * 3] = ambR; aa[i * 3 + 1] = ambG; aa[i * 3 + 2] = ambB; const ga = a.aGlow.array; ga[i * 3] = glowR; ga[i * 3 + 1] = glowG; ga[i * 3 + 2] = glowB; }
    if (a.aCell && cell !== undefined) a.aCell.array[i] = cell;
    mesh.count = i + 1;
  }
  const wv = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sphere = new THREE.Sphere();
  P3.glowFor = null;   // set by gameplay (aura vision)

  function buildChar(c, G, t) {
    const lk = c.look;
    if (!lk) return;
    const cols = lookCols(c);
    R3.toW(c.x, c.y, 0, wv);
    poseOf(c, t);
    const hf = lk.height || 1, bf = lk.build || 1;
    const amb = R3.ambAt(c.x, c.y);
    ambR = amb.x; ambG = amb.y; ambB = amb.z;
    // glow: aura vision, or a soft rim on whoever you're looking at
    glowR = glowG = glowB = 0;
    if (P3.glowFor) { const g = P3.glowFor(c); if (g) { glowR = g[0]; glowG = g[1]; glowB = g[2]; } }
    // root
    ident(mR);
    tr(mR, wv.x, wv.y + J.rootY, wv.z);
    ry(mR, Math.PI / 2 - (c.face || 0) + J.lieYaw * J.lie);
    if (J.lie > 0) { tr(mR, 0, 0.13 * J.lie, 0.85 * J.lie * hf); rx(mR, -Math.PI / 2 * J.lie); }
    rx(mR, J.leanX); rz(mR, J.leanZ);
    // shadow
    cp(mO, mR);
    ident(mO); tr(mO, wv.x, wv.y + 0.012, wv.z);
    const sh = J.lie > 0.5 ? 1.5 : 0.75;
    ry(mO, Math.PI / 2 - (c.face || 0)); sc(mO, 0.62 * bf, 1, sh);
    put('shadow', mO, white);
    // pelvis
    cp(mP, mR); tr(mP, 0, HIP * hf + J.hipY + J.bob, 0); rz(mP, J.hipR);
    cp(mO, mP); sc(mO, bf, hf, bf); put('pelvis', mO, cols.pelvis);
    // torso
    cp(mC, mP); rx(mC, J.spP); rz(mC, J.spR); ry(mC, J.spY);
    cp(mO, mC); sc(mO, bf, hf * 0.98, bf); put('torso', mO, cols.top, printOf(c));
    const tH = 0.555 * hf * 0.98;
    // skirts
    if (lk.top === 'dress' || lk.bot === 'none') { cp(mO, mP); tr(mO, 0, 0.02, 0); sc(mO, bf, hf, bf); put('dress', mO, cols.top); }
    else if (lk.bot === 'skirt') { cp(mO, mP); tr(mO, 0, 0.02, 0); sc(mO, bf, hf, bf); put('skirt', mO, cols.bot); }
    // neck + head
    cp(mO, mC); tr(mO, 0, tH, 0.005); put('neck', mO, cols.skin);
    cp(mH, mC); tr(mH, 0, tH + 0.1, 0.01); ry(mH, J.hdY); rx(mH, J.hdP); rz(mH, J.hdR);
    cp(mO, mH); tr(mO, 0, HEAD_R * 1.05, 0);
    let skin = cols.skin;
    if (c.expr === 'sick') { tmpC.copy(skin).lerp(C('#8fcf6a'), 0.45); skin = tmpC; }
    else if (c.expr === 'furious') { tmpC.copy(skin).lerp(C('#ff4a3a'), 0.25); skin = tmpC; }
    put('head', mO, skin);
    const headM = cp(mHead2, mO);
    // face cell
    let e = c.expr || 'neutral';
    if (e === 'neutral' && (c.drunk || 0) > 0.72) e = 'drunk';
    if (e === 'talk') e = Math.sin(t * 16) > 0 ? 'talk' : 'talk2';
    if (e === 'shout') e = Math.sin(t * 14) > 0 ? 'shout' : 'shout2';
    let ei = EI[e]; if (ei === undefined) ei = 0;
    const fk = Math.min(1, Math.max(0.12, (ambR + ambG + ambB) / 3 * 0.9));
    tmpC.setRGB(fk, fk, fk);
    put('face', headM, tmpC, ei * 2 + (c.blink ? 1 : 0));
    // hair / beard / hat / glasses
    const hat = c.hatOverride || lk.hat || (c.headphones ? 'headphones' : c.police ? 'police' : null);
    const hairStyle = lk.hair;
    if (hairStyle && hairStyle !== 'bald' && parts['hair_' + hairStyle] && !(hat === 'cap' || hat === 'beanie' || hat === 'police') || (hat && hairStyle === 'long')) {
      const hs = hat && (hat === 'cap' || hat === 'beanie' || hat === 'police') ? 'long' : hairStyle;
      if (parts['hair_' + hs]) put('hair_' + hs, headM, cols.hair);
    }
    if (lk.beard && parts['beard_' + lk.beard]) put('beard_' + lk.beard, headM, lk.beard === 'stubble' ? cols.stubble : cols.hair);
    if (hat && parts['hat_' + hat]) {
      let hc = cols.top2;
      if (hat === 'cone') hc = C('#ff6a1a'); else if (hat === 'sign') hc = C('#ffd21f'); else if (hat === 'party') hc = C('#ff4fa8'); else if (hat === 'crown') hc = C('#ffcf3a');
      else if (hat === 'veil') hc = C('#f4f4f4'); else if (hat === 'cowboy') hc = C('#7a4f2a'); else if (hat === 'sombrero') hc = C('#e8c35a'); else if (hat === 'halo') hc = C('#fff3a0').clone().multiplyScalar(2.5);
      else if (hat === 'bucket') hc = C('#7ab0d8'); else if (hat === 'headphones') hc = C('#1a1a1e'); else if (hat === 'police') hc = C('#12161e');
      put('hat_' + hat, headM, hc);
    }
    if (lk.glasses && parts['gl_' + lk.glasses]) put('gl_' + lk.glasses, headM, C(lk.glasses === 'sun' ? '#0a0a0e' : '#1a1a1a'));
    if (lk.chain) { cp(mO, mC); tr(mO, 0, tH - 0.03, 0.05); rx(mO, -1.2); put('chain', mO, C('#e6c350')); }
    if (lk.sash) { cp(mO, mC); tr(mO, 0, tH * 0.55, 0.08); rz(mO, 0.62); put('sash', mO, cols.sash); cp(mO, mC); tr(mO, 0, tH * 0.55, -0.08); rz(mO, -0.62); put('sash', mO, cols.sash); }
    if (lk.bag) { cp(mO, mP); tr(mO, 0.17 * bf, 0.0, 0.03); put('bag', mO, C('#7a3a2a')); }
    // arms
    const shX = 0.172 * bf;
    for (let s = 0; s < 2; s++) {
      const sg = s === L ? 1 : -1;
      cp(mS, mC); tr(mS, sg * shX, tH - 0.075, 0); rz(mS, sg * J.shA[s]); rx(mS, -J.shP[s]); ry(mS, J.shT[s] * sg);
      cp(mO, mS); sc(mO, bf, hf, bf); put('uarm', mO, cols.uarm);
      cp(mE, mS); tr(mE, 0, -0.28 * hf, 0); rx(mE, -J.el[s]);
      cp(mO, mE); sc(mO, bf, hf, bf); put('farm', mO, cols.farm);
      const hm = mHd[s];
      cp(hm, mE); tr(hm, 0, -0.25 * hf - 0.035, 0);
      put('hand', hm, cols.skin);
      if (lk.glow) { cp(mO, mE); tr(mO, 0, -0.21 * hf, 0); rx(mO, Math.PI / 2); put('band', mO, s === L ? C('#6bffb0').clone().multiplyScalar(2.2) : C('#ff5ad8').clone().multiplyScalar(2.2)); }
    }
    // hand positions (world) for carried props
    if (!c._h3) c._h3 = [0, 0, 0];
    c._h3[0] = (mHd[0][12] + mHd[1][12]) / 2; c._h3[1] = (mHd[0][13] + mHd[1][13]) / 2; c._h3[2] = (mHd[0][14] + mHd[1][14]) / 2;
    // held things (right hand)
    const hr = mHd[Rr];
    if (c.drink && !c.phoneUp) {
      put('it_glass', hr, C('#dcebff'));
      const lvl = U.clamp(c.drink.fill === undefined ? 1 : c.drink.fill, 0.05, 1);
      cp(mO, hr); tr(mO, 0, -0.02 - 0.05 * (1 - lvl), 0.05); sc(mO, 0.85, lvl * 0.95, 0.85); tr(mO, 0, 0, -0.05);
      put('it_liquid', mO, C(c.drink.c || [230, 170, 60]));
    }
    if (c.phoneUp) {
      cp(mO, hr); rx(mO, c.filming ? -1.2 : -0.6);
      put('it_phone', mO, C('#111'));
      put('it_screen', mO, c.filming ? C('#fff6d8').clone().multiplyScalar(1.8) : C('#6ab4ff').clone().multiplyScalar(1.6));
    }
    if (c.smoking) { cp(mO, hr); put('it_cig', mO, C('#eeeeee')); put('it_ember', mO, C('#ff7a2a').clone().multiplyScalar(3)); }
    if (c.bottle) { cp(mO, hr); rx(mO, 0.3); put('it_bottle', mO, C('#1f5a34')); }
    const tool = c.heldTool;
    if (tool === 'mop' || tool === 'broom') { cp(mO, hr); rx(mO, 0.35); put('it_' + tool, mO, C(tool === 'mop' ? '#d8d8cc' : '#e0b85a')); }
    else if (tool === 'water') { cp(mO, hr); put('it_water', mO, C('#9fd4ff')); }
    else if (tool === 'aid' || tool === 'breath' || tool === 'zip') { cp(mO, hr); put('it_box', mO, C(tool === 'aid' ? '#2a9a4a' : tool === 'breath' ? '#2a2a30' : '#111')); }
    else if (tool === 'sign') { cp(mO, hr); put('it_sign', mO, C('#ffd21f')); }
    if (c.kind === 'player' && c.flash) { cp(mO, hr); rx(mO, 1.2); put('it_torch', mO, C('#2a2a30')); }
    // legs
    const hipX = 0.088 * bf;
    for (let s = 0; s < 2; s++) {
      const sg = s === L ? 1 : -1;
      cp(mHp, mP); tr(mHp, sg * hipX, -0.04, 0); rz(mHp, sg * J.hpA[s]); rx(mHp, -J.hpP[s]);
      cp(mO, mHp); sc(mO, bf, hf, bf); put('thigh', mO, cols.thigh);
      cp(mK, mHp); tr(mK, 0, -0.43 * hf, 0); rx(mK, J.kn[s]);
      cp(mO, mK); sc(mO, bf, hf, bf); put('shin', mO, cols.shin);
      cp(mO, mK); tr(mO, 0, -0.43 * hf - 0.035, 0); rx(mO, -J.kn[s] + J.hpP[s] - J.ft[s]);
      put('foot', mO, s === Rr && c.lostShoe ? C('#f4f4f4') : cols.shoe);
    }
  }

  P3.update = (G, dt) => {
    for (const k in parts) parts[k].count = 0;
    const cam = R3.camera;
    projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projM);
    const cull = !(LC.CCTV && LC.CCTV.isOpen());
    const cx = cam.position.x, cz = cam.position.z;
    const t = G.t;
    const list = G.chars;
    // nearest first so the cap (if ever hit) drops the far ones
    let n = 0;
    for (const c of list) {
      if (c.hidden || c.gone || !c.look) continue;
      R3.toW(c.x, c.y, c.z || 0, wv);
      if (cull) {
        const d = Math.hypot(wv.x - cx, wv.z - cz);
        if (d > 70) continue;
        sphere.center.set(wv.x, wv.y + 0.9, wv.z); sphere.radius = 1.3;
        if (!frustum.intersectsSphere(sphere)) continue;
      }
      if (n++ >= MAXC) break;
      buildChar(c, G, c.t || t);
    }
    for (const k in parts) R3.flush(parts[k]);
    P3.drawn = n;
  };
})();
