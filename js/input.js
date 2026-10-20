// Controls: keyboard, on-screen touch controller and real game controllers (gamepads).

const Input = {
  keys: {},
  touch: { up: false, down: false, left: false, right: false, nitro: false, brake: false },
  pressed: {}, // one-shot presses this frame: action, back, garage
  state: { steer: 0, gas: 0, brake: 0, nitro: false, handbrake: false, moveX: 0, moveY: 0 },
  padPrev: {},
  usingPad: false,

  init() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.code]) {
        if (e.code === 'KeyE' || e.code === 'Enter') this.pressed.action = true;
        if (e.code === 'Escape') this.pressed.back = true;
        if (e.code === 'KeyG') this.pressed.garage = true;
        if (e.code === 'KeyM') this.pressed.mute = true;
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
    window.addEventListener('blur', () => (this.keys = {}));

    // On-screen controller buttons
    document.querySelectorAll('[data-touch]').forEach((btn) => {
      const name = btn.dataset.touch;
      const down = (e) => {
        e.preventDefault();
        if (name === 'action' || name === 'garage') this.pressed[name] = true;
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

    window.addEventListener('gamepadconnected', () => {
      this.usingPad = true;
      document.body.classList.add('has-pad');
      if (typeof Game !== 'undefined') Game.toast('🎮 Controller connected!');
    });
  },

  update() {
    const k = this.keys;
    const t = this.touch;
    let left = k.ArrowLeft || k.KeyA || t.left;
    let right = k.ArrowRight || k.KeyD || t.right;
    let up = k.ArrowUp || k.KeyW || t.up;
    let down = k.ArrowDown || k.KeyS || t.down;

    const s = this.state;
    s.steer = (right ? 1 : 0) - (left ? 1 : 0);
    s.gas = up ? 1 : 0;
    s.brake = down ? 1 : 0;
    s.nitro = !!(k.ShiftLeft || k.ShiftRight || t.nitro);
    s.handbrake = !!(k.Space || t.brake);
    s.moveX = s.steer;
    s.moveY = (down ? 1 : 0) - (up ? 1 : 0);

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
      const edge = (i, name) => {
        const now = b(i) > 0.5;
        if (now && !this.padPrev[i]) this.pressed[name] = true;
        this.padPrev[i] = now;
      };
      edge(0, 'action'); // A / Cross
      edge(9, 'back'); // Start
      edge(3, 'garage'); // Y / Triangle
      break;
    }
  },

  take(name) {
    const v = !!this.pressed[name];
    this.pressed[name] = false;
    return v;
  },

  clear() {
    this.pressed = {};
  },
};
