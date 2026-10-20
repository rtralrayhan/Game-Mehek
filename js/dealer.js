// Inside the Car Shop — laid out just like the drawing:
// Buy Cars desk (top left), Trading Area (top middle), Sell Cars desk (top right),
// the Lambo, BMW and Mercedes on display, and the Enter / Exit doors at the bottom.

const ROOM = { w: 1200, h: 800 };

const Dealer = {
  player: { x: 320, y: 740, dir: 0, step: 0 },
  spots: [
    { id: 'buy', name: 'Buy Cars', hint: 'Talk to the seller', x: 200, y: 215, r: 90 },
    { id: 'trade', name: 'Trading Area', hint: 'Trade your vehicle', x: 590, y: 215, r: 170 },
    { id: 'sell', name: 'Sell Cars', hint: 'Sell a vehicle', x: 990, y: 300, r: 90 },
    { id: 'show', name: 'Lambo', model: 'Lamborghini Huracan', hint: 'Look at the Lambo', x: 180, y: 430, r: 100 },
    { id: 'show', name: 'BMW', model: 'BMW M4', hint: 'Look at the BMW', x: 600, y: 560, r: 100 },
    { id: 'show', name: 'Mercedes', model: 'Mercedes-AMG GT', hint: 'Look at the Mercedes', x: 1000, y: 580, r: 100 },
    { id: 'exit', name: 'Exit', hint: 'Go back outside', x: 780, y: 770, r: 70 },
  ],
  solids: [
    [110, 110, 180, 80], // buy desk
    [900, 210, 190, 80], // sell desk
    [120, 400, 120, 60], // lambo stand
    [540, 530, 120, 60], // bmw stand
    [930, 550, 140, 70], // mercedes stand
  ],

  enter() {
    this.player.x = 320;
    this.player.y = 740;
    this.player.dir = -Math.PI / 2;
  },

  update(dt) {
    const p = this.player;
    const s = Input.state;
    let mx = s.moveX, my = s.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const speed = 260;
    const nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
    if (!this.blocked(nx, p.y)) p.x = nx;
    if (!this.blocked(p.x, ny)) p.y = ny;
    if (len > 0.1) { p.dir = Math.atan2(my, mx); p.step += dt * 10; }
    // walking out through the exit door
    if (p.y > ROOM.h - 25 && p.x > 700 && p.x < 860) return 'exit';
    return null;
  },

  blocked(x, y) {
    const r = 16;
    if (x < 40 + r || x > ROOM.w - 40 - r || y < 40 + r) return true;
    // bottom wall has two doors: Enter (240-400) and Exit (700-860)
    if (y > ROOM.h - 40 - r) {
      const inDoor = (x > 240 + r && x < 400 - r) || (x > 700 + r && x < 860 - r);
      if (!inDoor || y > ROOM.h - 5) return true;
    }
    for (const [sx, sy, sw, sh] of this.solids) {
      if (x > sx - r && x < sx + sw + r && y > sy - r && y < sy + sh + r) return true;
    }
    return false;
  },

  nearSpot() {
    const p = this.player;
    let best = null, bd = Infinity;
    for (const s of this.spots) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < s.r && d < bd) { bd = d; best = s; }
    }
    return best;
  },

  draw(ctx, time) {
    // floor
    ctx.fillStyle = '#fdfaf3';
    ctx.fillRect(0, 0, ROOM.w, ROOM.h);
    ctx.strokeStyle = '#efe7d6';
    ctx.lineWidth = 2;
    for (let x = 0; x <= ROOM.w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ROOM.h); ctx.stroke(); }
    for (let y = 0; y <= ROOM.h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ROOM.w, y); ctx.stroke(); }

    // walls
    ctx.fillStyle = '#37474f';
    ctx.fillRect(0, 0, ROOM.w, 40);
    ctx.fillRect(0, 0, 40, ROOM.h);
    ctx.fillRect(ROOM.w - 40, 0, 40, ROOM.h);
    ctx.fillRect(0, ROOM.h - 40, 240, 40);
    ctx.fillRect(400, ROOM.h - 40, 300, 40);
    ctx.fillRect(860, ROOM.h - 40, ROOM.w - 860, 40);
    // door mats
    ctx.fillStyle = '#a5d6a7';
    ctx.fillRect(240, ROOM.h - 40, 160, 40);
    ctx.fillStyle = '#ef9a9a';
    ctx.fillRect(700, ROOM.h - 40, 160, 40);
    ctx.fillStyle = '#1b1b1b';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER', 320, ROOM.h - 12);
    ctx.fillText('EXIT ⬇', 780, ROOM.h - 12);

    // Trading area: a big square with sparkly lines around it (like the drawing)
    const tx = 440, ty = 70, tw = 300, th = 280;
    ctx.save();
    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const side = i % 4, k = Math.floor(i / 4) / 15;
      const wob = 6 + 4 * Math.sin(time * 4 + i);
      let x1, y1, x2, y2;
      if (side === 0) { x1 = tx + k * tw; y1 = ty; x2 = x1; y2 = ty - wob; }
      if (side === 1) { x1 = tx + tw; y1 = ty + k * th; x2 = x1 + wob; y2 = y1; }
      if (side === 2) { x1 = tx + k * tw; y1 = ty + th; x2 = x1; y2 = y1 + wob; }
      if (side === 3) { x1 = tx; y1 = ty + k * th; x2 = x1 - wob; y2 = y1; }
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.fillStyle = '#fff8e1';
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = '#ff8f00';
    ctx.lineWidth = 5;
    ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = '#e65100';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('Trading area', tx + tw / 2, ty + 50);
    ctx.font = '60px system-ui, sans-serif';
    ctx.fillText('🔄', tx + tw / 2, ty + 160);
    ctx.restore();

    // Buy Cars desk + seller
    this.person(ctx, 200, 85, '#42a5f5', time);
    this.desk(ctx, 110, 110, 180, 80, '#8d6e63');
    this.sign(ctx, 200, 70, 'Buy cars', '#1565c0');
    // Sell Cars desk + seller
    this.person(ctx, 995, 185, '#ef5350', time + 1);
    this.desk(ctx, 900, 210, 190, 80, '#8d6e63');
    this.sign(ctx, 995, 165, 'Sell cars', '#c62828');

    // Display cars on stands
    this.stand(ctx, 120, 400, 120, 60, 'Lambo', '#64dd17', time, 0);
    this.stand(ctx, 540, 530, 120, 60, 'BMW', '#0288d1', time, 1);
    this.stand(ctx, 930, 550, 140, 70, 'Mercedes', '#bdbdbd', time, 2);

    // plants in the corners
    for (const [x, y] of [[70, 70], [ROOM.w - 70, 70], [70, ROOM.h - 80], [ROOM.w - 70, ROOM.h - 80]]) {
      ctx.fillStyle = '#6d4c41'; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(x - 4, y - 4, 8, 0, Math.PI * 2); ctx.fill();
    }

    // highlight the spot you are near
    const near = this.nearSpot();
    if (near && near.id !== 'exit') {
      ctx.strokeStyle = 'rgba(255,193,7,0.8)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(near.x, near.y, near.r * 0.6 + Math.sin(time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // the player
    const p = this.player;
    this.person(ctx, p.x, p.y, '#ab47bc', time, p);
  },

  desk(ctx, x, y, w, h, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 6, y + 6, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade(color, 0.2);
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    ctx.fillStyle = '#263238'; // computer
    ctx.fillRect(x + w / 2 - 18, y + 12, 36, 22);
  },

  sign(ctx, x, y, text, color) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = color;
    roundRect(ctx, x + 40, y - 14, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 50, y + 7);
    ctx.textAlign = 'center';
  },

  stand(ctx, x, y, w, h, name, color, time, k) {
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.75, h * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eceff1';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.68, h * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    const a = Math.sin(time * 0.6 + k) * 0.3;
    drawCarShape(ctx, cx, cy, a, color, w * 0.9, h * 0.6, true);
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, y - 26);
  },

  person(ctx, x, y, shirt, time, p) {
    const bob = p ? Math.sin(p.step) * 3 : Math.sin(time * 2) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 18, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    // arms (stick arms like the drawing)
    ctx.strokeStyle = '#ffcc80';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - 24, y + 2 + bob); ctx.lineTo(x + 24, y + 2 - bob); ctx.stroke();
    ctx.fillStyle = shirt;
    roundRect(ctx, x - 13, y - 6, 26, 24, 8); ctx.fill();
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.arc(x, y - 16, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.arc(x, y - 20, 11, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.arc(x - 4, y - 15, 2, 0, Math.PI * 2); ctx.arc(x + 4, y - 15, 2, 0, Math.PI * 2); ctx.fill();
  },
};
