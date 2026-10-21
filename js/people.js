// People: pedestrians walking around the city, mission givers,
// and you when you get out of your car.

const SKINS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];
const HAIRS = ['#2b1b0e', '#4e342e', '#8d6e63', '#ffca28', '#212121', '#bf360c', '#eeeeee'];
const SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff7043', '#00acc1', '#f06292', '#6d4c41', '#546e7a'];

const People = {
  peds: [],
  walker: { x: 0, y: 0, dir: 0, step: 0, moving: false },

  init() {
    const rnd = seeded(4242);
    const spots = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (this.pedTile(City.get(x, y))) spots.push([x, y]);
    for (let i = 0; i < 90; i++) {
      const [tx, ty] = spots[Math.floor(rnd() * spots.length)];
      this.peds.push({
        x: (tx + 0.5) * T, y: (ty + 0.5) * T, tx, ty, dir: 0, step: rnd() * 6,
        speed: 32 + rnd() * 26,
        skin: SKINS[Math.floor(rnd() * SKINS.length)],
        hair: HAIRS[Math.floor(rnd() * HAIRS.length)],
        shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
        scare: 0, sx: 0, sy: 0, wave: 0,
      });
    }
  },

  pedTile(t) {
    return t === TILE.WALK || t === TILE.PATH || t === TILE.PLAZA || t === TILE.DOCK;
  },

  // threats: moving vehicles people jump away from
  update(dt, threats) {
    for (const p of this.peds) {
      if (p.scare > 0) {
        // dive out of the way!
        p.scare -= dt;
        const nx = p.x + p.sx * dt, ny = p.y + p.sy * dt;
        if (!City.solidFor(nx, ny, 'walk')) { p.x = nx; p.y = ny; }
        p.step += dt * 18;
        if (p.scare <= 0) { p.tx = Math.floor(p.x / T); p.ty = Math.floor(p.y / T); }
        continue;
      }
      for (const v of threats) {
        const dx = p.x - v.x, dy = p.y - v.y;
        const d = Math.hypot(dx, dy);
        if (d < 70 && Math.hypot(v.vx, v.vy) > 70) {
          // jump sideways from the vehicle's path
          const side = (dx * -v.vy + dy * v.vx) > 0 ? 1 : -1;
          const len = Math.hypot(v.vx, v.vy) || 1;
          p.sx = (-v.vy / len) * side * 170;
          p.sy = (v.vx / len) * side * 170;
          p.scare = 0.55;
          p.shout = 1.6;
          break;
        }
      }
      if (p.shout > 0) p.shout -= dt;
      if (p.wave > 0) p.wave -= dt;
      const cx = (p.tx + 0.5) * T, cy = (p.ty + 0.5) * T;
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        // pick the next tile: keep going straight if possible
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const opts = dirs.filter(([ax, ay]) => this.pedTile(City.get(p.tx + ax, p.ty + ay)));
        const ahead = opts.find(([ax, ay]) => Math.abs(Math.atan2(ay, ax) - p.dir) < 0.1);
        let pick;
        if (ahead && Math.random() < 0.85) pick = ahead;
        else {
          const notBack = opts.filter(([ax, ay]) => Math.abs(Math.cos(Math.atan2(ay, ax) - p.dir) + 1) > 0.1);
          const list = notBack.length ? notBack : opts;
          pick = list[Math.floor(Math.random() * list.length)];
        }
        if (pick) { p.tx += pick[0]; p.ty += pick[1]; p.dir = Math.atan2(pick[1], pick[0]); }
      } else {
        const m = Math.min(d, p.speed * dt);
        p.x += (dx / d) * m;
        p.y += (dy / d) * m;
        p.step += dt * 8;
      }
    }
  },

  // You, walking around
  updateWalker(dt, solid) {
    const w = this.walker;
    const s = Input.state;
    let mx = s.moveX, my = s.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const speed = s.nitro ? 250 : 150; // hold nitro / Shift to run
    const nx = w.x + mx * speed * dt, ny = w.y + my * speed * dt;
    if (!solid(nx, w.y)) w.x = nx;
    if (!solid(w.x, ny)) w.y = ny;
    w.moving = len > 0.1;
    if (w.moving) { w.dir = Math.atan2(my, mx); w.step += dt * (s.nitro ? 16 : 10); }
  },

  draw(ctx, cam, time) {
    for (const p of this.peds) {
      if (p.x < cam.x - 30 || p.x > cam.x + cam.w + 30 || p.y < cam.y - 30 || p.y > cam.y + cam.h + 30) continue;
      drawPerson(ctx, p.x, p.y, p.dir, p.step, p);
      if (p.shout > 0) speech(ctx, p.x, p.y - 26, p.shout > 0.8 ? 'Hey!' : '!');
      if (p.wave > 0) speech(ctx, p.x, p.y - 26, '👋');
    }
  },
};

// Draw a person seen from above, walking in direction `dir`.
function drawPerson(ctx, x, y, dir, step, look, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  ctx.scale(scale, scale);
  const swing = Math.sin(step) * 5;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(3, 3, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.fillStyle = look.pants || '#37474f';
  ctx.fillRect(-2 + swing, -6, 7, 4);
  ctx.fillRect(-2 - swing, 2, 7, 4);
  // arms
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(-swing * 0.8, -10, 2.6, 0, Math.PI * 2); ctx.arc(swing * 0.8, 10, 2.6, 0, Math.PI * 2); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, shade(look.shirt, -0.25));
  g.addColorStop(0.5, shade(look.shirt, 0.15));
  g.addColorStop(1, shade(look.shirt, -0.25));
  ctx.fillStyle = g;
  roundRect(ctx, -5, -9, 10, 18, 5); ctx.fill();
  // head
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(1, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.arc(-0.5, 0, 5.2, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function speech(ctx, x, y, text) {
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = '#fff';
  roundRect(ctx, x - w / 2, y - 16, w, 20, 8);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x, y + 9); ctx.fill();
  ctx.fillStyle = '#263238';
  ctx.fillText(text, x, y - 1);
}
