/* Last Call — sound. Everything is synthesised: a house-music sequencer that follows the night
   (builds, drops, a polka hijack, the birthday song, the slow one at half three, the record
   stop at four), sound effects rendered once at load, voices as little blips, a radio with
   squelch, and walls and doors that muffle it all depending on where you stand. */
(function () {
  'use strict';
  const { U, Map: M } = LC;
  const A = (LC.Audio = { ready: false, muted: false, vol: 0.85, musicVol: 0.8, sfxVol: 1 });
  let ctx = null, SR = 44100;
  let master, comp, musicBus, musicFilter, musicGain, musicDuck, sfxBus, voiceBus, ambBus, radioBus, verb, verbSend, delay, delayGain, noiseBuf;
  const B = {};

  /* ================= offline DSP ================= */
  const arr = (d) => new Float32Array(Math.max(1, Math.round(d * SR)));
  const R = Math.random;
  function coef(type, f, Q) {
    f = Math.max(20, Math.min(SR * 0.45, f));
    const w = (2 * Math.PI * f) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filt(x, type, fFn, Q = 0.707) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = null;
    const fixed = typeof fFn === 'number';
    if (fixed) c = coef(type, fFn, Q);
    for (let i = 0; i < x.length; i++) {
      if (!fixed && (i & 63) === 0) c = coef(type, fFn(i / SR), Q);
      const x0 = x[i], y0 = c[0] * x0 + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0;
    }
    return x;
  }
  const white = (x, a = 1) => { for (let i = 0; i < x.length; i++) x[i] += (R() * 2 - 1) * a; return x; };
  function envelope(x, a, d, sus = 0, rel = 0) {
    const n = x.length, A_ = a * SR, D_ = d * SR;
    for (let i = 0; i < n; i++) {
      let e;
      if (i < A_) e = i / A_;
      else if (i < A_ + D_) e = 1 - (1 - sus) * ((i - A_) / D_);
      else e = sus * (rel ? Math.max(0, 1 - (i - A_ - D_) / (rel * SR)) : 1);
      x[i] *= e;
    }
    return x;
  }
  const expDecay = (x, tau) => { for (let i = 0; i < x.length; i++) x[i] *= Math.exp(-i / SR / tau); return x; };
  function tone(x, f0, f1, type = 'sine', amp = 1, dur) {
    let ph = 0;
    const n = x.length, d = dur || n / SR;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = typeof f0 === 'function' ? f0(t) : f0 + (f1 - f0) * Math.min(1, t / d);
      ph += (2 * Math.PI * f) / SR;
      let v;
      if (type === 'sine') v = Math.sin(ph);
      else if (type === 'saw') v = ((ph / Math.PI) % 2) - 1;
      else if (type === 'square') v = Math.sin(ph) > 0 ? 1 : -1;
      else v = Math.asin(Math.sin(ph)) * 0.6366;
      x[i] += v * amp;
    }
    return x;
  }
  function norm(x, peak = 0.9) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
  function mix(dst, src, at = 0, g = 1) { const o = Math.round(at * SR); for (let i = 0; i < src.length && i + o < dst.length; i++) dst[i + o] += src[i] * g; return dst; }
  function buf(x) { const b = ctx.createBuffer(1, x.length, SR); b.copyToChannel(x, 0); return b; }

  // one recipe per sound
  const RECIPES = {
    glass() { const x = arr(0.6); white(x, 1); filt(x, 'hp', 3500); expDecay(x, 0.05); for (const f of [3200, 4700, 6100, 7900, 5300]) { const p = tone(arr(0.5), f * (0.95 + R() * 0.1), f, 'sine', 0.35); expDecay(p, 0.08 + R() * 0.1); mix(x, p, R() * 0.05); } for (let k = 0; k < 5; k++) { const t = tone(arr(0.08), 5000 + R() * 3000, 4000, 'sine', 0.2); expDecay(t, 0.02); mix(x, t, 0.1 + R() * 0.35); } return norm(x, 0.8); },
    crash() { const x = arr(0.9); white(x, 1); filt(x, 'lp', 2200); expDecay(x, 0.18); const th = tone(arr(0.4), 90, 40, 'sine', 1.4); expDecay(th, 0.12); mix(x, th); for (let k = 0; k < 4; k++) { const w = arr(0.08); white(w); filt(w, 'bp', 700 + R() * 600, 3); expDecay(w, 0.02); mix(x, w, 0.05 + R() * 0.3, 0.7); } return norm(x, 0.9); },
    clatter() { const x = arr(0.5); for (let k = 0; k < 5; k++) { const w = arr(0.07); white(w); filt(w, 'bp', 500 + R() * 900, 4); expDecay(w, 0.018); mix(x, w, k * 0.06 + R() * 0.03, 1 - k * 0.15); } return norm(x, 0.7); },
    smash() { const x = RECIPES.crash(); mix(x, RECIPES.glass(), 0.02, 0.6); return norm(x, 0.95); },
    thud() { const x = tone(arr(0.35), 90, 38, 'sine', 1); expDecay(x, 0.08); const w = arr(0.25); white(w); filt(w, 'lp', 450); expDecay(w, 0.05); mix(x, w, 0, 0.8); return norm(x, 0.85); },
    slip() { const x = tone(arr(0.32), (t) => 1100 + t * 3500 + Math.sin(t * 90) * 60, 0, 'sine', 1); envelope(x, 0.01, 0.3); return norm(x, 0.5); },
    punch() { const x = arr(0.22); white(x); filt(x, 'lp', 1600); expDecay(x, 0.03); const b = tone(arr(0.18), 120, 55, 'sine', 1.2); expDecay(b, 0.05); mix(x, b); return norm(x, 0.9); },
    shove() { const x = arr(0.25); white(x); filt(x, 'bp', (t) => 400 + t * 3000, 1.2); envelope(x, 0.03, 0.2); return norm(x, 0.5); },
    grab() { const x = arr(0.18); white(x); filt(x, 'bp', 2500, 0.8); envelope(x, 0.01, 0.16); return norm(x, 0.35); },
    squeak() { const x = tone(arr(0.22), (t) => 700 + Math.sin(t * 70) * 120 + t * 900, 0, 'tri', 1); envelope(x, 0.01, 0.2); return norm(x, 0.45); },
    scrape() { const x = arr(0.45); white(x); filt(x, 'bp', (t) => 500 + Math.sin(t * 40) * 200, 3); for (let i = 0; i < x.length; i++) x[i] *= 0.6 + 0.4 * Math.sin(i / SR * 60); envelope(x, 0.04, 0.4); return norm(x, 0.45); },
    vomit() { const x = arr(1.1); white(x); filt(x, 'lp', (t) => 700 - t * 300, 2); for (let i = 0; i < x.length; i++) x[i] *= 0.5 + 0.5 * Math.sin((i / SR) * 38); const g = tone(arr(1.1), 180, 70, 'saw', 0.3); filt(g, 'lp', 500); mix(x, g); envelope(x, 0.05, 1); return norm(x, 0.75); },
    mop() { const x = arr(0.3); white(x); filt(x, 'bp', (t) => 900 + Math.sin(t * 30) * 300, 2); envelope(x, 0.03, 0.26); return norm(x, 0.35); },
    sweep() { const x = arr(0.3); white(x); filt(x, 'hp', 2200); envelope(x, 0.1, 0.2); return norm(x, 0.25); },
    pour() { const x = arr(0.7); white(x); filt(x, 'bp', (t) => 1400 + Math.sin(t * 57) * 400 + R() * 300, 5); envelope(x, 0.05, 0.6); return norm(x, 0.35); },
    click() { const x = tone(arr(0.04), 1800, 1200, 'sine', 1); expDecay(x, 0.01); return norm(x, 0.35); },
    ui() { const x = tone(arr(0.09), 660, 880, 'tri', 1); expDecay(x, 0.03); return norm(x, 0.35); },
    objective() { const x = arr(0.9); for (const [f, t] of [[392, 0], [311, 0.16]]) { const n = tone(arr(0.5), f, f, 'tri', 1); const s = tone(arr(0.5), f * 2, f * 2, 'sine', 0.3); mix(n, s); expDecay(n, 0.18); mix(x, n, t); } return norm(x, 0.5); },
    beep() { const x = tone(arr(0.16), 2000, 2000, 'sine', 1); envelope(x, 0.005, 0.15); return norm(x, 0.4); },
    detector() { const x = tone(arr(0.7), (t) => 1400 + Math.sin(t * 40) * 400 + t * 800, 0, 'sine', 1); envelope(x, 0.02, 0.66); return norm(x, 0.4); },
    zip() { const x = arr(0.3); for (let k = 0; k < 9; k++) { const c = arr(0.012); white(c); filt(c, 'hp', 3000); mix(x, c, k * 0.028); } return norm(x, 0.5); },
    sign() { const x = arr(0.18); white(x); filt(x, 'bp', 1200, 2); expDecay(x, 0.02); const k = tone(arr(0.1), 220, 160, 'sine', 0.8); expDecay(k, 0.03); mix(x, k); return norm(x, 0.45); },
    crowdOoh() { const x = arr(1.4); for (let v = 0; v < 7; v++) { const f0 = 170 + R() * 120; const s = tone(arr(1.4), (t) => f0 * (1.15 - t * 0.2), 0, 'saw', 0.5); mix(x, s, R() * 0.1); } filt(x, 'bp', 520, 1.5); const y = x.slice(); filt(y, 'bp', 950, 2); mix(x, y, 0, 0.6); envelope(x, 0.12, 1.25); return norm(x, 0.55); },
    cheer() { const x = arr(1.3); for (let v = 0; v < 8; v++) { const f0 = 220 + R() * 200; const s = tone(arr(1.3), (t) => f0 * (1 + t * 0.6), 0, 'saw', 0.4); mix(x, s, R() * 0.15); } filt(x, 'bp', 800, 1.2); const n = arr(1.3); white(n, 0.4); filt(n, 'bp', 2000, 1); mix(x, n); envelope(x, 0.1, 1.2); return norm(x, 0.55); },
    boo() { const x = arr(1.2); for (let v = 0; v < 6; v++) { const f0 = 140 + R() * 60; mix(x, tone(arr(1.2), (t) => f0 * (1 - t * 0.15), 0, 'saw', 0.5)); } filt(x, 'bp', 400, 1.6); envelope(x, 0.08, 1.1); return norm(x, 0.5); },
    scratch() { const x = arr(0.5); white(x); filt(x, 'bp', (t) => 800 + Math.sin(t * 28) * 700, 3); const s = tone(arr(0.5), (t) => 300 + Math.sin(t * 28) * 250, 0, 'saw', 0.4); mix(x, s); envelope(x, 0.01, 0.48); return norm(x, 0.7); },
    recordStop() { const x = arr(1.3); const s = tone(arr(1.3), (t) => 220 * Math.pow(0.08, t / 1.3), 0, 'saw', 1); const s2 = tone(arr(1.3), (t) => 55 * Math.pow(0.1, t / 1.3), 0, 'sine', 1.2); mix(x, s); mix(x, s2); filt(x, 'lp', (t) => 3000 * Math.pow(0.1, t / 1.3) + 100); envelope(x, 0.005, 1.25); return norm(x, 0.8); },
    clunk() { const x = arr(0.5); white(x); filt(x, 'lp', 900); expDecay(x, 0.04); const k = tone(arr(0.3), 70, 50, 'sine', 1); expDecay(k, 0.08); mix(x, k); return norm(x, 0.9); },
    powerDown() { const x = tone(arr(1.4), (t) => 180 * Math.pow(0.15, t / 1.4), 0, 'saw', 1); filt(x, 'lp', 1200); envelope(x, 0.01, 1.35); mix(x, RECIPES.clunk(), 1.1); return norm(x, 0.8); },
    powerUp() { const x = tone(arr(1.2), (t) => 60 + t * 300, 0, 'saw', 0.6); filt(x, 'lp', 1400); envelope(x, 0.2, 1); mix(x, RECIPES.clunk(), 0); return norm(x, 0.7); },
    stallOpen() { const x = arr(0.4); white(x); filt(x, 'bp', 600, 2); expDecay(x, 0.05); const k = tone(arr(0.25), 140, 90, 'sine', 1); expDecay(k, 0.06); mix(x, k); return norm(x, 0.8); },
    creak() { const x = tone(arr(0.6), (t) => 180 + Math.sin(t * 13) * 40 + R() * 30, 0, 'saw', 1); filt(x, 'bp', 900, 4); envelope(x, 0.1, 0.5); return norm(x, 0.35); },
    crackle() { const x = arr(0.8); for (let k = 0; k < 30; k++) { const c = arr(0.004); white(c); mix(x, c, R() * 0.78, R()); } filt(x, 'hp', 1200); return norm(x, 0.5); },
    extinguisher() { const x = arr(1.5); white(x); filt(x, 'lp', (t) => 5000 - t * 2500, 0.8); envelope(x, 0.03, 1.45, 0.3); return norm(x, 0.7); },
    clank() { const x = arr(0.7); for (const f of [410, 1130, 1780, 2560]) { const p = tone(arr(0.7), f, f, 'sine', 0.5); expDecay(p, 0.12 + R() * 0.2); mix(x, p); } return norm(x, 0.6); },
    throw() { const x = arr(0.35); white(x); filt(x, 'bp', (t) => 300 + t * 2400, 1.5); envelope(x, 0.05, 0.3); return norm(x, 0.45); },
    pop() { const x = arr(0.18); white(x); filt(x, 'hp', 800); expDecay(x, 0.015); return norm(x, 0.95); },
    bell() { const x = arr(2); for (const [f, g] of [[880, 1], [1760, 0.4], [2640, 0.25], [1318, 0.3]]) { const p = tone(arr(2), f, f, 'sine', g); expDecay(p, 0.5); mix(x, p); } for (let k = 1; k < 4; k++) mix(x, x.slice(0, Math.round(SR * 0.6)), k * 0.35, 0.5); return norm(x, 0.5); },
    radio() { const x = arr(0.14); white(x); filt(x, 'bp', 2200, 1.2); envelope(x, 0.005, 0.13); return norm(x, 0.3); },
    alarmBeep() { const x = tone(arr(0.12), 1300, 1300, 'square', 1); filt(x, 'lp', 3000); envelope(x, 0.005, 0.11); return norm(x, 0.3); },
    alarmDoor() { const x = arr(1); for (let k = 0; k < 5; k++) { const b = tone(arr(0.1), 1500, 1500, 'square', 1); envelope(b, 0.005, 0.09); mix(x, b, k * 0.2); } filt(x, 'lp', 3500); return norm(x, 0.35); },
    kick() { const x = tone(arr(0.4), (t) => 45 + 110 * Math.exp(-t * 28), 0, 'sine', 1); expDecay(x, 0.14); const c = arr(0.006); white(c); mix(x, c, 0, 0.4); return norm(x, 1); },
    hat() { const x = arr(0.06); white(x); filt(x, 'hp', 7500); expDecay(x, 0.012); return norm(x, 0.5); },
    ohat() { const x = arr(0.25); white(x); filt(x, 'hp', 7000); expDecay(x, 0.06); return norm(x, 0.45); },
    clap() { const x = arr(0.3); for (const t of [0, 0.011, 0.023]) { const c = arr(0.02); white(c); mix(x, c, t); } const tail = arr(0.28); white(tail); expDecay(tail, 0.06); mix(x, tail, 0.03, 0.6); filt(x, 'bp', 1250, 0.9); return norm(x, 0.7); },
    crashCym() { const x = arr(2.2); white(x); filt(x, 'hp', 4500); expDecay(x, 0.5); return norm(x, 0.35); },
    riser() { const x = arr(7.8); white(x); filt(x, 'bp', (t) => 300 + Math.pow(t / 7.8, 2) * 7000, 2); envelope(x, 7.6, 0.2); return norm(x, 0.35); },
    snare() { const x = arr(0.16); white(x); filt(x, 'bp', 1800, 0.8); expDecay(x, 0.04); const b = tone(arr(0.1), 200, 160, 'tri', 0.5); expDecay(b, 0.03); mix(x, b); return norm(x, 0.55); },
  };

  /* ================= graph ================= */
  function impulse(dur, decay) {
    const len = Math.round(SR * dur), b = ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  A.init = async (onProgress) => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    SR = ctx.sampleRate;
    master = ctx.createGain(); master.gain.value = A.vol;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicDuck = ctx.createGain();
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000; musicFilter.Q.value = 0.8;
    musicGain = ctx.createGain(); musicGain.gain.value = 0;
    musicDuck.connect(musicBus);
    musicBus.connect(musicFilter); musicFilter.connect(musicGain); musicGain.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = 0.36; delayGain = ctx.createGain(); delayGain.gain.value = 0.28;
    delay.connect(delayGain); delayGain.connect(delay); delayGain.connect(musicBus);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 0.55; voiceBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    radioBus = ctx.createGain(); radioBus.gain.value = 0.7;
    const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 1900; rbp.Q.value = 1.1;
    const shaper = ctx.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 3); } shaper.curve = curve;
    radioBus.connect(rbp); rbp.connect(shaper); shaper.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(1.8, 3.2);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.08;
    verbSend.connect(verb); verb.connect(master);
    sfxBus.connect(verbSend);
    voiceBus.connect(verbSend);
    // render sound effects, a few per frame so the page stays responsive
    const names = Object.keys(RECIPES);
    for (let i = 0; i < names.length; i++) {
      B[names[i]] = buf(RECIPES[names[i]]());
      if (onProgress) onProgress((i + 1) / names.length);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    const nb = arr(3); white(nb); noiseBuf = buf(nb);
    startAmbience();
    A.ready = true;
  };
  A.resume = () => { if (ctx && ctx.state !== 'running') ctx.resume(); };
  A.setMuted = (m) => { A.muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : A.vol, ctx.currentTime, 0.05); };
  A.now = () => (ctx ? ctx.currentTime : performance.now() / 1000);

  /* ================= ambience ================= */
  let crowdGain, crowdGain2, humGain, outdoorGain, dripT = 0;
  function loopNoise(filterType, f, Q, gain) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = Q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(fl); fl.connect(g); g.connect(ambBus); s.start();
    return { g, fl, s };
  }
  function startAmbience() {
    const c1 = loopNoise('bandpass', 480, 0.9, 0), c2 = loopNoise('bandpass', 1300, 1.4, 0);
    crowdGain = c1.g; crowdGain2 = c2.g;
    // walla: wobble the crowd filters
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.1; const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(c1.fl.frequency); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 4.7; const lg2 = ctx.createGain(); lg2.gain.value = 300; lfo2.connect(lg2); lg2.connect(c2.fl.frequency); lfo2.start();
    const o = loopNoise('lowpass', 260, 0.7, 0); outdoorGain = o.g;
    // fluorescent hum for lights-on
    const h = ctx.createOscillator(); h.type = 'sawtooth'; h.frequency.value = 100; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 400;
    humGain = ctx.createGain(); humGain.gain.value = 0; h.connect(hf); hf.connect(humGain); humGain.connect(ambBus); h.start();
  }

  /* ================= positional sfx ================= */
  let active = 0;
  function listener() { const p = LC.G && LC.G.player; return p ? { x: p.x, y: p.y, room: p.room ? p.room.id : null } : { x: 0, y: 0, room: null }; }
  A.sfx = (name, x, y, o = {}) => {
    if (!ctx || !B[name] || A.muted) return;
    if (active > 26) return;
    const L_ = listener();
    let g = (o.vol || 1) * A.sfxVol, pan = 0, cutoff = 20000;
    if (!o.ui) {
      const d = U.dist(L_.x, L_.y, x, y);
      if (d > 1400) return;
      g *= Math.pow(U.clamp(1 - d / 1400, 0, 1), 1.6) * 1.1;
      pan = U.clamp((x - L_.x) / 520, -0.9, 0.9);
      const r = M.roomAt(x, y);
      const h = M.hear(r ? r.id : null, L_.room);
      cutoff = h >= 1 ? 20000 : h > 0.7 ? 6000 : h > 0.3 ? 1600 : 650;
      g *= 0.35 + 0.65 * Math.min(1, h + 0.25);
    }
    if (g < 0.015) return;
    const s = ctx.createBufferSource(); s.buffer = B[name];
    if (o.rate) s.playbackRate.value = o.rate; else s.playbackRate.value = 0.94 + R() * 0.12;
    const gn = ctx.createGain(); gn.gain.value = g;
    let node = s;
    if (cutoff < 20000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; node.connect(f); node = f; }
    node.connect(gn);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); p.connect(sfxBus); }
    else gn.connect(sfxBus);
    active++;
    s.onended = () => { active--; };
    s.start();
  };

  /* ================= voices ================= */
  let voices = 0;
  A.voice = (ch, text, shout) => {
    if (!ctx || A.muted || voices > 5) return;
    const L_ = listener();
    const d = U.dist(L_.x, L_.y, ch.x, ch.y);
    if (ch.kind !== 'player' && d > 520) return;
    const r = M.roomAt(ch.x, ch.y);
    const h = ch.kind === 'player' ? 1 : M.hear(r ? r.id : null, L_.room);
    const g0 = (ch.kind === 'player' ? 0.5 : 0.55 * Math.pow(1 - d / 520, 1.3)) * (shout ? 1.5 : 1) * (0.3 + 0.7 * h);
    if (g0 < 0.02) return;
    voices++;
    const base = 150 * (ch.voice || 1) * (ch.kind === 'player' ? 0.85 : 1);
    const drunk = ch.drunk || 0;
    const syll = Math.min(14, Math.max(2, Math.round(text.length / 3.2)));
    const t0 = ctx.currentTime + 0.02, dur = shout ? 0.075 : 0.065 + drunk * 0.03;
    const osc = ctx.createOscillator(); osc.type = shout ? 'sawtooth' : 'triangle';
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = shout ? 1300 : 900; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = U.clamp((ch.x - L_.x) / 520, -0.8, 0.8); g.connect(pan); pan.connect(voiceBus); } else g.connect(voiceBus);
    for (let i = 0; i < syll; i++) {
      const t = t0 + i * (dur + 0.025 + R() * 0.02);
      const f = base * (0.85 + R() * 0.4) * (1 + Math.sin(i * 1.7) * drunk * 0.15) * (i === syll - 1 && text.endsWith('?') ? 1.3 : 1);
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(g0, t + 0.012);
      g.gain.linearRampToValueAtTime(0, t + dur);
    }
    const end = t0 + syll * (dur + 0.045) + 0.05;
    osc.start(t0); osc.stop(end);
    osc.onended = () => { voices--; };
  };
  A.radio = (text, pitch = 1) => {
    if (!ctx || A.muted) return;
    const s = ctx.createBufferSource(); s.buffer = B.radio; s.connect(radioBus); s.start();
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(g); g.connect(radioBus);
    const syll = Math.min(16, Math.max(2, Math.round(text.length / 3)));
    const t0 = ctx.currentTime + 0.12;
    for (let i = 0; i < syll; i++) {
      const t = t0 + i * 0.085;
      osc.frequency.setValueAtTime(130 * pitch * (0.85 + R() * 0.35), t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.065);
    }
    const end = t0 + syll * 0.085 + 0.05;
    osc.start(t0); osc.stop(end);
    const s2 = ctx.createBufferSource(); s2.buffer = B.radio; s2.connect(radioBus); s2.start(end);
  };

  /* ================= music ================= */
  const TRACKS = [
    { key: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], stab: [3, 6, 11, 14] },
    { key: 62, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], stab: [2, 7, 10] },
    { key: 64, prog: [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [7, 10, 14]], stab: [3, 8, 11] },
    { key: 54, prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]], stab: [1, 6, 9, 14] },
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const Mu = (A.mu = { bpm: 122, step: 0, nextT: 0, bar: 0, track: 0, mode: 'house', running: false, beatT: 0, beatDur: 0.5, beats: 0, events: [], cycleBar: 0 });
  const BDAY = [[62, 0.75], [62, 0.25], [64, 1], [62, 1], [67, 1], [66, 2], [62, 0.75], [62, 0.25], [64, 1], [62, 1], [69, 1], [67, 2], [62, 0.75], [62, 0.25], [74, 1], [71, 1], [67, 1], [66, 1], [64, 1], [72, 0.75], [72, 0.25], [71, 1], [67, 1], [69, 1], [67, 2]];
  const POLKA = [0, 4, 7, 4, 0, 4, 7, 12, 11, 7, 4, 7, 9, 7, 5, 4, 2, 5, 9, 5, 2, 5, 9, 14, 12, 9, 5, 9, 11, 9, 7, 5];
  let special = null, specialStep = 0, bdayIdx = 0, bdayT = 0;

  function note(t, f, len, type, gain, cutoff, dest, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    let n = o;
    if (cutoff) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), t + len); o.connect(fl); n = fl; }
    n.connect(g); g.connect(dest || musicBus);
    o.start(t); o.stop(t + len + 0.02);
  }
  function hit(t, name, gain = 1, rate = 1, dest) {
    if (!B[name]) return;
    const s = ctx.createBufferSource(); s.buffer = B[name]; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(g); g.connect(dest || musicBus); s.start(t);
  }
  function scheduleStep(t, st) {
    const G = LC.G, m = G.music;
    const e = m.energy;
    const s = st % 16;
    const bar = Math.floor(st / 16);
    const cyc = bar % 32;
    const tr = TRACKS[Mu.track % TRACKS.length];
    const chord = tr.prog[Math.floor(bar / 2) % 4];
    const sd = 60 / Mu.bpm / 4;
    const audible = ctx && !m.stopped;
    const mode = special || (G.music.hijacked ? 'polka' : G.clock > 390 && !G.closing ? 'slow' : 'house');
    Mu.mode = mode;
    // visual events land when the step plays
    if (s % 4 === 0) Mu.events.push({ t, beat: true, bar, cyc });
    if (!audible) return;
    if (mode === 'polka') {
      const k = TRACKS[0].key;
      if (s % 8 === 0) note(t, mtof(k - 24 + (s === 8 ? 7 : 0)), 0.18, 'square', 0.25, 700);
      if (s % 8 === 4) for (const c of [0, 4, 7]) note(t, mtof(k + c), 0.1, 'square', 0.06, 2200);
      if (s % 2 === 0) { const d = POLKA[(specialStep++) % POLKA.length]; note(t, mtof(k + 12 + d), sd * 1.8, 'sawtooth', 0.09, 2600, null, Math.sin(t * 30) * 20); }
      if (s % 4 === 0) hit(t, 'snare', 0.25);
      return;
    }
    const breakBar = e > 0.72 && cyc >= 24 && cyc < 28;
    const build = e > 0.72 && cyc >= 28;
    const slow = mode === 'slow';
    // kick
    if (e > 0.05 && !breakBar && (slow ? s % 8 === 0 : s % 4 === 0)) { hit(t, 'kick', 0.95 * (slow ? 0.7 : 1)); musicDuck.gain.setValueAtTime(0.35, t); musicDuck.gain.linearRampToValueAtTime(1, t + sd * 3); }
    if (build && cyc === 31 && s >= 8) hit(t, 'snare', 0.2 + (s - 8) * 0.04);
    // hats
    if (e > 0.15 && !slow) { if (s % 4 === 2) hit(t, 'ohat', 0.32); else if (e > 0.5 && s % 2 === 1) hit(t, 'hat', 0.18 + (s % 4 === 3 ? 0.08 : 0)); }
    // clap
    if (e > 0.4 && !breakBar && !slow && (s === 4 || s === 12)) hit(t, 'clap', 0.5);
    // bass on the offbeat
    if (e > 0.3 && !breakBar && s % 4 === 2) { const r = chord[0] + (s === 14 && bar % 2 ? 12 : 0); note(t, mtof(tr.key - 24 + r), sd * 1.7, 'sawtooth', 0.34, 520 + e * 400, musicDuck); note(t, mtof(tr.key - 36 + r), sd * 1.9, 'sine', 0.28, 0, musicDuck); }
    // stabs
    if (e > 0.6 && !breakBar && !slow && tr.stab.includes(s)) for (const c of chord) { note(t, mtof(tr.key + c), 0.16, 'sawtooth', 0.05, 2400, null, -8); note(t, mtof(tr.key + c), 0.16, 'sawtooth', 0.05, 2400, delay, 8); }
    // arp
    if ((e > 0.78 || slow) && !breakBar && s % (slow ? 2 : 1) === 0) { const c = chord[(s / (slow ? 2 : 1)) % 3 | 0] + (s >= 8 ? 12 : 0); note(t, mtof(tr.key + 12 + c), sd * 0.9, slow ? 'triangle' : 'square', slow ? 0.05 : 0.025, 3000); }
    // pad in the break and during slow songs
    if ((breakBar || slow) && s === 0 && bar % 2 === 0) for (const c of chord) { const len = sd * 32; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(tr.key + c); const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.8); g.gain.linearRampToValueAtTime(0, t + len); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + len + 0.1); }
    if (e > 0.72 && cyc === 24 && s === 0) hit(t, 'riser', 0.5);
    if (e > 0.72 && cyc === 0 && s === 0 && bar > 0) { hit(t, 'crashCym', 0.6); Mu.events.push({ t, drop: true }); }
    // birthday melody over the top
    if (special === 'birthday') {
      if (bdayT <= 0 && bdayIdx < BDAY.length) { const [nn, b] = BDAY[bdayIdx++]; note(t, mtof(nn + 12), b * sd * 4 * 0.9, 'square', 0.07, 3500); note(t, mtof(nn), b * sd * 4 * 0.9, 'triangle', 0.08); bdayT = b * 4; }
      bdayT--;
      if (bdayIdx >= BDAY.length && bdayT <= 0) { special = null; }
    }
  }
  function schedule() {
    const G = LC.G;
    if (!G) return;
    const now = A.now();
    if (!Mu.running) { Mu.running = true; Mu.nextT = now + 0.1; }
    const la = ctx ? 0.14 : 0.02;
    while (Mu.nextT < now + la) {
      Mu.bpm = Mu.mode === 'polka' ? 150 : Mu.mode === 'slow' ? 98 : 120 + (G.music.energy || 0.5) * 6;
      scheduleStep(Mu.nextT, Mu.step);
      Mu.step++;
      if (Mu.step % (16 * 64) === 0) Mu.track++;
      Mu.nextT += 60 / Mu.bpm / 4;
    }
    // apply visual events that have come due
    for (let i = 0; i < Mu.events.length; i++) {
      const ev = Mu.events[i];
      if (ev.t > now) continue;
      if (ev.beat) { Mu.beatT = ev.t; Mu.beatDur = 60 / Mu.bpm; Mu.beats++; if (ev.cyc % 8 === 0 && Mu.beats % 4 === 1) { G.music.pattern = (G.music.pattern + 1) % 5; } if (ev.cyc === 0 && Mu.beats % 4 === 1) G.music.palette = (G.music.palette + 1) % 6; }
      if (ev.drop) { G.music.drop = 1; G.music.laser = 1; LC.stat('drops'); if (LC.Director) crowdDrop(); }
      Mu.events.splice(i--, 1);
    }
  }
  function crowdDrop() {
    const G = LC.G;
    let k = 0;
    for (const n of G.npcs) {
      if (n.act !== 'dance' || n.override || Math.random() < 0.7) continue;
      LC.NPC.shout(n, U.pick(['WOOOOO', 'YESSSS', 'OHHHH', 'TUUUUNE']), { dim: true });
      if (++k > 4) break;
    }
    if (ctx) A.sfx('cheer', 46 * M.T, 20 * M.T, { vol: 0.8 });
  }
  A.special = (name) => { special = name; bdayIdx = 0; bdayT = 0; if (ctx) hit(ctx.currentTime + 0.02, 'scratch', 0.7); };
  A.hijack = (on) => { if (ctx) hit(ctx.currentTime + 0.02, 'scratch', 0.8, on ? 1 : 0.8); specialStep = 0; };
  A.recordStop = () => { if (ctx) { hit(ctx.currentTime + 0.02, 'recordStop', 1.1); A.sfx('clunk', 0, 0, { ui: true, vol: 0.9 }); } };
  let alarmOsc = null, alarmG = null;
  A.alarm = (on) => {
    if (!ctx) return;
    if (on && !alarmOsc) {
      alarmOsc = ctx.createOscillator(); alarmOsc.type = 'square'; alarmOsc.frequency.value = 950;
      alarmG = ctx.createGain(); alarmG.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2.2;
      const lg = ctx.createGain(); lg.gain.value = 0.06;
      lfo.connect(lg); lg.connect(alarmG.gain);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
      alarmOsc.connect(f); f.connect(alarmG); alarmG.connect(master);
      alarmOsc.start(); lfo.start();
      alarmOsc.lfo = lfo;
    } else if (!on && alarmOsc) { alarmOsc.stop(); alarmOsc.lfo.stop(); alarmOsc = null; }
  };
  A.powerDown = () => { if (ctx) A.sfx('powerDown', 0, 0, { ui: true }); };
  A.powerUp = () => { if (ctx) A.sfx('powerUp', 0, 0, { ui: true }); };

  // the visual beat, available with or without sound
  A.beatInfo = () => {
    const now = A.now();
    const dur = Mu.beatDur || 0.5;
    const phase = U.clamp((now - Mu.beatT) / dur, 0, 1);
    return { phase, time: Mu.beats + phase };
  };

  /* ================= per frame ================= */
  A.update = (dt) => {
    const G = LC.G;
    if (!G) return;
    const m = G.music;
    // energy follows the night
    const c = G.clock;
    const e = c < 90 ? 0.3 + c / 90 * 0.3 : c < 180 ? 0.6 + (c - 90) / 90 * 0.25 : c < 380 ? 0.85 + Math.min(0.15, (c - 180) / 200 * 0.15) : 0.55;
    m.energy = U.damp(m.energy || 0.3, e, 0.2, dt);
    schedule();
    const bi = A.beatInfo();
    m.beatPhase = bi.phase; m.beatTime = bi.time;
    m.drop = Math.max(0, (m.drop || 0) - dt * 0.8);
    m.laser = Math.max(0, (m.laser || 0) - dt * 0.06);
    if (!ctx || !A.ready) return;
    const t = ctx.currentTime;
    // what the room lets through
    const p = G.player;
    const room = p && p.room ? p.room : null;
    let hear = room ? room.music : 0.5;
    if (room && (room.id === 'street') && M.door('entrance').open > 0.5) hear = 0.35;
    if (room && room.id === 'patio' && M.door('patioDoor').open > 0.5) hear = 0.55;
    if (room && (room.id === 'mens' || room.id === 'womens') && (M.door('bathDoor').open > 0.5 || M.door('mensDoor').open > 0.5 || M.door('womensDoor').open > 0.5)) hear = Math.max(hear, 0.32);
    const cutoff = hear >= 0.95 ? 18000 : hear > 0.75 ? 7000 : hear > 0.5 ? 2600 : hear > 0.3 ? 900 : hear > 0.15 ? 380 : 240;
    const stopped = m.stopped || A.muted;
    musicFilter.frequency.setTargetAtTime(cutoff, t, 0.12);
    musicGain.gain.setTargetAtTime(stopped ? 0 : A.musicVol * (0.25 + 0.75 * hear), t, stopped ? 0.03 : 0.2);
    verbSend.gain.setTargetAtTime(room && room.bath ? 0.35 : room && room.outdoor ? 0.02 : 0.08, t, 0.3);
    // crowd walla by head count nearby
    let near = 0;
    if (p) for (const n of G.npcs) if (n.kind === 'guest' && Math.abs(n.x - p.x) < 380 && Math.abs(n.y - p.y) < 300) near++;
    const crowd = Math.min(1, near / 26) * (room && room.outdoor ? 0.4 : 1) * (G.lightsOn > 0.5 ? 0.55 : 1);
    crowdGain.gain.setTargetAtTime(crowd * 0.2, t, 0.4);
    crowdGain2.gain.setTargetAtTime(crowd * 0.08, t, 0.4);
    outdoorGain.gain.setTargetAtTime(room && room.outdoor && room.id !== 'patio' ? 0.1 : 0.015, t, 0.5);
    humGain.gain.setTargetAtTime(G.lightsOn > 0.5 ? 0.02 : 0, t, 0.3);
    // bathroom drips
    dripT -= dt;
    if (room && room.bath && dripT <= 0) { dripT = U.rand(1.5, 4); A.sfx('click', p.x + U.rand(-80, 80), p.y - 60, { vol: 0.25, rate: 0.5 + R() * 0.3 }); }
  };
})();
