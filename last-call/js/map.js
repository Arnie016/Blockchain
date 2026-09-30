/* Last Call — the Flamingo: floor plan, thin walls on tile edges, doors, furniture, points of
   interest, lights, CCTV cameras, and grid pathfinding with zone permissions. */
(function () {
  'use strict';
  const { U } = LC;
  const T = 32, W = 96, H = 66;
  // tile zones double as permission bits
  const Z = { PUB: 1, VIP: 2, STAFF: 4, OUT: 8 };
  const P = { PUB: 1, VIP: 2, STAFF: 4, OUT: 8, EMERG: 16, CLIMB: 32 };
  P.GUEST = P.PUB | P.OUT;
  P.ALL = P.PUB | P.VIP | P.STAFF | P.OUT | P.EMERG;
  // edge types between tiles
  const E = { OPEN: 0, WALL: 1, VIP: 2, EMERG: 3, GATE: 4, STAFF: 5 };
  const M = (LC.Map = { T, W, H, Z, P, E });

  /* ---------------- rooms ---------------- */
  // amb: ambient light (club hours); music: how loud the room hears the dance floor (0..1)
  const ROOMS = [
    { id: 'alley', name: 'Alleyway', rects: [[0, 0, 96, 7], [88, 7, 96, 48]], floor: 'asphalt', zone: Z.OUT, outdoor: true, amb: [48, 52, 70], music: 0.14 },
    { id: 'street', name: 'Front Entrance', rects: [[0, 48, 96, 54]], floor: 'pavement', zone: Z.OUT, outdoor: true, amb: [60, 52, 66], music: 0.2 },
    { id: 'parking', name: 'Parking Lot', rects: [[0, 54, 96, 66]], floor: 'parking', zone: Z.OUT, outdoor: true, amb: [52, 52, 72], music: 0.1 },
    { id: 'kitchen', name: 'Kitchen', rects: [[2, 7, 16, 19]], floor: 'steel', zone: Z.STAFF, amb: [190, 196, 188], music: 0.3 },
    { id: 'mens', name: "Men's Bathroom", rects: [[2, 19, 16, 28]], floor: 'tileM', zone: Z.PUB, amb: [168, 186, 176], music: 0.22, bath: true },
    { id: 'bathhall', name: 'Bathroom Corridor', rects: [[2, 28, 16, 31]], floor: 'tileH', zone: Z.PUB, amb: [120, 110, 130], music: 0.35 },
    { id: 'womens', name: "Women's Bathroom", rects: [[2, 31, 16, 40]], floor: 'tileW', zone: Z.PUB, amb: [186, 170, 184], music: 0.22, bath: true },
    { id: 'lounge', name: 'Booths', rects: [[2, 40, 38, 48]], floor: 'carpetR', zone: Z.PUB, amb: [86, 54, 62], music: 0.55 },
    { id: 'bar', name: 'Bar', rects: [[16, 7, 32, 40]], floor: 'wood', zone: Z.PUB, amb: [96, 70, 56], music: 0.8 },
    { id: 'dj', name: 'DJ Booth', rects: [[40, 7, 52, 11]], floor: 'stage', zone: Z.STAFF, amb: [80, 56, 104], music: 1 },
    { id: 'dance', name: 'Dance Floor', rects: [[32, 11, 60, 32]], floor: 'dark', zone: Z.PUB, amb: [82, 64, 118], music: 1 },
    { id: 'hall', name: 'Main Floor', rects: [[32, 7, 40, 11], [52, 7, 62, 11], [60, 11, 62, 32], [32, 32, 62, 40], [62, 32, 76, 40]], floor: 'dark', zone: Z.PUB, amb: [86, 66, 106], music: 0.85 },
    { id: 'backstage', name: 'Backstage', rects: [[62, 7, 76, 18]], floor: 'concrete', zone: Z.STAFF, amb: [88, 88, 98], music: 0.35 },
    { id: 'office', name: "Manager's Office", rects: [[76, 7, 88, 18]], floor: 'carpetO', zone: Z.STAFF, amb: [96, 82, 64], music: 0.2 },
    { id: 'vip', name: 'VIP', rects: [[62, 18, 76, 32]], floor: 'velvet', zone: Z.VIP, amb: [96, 60, 100], music: 0.6 },
    { id: 'patio', name: 'Smoking Area', rects: [[76, 18, 88, 48]], floor: 'deck', zone: Z.PUB, outdoor: true, amb: [70, 60, 66], music: 0.3 },
    { id: 'lobby', name: 'Lobby', rects: [[38, 40, 54, 48]], floor: 'checker', zone: Z.PUB, amb: [112, 84, 92], music: 0.5 },
    { id: 'chill', name: 'Chill-Out Room', rects: [[54, 40, 76, 48]], floor: 'carpetP', zone: Z.PUB, amb: [74, 56, 108], music: 0.45 },
  ];
  M.rooms = ROOMS;
  const roomById = {};
  ROOMS.forEach((r, i) => { r.index = i; roomById[r.id] = r; });
  M.room = (id) => roomById[id];

  const N = W * H;
  const roomIdx = (M.roomIdx = new Int16Array(N).fill(-1));
  const zone = (M.zone = new Uint8Array(N));
  const walk = (M.walk = new Uint8Array(N));
  const floor = (M.floor = new Array(N).fill(null));
  const ti = (x, y) => y * W + x;
  M.ti = ti;
  ROOMS.forEach((r) => r.rects.forEach(([x0, y0, x1, y1]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      roomIdx[ti(x, y)] = r.index; zone[ti(x, y)] = r.zone; walk[ti(x, y)] = 1; floor[ti(x, y)] = r.floor;
    }
  }));
  M.roomAt = roomAtPx;
  const setZone = (x0, y0, x1, y1, z) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) zone[ti(x, y)] = z; };
  const setFloor = (x0, y0, x1, y1, f) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) floor[ti(x, y)] = f; };
  setZone(16, 7, 32, 10, Z.STAFF);     // behind the bar
  setZone(30, 10, 31, 11, Z.STAFF);    // bar flap
  setZone(38, 40, 40, 48, Z.STAFF);    // coat check
  setFloor(16, 7, 32, 10, 'mat');
  setFloor(34, 13, 58, 30, 'led');
  setFloor(44, 40, 48, 48, 'redcarpet');
  setFloor(44, 32, 48, 40, 'redcarpet');
  setFloor(38, 40, 40, 48, 'mat');
  M.LED = { x0: 34, y0: 13, x1: 58, y1: 30 };

  /* ---------------- walls & doors ---------------- */
  const vEdge = (M.vEdge = new Uint8Array((W + 1) * H));   // boundary x (0..W) on row y
  const hEdge = (M.hEdge = new Uint8Array(W * (H + 1)));   // boundary y (0..H) on column x
  const vDoor = (M.vDoor = new Int16Array((W + 1) * H).fill(-1));
  const hDoor = (M.hDoor = new Int16Array(W * (H + 1)).fill(-1));
  const vi = (x, y) => y * (W + 1) + x;
  const hi = (x, y) => y * W + x;
  for (let y = 0; y < H; y++) { vEdge[vi(0, y)] = E.WALL; vEdge[vi(W, y)] = E.WALL; }
  for (let x = 0; x < W; x++) { hEdge[hi(x, 0)] = E.WALL; hEdge[hi(x, H)] = E.WALL; }

  const THICK = { ext: 7, wall: 5, stall: 2.5, low: 4, fence: 2.5 };
  const HEIGHT = { ext: 30, wall: 26, stall: 20, low: 11, fence: 14 };
  M.segs = [];   // physics + render wall pieces {ax,ay,bx,by,kind,thick,h}
  M.doors = [];
  const doorById = {};
  M.door = (id) => doorById[id];

  function addSeg(ax, ay, bx, by, kind) {
    M.segs.push({ ax: ax * T, ay: ay * T, bx: bx * T, by: by * T, kind, thick: THICK[kind], h: HEIGHT[kind], active: true });
  }
  function addDoor(id, axis, fixed, a, b, type, kind, wallKind) {
    const d = {
      id, axis, kind, type, wallKind,
      x0: axis === 'h' ? a * T : fixed * T, y0: axis === 'h' ? fixed * T : a * T,
      x1: axis === 'h' ? b * T : fixed * T, y1: axis === 'h' ? fixed * T : b * T,
      open: kind === 'arch' || kind === 'rope' ? 1 : 0, target: 0, locked: false, index: M.doors.length,
      rooms: [], near: 0, alarm: false,
    };
    d.cx = (d.x0 + d.x1) / 2; d.cy = (d.y0 + d.y1) / 2; d.len = (b - a) * T;
    // blocking leaf segment (active while closed) for doors that physically stop people
    if (kind === 'alarm' || kind === 'gate' || kind === 'stall') {
      d.seg = { ax: d.x0, ay: d.y0, bx: d.x1, by: d.y1, kind: 'door', thick: kind === 'stall' ? 2.5 : 4, h: 0, active: true, door: d };
      M.segs.push(d.seg);
    }
    M.doors.push(d); doorById[id] = d;
    return d;
  }
  // horizontal wall on boundary y from x0 to x1; gaps: [a, b, id, type, kind]
  function hw(y, x0, x1, gaps = [], kind = 'wall') {
    let cur = x0;
    const sorted = gaps.slice().sort((p, q) => p[0] - q[0]);
    for (const g of sorted) { if (g[0] > cur) addSeg(cur, y, g[0], y, kind); cur = g[1]; }
    if (cur < x1) addSeg(cur, y, x1, y, kind);
    for (let x = x0; x < x1; x++) hEdge[hi(x, y)] = E.WALL;
    for (const [a, b, id, type, dk] of sorted) {
      const d = addDoor(id, 'h', y, a, b, type, dk, kind);
      for (let x = a; x < b; x++) { hEdge[hi(x, y)] = type; hDoor[hi(x, y)] = d.index; }
    }
  }
  function vw(x, y0, y1, gaps = [], kind = 'wall') {
    let cur = y0;
    const sorted = gaps.slice().sort((p, q) => p[0] - q[0]);
    for (const g of sorted) { if (g[0] > cur) addSeg(x, cur, x, g[0], kind); cur = g[1]; }
    if (cur < y1) addSeg(x, cur, x, y1, kind);
    for (let y = y0; y < y1; y++) vEdge[vi(x, y)] = E.WALL;
    for (const [a, b, id, type, dk] of sorted) {
      const d = addDoor(id, 'v', x, a, b, type, dk, kind);
      for (let y = a; y < b; y++) { vEdge[vi(x, y)] = type; vDoor[vi(x, y)] = d.index; }
    }
  }

  // building shell
  hw(7, 2, 88, [[8, 10, 'kitchenBack', E.STAFF, 'swing'], [33, 35, 'emergency', E.EMERG, 'alarm'], [70, 72, 'staffDoor', E.STAFF, 'swing']], 'ext');
  hw(48, 2, 76, [[44, 48, 'entrance', E.OPEN, 'double']], 'ext');
  hw(48, 76, 88, [], 'fence');
  vw(2, 7, 48, [], 'ext');
  vw(88, 7, 18, [], 'ext');
  vw(88, 18, 48, [[26, 28, 'patioGate', E.GATE, 'gate']], 'fence');
  // kitchen
  vw(16, 7, 19, [[8, 10, 'kitchenBar', E.STAFF, 'swing']]);
  hw(19, 2, 16);
  // bathrooms
  vw(16, 19, 40, [[29, 31, 'bathDoor', E.OPEN, 'swing']]);
  hw(28, 2, 16, [[12, 14, 'mensDoor', E.OPEN, 'swing']]);
  hw(31, 2, 16, [[12, 14, 'womensDoor', E.OPEN, 'swing']]);
  hw(40, 2, 16);
  for (let i = 0; i < 3; i++) {
    vw(4 + 2 * i, 19, 22, [], 'stall');
    hw(22, 2 + 2 * i, 4 + 2 * i, [[3 + 2 * i, 4 + 2 * i, 'stallM' + i, E.OPEN, 'stall']], 'stall');
  }
  for (let i = 0; i < 4; i++) {
    vw(4 + 2 * i, 37, 40, [], 'stall');
    hw(37, 2 + 2 * i, 4 + 2 * i, [[3 + 2 * i, 4 + 2 * i, 'stallW' + i, E.OPEN, 'stall']], 'stall');
  }
  // south rooms
  hw(40, 16, 38, [[24, 30, 'loungeArch', E.OPEN, 'arch']]);
  vw(38, 40, 48);
  hw(40, 38, 54, [[44, 48, 'lobbyArch', E.OPEN, 'arch']]);
  vw(54, 40, 48);
  hw(40, 54, 76, [[64, 68, 'chillArch', E.OPEN, 'arch']]);
  vw(76, 40, 48);
  // DJ booth
  hw(11, 40, 52, [], 'low');
  vw(40, 7, 11, [], 'low');
  vw(52, 7, 11, [[9, 11, 'djGate', E.STAFF, 'swing']], 'low');
  // backstage, office, VIP
  vw(62, 7, 18, [[12, 14, 'staffOnly', E.STAFF, 'swing']]);
  hw(18, 62, 88);
  vw(76, 7, 18, [[11, 13, 'officeDoor', E.STAFF, 'swing']]);
  vw(62, 18, 32, [[23, 27, 'vipRope', E.VIP, 'rope']]);
  hw(32, 62, 76);
  vw(76, 18, 40, [[35, 37, 'patioDoor', E.OPEN, 'swing']]);

  // rooms on either side of every door
  M.doors.forEach((d) => {
    const mx = (d.x0 + d.x1) / 2, my = (d.y0 + d.y1) / 2;
    const a = d.axis === 'h' ? M.roomAt(mx, my - 8) : M.roomAt(mx - 8, my);
    const b = d.axis === 'h' ? M.roomAt(mx, my + 8) : M.roomAt(mx + 8, my);
    d.rooms = [a && a.id, b && b.id];
  });
  M.door('emergency').locked = false;
  M.door('patioGate').locked = true;

  /* ---------------- static furniture ---------------- */
  // x,y,w,h in tiles -> AABB in px. z = visual height. anchor = people grab it while dragged.
  M.furn = [];
  function F(kind, x, y, w, h, o = {}) {
    const f = Object.assign({ kind, x0: x * T, y0: y * T, x1: (x + w) * T, y1: (y + h) * T, z: 16, solid: true, anchor: false }, o);
    f.cx = (f.x0 + f.x1) / 2; f.cy = (f.y0 + f.y1) / 2; f.id = M.furn.length;
    M.furn.push(f);
    return f;
  }
  M.F = F;
  // alley
  F('hedge', 0, 7, 2, 41, { z: 20 });
  F('dumpster', 3, 0.4, 3, 1.8, { z: 26, anchor: true, color: '#2f5a3c' });
  F('dumpster', 12, 0.4, 3, 1.8, { z: 26, anchor: true, color: '#3a4a6a' });
  F('dumpster', 51, 0.4, 3, 1.8, { z: 26, anchor: true, color: '#2f5a3c' });
  F('crate', 20, 0.5, 1.4, 1.4, { z: 20 });
  F('crate', 21.6, 0.8, 1.2, 1.2, { z: 16 });
  F('crate', 62, 0.6, 1.4, 1.4, { z: 20 });
  F('crate', 90, 10, 1.3, 1.3, { z: 18 });
  F('pallets', 26, 0.4, 2.4, 1.6, { z: 8 });
  // kitchen
  F('kcounter', 2.2, 7.1, 5.6, 1.1, { z: 18 });
  F('stove', 10.3, 7.1, 3, 1.2, { z: 18 });
  F('fridge', 13.4, 7.1, 2.4, 1.3, { z: 40 });
  F('kshelf', 2.1, 9.8, 1, 6, { z: 38 });
  F('kisland', 6, 12, 5, 2, { z: 18, anchor: true });
  F('fryer', 12.2, 12.4, 2, 1.5, { z: 18 });
  // men's
  for (let i = 0; i < 3; i++) F('toilet', 2 + 2 * i + 0.55, 19.1, 0.9, 0.75, { z: 12, stall: 'stallM' + i });
  for (let i = 0; i < 3; i++) F('urinal', 9.4 + i * 1.6, 19.05, 0.8, 0.55, { z: 18 });
  F('sink', 15.1, 20.4, 0.85, 1.3, { z: 16, anchor: true });
  F('sink', 15.1, 22.6, 0.85, 1.3, { z: 16, anchor: true });
  // women's
  for (let i = 0; i < 4; i++) F('toilet', 2 + 2 * i + 0.55, 39.15, 0.9, 0.75, { z: 12, stall: 'stallW' + i, flip: true });
  F('sink', 15.1, 31.9, 0.85, 1.3, { z: 16, anchor: true });
  F('sink', 15.1, 34.1, 0.85, 1.3, { z: 16, anchor: true });
  F('vanity', 11.2, 32.2, 2.6, 0.7, { z: 14 });
  // bathroom corridor
  F('vending', 2.2, 28.2, 1.2, 1.6, { z: 38 });
  // bar
  F('backbar', 16, 7, 16, 0.7, { z: 42 });
  F('counter', 16, 10.1, 14, 0.8, { z: 24, anchor: true });
  F('counterEnd', 31, 10.1, 1, 0.8, { z: 24, anchor: true });
  [14.5, 22.5, 30.5].forEach((y) => F('pillar', 31.6, y, 0.8, 0.8, { z: 60, anchor: true }));
  // lounge booths
  M.booths = [];
  [3, 8.8, 14.6, 20.4, 30.4].forEach((x) => {
    const b = F('booth', x, 45.9, 4.2, 1.9, { z: 18, anchor: true });
    const t = F('ltable', x + 1.1, 44.3, 2, 0.95, { z: 12 });
    M.booths.push({ booth: b, table: t });
  });
  // DJ booth
  F('djdesk', 42, 9.2, 8, 1.1, { z: 22, anchor: true });
  F('stack', 36.4, 7.15, 3.2, 2.1, { z: 56, anchor: true });
  F('stack', 52.4, 7.15, 3.2, 2.1, { z: 56, anchor: true });
  // dance floor furniture
  M.fspeakers = [
    F('fspeaker', 32.3, 11.3, 1.4, 1.3, { z: 24, anchor: true }),
    F('fspeaker', 58.3, 11.3, 1.4, 1.3, { z: 24, anchor: true }),
    F('fspeaker', 32.3, 30.4, 1.4, 1.3, { z: 24, anchor: true }),
    F('fspeaker', 58.3, 30.4, 1.4, 1.3, { z: 24, anchor: true }),
  ];
  M.truss = { x0: 34.9 * T, y0: 13.9 * T, x1: 57.2 * T, y1: 29.5 * T, z: 84 };
  M.trussPillars = [
    F('truss', 34.65, 13.65, 0.5, 0.5, { z: 84, anchor: true }),
    F('truss', 56.95, 13.65, 0.5, 0.5, { z: 84, anchor: true }),
    F('truss', 34.65, 29.25, 0.5, 0.5, { z: 84, anchor: true }),
    F('truss', 56.95, 29.25, 0.5, 0.5, { z: 84, anchor: true }),
  ];
  M.flamingo = F('flamingo', 40.4, 34.2, 1.5, 1.1, { z: 52, anchor: true });
  // backstage
  F('lockers', 62.2, 7.1, 5, 0.9, { z: 44 });
  F('coffee', 67.8, 7.1, 1.3, 0.9, { z: 22 });
  M.supply = F('supply', 72.8, 7.1, 3, 1, { z: 40 });
  F('couch', 62.3, 15, 1.3, 2.7, { z: 16, anchor: true, color: '#4a4550', vertical: true });
  M.cctvDesk = F('cctvdesk', 66, 13.2, 3.2, 1.3, { z: 18 });
  M.breaker = F('breaker', 75.3, 8.1, 0.6, 1.3, { z: 30 });
  M.alarmPanel = F('alarmpanel', 75.3, 14.4, 0.6, 1.1, { z: 30 });
  F('boxes', 71.5, 15.6, 2.2, 2, { z: 30, anchor: true });
  // office
  F('mdesk', 80, 10, 3.6, 1.5, { z: 18, anchor: true });
  F('safe', 86.6, 7.2, 1.2, 1.2, { z: 20 });
  F('filing', 76.2, 15.3, 1, 2.2, { z: 32 });
  // VIP
  F('vcouch', 63.5, 18.15, 5, 1.2, { z: 16, anchor: true });
  F('vcouch', 69.5, 18.15, 5, 1.2, { z: 16, anchor: true });
  F('vcouch', 74.65, 21, 1.2, 5, { z: 16, anchor: true, vertical: true });
  F('vcouch', 74.65, 26.5, 1.2, 4.2, { z: 16, anchor: true, vertical: true });
  F('vcouch', 63.5, 30.65, 5, 1.2, { z: 16, anchor: true, flip: true });
  F('vcouch', 69.5, 30.65, 4.5, 1.2, { z: 16, anchor: true, flip: true });
  M.vipTables = [
    F('vtable', 65, 20.3, 2, 0.9, { z: 10 }),
    F('vtable', 71, 20.3, 2, 0.9, { z: 10 }),
    F('vtable', 72.7, 23, 0.9, 2, { z: 10 }),
    F('vtable', 65, 28.8, 2, 0.9, { z: 10 }),
    F('vtable', 70.5, 28.8, 2, 0.9, { z: 10 }),
  ];
  // patio
  F('bench', 86.9, 19.6, 0.9, 4, { z: 12, anchor: true, vertical: true });
  F('bench', 86.9, 31.5, 0.9, 4, { z: 12, anchor: true, vertical: true });
  F('bench', 86.9, 40.5, 0.9, 4, { z: 12, anchor: true, vertical: true });
  F('bench', 77.2, 46.9, 4, 0.9, { z: 12, anchor: true });
  M.ashtrays = [[80, 22], [82.5, 30], [80, 38.5], [83.5, 44]].map(([x, y]) => F('ashtray', x, y, 0.5, 0.5, { z: 22 }));
  M.heaters = [[78, 26.5], [84.5, 36], [78.4, 43.5]].map(([x, y]) => F('heater', x, y, 0.6, 0.6, { z: 64 }));
  F('planter', 76.2, 18.2, 3, 1, { z: 12 });
  // lobby
  F('coatcounter', 40, 41, 0.9, 5, { z: 22, anchor: true });
  F('coatrack', 38.05, 40.6, 0.8, 6.6, { z: 44 });
  F('bench', 53, 41.6, 0.8, 3, { z: 12, anchor: true, vertical: true });
  F('atm', 52.9, 45.6, 1, 1.2, { z: 36 });
  // chill
  F('ccouch', 56, 46.65, 5, 1.2, { z: 16, anchor: true });
  F('ccouch', 66, 46.65, 5, 1.2, { z: 16, anchor: true });
  F('lava', 61.6, 46.9, 0.7, 0.7, { z: 26 });
  F('lava', 71.6, 46.9, 0.7, 0.7, { z: 26 });
  // street + parking
  M.podium = F('podium', 49.9, 48.25, 0.8, 0.7, { z: 24 });
  [[20, 53.3], [60, 53.3], [90, 53.3], [30, 60.2], [74, 60.2]].forEach(([x, y]) => F('lamp', x, y, 0.4, 0.4, { z: 110 }));
  F('bin', 8, 48.3, 0.8, 0.8, { z: 18 });
  F('bikerack', 60, 48.3, 3, 0.5, { z: 10 });
  const carCols = ['#b8322e', '#2e5fb8', '#d9d4c7', '#1d1f24', '#3f7d4a', '#8a8f99', '#c59a2e', '#5b3a82'];
  let ci = 0;
  M.cars = [];
  [4, 7.4, 10.8, 17.4, 20.8, 30.4, 60.6, 64, 67.4, 74, 77.4].forEach((x) => M.cars.push(F('car', x, 55.1, 2.3, 4.4, { z: 26, color: carCols[ci++ % carCols.length] })));
  [2.6, 6, 12.8, 16.2, 23, 33.2, 58.8, 62.2, 69, 72.4, 88].forEach((x) => M.cars.push(F('car', x, 61.4, 2.3, 4.4, { z: 26, color: carCols[ci++ % carCols.length], flip: true })));
  M.kebab = F('kebab', 82.4, 55.3, 5.2, 2.6, { z: 44 });

  // block tiles covered by solid furniture
  M.furn.forEach((f) => {
    if (!f.solid) return;
    const tx0 = Math.floor(f.x0 / T), tx1 = Math.ceil(f.x1 / T), ty0 = Math.floor(f.y0 / T), ty1 = Math.ceil(f.y1 / T);
    for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const ox = Math.min(f.x1, (x + 1) * T) - Math.max(f.x0, x * T);
      const oy = Math.min(f.y1, (y + 1) * T) - Math.max(f.y0, y * T);
      if (ox > 0 && oy > 0 && (ox * oy) / (T * T) > 0.38) walk[ti(x, y)] = 0;
    }
  });

  /* ---------------- movable prop spawns (created by world.js) ---------------- */
  M.propSpawns = [];
  const PS = (kind, x, y, o = {}) => M.propSpawns.push(Object.assign({ kind, x: x * T, y: y * T }, o));
  // bar stools
  M.stoolXs = [];
  for (let x = 17.4; x <= 29.6; x += 1.52) { PS('stool', x, 11.55); M.stoolXs.push(x); }
  // bar tables + chairs
  const table = (x, y, chairs, o = {}) => {
    PS('table', x, y, o);
    const n = chairs;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      PS('chair', x + Math.cos(a) * 1.05, y + Math.sin(a) * 0.9, { face: a + Math.PI });
    }
  };
  table(20, 16, 3); table(26, 15.8, 3); table(20, 22.5, 3); table(26, 22.8, 3); table(20, 29, 3); table(26.2, 29.2, 3);
  table(20, 35.5, 2); table(28.8, 34.8, 2);
  // hall high tables
  PS('table', 36, 35.6, { high: true }); PS('table', 52.4, 35.2, { high: true }); PS('table', 57.6, 37.4, { high: true });
  PS('table', 66, 35, { high: true }); PS('table', 71, 37.8, { high: true });
  // decorative plants (steal targets)
  [[43, 46.9], [49.1, 46.9], [42.6, 38.6], [49.4, 38.6], [17.1, 38.6], [2.9, 41.1], [36.9, 41.1], [74.8, 33], [86.9, 46.6], [63, 31.2], [87.3, 16.6]].forEach(([x, y], i) => PS('plant', x, y, { big: i < 4 || i === 9 }));
  // fire extinguishers on walls
  [[16.35, 25], [32.3, 8.2], [62.35, 38.6], [2.35, 30.2], [76.4, 16.6]].forEach(([x, y]) => PS('extinguisher', x, y, { mounted: true }));
  // parking cones
  [[38.6, 58.4], [55.2, 57.4], [52.4, 63.6], [26.8, 59]].forEach(([x, y]) => PS('cone', x, y));
  // chill bean bags
  [[57, 43], [59.3, 45.3], [62.2, 43.4], [70, 43.2], [72.6, 45.4]].forEach(([x, y]) => PS('beanbag', x, y));
  // patio chairs
  [[79.5, 32.6], [81.2, 25.2], [84.6, 41.2]].forEach(([x, y]) => PS('chair', x, y, { face: U.rand(0, 6) }));

  /* ---------------- points of interest ---------------- */
  const S = (M.S = {});
  const p = (x, y, o = {}) => Object.assign({ x: x * T, y: y * T }, o);
  S.bar = M.stoolXs.map((x, i) => p(x, 11.62, { i, face: -Math.PI / 2 }));
  S.barStaff = M.stoolXs.map((x) => p(x, 8.95));
  S.barFlap = p(30.5, 10.5);
  S.dance = [];
  for (let y = 14.2; y < 29.4; y += 1.15) for (let x = 35.4; x < 57; x += 1.2) S.dance.push(p(x + U.hash(x * 10, y * 10) * 0.5, y + U.hash(y * 10, x * 10) * 0.4));
  S.stalls = [];
  for (let i = 0; i < 3; i++) S.stalls.push(p(3 + 2 * i, 20.55, { door: 'stallM' + i, room: 'mens', front: p(3.5 + 2 * i, 23.2), occ: [], i }));
  for (let i = 0; i < 4; i++) S.stalls.push(p(3 + 2 * i, 38.45, { door: 'stallW' + i, room: 'womens', front: p(3.5 + 2 * i, 35.8), occ: [], i }));
  S.urinals = [0, 1, 2].map((i) => p(9.8 + i * 1.6, 20.1, { occ: null, room: 'mens' }));
  S.sinks = [p(14.55, 21.05, { room: 'mens' }), p(14.55, 23.25, { room: 'mens' }), p(14.55, 32.55, { room: 'womens' }), p(14.55, 34.75, { room: 'womens' })];
  S.mirror = p(12.5, 33.2, { room: 'womens' });
  // static seats
  S.seats = [];
  const seat = (x, y, kind, room, o = {}) => S.seats.push(p(x, y, Object.assign({ kind, room, occ: null }, o)));
  M.booths.forEach(({ booth }) => { const bx = booth.x0 / T; [0.8, 2.1, 3.4].forEach((dx) => seat(bx + dx, 46.55, 'booth', 'lounge', { z: 6 })); });
  [[64.5, 18.7], [66.2, 18.7], [67.9, 18.7], [70.5, 18.7], [72.2, 18.7], [73.8, 18.7]].forEach(([x, y]) => seat(x, y, 'couch', 'vip', { vip: true, z: 6 }));
  [[75.2, 21.8], [75.2, 23.5], [75.2, 25.2], [75.2, 27.4], [75.2, 29.2]].forEach(([x, y]) => seat(x, y, 'couch', 'vip', { vip: true, z: 6 }));
  [[64.5, 31.1], [66.2, 31.1], [67.9, 31.1], [70.5, 31.1], [72.3, 31.1]].forEach(([x, y]) => seat(x, y, 'couch', 'vip', { vip: true, z: 6 }));
  [[57, 47.1], [58.6, 47.1], [60.2, 47.1], [67, 47.1], [68.6, 47.1], [70.2, 47.1]].forEach(([x, y]) => seat(x, y, 'couch', 'chill', { z: 6 }));
  [[87.35, 20.3], [87.35, 22.4], [87.35, 32.2], [87.35, 34.3], [87.35, 41.2], [87.35, 43.3], [78, 47.35], [80, 47.35]].forEach(([x, y]) => seat(x, y, 'bench', 'patio', { z: 5 }));
  [[53.4, 42.2], [53.4, 43.8]].forEach(([x, y]) => seat(x, y, 'bench', 'lobby', { z: 5 }));
  seat(62.95, 15.7, 'couch', 'backstage', { staff: true, z: 6 });
  seat(62.95, 17.1, 'couch', 'backstage', { staff: true, z: 6 });
  // smoking spots
  S.smoke = [];
  for (let i = 0; i < 18; i++) S.smoke.push(p(77.6 + U.hash(i, 3) * 8.6, 19.8 + U.hash(i, 9) * 26));
  // queue outside, head at the door
  S.queue = [];
  for (let i = 0; i < 26; i++) S.queue.push(p(43.2 - i * 0.82, 50.55));
  S.idCheck = p(46, 49.25);
  S.doorStaff = p(49.3, 49.35);
  S.inside = p(46, 45.5);
  S.coat = p(41.35, 43.4);
  S.coatStaff = p(39.25, 43.4);
  S.lostFound = p(39.3, 41.5);
  S.exits = [p(0.7, 51.3, { edge: true }), p(95.3, 51.3, { edge: true }), p(47, 56.8, { taxi: true })];
  S.curb = []; for (let i = 0; i < 12; i++) S.curb.push(p(26 + i * 2.4, 53.4));
  S.taxi = p(47, 57.2);
  S.dj = p(46, 8.35);
  S.djTouch = p(48.7, 8.5);
  S.djGateIn = p(51.3, 10.1);
  S.vipHost = p(61, 25.2);
  S.vipIn = p(63.4, 25);
  S.chef = p(8, 15.2);
  S.manager = p(81.8, 9.25);
  S.bouncerPosts = [p(52, 44.8), p(35.8, 38.6)];
  S.cctv = p(67.6, 14.9);
  S.supply = p(74.3, 8.5);
  S.breaker = p(74.6, 8.8);
  S.alarm = p(74.6, 15);
  S.emergencyIn = p(34, 8.4);
  S.emergencyOut = p(34, 5.4);
  S.kitchenBackOut = p(9, 5.5);
  S.kitchenBackIn = p(9, 8.6);
  S.gateOut = p(90.5, 27);
  S.gateIn = p(86.2, 27);
  S.alleyLoiter = [p(30, 3.5), p(40, 4), p(58, 3.2), p(80, 4.5), p(92, 20), p(92, 36)];
  S.parkingLoiter = [p(40, 58.6), p(46, 59.5), p(52, 58.2), p(56, 61), p(36, 61.5), p(26, 60), p(80, 59.2)];
  S.kebabWindow = p(84.8, 58.4);
  S.hide = [
    p(18.2, 8.6, { room: 'bar', dark: true }), p(26.5, 8.6, { room: 'bar', dark: true }),
    p(14.4, 10.2, { room: 'kitchen' }), p(39.2, 46.6, { room: 'lobby', dark: true }),
    p(73.8, 17.2, { room: 'backstage', dark: true }), p(55.4, 41.2, { room: 'chill', dark: true }),
    p(37.4, 42, { room: 'lounge', dark: true }), p(2.9, 46.9, { room: 'lounge', dark: true }),
  ];
  // places no sane person sits
  S.weird = [
    p(33, 11.7, { kind: 'speaker', z: 24, furn: M.fspeakers[0] }), p(59, 11.7, { kind: 'speaker', z: 24, furn: M.fspeakers[1] }),
    p(33, 30.8, { kind: 'speaker', z: 24, furn: M.fspeakers[2] }), p(59, 30.8, { kind: 'speaker', z: 24, furn: M.fspeakers[3] }),
    p(41.15, 34.5, { kind: 'flamingo', z: 30 }),
    p(15.5, 21.05, { kind: 'sink', z: 14, room: 'mens' }), p(15.5, 32.55, { kind: 'sink', z: 14, room: 'womens' }),
    p(40.45, 43.6, { kind: 'coatcounter', z: 22 }),
    p(45, 11.05, { kind: 'djedge', z: 12 }),
    p(66, 20.75, { kind: 'viptable', z: 10, vipOnly: true }),
    p(53.4, 42.5, { kind: 'bench', z: 18 }),
    p(84.8, 56.6, { kind: 'kebabvan', z: 30 }),
    p(50.3, 48.6, { kind: 'podium', z: 24 }),
    p(13.5, 57.3, { kind: 'car', z: 26 }),
  ];
  S.trussClimb = M.trussPillars.map((f) => p(f.cx / T, f.cy / T + 0.55));

  /* ---------------- lights ---------------- */
  // static light pools. c = colour, r = radius px, i = intensity, flick = flicker kind
  M.lights = [];
  const L = (x, y, r, c, i = 1, o = {}) => M.lights.push(Object.assign({ x: x * T, y: y * T, r: r * T, c, i, room: null }, o));
  // bar
  for (let x = 18; x <= 30; x += 3) L(x, 11.5, 3.2, [255, 170, 90], 0.75);
  L(24, 8, 9, [255, 140, 60], 0.5, { strip: true });
  [[20, 16], [26, 15.8], [20, 22.5], [26, 22.8], [20, 29], [26.2, 29.2], [20, 35.5], [28.8, 34.8]].forEach(([x, y]) => L(x, y, 2.2, [255, 180, 110], 0.55, { candle: true }));
  // lounge
  M.booths.forEach(({ table }) => L(table.cx / T, table.cy / T, 3, [255, 120, 100], 0.6, { candle: true }));
  // lobby
  L(46, 44, 7, [255, 150, 170], 0.8); L(41, 43.5, 3, [255, 210, 150], 0.7);
  // VIP
  L(66, 20.5, 4, [255, 190, 120], 0.6); L(72, 22, 4, [230, 120, 255], 0.6); L(67.5, 29, 4, [255, 110, 180], 0.6);
  // chill
  L(62, 47, 3.5, [190, 90, 255], 0.9, { lava: true }); L(72, 47, 3.5, [255, 80, 150], 0.9, { lava: true }); L(64, 43, 6, [120, 80, 255], 0.35);
  // patio heaters + string lights
  M.heaters.forEach((h) => L(h.cx / T, h.cy / T, 3.2, [255, 120, 40], 0.9, { heater: true }));
  for (let y = 20; y <= 46; y += 3) for (let x = 78; x <= 86; x += 4) L(x + ((y / 3) % 2) * 2, y, 2.2, [255, 200, 120], 0.45, { string: true });
  // backstage / office
  L(67.6, 13.5, 3, [120, 200, 255], 0.9, { screen: true }); L(70, 10, 6, [200, 200, 180], 0.35); L(81.8, 10.5, 4, [255, 210, 150], 0.8);
  // street
  L(20, 53.3, 7, [255, 160, 60], 1); L(60, 53.3, 7, [255, 160, 60], 1); L(90, 53.3, 7, [255, 160, 60], 1);
  L(46, 49.5, 6, [255, 60, 150], 1.1, { sign: true });
  L(30, 60.2, 8, [255, 170, 80], 0.9); L(74, 60.2, 8, [255, 170, 80], 0.9);
  L(84.8, 57.8, 5, [255, 220, 140], 0, { kebab: true });
  // alley
  L(9, 6, 3.5, [255, 210, 120], 0.9, { flick: 'bulb' }); L(71, 6, 3.5, [255, 210, 120], 0.9); L(34, 6, 3, [60, 255, 120], 0.8);
  // bathrooms: flicker in the men's
  L(9, 24, 6, [220, 255, 235], 0.5, { flick: 'tube' });
  // assign rooms
  M.lights.forEach((l) => { const r = M.roomAt(l.x, l.y); l.room = r ? r.id : null; });

  /* ---------------- neon signs (drawn additively) ---------------- */
  M.neon = [
    { kind: 'logo', x: 46 * T, y: 48 * T, wall: true, c: '#ff3d9a' },
    { kind: 'text', text: 'FLAMINGO', x: 46 * T, y: 7 * T, wall: true, c: '#ff4fa8', size: 22 },
    { kind: 'text', text: 'BAR', x: 24 * T, y: 7 * T, wall: true, c: '#ffb640', size: 18 },
    { kind: 'text', text: 'VIP', x: 69 * T, y: 18 * T, wall: true, c: '#ffd76a', size: 18 },
    { kind: 'text', text: 'EXIT', x: 34 * T, y: 7 * T, wall: true, c: '#3dff8a', size: 11, exit: true },
    { kind: 'text', text: 'EXIT', x: 46 * T, y: 40 * T, wall: true, c: '#3dff8a', size: 11, exit: true },
    { kind: 'text', text: 'STAFF ONLY', x: 62 * T, y: 11.4 * T, wall: false, c: '#ff4040', size: 9 },
    { kind: 'text', text: 'SMOKING', x: 82 * T, y: 18 * T, wall: true, c: '#8fd0ff', size: 12 },
    { kind: 'text', text: 'NO SMOKING', x: 24 * T, y: 40 * T, wall: true, c: '#ff5a5a', size: 9 },
    { kind: 'text', text: 'CHILL', x: 65 * T, y: 40 * T, wall: true, c: '#b98cff', size: 12 },
    { kind: 'text', text: 'KEBAB', x: 85 * T, y: 55.3 * T, wall: false, c: '#ffcf4a', size: 11, kebab: true },
    { kind: 'text', text: 'MEN', x: 13 * T, y: 28 * T, wall: true, c: '#5ab8ff', size: 9 },
    { kind: 'text', text: 'WOMEN', x: 13 * T, y: 31 * T, wall: false, c: '#ff7ad0', size: 9 },
    { kind: 'text', text: 'COATS', x: 39 * T, y: 40 * T, wall: true, c: '#fff0c0', size: 10 },
    { kind: 'strip', x0: 32 * T, x1: 60 * T, y: 32 * T, c: '#ff2e88' },
    { kind: 'strip', x0: 16 * T, x1: 30 * T, y: 10.1 * T, c: '#2ee6ff', under: true },
    { kind: 'strip', x0: 62 * T, x1: 76 * T, y: 32 * T, c: '#ffcb4a' },
  ];

  /* ---------------- CCTV cameras (view width in tiles) ---------------- */
  M.cams = [
    { id: '01', label: 'FRONT DOOR', x: 44 * T, y: 51 * T, vw: 34 },
    { id: '02', label: 'LOBBY', x: 46 * T, y: 44 * T, vw: 20 },
    { id: '03', label: 'BAR', x: 24 * T, y: 21 * T, vw: 26 },
    { id: '04', label: 'DANCE FLOOR', x: 46 * T, y: 21.5 * T, vw: 34 },
    { id: '05', label: 'DJ BOOTH', x: 46 * T, y: 10 * T, vw: 18 },
    { id: '06', label: 'VIP', x: 69 * T, y: 25 * T, vw: 22 },
    { id: '07', label: 'BACKSTAGE', x: 69 * T, y: 12.5 * T, vw: 20 },
    { id: '08', label: 'BATHROOM CORRIDOR', x: 9 * T, y: 29.5 * T, vw: 16, note: 'legally as close as we can get' },
    { id: '09', label: 'SMOKING AREA', x: 82 * T, y: 33 * T, vw: 26 },
    { id: '10', label: 'ALLEY', x: 42 * T, y: 3.5 * T, vw: 40 },
    { id: '11', label: 'PARKING LOT', x: 50 * T, y: 59.5 * T, vw: 46 },
    { id: '12', label: 'BOOTHS', x: 20 * T, y: 44 * T, vw: 30 },
    { id: '13', label: 'CHILL-OUT', x: 65 * T, y: 44 * T, vw: 24 },
    { id: '14', label: 'KITCHEN', x: 9 * T, y: 13 * T, vw: 16 },
    { id: '15', label: 'HALLWAY', x: 50 * T, y: 36 * T, vw: 30 },
  ];

  /* ---------------- queries ---------------- */
  function roomAtPx(px, py) {
    const x = Math.floor(px / T), y = Math.floor(py / T);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const r = roomIdx[ti(x, y)];
    return r >= 0 ? ROOMS[r] : null;
  }
  M.inRoom = (px, py, id) => { const r = roomAtPx(px, py); return !!r && r.id === id; };
  M.isOutdoor = (px, py) => { const r = roomAtPx(px, py); return !r || !!r.outdoor; };
  M.isInside = (px, py) => { const r = roomAtPx(px, py); return !!r && !r.outdoor; };
  M.inClub = (px, py) => { const r = roomAtPx(px, py); return !!r && (!r.outdoor || r.id === 'patio'); };
  M.onLED = (px, py) => px >= M.LED.x0 * T && px < M.LED.x1 * T && py >= M.LED.y0 * T && py < M.LED.y1 * T;
  M.tileOk = (x, y, perm) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = ti(x, y);
    return walk[i] === 1 && (zone[i] & perm) !== 0;
  };
  function edgeOk(type, perm, doorIdx) {
    switch (type) {
      case E.OPEN: return true;
      case E.WALL: return false;
      case E.VIP: return (perm & P.VIP) !== 0;
      case E.EMERG: return (perm & P.EMERG) !== 0 || (doorIdx >= 0 && M.doors[doorIdx].open > 0.5);
      case E.GATE: return (perm & P.CLIMB) !== 0 || (doorIdx >= 0 && M.doors[doorIdx].open > 0.5);
      default: return (perm & P.STAFF) !== 0;
    }
  }
  // can you step from tile (x,y) to its orthogonal neighbour (x+dx, y+dy)
  function stepOk(x, y, dx, dy, perm) {
    const nx = x + dx, ny = y + dy;
    if (!M.tileOk(nx, ny, perm)) return false;
    if (dx === 1) return edgeOk(vEdge[vi(x + 1, y)], perm, vDoor[vi(x + 1, y)]);
    if (dx === -1) return edgeOk(vEdge[vi(x, y)], perm, vDoor[vi(x, y)]);
    if (dy === 1) return edgeOk(hEdge[hi(x, y + 1)], perm, hDoor[hi(x, y + 1)]);
    return edgeOk(hEdge[hi(x, y)], perm, hDoor[hi(x, y)]);
  }
  M.stepOk = stepOk;
  function diagOk(x, y, dx, dy, perm) {
    return stepOk(x, y, dx, 0, perm) && stepOk(x + dx, y, 0, dy, perm) && stepOk(x, y, 0, dy, perm) && stepOk(x, y + dy, dx, 0, perm);
  }

  // nearest passable tile by ring search, preferring the same room as (x,y)
  function nearestTile(x, y, perm, maxR = 6) {
    if (M.tileOk(x, y, perm)) return [x, y];
    const home = x >= 0 && y >= 0 && x < W && y < H ? roomIdx[ti(x, y)] : -1;
    let fallback = null;
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!M.tileOk(x + dx, y + dy, perm)) continue;
        const d = dx * dx + dy * dy;
        if (home >= 0 && roomIdx[ti(x + dx, y + dy)] !== home) { if (!fallback) fallback = [x + dx, y + dy]; continue; }
        if (d < bd) { bd = d; best = [x + dx, y + dy]; }
      }
      if (best) return best;
    }
    return fallback;
  }
  M.nearest = (px, py, perm = P.ALL, maxR = 6) => {
    const t = nearestTile(Math.floor(px / T), Math.floor(py / T), perm, maxR);
    return t ? { x: (t[0] + 0.5) * T, y: (t[1] + 0.5) * T } : null;
  };

  /* ---------------- A* ---------------- */
  const gS = new Float32Array(N), fS = new Float32Array(N);
  const came = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
  let gen = 1;
  const heap = new Int32Array(N * 4);
  let hn = 0;
  function hpush(i) {
    let k = hn++;
    heap[k] = i;
    while (k > 0) { const pk = (k - 1) >> 1; if (fS[heap[pk]] <= fS[heap[k]]) break; const t = heap[pk]; heap[pk] = heap[k]; heap[k] = t; k = pk; }
  }
  function hpop() {
    const top = heap[0];
    heap[0] = heap[--hn];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < hn && fS[heap[l]] < fS[heap[m]]) m = l;
      if (r < hn && fS[heap[r]] < fS[heap[m]]) m = r;
      if (m === k) break;
      const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
    }
    return top;
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  M.pathCalls = 0;
  // returns array of px waypoints (excluding start) or null. opts.avoidDance adds cost on the LED floor
  M.path = function (ax, ay, bx, by, perm, opts = {}) {
    M.pathCalls++;
    // you can always walk out of wherever you already are, allowed or not
    const ax0 = Math.floor(ax / T), ay0 = Math.floor(ay / T);
    if (ax0 >= 0 && ay0 >= 0 && ax0 < W && ay0 < H && walk[ti(ax0, ay0)] === 1) perm |= zone[ti(ax0, ay0)];
    const s = nearestTile(ax0, ay0, perm, 3);
    const g = nearestTile(Math.floor(bx / T), Math.floor(by / T), perm, 5);
    if (!s || !g) return null;
    const si = ti(s[0], s[1]), gi = ti(g[0], g[1]);
    if (si === gi) return [{ x: bx, y: by }];
    gen++;
    if (gen > 4e9) { gen = 1; stamp.fill(0); closed.fill(0); }
    hn = 0;
    stamp[si] = gen; gS[si] = 0; fS[si] = oct(s[0], s[1], g[0], g[1]); came[si] = -1;
    hpush(si);
    const avoid = !!opts.avoidDance, maxIter = opts.maxIter || 9000;
    let it = 0, found = false;
    while (hn > 0 && it++ < maxIter) {
      const cur = hpop();
      if (cur === gi) { found = true; break; }
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        const ok = d < 4 ? stepOk(cx, cy, dx, dy, perm) : diagOk(cx, cy, dx, dy, perm);
        if (!ok) continue;
        const nx = cx + dx, ny = cy + dy, ni = ti(nx, ny);
        if (closed[ni] === gen) continue;
        let cost = d < 4 ? 1 : 1.4142;
        if (avoid && floor[ni] === 'led') cost += 1.6;
        const ng = gS[cur] + cost;
        if (stamp[ni] !== gen || ng < gS[ni]) {
          stamp[ni] = gen; gS[ni] = ng; fS[ni] = ng + oct(nx, ny, g[0], g[1]); came[ni] = cur;
          hpush(ni);
        }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let c = gi; c !== -1 && c !== si; c = came[c]) pts.push({ x: ((c % W) + 0.5) * T, y: (((c / W) | 0) + 0.5) * T });
    pts.reverse();
    // finish on the exact goal when it sits in the goal tile
    if (Math.floor(bx / T) === g[0] && Math.floor(by / T) === g[1]) pts[pts.length - 1] = { x: bx, y: by };
    return smooth(ax, ay, pts, perm);
  };
  function oct(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
  }
  // line of sight on the tile grid, walking the cells a segment crosses
  function losLine(ax, ay, bx, by, perm) {
    let x = Math.floor(ax / T), y = Math.floor(ay / T);
    const x1 = Math.floor(bx / T), y1 = Math.floor(by / T);
    const dx = bx - ax, dy = by - ay;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(T / dx) : 1e9, tdy = dy !== 0 ? Math.abs(T / dy) : 1e9;
    let tmx = dx !== 0 ? ((sx > 0 ? (x + 1) * T - ax : ax - x * T) / Math.abs(dx)) : 1e9;
    let tmy = dy !== 0 ? ((sy > 0 ? (y + 1) * T - ay : ay - y * T) / Math.abs(dy)) : 1e9;
    let guard = 0;
    if (!M.tileOk(x, y, perm)) return false;
    while ((x !== x1 || y !== y1) && guard++ < 400) {
      if (Math.abs(tmx - tmy) < 1e-9) {
        if (!diagOk(x, y, sx, sy, perm)) return false;
        x += sx; y += sy; tmx += tdx; tmy += tdy;
      } else if (tmx < tmy) {
        if (!stepOk(x, y, sx, 0, perm)) return false;
        x += sx; tmx += tdx;
      } else {
        if (!stepOk(x, y, 0, sy, perm)) return false;
        y += sy; tmy += tdy;
      }
    }
    return true;
  }
  M.los = (ax, ay, bx, by, perm = P.ALL, r = 0) => {
    if (!losLine(ax, ay, bx, by, perm)) return false;
    if (r > 0) {
      const d = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / d) * r, ny = ((bx - ax) / d) * r;
      if (!losLine(ax + nx, ay + ny, bx + nx, by + ny, perm)) return false;
      if (!losLine(ax - nx, ay - ny, bx - nx, by - ny, perm)) return false;
    }
    return true;
  };
  function smooth(ax, ay, pts, perm) {
    if (pts.length < 3) return pts;
    const out = [];
    let cx = ax, cy = ay, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !M.los(cx, cy, pts[j].x, pts[j].y, perm, 9)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cy = pts[j].y;
      i = j + 1;
    }
    return out;
  }

  // sight lines for noticing: blocked by full walls, not by low walls, ropes or fences
  M.sight = (ax, ay, bx, by) => {
    for (const s of M.segs) {
      if (!s.active || s.kind === 'low' || s.kind === 'fence' || s.kind === 'stall') continue;
      if (s.kind === 'door' && s.door && (s.door.kind === 'stall' || s.door.kind === 'gate')) continue;
      if (U.segHit(ax, ay, bx, by, s.ax, s.ay, s.bx, s.by)) return false;
    }
    for (const d of M.doors) {
      if ((d.kind === 'swing' || d.kind === 'double') && d.open < 0.3 && U.segHit(ax, ay, bx, by, d.x0, d.y0, d.x1, d.y1)) return false;
    }
    return true;
  };

  M.randomPoint = (roomId, perm = P.ALL, tries = 40) => {
    const r = roomById[roomId];
    if (!r) return null;
    for (let k = 0; k < tries; k++) {
      const rc = U.pick(r.rects);
      const x = U.randi(rc[0], rc[2] - 1), y = U.randi(rc[1], rc[3] - 1);
      if (M.tileOk(x, y, perm) && roomIdx[ti(x, y)] === r.index) return { x: (x + 0.2 + Math.random() * 0.6) * T, y: (y + 0.2 + Math.random() * 0.6) * T };
    }
    return null;
  };

  // how much sound from room a reaches room b (1 same room, lower through doors)
  M.hear = (a, b) => {
    if (!a || !b) return 0.2;
    if (a === b) return 1;
    let best = 0.12;
    for (const d of M.doors) {
      if ((d.rooms[0] === a && d.rooms[1] === b) || (d.rooms[1] === a && d.rooms[0] === b)) {
        best = Math.max(best, d.kind === 'arch' || d.kind === 'rope' ? 0.75 : 0.25 + d.open * 0.45);
      }
    }
    if ((a === 'dance' && b === 'hall') || (a === 'hall' && b === 'dance') || (a === 'bar' && (b === 'dance' || b === 'hall')) || (b === 'bar' && (a === 'dance' || a === 'hall'))) best = 0.85;
    return best;
  };

  // door animation: swing doors open for anyone nearby
  M.updateDoors = (dt, chars) => {
    for (const d of M.doors) {
      if (d.kind === 'arch' || d.kind === 'rope') continue;
      let near = false;
      if (d.kind === 'swing' || d.kind === 'double') {
        for (let k = 0; k < chars.length; k++) {
          const c = chars[k];
          if (Math.abs(c.x - d.cx) < d.len / 2 + 34 && Math.abs(c.y - d.cy) < d.len / 2 + 34) {
            const cl = U.segClosest(c.x, c.y, d.x0, d.y0, d.x1, d.y1);
            if (U.dist2(c.x, c.y, cl.x, cl.y) < 34 * 34) { near = true; break; }
          }
        }
        d.target = near ? 1 : 0;
      }
      const prev = d.open;
      d.open = U.damp(d.open, d.target, d.kind === 'double' ? 9 : 11, dt);
      if (Math.abs(d.open - d.target) < 0.01) d.open = d.target;
      d.justOpened = prev < 0.2 && d.open >= 0.2;
      d.justClosed = prev > 0.1 && d.open <= 0.1 && d.target === 0;
      if (d.seg) d.seg.active = d.open < 0.5;
    }
  };
})();
