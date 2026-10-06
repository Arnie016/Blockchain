/* Last Call — 3D renderer core. WebGL setup, bloom + film grade, the third-person camera rig,
   projection between the simulation (pixels, y down) and the world (metres, y up), the light rig
   and per-room ambient light, and the 2D overlay for bubbles and HUD marks. World geometry,
   people and effects are built in r3d-world.js, r3d-people.js and r3d-fx.js. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const { U, Map: M } = LC;
  const T = M.T;
  const R3 = (LC.R3 = { ok: !!(THREE && THREE.EffectComposer), is3D: true, zoomMul: 1 });
  if (!R3.ok) return;
  const PX = 1 / T, ZS = 0.04;
  R3.PX = PX; R3.ZS = ZS;
  R3.WALL_H = 4.2;

  /* ================= colour + geometry helpers ================= */
  const colCache = new Map();
  // sRGB hex (or [r,g,b] 0..255) -> linear THREE.Color
  R3.col = (c) => {
    const key = typeof c === 'string' ? c : c.join(',');
    let v = colCache.get(key);
    if (!v) {
      v = typeof c === 'string' ? new THREE.Color(c) : new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
      v.convertSRGBToLinear();
      colCache.set(key, v);
    }
    return v;
  };
  R3.lin = (v) => Math.pow(v, 2.2);

  // level offsets (for stacked floors that live side by side in the simulation grid)
  const DEF_LV = { dx: 0, dy: 0, dz: 0, id: 0 };
  R3.levels = [];
  let lvGrid = null;
  R3.buildLevelGrid = () => {
    lvGrid = new Int8Array(M.W * M.H).fill(-1);
    R3.levels.forEach((L, i) => { for (let y = L.y0; y < L.y1; y++) for (let x = L.x0; x < L.x1; x++) if (x >= 0 && y >= 0 && x < M.W && y < M.H) lvGrid[y * M.W + x] = i; });
  };
  R3.lvAt = (x, y) => {
    if (!lvGrid) return DEF_LV;
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= M.W || ty >= M.H) return DEF_LV;
    const i = lvGrid[ty * M.W + tx];
    return i >= 0 ? R3.levels[i] : DEF_LV;
  };
  // simulation (x px, y px, z px) -> world metres
  R3.toW = (x, y, z, out) => {
    const L = R3.lvAt(x, y);
    out.x = x * PX + L.dx; out.y = (z || 0) * ZS + L.dy; out.z = y * PX + L.dz;
    return out;
  };

  // unit primitives, cached
  const prim = {};
  R3.prim = (kind, seg) => {
    const key = kind + (seg || '');
    if (prim[key]) return prim[key];
    let g;
    switch (kind) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cyl': g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg || 12, 1); break;
      case 'cylo': g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg || 12, 1, true); break;
      case 'cone': g = new THREE.ConeGeometry(0.5, 1, seg || 12, 1); break;
      case 'sph': g = new THREE.SphereGeometry(0.5, seg || 14, Math.max(6, Math.round((seg || 14) * 0.7))); break;
      case 'hsph': g = new THREE.SphereGeometry(0.5, seg || 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); break;
      case 'plane': g = new THREE.PlaneGeometry(1, 1); break;
      case 'torus': g = new THREE.TorusGeometry(0.5, 0.12, 6, seg || 16); break;
      default: throw new Error('prim ' + kind);
    }
    if (g.index) g = g.toNonIndexed();
    prim[key] = g;
    return g;
  };

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  const _nm = new THREE.Matrix3();
  // compose a transform: position, scale, rotation (yaw about Y, then pitch X, roll Z)
  R3.mtx = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _v.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_v, _q, _s);
  };

  // collects coloured primitives into one merged geometry
  class GB {
    constructor(o = {}) { this.p = []; this.n = []; this.c = []; this.u = []; this.r = []; this.room = o.room || 0; this.uv = !!o.uv; }
    add(geo, mat, color, room) {
      const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
      const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
      const e = mat.elements;
      _nm.getNormalMatrix(mat);
      const ne = _nm.elements;
      const cr = color.r, cg = color.g, cb = color.b, rm = room === undefined ? this.room : room;
      for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        const nx = nor[i], ny = nor[i + 1], nz = nor[i + 2];
        let ox = ne[0] * nx + ne[3] * ny + ne[6] * nz, oy = ne[1] * nx + ne[4] * ny + ne[7] * nz, oz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
        const l = Math.hypot(ox, oy, oz) || 1;
        this.n.push(ox / l, oy / l, oz / l);
        this.c.push(cr, cg, cb);
        this.r.push(rm);
        if (this.uv) this.u.push(uv ? uv[j] : 0, uv ? uv[j + 1] : 0);
      }
      return this;
    }
    // convenience: box by world-space extents
    box(x0, y0, z0, x1, y1, z1, color, room, ry = 0) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      return this.add(R3.prim('box'), R3.mtx(cx, cy, cz, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), ry), color, room);
    }
    get count() { return this.p.length / 3; }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('aRoom', new THREE.Float32BufferAttribute(this.r, 1));
      if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.computeBoundingSphere();
      return g;
    }
  }
  R3.GB = GB;

  // a small geometry (no room attribute) from primitives, for instancing
  R3.merge = (parts) => {
    const gb = new GB({ uv: true });
    for (const [geo, mat, color] of parts) gb.add(geo, mat.clone ? mat : mat, color || R3.col('#ffffff'));
    const g = gb.build();
    g.deleteAttribute('aRoom');
    return g;
  };

  /* ================= materials ================= */
  // per-room ambient light: static geometry carries a room index, the shader looks the colour up
  const NR = 40;
  const roomAmb = { value: [] };
  for (let i = 0; i < NR; i++) roomAmb.value.push(new THREE.Vector3(1, 1, 1));
  R3.roomAmb = roomAmb;
  R3.ROOM_OUT = NR - 1;        // outside the building
  const vtxRoom = 'attribute float aRoom;\nuniform vec3 uRoomAmb[' + NR + '];\n';
  // lit material with room ambient (static) or instance ambient + glow (dynamic)
  R3.litMat = (o = {}) => {
    const m = new THREE.MeshLambertMaterial({ color: o.color || 0xffffff, vertexColors: !!o.vc, map: o.map || null, side: o.side || THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity, emissive: o.emissive || 0x000000 });
    const mode = o.inst ? 'inst' : o.room ? 'room' : 'plain';
    const atlas = o.atlas ? 'atlas' : '';
    const alpha = o.alpha ? 'alpha' : '';
    m.onBeforeCompile = (sh) => {
      if (alpha) {
        sh.vertexShader = 'attribute float aAlpha;\nvarying float vAlpha;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = aAlpha;');
        sh.fragmentShader = 'varying float vAlpha;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n  diffuseColor.a *= vAlpha;');
      }
      if (mode === 'room') {
        sh.uniforms.uRoomAmb = roomAmb;
        sh.vertexShader = vtxRoom + sh.vertexShader.replace('#include <lights_lambert_vertex>', '#include <lights_lambert_vertex>\n  vIndirectFront *= uRoomAmb[int(aRoom + 0.5)];');
      } else if (mode === 'inst') {
        sh.vertexShader = 'attribute vec3 aAmb;\nattribute vec3 aGlow;\nvarying vec3 vGlow;\n' + sh.vertexShader
          .replace('#include <lights_lambert_vertex>', '#include <lights_lambert_vertex>\n  vIndirectFront *= aAmb;\n  vGlow = aGlow;');
        sh.fragmentShader = 'varying vec3 vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vGlow;');
      }
      if (atlas) {
        // atlas print: the texture's alpha mixes its colour over the instance colour
        sh.vertexShader = 'attribute float aCell;\nvarying vec2 vAtl;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vAtl = vec2((mod(aCell, ' + o.atlas + '.0) + uv.x) / ' + o.atlas + '.0, 1.0 - (floor(aCell / ' + o.atlas + '.0) + 1.0 - uv.y) / ' + o.atlas + '.0);');
        sh.fragmentShader = 'varying vec2 vAtl;\nuniform sampler2D uAtlas;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  vec4 atl = texture2D(uAtlas, vAtl);\n  diffuseColor.rgb = mix(diffuseColor.rgb, atl.rgb * atl.rgb, atl.a);');
        sh.uniforms.uAtlas = { value: o.atlasTex };
      }
    };
    m.customProgramCacheKey = () => mode + atlas + (o.atlas || '') + alpha;
    if (o.depthWrite !== undefined) m.depthWrite = o.depthWrite;
    if (o.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = o.polygonOffset; }
    return m;
  };
  // unlit material; inst mode multiplies by an instance tint and supports instance alpha
  R3.basicMat = (o = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: o.color === undefined ? 0xffffff : o.color, vertexColors: !!o.vc, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity, blending: o.blending || THREE.NormalBlending, depthWrite: o.depthWrite !== undefined ? o.depthWrite : !o.transparent, side: o.side || THREE.FrontSide, alphaTest: o.alphaTest || 0, fog: o.fog !== undefined ? o.fog : true, toneMapped: false });
    if (o.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = o.polygonOffset; }
    if (o.alpha || o.cell) {
      m.onBeforeCompile = (sh) => {
        let vs = '', fs = '';
        if (o.alpha) { vs += 'attribute float aAlpha;\nvarying float vAlpha;\n'; fs += 'varying float vAlpha;\n'; }
        if (o.cell) { vs += 'attribute float aCell;\n'; }
        sh.vertexShader = vs + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n' +
          (o.alpha ? '  vAlpha = aAlpha;\n' : '') +
          (o.cell ? '  vUv = vec2((mod(aCell, ' + o.cell + '.0) + uv.x) / ' + o.cell + '.0, 1.0 - (floor(aCell / ' + o.cell + '.0) + 1.0 - uv.y) / ' + o.cell + '.0);\n' : ''));
        if (o.alpha) sh.fragmentShader = fs + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n  diffuseColor.a *= vAlpha;');
      };
      m.customProgramCacheKey = () => 'b' + (o.alpha ? 'a' : '') + (o.cell || '');
    }
    return m;
  };
  // add per-instance attributes to an InstancedMesh
  R3.instAttr = (mesh, name, size, fill) => {
    const n = mesh.count;
    const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size).fill(fill === undefined ? 1 : fill), size);
    a.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute(name, a);
    return a;
  };
  // an instanced mesh with colour, ambient and glow channels ready to write
  R3.inst = (geo, mat, max, o = {}) => {
    const g = geo.clone();
    const mesh = new THREE.InstancedMesh(g, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    if (o.lit !== false) { R3.instAttr(mesh, 'aAmb', 3, 1); R3.instAttr(mesh, 'aGlow', 3, 0); }
    if (o.cell) R3.instAttr(mesh, 'aCell', 1, 0);
    if (o.alpha) R3.instAttr(mesh, 'aAlpha', 1, 1);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.matrixAutoUpdate = false;
    mesh.userData.max = max;
    if (o.order !== undefined) mesh.renderOrder = o.order;
    return mesh;
  };
  // mark an instanced mesh as changed
  R3.flush = (mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const a = mesh.geometry.attributes;
    if (a.aAmb) a.aAmb.needsUpdate = true;
    if (a.aGlow) a.aGlow.needsUpdate = true;
    if (a.aCell) a.aCell.needsUpdate = true;
    if (a.aAlpha) a.aAlpha.needsUpdate = true;
  };

  // canvas texture helper
  R3.canvasTex = (w, h, draw, o = {}) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = o.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    t.anisotropy = o.aniso || 4;
    if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    if (o.nearest) { t.magFilter = THREE.NearestFilter; }
    t.userData = t.userData || {};
    t.userData.canvas = c;
    return t;
  };
  // soft round glow texture (white), used for light pools, blob shadows and sprites
  let glowTex = null;
  R3.glowTex = () => glowTex || (glowTex = R3.canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.32, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { linear: true }));

  /* ================= renderer + post ================= */
  let renderer, scene, camera, composer, bloom, grade, overlay, octx, glCanvas;
  let W = 1, H = 1, dpr = 1;
  R3.quality = { level: 2, pr: 1.5, bloom: true };
  const GradeShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 1.0 }, uSat: { value: 1.08 }, uVig: { value: 0.55 },
      uGrain: { value: 0.035 }, uRes: { value: new THREE.Vector2(1, 1) }, uLift: { value: new THREE.Vector3(0.012, 0.004, 0.02) }, uFlash: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uTime, uExposure, uSat, uVig, uGrain, uFlash; uniform vec2 uRes; uniform vec3 uLift, uTint; varying vec2 vUv;',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main(){',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure * uTint;',
      '  c = aces(c);',
      '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
      '  c = mix(vec3(l), c, uSat);',
      '  vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;',
      '  c *= 1.0 - uVig * smoothstep(0.35, 1.25, length(d));',
      '  c = pow(c, vec3(1.0 / 2.2));',
      '  c += uLift * (1.0 - c);',
      '  c += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;',
      '  c = mix(c, vec3(1.0), uFlash);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  };

  R3.init = (cv) => {
    overlay = cv;
    octx = cv.getContext('2d');
    glCanvas = document.createElement('canvas');
    glCanvas.id = 'game3d';
    glCanvas.setAttribute('aria-hidden', 'true');
    glCanvas.style.cssText = 'position:fixed;inset:0;display:block;pointer-events:none;';
    cv.parentNode.insertBefore(glCanvas, cv);
    cv.style.background = 'transparent';
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
    renderer.setClearColor(R3.col('#05040a'), 1);
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.info.autoReset = true;
    R3.renderer = renderer;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(R3.col('#0b0814'), 0.03);
    R3.scene = scene;
    camera = new THREE.PerspectiveCamera(60, 1, 0.08, 260);
    camera.position.set(46, 6, 52);
    R3.camera = camera;
    const isGL2 = renderer.capabilities.isWebGL2;
    const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.78);
    composer.addPass(bloom);
    grade = new THREE.ShaderPass(GradeShader);
    composer.addPass(grade);
    R3.grade = grade; R3.bloom = bloom;
    setupLights();
    try { R3.quality.level = +(localStorage.getItem('lastcall.gfx') || 2); } catch (e) { /* storage blocked */ }
    applyQuality();
    R3.World.build(scene);
    R3.People.build(scene);
    R3.FX.build(scene);
    R3.resize();
  };
  function applyQuality() {
    const q = R3.quality;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    q.pr = q.level >= 2 ? Math.min(d, 1.5) : q.level === 1 ? Math.min(d, 1) : Math.min(d, 0.75);
    q.bloom = q.level >= 1;
    if (bloom) bloom.enabled = q.bloom;
    if (renderer) { renderer.setPixelRatio(q.pr); if (composer) { composer.setPixelRatio(q.pr); composer.setSize(W, H); } }
  }
  R3.setQuality = (lv) => {
    R3.quality.level = U.clamp(lv, 0, 2);
    try { localStorage.setItem('lastcall.gfx', String(R3.quality.level)); } catch (e) { /* storage blocked */ }
    applyQuality();
  };
  R3.resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
    overlay.style.width = W + 'px'; overlay.style.height = H + 'px';
    renderer.setPixelRatio(R3.quality.pr);
    renderer.setSize(W, H, false);
    glCanvas.style.width = W + 'px'; glCanvas.style.height = H + 'px';
    composer.setPixelRatio(R3.quality.pr);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    grade.uniforms.uRes.value.set(W, H);
    R3.cw = W; R3.ch = H; R3.dpr = dpr;
    R3.baseZoom = 1;
  };

  /* ================= lights ================= */
  let hemi, amb, spot, spotTarget;
  const pool = [];
  const NPOOL = 8;
  function setupLights() {
    hemi = new THREE.HemisphereLight(R3.col('#9a8cc8'), R3.col('#2a1c30'), 0.55);
    scene.add(hemi);
    amb = new THREE.AmbientLight(R3.col('#ffffff'), 0.12);
    scene.add(amb);
    for (let i = 0; i < NPOOL; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 1.6);
      scene.add(l);
      pool.push(l);
    }
    spot = new THREE.SpotLight(0xfff4dd, 0, 18, 0.42, 0.45, 1.2);
    spotTarget = new THREE.Object3D();
    scene.add(spot); scene.add(spotTarget);
    spot.target = spotTarget;
    R3.hemi = hemi; R3.amb = amb; R3.spot = spot;
  }
  // candidate lights: static sources near the camera, the dance floor, and the dynamic list
  const cand = [];
  const _w = new THREE.Vector3();
  function updateLights(G) {
    const cx = rig.fx, cz = rig.fz;
    const club = !(G.lightsOn > 0.5);
    cand.length = 0;
    const push = (x, y, z, c, i, r) => { if (i <= 0.01) return; const d = Math.hypot(x - cx, z - cz); if (d > 26 + r) return; cand.push({ x, y, z, c, i, r, s: i * (1.4 - Math.min(1, d / 30)) }); };
    // the dance floor throws its colours at everyone on it
    if (club && G.power && !(G.music && G.music.stopped)) {
      const cols = R3.FX.ledColors ? R3.FX.ledColors() : null;
      if (cols) { push(40.5, 1.4, 17.5, cols[0], 1.6, 9); push(51.5, 1.4, 17.5, cols[1], 1.6, 9); push(46, 1.4, 25.5, cols[2], 1.6, 9); }
    }
    for (const l of M.lights) {
      let i = l.i * (club ? 1 : 0.2);
      if (l.kebab) i = G.kebabOpen ? 0.9 : 0;
      const room = l.room && M.room(l.room);
      if (!G.power && !(room && room.outdoor) && !l.sign) i *= 0.05;
      if (l.flick === 'bulb') i *= Math.sin(G.t * 17) > 0.96 ? 0.3 : 1;
      if (l.flick === 'tube' && club && G.power) i *= Math.sin(G.t * 23) > 0.93 || Math.sin(G.t * 3.1) > 0.985 ? 0.3 : 1;
      if (l.candle) i *= 0.85 + Math.sin(G.t * 9 + l.x) * 0.1;
      if (l.lava) i *= 0.8 + Math.sin(G.t * 0.7 + l.x) * 0.2;
      if (l.string || l.candle) i *= 0.6;
      R3.toW(l.x, l.y, 0, _w);
      push(_w.x, _w.y + (l.string ? 2.6 : l.strip ? 2 : 1.3), _w.z, l.c, i * 1.25, l.r * PX * 1.3);
    }
    for (const dl of G.dynLights) {
      if (dl.cone) continue;
      R3.toW(dl.x, dl.y, dl.gz || 12, _w);
      push(_w.x, _w.y + 0.3, _w.z, dl.c, dl.i * 1.4, dl.r * PX * 1.1);
    }
    cand.sort((a, b) => b.s - a.s);
    for (let k = 0; k < NPOOL; k++) {
      const l = pool[k], c = cand[k];
      if (!c) { l.intensity = 0; continue; }
      l.position.set(c.x, c.y, c.z);
      l.color.copy(R3.col(c.c));
      l.intensity = c.i;
      l.distance = Math.max(3, c.r * 1.6);
    }
    // the torch
    const p = G.player;
    const fl = G.dynLights.find((d) => d.cone);
    if (fl && p && !G.demo) {
      R3.toW(p.x, p.y, 34, _w);
      spot.position.set(_w.x + Math.cos(p.face) * 0.25, _w.y, _w.z + Math.sin(p.face) * 0.25);
      spotTarget.position.set(_w.x + Math.cos(p.face) * 8, 0, _w.z + Math.sin(p.face) * 8);
      spot.intensity = 3.2;
    } else spot.intensity = 0;
    // global fill: dim purple club light, fluorescent white when the lights come on
    const on = G.lightsOn || 0;
    hemi.intensity = U.lerp(0.62, 1.25, on) * (G.power ? 1 : 0.35);
    hemi.color.copy(R3.col(on > 0.5 ? '#f4f6ff' : '#a898d8'));
    hemi.groundColor.copy(R3.col(on > 0.5 ? '#9a9aa0' : '#34203a'));
    amb.intensity = U.lerp(0.14, 0.35, on);
    if (G.alarm && Math.sin(G.t * 9) > 0.6) { hemi.color.copy(R3.col('#ff5050')); hemi.intensity *= 1.4; }
  }

  // per-room ambient (the 2D game's room colours, now as an ambient multiplier)
  const ambTmp = [0, 0, 0];
  function updateRoomAmbient(G) {
    const on = G.lightsOn || 0;
    for (const room of M.rooms) {
      let a = room.amb;
      a = [a[0], a[1], a[2]];
      if (!room.outdoor && on > 0) a = U.mix(a, [236, 240, 226], on);
      if (!G.power && !room.outdoor) a = U.mix(a, [10, 10, 18], 0.8);
      if (room.id === 'mens' && G.power && on < 0.5) { const f = Math.sin(G.t * 23) > 0.93 || Math.sin(G.t * 3.1) > 0.985 ? 0.5 : 1; a = a.map((v) => v * f); }
      const v = roomAmb.value[room.index];
      // normalised so a typical club room (~90) reads as 1.0
      v.set(R3.lin(a[0] / 255) * 7, R3.lin(a[1] / 255) * 7, R3.lin(a[2] / 255) * 7);
    }
    const o = roomAmb.value[R3.ROOM_OUT];
    const k = G.power ? 1 : 0.8;
    o.set(0.55 * k, 0.55 * k, 0.8 * k);
    void ambTmp;
  }
  // ambient multiplier for a moving thing at (x, y)
  const ambOut = new THREE.Vector3();
  R3.ambAt = (x, y) => {
    const r = M.roomAt(x, y);
    return r ? roomAmb.value[r.index] : roomAmb.value[R3.ROOM_OUT];
  };
  R3.roomIndexAt = (x, y) => { const r = M.roomAt(x, y); return r ? r.index : R3.ROOM_OUT; };
  void ambOut;

  /* ================= camera rig ================= */
  const rig = R3.rig = {
    yaw: -Math.PI / 2, pitch: 0.34, dist: 5.4, tdist: 5.4, fx: 46, fy: 1.5, fz: 46, mode: 'third',
    shx: 0, shy: 0, t: 0, lookVel: 0, auto: 0,
  };
  R3.cam = { x: 46 * T, y: 44 * T, zoom: 1, shake: 0, vx: 46 * T, vy: 44 * T };
  const DIST = [3.2, 5.4, 8.5, 14];
  R3.cycleZoom = () => { const i = DIST.findIndex((d) => d >= rig.tdist - 0.01); rig.tdist = DIST[(i + 1) % DIST.length]; };
  R3.look = (dx, dy) => {
    rig.yaw += dx * 0.0032;
    rig.pitch = U.clamp(rig.pitch + dy * 0.0028, -0.25, 1.35);
    rig.auto = 0;
  };
  R3.zoomBy = (d) => { rig.tdist = U.clamp(rig.tdist * (d > 0 ? 1.15 : 1 / 1.15), 2.4, 18); };
  // WASD relative to where the camera looks
  R3.moveBasis = (dx, dy) => {
    const fx = Math.cos(rig.yaw), fy = Math.sin(rig.yaw);
    return { dx: fx * -dy + -fy * dx, dy: fy * -dy + fx * dx };
  };
  R3.lookAngle = () => rig.yaw;

  // camera collides with walls (2D segments), pulls in toward the player
  function segT(ax, ay, bx, by, cx, cy, dx, dy) {
    const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
    const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  }
  function clipCam(ax, ay, bx, by) {
    let best = 1;
    for (const s of M.segs) {
      if (s.kind === 'stall' || s.kind === 'low' || s.kind === 'rope') continue;
      if (s.kind === 'door' && !s.active) continue;
      const t = segT(ax, ay, bx, by, s.ax, s.ay, s.bx, s.by);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
  // the first doorway the camera line passes through (door openings have a header above 2.45 m)
  function doorCross(ax, ay, bx, by) {
    let best = 1;
    for (const d of M.doors) {
      if (d.wallKind !== 'ext' && d.wallKind !== 'wall') continue;
      const t = segT(ax, ay, bx, by, d.x0, d.y0, d.x1, d.y1);
      if (t !== null && t < best) best = t;
    }
    return best;
  }

  const _tgt = new THREE.Vector3();
  let lastT = performance.now();
  R3.updateCamera = (dt, G) => {
    const p = G.player;
    const c = R3.cam;
    c.shake = Math.max(0, (c.shake || 0) - dt * 22);
    rig.t += dt;
    rig.dist = U.damp(rig.dist, rig.tdist, 6, dt);
    if (G.demo || !p) {
      // attract mode: a slow orbit over the dance floor
      const k = rig.t * 0.05;
      const cx = 46 + Math.sin(k * 0.7) * 3, cz = 22 + Math.cos(k * 0.5) * 2;
      camera.position.set(cx + Math.cos(k) * 15, 7.5 + Math.sin(k * 0.8) * 1.5, cz + Math.sin(k) * 13);
      camera.lookAt(cx, 1.2, cz);
      rig.fx = cx; rig.fz = cz;
      camera.fov = 55; camera.updateProjectionMatrix();
      return;
    }
    R3.toW(p.x, p.y, p.z || 0, _tgt);
    const lv = R3.lvAt(p.x, p.y);
    // follow point: over the shoulder, a little to the right
    const tx = _tgt.x, ty = _tgt.y + 1.55, tz = _tgt.z;
    rig.fx = U.damp(rig.fx, tx, 14, dt); rig.fz = U.damp(rig.fz, tz, 14, dt); rig.fy = U.damp(rig.fy, ty, 10, dt);
    const far = rig.dist > 9;
    const pitch = far ? Math.max(rig.pitch, 0.55 + (rig.dist - 9) * 0.05) : rig.pitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const fx = Math.cos(rig.yaw), fz = Math.sin(rig.yaw);
    const side = far ? 0 : 0.42 * Math.min(1, rig.dist / 5);
    const rx = -fz, rz = fx;
    let d = rig.dist;
    // don't put the camera through a wall
    if (!far) {
      const ax = rig.fx + rx * side * 0.3, az = rig.fz + rz * side * 0.3;
      const bx = rig.fx - fx * cp * d + rx * side, bz = rig.fz - fz * cp * d + rz * side;
      const k = clipCam((ax - lv.dx) * T, (az - lv.dz) * T, (bx - lv.dx) * T, (bz - lv.dz) * T);
      if (k < 1) d = Math.max(0.6, d * k - 0.35);
    }
    let px = rig.fx - fx * cp * d + rx * side, py = rig.fy + sp * d, pz = rig.fz - fz * cp * d + rz * side;
    // duck under door headers instead of looking through them
    if (!far) {
      const kd = doorCross((rig.fx - lv.dx) * T, (rig.fz - lv.dz) * T, (px - lv.dx) * T, (pz - lv.dz) * T);
      if (kd < 1) { const maxY = rig.fy + (2.3 + lv.dy - rig.fy) / Math.max(0.05, kd); if (py > maxY) py = Math.max(rig.fy - 0.3, maxY); }
    }
    // stay under the ceiling indoors
    const room = M.roomAt(p.x, p.y);
    if (!far && room && !room.outdoor) py = Math.min(py, lv.dy + R3.WALL_H - 0.35);
    if (c.shake > 0) { px += (Math.random() - 0.5) * c.shake * 0.025; py += (Math.random() - 0.5) * c.shake * 0.02; }
    camera.position.set(px, py, pz);
    camera.lookAt(rig.fx + rx * side * 0.9 + fx * 2.2, rig.fy - 0.25 + (far ? -1.2 : 0), rig.fz + rz * side * 0.9 + fz * 2.2);
    const fov = p.sprinting ? 66 : 60;
    if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = U.damp(camera.fov, fov, 5, dt); camera.updateProjectionMatrix(); }
    c.x = p.x; c.y = p.y; c.vx = p.x; c.vy = p.y;
  };

  /* ================= projection ================= */
  const _p = new THREE.Vector3();
  R3.toScreen = (x, y, z = 0) => {
    R3.toW(x, y, z, _p);
    _p.project(camera);
    const behind = _p.z > 1;
    return { x: (_p.x * 0.5 + 0.5) * W, y: (-_p.y * 0.5 + 0.5) * H + (behind ? 1e5 : 0), behind };
  };
  // screen position clamped to the screen edge (for off-screen cues); a = angle on screen
  R3.edgePoint = (x, y, z = 0, margin = 60) => {
    R3.toW(x, y, z, _p);
    _p.applyMatrix4(camera.matrixWorldInverse);
    // camera space: x right, y up, -z forward
    let sx = _p.x, sy = -_p.y;
    if (_p.z > -0.1) { sy = Math.abs(sy) + 1; }
    const a = Math.atan2(sy, sx);
    const s = R3.toScreen(x, y, z);
    const on = !s.behind && s.x > margin && s.x < W - margin && s.y > margin && s.y < H - margin;
    if (on) return { x: s.x, y: s.y, on: true, a };
    const hw = W / 2 - margin, hh = H / 2 - margin;
    const k = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
    return { x: W / 2 + Math.cos(a) * k, y: H / 2 + Math.sin(a) * k, on: false, a };
  };
  const ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  // what's under a screen point: a person (preferred) or the floor. Returns sim coords.
  R3.pick = (sx, sy) => {
    _ndc.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
    ray.setFromCamera(_ndc, camera);
    _o.copy(ray.ray.origin); _d.copy(ray.ray.direction);
    const G = LC.G;
    let best = null, bt = 1e9;
    if (G) {
      for (const c of G.chars) {
        if (c === G.player || c.hidden || c.gone) continue;
        R3.toW(c.x, c.y, c.z || 0, _w);
        const lying = c.pose === 'fallen' || c.pose === 'lie' || c.pose === 'sleepFloor';
        const h0 = _w.y + (lying ? 0.05 : 0.2), h1 = _w.y + (lying ? 0.45 : 1.75);
        // closest approach between the ray and a vertical segment at the person
        const t = ((_w.x - _o.x) * _d.x + (_w.z - _o.z) * _d.z) / Math.max(1e-6, _d.x * _d.x + _d.z * _d.z);
        if (t < 0.5 || t > 30) continue;
        const qx = _o.x + _d.x * t, qy = _o.y + _d.y * t, qz = _o.z + _d.z * t;
        if (qy < h0 - 0.1 || qy > h1 + 0.1) continue;
        const dd = Math.hypot(qx - _w.x, qz - _w.z);
        const rr = lying ? 0.75 : 0.36 + t * 0.012;
        if (dd > rr) continue;
        if (t < bt) { bt = t; best = c; }
      }
    }
    // floor under the ray, on the player's level
    const p = G && G.player;
    const fy = p ? R3.lvAt(p.x, p.y).dy : 0;
    let fx, fz;
    if (_d.y < -0.01) {
      const t = (fy - _o.y) / _d.y;
      const tt = Math.min(t, 24);
      fx = _o.x + _d.x * tt; fz = _o.z + _d.z * tt;
    } else { fx = _o.x + _d.x * 12; fz = _o.z + _d.z * 12; }
    R3.picked = best;
    if (best) return { x: best.x, y: best.y, who: best };
    const L = p ? R3.lvAt(p.x, p.y) : DEF_LV;
    return { x: (fx - L.dx) * T, y: (fz - L.dz) * T, who: null };
  };
  R3.toWorld = (sx, sy) => R3.pick(sx, sy);

  /* ================= frame ================= */
  let frameId = 0, syncedFrame = -1, perfAcc = 0, perfN = 0, slowT = 0;
  function sync(G) {
    if (syncedFrame === frameId) return;
    syncedFrame = frameId;
    updateRoomAmbient(G);
    R3.World.update(G, R3.dt);
    R3.People.update(G, R3.dt);
    R3.FX.update(G, R3.dt);
    updateLights(G);
  }
  R3.draw = (G, hooks) => {
    const now = performance.now();
    R3.dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    frameId++;
    sync(G);
    if (hooks && hooks.skip) { R3.blank(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, overlay.width, overlay.height); return; }
    // post settings follow the state of the night
    const on = G.lightsOn || 0;
    const gu = grade.uniforms;
    gu.uTime.value = G.t;
    gu.uSat.value = U.lerp(1.12, 0.8, on) * (G.power ? 1 : 0.7);
    gu.uExposure.value = U.lerp(1.08, 1.0, on) * (hooks && hooks.dim ? 0.55 : 1);
    gu.uVig.value = U.lerp(0.6, 0.35, on);
    gu.uFlash.value = Math.max(0, gu.uFlash.value - R3.dt * 3);
    bloom.strength = U.lerp(0.95, 0.35, on);
    scene.fog.density = U.lerp(0.032, 0.012, on);
    scene.fog.color.copy(R3.col(on > 0.5 ? '#2a2a30' : '#0b0814'));
    if (!(hooks && hooks.skip)) {
      composer.render();
      // auto quality: sustained slow frames step the resolution down
      perfAcc += R3.dt; perfN++;
      if (perfN >= 90) {
        const avg = perfAcc / perfN;
        perfAcc = 0; perfN = 0;
        if (avg > 0.034 && R3.quality.level > 0 && R3.autoQuality !== false) { slowT++; if (slowT >= 2) { slowT = 0; R3.setQuality(R3.quality.level - 1); } } else slowT = 0;
      }
    }
    // 2D overlay
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!(hooks && hooks.skip)) {
      R3.FX.drawOverlay(octx, G, dpr);
      LC.R2D.drawBubbles(octx, G, R3);
      if (hooks && hooks.screen) { octx.setTransform(dpr, 0, 0, dpr, 0, 0); hooks.screen(octx); }
    }
  };
  R3.flash = (k) => { grade.uniforms.uFlash.value = Math.max(grade.uniforms.uFlash.value, k); };

  /* ================= CCTV feeds ================= */
  const ccam = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 90);
  R3.renderView = (g, v, G, opts) => {
    sync(G);
    const w = opts.w, h = opts.h;
    const cam = M.cams.find((c) => Math.abs(c.x - v.x) < 1 && Math.abs(c.y - v.y) < 1) || { vw: 20, x: v.x, y: v.y };
    R3.toW(cam.x, cam.y, 0, _w);
    const span = cam.vw;
    // high in the corner, looking down across the room
    const hgt = Math.min(R3.WALL_H - 0.3, 2.2 + span * 0.08);
    const outdoor = M.isOutdoor(cam.x, cam.y);
    const back = span * (outdoor ? 0.42 : 0.36);
    ccam.aspect = w / h;
    ccam.fov = outdoor ? 58 : 68;
    ccam.updateProjectionMatrix();
    ccam.position.set(_w.x - span * 0.08, _w.y + (outdoor ? hgt + span * 0.2 : hgt), _w.z + back);
    ccam.lookAt(_w.x, _w.y, _w.z - span * 0.05);
    const pr = renderer.getPixelRatio();
    // night vision amplifies whatever light there is
    const hi = hemi.intensity, ai = amb.intensity;
    hemi.intensity = hi * 2.6; amb.intensity = ai + 0.45;
    const fogD = scene.fog.density;
    scene.fog.density = fogD * 0.4;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, w / pr, h / pr);
    renderer.setScissor(0, 0, w / pr, h / pr);
    renderer.setScissorTest(true);
    R3.People.cctvMode = true;
    renderer.render(scene, ccam);
    R3.People.cctvMode = false;
    renderer.setScissorTest(false);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);
    // linear output: brighten before the night-vision tint
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.7;
    g.drawImage(g.canvas, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    hemi.intensity = hi; amb.intensity = ai; scene.fog.density = fogD;
    renderer.setViewport(0, 0, W, H);
  };
  // the tablet covers the screen: keep the canvas behind it black
  R3.blank = () => { renderer.setRenderTarget(null); renderer.setViewport(0, 0, W, H); renderer.clear(); };

  R3.invalidateFloors = () => {};
  R3.fontsReady = () => { if (R3.World.fontsReady) R3.World.fontsReady(); };
  R3.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, q: R3.quality.level });
})();
