// Controls: keyboard, on-screen touch controller (joystick + buttons),
// real game controllers (gamepads), camera zoom and optional tilt steering.

const Input = {
  keys: {},
  touch: { nitro: false, brake: false, up: false, down: false },
  stick: { x: 0, y: 0, active: false },
  pressed: {}, // one-shot presses this frame: action, back, garage, exit
  state: { steer: 0, gas: 0, brake: 0, nitro: false, handbrake: false, moveX: 0, moveY: 0 },
  padPrev: {},
  usingPad: false,
  zoomDelta: 0, // camera zoom requests (multiplied into Game.userZoom)
  tilt: { on: false, value: 0, seen: false },

  init() {
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.code]) {
        if (e.code === 'KeyE' || e.code === 'Enter') this.pressed.action = true;
        if (e.code === 'Escape') this.pressed.back = true;
        if (e.code === 'KeyG') this.pressed.garage = true;
        if (e.code === 'KeyM') this.pressed.mute = true;
        if (e.code === 'KeyF') this.pressed.exit = true;
        if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'KeyX') this.zoom(1.15);
        if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'KeyZ') this.zoom(1 / 1.15);
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
    window.addEventListener('blur', () => (this.keys = {}));

    // On-screen buttons
    document.querySelectorAll('[data-touch]').forEach((btn) => {
      const name = btn.dataset.touch;
      const down = (e) => {
        e.preventDefault();
        if (['action', 'garage', 'exit'].includes(name)) this.pressed[name] = true;
        else if (name === 'zoomin') this.zoom(1.2);
        else if (name === 'zoomout') this.zoom(1 / 1.2);
        else this.touch[name] = true;
        btn.classList.add('held');
      };
      const up = (e) => {
        e.preventDefault();
        if (name in this.touch) this.touch[name] = false;
        btn.classList.remove('held');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });

    // Joystick
    const base = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let stickId = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.stick.x = dx; this.stick.y = dy;
      knob.style.transform = `translate(${dx * r.width * 0.32}px, ${dy * r.height * 0.32}px)`;
    };
    base.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; base.setPointerCapture(e.pointerId); this.stick.active = true; move(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) move(e); });
    const release = (e) => { if (e.pointerId !== stickId) return; stickId = null; this.stick = { x: 0, y: 0, active: false }; knob.style.transform = ''; };
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);

    // Mouse wheel and pinch zoom on the game screen
    const canvas = document.getElementById('game');
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    const pts = new Map();
    let pinch = 0;
    canvas.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e); if (pts.size === 2) pinch = this.pinchDist(pts); });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e);
      if (pts.size === 2 && pinch) {
        const d = this.pinchDist(pts);
        this.zoom(d / pinch);
        pinch = d;
      }
    });
    const lift = (e) => { pts.delete(e.pointerId); pinch = 0; };
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);

    window.addEventListener('gamepadconnected', () => {
      this.usingPad = true;
      document.body.classList.add('has-pad');
      if (typeof Game !== 'undefined') Game.toast('🎮 Controller connected!');
    });
  },

  pinchDist(pts) {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
  },

  zoom(f) {
    this.zoomDelta = (this.zoomDelta || 1) * f;
  },

  // Tilt the phone like a steering wheel (where the browser allows it)
  async enableTilt(on) {
    this.tilt.on = on;
    if (!on) return true;
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { this.tilt.on = false; return false; }
      }
    } catch (e) { this.tilt.on = false; return false; }
    if (!this.tiltBound) {
      this.tiltBound = true;
      window.addEventListener('deviceorientation', (e) => {
        if (e.beta === null && e.gamma === null) return;
        this.tilt.seen = true;
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        // in landscape the steering tilt is the phone's beta axis
        let v = Math.abs(angle) === 90 ? e.beta * (angle === 90 ? 1 : -1) : e.gamma;
        this.tilt.value = Math.max(-1, Math.min(1, (v || 0) / 25));
      });
    }
    return true;
  },

  update() {
    const k = this.keys;
    const t = this.touch;
    const left = k.ArrowLeft || k.KeyA;
    const right = k.ArrowRight || k.KeyD;
    const up = k.ArrowUp || k.KeyW || t.up;
    const down = k.ArrowDown || k.KeyS || t.down;

    const s = this.state;
    s.steer = (right ? 1 : 0) - (left ? 1 : 0);
    s.gas = up ? 1 : 0;
    s.brake = down ? 1 : 0;
    s.nitro = !!(k.ShiftLeft || k.ShiftRight || t.nitro);
    s.handbrake = !!(k.Space || t.brake);
    s.moveX = s.steer;
    s.moveY = (down ? 1 : 0) - (up ? 1 : 0);

    if (this.stick.active) {
      if (Math.abs(this.stick.x) > 0.12) s.steer = this.stick.x;
      s.moveX = this.stick.x;
      s.moveY = this.stick.y;
      // pushing the stick up also drives forward, down brakes
      if (this.stick.y < -0.45) s.gas = Math.max(s.gas, Math.min(1, -this.stick.y * 1.3));
      if (this.stick.y > 0.6) s.brake = Math.max(s.brake, this.stick.y);
    }
    if (this.tilt.on && this.tilt.seen && !left && !right && !this.stick.active) s.steer = this.tilt.value;

    // Game controller (Xbox / PlayStation / any standard gamepad)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const b = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
      if (Math.abs(ax) > 0.15) s.steer = s.moveX = ax;
      if (Math.abs(ay) > 0.15) s.moveY = ay;
      if (b(14)) s.steer = s.moveX = -1;
      if (b(15)) s.steer = s.moveX = 1;
      if (b(12)) s.moveY = -1;
      if (b(13)) s.moveY = 1;
      s.gas = Math.max(s.gas, b(7)); // RT / R2
      s.brake = Math.max(s.brake, b(6)); // LT / L2
      if (b(1) > 0.5 || b(5) > 0.5) s.nitro = true; // B / Circle or RB
      if (b(2) > 0.5) s.handbrake = true; // X / Square
      // right stick up / down zooms the camera
      const rz = pad.axes[3] || 0;
      if (Math.abs(rz) > 0.3) this.zoom(1 - rz * 0.02);
      const edge = (i, name) => {
        const now = b(i) > 0.5;
        if (now && !this.padPrev[i]) this.pressed[name] = true;
        this.padPrev[i] = now;
      };
      edge(0, 'action'); // A / Cross
      edge(9, 'back'); // Start
      edge(3, 'garage'); // Y / Triangle
      edge(4, 'exit'); // LB / L1: get in / out
      edge(8, 'exit'); // Back / Select
      break;
    }
    // walking with gas / brake buttons on touch
    if (!this.stick.active && (t.up || t.down) && !s.moveY) s.moveY = t.up ? -1 : 1;
  },

  take(name) {
    const v = !!this.pressed[name];
    this.pressed[name] = false;
    return v;
  },

  takeZoom() {
    const z = this.zoomDelta || 1;
    this.zoomDelta = 1;
    return z;
  },

  clear() {
    this.pressed = {};
  },
};
