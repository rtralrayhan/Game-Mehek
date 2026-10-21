// Missions (delivery, taxi, checkpoint run, boat run), hidden gold stars,
// and the step-by-step tutorial.

const PLACES = [
  { name: 'Mehek Motors', x: 15.5, y: 21 },
  { name: 'Central Park', x: 35.5, y: 25 },
  { name: 'the Upgrade Shop', x: 35.5, y: 39.5 },
  { name: 'the Racing Stadium', x: 62, y: 49 },
  { name: 'Green Park', x: 55.5, y: 45 },
  { name: 'the Marina', x: 81.5, y: 34.5 },
  { name: 'Downtown', x: 72, y: 25 },
  { name: 'West Side', x: 5, y: 35 },
  { name: 'South Street', x: 35, y: 65 },
  { name: 'North Avenue', x: 55, y: 5 },
  { name: 'Ocean Drive', x: 79, y: 60 },
  { name: 'Old Town', x: 15, y: 45 },
].map((p) => ({ name: p.name, x: p.x * T, y: p.y * T }));

const GIVERS = [
  { id: 'dan', name: 'Delivery Dan', type: 'delivery', x: 10.5, y: 20.5, shirt: '#8d6e63', hair: '#212121', skin: '#e0ac69', line: 'Hi! I have a parcel that needs to get across town fast. Can you deliver it?' },
  { id: 'tara', name: 'Taxi Tara', type: 'taxi', x: 30.5, y: 23.5, shirt: '#fdd835', hair: '#bf360c', skin: '#ffdbac', line: 'My taxi broke down and someone needs a ride! Can you drive them?' },
  { id: 'kai', name: 'Coach Kai', type: 'rings', x: 29.5, y: 40.5, shirt: '#e53935', hair: '#4e342e', skin: '#8d5524', line: 'Let\'s train! Drive through all the checkpoints before the timer runs out.' },
  { id: 'nia', name: 'Captain Nia', type: 'boat', x: 86.5, y: 33.5, shirt: '#0d47a1', hair: '#eeeeee', skin: '#c68642', line: 'Ahoy! Take a boat through my buoys out at sea. You\'ll need a boat for this one.' },
  { id: 'sam', name: 'Star Sam', type: 'stars', x: 55.5, y: 30.5, shirt: '#ab47bc', hair: '#ffca28', skin: '#f1c27d', line: 'I hid 25 gold stars all over Racing City! Each one is worth $500, and finding all of them wins $25,000.' },
].map((g) => ({ ...g, x: g.x * T, y: g.y * T, look: { shirt: g.shirt, hair: g.hair, skin: g.skin } }));

