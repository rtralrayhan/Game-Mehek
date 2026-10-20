// Main game: driving, racing, shops, saving, sound and the HUD.

const SAVE_KEY = 'mehek-city-racer-v1';
const UPGRADES = [
  { key: 'engine', name: 'Engine', icon: '⚙️', desc: '+8% top speed' },
  { key: 'turbo', name: 'Turbo', icon: '🌀', desc: '+12% acceleration' },
  { key: 'tires', name: 'Tires', icon: '🛞', desc: 'Better grip & steering' },
  { key: 'nitro', name: 'Nitro', icon: '🔥', desc: 'Bigger, stronger nitro' },
];
const MAX_LEVEL = 5;
const PAINTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#fafafa', '#212121', '#00bcd4', '#ff4081', '#64dd17', '#bdbdbd'];

const Game = {
  canvas: null,
  ctx: null,
  mode: 'city', // city | dealer | race
  menuOpen: false,
  time: 0,
  save: null,
  car: null, // the vehicle you are driving
  race: null,
  zoom: 1,
  dpr: 1,
  cam: { x: 0, y: 0, w: 0, h: 0 },
  currentZone: null,
  muted: false,

  // ------------------------------------------------------------ setup
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
    City.build();
    TRACKS.forEach(buildTrack);
    Input.init();
    this.load();
    this.placeAtSpawn();
    this.bindButtons();
    Sound.init();
    this.updateHud();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if (!this.save.seenHelp) this.showHelp();
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.baseZoom = Math.max(0.45, Math.min(1.1, Math.min(window.innerWidth, window.innerHeight) / 760));
  },

  bindButtons() {
    document.getElementById('btn-garage').onclick = () => this.openGarage();
    document.getElementById('btn-help').onclick = () => this.showHelp();
    document.getElementById('btn-sound').onclick = () => this.toggleSound();
    document.getElementById('btn-pad').onclick = () => document.body.classList.toggle('show-touch');
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('show-touch');
  },

  // ------------------------------------------------------------ saving
  newSave() {
    const fiat = vehicleByName('Fiat 500');
    return {
      money: 15000,
      owned: [this.newOwned(fiat)],
      current: 0,
      best: {},
      races: 0,
      seenHelp: false,
    };
  },
  newOwned(v) {
    return { id: v.id, color: v.color, engine: 0, turbo: 0, tires: 0, nitro: 0, spent: 0 };
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      this.save = raw ? JSON.parse(raw) : this.newSave();
    } catch (e) {
      this.save = this.newSave();
    }
    if (!this.save.owned || !this.save.owned.length) this.save = this.newSave();
    if (this.save.current >= this.save.owned.length) this.save.current = 0;
  },
  store() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* private mode: no saving */ }
  },
  resetSave() {
    this.ask('Start a brand new game? You will lose your money and vehicles.', 'Start over', () => this.doReset(), () => this.showPause());
  },
  doReset() {
    this.save = this.newSave();
    this.save.seenHelp = true;
    this.store();
    this.mode = 'city';
    this.placeAtSpawn();
    this.closeMenu();
    this.updateHud();
  },

  owned() { return this.save.owned[this.save.current]; },
  ownedVehicle(o) { return VEHICLES[(o || this.owned()).id]; },

  // Final driving numbers for an owned vehicle, including upgrades
  statsFor(o) {
    const v = VEHICLES[o.id];
    return {
      top: v.top * (1 + 0.08 * o.engine),
      accel: v.accel * (1 + 0.12 * o.turbo),
      grip: Math.min(0.99, v.grip + 0.035 * o.tires),
      steer: v.steer * (1 + 0.05 * o.tires),
      nitroPower: 1.35 + 0.08 * o.nitro,
      nitroTank: 2.5 + 0.6 * o.nitro,
    };
  },

  makeCar(x, y, a) {
    const o = this.owned();
    const v = VEHICLES[o.id];
    const st = this.statsFor(o);
    this.car = { x, y, a, vx: 0, vy: 0, v, o, st, nitro: st.nitroTank, speed: 0, color: o.color, skid: [] };
  },

  placeAtSpawn() {
    const v = this.ownedVehicle();
    const s = v.type === 'boat' ? City.boatSpawn : City.spawn;
    this.makeCar(s.x, s.y, s.a);
    this.snapCamera();
  },

  // ------------------------------------------------------------ main loop
  frame(dt) {
    this.time += dt;
    Input.update();
    if (Input.take('mute')) this.toggleSound();

    if (this.menuOpen) {
      if (Input.take('back')) this.closeMenu();
      Input.take('action');
      Input.take('garage');
      if (this.car) { this.car.vx *= 0.9; this.car.vy *= 0.9; }
    } else if (this.mode === 'city') this.updateCity(dt);
    else if (this.mode === 'dealer') this.updateDealer(dt);
    else if (this.mode === 'race') this.updateRace(dt);

    Sound.engine(this.mode === 'dealer' || !this.car ? 0 : Math.abs(this.car.speed) / (this.car.st.top || 1), this.mode !== 'dealer' && !this.menuOpen);
    this.draw();
  },

  // ------------------------------------------------------------ driving physics
  drive(dt, car, surfaceAt, solidAt) {
    const s = Input.state;
    const st = car.st;
    const fx = Math.cos(car.a), fy = Math.sin(car.a);
    const sx = -fy, sy = fx;
    let fwd = car.vx * fx + car.vy * fy;
    let side = car.vx * sx + car.vy * sy;

    const surface = surfaceAt(car.x, car.y); // 1 = road, less = grass / sand
    let top = st.top * surface;
    let accel = st.accel;
    const usingNitro = s.nitro && car.nitro > 0 && s.gas > 0;
    if (usingNitro) {
      top *= st.nitroPower;
      accel *= 1.8;
      car.nitro = Math.max(0, car.nitro - dt);
    } else if (!s.nitro) {
      car.nitro = Math.min(st.nitroTank, car.nitro + dt * 0.12);
    }
    car.usingNitro = usingNitro;

    if (s.gas > 0 && fwd < top) fwd += accel * s.gas * dt;
    if (s.brake > 0) {
      if (fwd > 5) fwd -= accel * 2.2 * s.brake * dt;
      else if (fwd > -top * 0.35) fwd -= accel * 0.6 * s.brake * dt;
    }
    if (fwd > top) fwd -= (fwd - top) * 3 * dt; // too fast for this surface: slow down
    if (!s.gas && !s.brake) fwd *= 1 - 0.9 * dt;
    if (s.handbrake) fwd *= 1 - 1.5 * dt;

    // steering works better when moving
    const steerAmount = Math.max(-1, Math.min(1, fwd / 140));
    const steerSpeed = st.steer * (1 - Math.min(0.4, Math.abs(fwd) / (st.top * 2.5)));
    car.a += s.steer * steerSpeed * steerAmount * dt * (s.handbrake ? 1.35 : 1);

    // tyres stop the car sliding sideways (less grip = more drifting)
    const grip = s.handbrake ? 2.2 : (car.v.type === 'boat' ? 4 : 9) * st.grip;
    side *= Math.max(0, 1 - grip * dt);
    car.drifting = Math.abs(side) > 60;

    const nfx = Math.cos(car.a), nfy = Math.sin(car.a);
    car.vx = nfx * fwd + -nfy * side;
    car.vy = nfy * fwd + nfx * side;

    // move with simple collision
    const r = car.v.size[1] / 2 + 4;
    const blocked = (x, y) => {
      for (let i = 0; i < 8; i++) {
        const ang = car.a + (i * Math.PI) / 4;
        const ex = Math.cos(ang) * (i % 4 === 0 ? car.v.size[0] / 2 : r), ey = Math.sin(ang) * (i % 4 === 0 ? car.v.size[0] / 2 : r);
        if (solidAt(x + ex, y + ey)) return true;
      }
      return false;
    };
    const nx = car.x + car.vx * dt;
    if (!blocked(nx, car.y)) car.x = nx;
    else { car.vx *= -0.3; this.bump(car); }
    const ny = car.y + car.vy * dt;
    if (!blocked(car.x, ny)) car.y = ny;
    else { car.vy *= -0.3; this.bump(car); }
    if (blocked(car.x, car.y)) { car.x -= Math.cos(car.a) * 2; car.y -= Math.sin(car.a) * 2; }

    car.speed = car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a);

    // skid marks
    if ((car.drifting || (s.brake && fwd > 120)) && car.v.type !== 'boat') {
      car.skid.push({ x: car.x - Math.cos(car.a) * 14, y: car.y - Math.sin(car.a) * 14, a: car.a, t: this.time });
      if (car.skid.length > 160) car.skid.shift();
    }
  },

  bump(car) {
    if (Math.hypot(car.vx, car.vy) > 120 && this.time - (car.lastBump || 0) > 0.3) {
      car.lastBump = this.time;
      this.shake = 8;
      Sound.thud();
    }
  },

  citySurface(x, y) {
    const t = City.tileAt(x, y);
    if (this.car.v.type === 'boat') return 1;
    if (t === TILE.ROAD || t === TILE.PLAZA || t === TILE.DOCK) return 1;
    if (t === TILE.WALK || t === TILE.PATH) return 0.8;
    if (t === TILE.SAND) return 0.5;
    return 0.6;
  },

  // ------------------------------------------------------------ city
  updateCity(dt) {
    const car = this.car;
    this.drive(dt, car, (x, y) => this.citySurface(x, y), (x, y) => City.solidFor(x, y, car.v.type));
    City.updateTraffic(dt, car);
    // bump into traffic
    for (const t of City.traffic) {
      const dx = car.x - t.x, dy = car.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < 30 && d > 0.01) {
        car.x += (dx / d) * (30 - d);
        car.y += (dy / d) * (30 - d);
        car.vx *= 0.6; car.vy *= 0.6;
        this.bump(car);
      }
    }

    // which zone are we in?
    this.currentZone = null;
    for (const z of City.zones) {
      if (car.x > z.x && car.x < z.x + z.w && car.y > z.y && car.y < z.y + z.h) this.currentZone = z;
    }
    if (this.currentZone) {
      const z = this.currentZone;
      let hint = z.hint;
      if (z.id === 'dealer' && car.v.type === 'boat') hint = 'Park your boat at the Marina first';
      this.prompt(`${z.name}: ${hint}`);
      if (Input.take('action')) this.useZone(z);
    } else {
      this.prompt(null);
      Input.take('action');
    }
    if (Input.take('garage')) this.openGarage();
    if (Input.take('back')) this.showPause();
    this.followCamera(dt);
  },

  useZone(z) {
    Sound.click();
    if (z.id === 'dealer') {
      if (this.car.v.type === 'boat') return this.toast('Boats can\'t go in the shop!');
      this.mode = 'dealer';
      Dealer.enter();
      this.prompt(null);
    } else if (z.id === 'upgrade') this.openUpgrades();
    else if (z.id === 'race') this.openRaceMenu();
    else if (z.id === 'marina') this.openGarage(true);
  },

  // ------------------------------------------------------------ inside the car shop
  updateDealer(dt) {
    const res = Dealer.update(dt);
    if (res === 'exit' || Input.take('back')) {
      this.mode = 'city';
      this.placeAtSpawn();
      this.prompt(null);
      return;
    }
    const s = Dealer.nearSpot();
    if (s) {
      this.prompt(`${s.name}: ${s.hint}`);
      if (Input.take('action')) {
        Sound.click();
        if (s.id === 'buy') this.openShop('all');
        if (s.id === 'sell') this.openSell();
        if (s.id === 'trade') this.openTrade();
        if (s.id === 'show') this.openShowcase(vehicleByName(s.model));
        if (s.id === 'exit') { this.mode = 'city'; this.placeAtSpawn(); this.prompt(null); }
      }
    } else {
      this.prompt(null);
      Input.take('action');
    }
    Input.take('garage');
  },

  // ------------------------------------------------------------ racing
  startRace(track) {
    const v = this.ownedVehicle();
    if (track.vehicle === 'boat' && v.type !== 'boat') return this.toast('You need a boat for this race! Buy one in the Car Shop.');
    if (track.vehicle === 'land' && v.type === 'boat') return this.toast('Boats can\'t drive on roads! Pick a car or bike.');
    this.closeMenu();
    const start = track.path[0];
    const a = trackDir(track, 0);
    // put everyone on the grid behind the start line
    const grid = (k) => {
      const back = 70 + Math.floor(k / 2) * 70;
      const sideOff = (k % 2 ? 1 : -1) * track.width * 0.22;
      return { x: start[0] - Math.cos(a) * back - Math.sin(a) * sideOff, y: start[1] - Math.sin(a) * back + Math.cos(a) * sideOff };
    };
    // rivals drive vehicles that suit the track's speed (mostly cars, one biker)
    const near = (type) => VEHICLES.filter((x) => x.type === type).sort((p, q) => Math.abs(p.top - track.aiTop) - Math.abs(q.top - track.aiTop));
    const sorted = track.vehicle === 'boat' ? near('boat') : near('car');
    if (track.vehicle !== 'boat') sorted.splice(2, 0, near('bike')[0]);
    const ais = [];
    const names = ['Rayhan', 'Mehek', 'Zara', 'Leo', 'Aria', 'Max', 'Sam', 'Nova'];
    for (let k = 0; k < track.aiCount; k++) {
      const p = grid(k + 1);
      const v = sorted[k % sorted.length];
      const near = nearestOnPath(track, p.x, p.y);
      ais.push({
        name: names[k], v, color: v.color, x: p.x, y: p.y, a,
        s: near.i - (track.N), // distance along the path (in path points)
        offset: ((k % 2 ? 1 : -1) * track.width * 0.22),
        skill: 0.9 + Math.random() * 0.14 - k * 0.012,
        speed: 0, lap: 0, done: false, finishTime: 0,
      });
    }
    const p0 = grid(0);
    this.makeCar(p0.x, p0.y, a);
    this.race = { track, ais, count: 3.5, t: 0, lap: 0, idx: track.N - 3, maxIdx: 0, progress: -3, done: false, finishOrder: [] };
    this.race.idx = nearestOnPath(track, p0.x, p0.y).i;
    this.race.progress = this.race.idx - track.N;
    this.mode = 'race';
    this.prompt(null);
    this.snapCamera();
    this.updateHud();
  },

  updateRace(dt) {
    const r = this.race;
    const tr = r.track;
    const car = this.car;
    if (Input.take('back')) return this.showPause();
    Input.take('garage');

    if (r.count > 0) {
      const before = Math.ceil(r.count);
      r.count -= dt;
      if (Math.ceil(r.count) !== before && r.count > 0) Sound.beep(440);
      if (r.count <= 0) Sound.beep(880);
      car.vx = car.vy = 0;
      this.followCamera(dt);
      return;
    }
    if (!r.done) r.t += dt;

    const surface = (x, y) => {
      const n = nearestOnPath(tr, x, y, r.idx);
      if (n.dist < tr.width / 2) return 1;
      if (n.dist < tr.width / 2 + 14) return 0.85;
      return tr.theme === 'water' ? 0.7 : 0.45;
    };
    this.drive(dt, car, surface, () => false);

    // where is the player on the track?
    const n = nearestOnPath(tr, car.x, car.y, r.idx);
    let delta = n.i - r.idx;
    if (delta < -tr.N / 2) delta += tr.N;
    if (delta > tr.N / 2) delta -= tr.N;
    r.idx = n.i;
    r.progress += delta;
    if (n.dist > tr.width * 2.5) {
      // way off the track: put them back on
      const p = tr.path[r.idx];
      car.x = p[0]; car.y = p[1]; car.a = trackDir(tr, r.idx); car.vx = car.vy = 0;
      this.toast('Back on track!');
    }
    const lap = Math.floor(r.progress / tr.N);
    if (!r.done && lap > r.lap) {
      r.lap = lap;
      if (r.lap >= tr.laps) this.finishRacer('you');
      else { Sound.beep(660); this.toast(`Lap ${r.lap + 1} of ${tr.laps}`); }
    }

    // computer racers
    for (const ai of r.ais) {
      const i = ((Math.floor(ai.s) % tr.N) + tr.N) % tr.N;
      const corner = tr.ahead[i];
      let target = tr.aiTop * ai.skill * (1 - corner * 0.5);
      // a little rubber band so races stay exciting
      const gap = ai.s - r.progress;
      if (!r.done) target *= gap > 40 ? 0.92 : gap < -60 ? 1.08 : 1;
      if (ai.done) target *= 0.5;
      ai.speed += Math.max(-600, Math.min(tr.aiTop * 0.9, (target - ai.speed) * 2)) * dt;
      ai.s += (ai.speed * dt) / 20;
      const si = ((Math.floor(ai.s) % tr.N) + tr.N) % tr.N;
      const frac = ai.s - Math.floor(ai.s);
      const p = tr.path[si], q = tr.path[(si + 1) % tr.N];
      const dir = trackDir(tr, si);
      ai.offset += Math.sin(this.time * 0.7 + ai.skill * 20) * 8 * dt;
      ai.offset = Math.max(-tr.width * 0.35, Math.min(tr.width * 0.35, ai.offset));
      const tx = p[0] + (q[0] - p[0]) * frac - Math.sin(dir) * ai.offset;
      const ty = p[1] + (q[1] - p[1]) * frac + Math.cos(dir) * ai.offset;
      ai.a = Math.atan2(ty - ai.y, tx - ai.x) || dir;
      ai.x = tx; ai.y = ty;
      if (!ai.done && ai.s >= tr.laps * tr.N) { ai.done = true; this.finishRacer(ai); }
      // bumping
      const dx = car.x - ai.x, dy = car.y - ai.y, d = Math.hypot(dx, dy);
      if (d < 32 && d > 0.01) {
        car.x += (dx / d) * (32 - d); car.y += (dy / d) * (32 - d);
        car.vx *= 0.85; car.vy *= 0.85;
        ai.speed *= 0.95;
        this.bump(car);
      }
    }
    this.followCamera(dt);
  },

  racePosition() {
    const r = this.race;
    if (r.done) return r.finishOrder.indexOf('you') + 1;
    let pos = 1 + r.finishOrder.length;
    for (const ai of r.ais) if (!ai.done && ai.s > r.progress) pos++;
    return pos;
  },

  finishRacer(who) {
    const r = this.race;
    r.finishOrder.push(who);
    if (who !== 'you') return;
    r.done = true;
    const place = r.finishOrder.length;
    const prize = r.track.rewards[place - 1] || 0;
    this.save.money += prize;
    this.save.races = (this.save.races || 0) + 1;
    const prev = this.save.best[r.track.id];
    if (!prev || place < prev) this.save.best[r.track.id] = place;
    this.store();
    this.updateHud();
    if (place === 1) Sound.win(); else Sound.coin();
    setTimeout(() => this.showResults(place, prize), 900);
  },

  leaveRace() {
    this.race = null;
    this.mode = 'city';
    const z = City.zones.find((q) => q.id === 'race');
    const v = this.ownedVehicle();
    if (v.type === 'boat') this.placeAtSpawn();
    else { this.makeCar(z.x + z.w / 2, z.y + z.h / 2 - 60, -Math.PI / 2); this.snapCamera(); }
    this.closeMenu();
    this.updateHud();
  },

  // ------------------------------------------------------------ camera
  snapCamera() {
    this.camX = this.car.x;
    this.camY = this.car.y;
  },
  followCamera(dt) {
    const car = this.car;
    const lead = 0.35;
    const tx = car.x + car.vx * lead, ty = car.y + car.vy * lead;
    const k = Math.min(1, dt * 5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    const speedFrac = Math.min(1, Math.abs(car.speed) / 600);
    const targetZoom = this.baseZoom * (1 - speedFrac * 0.22);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2);
  },

  // ------------------------------------------------------------ drawing
  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, W, H);

    if (this.mode === 'dealer') {
      const top = 64 * this.dpr;
      const sc = Math.min(W / (ROOM.w + 20), (H - top) / (ROOM.h + 20));
      ctx.setTransform(sc, 0, 0, sc, (W - ROOM.w * sc) / 2, top + (H - top - ROOM.h * sc) / 2);
      Dealer.draw(ctx, this.time);
      return;
    }

    const z = this.zoom * this.dpr;
    let shx = 0, shy = 0;
    if (this.shake > 0) { shx = (Math.random() - 0.5) * this.shake; shy = (Math.random() - 0.5) * this.shake; this.shake *= 0.85; if (this.shake < 0.5) this.shake = 0; }
    this.cam.w = W / z;
    this.cam.h = H / z;
    this.cam.x = this.camX - this.cam.w / 2 + shx;
    this.cam.y = this.camY - this.cam.h / 2 + shy;
    ctx.setTransform(z, 0, 0, z, -this.cam.x * z, -this.cam.y * z);

    if (this.mode === 'city') {
      City.draw(ctx, this.cam, this.time);
      this.drawSkids(ctx);
      for (const t of City.traffic) {
        if (t.x < this.cam.x - 60 || t.x > this.cam.x + this.cam.w + 60 || t.y < this.cam.y - 60 || t.y > this.cam.y + this.cam.h + 60) continue;
        if (t.type === 'bus') drawCarShape(ctx, t.x, t.y, t.a, '#ffb300', 70, 24);
        else drawCarShape(ctx, t.x, t.y, t.a, t.color, 38, 19);
      }
      this.drawPlayer(ctx);
      City.drawTop(ctx, this.cam, this.time);
    } else if (this.mode === 'race') {
      drawTrack(ctx, this.race.track, this.cam, this.time);
      this.drawSkids(ctx);
      for (const ai of this.race.ais) {
        drawVehicle(ctx, ai.v, ai.x, ai.y, ai.a, ai.color, { speed: ai.speed });
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(ai.name, ai.x, ai.y - 24);
        ctx.fillText(ai.name, ai.x, ai.y - 24);
      }
      this.drawPlayer(ctx);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawOverlay(ctx, W, H);
  },

  drawSkids(ctx) {
    const car = this.car;
    for (const s of car.skid) {
      const age = this.time - s.t;
      if (age > 6) continue;
      ctx.fillStyle = `rgba(20,20,20,${0.35 * (1 - age / 6)})`;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.fillRect(-3, -9, 6, 3); ctx.fillRect(-3, 6, 6, 3);
      ctx.restore();
    }
  },

  drawPlayer(ctx) {
    const c = this.car;
    if (c.usingNitro) {
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.a);
      const L = c.v.size[0] / 2;
      ctx.fillStyle = Math.random() < 0.5 ? '#ffeb3b' : '#ff6d00';
      ctx.beginPath(); ctx.moveTo(-L, -5); ctx.lineTo(-L - 18 - Math.random() * 14, 0); ctx.lineTo(-L, 5); ctx.fill();
      ctx.fillStyle = '#29b6f6';
      ctx.beginPath(); ctx.moveTo(-L, -3); ctx.lineTo(-L - 10, 0); ctx.lineTo(-L, 3); ctx.fill();
      ctx.restore();
    }
    // a soft glow ring so you can always find yourself
    ctx.strokeStyle = 'rgba(255,235,59,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.v.size[0] * 0.75, 0, Math.PI * 2); ctx.stroke();
    drawVehicle(ctx, c.v, c.x, c.y, c.a, c.color, { speed: Math.abs(c.speed) });
  },

  drawOverlay(ctx, W, H) {
    const d = this.dpr;
    const car = this.car;
    // speedometer
    const touch = document.body.classList.contains('show-touch');
    const r = (touch ? 46 : 62) * d;
    // with the touch controller showing, the speedometer moves to the top left
    const cx = touch ? r + 12 * d : W / 2, cy = touch ? 64 * d + r + 8 * d : H - r - 18 * d;
    ctx.fillStyle = 'rgba(20,24,30,0.75)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    const frac = Math.min(1, Math.abs(car.speed) / (car.st.top * 1.4));
    ctx.strokeStyle = car.usingNitro ? '#29b6f6' : '#ffca28';
    ctx.lineWidth = 8 * d;
    ctx.beginPath(); ctx.arc(cx, cy, r - 10 * d, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * frac); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `bold ${26 * d}px system-ui`;
    ctx.fillText(kmh(Math.abs(car.speed)), cx, cy + 6 * d);
    ctx.font = `${11 * d}px system-ui`;
    ctx.fillText('km/h', cx, cy + 22 * d);
    // nitro bar
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(cx - 40 * d, cy + r - 16 * d, 80 * d, 6 * d);
    ctx.fillStyle = '#29b6f6';
    ctx.fillRect(cx - 40 * d, cy + r - 16 * d, 80 * d * (car.nitro / car.st.nitroTank), 6 * d);

    if (this.mode === 'city' && City.minimap) {
      const mw = Math.min(200, window.innerWidth * 0.3) * d, mh = mw * (MAP_H / MAP_W);
      const mx = W - mw - 12 * d, my = 64 * d;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(City.minimap, mx, my, mw, mh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * d;
      ctx.strokeRect(mx, my, mw, mh);
      const px = mx + (car.x / (MAP_W * T)) * mw, py = my + (car.y / (MAP_H * T)) * mh;
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(px, py, 4 * d, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * d; ctx.stroke();
      ctx.font = `bold ${9 * d}px system-ui`;
      if (mw > 150 * d) for (const z of City.zones) {
        ctx.fillStyle = '#fff';
        ctx.fillText(z.name, mx + ((z.x + z.w / 2) / (MAP_W * T)) * mw, my + (z.y / (MAP_H * T)) * mh - 2 * d);
      }
    }

    if (this.mode === 'race') {
      const r2 = this.race;
      const tr = r2.track;
      ctx.fillStyle = 'rgba(20,24,30,0.8)';
      roundRect(ctx, W - 210 * d, 64 * d, 198 * d, 104 * d, 12 * d); ctx.fill();
      ctx.fillStyle = tr.color;
      ctx.textAlign = 'left';
      ctx.font = `bold ${14 * d}px system-ui`;
      ctx.fillText(`${tr.name} (${tr.level})`, W - 198 * d, 86 * d);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${30 * d}px system-ui`;
      ctx.fillText(`${this.racePosition()}/${tr.aiCount + 1}`, W - 198 * d, 124 * d);
      ctx.font = `${15 * d}px system-ui`;
      ctx.fillText(`Lap ${Math.min(tr.laps, Math.max(1, r2.lap + 1))}/${tr.laps}`, W - 100 * d, 112 * d);
      ctx.fillText(formatTime(r2.t), W - 100 * d, 132 * d);
      ctx.fillText(`1st prize ${money(tr.rewards[0])}`, W - 198 * d, 156 * d);
      if (r2.count > 0) {
        const n = Math.ceil(r2.count);
        ctx.textAlign = 'center';
        ctx.font = `bold ${140 * d}px system-ui`;
        ctx.fillStyle = n > 1 ? '#ffca28' : '#ff7043';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 6 * d;
        const txt = n > 3 ? 'Ready' : String(n);
        ctx.strokeText(txt, W / 2, H / 2);
        ctx.fillText(txt, W / 2, H / 2);
      } else if (r2.t < 1) {
        ctx.textAlign = 'center';
        ctx.font = `bold ${120 * d}px system-ui`;
        ctx.fillStyle = '#76ff03';
        ctx.fillText('GO!', W / 2, H / 2);
      }
    }
  },

  // ------------------------------------------------------------ HUD + messages
  updateHud() {
    document.getElementById('money').textContent = money(this.save.money);
    const v = this.ownedVehicle();
    const icon = v.type === 'bike' ? '🏍️' : v.type === 'boat' ? '🚤' : '🚗';
    document.getElementById('vehicle').textContent = `${icon} ${v.name}`;
  },
  prompt(text) {
    const el = document.getElementById('prompt');
    if (!text) { el.classList.remove('show'); this.lastPrompt = null; return; }
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    el.innerHTML = `${text} <span class="key">E</span> <span class="key pad">Ⓐ</span> <span class="key tap">tap ACTION</span>`;
    el.classList.add('show');
  },
  toast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  },
  toggleSound() {
    this.muted = !this.muted;
    Sound.setMuted(this.muted);
    document.getElementById('btn-sound').textContent = this.muted ? '🔇' : '🔊';
  },

  // ------------------------------------------------------------ menus
  openMenu(html, wide) {
    const m = document.getElementById('menu');
    m.innerHTML = `<div class="panel ${wide ? 'wide' : ''}"><button class="close" data-close>✕</button>${html}</div>`;
    m.classList.add('show');
    this.menuOpen = true;
    m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => this.closeMenu()));
    return m;
  },
  closeMenu() {
    document.getElementById('menu').classList.remove('show');
    this.menuOpen = false;
    Input.clear();
  },

  // Yes / No question shown inside the game (pop-up dialogs don't work everywhere)
  ask(question, yesLabel, onYes, onNo) {
    const m = this.openMenu(`<h2>${question}</h2>
      <button class="big danger" id="ask-yes">${yesLabel}</button>
      <button class="big alt" id="ask-no">Cancel</button>`);
    m.querySelector('#ask-yes').onclick = onYes;
    m.querySelector('#ask-no').onclick = onNo;
  },

  showHelp() {
    const m = this.openMenu(`
      <h2>🏙️ Mehek City Racer</h2>
      <p>Drive around the city, race to earn money, and collect the <b>Top 100</b> cars, bikes and boats!</p>
      <div class="help-grid">
        <div><h3>⌨️ Keyboard</h3>
          <p><span class="key">W A S D</span> or <span class="key">Arrows</span> drive<br>
          <span class="key">Shift</span> nitro · <span class="key">Space</span> handbrake / drift<br>
          <span class="key">E</span> use / enter · <span class="key">G</span> garage<br>
          <span class="key">Esc</span> pause / close · <span class="key">M</span> sound</p></div>
        <div><h3>🎮 Controller</h3>
          <p>Left stick steer · <b>RT</b> gas · <b>LT</b> brake<br>
          <b>B</b>/<b>RB</b> nitro · <b>X</b> handbrake<br>
          <b>A</b> use / enter · <b>Y</b> garage · <b>Start</b> pause</p></div>
        <div><h3>📱 Touch</h3>
          <p>Use the on-screen buttons. Tap 🕹️ at the top to show or hide them.</p></div>
      </div>
      <h3>Where to go</h3>
      <ul>
        <li>🟡 <b>Car Shop</b> (Mehek Motors) – buy, sell and trade vehicles</li>
        <li>🟠 <b>Upgrade Shop</b> – engine, turbo, tires, nitro and paint</li>
        <li>🔴 <b>Racing Area</b> – Easy, Medium, Hard, Extreme and Impossible tracks</li>
        <li>🔵 <b>Marina</b> – take your boat out on the sea</li>
      </ul>
      <button class="big" data-close>Let's drive! 🚗</button>`);
    this.save.seenHelp = true;
    this.store();
  },

  showPause() {
    const inRace = this.mode === 'race';
    const m = this.openMenu(`
      <h2>⏸️ Paused</h2>
      <button class="big" data-close>Keep playing</button>
      ${inRace ? '<button class="big alt" id="quit-race">Quit race</button>' : ''}
      <button class="big alt" id="pause-help">Controls & help</button>
      <button class="big danger" id="pause-reset">Start a new game</button>`);
    if (inRace) m.querySelector('#quit-race').onclick = () => this.leaveRace();
    m.querySelector('#pause-help').onclick = () => this.showHelp();
    m.querySelector('#pause-reset').onclick = () => this.resetSave();
  },

  vehicleCard(v, button, extra = '') {
    const owned = this.save.owned.some((o) => o.id === v.id);
    const bar = (val, max) => `<div class="bar"><i style="width:${Math.round(Math.min(1, val / max) * 100)}%"></i></div>`;
    const icon = v.type === 'bike' ? '🏍️' : v.type === 'boat' ? '🚤' : '🚗';
    return `<div class="card ${owned ? 'owned' : ''}">
      <canvas class="thumb" data-thumb="${v.id}" width="120" height="60"></canvas>
      <div class="info">
        <div class="rank">#${v.rank} ${icon}</div>
        <div class="name">${v.name}</div>
        <div class="price">${money(v.price)}</div>
        <div class="stats">Speed ${bar(v.top, 700)} Accel ${bar(v.accel, 780)} Grip ${bar(v.grip, 1)}</div>
        ${extra}
      </div>
      ${button}
    </div>`;
  },

  drawThumbs(root) {
    root.querySelectorAll('canvas[data-thumb]').forEach((c) => {
      const v = VEHICLES[+c.dataset.thumb];
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.save();
      g.translate(c.width / 2, c.height / 2);
      g.scale(1.8, 1.8);
      drawVehicle(g, v, 0, 0, 0, c.dataset.color || v.color, { speed: 0 });
      g.restore();
    });
  },

  openShop(filter = 'all') {
    const list = VEHICLES.slice().sort((a, b) => a.rank - b.rank).filter((v) => filter === 'all' || v.type === filter);
    const tab = (id, label) => `<button class="tab ${filter === id ? 'on' : ''}" data-tab="${id}">${label}</button>`;
    const m = this.openMenu(`
      <h2>🛒 Buy Vehicles – Top 100</h2>
      <p>You have <b>${money(this.save.money)}</b>. Win races to earn more!</p>
      <div class="tabs">${tab('all', 'All 100')}${tab('car', '🚗 Cars')}${tab('bike', '🏍️ Bikes')}${tab('boat', '🚤 Boats')}</div>
      <div class="cards">${list.map((v) => {
        const owned = this.save.owned.some((o) => o.id === v.id);
        const btn = owned ? '<button class="buy" disabled>Owned ✓</button>' : `<button class="buy" data-buy="${v.id}" ${this.save.money < v.price ? 'disabled' : ''}>Buy</button>`;
        return this.vehicleCard(v, btn);
      }).join('')}</div>`, true);
    m.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => this.openShop(b.dataset.tab)));
    m.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => this.buy(VEHICLES[+b.dataset.buy], () => this.openShop(filter))));
    this.drawThumbs(m);
  },

  buy(v, after) {
    if (this.save.money < v.price) return this.toast('Not enough money – go win some races!');
    this.save.money -= v.price;
    this.save.owned.push(this.newOwned(v));
    this.save.current = this.save.owned.length - 1;
    this.store();
    this.updateHud();
    Sound.coin();
    this.toast(`You bought the ${v.name}! 🎉`);
    if (after) after();
  },

  openShowcase(v) {
    const owned = this.save.owned.some((o) => o.id === v.id);
    const btn = owned ? '<button class="buy" disabled>Owned ✓</button>' : `<button class="buy" data-buy="${v.id}" ${this.save.money < v.price ? 'disabled' : ''}>Buy</button>`;
    const m = this.openMenu(`<h2>✨ ${v.name}</h2><p>Top speed ${kmh(v.top)} km/h. You have ${money(this.save.money)}.</p><div class="cards">${this.vehicleCard(v, btn)}</div>
      <button class="big alt" id="see-all">See all 100 vehicles</button>`);
    m.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => this.buy(v, () => this.openShowcase(v))));
    m.querySelector('#see-all').onclick = () => this.openShop('all');
    this.drawThumbs(m);
  },

  sellValue(o) { return Math.round(VEHICLES[o.id].price * 0.6 + o.spent * 0.5); },
  tradeValue(o) { return Math.round(VEHICLES[o.id].price * 0.75 + o.spent * 0.6); },

  openSell() {
    const m = this.openMenu(`
      <h2>💰 Sell a Vehicle</h2>
      <p>The seller pays 60% of the price plus half of what you spent on upgrades.</p>
      <div class="cards">${this.save.owned.map((o, i) => {
        const v = VEHICLES[o.id];
        const btn = this.save.owned.length < 2 ? '<button class="buy" disabled>Keep 1</button>' : `<button class="buy sell" data-sell="${i}">Sell ${money(this.sellValue(o))}</button>`;
        return this.vehicleCard(v, btn);
      }).join('')}</div>`, true);
    m.querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.sell;
      const o = this.save.owned[i];
      const v = VEHICLES[o.id];
      this.ask(`Sell your ${v.name} for ${money(this.sellValue(o))}?`, 'Sell it', () => {
        this.save.money += this.sellValue(o);
        this.removeOwned(i);
        Sound.coin();
        this.toast(`Sold the ${v.name}!`);
        this.openSell();
      }, () => this.openSell());
    }));
    this.drawThumbs(m);
  },

  removeOwned(i) {
    const cur = this.save.owned[this.save.current];
    this.save.owned.splice(i, 1);
    const ni = this.save.owned.indexOf(cur);
    this.save.current = ni >= 0 ? ni : 0;
    this.store();
    this.updateHud();
  },

  openTrade(step = 0, from = null, filter = 'all') {
    if (step === 0) {
      const m = this.openMenu(`
        <h2>🔄 Trading Area</h2>
        <p>Trade in one of your vehicles for a better deal than selling: 75% of its price plus 60% of upgrades counts towards a new one.</p>
        <h3>1. Pick the vehicle you want to trade in</h3>
        <div class="cards">${this.save.owned.map((o, i) => this.vehicleCard(VEHICLES[o.id], `<button class="buy" data-from="${i}">Trade in (${money(this.tradeValue(o))})</button>`)).join('')}</div>`, true);
      m.querySelectorAll('[data-from]').forEach((b) => (b.onclick = () => this.openTrade(1, +b.dataset.from)));
      this.drawThumbs(m);
      return;
    }
    const o = this.save.owned[from];
    const value = this.tradeValue(o);
    const list = VEHICLES.slice().sort((a, b) => a.rank - b.rank).filter((v) => (filter === 'all' || v.type === filter) && !this.save.owned.some((q) => q.id === v.id));
    const tab = (id, label) => `<button class="tab ${filter === id ? 'on' : ''}" data-tab="${id}">${label}</button>`;
    const m = this.openMenu(`
      <h2>🔄 Trade your ${VEHICLES[o.id].name}</h2>
      <p>Trade-in value: <b>${money(value)}</b> · Your money: <b>${money(this.save.money)}</b></p>
      <h3>2. Pick what you want</h3>
      <div class="tabs">${tab('all', 'All')}${tab('car', '🚗 Cars')}${tab('bike', '🏍️ Bikes')}${tab('boat', '🚤 Boats')}<button class="tab" data-back>⬅ Back</button></div>
      <div class="cards">${list.map((v) => {
        const diff = v.price - value;
        const label = diff > 0 ? `Pay ${money(diff)}` : `Get ${money(-diff)}`;
        return this.vehicleCard(v, `<button class="buy" data-to="${v.id}" ${diff > this.save.money ? 'disabled' : ''}>${label}</button>`);
      }).join('')}</div>`, true);
    m.querySelector('[data-back]').onclick = () => this.openTrade(0);
    m.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => this.openTrade(1, from, b.dataset.tab)));
    m.querySelectorAll('[data-to]').forEach((b) => (b.onclick = () => {
      const v = VEHICLES[+b.dataset.to];
      const diff = v.price - value;
      if (diff > this.save.money) return;
      this.save.money -= diff;
      this.removeOwned(from);
      this.save.owned.push(this.newOwned(v));
      this.save.current = this.save.owned.length - 1;
      this.store();
      this.updateHud();
      Sound.coin();
      this.toast(`Traded for the ${v.name}! 🎉`);
      this.openTrade(0);
    }));
    this.drawThumbs(m);
  },

  openGarage(atMarina) {
    if (this.mode === 'race') return;
    const m = this.openMenu(`
      <h2>🏠 My Garage</h2>
      <p>${this.save.owned.length} vehicle(s) · ${money(this.save.money)}${atMarina ? ' · Pick a boat to go on the water, or a car / bike to go back on land.' : ''}</p>
      <div class="cards">${this.save.owned.map((o, i) => {
        const v = VEHICLES[o.id];
        const st = this.statsFor(o);
        const lv = UPGRADES.map((u) => `${u.icon}${o[u.key]}`).join(' ');
        const btn = i === this.save.current ? '<button class="buy" disabled>Driving</button>' : `<button class="buy" data-pick="${i}">Drive</button>`;
        return this.vehicleCard(v, btn, `<div class="lv">${lv} · ${kmh(st.top)} km/h</div>`);
      }).join('')}</div>`, true);
    m.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => this.switchVehicle(+b.dataset.pick)));
    m.querySelectorAll('canvas[data-thumb]').forEach((c, i) => (c.dataset.color = this.save.owned[i].color));
    this.drawThumbs(m);
  },

  switchVehicle(i) {
    const prevType = this.ownedVehicle().type;
    this.save.current = i;
    this.store();
    const v = this.ownedVehicle();
    const toWater = v.type === 'boat' && prevType !== 'boat';
    const toLand = v.type !== 'boat' && prevType === 'boat';
    if (toWater) {
      const s = City.boatSpawn;
      this.makeCar(s.x, s.y, s.a);
      this.toast('Your boat is waiting at the Marina 🚤');
    } else if (toLand) {
      const s = City.carSpawn;
      this.makeCar(s.x, s.y, s.a);
      this.toast(`Your ${v.name} is parked at the Marina pier`);
    } else {
      this.makeCar(this.car.x, this.car.y, this.car.a);
    }
    this.snapCamera();
    this.updateHud();
    this.closeMenu();
  },

  openUpgrades() {
    const o = this.owned();
    const v = VEHICLES[o.id];
    const st = this.statsFor(o);
    const cost = (lvl) => Math.round(Math.max(800, v.price * 0.06) * (lvl + 1) / 100) * 100;
    const m = this.openMenu(`
      <h2>🔧 Upgrade Shop</h2>
      <p>Upgrading your <b>${v.name}</b> · ${money(this.save.money)}</p>
      <div class="cards">${this.vehicleCard(v, '', `<div class="lv">Top speed ${kmh(st.top)} km/h · Nitro ${st.nitroTank.toFixed(1)}s</div>`)}</div>
      <div class="upgrades">${UPGRADES.map((u) => {
        const lvl = o[u.key];
        const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
        const btn = lvl >= MAX_LEVEL ? '<button class="buy" disabled>MAX</button>' : `<button class="buy" data-up="${u.key}" ${this.save.money < cost(lvl) ? 'disabled' : ''}>${money(cost(lvl))}</button>`;
        return `<div class="up"><div class="upname">${u.icon} ${u.name}<small>${u.desc}</small></div><div class="pips">${pips}</div>${btn}</div>`;
      }).join('')}</div>
      <h3>🎨 Paint ($500)</h3>
      <div class="paints">${PAINTS.map((c) => `<button class="paint ${o.color === c ? 'on' : ''}" style="background:${c}" data-paint="${c}"></button>`).join('')}</div>`, true);
    m.querySelectorAll('canvas[data-thumb]').forEach((c) => (c.dataset.color = o.color));
    m.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.up;
      const c = cost(o[k]);
      if (this.save.money < c) return;
      this.save.money -= c;
      o[k]++;
      o.spent += c;
      this.afterUpgrade();
      this.toast(`${k[0].toUpperCase() + k.slice(1)} upgraded to level ${o[k]}! 🔧`);
    }));
    m.querySelectorAll('[data-paint]').forEach((b) => (b.onclick = () => {
      if (o.color === b.dataset.paint) return;
      if (this.save.money < 500) return this.toast('Not enough money');
      this.save.money -= 500;
      o.color = b.dataset.paint;
      this.afterUpgrade();
    }));
    this.drawThumbs(m);
  },

  afterUpgrade() {
    this.store();
    Sound.coin();
    this.makeCar(this.car.x, this.car.y, this.car.a);
    this.updateHud();
    this.openUpgrades();
  },

  openRaceMenu() {
    const v = this.ownedVehicle();
    const st = this.statsFor(this.owned());
    const m = this.openMenu(`
      <h2>🏁 Racing Area</h2>
      <p>You are driving the <b>${v.name}</b> (${kmh(st.top)} km/h). Finish in the top places to win money!</p>
      <div class="tracks">${TRACKS.map((t, i) => {
        const best = this.save.best[t.id];
        const medal = best === 1 ? '🥇' : best === 2 ? '🥈' : best === 3 ? '🥉' : best ? `#${best}` : '';
        const ok = t.vehicle === 'boat' ? v.type === 'boat' : v.type !== 'boat';
        return `<div class="track" style="--c:${t.color}">
          <canvas class="tmap" data-track="${i}" width="140" height="100"></canvas>
          <div class="tinfo">
            <div class="level">${t.level} ${medal}</div>
            <div class="name">${t.name}</div>
            <div>${t.laps} laps · ${t.aiCount} rivals · rivals go ~${kmh(t.aiTop)} km/h</div>
            <div>1st ${money(t.rewards[0])} · 2nd ${money(t.rewards[1])} · 3rd ${money(t.rewards[2])}</div>
          </div>
          <button class="buy" data-race="${i}" ${ok ? '' : 'disabled'}>${ok ? 'Race!' : t.vehicle === 'boat' ? 'Needs boat' : 'Needs car/bike'}</button>
        </div>`;
      }).join('')}</div>`, true);
    m.querySelectorAll('[data-race]').forEach((b) => (b.onclick = () => this.startRace(TRACKS[+b.dataset.race])));
    m.querySelectorAll('canvas[data-track]').forEach((c) => {
      const t = TRACKS[+c.dataset.track];
      const g = c.getContext('2d');
      const b = t.bounds;
      const sc = Math.min(c.width / (b.maxX - b.minX), c.height / (b.maxY - b.minY));
      g.fillStyle = THEMES[t.theme].bg;
      g.fillRect(0, 0, c.width, c.height);
      g.setTransform(sc, 0, 0, sc, -b.minX * sc + (c.width - (b.maxX - b.minX) * sc) / 2, -b.minY * sc + (c.height - (b.maxY - b.minY) * sc) / 2);
      g.beginPath();
      t.path.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.lineJoin = 'round';
      g.strokeStyle = t.theme === 'water' ? '#fff' : '#333';
      g.lineWidth = t.width * 0.7;
      g.stroke();
    });
  },

  showResults(place, prize) {
    const r = this.race;
    const names = r.finishOrder.map((w) => (w === 'you' ? 'You' : w.name));
    // anyone still racing goes after
    const rest = r.ais.filter((a) => !a.done).sort((p, q) => q.s - p.s).map((a) => a.name);
    const all = names.concat(rest);
    const medal = place === 1 ? '🏆' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🏁';
    const m = this.openMenu(`
      <h2>${medal} You finished ${ordinal(place)}!</h2>
      <p>Time: <b>${formatTime(r.t)}</b> · Prize: <b class="green">${money(prize)}</b></p>
      <ol class="results">${all.map((n) => `<li class="${n === 'You' ? 'me' : ''}">${n}</li>`).join('')}</ol>
      ${place === 1 && r.track.id === 'impossible' ? '<p class="green"><b>WOW! You beat the IMPOSSIBLE track! 🤯</b></p>' : ''}
      <button class="big" id="again">Race again</button>
      <button class="big alt" id="back">Back to the city</button>`);
    m.querySelector('#again').onclick = () => this.startRace(r.track);
    m.querySelector('#back').onclick = () => this.leaveRace();
    m.querySelector('[data-close]').onclick = () => this.leaveRace();
  },
};

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}
function ordinal(n) {
  return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
}

// ------------------------------------------------------------ sound (no files needed)
const Sound = {
  ctx: null,
  muted: false,
  init() {
    const start = () => {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.osc = this.ctx.createOscillator();
        this.osc.type = 'sawtooth';
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 500;
        this.eg = this.ctx.createGain();
        this.eg.gain.value = 0;
        this.osc.connect(this.filter).connect(this.eg).connect(this.master);
        this.osc.start();
      } catch (e) { this.ctx = null; }
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },
  engine(frac, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(45 + frac * 160, t, 0.05);
    this.eg.gain.setTargetAtTime(on ? 0.04 + frac * 0.05 : 0, t, 0.1);
  },
  tone(freq, dur, type = 'square', vol = 0.15, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  },
  beep(f) { this.tone(f, 0.25); },
  click() { this.tone(660, 0.06, 'triangle', 0.1); },
  thud() { this.tone(80, 0.15, 'sine', 0.3); },
  coin() { this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.25, 'square', 0.1, 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'square', 0.1, i * 0.12)); },
};

window.addEventListener('load', () => Game.init());
