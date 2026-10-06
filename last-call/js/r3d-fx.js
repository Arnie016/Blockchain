/* Last Call — 3D effects and loose things: movable props, mess on the floor, lost property,
   barrier ropes, particles, light pools, the LED dance floor, moving-head beams, the mirror
   ball, lasers, the torch, and in-world text (POW, zzz) drawn on the 2D overlay. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const R3 = LC.R3;
  if (!R3 || !R3.ok) return;
  const { U, Map: M } = LC;
  const T = M.T, PX = 1 / T, ZS = R3.ZS;
  const FX = (R3.FX = {});
  const C = R3.col;
  let root;

  /* ================= mat4 helpers (column-major, as in r3d-people) ================= */
  const mk = () => new Float32Array(16);
  const ident = (m) => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  const tr = (m, x, y, z) => { m[12] += m[0] * x + m[4] * y + m[8] * z; m[13] += m[1] * x + m[5] * y + m[9] * z; m[14] += m[2] * x + m[6] * y + m[10] * z; return m; };
  const rx = (m, a) => { if (!a) return m; const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; } return m; };
  const ry = (m, a) => { if (!a) return m; const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; } return m; };
  const sc = (m, x, y, z) => { for (let i = 0; i < 3; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; } return m; };
  const mO = mk();
  const wv = new THREE.Vector3();

  // write an instance into an instanced mesh
  function put(mesh, m, r, g, b, amb, alpha) {
    const i = mesh.count;
    if (i >= mesh.userData.max) return -1;
    mesh.instanceMatrix.array.set(m, i * 16);
    const ca = mesh.instanceColor.array;
    ca[i * 3] = r; ca[i * 3 + 1] = g; ca[i * 3 + 2] = b;
    const a = mesh.geometry.attributes;
    if (a.aAmb) { const aa = a.aAmb.array; if (amb) { aa[i * 3] = amb.x; aa[i * 3 + 1] = amb.y; aa[i * 3 + 2] = amb.z; } else { aa[i * 3] = aa[i * 3 + 1] = aa[i * 3 + 2] = 1; } a.aGlow.array[i * 3] = a.aGlow.array[i * 3 + 1] = a.aGlow.array[i * 3 + 2] = 0; }
    if (a.aAlpha) a.aAlpha.array[i] = alpha === undefined ? 1 : alpha;
    mesh.count = i + 1;
    return i;
  }

  /* ================= prop templates ================= */
  const parts = [];
  const add = (kind, x, y, z, sx, sy, sz, col, ryy = 0, rxx = 0, rzz = 0, seg) => parts.push([R3.prim(kind, seg), R3.mtx(x, y, z, sx, sy, sz, ryy, rxx, rzz).clone(), C(col)]);
  const done = () => { const g = R3.merge(parts); parts.length = 0; return g; };
  function templates() {
    const G = {};
    add('cyl', 0, 0.015, 0, 0.4, 0.03, 0.4, '#5a5e66'); add('cyl', 0, 0.37, 0, 0.05, 0.72, 0.05, '#8a8e96'); add('torus', 0, 0.3, 0, 0.42, 0.42, 0.42, '#8a8e96', 0, Math.PI / 2);
    add('cyl', 0, 0.72, 0, 0.4, 0.06, 0.4, '#1e1e24'); add('cyl', 0, 0.755, 0, 0.38, 0.02, 0.38, '#b3123a');
    G.stool = done();
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) add('box', lx, 0.22, lz, 0.035, 0.44, 0.035, '#2a2026');
    add('box', 0, 0.46, 0, 0.44, 0.05, 0.42, '#5a3a2e'); add('box', 0, 0.72, -0.19, 0.44, 0.46, 0.04, '#4a2e24');
    G.chair = done();
    add('cyl', 0, 0.02, 0, 0.5, 0.04, 0.5, '#2a2a30'); add('cyl', 0, 0.36, 0, 0.07, 0.7, 0.07, '#2a2a30'); add('cyl', 0, 0.72, 0, 0.95, 0.04, 0.95, '#3a2e36', 0, 0, 0, 20); add('cyl', 0, 0.695, 0, 0.9, 0.02, 0.9, '#18161c', 0, 0, 0, 20);
    G.table = done();
    add('cyl', 0, 0.02, 0, 0.44, 0.04, 0.44, '#2a2a30'); add('cyl', 0, 0.54, 0, 0.06, 1.06, 0.06, '#2a2a30'); add('cyl', 0, 1.08, 0, 0.66, 0.04, 0.66, '#3a2e36', 0, 0, 0, 18);
    G.tableHigh = done();
    add('cyl', 0, 0.17, 0, 0.36, 0.34, 0.36, '#b8643a', 0, 0, 0, 10); add('cyl', 0, 0.34, 0, 0.4, 0.05, 0.4, '#9a4e2a', 0, 0, 0, 10);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; add('sph', Math.cos(a) * 0.14, 0.62 + (i % 2) * 0.1, Math.sin(a) * 0.14, 0.12, 0.62, 0.05, i % 2 ? '#2f8a3e' : '#3aa24a', -a, 0, 0.35 + (i % 3) * 0.12); }
    add('sph', 0, 0.8, 0, 0.1, 0.7, 0.05, '#3aa24a', 1.2, 0.1, 0);
    G.plant = done();
    add('box', 0, 0.02, 0, 0.36, 0.04, 0.36, '#e25512'); add('cone', 0, 0.27, 0, 0.28, 0.5, 0.28, '#ff6a1a'); add('cyl', 0, 0.3, 0, 0.19, 0.06, 0.19, '#f4f4f4'); add('cyl', 0, 0.4, 0, 0.13, 0.05, 0.13, '#f4f4f4');
    G.cone = done();
    add('box', 0, 0.3, 0.07, 0.32, 0.6, 0.02, '#ffd21f', 0, -0.22); add('box', 0, 0.3, -0.07, 0.32, 0.6, 0.02, '#ffd21f', 0, 0.22);
    add('box', 0, 0.44, 0.105, 0.22, 0.04, 0.01, '#111', 0, -0.22); add('sph', -0.02, 0.36, 0.125, 0.04, 0.04, 0.02, '#111'); add('box', 0.01, 0.28, 0.14, 0.02, 0.12, 0.01, '#111', 0, -0.22, 0.6);
    G.sign = done();
    add('cyl', 0, 0.22, 0, 0.16, 0.42, 0.16, '#d82020', 0, 0, 0, 10); add('cyl', 0, 0.46, 0, 0.06, 0.06, 0.06, '#222'); add('box', 0.06, 0.4, 0.04, 0.02, 0.2, 0.02, '#222', 0, 0.3);
    G.extinguisher = done();
    add('sph', 0, 0.22, 0, 0.9, 0.5, 0.85, '#ffffff', 0, 0, 0, 12);
    G.beanbag = done();
    add('sph', 0, 0.22, 0, 1.4, 0.4, 0.45, '#3fbf4a', 0, 0, 0, 12); add('sph', 0.8, 0.25, 0, 0.55, 0.26, 0.3, '#3fbf4a'); add('cone', -0.95, 0.2, 0, 0.3, 0.7, 0.2, '#3fbf4a', 0, 0, Math.PI / 2);
    add('sph', 0.72, 0.4, 0.1, 0.1, 0.1, 0.1, '#ffffff'); add('sph', 0.74, 0.41, 0.13, 0.05, 0.05, 0.05, '#111'); for (let i = 0; i < 5; i++) add('cone', -0.4 + i * 0.22, 0.44, 0, 0.1, 0.14, 0.1, '#2f9a3a');
    G.crocodile = done();
    add('sph', 0, 0.0, 0, 0.3, 0.36, 0.3, '#ffffff'); add('cyl', 0, -0.5, 0, 0.004, 0.8, 0.004, '#dddddd');
    G.balloon = done();
    // weird things
    add('sph', 0, 0.15, 0, 0.45, 0.22, 0.25, '#dddddd'); add('sph', 0, 0.28, 0, 0.3, 0.2, 0.2, '#c47a2a'); G.w_chicken = done();
    add('sph', 0, 0.2, 0, 0.22, 0.28, 0.22, '#3a6adf'); add('sph', 0, 0.42, 0, 0.14, 0.14, 0.14, '#f0c8a8'); add('cone', 0, 0.62, 0, 0.16, 0.3, 0.16, '#e33'); add('cone', 0, 0.33, 0.07, 0.14, 0.18, 0.08, '#eeeeee', 0, Math.PI); G.w_gnome = done();
    add('box', 0, 0.5, 0, 0.55, 0.4, 0.4, '#b8bcc4'); for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) add('cyl', x, 0.06, z, 0.1, 0.1, 0.1, '#222'); add('box', 0.3, 0.72, 0, 0.04, 0.3, 0.4, '#b8bcc4'); G.w_cart = done();
    add('box', 0, 0.16, 0, 0.5, 0.3, 0.35, '#d0d0d4'); add('box', -0.05, 0.16, 0.18, 0.3, 0.2, 0.01, '#222222'); G.w_microwave = done();
    add('sph', 0, 0.16, 0, 0.3, 0.32, 0.3, '#c8e8ff'); add('sph', 0.03, 0.15, 0, 0.1, 0.06, 0.05, '#ff8a1a'); G.w_goldfish = done();
    add('cyl', 0, 0.12, 0, 0.45, 0.24, 0.45, '#f4e0e8', 0, 0, 0, 16); add('cyl', 0, 0.25, 0, 0.46, 0.02, 0.46, '#ff5a8a'); for (let i = 0; i < 5; i++) add('cyl', -0.12 + i * 0.06, 0.32, 0, 0.012, 0.1, 0.012, '#ffd24a'); G.w_cake = done();
    add('sph', 0, 0.12, 0, 0.24, 0.24, 0.24, '#2a2a6a'); G.w_bowling = done();
    add('cyl', 0, 0.05, 0, 0.08, 0.6, 0.08, '#f0d0b8', 0, 0, Math.PI / 2); add('sph', 0.32, 0.05, 0, 0.1, 0.08, 0.1, '#f0d0b8'); G.w_arm = done();
    add('box', 0, 0.01, 0, 0.8, 0.02, 0.5, '#8a6a3a'); G.w_doormat = done();
    add('cyl', 0, 0.05, 0, 0.9, 0.04, 0.9, '#e8c35a', 0, 0, 0, 18); add('cone', 0, 0.2, 0, 0.3, 0.3, 0.3, '#e8c35a'); G.w_sombrero = done();
    add('cyl', 0, 0.1, 0, 0.1, 0.2, 0.1, '#e8c04a'); add('cone', 0, 0.35, 0, 0.3, 0.3, 0.3, '#e8c04a', 0, Math.PI); add('box', 0, 0.02, 0, 0.3, 0.04, 0.3, '#3a2a1a'); G.w_trophy = done();
    add('sph', 0, 0.2, 0, 0.26, 0.38, 0.26, '#d8a02a'); add('cone', 0, 0.5, 0, 0.18, 0.3, 0.18, '#3a8a3a'); G.w_pineapple = done();
    add('sph', 0, 0.18, 0, 0.45, 0.3, 0.35, '#ffd82a'); add('sph', 0.2, 0.42, 0, 0.24, 0.24, 0.24, '#ffd82a'); add('cone', 0.36, 0.42, 0, 0.08, 0.14, 0.08, '#ff8a1a', 0, 0, -Math.PI / 2); G.w_duck = done();
    add('box', 0, 0.3, 0, 0.55, 0.55, 0.22, '#8a2a3a'); add('box', 0, 0.62, 0, 0.18, 0.06, 0.04, '#222'); G.w_suitcase = done();
    add('sph', -0.1, 0.05, 0, 0.36, 0.1, 0.26, '#b8742a'); add('box', 0.35, 0.05, 0, 0.6, 0.04, 0.06, '#3a2a1a'); G.w_guitar = done();
    add('box', 0, 0.06, 0, 0.7, 0.04, 0.14, '#3ad0b0'); add('cyl', 0.32, 0.45, 0, 0.03, 0.8, 0.03, '#3ad0b0'); for (const x of [-0.3, 0.3]) add('cyl', x, 0.05, 0, 0.1, 0.05, 0.1, '#222', 0, 0, Math.PI / 2); G.w_scooter = done();
    // lost property
    add('sph', 0, 0.04, 0, 0.12, 0.07, 0.28, '#ffffff'); G.i_shoe = done();
    add('box', 0, 0.03, 0, 0.55, 0.05, 0.4, '#ffffff', 0.3); G.i_flat = done();
    add('box', 0, 0.02, 0, 0.14, 0.04, 0.12, '#ffffff'); G.i_small = done();
    add('box', 0, 0.01, 0, 0.08, 0.012, 0.15, '#111111'); G.i_phone = done();
    // bar glasses
    add('cyl', 0, 0.05, 0, 0.07, 0.1, 0.07, '#ffffff', 0, 0, 0, 8); G.glass = done();
    return G;
  }

  /* ================= textures for mess ================= */
  function blobTex(kind) {
    return R3.canvasTex(256, 256, (g) => {
      const c = 128;
      const blob = (n, r0, col) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = i * 2.39, d = i === 0 ? 0 : r0 * 0.45; g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, r0 * (i === 0 ? 0.8 : 0.5 + (i * 0.13) % 0.3), r0 * (i === 0 ? 0.7 : 0.45 + (i * 0.11) % 0.3), a, 0, 7); g.fill(); } };
      switch (kind) {
        case 'blob': blob(6, 90, 'rgba(255,255,255,0.85)'); g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.ellipse(100, 96, 34, 9, -0.4, 0, 7); g.fill(); break;
        case 'vomit': blob(7, 88, 'rgba(176,172,82,0.95)'); for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? 'rgba(210,150,70,0.95)' : 'rgba(120,150,60,0.95)'; g.fillRect(c + Math.cos(i * 2.1) * (i * 2.1 % 80), c + Math.sin(i * 2.1) * (i * 1.7 % 70), 9, 7); } break;
        case 'glass': for (let i = 0; i < 26; i++) { const a = i * 1.9, d = (i * 37) % 100; const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.8; g.fillStyle = 'rgba(210,235,255,0.95)'; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 11, y + 4); g.lineTo(x - 7, y + 7); g.fill(); } break;
        case 'trash': g.fillStyle = '#d02a2a'; g.beginPath(); g.ellipse(80, 130, 34, 22, 0.5, 0, 7); g.fill(); g.fillStyle = '#f0f0f0'; g.fillRect(140, 90, 50, 38); g.fillStyle = '#e8e0d0'; g.fillRect(110, 170, 40, 30); g.strokeStyle = '#4af'; g.lineWidth = 6; g.beginPath(); g.moveTo(60, 190); g.lineTo(120, 210); g.stroke(); break;
        case 'food': for (let i = 0; i < 14; i++) { g.save(); g.translate(c + Math.cos(i) * 60, c + Math.sin(i * 1.3) * 40); g.rotate(i); g.fillStyle = '#f0c040'; g.fillRect(-26, -5, 52, 10); g.restore(); } g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(c, c, 44, 28, 0.4, 0, 7); g.fill(); g.fillStyle = '#5a9a3a'; g.fillRect(c - 16, c - 20, 26, 14); break;
        case 'confetti': for (let i = 0; i < 90; i++) { g.fillStyle = ['#ff4fa8', '#4af0ff', '#ffe14a', '#8aff6a', '#b56aff'][i % 5]; g.save(); g.translate(c + Math.cos(i * 2.1) * (i * 1.3 % 110), c + Math.sin(i * 2.1) * (i * 1.7 % 110)); g.rotate(i); g.fillRect(-7, -4, 14, 8); g.restore(); } break;
        case 'debris': for (let i = 0; i < 12; i++) { g.save(); g.translate(c + Math.cos(i * 1.3) * (i * 9 % 90), c + Math.sin(i * 1.3) * (i * 7 % 80)); g.rotate(i); g.fillStyle = i % 2 ? '#ffffff' : '#bbbbbb'; g.fillRect(-40, -8, 80, 16); g.restore(); } break;
        case 'powder': blob(8, 95, 'rgba(255,255,255,0.7)'); break;
        case 'dirt': blob(6, 80, 'rgba(255,255,255,0.9)'); break;
      }
    });
  }
  const MESS_TEX = { spill: 'blob', water: 'blob', wet: 'blob', vomit: 'vomit', glass: 'glass', trash: 'trash', food: 'food', powder: 'powder', dirt: 'dirt', confetti: 'confetti', debris: 'debris' };

  /* ================= build ================= */
  let TPL, propMeshes = {}, messMeshes = {}, poolMesh, dynPoolMesh, ledMesh, beamMeshes = [], headMeshes = [], ball, ballLight, sparks, laserLines, fan, fanBeam, grimePlane, glassMesh, liquidMesh, partPoints, partAdd, barrierPool = [], glowSprites = [];
  FX.build = (scene) => {
    root = new THREE.Group();
    root.name = 'fx';
    scene.add(root);
    TPL = templates();
    const lit = R3.litMat({ inst: true, vc: true });
    const mkInst = (name, geo, max) => { const m = R3.inst(geo, lit, max); m.name = 'prop_' + name; root.add(m); return m; };
    for (const k in TPL) if (k !== 'glass') propMeshes[k] = mkInst(k, TPL[k], k === 'stool' || k === 'chair' || k === 'table' ? 70 : k.startsWith('w_') || k.startsWith('i_') ? 24 : 40);
    // bar + table glasses
    glassMesh = R3.inst(TPL.glass, R3.litMat({ inst: true, vc: true, transparent: true, opacity: 0.5 }), 90);
    liquidMesh = R3.inst(TPL.glass, lit, 90);
    root.add(glassMesh); root.add(liquidMesh);
    // mess decals
    const dg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).toNonIndexed();
    for (const k in MESS_TEX) {
      const tex = blobTex(MESS_TEX[k]);
      const m = R3.inst(dg, R3.litMat({ inst: true, map: tex, transparent: true, alpha: true, depthWrite: false, polygonOffset: 3 }), 160, { alpha: true, order: 2 });
      m.name = 'mess_' + k;
      root.add(m);
      messMeshes[k] = m;
    }
    // grime (dried stains): one big plane over the map
    const gw = LC.W.grime;
    if (gw && !gw.canvas) gw.clear();
    if (gw && gw.canvas) {
      const gt = new THREE.CanvasTexture(gw.canvas);
      gt.encoding = THREE.sRGBEncoding;
      const gm = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0.55, depthWrite: false, color: C('#8a8a8a'), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: 2 });
      grimePlane = new THREE.Mesh(new THREE.PlaneGeometry(M.W, M.H).rotateX(-Math.PI / 2), gm);
      grimePlane.position.set(M.W / 2, 0.004, M.H / 2);
      grimePlane.renderOrder = 1;
      root.add(grimePlane);
      grimePlane.userData.tex = gt;
    }
    // light pools on the floor (static lights + dynamic)
    const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).toNonIndexed();
    const pm = R3.basicMat({ map: R3.glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: 4 });
    poolMesh = R3.inst(pg, pm, M.lights.length + 20, { lit: false, order: 3 });
    root.add(poolMesh);
    dynPoolMesh = R3.inst(pg, pm, 160, { lit: false, order: 3 });
    root.add(dynPoolMesh);
    // LED dance floor
    const lg = new THREE.PlaneGeometry(0.44, 0.44).rotateX(-Math.PI / 2).toNonIndexed();
    const lm = R3.basicMat({});
    const n = (M.LED.x1 - M.LED.x0) * (M.LED.y1 - M.LED.y0) * 4;
    ledMesh = R3.inst(lg, lm, n, { lit: false });
    root.add(ledMesh);
    buildRig();
    buildTorch();
    // particles
    const mkPts = (additive) => {
      const g = new THREE.BufferGeometry();
      const N = 1000;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: R3.glowTex() }, uScale: { value: 400 } },
        vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard; }',
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      pts.renderOrder = 6;
      root.add(pts);
      return pts;
    };
    partPoints = mkPts(false);
    partAdd = mkPts(true);
    // lamp glows (billboards)
    const gm = new THREE.SpriteMaterial({ map: R3.glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
    for (const g2 of (R3.World.dyn && R3.World.dyn.glows) || []) {
      const s = new THREE.Sprite(gm.clone());
      s.material.color.copy(C(g2.c)).multiplyScalar(g2.k * 1.2);
      s.scale.set(g2.s, g2.s, 1); s.position.set(g2.x, g2.y, g2.z);
      root.add(s); glowSprites.push(s);
    }
  };

  /* ================= truss rig: moving heads, beams, mirror ball, lasers ================= */
  const LEDC = [[255, 46, 136], [46, 230, 255], [150, 70, 255], [255, 180, 50], [60, 255, 170], [255, 90, 60]];
  function buildRig() {
    const tr3 = M.truss, y = tr3.z * ZS;
    const x0 = tr3.x0 * PX, x1 = tr3.x1 * PX, z0 = tr3.y0 * PX, z1 = tr3.y1 * PX;
    const gb = new R3.GB();
    const room = R3.roomIndexAt((tr3.x0 + tr3.x1) / 2, (tr3.y0 + tr3.y1) / 2);
    const bar = (ax, az, bx, bz) => {
      for (const dy of [0, 0.3]) for (const side of [-0.12, 0.12]) {
        const horiz = az === bz;
        if (horiz) gb.box(ax, y + dy - 0.02, az + side - 0.02, bx, y + dy + 0.02, az + side + 0.02, C('#8a8e96'), room);
        else gb.box(ax + side - 0.02, y + dy - 0.02, az, ax + side + 0.02, y + dy + 0.02, bz, C('#8a8e96'), room);
      }
      const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 0.5);
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; const px = ax + (bx - ax) * k, pz = az + (bz - az) * k; gb.box(px - 0.015, y, pz - 0.015, px + 0.015, y + 0.3, pz + 0.015, C('#6a6e76'), room); }
    };
    bar(x0, z0, x1, z0); bar(x0, z1, x1, z1); bar(x0, z0, x0, z1); bar(x1, z0, x1, z1);
    const truss = new THREE.Mesh(gb.build(), R3.litMat({ vc: true, room: true }));
    root.add(truss);
    // fixtures + beams
    const beamGeo = new THREE.CylinderGeometry(0.06, 1, 1, 18, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2).toNonIndexed();
    const bc = [];
    const pos = beamGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); const a = Math.max(0, 1 - z) * 0.9 + 0.1; bc.push(a, a, a); }
    beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      b.renderOrder = 7;
      root.add(b); beamMeshes.push(b);
      const h = new THREE.Mesh(R3.prim('box'), R3.litMat({ color: C('#1a1a20') }));
      h.scale.set(0.3, 0.26, 0.3);
      root.add(h);
      const lens = new THREE.Mesh(R3.prim('sph'), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      lens.scale.setScalar(0.14);
      root.add(lens);
      headMeshes.push({ h, lens });
    }
    // mirror ball
    const ballTex = R3.canvasTex(256, 128, (g) => { for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 32; xx++) { const v = 90 + U.hash(xx, yy) * 160; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 10) + ')'; g.fillRect(xx * 8, yy * 8, 7, 7); } });
    ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshBasicMaterial({ map: ballTex, toneMapped: false }));
    const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2;
    ball.position.set(bx, y - 0.2, bz);
    root.add(ball);
    const cable = new THREE.Mesh(R3.prim('cyl'), R3.litMat({ color: C('#777') }));
    cable.scale.set(0.01, R3.WALL_H - y + 0.2, 0.01); cable.position.set(bx, (R3.WALL_H + y) / 2, bz);
    root.add(cable);
    // sparkles from the ball on the floor
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(90 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: C('#ffffff').clone().multiplyScalar(2.5), size: 0.09, map: R3.glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sparks.frustumCulled = false;
    root.add(sparks);
    // lasers
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    laserLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    laserLines.frustumCulled = false;
    root.add(laserLines);
  }
  function movers(G) {
    const tr3 = M.truss, m = G.music || {}, out = [];
    const on = G.power && !(G.lightsOn > 0.5) && !m.stopped;
    for (let i = 0; i < 8; i++) {
      const top = i < 4, k = (i % 4) / 3;
      const x = tr3.x0 + 30 + k * (tr3.x1 - tr3.x0 - 60), y = top ? tr3.y0 : tr3.y1;
      const bt = m.beatTime || 0;
      const a = Math.sin(bt * 0.4 + i * 0.9) * 1.2 + (top ? Math.PI / 2 : -Math.PI / 2);
      const reach = 110 + Math.sin(bt * 0.3 + i) * 70 + (m.hanging ? Math.sin(G.t * 7 + i) * 60 : 0);
      out.push({ x, y, tx: x + Math.cos(a) * reach * 0.7, ty: y + Math.sin(a) * reach, c: LEDC[(i + (m.palette || 0)) % LEDC.length], on: on && (m.energy || 0) > 0.3 });
    }
    return out;
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function updateRig(G) {
    const tr3 = M.truss, y = tr3.z * ZS;
    const mv = movers(G);
    mv.forEach((mh, i) => {
      const b = beamMeshes[i], h = headMeshes[i];
      R3.toW(mh.x, mh.y, 0, _a); _a.y = y - 0.15;
      R3.toW(mh.tx, mh.ty, 0, _b); _b.y = 0.02;
      h.h.position.copy(_a); h.lens.position.set(_a.x, _a.y - 0.12, _a.z);
      h.lens.material.color.copy(mh.on ? C(mh.c) : C('#333')).multiplyScalar(mh.on ? 3 : 1);
      b.visible = mh.on;
      if (!mh.on) return;
      const len = _a.distanceTo(_b);
      b.position.copy(_a);
      b.lookAt(_b);
      b.scale.set(0.9, 0.9, len);
      b.material.color.copy(C(mh.c)).multiplyScalar(1.1);
    });
    // floor pools at the beam targets
    for (const mh of mv) if (mh.on) { R3.toW(mh.tx, mh.ty, 0, _b); ident(mO); tr(mO, _b.x, 0.02, _b.z); sc(mO, 2.2, 1, 1.6); const c = C(mh.c); put(dynPoolMesh, mO, c.r * 0.9, c.g * 0.9, c.b * 0.9); }
    // mirror ball
    const club = !(G.lightsOn > 0.5) && G.power;
    ball.rotation.y = G.t * 0.8;
    ball.material.color.setScalar(club ? 1.4 : 0.5);
    const sp = sparks.geometry.attributes.position.array;
    sparks.visible = club && !(G.music && G.music.stopped);
    if (sparks.visible) {
      const bx = (tr3.x0 + tr3.x1) / 2 * PX, bz = (tr3.y0 + tr3.y1) / 2 * PX;
      for (let i = 0; i < 90; i++) {
        const a = i * 2.4 + G.t * 0.35, d = 1.8 + ((i * 53) % 420) / 32;
        sp[i * 3] = bx + Math.cos(a) * d * 1.3; sp[i * 3 + 1] = i % 7 === 0 ? 1.2 + (i % 5) * 0.5 : 0.03; sp[i * 3 + 2] = bz + Math.sin(a) * d * 0.75;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
    }
    // lasers
    const m = G.music || {};
    const lp = laserLines.geometry.attributes.position.array, lc = laserLines.geometry.attributes.color.array;
    laserLines.visible = club && m.laser > 0.05;
    if (laserLines.visible) {
      const ox = 46, oy = 2.2, oz = 9.4;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + Math.sin(G.t * 1.7 + i * 0.7) * 0.9;
        const ex = ox + Math.cos(a) * 34, ez = oz + Math.sin(a) * 22, ey = 0.4 + Math.sin(G.t * 2 + i) * 0.4;
        lp.set([ox, oy, oz, ex, ey, ez], i * 6);
        const c = i % 2 ? [0.2, 3, 0.6] : [3, 0.2, 0.4];
        const k = m.laser;
        lc.set([c[0] * k, c[1] * k, c[2] * k, c[0] * k, c[1] * k, c[2] * k], i * 6);
      }
      laserLines.geometry.attributes.position.needsUpdate = true;
      laserLines.geometry.attributes.color.needsUpdate = true;
    }
  }

  /* ================= LED floor ================= */
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
  let ledSample = null;
  FX.ledColors = () => ledSample;
  function updateLED(G) {
    ledMesh.count = 0;
    const off = G.lightsOn > 0.5 || !G.power;
    const sample = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], sw = [0, 0, 0];
    for (let ty = M.LED.y0; ty < M.LED.y1; ty++) for (let tx = M.LED.x0; tx < M.LED.x1; tx++) {
      const L = R3.lvAt(tx * T + 16, ty * T + 16);
      let r0 = 0.12, g0 = 0.12, b0 = 0.13, r1 = r0, g1 = g0, b1 = b0;
      if (off) { if (!G.power) { r0 = g0 = b0 = r1 = g1 = b1 = 0.02; } }
      else {
        const [c, k0] = ledColor(tx, ty, G);
        const cc = C(c), e = 0.05 + k0 * 2.4, e2 = 0.05 + k0 * 1.3;
        r0 = cc.r * e; g0 = cc.g * e; b0 = cc.b * e; r1 = cc.r * e2; g1 = cc.g * e2; b1 = cc.b * e2;
        const si = tx < 42 ? 0 : tx > 50 ? 1 : 2;
        sample[si][0] += c[0] * k0; sample[si][1] += c[1] * k0; sample[si][2] += c[2] * k0; sw[si] += k0;
      }
      for (let q = 0; q < 4; q++) {
        ident(mO); tr(mO, tx + 0.25 + (q % 2) * 0.5 + L.dx, 0.011 + L.dy, ty + 0.25 + (q >> 1) * 0.5 + L.dz);
        if (q === 0 || q === 3) put(ledMesh, mO, r0, g0, b0); else put(ledMesh, mO, r1, g1, b1);
      }
    }
    ledSample = off ? null : sample.map((s2, i) => { const w = Math.max(0.01, sw[i]); return [Math.min(255, s2[0] / w), Math.min(255, s2[1] / w), Math.min(255, s2[2] / w)]; });
    R3.flush(ledMesh);
  }

  /* ================= torch ================= */
  function buildTorch() {
    // a flat fan on the floor and a faint volumetric cone
    const n = 20, pos = [], col = [];
    for (let i = 0; i < n; i++) {
      const a0 = -0.5 + (i / n), a1 = -0.5 + ((i + 1) / n);
      pos.push(0, 0, 0, Math.cos(a1), 0, Math.sin(a1), Math.cos(a0), 0, Math.sin(a0));
      col.push(1, 1, 1, 0, 0, 0, 0, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fan = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: 4 }));
    fan.renderOrder = 4;
    root.add(fan);
    const bg = new THREE.CylinderGeometry(0.03, 1, 1, 16, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2).toNonIndexed();
    const bc = [];
    const pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i); const a = Math.max(0, 1 - z) * 0.8 + 0.1; bc.push(a, a, a * 0.9); }
    bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    fanBeam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    fanBeam.renderOrder = 7;
    root.add(fanBeam);
  }
  function updateTorch(G) {
    const p = G.player;
    const on = !!(p && p.flash && !G.demo);
    fan.visible = on; fanBeam.visible = on;
    if (!on) return;
    R3.toW(p.x, p.y, 0, wv);
    fan.position.set(wv.x, wv.y + 0.02, wv.z);
    fan.rotation.y = -p.face;
    fan.scale.set(9, 1, 9);
    fan.material.color.setRGB(0.55, 0.52, 0.45);
    const hx = wv.x + Math.cos(p.face) * 0.3, hz = wv.z + Math.sin(p.face) * 0.3;
    fanBeam.position.set(hx, wv.y + 1.25, hz);
    _b.set(wv.x + Math.cos(p.face) * 9, wv.y, wv.z + Math.sin(p.face) * 9);
    fanBeam.lookAt(_b);
    fanBeam.scale.set(3.4, 3.4, 9.2);
  }

  /* ================= per frame ================= */
  const whiteAmb = new THREE.Vector3(1, 1, 1);
  function updateProps(G) {
    for (const k in propMeshes) propMeshes[k].count = 0;
    glassMesh.count = 0; liquidMesh.count = 0;
    for (const p of LC.W.props) {
      if (p.worn || p.broken) continue;
      let key = p.kind;
      if (key === 'table' && p.high) key = 'tableHigh';
      if (key === 'weird') key = 'w_' + (TPL['w_' + p.what] ? p.what : 'gnome');
      const mesh = propMeshes[key];
      if (!mesh) continue;
      const b = p.body;
      let y = 0;
      R3.toW(b.x, b.y, 0, wv);
      ident(mO);
      if (p.carriedBy && p.carriedBy._h3) {
        const h = p.carriedBy._h3;
        const up = p.kind === 'plant' || p.kind === 'crocodile' || p.kind === 'weird';
        tr(mO, h[0], h[1] - (up ? -0.05 : 0.25), h[2]);
        ry(mO, Math.PI / 2 - (p.carriedBy.face || 0));
      } else {
        if (p.mounted) y = 0.85;
        else if (p.kind === 'balloon') y = (p.z || 90) * ZS * 0.9;
        else if (p.z0) y = p.z0 * ZS;
        tr(mO, wv.x, wv.y + y, wv.z);
        if (p.fallen > 0) {
          const a = p.fallDir || 0;
          ry(mO, Math.PI / 2 - a);
          tr(mO, 0, 0.18 * p.fallen, 0);
          rx(mO, p.fallen * Math.PI / 2 * 0.97);
          ry(mO, -(Math.PI / 2 - a));
        }
        ry(mO, p.kind === 'chair' ? Math.PI / 2 - (p.face || 0) : p.seed * 6.28);
        if (p.kind === 'balloon') { rx(mO, Math.sin(G.t * 1.3 + p.seed * 9) * 0.1); }
      }
      if (p.big) sc(mO, 1.3, 1.3, 1.3);
      const amb = R3.ambAt(b.x, b.y);
      let r = 1, g = 1, bb = 1;
      if (p.kind === 'beanbag') { const c = C(['#e8375a', '#2f7ae5', '#f5c542', '#1fbf8f', '#a64dff'][(p.seed * 5) | 0]); r = c.r; g = c.g; bb = c.b; }
      if (p.kind === 'balloon') { const c = C(p.color || '#ff4fa8'); r = c.r; g = c.g; bb = c.b; }
      const idx = put(mesh, mO, r, g, bb, amb);
      // aim highlight
      if (idx >= 0 && FX.highlight === p) { const ga = mesh.geometry.attributes.aGlow.array; ga[idx * 3] = 0.25; ga[idx * 3 + 1] = 0.22; ga[idx * 3 + 2] = 0.1; }
      // glasses left on tables
      if (p.kind === 'table' && p.glasses && !p.fallen && !p.carriedBy) {
        for (let i = 0; i < p.glasses; i++) {
          ident(mO); tr(mO, wv.x - 0.15 + i * 0.14, wv.y + (p.high ? 1.1 : 0.74), wv.z + (i % 2) * 0.1);
          put(glassMesh, mO, 0.85, 0.9, 1, amb); put(liquidMesh, mO, 0.9, 0.6, 0.2, amb);
        }
      }
    }
    for (const gl of LC.W.barTop) {
      R3.toW(gl.x, gl.y, 0, wv);
      ident(mO); tr(mO, wv.x, wv.y + 1.05, wv.z);
      const amb = R3.ambAt(gl.x, gl.y);
      put(glassMesh, mO, 0.85, 0.9, 1, amb);
      const c = C(gl.c);
      ident(mO); tr(mO, wv.x, wv.y + 1.05, wv.z); sc(mO, 0.9, gl.full ? 0.8 : 0.15, 0.9);
      put(liquidMesh, mO, c.r, c.g, c.b, amb);
    }
    for (const k in propMeshes) R3.flush(propMeshes[k]);
    R3.flush(glassMesh); R3.flush(liquidMesh);
  }
  function updateItems() {
    for (const it of LC.W.items) {
      const key = it.kind === 'shoe' ? 'i_shoe' : it.kind === 'phone' ? 'i_phone' : it.kind === 'jacket' || it.kind === 'tie' || it.kind === 'wig' ? 'i_flat' : 'i_small';
      const mesh = propMeshes[key];
      if (!mesh) continue;
      R3.toW(it.x, it.y, 0, wv);
      ident(mO); tr(mO, wv.x, wv.y, wv.z); ry(mO, it.rot || 0);
      const c = C(it.c || [60, 60, 70]);
      put(mesh, mO, c.r, c.g, c.b, R3.ambAt(it.x, it.y));
    }
  }
  function updateMess(G) {
    for (const k in messMeshes) messMeshes[k].count = 0;
    for (const m of LC.W.mess) {
      const mesh = messMeshes[m.kind];
      if (!mesh) continue;
      R3.toW(m.x, m.y, 0, wv);
      const s = m.r * PX * 2.6;
      ident(mO); tr(mO, wv.x, wv.y + 0.006, wv.z); ry(mO, m.seed); sc(mO, s, 1, s * 0.85);
      const amt = U.clamp(m.amt, 0, 1);
      let r = 1, g = 1, b = 1, a = 0.35 + 0.6 * amt;
      if (m.kind === 'spill') { const c = C(m.sticky ? m.c.map((v) => v * 0.55) : m.c); r = c.r; g = c.g; b = c.b; a *= 0.75; }
      else if (m.kind === 'water') { r = 0.55; g = 0.75; b = 1; a *= 0.5; }
      else if (m.kind === 'wet') { r = 0.6; g = 0.8; b = 1; a = 0.28 * Math.min(1, m.ttl / 6); }
      else if (m.kind === 'powder') { r = g = b = 0.95; a *= 0.7; }
      else if (m.kind === 'dirt') { const c = C([80, 55, 35]); r = c.r; g = c.g; b = c.b; }
      else if (m.kind === 'debris') { const c = C(m.c || [140, 95, 60]); r = c.r; g = c.g; b = c.b; }
      put(mesh, mO, r, g, b, R3.ambAt(m.x, m.y), a);
      // glass sparkles catch the light
      if (m.kind === 'glass' && Math.sin(G.t * 3 + m.seed) > 0.7) { ident(mO); tr(mO, wv.x + Math.sin(m.seed) * s * 0.2, wv.y + 0.02, wv.z + Math.cos(m.seed) * s * 0.2); sc(mO, 0.25, 1, 0.25); put(dynPoolMesh, mO, 0.9, 0.95, 1); }
    }
    for (const k in messMeshes) R3.flush(messMeshes[k]);
    if (grimePlane) {
      const gw = LC.W.grime;
      if (gw.dirty) { grimePlane.userData.tex.needsUpdate = true; gw.dirty = false; }
      grimePlane.material.opacity = 0.5 + (G.lightsOn || 0) * 0.4;
    }
  }
  function updatePools(G) {
    poolMesh.count = 0;
    const club = !(G.lightsOn > 0.5);
    for (const l of M.lights) {
      let i = l.i * (club ? 1 : 0.2);
      if (l.kebab) i = G.kebabOpen ? 0.9 : 0;
      const room = l.room && M.room(l.room);
      if (!G.power && !(room && room.outdoor) && !l.sign) i *= 0.05;
      if (l.flick === 'bulb') i *= Math.sin(G.t * 17) > 0.96 ? 0.3 : 1;
      if (l.candle) i *= 0.85 + Math.sin(G.t * 9 + l.x) * 0.1;
      if (l.lava) i *= 0.8 + Math.sin(G.t * 0.7 + l.x) * 0.2;
      if (l.sign) i *= G.signFlicker ? 0.25 : 1;
      if (i <= 0.02) continue;
      R3.toW(l.x, l.y, 0, wv);
      const s = l.r * PX * 1.7;
      ident(mO); tr(mO, wv.x, wv.y + 0.015, wv.z); sc(mO, s, 1, s);
      const c = C(l.c), k = Math.min(1.2, i) * 0.55;
      put(poolMesh, mO, c.r * k, c.g * k, c.b * k);
    }
    R3.flush(poolMesh);
    for (const dl of G.dynLights) {
      if (dl.cone) continue;
      R3.toW(dl.x, dl.y, 0, wv);
      const s = dl.r * PX * 1.6;
      ident(mO); tr(mO, wv.x, wv.y + 0.016, wv.z); sc(mO, s, 1, s);
      const c = C(dl.c), k = Math.min(1.2, dl.i) * 0.6;
      put(dynPoolMesh, mO, c.r * k, c.g * k, c.b * k);
    }
  }
  const PCOL = { shard: [220, 240, 255], splinter: [140, 95, 60], dust: [200, 200, 190], smoke: [210, 210, 220], vape: [220, 220, 235], powder: [245, 245, 250], stink: [150, 210, 90], puff: [255, 255, 255], cough: [220, 220, 230], spark: [255, 190, 90] };
  const PSIZE = { drop: 0.05, shard: 0.04, splinter: 0.05, dust: 0.18, smoke: 0.5, vape: 0.55, powder: 0.9, stink: 0.12, confetti: 0.06, puff: 0.3, cough: 0.2, spark: 0.1 };
  function updateParticles(G) {
    const fill = (pts, additive) => {
      const g = pts.geometry, P = g.attributes.position.array, Cc = g.attributes.color.array, S = g.attributes.size.array, A = g.attributes.alpha.array;
      let n = 0;
      for (const p of LC.W.parts) {
        if ((p.kind === 'spark') !== additive) continue;
        if (p.kind === 'note' || p.kind === 'zzz' || p.kind === 'heart' || p.kind === 'pow') continue;
        if (n >= 1000) break;
        const k = p.life / p.max;
        R3.toW(p.x, p.y, p.z || 0, wv);
        P[n * 3] = wv.x; P[n * 3 + 1] = wv.y + (p.z ? 0 : 0.03); P[n * 3 + 2] = wv.z;
        const c = C(p.c || PCOL[p.kind] || [255, 255, 255]);
        const amb = R3.ambAt(p.x, p.y), f = additive ? 2.5 : Math.min(1.3, (amb.x + amb.y + amb.z) / 3 + 0.25);
        Cc[n * 3] = c.r * f; Cc[n * 3 + 1] = c.g * f; Cc[n * 3 + 2] = c.b * f;
        let size = (PSIZE[p.kind] || 0.06) * (p.size || 1);
        if (p.kind === 'dust' || p.kind === 'smoke' || p.kind === 'vape' || p.kind === 'powder' || p.kind === 'puff' || p.kind === 'cough') size *= 0.6 + k * 1.2;
        S[n] = size;
        A[n] = (p.kind === 'smoke' || p.kind === 'vape' ? 0.35 : p.kind === 'powder' ? 0.5 : 0.9) * (1 - k * (p.kind === 'shard' || p.kind === 'splinter' || p.kind === 'confetti' ? 0.3 : 1));
        n++;
      }
      g.setDrawRange(0, n);
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
    };
    const s = R3.renderer.getPixelRatio() * R3.ch * 0.9;
    partPoints.material.uniforms.uScale.value = s; partAdd.material.uniforms.uScale.value = s;
    fill(partPoints, false);
    fill(partAdd, true);
  }
  function updateBarriers() {
    const B = LC.W.barriers;
    while (barrierPool.length < B.length) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(R3.prim('cyl'), R3.litMat({ color: C('#d9b04a') }));
      post.scale.set(0.07, 0.95, 0.07); post.position.y = 0.475;
      const post2 = post.clone();
      const rope = new THREE.Mesh(R3.prim('cyl'), R3.litMat({ color: C('#8a0f2a') }));
      g.add(post, post2, rope);
      g.userData = { post, post2, rope };
      root.add(g);
      barrierPool.push(g);
    }
    barrierPool.forEach((g, i) => {
      const b = B[i];
      g.visible = !!b;
      if (!b) return;
      const u = g.userData;
      R3.toW(b.x0, b.y0, 0, _a); R3.toW(b.x1, b.y1, 0, _b);
      u.post.position.set(_a.x, 0.475 + _a.y, _a.z); u.post2.position.set(_b.x, 0.475 + _b.y, _b.z);
      const len = _a.distanceTo(_b);
      u.rope.position.set((_a.x + _b.x) / 2, 0.8 + _a.y, (_a.z + _b.z) / 2);
      u.rope.scale.set(0.04, len, 0.04);
      u.rope.rotation.set(0, 0, 0);
      u.rope.rotation.z = Math.PI / 2;
      u.rope.rotation.y = -Math.atan2(_b.z - _a.z, _b.x - _a.x);
      u.rope.rotation.order = 'YXZ';
    });
  }
  FX.update = (G, dt) => {
    dynPoolMesh.count = 0;
    updateProps(G);
    updateItems();
    for (const k in propMeshes) R3.flush(propMeshes[k]);
    updateMess(G);
    updatePools(G);
    updateLED(G);
    updateRig(G);
    updateTorch(G);
    updateParticles(G);
    updateBarriers();
    R3.flush(dynPoolMesh);
    const club = !(G.lightsOn > 0.5);
    for (const s of glowSprites) s.visible = club || true;
  };

  /* ================= overlay text: POW, zzz, notes, hearts ================= */
  FX.drawOverlay = (g, G, dpr) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of LC.W.parts) {
      if (p.kind !== 'note' && p.kind !== 'zzz' && p.kind !== 'heart' && p.kind !== 'pow') continue;
      const s = R3.toScreen(p.x, p.y, (p.z || 0) + 30);
      if (s.behind || s.x < -40 || s.x > R3.cw + 40 || s.y < -40 || s.y > R3.ch + 40) continue;
      const k = p.life / p.max;
      g.globalAlpha = 1 - k;
      if (p.kind === 'pow') {
        const sc2 = 1.4 + k * 1.6;
        g.save(); g.translate(s.x, s.y); g.scale(sc2, sc2); g.rotate(p.rot * 0.2);
        g.fillStyle = '#ffe63c';
        g.beginPath(); for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r2 = i % 2 ? 7 : 14; g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } g.fill();
        g.fillStyle = '#c8142a'; g.font = '900 9px "Big Shoulders Display", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.text || 'POW', 0, 1);
        g.restore();
      } else {
        g.fillStyle = p.kind === 'note' ? '#a0e6ff' : p.kind === 'heart' ? '#ff4670' : '#c8d7ff';
        g.font = (p.kind === 'zzz' ? '800 ' + (13 + k * 8).toFixed(0) + 'px sans-serif' : '18px sans-serif');
        g.textAlign = 'center';
        g.fillText(p.kind === 'note' ? '♪' : p.kind === 'heart' ? '♥' : 'z', s.x + (p.kind === 'zzz' ? Math.sin(k * 6) * 5 : 0), s.y);
      }
    }
    g.globalAlpha = 1;
    void whiteAmb;
  };
})();
