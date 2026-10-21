// Online multiplayer. Everyone who has the game's link open at the same time
// shares one city: you see each other drive and walk around, send emojis,
// and can race each other in race lobbies.
// It uses the claude.ai "room" capability; anywhere else the game is single player.

const EMOTES = ['👋', '😂', '😎', '🔥', '🏁', '❤️'];
const PLAYER_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff7043', '#00acc1', '#f06292'];

const MP = {
  room: null,
  available: false,
  peers: [],
  smooth: new Map(), // peer -> smoothed position
  lastSend: 0,
  emoteId: 0,
  emote: '',
  seenEmotes: new Map(),
  name: '',
  color: '',
  lobby: null, // { room, track, lastGo, go }

  async init() {
    try {
      this.name = localStorage.getItem('rc-name') || '';
      this.color = localStorage.getItem('rc-color') || '';
    } catch (e) { /* no storage */ }
    if (!this.name) this.name = 'Racer ' + Math.floor(100 + Math.random() * 900);
    if (!this.color) this.color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    this.updateBadge();
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try { this.room = await window.claude.use('room'); } catch (e) { this.room = null; }
    if (!this.room) return;
    this.available = true;
    this.room.onPeers((ch) => {
      this.peers = ch.peers;
      for (const p of ch.joined) if (!p.isMe && p.presence && p.presence.n) Game.toast(`👋 ${this.clean(p.presence.n)} joined Racing City!`);
      this.updateBadge();
      if (Game.menuOpen && Game.menuKind === 'players') Game.openPlayers();
    }, () => { this.available = false; this.updateBadge(); });
    this.updateBadge();
  },

  saveProfile(name, color) {
    this.name = name.trim().slice(0, 16) || this.name;
    if (color) this.color = color;
    try { localStorage.setItem('rc-name', this.name); localStorage.setItem('rc-color', this.color); } catch (e) { /* ignore */ }
  },

  clean(s) {
    return String(s || 'Racer').replace(/[<>&"]/g, '').slice(0, 16);
  },

  others() {
    return this.peers.filter((p) => !p.sameTab && p.kind === 'viewer' && p.presence && typeof p.presence.x === 'number');
  },

  updateBadge() {
    const el = document.getElementById('online');
    if (!el) return;
    if (!this.available) { el.textContent = '👥 Solo'; el.title = 'Multiplayer works on the shared play link'; return; }
    const n = this.peers.filter((p) => p.kind === 'viewer').length || 1;
    el.textContent = `👥 ${n} online`;
  },

  // Send where we are ~15 times a second
  tick(now) {
    if (!this.available || now - this.lastSend < 66) return;
    this.lastSend = now;
    const g = Game;
    const p = g.onFoot ? People.walker : g.car;
    const data = {
      n: this.name, c: this.color,
      md: g.mode === 'city' ? 'c' : g.mode === 'race' ? 'r' : 'd',
      f: g.onFoot ? 1 : 0,
      v: g.car ? g.car.v.id : 0,
      vc: g.car ? g.car.color : '#fff',
      x: Math.round(p.x), y: Math.round(p.y),
      a: Math.round((g.onFoot ? People.walker.dir : g.car.a) * 100) / 100,
      s: g.car ? Math.round(g.car.speed) : 0,
      st: g.onFoot ? Math.round(People.walker.step * 10) / 10 : 0,
      e: this.emote, ei: this.emoteId,
    };
    this.room.presence(data).catch(() => {});
    if (this.lobby) {
      const r = g.race;
      const lp = { n: this.name, c: this.color, v: g.car ? g.car.v.id : 0, vc: g.car ? g.car.color : '#fff', ready: !!this.lobby.ready, go: this.lobby.go || null };
      if (r && r.mp) Object.assign(lp, { x: Math.round(g.car.x), y: Math.round(g.car.y), a: Math.round(g.car.a * 100) / 100, s: Math.round(g.car.speed), prog: Math.round(r.progress), ft: r.done ? Math.round(r.t * 100) / 100 : null, rgo: r.go });
      this.lobby.room.presence(lp).catch(() => {});
    }
  },

  sendEmote(e) {
    this.emote = e;
    this.emoteId++;
    this.myEmoteUntil = Game.time + 3;
  },

  // Smoothly follow other players' positions
  smoothed(p, dt) {
    const pr = p.presence;
    let s = this.smooth.get(p.peer);
    if (!s || Math.hypot(s.x - pr.x, s.y - pr.y) > 500) { s = { x: pr.x, y: pr.y, a: pr.a || 0 }; this.smooth.set(p.peer, s); }
    const k = Math.min(1, dt * 12);
    s.x += (pr.x - s.x) * k;
    s.y += (pr.y - s.y) * k;
    let da = (pr.a || 0) - s.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    s.a += da * k;
    if (pr.ei !== undefined && this.seenEmotes.get(p.peer) !== pr.ei) {
      this.seenEmotes.set(p.peer, pr.ei);
      if (pr.e && pr.ei > 0) s.emoteUntil = Game.time + 3;
    }
    return s;
  },

  cityPlayers(dt) {
    if (!this.available || Game.mode !== 'city') return [];
    return this.others().filter((p) => p.presence.md === 'c').map((p) => ({ p, s: this.smoothed(p, dt) }));
  },

  drawPlayers(ctx, list, time) {
    for (const { p, s } of list) {
      const pr = p.presence;
      const v = VEHICLES[pr.v] || VEHICLES[0];
      if (pr.f) drawPerson(ctx, s.x, s.y, s.a, pr.st || 0, { shirt: this.safeColor(pr.c), hair: '#3e2723', skin: '#f1c27d' });
      else drawVehicle(ctx, v, s.x, s.y, s.a, this.safeColor(pr.vc), { speed: Math.abs(pr.s || 0) });
      // name tag
      const name = this.clean(pr.n);
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      const w = ctx.measureText(name).width + 14;
      ctx.fillStyle = this.safeColor(pr.c);
      roundRect(ctx, s.x - w / 2, s.y - 46, w, 20, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(name, s.x, s.y - 31);
      if (s.emoteUntil > time && pr.e && EMOTES.includes(pr.e)) {
        ctx.font = '30px system-ui';
        ctx.fillText(pr.e, s.x, s.y - 54);
      }
    }
  },

  safeColor(c) {
    return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#90a4ae';
  },

  // ------------------------------------------------------------ race lobbies
  async joinLobby(track) {
    if (!this.available) return Game.toast('Multiplayer works on the shared play link.');
    try {
      const room = await this.room.join('race-' + track.id);
      this.lobby = { room, track, ready: false, go: null, lastGo: null, joinedAt: Date.now() };
      // remember any old start signal so we don't jump into a race that already began
      const leader = this.lobbyLeader();
      this.lobby.lastGo = leader && leader.presence.go;
      room.onPeers(() => {
        if (!this.lobby) return;
        this.checkStart();
        if (Game.menuOpen && Game.menuKind === 'lobby') Game.openLobby();
      });
      Game.openLobby();
    } catch (e) {
      Game.toast('Could not join the race lobby. Try again in a moment.');
    }
  },

  async leaveLobby() {
    const l = this.lobby;
    this.lobby = null;
    if (l) try { await l.room.leave(); } catch (e) { /* already gone */ }
  },

  lobbyPeers() {
    if (!this.lobby) return [];
    return this.lobby.room.peers().filter((p) => p.kind === 'viewer');
  },

  lobbyLeader() {
    const ps = this.lobbyPeers().slice().sort((a, b) => (a.peer < b.peer ? -1 : 1));
    return ps[0] || null;
  },

  iAmLeader() {
    const l = this.lobbyLeader();
    return !l || l.sameTab;
  },

  startForAll() {
    if (!this.lobby) return;
    this.lobby.go = Math.random().toString(36).slice(2, 10);
    this.lobby.lastGo = this.lobby.go;
    Game.startRace(this.lobby.track, { mp: true, go: this.lobby.go });
  },

  checkStart() {
    const l = this.lobby;
    if (!l || (Game.race && Game.race.mp)) return;
    const leader = this.lobbyLeader();
    if (!leader || leader.sameTab) return;
    const go = leader.presence && leader.presence.go;
    if (go && go !== l.lastGo && typeof go === 'string') {
      l.lastGo = go;
      l.go = go;
      Game.startRace(l.track, { mp: true, go });
    }
  },

  // other racers in my multiplayer race
  racers(dt) {
    const r = Game.race;
    if (!r || !r.mp || !this.lobby) return [];
    return this.lobbyPeers().filter((p) => !p.sameTab && p.presence && p.presence.rgo === r.go && typeof p.presence.x === 'number')
      .map((p) => ({ p, s: this.smoothed(p, dt) }));
  },
};
