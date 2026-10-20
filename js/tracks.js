// Race tracks: easy, medium, hard, extreme, impossible, plus a boat race.

const TRACKS = [
  {
    id: 'easy', name: 'Sunny Park Loop', level: 'Easy', color: '#43a047', laps: 2, width: 230, aiTop: 210, aiCount: 3,
    rewards: [3000, 1500, 700, 300], vehicle: 'land', theme: 'grass',
    points: Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return [Math.cos(a) * 1300, Math.sin(a) * 750]; }),
  },
  {
    id: 'medium', name: 'City Circuit', level: 'Medium', color: '#fdd835', laps: 3, width: 200, aiTop: 320, aiCount: 4,
    rewards: [9000, 4500, 2000, 800, 300], vehicle: 'land', theme: 'city',
    points: [[0, 0], [1600, 0], [2000, 300], [2000, 900], [1600, 1250], [1050, 1000], [600, 1300], [0, 1200], [-350, 750], [-350, 300]],
  },
  {
    id: 'hard', name: 'Mountain Twist', level: 'Hard', color: '#fb8c00', laps: 3, width: 170, aiTop: 460, aiCount: 5,
    rewards: [25000, 12000, 6000, 2500, 1000, 400], vehicle: 'land', theme: 'mountain',
    points: [[0, 0], [900, -200], [1500, 200], [1300, 700], [1800, 1100], [2400, 800], [2750, 1300], [2250, 1950], [1400, 1750], [800, 2150], [150, 1850], [400, 1250], [-200, 950], [-450, 400]],
  },
  {
    id: 'extreme', name: 'Dragon Snake', level: 'Extreme', color: '#e53935', laps: 3, width: 150, aiTop: 580, aiCount: 5,
    rewards: [70000, 35000, 15000, 6000, 2500, 1000], vehicle: 'land', theme: 'desert',
    points: [[0, 0], [600, -300], [1100, 100], [1600, -300], [2200, 0], [2550, 600], [2050, 950], [2450, 1450], [1950, 1950], [1300, 1550], [900, 2050], [300, 1750], [650, 1250], [100, 900], [-450, 1250], [-750, 650], [-350, 300]],
  },
  {
    id: 'impossible', name: 'Nightmare Ring', level: 'Impossible', color: '#8e24aa', laps: 3, width: 130, aiTop: 740, aiCount: 6,
    rewards: [250000, 100000, 40000, 15000, 6000, 2500, 1000], vehicle: 'land', theme: 'night',
    points: [[0, 0], [1200, 0], [1550, 220], [1200, 450], [300, 450], [0, 700], [300, 950], [1500, 950], [2050, 700], [2400, 1150], [1950, 1600], [650, 1600], [200, 1900], [-550, 1700], [-750, 1050], [-550, 350]],
  },
  {
    id: 'boat', name: 'Harbor Splash', level: 'Boat Race', color: '#039be5', laps: 2, width: 280, aiTop: 360, aiCount: 4,
    rewards: [30000, 15000, 7000, 3000, 1000], vehicle: 'boat', theme: 'water',
    points: [[0, 0], [1500, -300], [2600, 200], [2800, 1200], [2000, 1800], [1000, 1400], [200, 1900], [-600, 1300], [-500, 400]],
  },
];

// Turn the rough corner points into a smooth closed path.
function buildTrack(track) {
  if (track.path) return track;
  const P = track.points;
  const n = P.length;
  const raw = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let s = 0; s < 30; s++) {
      const t = s / 30, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // resample to even spacing
  const step = 20;
  const path = [raw[0]];
  let carry = 0;
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1], b = raw[i % raw.length];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      path.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  path.pop();
  const N = path.length;
  // how sharp each corner is (used by the computer drivers)
  const sharp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = path[(i - 6 + N) % N], b = path[i], c = path[(i + 6) % N];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = Math.PI * 2 - d;
    sharp[i] = Math.min(1, d / 1.2);
  }
  // look ahead so drivers brake before the corner
  const ahead = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let k = 0; k < 18; k++) m = Math.max(m, sharp[(i + k) % N] * (1 - k / 30));
    ahead[i] = m;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of path) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  track.bounds = { minX: minX - 600, minY: minY - 600, maxX: maxX + 600, maxY: maxY + 600 };
  track.path = path;
  track.N = N;
  track.ahead = ahead;

  // scenery that stays off the road
  const rnd = seeded(track.id.length * 999 + N);
  track.scenery = [];
  for (let i = 0; i < 260; i++) {
    const x = track.bounds.minX + rnd() * (track.bounds.maxX - track.bounds.minX);
    const y = track.bounds.minY + rnd() * (track.bounds.maxY - track.bounds.minY);
    if (nearestOnPath(track, x, y).dist > track.width / 2 + 80) track.scenery.push({ x, y, r: 14 + rnd() * 22, k: rnd() });
  }
  return track;
}