const Missions = {
  active: null,
  stars: [],

  init() {
    // gold stars on reachable spots around the city
    const rnd = seeded(2525);
    const okTiles = [TILE.ROAD, TILE.WALK, TILE.PATH, TILE.PLAZA, TILE.SAND, TILE.PARK];
    while (this.stars.length < 25) {
      const x = 2 + Math.floor(rnd() * 80), y = 2 + Math.floor(rnd() * 68);
      if (!okTiles.includes(City.get(x, y))) continue;
      if (this.stars.some((s) => Math.hypot(s.x / T - x, s.y / T - y) < 9)) continue;
      this.stars.push({ x: (x + 0.5) * T, y: (y + 0.5) * T });
    }
  },

  starsFound() { return (Game.save.stars || []).length; },

  // where the player is right now (car or on foot)
  pos() { return Game.onFoot ? People.walker : Game.car; },

  update(dt) {
    const p = this.pos();
    // gold stars
    const found = Game.save.stars || (Game.save.stars = []);
    this.stars.forEach((s, i) => {
      if (found.includes(i)) return;
      if (Math.hypot(p.x - s.x, p.y - s.y) < 40) {
        found.push(i);
        Game.save.money += 500;
        FX.sparkle(s.x, s.y);
        Sound.coin();
        if (found.length === 25) {
          Game.save.money += 25000;
          FX.confetti(p.x, p.y);
          Sound.win();
          Game.toast('You found ALL 25 gold stars! +$25,000 🌟');
        } else Game.toast(`⭐ Gold star ${found.length}/25 found! +$500`);
        Game.store();
        Game.updateHud();
      }
    });

    const m = this.active;
    if (!m) return;
    m.time -= dt;
    if (m.time <= 0) return this.fail('Out of time!');
    const t = m.targets[m.step];
    const inVehicle = !Game.onFoot;
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    const needStop = m.type === 'taxi';
    const stopped = !inVehicle || Math.abs(Game.car.speed) < 70;
    if (d < t.r && (!needStop || stopped)) {
      if (m.type === 'taxi' && !inVehicle) return;
      if (m.type === 'boat' && (!inVehicle || Game.car.v.type !== 'boat')) return;
      m.step++;
      Sound.beep(880);
      FX.sparkle(t.x, t.y);
      if (m.step >= m.targets.length) return this.complete();
      if (m.type === 'delivery') Game.toast('📦 Got the parcel! Now deliver it.');
      if (m.type === 'taxi') Game.toast('🧍 Passenger is in! Drive them there.');
      m.time += m.bonus || 0;
    } else if (d < t.r && needStop && !stopped) {
      Game.prompt('Slow down and stop to pick up / drop off!');
    }
    this.updatePanel();
  },

  start(giver) {
    const type = giver.type;
    const p = this.pos();
    const v = Game.ownedVehicle();
    if (type === 'boat' && v.type !== 'boat') {
      Game.toast('You need a boat! Buy one at the Car Shop, then switch at the Marina.');
      return false;
    }
    if ((type === 'taxi' || type === 'rings') && v.type === 'boat') {
      Game.toast('This mission needs a car or a bike.');
      return false;
    }
    const pick = (exclude, near) => {
      const list = PLACES.filter((q) => !exclude.includes(q) && Math.hypot(q.x - near.x, q.y - near.y) > 900);
      return list[Math.floor(Math.random() * list.length)];
    };
    let m;
    if (type === 'delivery' || type === 'taxi') {
      const a = pick([], p);
      const b = pick([a], a);
      const dist = Math.hypot(a.x - p.x, a.y - p.y) + Math.hypot(b.x - a.x, b.y - a.y);
      const reward = Math.round((900 + dist * 0.55) / 100) * 100;
      const who = type === 'taxi' ? ['Grandma Rose', 'Mr. Patel', 'Little Leo', 'Dr. Kim', 'Chef Marco'][Math.floor(Math.random() * 5)] : '';
      m = {
        type, title: type === 'taxi' ? `🚕 Taxi: ${who}` : '📦 Delivery',
        targets: [{ ...a, r: 80, label: type === 'taxi' ? `Pick up ${who}` : 'Pick up the parcel' }, { ...b, r: 80, label: type === 'taxi' ? `Drop off at ${b.name}` : `Deliver to ${b.name}` }],
        time: Math.hypot(a.x - p.x, a.y - p.y) / 200 + 20, bonus: Math.hypot(b.x - a.x, b.y - a.y) / 210 + 12, reward,
      };
      m.targets[0].label += ` at ${a.name}`;
    } else if (type === 'rings') {
      const pts = [];
      let cur = p;
      for (let i = 0; i < 6; i++) {
        const list = PLACES.filter((q) => !pts.includes(q) && Math.hypot(q.x - cur.x, q.y - cur.y) > 600).sort((q1, q2) => Math.hypot(q1.x - cur.x, q1.y - cur.y) - Math.hypot(q2.x - cur.x, q2.y - cur.y));
        cur = list[Math.floor(Math.random() * Math.min(3, list.length))];
        pts.push(cur);
      }
      let dist = 0, prev = p;
      for (const q of pts) { dist += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
      m = { type, title: '🏁 Checkpoint Run', targets: pts.map((q, i) => ({ ...q, r: 110, label: `Checkpoint ${i + 1}/6: ${q.name}` })), time: dist / 230 + 25, reward: Math.round((2000 + dist * 0.7) / 100) * 100 };
    } else if (type === 'boat') {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push({ x: (87 + Math.random() * 10) * T, y: (6 + i * 10 + Math.random() * 4) * T, r: 110, name: 'buoy' });
      if (Math.random() < 0.5) pts.reverse();
      pts.forEach((q, i) => (q.label = `Buoy ${i + 1}/6`));
      m = { type, title: '🚤 Boat Run', targets: pts, time: 75, reward: 6000 };
    } else if (type === 'stars') {
      Game.toast(`Stars found: ${this.starsFound()}/25. Look on the minimap for hints!`);
      Game.showStarHint = true;
      return true;
    }
    m.maxTime = m.time;
    m.step = 0;
    this.active = m;
    document.getElementById('mission').classList.add('show');
    this.updatePanel();
    Game.toast(`Mission started: ${m.title}`);
    return true;
  },

  complete() {
    const m = this.active;
    const bonus = Math.round((m.time / m.maxTime) * m.reward * 0.3 / 100) * 100;
    Game.save.money += m.reward + bonus;
    Game.save.missions = (Game.save.missions || 0) + 1;
    Game.store();
    Game.updateHud();
    const p = this.pos();
    FX.confetti(p.x, p.y);
    Sound.win();
    Game.toast(`Mission complete! +${money(m.reward)}${bonus ? ` (+${money(bonus)} speed bonus)` : ''} 🎉`);
    this.stop();
  },

  fail(why) {
    Sound.thud();
    Game.toast(`Mission failed: ${why}`);
    this.stop();
  },

  stop() {
    this.active = null;
    document.getElementById('mission').classList.remove('show');
  },

  updatePanel() {
    const m = this.active;
    if (!m) return;
    const t = m.targets[m.step];
    const p = this.pos();
    const dist = Math.round(Math.hypot(p.x - t.x, p.y - t.y) / T * 2);
    const el = document.getElementById('mission');
    const html = `<b>${m.title}</b><span>${t.label}</span><span class="row"><em class="${m.time < 10 ? 'hurry' : ''}">⏱ ${Math.ceil(m.time)}s</em><em>📍 ${dist} m</em><em>💰 ${money(m.reward)}</em></span>`;
    if (el.innerHTML !== html) el.innerHTML = html;
  },

  // world markers: mission target beams, stars and mission givers
  draw(ctx, cam, time) {
    for (const g of GIVERS) {
      if (g.x < cam.x - 60 || g.x > cam.x + cam.w + 60 || g.y < cam.y - 60 || g.y > cam.y + cam.h + 60) continue;
      ctx.fillStyle = 'rgba(255,214,0,0.25)';
      ctx.beginPath(); ctx.arc(g.x, g.y, 30 + Math.sin(time * 3) * 3, 0, Math.PI * 2); ctx.fill();
      drawPerson(ctx, g.x, g.y, Math.PI / 2, Math.sin(time) * 0.4, g.look, 1.25);
      // floating "!" marker
      const by = g.y - 44 + Math.sin(time * 3) * 4;
      ctx.fillStyle = '#ffd600';
      ctx.beginPath(); ctx.arc(g.x, by, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(g.type === 'stars' ? '★' : '!', g.x, by + 6);
      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(g.name, g.x, g.y + 34);
      ctx.fillText(g.name, g.x, g.y + 34);
    }
    const found = Game.save.stars || [];
    this.stars.forEach((s, i) => {
      if (found.includes(i)) return;
      if (s.x < cam.x - 40 || s.x > cam.x + cam.w + 40 || s.y < cam.y - 40 || s.y > cam.y + cam.h + 40) return;
      const bob = Math.sin(time * 3 + i) * 4;
      ctx.fillStyle = 'rgba(255,215,0,0.25)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, Math.PI * 2); ctx.fill();
      drawStar(ctx, s.x, s.y + bob, 15, time * 1.5 + i);
    });
    const m = this.active;
    if (m) {
      const t = m.targets[m.step];
      beam(ctx, t.x, t.y, t.r, time, m.type === 'delivery' && m.step === 0 ? '📦' : m.type === 'taxi' && m.step === 0 ? '🧍' : '');
      const n = m.targets[m.step + 1];
      if (n && (m.type === 'rings' || m.type === 'boat')) {
        ctx.globalAlpha = 0.35;
        beam(ctx, n.x, n.y, n.r * 0.7, time, '');
        ctx.globalAlpha = 1;
      }
    }
  },
};

function drawStar(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
  g.addColorStop(0, '#fff9c4');
  g.addColorStop(1, '#ffb300');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#ff8f00';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// A glowing target ring with a light beam
function beam(ctx, x, y, r, time, icon) {
  const pulse = 1 + Math.sin(time * 4) * 0.06;
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * pulse);
  g.addColorStop(0, 'rgba(0,229,255,0.05)');
  g.addColorStop(0.8, 'rgba(0,229,255,0.35)');
  g.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,229,255,0.9)';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = -time * 40;
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  if (icon) {
    ctx.font = '28px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(icon, x, y + 10 + Math.sin(time * 3) * 4);
  }
}

// ------------------------------------------------------------ tutorial
const Tutorial = {
  step: -1,
  steps: [
    { text: 'Welcome to <b>Racing City</b>! Hold <span class="key">W</span> or <b>GAS</b> to drive forward.', done: () => Math.abs(Game.car.speed) > 120 },
    { text: 'Steer with <span class="key">A</span> <span class="key">D</span> or the <b>joystick</b>. Drive into the glowing circle.', target: () => ({ x: 15.5 * T, y: 25 * T, r: 90 }), reach: true },
    { text: 'Zoom the camera with the <b>mouse wheel</b>, <span class="key">+</span> <span class="key">−</span>, a <b>pinch</b>, or the 🔍 buttons.', done: () => Math.abs(Game.userZoom - 1) > 0.15 },
    { text: 'Press <span class="key">F</span> or the <b>🚶 OUT</b> button to get out of your car.', done: () => Game.onFoot },
    { text: 'Walk to <b>Delivery Dan</b> (yellow ! marker) and press <span class="key">E</span> / <b>ACTION</b> to talk.', target: () => ({ x: GIVERS[0].x, y: GIVERS[0].y, r: 50 }), done: () => Tutorial.talked },
    { text: 'Walk back to your car and press <span class="key">F</span> to get in.', done: () => !Game.onFoot },
    { text: 'Drive to the <b>Racing Area</b> (red pad near the stadium) and press <span class="key">E</span>.', target: () => { const z = City.zones.find((q) => q.id === 'race'); return { x: z.x + z.w / 2, y: z.y + z.h / 2, r: 120 }; }, done: () => Tutorial.sawRaces },
  ],
  talked: false,
  sawRaces: false,

  start() {
    this.step = 0;
    this.talked = false;
    this.sawRaces = false;
    this.render();
  },
  skip() {
    this.step = -1;
    Game.save.tutorialDone = true;
    Game.store();
    this.render();
  },
  update() {
    if (this.step < 0) return;
    const s = this.steps[this.step];
    let ok = false;
    if (s.reach) {
      const t = s.target();
      const p = Missions.pos();
      ok = Math.hypot(p.x - t.x, p.y - t.y) < t.r;
    } else ok = s.done();
    if (ok) {
      Sound.beep(990);
      this.step++;
      if (this.step >= this.steps.length) {
        this.step = -1;
        Game.save.tutorialDone = true;
        Game.save.money += 2000;
        Game.store();
        Game.updateHud();
        FX.confetti(Missions.pos().x, Missions.pos().y);
        Sound.win();
        Game.toast('Tutorial complete! +$2,000 🎉');
      }
      this.render();
    }
  },
  target() {
    if (this.step < 0) return null;
    const s = this.steps[this.step];
    return s.target ? s.target() : null;
  },
  render() {
    const el = document.getElementById('tutorial');
    if (this.step < 0) { el.classList.remove('show'); return; }
    el.innerHTML = `<div class="tstep">Tutorial ${this.step + 1}/${this.steps.length}</div><div>${this.steps[this.step].text}</div><button id="tut-skip">Skip</button>`;
    el.classList.add('show');
    el.querySelector('#tut-skip').onclick = () => this.skip();
  },
};
