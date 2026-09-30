/* Last Call — people: appearance generation, names, and the procedural 3/4-view figure with
   poses and exaggerated faces. Everything is drawn in world units (feet at 0,0). */
(function () {
  'use strict';
  const { U } = LC;
  const Pp = (LC.People = {});

  const SKIN = ['#f7dcc8', '#efc3a3', '#e2ad86', '#cf9366', '#b07249', '#8f5637', '#6e3f27', '#4c2b1a'];
  const HAIRC = ['#17110d', '#2b1d16', '#3f281b', '#5c3b22', '#7d5028', '#a8743a', '#d6b06a', '#ecdcae', '#a3a3a8', '#e64f93', '#4a78e6', '#9a52e6', '#e0482e', '#2fd0b0'];
  const TOPC = ['#141418', '#202028', '#f0f0f2', '#e8375a', '#2f7ae5', '#1fbf8f', '#f5c542', '#a64dff', '#ff6b35', '#3a3f58', '#c9c9d4', '#b31d42', '#0d7a6a', '#ffc2d6', '#7fe0ff', '#ff4fd8', '#6be36b'];
  const BOTC = ['#1c2230', '#2d4a7a', '#121214', '#3a2e28', '#63636e', '#e8e0d0', '#4a2f4f', '#26443a'];
  const SHOEC = ['#111', '#f2f2f2', '#6b3f22', '#c22', '#222a44', '#e8d8b0'];
  const HAIRS_M = ['short', 'buzz', 'slick', 'curly', 'afro', 'spiky', 'bald', 'side', 'mohawk', 'short', 'buzz', 'braids'];
  const HAIRS_F = ['long', 'pony', 'bun', 'bob', 'curly', 'afro', 'long', 'braids', 'pixie', 'long', 'pony'];
  const TOPS_M = ['tee', 'shirt', 'tee', 'jacket', 'hoodie', 'tank', 'shirt', 'jersey', 'suit', 'hawaiian'];
  const TOPS_F = ['dress', 'crop', 'blouse', 'dress', 'sequin', 'tee', 'jacket', 'dress', 'tank', 'suit'];

  const NAMES_M = ['Kevin', 'Brandon', 'Tyler', 'Jake', 'Marcus', 'Dev', 'Omar', 'Luca', 'Connor', 'Raj', 'Theo', 'Dmitri', 'Kai', 'Andre', 'Callum', 'Mateo', 'Hiro', 'Kwame', 'Finn', 'Dave', 'Gav', 'Stefan', 'Tomasz', 'Ricky', 'Josh', 'Liam', 'Sanjay', 'Paulo', 'Nico', 'Ben', 'Craig', 'Dylan'];
  const NAMES_F = ['Brenda', 'Kayleigh', 'Priya', 'Jess', 'Aisha', 'Sofia', 'Chloe', 'Mia', 'Zoe', 'Leah', 'Nadia', 'Tash', 'Grace', 'Amara', 'Yuki', 'Rosa', 'Ines', 'Becca', 'Dani', 'Freya', 'Lola', 'Hannah', 'Keisha', 'Mei', 'Olivia', 'Siobhan', 'Tara', 'Vic', 'Wren', 'Anya', 'Fatima', 'Kat'];
  Pp.SKIN = SKIN;

  Pp.randomLook = (o = {}) => {
    const fem = o.fem !== undefined ? o.fem : Math.random() < 0.5;
    const look = {
      fem,
      skin: U.pick(SKIN),
      hair: U.pick(fem ? HAIRS_F : HAIRS_M),
      hairC: Math.random() < 0.1 ? U.pick(HAIRC.slice(9)) : U.pick(HAIRC.slice(0, 9)),
      top: U.pick(fem ? TOPS_F : TOPS_M),
      topC: U.pick(TOPC),
      topC2: U.pick(TOPC),
      bot: fem ? U.pick(['skirt', 'jeans', 'pants', 'skirt', 'shorts']) : U.pick(['jeans', 'pants', 'jeans', 'shorts']),
      botC: U.pick(BOTC),
      shoes: U.pick(SHOEC),
      build: U.rand(0.86, 1.18) + (fem ? -0.06 : 0.04),
      height: U.rand(0.93, 1.08) + (fem ? -0.03 : 0.02),
      glasses: Math.random() < 0.08 ? 'sun' : Math.random() < 0.08 ? 'nerd' : null,
      hat: Math.random() < 0.09 ? U.pick(['cap', 'beanie', 'cap', 'cowboy']) : null,
      beard: !fem && Math.random() < 0.3 ? U.pick(['stubble', 'full', 'goatee', 'mustache']) : null,
      chain: Math.random() < 0.12,
      earrings: fem ? Math.random() < 0.5 : Math.random() < 0.1,
      glow: Math.random() < 0.1,
      bag: fem && Math.random() < 0.4,
      sash: null,
      wristband: true,
    };
    if (look.top === 'dress') look.bot = 'none';
    if (look.hair === 'bald' && look.hat === null && Math.random() < 0.3) look.hat = 'cap';
    return Object.assign(look, o.look || {});
  };
  Pp.randomName = (fem) => U.pick(fem ? NAMES_F : NAMES_M);

  /* ---------------- drawing ---------------- */
  const OUT = 'rgba(12,8,22,0.62)';
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  Pp.rr = rr;
  function limb(g, x0, y0, x1, y1, w, col) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  function shade(hex, k) { return U.shade(hex, k); }
  const shadeCache = new Map();
  function sh(hex, k) {
    const key = hex + k;
    let v = shadeCache.get(key);
    if (!v) { v = shade(hex, k); shadeCache.set(key, v); }
    return v;
  }

  // arm target offsets per pose relative to the shoulder; returns [lx, ly, rx, ry] hand positions
  function armPose(ch, pose, t, sw, sx, sy, bw) {
    const L = 11.5;
    const sL = -bw * 0.5 + 1, sR = bw * 0.5 - 1;
    let l = [sL - 1.5, sy + L], r = [sR + 1.5, sy + L];
    const beat = ch.beat || 0;
    switch (pose) {
      case 'walk': case 'run': {
        const k = pose === 'run' ? 5 : 3;
        l = [sL - 1 + Math.sin(sw) * k * 0.4, sy + L - 1 + Math.cos(sw) * 0.5]; r = [sR + 1 - Math.sin(sw) * k * 0.4, sy + L - 1 - Math.cos(sw) * 0.5];
        l[1] -= Math.max(0, Math.sin(sw)) * k * 0.4; r[1] -= Math.max(0, -Math.sin(sw)) * k * 0.4;
        break;
      }
      case 'dance': {
        const st = ch.danceStyle || 0, b = Math.sin(beat * Math.PI * 2), b2 = Math.sin(beat * Math.PI);
        if (st === 0) { l = [sL - 3, sy - 9 - b2 * 3]; r = [sR + 3, sy - 9 - b2 * 3]; }                     // hands up
        else if (st === 1) { l = [sL - 2, sy + 8]; r = [sR + 2 + b * 2, sy - 10 - b2 * 3]; }              // fist pump
        else if (st === 2) { l = [sL - 5 - b * 3, sy + 3]; r = [sR + 5 - b * 3, sy + 3]; }                 // side sway
        else if (st === 3) { l = [sL - 6, sy + (b > 0 ? -2 : 6)]; r = [sR + 6, sy + (b > 0 ? 6 : -2)]; }   // robot
        else if (st === 4) { l = [sL - 8 - b2 * 2, sy - 2]; r = [sR + 8 + b2 * 2, sy - 2 + b * 4]; }       // sprinkler
        else { l = [sL - 4 + Math.sin(t * 9) * 5, sy - 4 + Math.cos(t * 7) * 7]; r = [sR + 4 + Math.cos(t * 8) * 5, sy - 6 + Math.sin(t * 10) * 7]; } // flail
        break;
      }
      case 'hang': case 'climb': l = [sL, sy - 12]; r = [sR, sy - 12]; break;
      case 'fight': {
        const p = ch.punch || 0;
        l = [sL + 3, sy + 3]; r = [sR + 2 + p * 9, sy + 2 - p * 2];
        if (ch.punchSide) { const tmp = l; l = [sL - 2 - p * 9, sy + 2 - p * 2]; r = [sR - 3, sy + 3]; void tmp; }
        break;
      }
      case 'carry': case 'carryUp': l = [sL + 1, sy + 6]; r = [sR - 1, sy + 6]; if (pose === 'carryUp') { l = [sL - 1, sy - 10]; r = [sR + 1, sy - 10]; } break;
      case 'dragged': l = [sL - 6 + Math.sin(t * 14) * 3, sy + 2 + Math.cos(t * 12) * 5]; r = [sR + 8, sy + 2]; break;
      case 'grab': { const a = ch.grabAng || 0; r = [sR + Math.cos(a) * 12, sy + 3 + Math.sin(a) * 5]; l = [sL + Math.cos(a) * 10, sy + 4 + Math.sin(a) * 5]; break; }
      case 'vomit': l = [sL + 3, sy + 7]; r = [sR - 2, sy + 9]; break;
      case 'cry': l = [-2.5, sy - 5]; r = [2.5, sy - 5]; break;
      case 'polite': l = [-1.5, sy + 9]; r = [1.5, sy + 9]; break;
      case 'restrained': l = [-1, sy + 11]; r = [1, sy + 11]; break;
      case 'phone': l = [sL - 1, sy + L]; r = [sR - 3, sy - 4]; break;
      case 'drink': { const up = ch.sip > 0 ? 1 : 0; l = [sL - 1.5, sy + L]; r = [sR - 1 - up * 4, sy + 4 - up * 8]; break; }
      case 'shrug': l = [sL - 6, sy + 1]; r = [sR + 6, sy + 1]; break;
      case 'point': { const a = ch.pointAng || 0; r = [sR + Math.cos(a) * 13, sy + 2 + Math.sin(a) * 6]; break; }
      case 'smoke': l = [sL - 1, sy + L]; r = [sR - 4, sy - 3 + Math.max(0, Math.sin(t * 0.8)) * 6]; break;
      case 'sit': l = [sL - 2, sy + 9]; r = [sR + 2, sy + 9]; break;
      case 'argue': { const k = Math.sin(t * 7); l = [sL - 5, sy + 3 + k * 4]; r = [sR + 7, sy - 3 - k * 5]; break; }
      case 'wave': r = [sR + 4, sy - 11 + Math.sin(t * 12) * 2]; break;
      case 'crossed': l = [sR - 1, sy + 7]; r = [sL + 1, sy + 7]; break;
      case 'mop': case 'broom': l = [sL + 2, sy + 6]; r = [sR + 1, sy + 9]; break;
      case 'hold': r = [sR + 3, sy + 5]; break;
      default: {
        const br = Math.sin(t * 1.7) * 0.4;
        l = [sL - 1.2, sy + L + br]; r = [sR + 1.2, sy + L + br];
      }
    }
    return [l[0] + sx, l[1], r[0] + sx, r[1]];
  }

  // main figure. ch: { look, face, pose, t, walk, expr, drunk, beat, z, ... }
  Pp.draw = (g, ch, x, y, o = {}) => {
    const lk = ch.look;
    const pose = ch.pose || 'stand';
    const t = ch.t || 0;
    const hgt = lk.height || 1, bw = 14 * (lk.build || 1);
    const back = ch.back;                          // facing away from camera
    const side = Math.cos(ch.face || 0);           // -1 left .. 1 right
    const sw = ch.walk || 0;

    g.save();
    g.translate(x, y - (ch.z || 0));
    if (pose === 'lie' || pose === 'fallen' || pose === 'sleepFloor') {
      const dir = ch.fallSide || 1;
      g.translate(0, -6);
      g.rotate(dir * Math.PI / 2 * (ch.fallK === undefined ? 1 : ch.fallK));
      g.translate(0, 22 * hgt);
    }
    let lean = ch.lean || 0;
    if (ch.drunk > 0.45) lean += Math.sin(t * 1.9 + (ch.seed || 0)) * 0.06 * ch.drunk;
    if (pose === 'dragged') lean += -0.25 * (ch.dragDir || 1);
    if (pose === 'run') lean += 0.12 * side;
    if (pose === 'vomit') lean += 0.35 * (side >= 0 ? 1 : -1);
    if (lean) g.rotate(lean);

    const sitting = pose === 'sit';
    const crouch = pose === 'crouch' || pose === 'vomit' || pose === 'cry' && ch.crouchCry;
    let bob = 0;
    if (pose === 'dance') bob = -Math.abs(Math.sin((ch.beat || 0) * Math.PI)) * 3.2 * (0.5 + (ch.energy || 0.6));
    else if (pose === 'walk') bob = -Math.abs(Math.sin(sw)) * 1.3;
    else if (pose === 'run') bob = -Math.abs(Math.sin(sw)) * 2.2;
    else if (pose === 'fight') bob = -Math.abs(Math.sin(t * 8)) * 1.5;

    const legH = (sitting ? 5 : crouch ? 8 : 13) * hgt;
    const hipY = -legH + bob;
    const torsoH = 16 * hgt;
    const shY = hipY - torsoH;
    const headR = 7.7;
    const hx = (back ? 0 : side * 0.8) + (pose === 'dance' && ch.danceStyle === 2 ? Math.sin((ch.beat || 0) * Math.PI * 2) * 1.5 : 0);
    const hy = shY - headR + 0.5;

    // shadow
    if (!o.noShadow) {
      g.fillStyle = 'rgba(0,0,0,0.33)';
      g.beginPath(); g.ellipse(0, (ch.z || 0) * 0.3, bw * 0.62, 4.2, 0, 0, 7); g.fill();
    }

    // legs
    const legC = lk.bot === 'none' || lk.bot === 'skirt' || lk.bot === 'shorts' ? lk.skin : lk.botC;
    const lx = 3.3 * (lk.build || 1);
    let l0 = 0, l1 = 0, kx0 = 0, kx1 = 0;
    if (pose === 'walk' || pose === 'run') { const k = pose === 'run' ? 3.6 : 2.4; l0 = Math.sin(sw) * k; l1 = -l0; }
    if (pose === 'dance') { const b = Math.sin((ch.beat || 0) * Math.PI * 2); kx0 = b * 1.5; kx1 = b * 1.5; }
    if (pose === 'dragged') { kx0 = 3 * (ch.dragDir || 1); kx1 = 5 * (ch.dragDir || 1); }
    if (pose === 'hang') { const s = Math.sin(t * 2.2) * 3; kx0 = s; kx1 = s + 1; }
    if (sitting) {
      limb(g, -lx, hipY, -lx - 1, -1, 5, legC); limb(g, lx, hipY, lx + 1, -1, 5, legC);
    } else {
      limb(g, -lx + kx0 * 0.3, hipY, -lx + kx0 + l0 * 0.3, -2 - Math.max(0, l0) * 0.6, 5, legC);
      limb(g, lx + kx1 * 0.3, hipY, lx + kx1 + l1 * 0.3, -2 - Math.max(0, l1) * 0.6, 5, legC);
    }
    // shoes (one sock if they lost a shoe)
    g.fillStyle = lk.shoes;
    const fy0 = sitting ? 0 : -1 - Math.max(0, l0) * 0.6, fy1 = sitting ? 0 : -1 - Math.max(0, l1) * 0.6;
    g.beginPath(); g.ellipse(-lx + kx0 + l0 * 0.3 + (sitting ? -1 : 0), fy0, 3.4, 2, 0, 0, 7); g.fill();
    g.fillStyle = ch.lostShoe ? '#f4f4f4' : lk.shoes;
    g.beginPath(); g.ellipse(lx + kx1 + l1 * 0.3 + (sitting ? 1 : 0), fy1, ch.lostShoe ? 2.6 : 3.4, 2, 0, 0, 7); g.fill();

    // back hair (behind body)
    if (!back && (lk.hair === 'long' || lk.hair === 'braids')) {
      g.fillStyle = lk.hairC;
      rr(g, hx - headR - 1, hy - 2, headR * 2 + 2, headR + 13, 4); g.fill();
    }

    // torso
    const top = lk.top;
    const tc = lk.topC;
    const tw = bw, tw2 = bw * 0.86;
    g.fillStyle = tc;
    g.strokeStyle = OUT; g.lineWidth = 1;
    if (top === 'dress' || top === 'sequin' && lk.bot === 'none') {
      g.beginPath();
      g.moveTo(-tw / 2 + 1, shY + 1); g.lineTo(tw / 2 - 1, shY + 1);
      g.lineTo(tw / 2 + 2.5, hipY + 7); g.lineTo(-tw / 2 - 2.5, hipY + 7);
      g.closePath(); g.fill(); g.stroke();
    } else {
      rr(g, -tw / 2, shY, tw, torsoH + 1, 4); g.fill(); g.stroke();
      // bottoms waistband / skirt
      if (lk.bot === 'skirt') { g.fillStyle = lk.botC; g.beginPath(); g.moveTo(-tw2 / 2, hipY - 1); g.lineTo(tw2 / 2, hipY - 1); g.lineTo(tw2 / 2 + 3, hipY + 5); g.lineTo(-tw2 / 2 - 3, hipY + 5); g.closePath(); g.fill(); }
      else if (lk.bot !== 'none') { g.fillStyle = lk.botC; g.fillRect(-tw2 / 2, hipY - 2, tw2, lk.bot === 'shorts' ? 6 : 3); }
    }
    // outfit details
    if (!back) {
      if (top === 'shirt' || top === 'blouse') { g.strokeStyle = sh(tc, -0.35); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, shY + 1); g.lineTo(0, hipY - 2); g.stroke(); g.fillStyle = sh(tc, 0.25); g.beginPath(); g.moveTo(-3, shY); g.lineTo(0, shY + 4); g.lineTo(3, shY); g.fill(); }
      else if (top === 'jacket' || top === 'suit') { g.fillStyle = top === 'suit' ? sh(tc, 0.7) : lk.topC2; g.beginPath(); g.moveTo(-2.6, shY); g.lineTo(2.6, shY); g.lineTo(0.6, hipY - 1); g.lineTo(-0.6, hipY - 1); g.fill(); if (top === 'suit') { g.fillStyle = '#b3123a'; g.fillRect(-0.7, shY + 2, 1.4, 7); } }
      else if (top === 'hoodie') { g.strokeStyle = sh(tc, -0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(-2, shY + 1); g.lineTo(-2, shY + 6); g.moveTo(2, shY + 1); g.lineTo(2, shY + 6); g.stroke(); g.fillStyle = sh(tc, -0.2); g.fillRect(-4.5, hipY - 7, 9, 4); }
      else if (top === 'jersey') { g.fillStyle = lk.topC2; g.fillRect(-tw / 2, shY + 4, tw, 2.2); g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText(String(ch.number || 9), 0, hipY - 4); }
      else if (top === 'hawaiian') { g.fillStyle = lk.topC2; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-4 + (i * 7) % 9, shY + 3 + i * 2.6, 1.4, 0, 7); g.fill(); } }
      else if (top === 'sequin') { g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 7; i++) { const s = Math.sin(t * 6 + i * 2.1); if (s > 0.4) { g.fillRect(-5 + ((i * 13) % 11), shY + 2 + ((i * 7) % 12), 1.2, 1.2); } } }
      else if (top === 'crop') { g.fillStyle = lk.skin; g.fillRect(-tw / 2 + 2, hipY - 5, tw - 4, 3); }
      else if (top === 'tank') { g.fillStyle = lk.skin; g.fillRect(-tw / 2, shY, 3, 4); g.fillRect(tw / 2 - 3, shY, 3, 4); }
      if (ch.security) { g.fillStyle = '#ffd23f'; g.font = 'bold 3.6px sans-serif'; g.textAlign = 'center'; g.fillText('SECURITY', 0, shY + 7); }
      if (lk.chain) { g.strokeStyle = '#e6c350'; g.lineWidth = 1; g.beginPath(); g.arc(0, shY - 1, 4, 0.4, Math.PI - 0.4); g.stroke(); }
      if (lk.sash) { g.strokeStyle = lk.sashC || '#f0f0f0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-tw / 2 + 1, shY + 1); g.lineTo(tw / 2 - 1, hipY - 1); g.stroke(); }
    } else {
      if (ch.security) { g.fillStyle = '#ffd23f'; g.font = 'bold 4px sans-serif'; g.textAlign = 'center'; g.fillText('SECURITY', 0, shY + 8); }
      if (top === 'jersey') { g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText(String(ch.number || 9), 0, hipY - 4); }
    }
    if (lk.bag && !back) { g.strokeStyle = '#2a1a12'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-tw / 2 + 2, shY); g.lineTo(tw / 2 - 1, hipY - 3); g.stroke(); g.fillStyle = '#7a3a2a'; g.fillRect(tw / 2 - 3, hipY - 5, 4, 4); }

    // arms
    const [alx, aly, arx, ary] = armPose(ch, pose, t, sw, 0, shY + 2, bw);
    const sleeve = top === 'tank' || top === 'dress' || top === 'crop' ? lk.skin : tc;
    const armC = pose === 'restrained' ? sh(tc, -0.2) : sleeve;
    limb(g, -bw / 2 + 1.5, shY + 2.5, alx, aly, 4, armC);
    limb(g, bw / 2 - 1.5, shY + 2.5, arx, ary, 4, armC);
    g.fillStyle = lk.skin;
    g.beginPath(); g.arc(alx, aly, 2.1, 0, 7); g.fill();
    g.beginPath(); g.arc(arx, ary, 2.1, 0, 7); g.fill();
    if (lk.glow) { g.strokeStyle = '#6bffb0'; g.lineWidth = 1; g.beginPath(); g.arc(alx, aly - 1.5, 2.2, 0, 7); g.stroke(); g.strokeStyle = '#ff5ad8'; g.beginPath(); g.arc(arx, ary - 1.5, 2.2, 0, 7); g.stroke(); }
    if (pose === 'restrained') { g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(alx - 2, aly - 1); g.lineTo(arx + 2, ary - 1); g.stroke(); }

    // held things
    const hand = { x: arx, y: ary, lx: alx, ly: aly };
    if (ch.drink && !o.noHeld) drawGlass(g, arx + 1.5, ary - 3, ch.drink);
    if (ch.phoneUp && !o.noHeld) { g.fillStyle = '#111'; rr(g, arx - 2, ary - 7, 4.4, 7, 1); g.fill(); g.fillStyle = ch.filming ? '#fff6d8' : '#6ab4ff'; g.fillRect(arx - 1.3, ary - 6.2, 3, 5.2); if (ch.filming && Math.sin(t * 6) > 0) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(arx + 1.6, ary - 6.6, 0.9, 0, 7); g.fill(); } }
    if (ch.smoking && !o.noHeld) { g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(arx, ary - 1); g.lineTo(arx + 4, ary - 2); g.stroke(); g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(arx + 4.2, ary - 2, 0.9, 0, 7); g.fill(); }
    if (ch.bottle && !o.noHeld) { g.fillStyle = '#1f5a34'; rr(g, arx - 1.6, ary - 10, 3.4, 10, 1.4); g.fill(); g.fillStyle = '#e8e0c0'; g.fillRect(arx - 1.6, ary - 6, 3.4, 2.5); }
    if (ch.heldTool && o.drawTool) o.drawTool(g, ch.heldTool, hand, ch);

    // neck + head
    g.fillStyle = lk.skin;
    g.fillRect(hx - 2, shY - 3, 4, 4);
    let skinC = lk.skin;
    if (ch.expr === 'sick') skinC = mixHex(lk.skin, '#8fcf6a', 0.45);
    else if (ch.expr === 'furious') skinC = mixHex(lk.skin, '#ff4a3a', 0.25);
    g.fillStyle = skinC;
    g.strokeStyle = OUT; g.lineWidth = 1;
    g.beginPath(); g.arc(hx, hy, headR, 0, 7); g.fill(); g.stroke();
    // ears
    g.beginPath(); g.arc(hx - headR + 0.4, hy + 0.8, 1.6, 0, 7); g.arc(hx + headR - 0.4, hy + 0.8, 1.6, 0, 7); g.fill();
    if (lk.earrings && !back) { g.fillStyle = '#ffd86a'; g.beginPath(); g.arc(hx - headR + 0.4, hy + 3.2, 0.9, 0, 7); g.arc(hx + headR - 0.4, hy + 3.2, 0.9, 0, 7); g.fill(); }

    if (back) drawHair(g, lk, hx, hy, headR, true);
    else {
      drawFace(g, ch, hx + side * 1.6, hy, headR, t);
      drawHair(g, lk, hx, hy, headR, false);
    }
    drawHat(g, ch, lk, hx, hy, headR, back);
    if (ch.headphones) { g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy - 1, headR + 0.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = '#e8375a'; g.fillRect(hx - headR - 1.5, hy - 1, 3, 4.5); g.fillRect(hx + headR - 1.5, hy - 1, 3, 4.5); }
    if (ch.earpiece && !back) { g.fillStyle = '#111'; g.beginPath(); g.arc(hx + headR - 0.6, hy + 1, 1.2, 0, 7); g.fill(); }
    g.restore();
    return { headX: x + hx, headY: y - (ch.z || 0) + hy, hand };
  };

  function mixHex(a, b, t) { return U.rgb(U.mix(U.hex(a), U.hex(b), t)); }

  function drawGlass(g, x, y, d) {
    g.fillStyle = 'rgba(220,235,255,0.35)';
    g.beginPath(); g.moveTo(x - 2.4, y - 5); g.lineTo(x + 2.4, y - 5); g.lineTo(x + 1.8, y + 2); g.lineTo(x - 1.8, y + 2); g.closePath(); g.fill();
    const lvl = U.clamp(d.fill === undefined ? 1 : d.fill, 0, 1);
    if (lvl > 0) {
      g.fillStyle = U.rgb(d.c);
      const top = y + 2 - 6.4 * lvl;
      g.beginPath(); g.moveTo(x - 1.8 - 0.6 * lvl, top); g.lineTo(x + 1.8 + 0.6 * lvl, top); g.lineTo(x + 1.8, y + 2); g.lineTo(x - 1.8, y + 2); g.closePath(); g.fill();
    }
  }
  Pp.drawGlass = drawGlass;

  function eye(g, x, y, kind, look, side) {
    switch (kind) {
      case 'closed': g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x + 1.6, y); g.stroke(); break;
      case 'happy': g.beginPath(); g.arc(x, y + 0.8, 1.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); break;
      case 'half': g.beginPath(); g.moveTo(x - 1.7, y - 0.2); g.lineTo(x + 1.7, y - 0.2); g.stroke(); g.fillStyle = '#16121c'; g.beginPath(); g.arc(x + look * 0.4, y + 0.5, 0.95, 0, Math.PI); g.fill(); break;
      case 'wide': g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); g.fillStyle = '#16121c'; g.beginPath(); g.arc(x + look * 0.6, y, 0.85, 0, 7); g.fill(); break;
      case 'spiral': g.beginPath(); g.arc(x, y, 1.6, 0, 5.4); g.stroke(); g.beginPath(); g.arc(x, y, 0.6, 0, 7); g.stroke(); break;
      case 'x': g.beginPath(); g.moveTo(x - 1.3, y - 1.3); g.lineTo(x + 1.3, y + 1.3); g.moveTo(x + 1.3, y - 1.3); g.lineTo(x - 1.3, y + 1.3); g.stroke(); break;
      case 'side': g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 1.9, 1.3, 0, 0, 7); g.fill(); g.fillStyle = '#16121c'; g.beginPath(); g.arc(x + side * 1.1, y, 0.85, 0, 7); g.fill(); break;
      case 'heart': g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(x - 0.7, y - 0.4, 0.9, 0, 7); g.arc(x + 0.7, y - 0.4, 0.9, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x, y + 1.7); g.lineTo(x + 1.6, y); g.fill(); break;
      case 'tired': g.fillStyle = '#16121c'; g.beginPath(); g.arc(x + look * 0.4, y + 0.3, 1, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 1.8, y - 0.9); g.lineTo(x + 1.8, y - 0.6); g.stroke(); g.strokeStyle = 'rgba(80,40,90,0.45)'; g.beginPath(); g.arc(x, y + 1.2, 1.6, 0.2, Math.PI - 0.2); g.stroke(); g.strokeStyle = '#16121c'; break;
      default: g.fillStyle = '#16121c'; g.beginPath(); g.arc(x + look * 0.5, y, 1.15, 0, 7); g.fill();
    }
  }
  function drawFace(g, ch, cx, cy, R, t) {
    const e = ch.expr || 'neutral';
    const side = Math.cos(ch.face || 0);
    let look = side;
    if (ch.lookAt !== undefined) look = ch.lookAt;
    const ex = 2.9, ey = cy - 0.4;
    g.strokeStyle = '#16121c'; g.lineWidth = 0.9; g.lineCap = 'round';
    // blush when drunk or embarrassed
    const blush = Math.max(ch.drunk > 0.5 ? (ch.drunk - 0.5) * 1.2 : 0, e === 'embarrassed' || e === 'love' ? 0.7 : 0);
    if (blush > 0.05) { g.fillStyle = 'rgba(255,70,90,' + (0.4 * blush).toFixed(2) + ')'; g.beginPath(); g.ellipse(cx - 4.2, cy + 2.2, 1.9, 1.1, 0, 0, 7); g.ellipse(cx + 4.2, cy + 2.2, 1.9, 1.1, 0, 0, 7); g.fill(); }
    let eyes = 'dot', brow = null, mouth = 'flat';
    switch (e) {
      case 'happy': eyes = 'dot'; mouth = 'smile'; break;
      case 'laugh': eyes = 'happy'; mouth = 'open'; break;
      case 'drunk': eyes = 'half'; mouth = 'wobbly'; break;
      case 'wasted': eyes = Math.sin(t * 2) > 0 ? 'spiral' : 'half'; mouth = 'open'; break;
      case 'angry': eyes = 'dot'; brow = 'angry'; mouth = 'frown'; break;
      case 'furious': eyes = 'wide'; brow = 'angry'; mouth = 'shout'; break;
      case 'scared': eyes = 'wide'; brow = 'worried'; mouth = 'o'; break;
      case 'sad': eyes = 'dot'; brow = 'worried'; mouth = 'frown'; break;
      case 'cry': eyes = 'closed'; brow = 'worried'; mouth = 'wail'; break;
      case 'embarrassed': eyes = 'side'; mouth = 'wavy'; break;
      case 'smug': eyes = 'half'; mouth = 'smirk'; break;
      case 'shock': eyes = 'wide'; brow = 'up'; mouth = 'O'; break;
      case 'sleep': eyes = 'closed'; mouth = 'o'; break;
      case 'sick': eyes = 'half'; mouth = 'puff'; break;
      case 'suspicious': eyes = 'side'; brow = 'flat'; mouth = 'flat'; break;
      case 'polite': eyes = 'happy'; mouth = 'smile'; break;
      case 'love': eyes = 'heart'; mouth = 'smile'; break;
      case 'confused': eyes = 'dot'; brow = 'confused'; mouth = 'wavy'; break;
      case 'tired': eyes = 'tired'; mouth = 'flat'; break;
      case 'dead': eyes = 'tired'; brow = 'flat'; mouth = 'flat'; break;
      case 'blank': eyes = 'dot'; mouth = 'line'; break;
      case 'shout': eyes = 'dot'; brow = 'angry'; mouth = 'shout'; break;
      case 'talk': eyes = 'dot'; mouth = Math.sin(t * 16) > 0 ? 'o' : 'flat'; break;
      case 'ko': eyes = 'x'; mouth = 'o'; break;
      default: eyes = ch.drunk > 0.72 ? 'half' : 'dot'; mouth = ch.drunk > 0.72 ? 'wobbly' : 'flat';
    }
    if (ch.blink && eyes === 'dot') eyes = 'closed';
    if (ch.look && ch.look.glasses === 'sun') {
      g.fillStyle = '#0c0c10';
      rr(g, cx - ex - 2.4, ey - 1.6, 4.8, 3.2, 1.2); g.fill(); rr(g, cx + ex - 2.4, ey - 1.6, 4.8, 3.2, 1.2); g.fill();
      g.fillRect(cx - ex + 2, ey - 0.9, ex * 2 - 4, 0.9);
    } else {
      eye(g, cx - ex, ey, eyes, look, side);
      eye(g, cx + ex, ey, eyes, look, side);
      if (ch.look && ch.look.glasses === 'nerd') { g.strokeStyle = '#1a1a1a'; g.lineWidth = 0.7; g.beginPath(); g.arc(cx - ex, ey, 2.4, 0, 7); g.moveTo(cx + ex + 2.4, ey); g.arc(cx + ex, ey, 2.4, 0, 7); g.moveTo(cx - ex + 2.4, ey); g.lineTo(cx + ex - 2.4, ey); g.stroke(); g.strokeStyle = '#16121c'; g.lineWidth = 0.9; }
    }
    if (brow) {
      g.beginPath();
      if (brow === 'angry') { g.moveTo(cx - ex - 2, ey - 3.2); g.lineTo(cx - ex + 1.6, ey - 2); g.moveTo(cx + ex + 2, ey - 3.2); g.lineTo(cx + ex - 1.6, ey - 2); }
      else if (brow === 'worried') { g.moveTo(cx - ex - 1.8, ey - 2.2); g.lineTo(cx - ex + 1.6, ey - 3.3); g.moveTo(cx + ex + 1.8, ey - 2.2); g.lineTo(cx + ex - 1.6, ey - 3.3); }
      else if (brow === 'up') { g.moveTo(cx - ex - 1.6, ey - 3.8); g.lineTo(cx - ex + 1.6, ey - 3.8); g.moveTo(cx + ex - 1.6, ey - 3.8); g.lineTo(cx + ex + 1.6, ey - 3.8); }
      else if (brow === 'confused') { g.moveTo(cx - ex - 1.6, ey - 2.6); g.lineTo(cx - ex + 1.6, ey - 2.6); g.moveTo(cx + ex - 1.6, ey - 3.9); g.lineTo(cx + ex + 1.6, ey - 3.2); }
      else { g.moveTo(cx - ex - 1.6, ey - 2.6); g.lineTo(cx - ex + 1.6, ey - 2.6); g.moveTo(cx + ex - 1.6, ey - 2.6); g.lineTo(cx + ex + 1.6, ey - 2.6); }
      g.stroke();
    }
    // beard sits under the mouth
    const lk = ch.look;
    if (lk && lk.beard) {
      g.fillStyle = lk.beard === 'stubble' ? 'rgba(40,28,20,0.35)' : lk.hairC;
      if (lk.beard === 'full' || lk.beard === 'stubble') { g.beginPath(); g.arc(cx, cy + 1.4, R - 1.2, 0.15 * Math.PI, 0.85 * Math.PI); g.fill(); }
      else if (lk.beard === 'goatee') { g.beginPath(); g.ellipse(cx, cy + 5.6, 2, 1.8, 0, 0, 7); g.fill(); }
      else { g.fillRect(cx - 2.6, cy + 2.2, 5.2, 1.3); }
    }
    const my = cy + 3.7;
    g.strokeStyle = '#16121c';
    g.beginPath();
    switch (mouth) {
      case 'smile': g.arc(cx, my - 1.4, 2.4, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
      case 'open': g.fillStyle = '#3a0f1a'; g.arc(cx, my - 0.4, 2.3, 0, Math.PI); g.fill(); break;
      case 'wobbly': g.moveTo(cx - 2.4, my); g.quadraticCurveTo(cx - 0.8, my + 1.6, cx, my + 0.2); g.quadraticCurveTo(cx + 1, my - 1, cx + 2.6, my + 0.8); g.stroke(); break;
      case 'frown': g.arc(cx, my + 1.6, 2.2, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
      case 'shout': g.fillStyle = '#3a0f1a'; g.ellipse(cx, my, 2.2, 1.9 + Math.abs(Math.sin(t * 14)) * 0.7, 0, 0, 7); g.fill(); break;
      case 'o': g.fillStyle = '#3a0f1a'; g.arc(cx, my, 1.1, 0, 7); g.fill(); break;
      case 'O': g.fillStyle = '#3a0f1a'; g.ellipse(cx, my, 1.7, 2.3, 0, 0, 7); g.fill(); break;
      case 'wail': g.fillStyle = '#3a0f1a'; g.ellipse(cx, my + 0.2, 2.8, 1.8, 0, 0, 7); g.fill(); break;
      case 'wavy': g.moveTo(cx - 2.4, my); g.lineTo(cx - 1.2, my - 0.8); g.lineTo(cx, my); g.lineTo(cx + 1.2, my - 0.8); g.lineTo(cx + 2.4, my); g.stroke(); break;
      case 'smirk': g.moveTo(cx - 2, my); g.quadraticCurveTo(cx + 1, my + 0.6, cx + 2.6, my - 1.4); g.stroke(); break;
      case 'puff': g.fillStyle = 'rgba(120,200,90,0.9)'; g.ellipse(cx, my, 3, 1.7, 0, 0, 7); g.fill(); break;
      case 'line': g.moveTo(cx - 1.8, my); g.lineTo(cx + 1.8, my); g.stroke(); break;
      default: g.moveTo(cx - 1.8, my); g.lineTo(cx + 1.8, my); g.stroke();
    }
    if (e === 'cry' || e === 'sad' && ch.tears) {
      g.fillStyle = '#6fc4ff';
      const k = (t * 1.6) % 1;
      g.beginPath(); g.arc(cx - ex, ey + 2 + k * 6, 0.9, 0, 7); g.arc(cx + ex, ey + 2 + ((k + 0.5) % 1) * 6, 0.9, 0, 7); g.fill();
    }
    if (e === 'furious' || e === 'angry' && ch.vein) {
      g.strokeStyle = '#ff2a2a'; g.lineWidth = 1;
      const vx = cx + 4.5, vy = cy - 5.5;
      g.beginPath(); g.moveTo(vx - 1.6, vy); g.lineTo(vx - 0.4, vy); g.lineTo(vx - 0.4, vy - 1.4); g.moveTo(vx + 1.6, vy); g.lineTo(vx + 0.4, vy); g.lineTo(vx + 0.4, vy + 1.4); g.stroke();
    }
    if (ch.sweat) { g.fillStyle = '#9fd8ff'; g.beginPath(); g.ellipse(cx + R - 1, cy - 3 + ((t * 2) % 1) * 3, 1, 1.5, 0, 0, 7); g.fill(); }
  }

  function drawHair(g, lk, hx, hy, R, back) {
    const c = lk.hairC;
    g.fillStyle = c;
    switch (lk.hair) {
      case 'bald': if (!back) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(hx - 2, hy - 4.5, 2.2, 1.2, -0.4, 0, 7); g.fill(); } return;
      case 'buzz': g.globalAlpha = 0.75; g.beginPath(); g.arc(hx, hy, R + 0.2, Math.PI * 1.02, Math.PI * 1.98); g.fill(); if (back) { g.beginPath(); g.arc(hx, hy, R, 0, 7); g.fill(); } g.globalAlpha = 1; return;
      case 'afro': g.beginPath(); g.arc(hx, hy - 2.5, R + 3.4, Math.PI * 0.85, Math.PI * 2.15); g.fill(); if (back) { g.beginPath(); g.arc(hx, hy, R + 2, 0, 7); g.fill(); } return;
      case 'mohawk': for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(hx + i * 1.6 - 1.2, hy - R + 1); g.lineTo(hx + i * 1.6, hy - R - 5 + Math.abs(i)); g.lineTo(hx + i * 1.6 + 1.2, hy - R + 1); g.fill(); } if (back) { g.globalAlpha = 0.5; g.beginPath(); g.arc(hx, hy, R, 0, 7); g.fill(); g.globalAlpha = 1; } return;
      case 'spiky': for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(hx + i * 2.1 - 1.6, hy - R + 3); g.lineTo(hx + i * 2.3, hy - R - 3.2 + Math.abs(i) * 0.6); g.lineTo(hx + i * 2.1 + 1.6, hy - R + 3); g.fill(); } g.beginPath(); g.arc(hx, hy, R + 0.4, Math.PI * 1.05, Math.PI * 1.95); g.fill(); if (back) { g.beginPath(); g.arc(hx, hy, R, 0, 7); g.fill(); } return;
      case 'curly': for (let i = 0; i < 7; i++) { const a = Math.PI * (1.0 + i / 6); g.beginPath(); g.arc(hx + Math.cos(a) * (R - 0.5), hy + Math.sin(a) * (R - 0.5) - 0.5, 2.8, 0, 7); g.fill(); } if (back) { g.beginPath(); g.arc(hx, hy, R + 1, 0, 7); g.fill(); } return;
    }
    // cap of hair on top
    g.beginPath(); g.arc(hx, hy - 0.4, R + 0.7, Math.PI * 0.98, Math.PI * 2.02); g.fill();
    if (back) {
      g.beginPath(); g.arc(hx, hy, R + 0.4, 0, 7); g.fill();
      if (lk.hair === 'long' || lk.hair === 'braids') { rr(g, hx - R - 0.6, hy - 1, R * 2 + 1.2, R + 11, 4); g.fill(); }
      if (lk.hair === 'pony') { g.beginPath(); g.ellipse(hx, hy + R + 3, 2.4, 5, 0, 0, 7); g.fill(); }
    } else {
      // fringe
      if (lk.hair === 'side') { g.beginPath(); g.moveTo(hx - R, hy - 1); g.quadraticCurveTo(hx - 1, hy - R - 2, hx + R, hy - 3.5); g.lineTo(hx + R, hy - 5); g.quadraticCurveTo(hx, hy - R - 3, hx - R, hy - 3); g.fill(); }
      else if (lk.hair === 'bob' || lk.hair === 'long' || lk.hair === 'braids') { g.fillRect(hx - R - 0.8, hy - 3, 3, 9); g.fillRect(hx + R - 2.2, hy - 3, 3, 9); }
      else if (lk.hair === 'slick') { g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(hx + 1.5, hy - R + 1.2, 3, 0.8, 0.1, 0, 7); g.fill(); }
      else if (lk.hair === 'pixie') { g.beginPath(); g.moveTo(hx - R, hy - 2); g.lineTo(hx - 2, hy - R + 2.8); g.lineTo(hx + R, hy - 4); g.lineTo(hx + R, hy - 6); g.lineTo(hx - R, hy - 5); g.fill(); }
      if (lk.hair === 'bun') { g.beginPath(); g.arc(hx, hy - R - 2, 3.3, 0, 7); g.fill(); }
      if (lk.hair === 'pony') { g.beginPath(); g.ellipse(hx + R + 0.5, hy + 2, 2, 4.5, 0.3, 0, 7); g.fill(); }
    }
  }

  function drawHat(g, ch, lk, hx, hy, R, back) {
    const hat = ch.hatOverride || lk.hat;
    if (!hat) return;
    switch (hat) {
      case 'cap':
        g.fillStyle = lk.topC2 || '#223';
        g.beginPath(); g.arc(hx, hy - 1.4, R + 0.6, Math.PI, 0); g.fill();
        if (!back) { g.fillStyle = sh(lk.topC2 || '#223344', -0.25); g.beginPath(); g.ellipse(hx + Math.cos(ch.face || 0) * 2, hy - 2, R + 2.5, 2, 0, 0, 7); g.fill(); }
        break;
      case 'beanie':
        g.fillStyle = lk.topC2 || '#633';
        g.beginPath(); g.arc(hx, hy - 1, R + 0.9, Math.PI, 0); g.fill();
        g.fillStyle = sh(lk.topC2 || '#663333', -0.25); g.fillRect(hx - R - 1, hy - 3, R * 2 + 2, 2.6);
        break;
      case 'cowboy':
        g.fillStyle = '#7a4f2a';
        g.beginPath(); g.ellipse(hx, hy - R + 2, R + 6, 2.4, 0, 0, 7); g.fill();
        rr(g, hx - R + 1.5, hy - R - 5.5, R * 2 - 3, 7.5, 2.5); g.fill();
        break;
      case 'party':
        g.fillStyle = '#ff4fa8';
        g.beginPath(); g.moveTo(hx - 3.6, hy - R + 1.5); g.lineTo(hx + 0.6, hy - R - 10); g.lineTo(hx + 4, hy - R + 1.5); g.closePath(); g.fill();
        g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(hx + 0.6, hy - R - 10, 1.8, 0, 7); g.fill();
        g.strokeStyle = '#4af0ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx - 2.2, hy - R - 2); g.lineTo(hx + 2.6, hy - R - 2.8); g.stroke();
        break;
      case 'crown':
        g.fillStyle = '#ffcf3a';
        g.beginPath(); g.moveTo(hx - 5, hy - R + 1.5); g.lineTo(hx - 5, hy - R - 4); g.lineTo(hx - 2.5, hy - R - 1.5); g.lineTo(hx, hy - R - 5); g.lineTo(hx + 2.5, hy - R - 1.5); g.lineTo(hx + 5, hy - R - 4); g.lineTo(hx + 5, hy - R + 1.5); g.closePath(); g.fill();
        break;
      case 'veil':
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath(); g.moveTo(hx - R, hy - R + 2); g.lineTo(hx + R, hy - R + 2); g.lineTo(hx + R + 4, hy + 16); g.lineTo(hx - R - 4, hy + 16); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.fillRect(hx - R + 1, hy - R, R * 2 - 2, 2.2);
        break;
      case 'cone':
        g.fillStyle = '#ff6a1a';
        g.beginPath(); g.moveTo(hx - 6.5, hy - R + 3); g.lineTo(hx - 1.2, hy - R - 15); g.lineTo(hx + 1.2, hy - R - 15); g.lineTo(hx + 6.5, hy - R + 3); g.closePath(); g.fill();
        g.fillStyle = '#f4f4f4'; g.fillRect(hx - 4.8, hy - R - 3, 9.6, 2.4); g.fillRect(hx - 3, hy - R - 9, 6, 2);
        g.fillStyle = '#e25512'; g.fillRect(hx - 7.5, hy - R + 2, 15, 2.4);
        break;
      case 'sign':
        g.fillStyle = '#ffd21f';
        g.beginPath(); g.moveTo(hx - 6, hy - R + 3); g.lineTo(hx, hy - R - 13); g.lineTo(hx + 6, hy - R + 3); g.closePath(); g.fill();
        g.fillStyle = '#111'; g.font = 'bold 3px sans-serif'; g.textAlign = 'center'; g.fillText('WET', hx, hy - R - 1);
        break;
      case 'sombrero':
        g.fillStyle = '#e8c35a';
        g.beginPath(); g.ellipse(hx, hy - R + 2, R + 9, 3.2, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(hx, hy - R - 1, 5, Math.PI, 0); g.fill();
        g.fillStyle = '#d23a3a'; g.fillRect(hx - 5, hy - R - 1.5, 10, 1.5);
        break;
      case 'halo':
        g.strokeStyle = '#fff3a0'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(hx, hy - R - 3, 5, 1.6, 0, 0, 7); g.stroke();
        break;
      case 'bucket':
        g.fillStyle = '#7ab0d8'; g.beginPath(); g.moveTo(hx - 7, hy - R + 4); g.lineTo(hx - 5, hy - R - 8); g.lineTo(hx + 5, hy - R - 8); g.lineTo(hx + 7, hy - R + 4); g.closePath(); g.fill();
        break;
    }
  }

  // small held-object art shared with the prop renderer
  Pp.drawCone = (g, x, y, s = 1) => {
    g.fillStyle = '#ff6a1a';
    g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x - 1.2 * s, y - 18 * s); g.lineTo(x + 1.2 * s, y - 18 * s); g.lineTo(x + 6 * s, y); g.closePath(); g.fill();
    g.fillStyle = '#f4f4f4'; g.fillRect(x - 4.3 * s, y - 7 * s, 8.6 * s, 2.4 * s); g.fillRect(x - 2.8 * s, y - 13 * s, 5.6 * s, 2 * s);
    g.fillStyle = '#d24e10'; g.fillRect(x - 7.5 * s, y - 1.5 * s, 15 * s, 3 * s);
  };
})();
