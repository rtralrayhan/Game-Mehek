// Visual effects: particles (smoke, dust, sparks, splashes, confetti),
// the day / night cycle with real lights, and drifting cloud shadows.

const FX = {
  particles: [],
  clouds: [],
  high: true, // graphics quality
  dayLength: 480, // seconds for a full day
  clock: 9, // hour of the day, 0-24
  light: null,
  lightCtx: null,

  init() {
    const rnd = seeded(77);
    for (let i = 0; i < 16; i++) {
      this.clouds.push({ x: rnd() * MAP_W * T, y: rnd() * MAP_H * T, r: 260 + rnd() * 380, s: 14 + rnd() * 12, k: rnd() });
    }
    this.light = document.createElement('canvas');
    this.lightCtx = this.light.getContext('2d');
    // light shapes drawn once and stamped many times (much faster than new gradients every frame)
    const sprite = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; };
    const radial = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const hole = [[0, 'rgba(0,0,0,0.95)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']];
    this.holeSprite = sprite(128, 128, (g) => { g.fillStyle = radial(g, 64, 64, 64, hole); g.fillRect(0, 0, 128, 128); });
    this.coneSprite = sprite(128, 128, (g) => {
      g.fillStyle = radial(g, 0, 64, 128, hole);
      g.beginPath(); g.moveTo(0, 64); g.arc(0, 64, 128, -0.42, 0.42); g.closePath(); g.fill();
    });
    this.glowSprite = sprite(64, 64, (g) => { g.fillStyle = radial(g, 32, 32, 32, [[0, 'rgba(255,225,150,0.9)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 64, 64); });
  },

  // ------------------------------------------------------------ day / night
  update(dt) {
    this.clock = (this.clock + (dt / this.dayLength) * 24) % 24;
    for (const c of this.clouds) {
      c.x += c.s * dt;
      if (c.x - c.r > MAP_W * T) c.x = -c.r;
    }
    this.updateParticles(dt);
  },

  // 0 = bright day, ~0.65 = deep night
  darkness() {
    const h = this.clock;
    if (h >= 7 && h <= 18) return 0;
    if (h > 18 && h < 21) return ((h - 18) / 3) * 0.62;
    if (h > 5 && h < 7) return ((7 - h) / 2) * 0.62;
    return 0.62;
  },
  // warm orange at sunrise / sunset
  sunsetGlow() {
    const h = this.clock;
    const d = Math.min(Math.abs(h - 18.5), Math.abs(h - 6.2));
    return Math.max(0, 1 - d / 1.4) * 0.22;
  },
  // which way shadows fall and how long they are (per pixel of building height)
  sun() {
    const h = Math.max(5, Math.min(20, this.clock));
    const a = ((h - 5) / 15) * Math.PI; // sun travels east -> west
    const len = 0.35 + Math.abs(Math.cos(a)) * 0.9;
    return { x: -Math.cos(a) * len, y: 0.45 * len, alpha: 0.26 * (1 - this.darkness() / 0.7) + 0.04 };
  },
  clockText() {
    const h = Math.floor(this.clock);
    const m = Math.floor((this.clock - h) * 60);
    const icon = this.darkness() > 0.3 ? '🌙' : this.sunsetGlow() > 0.05 ? '🌅' : '☀️';
    return `${icon} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // Darken the world and cut holes for lamps and headlights.
  // lights: [{x, y, r, cone?: angle, color}] in world coordinates.
  drawLighting(ctx, W, H, cam, z, lights, dark) {
    const glow = this.sunsetGlow();
    if (glow > 0) {
      ctx.fillStyle = `rgba(255,120,40,${glow})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (dark <= 0.01) return;
    const scale = this.high ? 0.5 : 0.33;
    const lw = Math.ceil(W * scale), lh = Math.ceil(H * scale);
    if (this.light.width !== lw || this.light.height !== lh) { this.light.width = lw; this.light.height = lh; }
    const g = this.lightCtx;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.fillStyle = `rgba(8,12,38,${dark})`;
    g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    const s = z * scale;
    for (const L of lights) {
      const sx = (L.x - cam.x) * s, sy = (L.y - cam.y) * s, r = L.r * s;
      if (sx < -r || sy < -r || sx > lw + r || sy > lh + r) continue;
      if (L.cone !== undefined) {
        g.save();
        g.translate(sx, sy);
        g.rotate(L.cone);
        g.drawImage(this.coneSprite, 0, -r, r, r * 2);
        g.restore();
      } else g.drawImage(this.holeSprite, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.drawImage(this.light, 0, 0, W, H);
    // warm glow on top of lamps and headlights
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.color) continue;
      const sx = (L.x - cam.x) * z, sy = (L.y - cam.y) * z, r = (L.cone !== undefined ? 26 : 30) * z;
      if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
      ctx.globalAlpha = Math.min(1, dark * 1.6);
      ctx.drawImage(this.glowSprite, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawClouds(ctx, cam) {
    if (!this.high) return;
    for (const c of this.clouds) {
      if (c.x + c.r < cam.x || c.x - c.r > cam.x + cam.w || c.y + c.r < cam.y || c.y - c.r > cam.y + cam.h) continue;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(10,20,40,0.13)');
      g.addColorStop(1, 'rgba(10,20,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * (0.55 + c.k * 0.3), 0, 0, Math.PI * 2); ctx.fill();
    }
  },

  // ------------------------------------------------------------ particles
  emit(type, x, y, o = {}) {
    if (this.particles.length > (this.high ? 600 : 200)) return;
    const p = { type, x, y, vx: o.vx || 0, vy: o.vy || 0, life: 0, max: o.life || 1, size: o.size || 6, color: o.color || '#fff', rot: Math.random() * 6 };
    this.particles.push(p);
  },
  smoke(x, y, n = 1, color = 'rgba(230,230,230,') {
    for (let i = 0; i < n; i++) this.emit('smoke', x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, { vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.9 + Math.random() * 0.6, size: 7 + Math.random() * 6, color });
  },
  sparks(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 100 + Math.random() * 220;
      this.emit('spark', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.3, size: 2.5, color: Math.random() < 0.5 ? '#ffeb3b' : '#ff9800' });
    }
  },
  splash(x, y, n = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 50;
      this.emit('splash', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.5, size: 3 + Math.random() * 4, color: '#ffffff' });
    }
  },
  flame(x, y, a) {
    const s = 120 + Math.random() * 80;
    this.emit('flame', x, y, { vx: -Math.cos(a) * s + (Math.random() - 0.5) * 30, vy: -Math.sin(a) * s + (Math.random() - 0.5) * 30, life: 0.18 + Math.random() * 0.12, size: 6, color: Math.random() < 0.5 ? '#ffd54f' : '#29b6f6' });
  },
  confetti(x, y, n = 80) {
    const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ab47bc', '#ff7043'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 300;
      this.emit('confetti', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.6 + Math.random(), size: 5, color: cols[i % cols.length] });
    }
  },
  sparkle(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.emit('spark', x, y, { vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 0.5, size: 3, color: '#fff59d' });
    }
  },

  updateParticles(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.type === 'spark' || p.type === 'confetti' ? 2.5 : 1.2;
      p.vx *= 1 - drag * dt;
      p.vy *= 1 - drag * dt;
      p.rot += dt * 4;
    }
  },

  draw(ctx, cam) {
    for (const p of this.particles) {
      if (p.x < cam.x - 40 || p.x > cam.x + cam.w + 40 || p.y < cam.y - 40 || p.y > cam.y + cam.h + 40) continue;
      const t = p.life / p.max;
      if (p.type === 'smoke') {
        ctx.fillStyle = p.color + (0.42 * (1 - t)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + t * 2.2), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'splash') {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + t), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = 1 - t * t;
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  },
};

// Convex hull (used for building shadows)
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