function trackDir(track, i) {
  const a = track.path[i % track.N], b = track.path[(i + 1) % track.N];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

// Find the closest path point. If `hint` is given only search near it (faster and
// stops racers jumping across the track).
function nearestOnPath(track, x, y, hint) {
  const N = track.N;
  let best = 0, bd = Infinity;
  if (hint === undefined) {
    for (let i = 0; i < N; i++) {
      const p = track.path[i];
      const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  } else {
    for (let k = -25; k <= 40; k++) {
      const i = (hint + k + N) % N;
      const p = track.path[i];
      const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
  }
  return { i: best, dist: Math.sqrt(bd) };
}

const THEMES = {
  grass: { bg: '#79c267', tree: ['#2e7d32', '#43a047'], road: '#4a4f57' },
  city: { bg: '#8fa3ad', tree: ['#cfd8dc', '#b0bec5'], road: '#3d4249' },
  mountain: { bg: '#6d9b5a', tree: ['#1b5e20', '#33691e'], road: '#4a4a4a' },
  desert: { bg: '#e7c27d', tree: ['#c49a52', '#8d6e3f'], road: '#5d5048' },
  night: { bg: '#1d2340', tree: ['#3949ab', '#5e35b1'], road: '#2b2f3a' },
  water: { bg: '#2f9be0', tree: ['#f1dc9b', '#66bb6a'], road: 'rgba(255,255,255,0.08)' },
};

function drawTrack(ctx, track, cam, time) {
  const th = THEMES[track.theme];
  ctx.fillStyle = th.bg;
  ctx.fillRect(cam.x - 10, cam.y - 10, cam.w + 20, cam.h + 20);

  if (track.theme === 'water') {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    const gx = Math.floor(cam.x / 90) * 90, gy = Math.floor(cam.y / 70) * 70;
    for (let y = gy; y < cam.y + cam.h + 70; y += 70) for (let x = gx; x < cam.x + cam.w + 90; x += 90) {
      const o = Math.sin(time * 1.4 + x * 0.01 + y * 0.02) * 10;
      ctx.beginPath(); ctx.moveTo(x + o, y); ctx.quadraticCurveTo(x + 15 + o, y - 8, x + 30 + o, y); ctx.stroke();
    }
  }

  const path = track.path;
  const line = () => {
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (track.theme !== 'water') {
    // red & white curbs
    line();
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = track.width + 22;
    ctx.stroke();
    ctx.setLineDash([28, 28]);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.setLineDash([]);
    line();
    ctx.strokeStyle = th.road;
    ctx.lineWidth = track.width;
    ctx.stroke();
    line();
    ctx.setLineDash([30, 40]);
    ctx.strokeStyle = track.theme === 'night' ? '#00e5ff' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    line();
    ctx.strokeStyle = th.road;
    ctx.lineWidth = track.width;
    ctx.stroke();
    // buoys on both sides
    for (let i = 0; i < track.N; i += 6) {
      const a = trackDir(track, i);
      const nx = -Math.sin(a), ny = Math.cos(a);
      for (const side of [-1, 1]) {
        const bx = path[i][0] + nx * side * track.width / 2, by = path[i][1] + ny * side * track.width / 2;
        if (bx < cam.x - 30 || bx > cam.x + cam.w + 30 || by < cam.y - 30 || by > cam.y + cam.h + 30) continue;
        ctx.fillStyle = side < 0 ? '#ff5252' : '#ffeb3b';
        ctx.beginPath(); ctx.arc(bx, by + Math.sin(time * 3 + i) * 2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx - 2, by - 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // start / finish line (checkered)
  const a0 = trackDir(track, 0);
  ctx.save();
  ctx.translate(path[0][0], path[0][1]);
  ctx.rotate(a0);
  const cells = 10, cs = track.width / cells;
  for (let r = 0; r < 2; r++) for (let c = 0; c < cells; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
    ctx.fillRect(-cs + r * cs, -track.width / 2 + c * cs, cs, cs);
  }
  ctx.restore();

  // scenery
  for (const s of track.scenery) {
    if (s.x < cam.x - 60 || s.x > cam.x + cam.w + 60 || s.y < cam.y - 60 || s.y > cam.y + cam.h + 60) continue;
    if (track.theme === 'city') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(s.x - s.r + 8, s.y - s.r + 8, s.r * 2, s.r * 2);
      ctx.fillStyle = ['#eceff1', '#ffe0b2', '#c5cae9', '#b2dfdb'][Math.floor(s.k * 4)];
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    } else if (track.theme === 'water') {
      if (s.k < 0.25) {
        ctx.fillStyle = '#f1dc9b';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#43a047';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2); ctx.fill();
      }
    } else if (track.theme === 'night') {
      ctx.fillStyle = s.k < 0.5 ? '#3949ab' : '#7e57c2';
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 2 + s.k * 10);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(s.x + 6, s.y + 6, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.tree[s.k < 0.5 ? 0 : 1];
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}
