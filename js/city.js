// The city: roads, parks, buildings, the sea, and the special places
// (Car Shop, Upgrade Shop, Racing Stadium and Marina).

const T = 48; // tile size in pixels
const MAP_W = 100;
const MAP_H = 72;

const TILE = {
  GRASS: 0, ROAD: 1, WALK: 2, BUILDING: 3, WATER: 4, PARK: 5, PATH: 6, SAND: 7, PLAZA: 8, TREE: 9, DOCK: 10,
};

const ROAD_COLS = [[4, 6], [24, 26], [44, 46], [64, 66], [78, 80]];
const ROAD_ROWS = [[4, 6], [24, 26], [44, 46], [64, 66]];
const SEA_X = 84;

// Small seeded random generator so the city looks the same every time.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
}

const City = {
  tiles: new Uint8Array(MAP_W * MAP_H),
  buildings: [], // {x,y,w,h,color,kind}
  zones: [], // interactive places
  decor: [], // fountains, benches, playground...
  traffic: [],
  minimap: null,

  get(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return TILE.BUILDING;
    return this.tiles[y * MAP_W + x];
  },
  set(x, y, t) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    this.tiles[y * MAP_W + x] = t;
  },
  fill(x0, y0, x1, y1, t) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t);
  },
  tileAt(px, py) {
    return this.get(Math.floor(px / T), Math.floor(py / T));
  },
  isHRoadRow(y) {
    return ROAD_ROWS.some(([a, b]) => y >= a && y <= b);
  },
  isVRoadCol(x) {
    return ROAD_COLS.some(([a, b]) => x >= a && x <= b);
  },

  build() {
    const rnd = seeded(2024);
    this.fill(0, 0, MAP_W - 1, MAP_H - 1, TILE.GRASS);

    // Sea and beach on the east side
    this.fill(SEA_X, 0, MAP_W - 1, MAP_H - 1, TILE.WATER);
    this.fill(82, 0, 83, MAP_H - 1, TILE.SAND);

    // Roads
    for (const [a, b] of ROAD_ROWS) this.fill(0, a, 80, b, TILE.ROAD);
    for (const [a, b] of ROAD_COLS) this.fill(a, 0, b, MAP_H - 1, TILE.ROAD);

    // The stadium takes up two blocks, so remove the road between them
    this.fill(64, 47, 66, 63, TILE.GRASS);

    // Sidewalks next to every road
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < SEA_X; x++) {
        const t = this.get(x, y);
        if (t === TILE.ROAD) continue;
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.get(x + dx, y + dy) === TILE.ROAD && !(x + dx < 0 || y + dy < 0 || x + dx >= MAP_W || y + dy >= MAP_H)) near = true;
        if (near) this.set(x, y, TILE.WALK);
      }
    }

    const XS = [[8, 22], [28, 42], [48, 62], [68, 76]];
    const YS = [[8, 22], [28, 42], [48, 62]];
    const special = {
      '0,0': 'dealer', '1,0': 'park1', '1,1': 'upgrade', '2,1': 'park2', '2,2': 'stadium', '3,2': 'stadium',
    };
    for (let by = 0; by < 3; by++) {
      for (let bx = 0; bx < 4; bx++) {
        const kind = special[bx + ',' + by];
        const [x0, x1] = XS[bx];
        const [y0, y1] = YS[by];
        if (!kind) this.makeBuildings(x0, y0, x1, y1, rnd);
      }
    }

    this.makeDealer();
    this.makeUpgradeShop();
    this.makeStadium();
    this.makePark(28, 8, 42, 22, rnd, true);
    this.makePark(48, 28, 62, 42, rnd, false);
    this.makeMarina();
    this.makeOutskirts(rnd);
    this.makeTraffic(rnd);
    this.makeMinimap();
    this.makePatterns();
    // street lamps (for night lighting) and trees, found once
    this.lampList = [];
    this.treeList = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = this.get(x, y);
      if (t === TILE.WALK && hash(x, y) > 0.93) this.lampList.push({ x: (x + 0.5) * T, y: (y + 0.5) * T, r: 150, color: 'rgba(255,214,120,0.9)' });
      if (t === TILE.TREE) this.treeList.push([x, y]);
    }
    this.chunks = new Map();
  },

  // The ground never changes, so it is drawn once into 8x8-tile pictures and reused.
  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) {
      this.chunks.delete(key); // move to the end: recently used
      this.chunks.set(key, c);
      return c;
    }
    const CH = 8, S = CH * T;
    c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(-cx * S, -cy * S);
    this.staticPass = true;
    for (let y = cy * CH; y < cy * CH + CH; y++) for (let x = cx * CH; x < cx * CH + CH; x++) if (x < MAP_W && y < MAP_H) this.drawTile(g, x, y, this.get(x, y), 0);
    this.staticPass = false;
    this.chunks.set(key, c);
    if (this.chunks.size > 70) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  },

  // Small noise textures so grass and roads don't look flat
  makePatterns() {
    const make = (base, specks) => {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = base;
      g.fillRect(0, 0, 96, 96);
      const r = seeded(base.length * 31 + specks.length);
      for (const [col, n, size] of specks) {
        g.fillStyle = col;
        for (let i = 0; i < n; i++) g.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), size, size + (size > 1 ? 1 : 0));
      }
      return this.patternCtx.createPattern(c, 'repeat');
    };
    this.patternCtx = document.createElement('canvas').getContext('2d');
    this.pat = {
      grass: make('#78c165', [['#6cb35a', 260, 2], ['#8bd176', 220, 2], ['#5fa64f', 60, 1]]),
      park: make('#8bd077', [['#7cc268', 240, 2], ['#9edb8a', 200, 2]]),
      road: make('#3f444c', [['#4a5059', 300, 1], ['#353940', 260, 1], ['#555b64', 40, 2]]),
      walk: make('#cbd0d5', [['#bfc4ca', 200, 1], ['#d6dade', 160, 1]]),
      sand: make('#efd99a', [['#e4cb85', 260, 1], ['#f7e5b3', 200, 1]]),
    };
  },

  makeBuildings(x0, y0, x1, y1, rnd) {
    const colors = ['#e9d8c4', '#cfd8e3', '#f2c9b8', '#c4d0e6', '#ddd2ee', '#f3e2ad', '#b9d6c2', '#e6c3c3', '#d9e4ec'];
    // Split the block into lots of different sizes
    const lots = [];
    const split = (x, y, w, h, depth) => {
      if ((w <= 6 && h <= 6) || depth > 3) return lots.push({ x, y, w, h });
      if (w >= h) {
        const c = 3 + Math.floor(rnd() * (w - 5));
        split(x, y, c, h, depth + 1);
        split(x + c, y, w - c, h, depth + 1);
      } else {
        const c = 3 + Math.floor(rnd() * (h - 5));
        split(x, y, w, c, depth + 1);
        split(x, y + c, w, h - c, depth + 1);
      }
    };
    split(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0);
    for (const l of lots) {
      // leave a 1-tile garden gap around each building
      const b = { x: l.x, y: l.y, w: l.w - 1, h: l.h - 1, color: colors[Math.floor(rnd() * colors.length)], height: 6 + rnd() * 18, kind: 'normal', seed: rnd() };
      if (b.w < 2 || b.h < 2) continue;
      this.fill(l.x, l.y, l.x + l.w - 1, l.y + l.h - 1, TILE.PARK);
      this.fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, TILE.BUILDING);
      this.buildings.push(b);
    }
    // little trees in the leftover gaps
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.get(x, y) === TILE.PARK && hash(x, y) < 0.18) this.set(x, y, TILE.TREE);
  },

  makeDealer() {
    this.fill(8, 8, 22, 22, TILE.PLAZA);
    this.fill(9, 9, 21, 16, TILE.BUILDING);
    this.buildings.push({ x: 9, y: 9, w: 13, h: 8, color: '#f7f7f7', height: 10, kind: 'dealer' });
    this.zones.push({ id: 'dealer', name: 'CAR SHOP', hint: 'Enter the Car Shop', x: 13 * T, y: 17 * T, w: 5 * T, h: 3 * T, color: '#ffd54f' });
    this.spawn = { x: 15.5 * T, y: 21 * T, a: -Math.PI / 2 };
  },

  makeUpgradeShop() {
    this.fill(28, 28, 42, 42, TILE.PLAZA);
    this.fill(30, 29, 40, 35, TILE.BUILDING);
    this.buildings.push({ x: 30, y: 29, w: 11, h: 7, color: '#ff8a65', height: 9, kind: 'upgrade' });
    this.zones.push({ id: 'upgrade', name: 'UPGRADE SHOP', hint: 'Upgrade your ride', x: 32 * T, y: 36 * T, w: 7 * T, h: 4 * T, color: '#ff7043' });
  },

  makeStadium() {
    this.fill(48, 48, 76, 62, TILE.PLAZA);
    this.fill(49, 51, 75, 62, TILE.BUILDING);
    this.buildings.push({ x: 49, y: 51, w: 27, h: 12, color: '#90a4ae', height: 14, kind: 'stadium' });
    this.zones.push({ id: 'race', name: 'RACING AREA', hint: 'Pick a race track', x: 58 * T, y: 47.5 * T, w: 9 * T, h: 3.5 * T, color: '#e53935' });
  },

  makePark(x0, y0, x1, y1, rnd, pond) {
    this.fill(x0, y0, x1, y1, TILE.PARK);
    const cx = Math.floor((x0 + x1) / 2);
    const cy = Math.floor((y0 + y1) / 2);
    // paths in a cross and a ring
    this.fill(cx, y0, cx, y1, TILE.PATH);
    this.fill(x0, cy, x1, cy, TILE.PATH);
    for (let x = x0 + 2; x <= x1 - 2; x++) { this.set(x, y0 + 2, TILE.PATH); this.set(x, y1 - 2, TILE.PATH); }
    for (let y = y0 + 2; y <= y1 - 2; y++) { this.set(x0 + 2, y, TILE.PATH); this.set(x1 - 2, y, TILE.PATH); }
    if (pond) {
      for (let y = y0 + 3; y <= y0 + 6; y++) for (let x = x0 + 3; x <= x0 + 6; x++) if ((x - x0 - 4.5) ** 2 + (y - y0 - 4.5) ** 2 < 5) this.set(x, y, TILE.WATER);
      for (let y = y1 - 6; y <= y1 - 3; y++) for (let x = x1 - 6; x <= x1 - 3; x++) if ((x - x1 + 4.5) ** 2 + (y - y1 + 4.5) ** 2 < 5) this.set(x, y, TILE.WATER);
      this.decor.push({ kind: 'fountain', x: (cx + 0.5) * T, y: (cy + 0.5) * T });
    } else {
      this.decor.push({ kind: 'playground', x: (x0 + 4.5) * T, y: (y1 - 4.5) * T });
      this.decor.push({ kind: 'gazebo', x: (cx + 0.5) * T, y: (cy + 0.5) * T });
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.get(x, y) !== TILE.PARK) continue;
        const h = hash(x, y);
        if (h < 0.22 && Math.abs(x - cx) > 1 && Math.abs(y - cy) > 1) this.set(x, y, TILE.TREE);
        else if (h > 0.96) this.decor.push({ kind: 'bench', x: (x + 0.5) * T, y: (y + 0.5) * T });
      }
    }
  },

  makeMarina() {
    this.fill(81, 33, 92, 35, TILE.DOCK);
    this.fill(88, 30, 89, 38, TILE.DOCK);
    this.zones.push({ id: 'marina', name: 'MARINA', hint: 'Switch between boat and car', x: 86 * T, y: 31 * T, w: 7 * T, h: 7 * T, color: '#29b6f6' });
    this.boatSpawn = { x: 91 * T, y: 40 * T, a: Math.PI / 2 };
    this.carSpawn = { x: 84 * T, y: 34.5 * T, a: Math.PI };
  },

  makeOutskirts(rnd) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < SEA_X; x++) {
        if (this.get(x, y) === TILE.GRASS && hash(x + 7, y + 3) < 0.25) this.set(x, y, TILE.TREE);
      }
    }
  },

  makeTraffic(rnd) {
    const colors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fafafa', '#8e24aa', '#fb8c00', '#546e7a'];
    const lanes = [];
    for (const [a] of ROAD_ROWS) {
      lanes.push({ dir: 0, y: (a + 2.25) * T, from: 0, to: 81 * T });
      lanes.push({ dir: Math.PI, y: (a + 0.75) * T, from: 0, to: 81 * T });
    }
    for (const [a] of ROAD_COLS) {
      const to = a === 64 ? 46 * T : MAP_H * T;
      lanes.push({ dir: Math.PI / 2, x: (a + 0.75) * T, from: 0, to });
      lanes.push({ dir: -Math.PI / 2, x: (a + 2.25) * T, from: 0, to });
    }
    for (const lane of lanes) {
      const n = 2;
      for (let i = 0; i < n; i++) {
        const p = lane.from + rnd() * (lane.to - lane.from);
        const horizontal = lane.y !== undefined;
        this.traffic.push({
          lane, horizontal,
          x: horizontal ? p : lane.x,
          y: horizontal ? lane.y : p,
          a: lane.dir,
          speed: 90 + rnd() * 60,
          color: colors[Math.floor(rnd() * colors.length)],
          type: rnd() < 0.15 ? 'bus' : 'car',
        });
      }
    }
  },

  updateTraffic(dt, player) {
    for (const c of this.traffic) {
      // slow down when the player is right in front
      let speed = c.speed;
      const ahead = { x: c.x + Math.cos(c.a) * 70, y: c.y + Math.sin(c.a) * 70 };
      if (player && Math.hypot(player.x - ahead.x, player.y - ahead.y) < 50) speed = 0;
      c.stopped = speed === 0;
      const d = speed * dt;
      if (c.horizontal) {
        c.x += Math.cos(c.a) * d;
        if (c.x > c.lane.to) c.x = c.lane.from;
        if (c.x < c.lane.from) c.x = c.lane.to;
      } else {
        c.y += Math.sin(c.a) * d;
        if (c.y > c.lane.to) c.y = c.lane.from;
        if (c.y < c.lane.from) c.y = c.lane.to;
      }
    }
  },

  makeMinimap() {
    const c = document.createElement('canvas');
    c.width = MAP_W * 2;
    c.height = MAP_H * 2;
    const g = c.getContext('2d');
    const col = { 0: '#7cc46a', 1: '#4a4f57', 2: '#bfc4c9', 3: '#d9d2c5', 4: '#3aa0e0', 5: '#8fd27a', 6: '#e8d9b0', 7: '#f1dc9b', 8: '#c9ccd1', 9: '#3f8f3a', 10: '#a1774b' };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      g.fillStyle = col[this.get(x, y)];
      g.fillRect(x * 2, y * 2, 2, 2);
    }
    for (const z of this.zones) {
      g.fillStyle = z.color;
      g.fillRect(z.x / T * 2 - 1, z.y / T * 2 - 1, z.w / T * 2 + 2, z.h / T * 2 + 2);
    }
    this.minimap = c;
  },

  // Is this point blocked for this kind of vehicle?
  solidFor(px, py, type) {
    const t = this.tileAt(px, py);
    if (type === 'boat') return t !== TILE.WATER;
    if (type === 'walk') return t === TILE.BUILDING || t === TILE.WATER || t === TILE.TREE;
    return t === TILE.BUILDING || t === TILE.WATER || t === TILE.TREE;
  },

  // ---------------------------------------------------------------- drawing
  draw(ctx, cam, time) {
    const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
    const x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + cam.w) / T) + 1);
    const y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + cam.h) / T) + 1);
    const S = 8 * T;
    for (let cy = Math.floor(y0 / 8); cy <= Math.floor(y1 / 8); cy++) {
      for (let cx = Math.floor(x0 / 8); cx <= Math.floor(x1 / 8); cx++) ctx.drawImage(this.chunk(cx, cy), cx * S, cy * S, S + 1, S + 1);
    }
    // moving water on top
    if (FX.high) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.get(x, y) === TILE.WATER) this.drawWaterFx(ctx, x, y, time);
    this.lamps = this.lampList.filter((L) => L.x > cam.x - 160 && L.x < cam.x + cam.w + 160 && L.y > cam.y - 160 && L.y < cam.y + cam.h + 160);
    // zones (glowing pads)
    for (const z of this.zones) {
      const pulse = 0.35 + 0.25 * Math.sin(time * 3);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = z.color;
      roundRect(ctx, z.x, z.y, z.w, z.h, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = z.color;
      ctx.stroke();
      ctx.restore();
    }
    for (const d of this.decor) this.drawDecor(ctx, d, time);
    // trees on top of ground
    for (const [x, y] of this.treeList) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) this.drawTree(ctx, x, y, cam);
  },

  heightOf(b) {
    if (b.kind === 'stadium') return 70;
    if (b.kind === 'dealer') return 95;
    if (b.kind === 'upgrade') return 80;
    return b.height * 12;
  },

  visibleBuildings(cam, margin) {
    return this.buildings.filter((b) => {
      const bx = b.x * T, by = b.y * T, bw = b.w * T, bh = b.h * T;
      return !(bx > cam.x + cam.w + margin || by > cam.y + cam.h + margin || bx + bw < cam.x - margin || by + bh < cam.y - margin);
    });
  },

  // Sun shadows on the ground (drawn before cars)
  drawShadows(ctx, cam) {
    const sun = (this.sunNow = FX.sun());
    ctx.fillStyle = `rgba(10,20,40,${sun.alpha})`;
    for (const b of this.visibleBuildings(cam, 400)) {
      const hp = this.heightOf(b);
      const x0 = b.x * T, y0 = b.y * T, x1 = x0 + b.w * T, y1 = y0 + b.h * T;
      const sx = sun.x * hp, sy = sun.y * hp;
      const pts = hull([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0 + sx, y0 + sy], [x1 + sx, y0 + sy], [x1 + sx, y1 + sy], [x0 + sx, y1 + sy]]);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
  },

  // Buildings rise up towards the camera, so the city looks 3D.
  drawTop(ctx, cam, time) {
    const cx = cam.x + cam.w / 2, cy = cam.y + cam.h / 2;
    const night = FX.darkness() > 0.25;
    const list = this.visibleBuildings(cam, 300);
    const dist = (b) => Math.hypot(b.x * T + (b.w * T) / 2 - cx, b.y * T + (b.h * T) / 2 - cy);
    list.sort((a, b) => dist(b) - dist(a));
    for (const b of list) this.drawExtruded(ctx, b, cx, cy, time, night);
    // zone labels float above everything
    for (const z of this.zones) {
      const cx = z.x + z.w / 2;
      const cy = z.y - 10;
      label(ctx, z.name, cx, cy, z.color);
    }
  },

  drawTile(ctx, x, y, t, time) {
    const px = x * T, py = y * T;
    const h = hash(x, y);
    switch (t) {
      case TILE.GRASS:
      case TILE.TREE:
        ctx.fillStyle = this.pat.grass;
        ctx.fillRect(px, py, T, T);
        if (h > 0.85) { ctx.fillStyle = '#9bd88a'; ctx.fillRect(px + h * 30, py + 10, 4, 4); }
        break;
      case TILE.PARK:
        ctx.fillStyle = this.pat.park;
        ctx.fillRect(px, py, T, T);
        if (h > 0.7) {
          const fc = ['#ff80ab', '#ffd54f', '#fff', '#ce93d8'][Math.floor(h * 40) % 4];
          ctx.fillStyle = fc;
          for (let i = 0; i < 4; i++) ctx.fillRect(px + hash(x + i, y) * 40 + 2, py + hash(x, y + i) * 40 + 2, 4, 4);
        }
        break;
      case TILE.PATH:
        ctx.fillStyle = '#8fd27a';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#ead9ae';
        ctx.fillRect(px + 6, py + 6, T - 12, T - 12);
        if (this.get(x - 1, y) === TILE.PATH) ctx.fillRect(px, py + 6, 8, T - 12);
        if (this.get(x + 1, y) === TILE.PATH) ctx.fillRect(px + T - 8, py + 6, 8, T - 12);
        if (this.get(x, y - 1) === TILE.PATH) ctx.fillRect(px + 6, py, T - 12, 8);
        if (this.get(x, y + 1) === TILE.PATH) ctx.fillRect(px + 6, py + T - 8, T - 12, 8);
        break;
      case TILE.ROAD: {
        ctx.fillStyle = this.pat.road;
        ctx.fillRect(px, py, T, T);
        const hr = this.isHRoadRow(y), vr = this.isVRoadCol(x) && !(x >= 64 && x <= 66 && y >= 47 && y <= 63);
        ctx.fillStyle = '#f5f5f5';
        if (hr && !vr) {
          const row = ROAD_ROWS.find(([a, b]) => y >= a && y <= b);
          if (y === row[0] + 1) for (let i = 0; i < 2; i++) ctx.fillRect(px + i * 24 + 4, py + T / 2 - 2, 14, 4);
          // crosswalk next to a junction
          if (this.isVRoadCol(x - 1) || this.isVRoadCol(x + 1)) for (let i = 0; i < 5; i++) ctx.fillRect(px + 14, py + i * 10 + 2, 20, 6);
        } else if (vr && !hr) {
          const col = ROAD_COLS.find(([a, b]) => x >= a && x <= b);
          if (x === col[0] + 1) for (let i = 0; i < 2; i++) ctx.fillRect(px + T / 2 - 2, py + i * 24 + 4, 4, 14);
          if (this.isHRoadRow(y - 1) || this.isHRoadRow(y + 1)) for (let i = 0; i < 5; i++) ctx.fillRect(px + i * 10 + 2, py + 14, 6, 20);
        }
        break;
      }
      case TILE.WALK:
        ctx.fillStyle = this.pat.walk;
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = '#b3b8be';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T / 2, T / 2);
        ctx.strokeRect(px + T / 2 + 0.5, py + T / 2 + 0.5, T / 2, T / 2);
        if (h > 0.93) this.drawLamp(ctx, px + T / 2, py + T / 2, time);
        break;
      case TILE.BUILDING:
        ctx.fillStyle = '#9aa0a6';
        ctx.fillRect(px, py, T, T);
        break;
      case TILE.WATER: {
        const deep = x >= SEA_X ? Math.min(1, (x - SEA_X) / 10) : 0.2;
        ctx.fillStyle = `rgb(${Math.round(60 - deep * 40)},${Math.round(170 - deep * 50)},${Math.round(230 - deep * 20)})`;
        ctx.fillRect(px, py, T, T);
        break;
      }
      case TILE.SAND:
        ctx.fillStyle = this.pat.sand;
        ctx.fillRect(px, py, T, T);
        if (h > 0.9) { // beach umbrella
          ctx.fillStyle = ['#ef5350', '#42a5f5', '#ffee58'][Math.floor(h * 100) % 3];
          ctx.beginPath(); ctx.arc(px + 24, py + 24, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + 24, py + 24, 3, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case TILE.PLAZA:
        ctx.fillStyle = '#d4d7db';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#c4c8cd';
        ctx.fillRect(px, py, T, 2);
        ctx.fillRect(px, py, 2, T);
        break;
      case TILE.DOCK:
        ctx.fillStyle = '#2f9be0';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#a1774b';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#8a6440';
        for (let i = 0; i < 4; i++) ctx.fillRect(px + i * 12, py, 2, T);
        break;
    }
  },

  drawWaterFx(ctx, x, y, time) {
    const px = x * T, py = y * T;
    const h = hash(x, y);
    const tw = Math.sin(time * 2.3 + h * 40);
    if (tw > 0.85) { ctx.fillStyle = `rgba(255,255,255,${(tw - 0.85) * 4})`; ctx.fillRect(px + h * 36 + 4, py + hash(y, x) * 36 + 4, 6, 2); }
    // foam where water meets land
    if (this.get(x - 1, y) === TILE.SAND || this.get(x - 1, y) === TILE.DOCK) {
      ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.2 * Math.sin(time * 2 + y)})`;
      ctx.fillRect(px, py, 6 + 3 * Math.sin(time * 1.7 + y * 0.8), T);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const o = Math.sin(time * 1.5 + x * 0.7 + y * 0.4) * 6;
    ctx.beginPath();
    ctx.moveTo(px + 8 + o, py + 16 + h * 16);
    ctx.quadraticCurveTo(px + 16 + o, py + 10 + h * 16, px + 24 + o, py + 16 + h * 16);
    ctx.stroke();
  },

  drawTree(ctx, x, y, cam) {
    const h = hash(x, y);
    const bx = x * T + T / 2 + (h - 0.5) * 10;
    const by = y * T + T / 2 + (hash(y, x) - 0.5) * 10;
    const r = 18 + h * 8;
    const sun = this.sunNow || { x: 0.4, y: 0.3, alpha: 0.2 };
    ctx.fillStyle = `rgba(0,0,0,${sun.alpha * 0.8})`;
    ctx.beginPath(); ctx.arc(bx + sun.x * 40, by + sun.y * 40, r, 0, Math.PI * 2); ctx.fill();
    // a little 3D: the canopy leans away from the camera like a real tall tree
    const ccx = cam.x + cam.w / 2, ccy = cam.y + cam.h / 2;
    const k = 0.05 + h * 0.03;
    const cx = bx + (bx - ccx) * k, cy = by + (by - ccy) * k;
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.fillStyle = h < 0.5 ? '#2e7d32' : '#388e3c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = h < 0.5 ? '#43a047' : '#4caf50';
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.4, r * 0.28, 0, Math.PI * 2); ctx.fill();
    if (h > 0.8) { // fruit tree, like the cherries in the drawing!
      ctx.fillStyle = '#e53935';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i * 1.7) * r * 0.55, cy + Math.sin(i * 1.7) * r * 0.55, 3, 0, Math.PI * 2); ctx.fill(); }
    }
  },

  drawLamp(ctx, x, y, time) {
    ctx.fillStyle = 'rgba(255,240,180,0.25)';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#37474f';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  },

  drawDecor(ctx, d, time) {
    if (d.kind === 'fountain') {
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath(); ctx.arc(d.x, d.y, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath(); ctx.arc(d.x, d.y, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + time;
        const r = 12 + ((time * 20 + i * 5) % 22);
        ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'bench') {
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(d.x - 14, d.y - 5, 28, 10);
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(d.x - 14, d.y - 5, 28, 3);
    } else if (d.kind === 'playground') {
      ctx.fillStyle = '#f4d58d';
      roundRect(ctx, d.x - 70, d.y - 60, 140, 120, 16); ctx.fill();
      ctx.fillStyle = '#ef5350'; ctx.fillRect(d.x - 50, d.y - 40, 30, 70); // slide
      ctx.fillStyle = '#ffca28'; ctx.fillRect(d.x - 46, d.y - 36, 22, 10);
      ctx.strokeStyle = '#1e88e5'; ctx.lineWidth = 5; // swings
      ctx.strokeRect(d.x + 5, d.y - 35, 50, 30);
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath(); ctx.arc(d.x + 30, d.y + 30, 18, 0, Math.PI * 2); ctx.fill(); // roundabout
      ctx.fillStyle = '#fff';
      ctx.save(); ctx.translate(d.x + 30, d.y + 30); ctx.rotate(time);
      ctx.fillRect(-18, -2, 36, 4); ctx.fillRect(-2, -18, 4, 36); ctx.restore();
    } else if (d.kind === 'gazebo') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(d.x + 8, d.y + 8, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.lineTo(d.x + Math.cos(a) * 40, d.y + Math.sin(a) * 40); }
      ctx.fill();
      ctx.fillStyle = '#ef9a9a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.lineTo(d.x + Math.cos(a) * 32, d.y + Math.sin(a) * 32); }
      ctx.fill();
    }
  },

  drawExtruded(ctx, b, cx, cy, time, night) {
    const hp = this.heightOf(b);
    const k = hp / 1100;
    const x0 = b.x * T, y0 = b.y * T, x1 = x0 + b.w * T, y1 = y0 + b.h * T;
    const R = (x, y) => [x + (x - cx) * k, y + (y - cy) * k];
    const wallBase = b.kind === 'dealer' ? '#cfd8dc' : b.kind === 'upgrade' ? '#e64a19' : b.kind === 'stadium' ? '#78909c' : b.color;
    const walls = [];
    if (y0 > cy) walls.push([[x0, y0], [x1, y0], -0.42]); // north face
    if (y1 < cy) walls.push([[x1, y1], [x0, y1], -0.05]); // south face
    if (x0 > cx) walls.push([[x0, y1], [x0, y0], -0.25]); // west face
    if (x1 < cx) walls.push([[x1, y0], [x1, y1], -0.18]); // east face
    for (const [a, c, sh] of walls) {
      const ra = R(a[0], a[1]), rc = R(c[0], c[1]);
      ctx.fillStyle = shade(wallBase, sh);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(rc[0], rc[1]); ctx.lineTo(ra[0], ra[1]);
      ctx.closePath();
      ctx.fill();
      if (!FX.high) continue;
      // windows
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const cols = Math.max(1, Math.floor(len / 34));
      const rows = Math.max(1, Math.floor(hp / (b.kind === 'normal' ? 26 : 40)));
      const P = (u, v) => [a[0] + (c[0] - a[0]) * u + (ra[0] + (rc[0] - ra[0]) * u - (a[0] + (c[0] - a[0]) * u)) * v, a[1] + (c[1] - a[1]) * u + (ra[1] + (rc[1] - ra[1]) * u - (a[1] + (c[1] - a[1]) * u)) * v];
      const glass = b.kind === 'dealer' ? 'rgba(129,212,250,0.9)' : 'rgba(40,70,100,0.55)';
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const lit = night && hash(b.x * 31 + q, b.y * 17 + r + Math.floor(sh * 10)) > 0.45;
          ctx.fillStyle = lit ? '#ffe28a' : glass;
          const u0 = (q + 0.22) / cols, u1 = (q + 0.78) / cols, v0 = (r + 0.25) / rows, v1 = (r + 0.75) / rows;
          const p1 = P(u0, v0), p2 = P(u1, v0), p3 = P(u1, v1), p4 = P(u0, v1);
          ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.fill();
        }
      }
    }
    // roof, scaled up as if it is closer to the camera
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + k, 1 + k);
    ctx.translate(-cx, -cy);
    this.drawBuilding(ctx, b, time);
    if (night && b.kind === 'normal' && hash(b.x, b.y) > 0.6) {
      // red aircraft light on tall roofs
      ctx.fillStyle = Math.sin(time * 3 + b.x) > 0 ? '#ff1744' : '#5d0010';
      ctx.beginPath(); ctx.arc(x0 + 12, y0 + 12, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  drawBuilding(ctx, b, time) {
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;

    if (b.kind === 'dealer') {
      ctx.fillStyle = '#eceff1';
      ctx.fillRect(x, y, w, h);
      // glass showroom front
      ctx.fillStyle = '#81d4fa';
      ctx.fillRect(x + 8, y + h - 90, w - 16, 82);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 20 + i * 100, y + h - 86, 30, 74);
      // cars in the window: Lambo, BMW, Mercedes
      drawCarShape(ctx, x + 120, y + h - 48, 0, '#64dd17', 40, 20);
      drawCarShape(ctx, x + w / 2, y + h - 48, 0, '#0288d1', 40, 20);
      drawCarShape(ctx, x + w - 120, y + h - 48, 0, '#bdbdbd', 40, 20);
      ctx.fillStyle = '#263238';
      roundRect(ctx, x + w / 2 - 150, y + 30, 300, 70, 12); ctx.fill();
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MEHEK MOTORS', x + w / 2, y + 70);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('CARS • BIKES • BOATS', x + w / 2, y + 92);
      ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
      return;
    }
    if (b.kind === 'upgrade') {
      ctx.fillStyle = '#ff8a65';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5d4037';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 40 + i * 160, y + h - 70, 120, 66);
        ctx.fillStyle = '#795548';
        for (let s = 0; s < 6; s++) ctx.fillRect(x + 40 + i * 160, y + h - 68 + s * 11, 120, 3);
        ctx.fillStyle = '#5d4037';
      }
      ctx.fillStyle = '#263238';
      roundRect(ctx, x + w / 2 - 160, y + 40, 320, 70, 12); ctx.fill();
      ctx.fillStyle = '#ffab40';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔧 UPGRADE SHOP', x + w / 2, y + 87);
      return;
    }
    if (b.kind === 'stadium') {
      ctx.fillStyle = '#78909c';
      roundRect(ctx, x, y, w, h, 60); ctx.fill();
      ctx.fillStyle = '#b0bec5';
      for (let i = 0; i < 6; i++) { roundRect(ctx, x + 10 + i * 6, y + 10 + i * 6, w - 20 - i * 12, h - 20 - i * 12, 56); ctx.strokeStyle = i % 2 ? '#90a4ae' : '#cfd8dc'; ctx.lineWidth = 6; ctx.stroke(); }
      ctx.fillStyle = '#c62828';
      roundRect(ctx, x + 60, y + 60, w - 120, h - 120, 140); ctx.fill();
      ctx.fillStyle = '#66bb6a';
      roundRect(ctx, x + 130, y + 130, w - 260, h - 260, 80); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏁 RACING STADIUM', x + w / 2, y + h / 2 + 18);
      // little racers going round
      for (let i = 0; i < 4; i++) {
        const a = time * (0.5 + i * 0.07) + i * 1.5;
        const rx = (w - 180) / 2, ry = (h - 180) / 2;
        drawCarShape(ctx, x + w / 2 + Math.cos(a) * rx, y + h / 2 + Math.sin(a) * ry, a + Math.PI / 2, ['#ffeb3b', '#29b6f6', '#fff', '#76ff03'][i], 34, 16);
      }
      return;
    }
    // normal rooftop
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade(b.color, 0.12);
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    ctx.strokeStyle = shade(b.color, -0.15);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    // rooftop details
    const s = b.seed || 0.5;
    ctx.fillStyle = shade(b.color, -0.2);
    ctx.fillRect(x + 16, y + 16, 22, 16);
    ctx.fillRect(x + w - 40, y + h - 34, 24, 18);
    if (s > 0.7 && w > 140 && h > 140) {
      ctx.fillStyle = '#546e7a';
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText('H', x + w / 2, y + h / 2 + 11);
    } else if (s < 0.3 && w > 100) {
      // rooftop garden
      ctx.fillStyle = '#9ccc65';
      ctx.fillRect(x + w / 2 - 30, y + h / 2 - 20, 60, 40);
      ctx.fillStyle = '#558b2f';
      ctx.beginPath(); ctx.arc(x + w / 2 - 12, y + h / 2, 9, 0, Math.PI * 2); ctx.arc(x + w / 2 + 12, y + h / 2 - 4, 8, 0, Math.PI * 2); ctx.fill();
    } else if (s < 0.5) {
      ctx.fillStyle = '#4fc3f7'; // solar panels / pool
      ctx.fillRect(x + w / 2 - 24, y + h / 2 - 14, 48, 28);
    }
  },
};

// ------------------------------------------------------------- helpers
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

function label(ctx, text, x, y, color) {
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = 'rgba(20,24,30,0.85)';
  roundRect(ctx, x - w / 2, y - 26, w, 30, 8);
  ctx.fill();
  ctx.fillStyle = color || '#fff';
  ctx.fillText(text, x, y - 5);
}

// Draw any vehicle seen from above. (x,y) is the centre, a is the heading.
function drawVehicle(ctx, v, x, y, a, color, extra) {
  if (v.type === 'bike') return drawBikeShape(ctx, x, y, a, color);
  if (v.type === 'boat') return drawBoatShape(ctx, x, y, a, color, extra && extra.speed);
  return drawCarShape(ctx, x, y, a, color, v.size[0], v.size[1], v.price > 200000, extra && extra.brake);
}

function drawCarShape(ctx, x, y, a, color, L = 40, W = 20, sporty = false, brake = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  roundRect(ctx, -L / 2 + 1, -W / 2 + 2, L + 6, W + 6, 8); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 6); ctx.fill();
  // wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-L / 2 + 5, -W / 2 - 2, 9, 4);
  ctx.fillRect(L / 2 - 14, -W / 2 - 2, 9, 4);
  ctx.fillRect(-L / 2 + 5, W / 2 - 2, 9, 4);
  ctx.fillRect(L / 2 - 14, W / 2 - 2, 9, 4);
  // body with shiny paint
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  g.addColorStop(0, shade(color, -0.35));
  g.addColorStop(0.22, shade(color, 0.1));
  g.addColorStop(0.5, shade(color, 0.32));
  g.addColorStop(0.78, color);
  g.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = g;
  roundRect(ctx, -L / 2, -W / 2, L, W, sporty ? 9 : 5); ctx.fill();
  // bonnet line + bumper
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(L / 2 - 10, -W / 2 + 3); ctx.quadraticCurveTo(L / 2 - 6, 0, L / 2 - 10, W / 2 - 3); ctx.stroke();
  // glass cabin
  const gx = sporty ? -6 : -10, gw = sporty ? 16 : 22;
  const gl = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  gl.addColorStop(0, '#0f1a26');
  gl.addColorStop(0.7, '#2c4a66');
  gl.addColorStop(1, '#6f9ac0');
  ctx.fillStyle = gl;
  roundRect(ctx, gx, -W / 2 + 3, gw, W - 6, 3); ctx.fill();
  // roof
  ctx.fillStyle = shade(color, 0.05);
  roundRect(ctx, gx + 4, -W / 2 + 5, gw - 9, W - 10, 2); ctx.fill();
  // sun glint
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(gx + gw - 4, -W / 2 + 4, 2, W - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 10, 2);
  // mirrors
  ctx.fillStyle = shade(color, -0.2);
  ctx.fillRect(gx + gw - 2, -W / 2 - 2, 3, 2);
  ctx.fillRect(gx + gw - 2, W / 2, 3, 2);
  // lights
  ctx.fillStyle = '#fffde7';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4);
  ctx.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
  ctx.fillStyle = brake ? '#ff1744' : '#b71c1c';
  ctx.fillRect(-L / 2, -W / 2 + 2, 2, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 2, 5);
  if (brake) {
    ctx.fillStyle = 'rgba(255,23,68,0.35)';
    ctx.beginPath(); ctx.arc(-L / 2, -W / 2 + 4, 6, 0, Math.PI * 2); ctx.arc(-L / 2, W / 2 - 4, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBikeShape(ctx, x, y, a, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -12, -3, 28, 10, 4); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-15, -2, 8, 4);
  ctx.fillRect(9, -2, 8, 4);
  ctx.fillStyle = color;
  roundRect(ctx, -10, -5, 22, 10, 4); ctx.fill();
  ctx.fillStyle = '#ffcc80'; // rider arms
  ctx.fillRect(2, -7, 5, 3); ctx.fillRect(2, 4, 5, 3);
  ctx.fillStyle = '#263238'; // helmet
  ctx.beginPath(); ctx.arc(-1, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-1, -2, 5, 4);
  ctx.restore();
}

function drawBoatShape(ctx, x, y, a, color, speed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  // wake
  if (speed > 30) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(-20, -8); ctx.lineTo(-20 - speed * 0.25, -8 - speed * 0.06);
    ctx.lineTo(-20 - speed * 0.25, 8 + speed * 0.06); ctx.lineTo(-20, 8); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(3, 4, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.quadraticCurveTo(10, -11, -20, -9);
  ctx.lineTo(-20, 9);
  ctx.quadraticCurveTo(10, 11, 26, 0);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.quadraticCurveTo(6, -7, -14, -6);
  ctx.lineTo(-14, 6);
  ctx.quadraticCurveTo(6, 7, 18, 0);
  ctx.fill();
  ctx.fillStyle = '#1c2a38';
  roundRect(ctx, -4, -5, 10, 10, 3); ctx.fill();
  ctx.fillStyle = shade(color, -0.3);
  ctx.fillRect(-12, -4, 6, 8);
  ctx.restore();
}
