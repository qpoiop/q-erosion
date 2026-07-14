/* EROSION PROTOCOL — co-op base-defense. <erosion-game mode="solo|host|join" room="ABCD" diff="normal" waves="8" buildtime="25"> */
(() => {
if (customElements.get('erosion-game')) return;
const N = 26, TS = 2, HALF = N * TS / 2;
const ti = (gx, gz) => gz * N + gx;
const inG = (x, z) => x >= 0 && x < N && z >= 0 && z < N;
const w2g = v => Math.max(0, Math.min(N - 1, Math.floor((v + HALF) / TS)));
const g2w = g => g * TS - HALF + TS / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const PAL = { bg: 0x0b0c10, line: '#3a4052', panel: 'rgba(12,14,20,.82)', text: '#e8eaf0', dim: '#9aa3b5', cyan: '#25d8ff', cyanHex: 0x25d8ff, amber: '#ffb020', amberHex: 0xffb020, red: '#ff3b2a', redHex: 0xff3b2a, red7: '#c22212', red7Hex: 0xc22212 };
const FONT = "'Chakra Petch','Noto Sans KR',sans-serif";
const ETYPES = [
  { hp: 34, sp: 3.9, dmg: 10, sdmg: 22, xp: 8, sc: 2, r: .55 },   // tri rusher
  { hp: 130, sp: 1.9, dmg: 24, sdmg: 55, xp: 20, sc: 6, r: .75 }, // cube breaker
  { hp: 55, sp: 2.5, dmg: 0, sdmg: 18, xp: 15, sc: 4, r: .6, rng: true }, // hex gunner
  { hp: 700, sp: 1.5, dmg: 45, sdmg: 130, xp: 80, sc: 30, r: 1.1, boss: true }, // boss
];
const UPG = [
  { k: 'frate', n: '연사 계통', d: '발사 속도 +20%', f: p => p.frate *= 1.2 },
  { k: 'dmg', n: '위력 증폭', d: '탄환 피해 +22%', f: p => p.dmg *= 1.22 },
  { k: 'shots', n: '확산 사격', d: '탄환 +1 (피해 −15%)', f: p => { p.shots++; p.dmg *= .85; } },
  { k: 'pierce', n: '관통탄', d: '관통 +1', f: p => p.pierce++ },
  { k: 'speed', n: '기동 개선', d: '이동 속도 +10%', f: p => p.speed *= 1.1 },
  { k: 'regen', n: '자가 수복', d: '초당 HP +1.2', f: p => p.regen += 1.2 },
  { k: 'maxhp', n: '장갑 보강', d: '최대 HP +30, 즉시 회복', f: p => { p.maxhp += 30; p.hp = Math.min(p.maxhp, p.hp + 30); } },
  { k: 'scrap', n: '회수 장치', d: '처치 자원 +30%', f: p => p.scrapMul = (p.scrapMul || 1) * 1.3 },
];
const SHOP = [
  { id: 'php', c: '캐릭터', n: '장갑 보강', d: '최대 HP +25', cost: 30, per: true, f: p => { p.maxhp += 25; p.hp += 25; } },
  { id: 'pspd', c: '캐릭터', n: '구동계 개선', d: '이동 속도 +8%', cost: 30, per: true, f: p => p.speed *= 1.08 },
  { id: 'pdmg', c: '캐릭터', n: '화력 증강', d: '공격력 +12%', cost: 35, per: true, f: p => p.dmg *= 1.12 },
  { id: 'sskl', c: '스킬', n: '충격파 강화', d: '피해·반경 ↑, 쿨다운 ↓', cost: 40, per: true, max: 4, f: p => p.sklLv++ },
  { id: 'sdash', c: '스킬', n: '대시 모듈', d: '대시 쿨다운 −20%', cost: 30, per: true, max: 4, f: p => p.dashCd *= .8 },
  { id: 'gwall', c: '구조물', n: '벽 강화', d: '벽 내구 +40% (공용)', cost: 35, g: true, f: g => g.wallMul *= 1.4 },
  { id: 'gtur', c: '구조물', n: '포탑 화력', d: '포탑 공격 +25% (공용)', cost: 40, g: true, f: g => g.turMul *= 1.25 },
  { id: 'gcost', c: '구조물', n: '건설 자동화', d: '건설 비용 −15% (공용)', cost: 45, g: true, max: 3, f: g => g.costMul *= .85 },
];
const ITEMS = { bomb: { n: '융단 폭격' }, turret: { n: '즉석 포탑' }, kit: { n: '응급 키트' }, slow: { n: '지연 필드' } };
const ITEM_KEYS = Object.keys(ITEMS);
const DIFF = { easy: .75, normal: 1, hard: 1.35 };
const WALL_COST = 10, TURRET_COST = 30, WALL_HP = 140, TURRET_HP = 90;

class ErosionGame extends HTMLElement {
  connectedCallback() { this._dead = false; this._booted = false; setTimeout(() => { if (this.isConnected) this._init(); }, 0); }
  disconnectedCallback() { setTimeout(() => { if (!this.isConnected) this._destroy(); }, 0); }
  _destroy() {
    this._dead = true;
    cancelAnimationFrame(this._raf);
    clearInterval(this._helloIv); clearTimeout(this._banT); clearInterval(this._wdIv);
    if (this.net) { try { this.net.end(true); } catch (e) {} this.net = null; }
    window.removeEventListener('resize', this._onRz);
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    if (this.renderer) this.renderer.dispose();
    this.innerHTML = '';
  }
  _init() {
    if (this._dead || this._booted) return; this._booted = true;
    const A = k => this.getAttribute(k) || this[k];
    this.mode = A('mode') || 'solo';
    this.room = (A('room') || '').toUpperCase();
    this.diffMul = DIFF[A('diff')] ?? 1;
    this.maxWave = parseInt(A('waves')) || 8;
    this.buildTime = parseInt(A('buildtime')) || 25;
    this._buildDOM(); this._initAudio(); this._reset(); this._initThree(); this._bindInput();
    if (this.mode === 'solo') { this.phase = 'count'; this.countT = 3; }
    else { this.phase = 'wait'; this._initNet(); }
    this._last = performance.now();
    const loop = (t) => { if (this._dead) return; this._raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - this._last) / 1000); this._last = t; this._tick(dt); };
    this._raf = requestAnimationFrame(loop);
    this._wdIv = setInterval(() => { if (this._dead) return; const now = performance.now(); if (now - this._last > 450) { const dt = Math.min(.05, (now - this._last) / 1000); this._last = now; this._tick(dt); } }, 500);
  }
  /* ---------- state ---------- */
  _reset() {
    const mk = (x, z) => ({ x, z, a: 0, hp: 100, maxhp: 100, speed: 6, dmg: 12, frate: 3, shots: 1, pierce: 0, regen: 0, dashCd: 3.5, sklLv: 1, sklT: 0, scrapMul: 1, fireT: 0, dashT: 0, dashing: 0, down: false, downT: 0, revP: 0, item: null, taken: {}, buys: {}, lastSeen: 0 });
    this.me = mk(-2.5, 5); this.ally = mk(2.5, 5);
    this.allyOn = this.mode === 'solo';
    this.occ = new Uint8Array(N * N); this.shp = new Float32Array(N * N);
    this.enemies = new Map(); this.eid = 1; this.bullets = []; this.ebullets = []; this.fitems = [];
    this.tm = 0; this.xp = 0; this.lv = 1; this.kills = 0; this.pendUp = 0; this.slowT = 0;
    this.scrap = 50; this.g = { wallMul: 1, turMul: 1, costMul: 1 };
    this.coreHp = this.coreMax = 800;
    this.wave = 0; this.phT = 0; this.spawnQ = []; this.spawnT = 0;
    this.shotQ = []; this.over = null;
    this.buildMode = false; this.buildSel = 1; // 1 wall 2 turret 3 sell
    // core 2x2 at center
    this.coreTiles = [];
    for (let a = 12; a <= 13; a++)for (let b = 12; b <= 13; b++) { this.occ[ti(a, b)] = 3; this.coreTiles.push(ti(a, b)); }
    // gates at 4 mid-edges
    this.gates = [{ gx: 12, gz: 0 }, { gx: 12, gz: N - 1 }, { gx: 0, gz: 12 }, { gx: N - 1, gz: 12 }];
    this.gates.forEach(g => { for (let o = 0; o < 2; o++) { const x = g.gx + (g.gz === 0 || g.gz === N - 1 ? o : 0), z = g.gz + (g.gx === 0 || g.gx === N - 1 ? o : 0); this.occ[ti(x, z)] = 4; } g.x = g2w(g.gx + (g.gz === 0 || g.gz === N - 1 ? .5 : 0) * 1); g.z = g2w(g.gz) + (g.gx === 0 || g.gx === N - 1 ? TS / 2 : 0); });
    this._flow(); this._syncStruct();
    this._hudReset();
  }
  /* Dijkstra flow field toward core; structures = high cost (enemies can chew through) */
  _flow() {
    const dist = this.flowD = new Float32Array(N * N).fill(1e9);
    const q = [];
    for (const i of this.coreTiles) { dist[i] = 0; q.push(i); }
    // simple bucket-ish loop (costs small ints)
    const open = new Set(q);
    while (open.size) {
      let best = -1, bd = 1e9;
      for (const i of open) if (dist[i] < bd) { bd = dist[i]; best = i; }
      open.delete(best);
      const gx = best % N, gz = (best / N) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = gx + a, Z = gz + b; if (!inG(X, Z)) continue;
        const j = ti(X, Z), o = this.occ[j];
        const cost = 1 + (o === 1 || o === 2 ? 24 : 0);
        if (dist[best] + cost < dist[j] - 1e-6) { dist[j] = dist[best] + cost; open.add(j); }
      }
    }
  }
  _structHp(k) { return k === 1 ? WALL_HP * this.g.wallMul : TURRET_HP; }
  _place(i, k, silent) {
    this.occ[i] = k; this.shp[i] = this._structHp(k);
    this._flow(); this._syncStruct();
    if (!silent) { const gx = i % N, gz = (i / N) | 0; this._fx(g2w(gx), g2w(gz), false, PAL.cyanHex); this._beep(520, .08, 'square', .05); }
  }
  _remove(i) { this.occ[i] = 0; this.shp[i] = 0; this._flow(); this._syncStruct(); }
  _cost(k) { return Math.round((k === 1 ? WALL_COST : TURRET_COST) * this.g.costMul); }
  _canPlace(i) {
    if (this.occ[i]) return false;
    const gx = i % N, gz = (i / N) | 0, x = g2w(gx), z = g2w(gz);
    for (const e of this.enemies.values()) if (dist2(e.x, e.z, x, z) < 2.3) return false;
    if (dist2(this.me.x, this.me.z, x, z) < .9 || (this.allyOn && dist2(this.ally.x, this.ally.z, x, z) < .9)) return false;
    return true;
  }
  _tryBuild(i, k) { // local action (me)
    if (!this._canPlace(i)) return;
    const c = this._cost(k); if (this.scrap < c) { this._banner('자원 부족'); return; }
    if (this.isHostish()) { this.scrap -= c; this._place(i, k); if (this.mode !== 'solo') this._send({ t: 'blt', i, k, sc: this.scrap }); }
    else this._send({ t: 'bld', i, k });
  }
  _trySell(i) {
    const k = this.occ[i]; if (k !== 1 && k !== 2) return;
    if (this.isHostish()) { this.scrap += Math.round(this._cost(k) * .7); this._remove(i); if (this.mode !== 'solo') this._send({ t: 'slt', i, sc: this.scrap }); }
    else this._send({ t: 'sel', i });
  }
  _syncStruct() { this._structDirty = true; }
  /* ---------- three ---------- */
  _groundTex() {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#171a21'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 220; i++) { const w = rnd(30, 160), h = rnd(30, 160); x.fillStyle = `rgba(${20 + rnd(0, 14) | 0},${23 + rnd(0, 14) | 0},${30 + rnd(0, 16) | 0},.55)`; x.fillRect(rnd(0, 1024), rnd(0, 1024), w, h); }
    x.strokeStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 90; i++) { x.beginPath(); const a = rnd(0, 1024), b = rnd(0, 1024); x.moveTo(a, b); x.lineTo(a + rnd(-90, 90), b + rnd(-90, 90)); x.stroke(); }
    const step = 1024 / N;
    x.strokeStyle = 'rgba(90,100,130,.42)'; x.lineWidth = 2;
    for (let i = 0; i <= N; i++) { x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * step); x.lineTo(1024, i * step); x.stroke(); }
    x.strokeStyle = 'rgba(120,135,175,.5)'; x.lineWidth = 4; x.strokeRect(2, 2, 1020, 1020);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  _initThree() {
    const T = THREE;
    this.scene = new T.Scene(); this.scene.background = new T.Color(PAL.bg);
    this.scene.fog = new T.FogExp2(PAL.bg, .011);
    this.cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 300);
    this.camF = new T.Vector3(0, 0, 2);
    this.renderer = new T.WebGLRenderer({ canvas: this.cv, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    const mobile = Math.min(innerWidth, innerHeight) < 700;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
    const hemi = new T.HemisphereLight(0x93a5cc, 0x07070c, .7); this.scene.add(hemi);
    const dir = new T.DirectionalLight(0xdfe8ff, 1.15); dir.position.set(22, 34, 12); dir.castShadow = true;
    dir.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    dir.shadow.camera.left = -34; dir.shadow.camera.right = 34; dir.shadow.camera.top = 34; dir.shadow.camera.bottom = -34; dir.shadow.camera.far = 90; dir.shadow.bias = -.0006;
    this.scene.add(dir);
    const rim = new T.DirectionalLight(0x2a3552, .5); rim.position.set(-18, 12, -20); this.scene.add(rim);
    const gnd = new T.Mesh(new T.PlaneGeometry(N * TS, N * TS), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .55, map: this._groundTex() }));
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; this.scene.add(gnd); this.gnd = gnd;
    const apron = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x0a0b0f, roughness: .9, metalness: .2 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -.06; apron.receiveShadow = true; this.scene.add(apron);
    // perimeter walls with gate cuts
    const wallMat = new T.MeshStandardMaterial({ color: 0x1a1d26, roughness: .4, metalness: .7 });
    const segLen = (N * TS - 4) / 2 - 2;
    const mkSeg = (x, z, w, d) => { const b = new T.Mesh(new T.BoxGeometry(w, 1.3, d), wallMat); b.position.set(x, .65, z); b.castShadow = b.receiveShadow = true; this.scene.add(b); };
    const off = segLen / 2 + 4;
    mkSeg(-off, -HALF - .4, segLen, .8); mkSeg(off, -HALF - .4, segLen, .8);
    mkSeg(-off, HALF + .4, segLen, .8); mkSeg(off, HALF + .4, segLen, .8);
    mkSeg(-HALF - .4, -off, .8, segLen); mkSeg(-HALF - .4, off, .8, segLen);
    mkSeg(HALF + .4, -off, .8, segLen); mkSeg(HALF + .4, off, .8, segLen);
    // monoliths
    const monoMat = new T.MeshStandardMaterial({ color: 0x121620, roughness: .6, metalness: .5 });
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + rnd(-.15, .15), r = HALF + rnd(8, 22);
      const h = rnd(4, 14), m = new T.Mesh(new T.BoxGeometry(rnd(1.4, 3.4), h, rnd(1.4, 3.4)), monoMat);
      m.position.set(Math.cos(a) * r, h / 2 - .5, Math.sin(a) * r); m.rotation.y = rnd(0, Math.PI); m.castShadow = true; this.scene.add(m);
    }
    // dust
    const pg = new T.BufferGeometry(), pts = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { pts[i * 3] = rnd(-HALF, HALF); pts[i * 3 + 1] = rnd(.3, 7); pts[i * 3 + 2] = rnd(-HALF, HALF); }
    pg.setAttribute('position', new T.BufferAttribute(pts, 3));
    this.dust = new T.Points(pg, new T.PointsMaterial({ color: 0x5a6a8a, size: .06, transparent: true, opacity: .5 }));
    this.scene.add(this.dust);
    // materials
    this.mBody = new T.MeshStandardMaterial({ color: 0x1b1e26, roughness: .35, metalness: .8 });
    this.mEnemy = new T.MeshStandardMaterial({ color: 0x191219, roughness: .45, metalness: .6 });
    this.mGlowRed = new T.MeshStandardMaterial({ color: 0x1a0605, emissive: PAL.redHex, emissiveIntensity: 1.1 });
    this.mGlowRed7 = new T.MeshStandardMaterial({ color: 0x140503, emissive: PAL.red7Hex, emissiveIntensity: .9 });
    this.mGlowCyan = new T.MeshStandardMaterial({ color: 0x06141a, emissive: PAL.cyanHex, emissiveIntensity: 1.4 });
    this.mGlowAmber = new T.MeshStandardMaterial({ color: 0x1a1206, emissive: PAL.amberHex, emissiveIntensity: 1.3 });
    this.mFlash = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 });
    this.mWallS = new T.MeshStandardMaterial({ color: 0x232836, roughness: .4, metalness: .75 });
    this.bulletG = new T.BoxGeometry(.6, .1, .1);
    this.ebulletG = new T.SphereGeometry(.16, 8, 8);
    // core (cyan crystal at center)
    const cg = new T.Group();
    const cb = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, .6, 8), this.mBody); cb.position.y = .3; cb.castShadow = cb.receiveShadow = true; cg.add(cb);
    const cry = new T.Mesh(new T.OctahedronGeometry(1.3), this.mGlowCyan); cry.scale.y = 1.9; cry.position.y = 2.8; cry.castShadow = true; cg.add(cry); cg.cry = cry;
    const ring = new T.Mesh(new T.TorusGeometry(2, .08, 8, 40), this.mGlowCyan); ring.position.y = 2.6; ring.rotation.x = Math.PI / 2.3; cg.add(ring); cg.ring = ring;
    const beam = new T.Mesh(new T.CylinderGeometry(.14, .34, 26, 8, 1, true), new T.MeshBasicMaterial({ color: PAL.cyanHex, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false }));
    beam.position.y = 13; cg.add(beam);
    const lamp = new T.PointLight(PAL.cyanHex, 1.6, 16); lamp.position.y = 3.4; cg.add(lamp); cg.lamp = lamp;
    cg.position.set(g2w(12) + TS / 2, 0, g2w(12) + TS / 2); this.scene.add(cg); this.coreMesh = cg;
    // gates (red rift portals)
    this.gateMs = this.gates.map(g => {
      const gr = new T.Group();
      const f1 = new T.Mesh(new T.BoxGeometry(.5, 3.4, .5), this.mEnemy); f1.position.set(-1.4, 1.7, 0); f1.castShadow = true; gr.add(f1);
      const f2 = f1.clone(); f2.position.x = 1.4; gr.add(f2);
      const top = new T.Mesh(new T.BoxGeometry(3.3, .5, .5), this.mEnemy); top.position.y = 3.4; gr.add(top);
      const rift = new T.Mesh(new T.PlaneGeometry(2.4, 3), new T.MeshBasicMaterial({ color: PAL.redHex, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      rift.position.y = 1.6; gr.add(rift); gr.rift = rift;
      const lamp2 = new T.PointLight(PAL.redHex, 1.4, 10); lamp2.position.y = 2; gr.add(lamp2);
      gr.position.set(g2w(g.gx) + (g.gz === 0 || g.gz === N - 1 ? TS / 2 : 0), 0, g2w(g.gz) + (g.gx === 0 || g.gx === N - 1 ? TS / 2 : 0));
      if (g.gx === 0 || g.gx === N - 1) gr.rotation.y = Math.PI / 2;
      this.scene.add(gr); return gr;
    });
    // players
    this.meG = this._mkPlayer(true); this.allyG = this._mkPlayer(false);
    this.scene.add(this.meG); this.scene.add(this.allyG);
    this.allyG.visible = this.allyOn;
    // ghost placement cursor
    this.ghost = new T.Mesh(new T.BoxGeometry(TS * .92, 1.4, TS * .92), new T.MeshBasicMaterial({ color: PAL.cyanHex, transparent: true, opacity: .3, depthWrite: false }));
    this.ghost.visible = false; this.scene.add(this.ghost);
    this.eMeshes = new Map(); this.bMeshes = []; this.sMeshes = new Map(); this.fxs = []; this.sparks = []; this.itemMs = [];
    this._onRz = () => {
      const w = this.clientWidth || innerWidth, h = this.clientHeight || innerHeight;
      this.renderer.setSize(w, h, false);
      const asp = w / h, vh = Math.max(26, 26 / asp);
      this.cam.left = -vh * asp / 2; this.cam.right = vh * asp / 2; this.cam.top = vh / 2; this.cam.bottom = -vh / 2;
      this.cam.updateProjectionMatrix();
      if (this.composer) this.composer.setSize(w, h);
    };
    if (T.EffectComposer && T.UnrealBloomPass) {
      this.composer = new T.EffectComposer(this.renderer);
      this.composer.addPass(new T.RenderPass(this.scene, this.cam));
      this.bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), .45, .5, .85);
      this.composer.addPass(this.bloom);
    }
    window.addEventListener('resize', this._onRz); this._onRz();
  }
  _mkPlayer(isMe) {
    const T = THREE, g = new T.Group();
    const accent = isMe ? this.mGlowCyan : this.mGlowAmber;
    const hull = new T.Mesh(new T.BoxGeometry(.8, .3, 1.25), this.mBody); hull.position.y = .5; hull.castShadow = true; g.add(hull);
    const nose = new T.Mesh(new T.BoxGeometry(.42, .22, .5), this.mBody); nose.position.set(0, .52, .78); nose.castShadow = true; g.add(nose);
    const canopy = new T.Mesh(new T.BoxGeometry(.34, .14, .42), accent); canopy.position.set(0, .68, .22); g.add(canopy);
    const wingG = new T.BoxGeometry(.5, .08, .6);
    const wl = new T.Mesh(wingG, this.mBody); wl.position.set(-.62, .46, -.2); wl.rotation.z = .18; wl.castShadow = true; g.add(wl);
    const wr = new T.Mesh(wingG, this.mBody); wr.position.set(.62, .46, -.2); wr.rotation.z = -.18; wr.castShadow = true; g.add(wr);
    const e1 = new T.Mesh(new T.BoxGeometry(.14, .14, .22), accent); e1.position.set(-.3, .46, -.72); g.add(e1);
    const e2 = e1.clone(); e2.position.x = .3; g.add(e2);
    const ring = new T.Mesh(new T.RingGeometry(.7, .86, 32), new T.MeshBasicMaterial({ color: isMe ? PAL.cyanHex : PAL.amberHex, transparent: true, opacity: isMe ? .55 : .35, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
    const lamp = new T.PointLight(isMe ? PAL.cyanHex : PAL.amberHex, .8, 5); lamp.position.y = .8; g.add(lamp);
    g.body = hull; g.accents = [canopy, e1, e2]; g.ring = ring; g.accentMat = accent;
    return g;
  }
  _eMesh(e) {
    const T = THREE, g = new T.Group();
    let body;
    if (e.ty === 0) {
      body = new T.Mesh(new T.ConeGeometry(.5, .95, 4), this.mEnemy); body.position.y = .55;
      const eye = new T.Mesh(new T.SphereGeometry(.14, 8, 8), this.mGlowRed); eye.position.set(0, .62, .3); g.add(eye);
    } else if (e.ty === 1) {
      body = new T.Mesh(new T.BoxGeometry(1.15, .8, 1.15), this.mEnemy); body.position.y = .45;
      const slit = new T.Mesh(new T.BoxGeometry(1.2, .12, .16), this.mGlowRed); slit.position.set(0, .58, .5); g.add(slit);
      const cap = new T.Mesh(new T.BoxGeometry(.7, .18, .7), this.mGlowRed7); cap.position.y = .92; g.add(cap);
    } else if (e.ty === 2) {
      body = new T.Mesh(new T.CylinderGeometry(.5, .58, .55, 6), this.mEnemy); body.position.y = .42;
      const halo = new T.Mesh(new T.TorusGeometry(.55, .05, 6, 24), this.mGlowRed); halo.position.y = .95; halo.rotation.x = Math.PI / 2; g.add(halo);
    } else { // boss
      body = new T.Mesh(new T.BoxGeometry(2, 1.5, 2), this.mEnemy); body.position.y = .85;
      const crown = new T.Mesh(new T.OctahedronGeometry(.6), this.mGlowRed); crown.position.y = 2.1; g.add(crown);
      const band = new T.Mesh(new T.BoxGeometry(2.1, .2, 2.1), this.mGlowRed7); band.position.y = .85; g.add(band);
      const lamp = new T.PointLight(PAL.redHex, 1.2, 8); lamp.position.y = 2; g.add(lamp);
    }
    body.castShadow = true; g.add(body); g.body = body;
    this.scene.add(g); return g;
  }
  _sMesh(k) { // structure mesh
    const T = THREE, g = new T.Group();
    if (k === 1) {
      const b = new T.Mesh(new T.BoxGeometry(TS * .92, 1.5, TS * .92), this.mWallS); b.position.y = .75; b.castShadow = b.receiveShadow = true; g.add(b);
      const trim = new T.Mesh(new T.BoxGeometry(TS * .96, .1, TS * .96), this.mGlowCyan); trim.position.y = 1.53; g.add(trim); g.trim = trim;
    } else {
      const base = new T.Mesh(new T.BoxGeometry(.9, .5, .9), this.mWallS); base.position.y = .25; base.castShadow = true; g.add(base);
      const pod = new T.Mesh(new T.BoxGeometry(.55, .45, .8), this.mBody); pod.position.y = .75; pod.castShadow = true; g.add(pod); g.pod = pod;
      const gun = new T.Mesh(new T.BoxGeometry(.12, .12, .7), this.mGlowCyan); gun.position.set(0, .78, .5); pod.add ? g.add(gun) : 0; g.gun = gun;
      const lamp = new T.PointLight(PAL.cyanHex, .5, 4); lamp.position.y = 1.2; g.add(lamp);
    }
    this.scene.add(g); return g;
  }
  _fx(x, z, big, colHex) {
    const T = THREE;
    const m = new T.Mesh(new T.RingGeometry(.25, .38, 32), new T.MeshBasicMaterial({ color: colHex ?? 0xffffff, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .1, z); m.userData = { t: 0, big: big ? 4 : 1.6 }; this.scene.add(m); this.fxs.push(m);
    this._burst(x, z, colHex ?? 0xffffff, big ? 26 : 7, big ? 9 : 5);
    if (big) this.shake = Math.max(this.shake || 0, .5);
  }
  _burst(x, z, colHex, n, sp) {
    const T = THREE;
    for (let i = 0; i < n; i++) {
      let m = this._sparkPool && this._sparkPool.pop();
      if (!m) m = new T.Mesh(new T.BoxGeometry(.09, .09, .09), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      m.material.color.setHex(colHex); m.material.opacity = 1; m.visible = true;
      m.position.set(x, .5, z);
      const a = rnd(0, Math.PI * 2), v = rnd(sp * .3, sp);
      m.userData = { vx: Math.cos(a) * v, vy: rnd(2, 6), vz: Math.sin(a) * v, life: rnd(.3, .6) };
      this.scene.add(m); this.sparks.push(m);
    }
  }
  /* ---------- DOM / HUD ---------- */
  _buildDOM() {
    this.style.cssText = 'position:fixed;inset:0;z-index:50;display:block;background:#0b0c10;font-family:' + FONT + ';color:' + PAL.text + ';touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden';
    const H = (t, s, parent) => { const e = document.createElement(t); e.style.cssText = s; (parent || this).appendChild(e); return e; };
    this.H = H;
    this.cv = H('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block');
    this.vig = H('div', 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(255,40,20,.55);opacity:0;transition:opacity .12s');
    const hud = this.hud = H('div', 'position:absolute;inset:0;pointer-events:none');
    const pe = 'pointer-events:auto;';
    const panel = 'background:' + PAL.panel + ';border:1px solid ' + PAL.line + ';backdrop-filter:blur(6px);';
    // top-left players
    const tl = H('div', 'position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:6px;width:190px;' + panel + 'padding:10px', hud);
    this.pbar = {}; ['me', 'ally'].forEach(k => {
      const row = H('div', 'display:flex;flex-direction:column;gap:3px', tl);
      const lab = H('div', 'font-size:10px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;color:' + PAL.dim, row);
      const bo = H('div', 'height:10px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5)', row);
      const f = H('div', 'height:100%;width:100%;transition:width .15s', bo);
      this.pbar[k] = { lab, f, row };
    });
    this.pbar.me.lab.textContent = '나 · 유닛-A';
    // scrap
    const sc = H('div', 'display:flex;align-items:center;gap:6px;border-top:1px solid ' + PAL.line + ';padding-top:7px;margin-top:2px', tl);
    H('div', 'width:9px;height:9px;background:' + PAL.amber + ';box-shadow:0 0 8px ' + PAL.amber, sc);
    this.scEl = H('div', 'font:700 15px ' + FONT + ';color:' + PAL.amber, sc);
    H('div', 'font-size:10px;color:' + PAL.dim + ';letter-spacing:.1em', sc).textContent = '자원';
    // top-center: wave + core hp
    const tc = H('div', 'position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;' + panel + 'padding:8px 18px;min-width:210px', hud);
    this.wvEl = H('div', 'font-size:20px;font-weight:700;letter-spacing:.1em', tc);
    this.phEl = H('div', 'font-size:11px;font-weight:700;letter-spacing:.14em;color:' + PAL.dim, tc);
    const cb = H('div', 'width:210px;height:9px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5);margin-top:2px', tc);
    this.coreF = H('div', 'height:100%;width:100%;background:linear-gradient(90deg,' + PAL.cyan + ',#7ee8ff);box-shadow:0 0 10px ' + PAL.cyan, cb);
    this.coreLab = H('div', 'font-size:10px;font-weight:700;letter-spacing:.12em;color:' + PAL.dim, tc);
    // start-assault button (build phase, host/solo)
    this.goBtn = H('button', pe + 'font:700 12px ' + FONT + ';border:1px solid ' + PAL.red + ';background:rgba(255,59,42,.15);color:' + PAL.red + ';padding:6px 12px;cursor:pointer;letter-spacing:.08em;margin-top:4px;display:none', tc);
    this.goBtn.textContent = '습격 즉시 개시 ▶';
    this.goBtn.onclick = () => { if (this.isHostish() && this.phase === 'build') this.phT = Math.min(this.phT, 1); };
    // top-right
    const tr = H('div', 'position:absolute;top:10px;right:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px', hud);
    const trb = H('div', 'display:flex;gap:5px', tr);
    const smBtn = txt => { const b = H('button', pe + 'font:700 11px ' + FONT + ';border:1px solid ' + PAL.line + ';background:' + PAL.panel + ';color:' + PAL.text + ';padding:6px 9px;cursor:pointer;letter-spacing:.05em', trb); b.textContent = txt; return b; };
    this.sndBtn = smBtn('소리 ON');
    this.sndBtn.onclick = () => { this.mute = !this.mute; this.sndBtn.textContent = this.mute ? '소리 OFF' : '소리 ON'; };
    const xb = smBtn('나가기 ✕'); xb.style.borderColor = PAL.red7; xb.onclick = () => this._exit();
    this.mm = H('canvas', 'position:absolute;right:10px;top:48px;width:104px;height:104px;border:1px solid ' + PAL.line + ';background:rgba(5,6,9,.85)', hud);
    this.mm.width = 104; this.mm.height = 104;
    // bottom-center XP
    const bc = H('div', 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;' + panel + 'padding:6px 12px', hud);
    this.lvEl = H('div', 'font-size:13px;font-weight:700;letter-spacing:.08em;color:' + PAL.cyan, bc);
    const xpb = H('div', 'width:140px;height:6px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5)', bc);
    this.xpF = H('div', 'height:100%;width:0%;background:' + PAL.cyan + ';box-shadow:0 0 8px ' + PAL.cyan, xpb);
    // action buttons (right)
    const br = H('div', 'position:absolute;bottom:18px;right:14px;display:flex;gap:10px;align-items:flex-end', hud);
    const mkBtn = (label) => { const b = H('button', pe + 'width:68px;height:68px;border:1px solid ' + PAL.line + ';background:' + PAL.panel + ';color:' + PAL.text + ';font:700 12px ' + FONT + ';cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:7px;gap:2px;text-align:left;backdrop-filter:blur(6px)', br); b.textContent = label; return b; };
    this.itemBtn = mkBtn('아이템'); this.sklBtn = mkBtn('충격파'); this.dashBtn = mkBtn('대시');
    const press = (b, fn) => { b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
    press(this.dashBtn, () => this._dash(this.me)); press(this.itemBtn, () => this._useItem()); press(this.sklBtn, () => this._useSkill());
    // build bar (left)
    const bl = H('div', 'position:absolute;bottom:18px;left:14px;display:flex;flex-direction:column;gap:8px;align-items:flex-start', hud);
    this.chipRow = H('div', 'display:none;flex-direction:column;gap:6px', bl);
    this.chips = [];
    const mkChip = (label, sel) => { const b = H('button', pe + 'min-width:104px;border:1px solid ' + PAL.line + ';background:' + PAL.panel + ';color:' + PAL.text + ';font:700 12px ' + FONT + ';cursor:pointer;padding:9px 10px;text-align:left;backdrop-filter:blur(6px)', this.chipRow); b.textContent = label; press(b, () => { this.buildSel = sel; this._buildBarSync(); }); this.chips.push(b); return b; };
    this.wallChip = mkChip('벽', 1); this.turChip = mkChip('포탑', 2); this.sellChip = mkChip('판매 (70%)', 3);
    const blRow = H('div', 'display:flex;gap:8px', bl);
    this.buildBtn = H('button', pe + 'width:68px;height:68px;border:1px solid ' + PAL.cyan + ';background:' + PAL.panel + ';color:' + PAL.cyan + ';font:700 12px ' + FONT + ';cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:7px;text-align:left;backdrop-filter:blur(6px)', blRow);
    this.buildBtn.textContent = '건설';
    press(this.buildBtn, () => { this.buildMode = !this.buildMode; this._buildBarSync(); });
    this.shopBtn = H('button', pe + 'width:68px;height:68px;border:1px solid ' + PAL.amber + ';background:' + PAL.panel + ';color:' + PAL.amber + ';font:700 12px ' + FONT + ';cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:7px;text-align:left;backdrop-filter:blur(6px)', blRow);
    this.shopBtn.textContent = '연구';
    press(this.shopBtn, () => this._toggleShop());
    // banner / revive
    this.ban = H('div', 'position:absolute;top:86px;left:50%;transform:translateX(-50%);' + panel + 'color:' + PAL.text + ';font:700 13px ' + FONT + ';padding:8px 16px;letter-spacing:.08em;display:none;white-space:nowrap;border-left:3px solid ' + PAL.red, hud);
    this.revEl = H('div', 'position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;' + panel + 'padding:7px 14px;font:700 12px ' + FONT, hud);
    // level-up sheet
    this.upEl = H('div', 'position:absolute;left:50%;bottom:96px;transform:translateX(-50%);display:none;flex-direction:column;gap:6px;align-items:center;' + pe, hud);
    this.upTitle = H('div', 'background:' + PAL.red + ';color:#fff;font:700 12px ' + FONT + ';padding:5px 12px;letter-spacing:.1em;box-shadow:0 0 14px rgba(255,59,42,.5)', this.upEl);
    this.upRow = H('div', 'display:flex;gap:8px', this.upEl);
    // shop sheet
    this.shopEl = H('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;gap:8px;' + pe + panel + 'padding:16px;max-width:min(92vw,560px);max-height:76vh;overflow:auto', hud);
    // overlay
    this.ov = H('div', 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,10,.82);backdrop-filter:blur(4px);' + pe, hud);
    this.ovIn = H('div', 'max-width:430px;width:min(86vw,430px);border:1px solid ' + PAL.line + ';border-top:3px solid ' + PAL.red + ';background:rgba(13,15,21,.96);padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.6)', this.ov);
  }
  _buildBarSync() {
    this.chipRow.style.display = this.buildMode ? 'flex' : 'none';
    this.buildBtn.style.background = this.buildMode ? 'rgba(37,216,255,.18)' : PAL.panel;
    this.buildBtn.textContent = this.buildMode ? '건설 종료' : '건설';
    if (this.ghost) this.ghost.visible = false;
    const sel = this.buildSel;
    this.wallChip.textContent = `벽 · ${this._cost(1)}`; this.turChip.textContent = `포탑 · ${this._cost(2)}`;
    [this.wallChip, this.turChip, this.sellChip].forEach((c, i) => { const on = sel === i + 1; c.style.borderColor = on ? PAL.cyan : PAL.line; c.style.color = on ? PAL.cyan : PAL.text; c.style.background = on ? 'rgba(37,216,255,.14)' : PAL.panel; });
  }
  _obtn(primary) { return `font:700 13px ${FONT};border:1px solid ${primary ? PAL.red : PAL.line};background:${primary ? PAL.red : 'transparent'};color:${primary ? '#fff' : PAL.text};padding:10px 16px;cursor:pointer;letter-spacing:.04em`; }
  _hudReset() { if (this.upEl) { this.upEl.style.display = 'none'; this.shopEl.style.display = 'none'; this.ov.style.display = 'none'; this.buildMode = false; this._buildBarSync(); } }
  _banner(t, ms) { this.ban.textContent = t; this.ban.style.display = 'block'; clearTimeout(this._banT); this._banT = setTimeout(() => this.ban.style.display = 'none', ms || 2600); }
  _exit() { this.dispatchEvent(new CustomEvent('erosion-exit', { bubbles: true, composed: true })); }
  _overlay(html) { this.ov.style.display = 'flex'; this.ovIn.innerHTML = html; }
  /* ---------- shop ---------- */
  _buyCount(id) { return this.me.buys[id] || 0; }
  _shopCost(u) { return Math.round(u.cost * Math.pow(1.5, this._buyCount(u.id))); }
  _toggleShop() {
    if (this.shopEl.style.display === 'flex') { this.shopEl.style.display = 'none'; return; }
    this._renderShop(); this.shopEl.style.display = 'flex';
  }
  _renderShop() {
    const el = this.shopEl; el.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = `display:flex;align-items:center;gap:10px;font:700 14px ${FONT};letter-spacing:.1em`;
    head.innerHTML = `<span style="color:${PAL.amber}">연구 — 업그레이드</span><span style="margin-left:auto;color:${PAL.amber};font-size:13px">◈ ${Math.floor(this.scrap)}</span>`;
    const close = document.createElement('button'); close.textContent = '✕'; close.style.cssText = `border:1px solid ${PAL.line};background:transparent;color:${PAL.text};cursor:pointer;padding:2px 8px;font:700 12px ${FONT}`;
    close.onclick = () => this.shopEl.style.display = 'none'; head.appendChild(close);
    el.appendChild(head);
    let cat = '';
    for (const u of SHOP) {
      if (u.c !== cat) { cat = u.c; const h = document.createElement('div'); h.textContent = cat; h.style.cssText = `font:700 10px ${FONT};letter-spacing:.2em;color:${PAL.dim};margin-top:6px`; el.appendChild(h); }
      const cnt = this._buyCount(u.id), maxed = u.max && cnt >= u.max, cost = this._shopCost(u);
      const row = document.createElement('button');
      row.style.cssText = `display:flex;align-items:center;gap:10px;border:1px solid ${PAL.line};background:rgba(0,0,0,.3);color:${PAL.text};padding:9px 12px;cursor:${maxed ? 'default' : 'pointer'};text-align:left;font-family:${FONT};opacity:${maxed ? .45 : 1}`;
      row.innerHTML = `<span style="min-width:86px;font:700 13px ${FONT}">${u.n}${cnt ? ` <span style=\"color:${PAL.cyan};font-size:10px\">Lv${cnt + (u.id === 'sskl' ? 1 : 0)}</span>` : ''}</span><span style="flex:1;font-size:11px;color:${PAL.dim}">${u.d}</span><span style="font:700 13px ${FONT};color:${this.scrap >= cost ? PAL.amber : PAL.red}">${maxed ? 'MAX' : '◈ ' + cost}</span>`;
      if (!maxed) row.onclick = () => this._buy(u);
      el.appendChild(row);
    }
    const note = document.createElement('div');
    note.style.cssText = `font-size:10px;color:${PAL.dim};margin-top:4px`;
    note.textContent = '자원은 둘이 공유합니다 · 구조물 연구는 팀 전체 적용';
    el.appendChild(note);
  }
  _buy(u) {
    const cost = this._shopCost(u);
    if (this.scrap < cost) { this._beep(140, .1, 'sawtooth', .05); return; }
    if (this.isHostish()) {
      this.scrap -= cost;
      this.me.buys[u.id] = this._buyCount(u.id) + 1;
      if (u.per) u.f(this.me); else { u.f(this.g); if (this.mode !== 'solo') this._send({ t: 'gup', id: u.id, sc: this.scrap }); }
      if (this.mode === 'solo' && u.per && Math.random() < .8) { const b = SHOP.find(s => s.id === u.id); this.ally.buys[u.id] = (this.ally.buys[u.id] || 0); } // bot upgrades via wave bonus below
      this._beep(760, .1, 'square', .05); this._renderShop(); this._refreshShp();
    } else { this._send({ t: 'buy', id: u.id }); this._beep(500, .06, 'square', .04); }
  }
  _refreshShp() { for (let i = 0; i < N * N; i++) if (this.occ[i] === 1 && this.shp[i] > WALL_HP * this.g.wallMul) this.shp[i] = WALL_HP * this.g.wallMul; }
  /* ---------- audio ---------- */
  _initAudio() {
    this.mute = false; let ctx = null;
    this._beep = (f, dur, type, vol) => { if (this.mute) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol || .05, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur); } catch (e) {} };
  }
  /* ---------- input ---------- */
  _bindInput() {
    this.keys = {};
    this._kd = e => {
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft') { this._dash(this.me); e.preventDefault(); }
      if (e.code === 'KeyE') this._useItem();
      if (e.code === 'KeyQ') this._useSkill();
      if (e.code === 'KeyB') { this.buildMode = !this.buildMode; this._buildBarSync(); }
      if (e.code === 'Digit1') { this.buildSel = 1; this._buildBarSync(); }
      if (e.code === 'Digit2') { this.buildSel = 2; this._buildBarSync(); }
      if (e.code === 'Digit3') { this.buildSel = 3; this._buildBarSync(); }
    };
    this._ku = e => { this.keys[e.code] = false; };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    this.joyVec = { x: 0, z: 0 }; let jid = null, jx = 0, jy = 0;
    this.joy = this.H('div', 'position:absolute;left:0;top:0;width:104px;height:104px;border:1px solid ' + PAL.cyan + ';border-radius:50%;display:none;align-items:center;justify-content:center;opacity:.55;box-shadow:0 0 16px rgba(37,216,255,.25);pointer-events:none', this.hud);
    this.knob = this.H('div', 'width:38px;height:38px;background:' + PAL.cyan + ';border-radius:50%;box-shadow:0 0 12px ' + PAL.cyan, this.joy);
    this.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON' || this.ov.style.display === 'flex' || this.upEl.contains(e.target) || this.shopEl.contains(e.target)) return;
      if (this.buildMode) { this._buildAt(e.clientX, e.clientY); return; }
      if (jid !== null) return; jid = e.pointerId; jx = e.clientX; jy = e.clientY;
      this.joy.style.display = 'flex'; this.joy.style.left = (jx - 52) + 'px'; this.joy.style.top = (jy - 52) + 'px';
    });
    this.addEventListener('pointermove', e => {
      if (this.buildMode) { this._ghostAt(e.clientX, e.clientY); return; }
      if (e.pointerId !== jid) return;
      let dx = e.clientX - jx, dy = e.clientY - jy; const m = Math.hypot(dx, dy) || 1; const c = Math.min(m, 42);
      dx = dx / m * c; dy = dy / m * c;
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.joyVec.x = dx / 42; this.joyVec.z = dy / 42;
    });
    const end = e => { if (e.pointerId !== jid) return; jid = null; this.joyVec.x = this.joyVec.z = 0; this.joy.style.display = 'none'; this.knob.style.transform = ''; };
    this.addEventListener('pointerup', end); this.addEventListener('pointercancel', end);
  }
  _pick(cx, cy) { // screen -> tile index
    const r = this.getBoundingClientRect();
    const v = new THREE.Vector3((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0);
    const rc = this._rc = this._rc || new THREE.Raycaster();
    rc.setFromCamera(v, this.cam);
    const t = rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!t || Math.abs(t.x) > HALF || Math.abs(t.z) > HALF) return -1;
    return ti(w2g(t.x), w2g(t.z));
  }
  _ghostAt(cx, cy) {
    const i = this._pick(cx, cy);
    if (i < 0) { this.ghost.visible = false; return; }
    const gx = i % N, gz = (i / N) | 0;
    this.ghost.visible = true; this.ghost.position.set(g2w(gx), .7, g2w(gz));
    const ok = this.buildSel === 3 ? (this.occ[i] === 1 || this.occ[i] === 2) : (this._canPlace(i) && this.scrap >= this._cost(this.buildSel));
    this.ghost.material.color.setHex(ok ? (this.buildSel === 3 ? PAL.amberHex : PAL.cyanHex) : PAL.redHex);
  }
  _buildAt(cx, cy) {
    const i = this._pick(cx, cy); if (i < 0) return;
    this._ghostAt(cx, cy);
    if (this.buildSel === 3) this._trySell(i); else this._tryBuild(i, this.buildSel);
  }
  /* ---------- net ---------- */
  _initNet() {
    const tb = 'dc-erosion/v3/' + this.room;
    this.isHost = this.mode === 'host';
    this.pubT = tb + (this.isHost ? '/h' : '/g'); this.subT = tb + (this.isHost ? '/g' : '/h');
    const kick = `<div style="font:700 11px ${FONT};letter-spacing:.16em;color:${PAL.red}">`;
    this._overlay(this.isHost
      ? `${kick}방 개설됨 — 접속 대기</div><div style="font:700 54px ${FONT};letter-spacing:.18em;margin:6px 0 2px;color:${PAL.cyan};text-shadow:0 0 20px rgba(37,216,255,.5)">${this.room}</div><div style="font:400 13px ${FONT};line-height:1.6;color:${PAL.dim}">동료가 이 코드로 참가하면 자동으로 시작됩니다.<br>릴레이 서버에 연결 중…</div><div style="margin-top:16px"><button id="egCancel" style="${this._obtn(false)}">취소</button></div>`
      : `${kick}참가 중</div><div style="font:700 40px ${FONT};letter-spacing:.18em;margin:6px 0 2px;color:${PAL.cyan}">${this.room}</div><div style="font:400 13px ${FONT};line-height:1.6;color:${PAL.dim}">방장을 찾는 중… 상대가 방을 열어두었는지 확인하세요.</div><div style="margin-top:16px"><button id="egCancel" style="${this._obtn(false)}">취소</button></div>`);
    this.ovIn.querySelector('#egCancel').onclick = () => this._exit();
    const urls = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
    let ui = 0;
    const connect = () => {
      if (this._dead) return;
      const c = mqtt.connect(urls[ui], { clientId: 'eg_' + Math.random().toString(16).slice(2, 10), clean: true, connectTimeout: 8000, reconnectPeriod: 3000 });
      this.net = c;
      c.on('connect', () => { c.subscribe(this.subT); if (!this.isHost) { this._helloIv = setInterval(() => { if (this.phase === 'wait') this._send({ t: 'hello' }); else clearInterval(this._helloIv); }, 1500); this._send({ t: 'hello' }); } });
      c.on('message', (t, m) => { try { this._onMsg(JSON.parse(m.toString())); } catch (e) {} });
      c.on('error', () => { if (ui === 0 && !this._netUp) { ui = 1; try { c.end(true); } catch (e) {} connect(); } });
    };
    connect();
    this.sendPoseT = 0; this.sendStateT = 0; this.sendStT = 0;
  }
  _send(o) { if (this.net && this.net.connected) { this._netUp = true; this.net.publish(this.pubT, JSON.stringify(o)); } }
  _structPack() { const a = []; for (let i = 0; i < N * N; i++) if (this.occ[i] === 1 || this.occ[i] === 2) a.push([i, this.occ[i], Math.round(this.shp[i])]); return a; }
  _structUnpack(a) {
    const had = new Set();
    for (const [i, k, hp] of a) { had.add(i); if (this.occ[i] !== k) this.occ[i] = k; this.shp[i] = hp; }
    for (let i = 0; i < N * N; i++) if ((this.occ[i] === 1 || this.occ[i] === 2) && !had.has(i)) { this.occ[i] = 0; this.shp[i] = 0; }
    this._syncStruct();
  }
  _startOnline() {
    this.phase = 'count'; this.countT = 3; this.allyOn = true; this.allyG.visible = true;
    this.pbar.ally.lab.textContent = '동료 · ' + (this.isHost ? '유닛-B' : '유닛-A');
    this.ov.style.display = 'none';
  }
  _onMsg(m) {
    switch (m.t) {
      case 'hello': if (this.isHost) {
        if (this.phase === 'wait') { this._send({ t: 'welcome', diff: this.diffMul, waves: this.maxWave, bt: this.buildTime, st: this._structPack(), sc: this.scrap }); this._startOnline(); }
        else this._send({ t: 'busy' });
      } break;
      case 'welcome': if (!this.isHost && this.phase === 'wait') {
        clearInterval(this._helloIv);
        this.diffMul = m.diff; this.maxWave = m.waves; this.buildTime = m.bt; this.scrap = m.sc;
        this._structUnpack(m.st); this._startOnline();
      } break;
      case 'busy': if (!this.isHost) { this._overlay(`<div style="font:700 20px ${FONT}">방이 가득 찼습니다</div><div style="margin-top:14px"><button id="egCancel" style="${this._obtn(false)}">돌아가기</button></div>`); this.ovIn.querySelector('#egCancel').onclick = () => this._exit(); } break;
      case 'p': { const a = this.ally; a.lastSeen = this.tm; a.tx = m.x; a.tz = m.z; a.ta = m.a; a.hp = m.hp; a.maxhp = m.mh; a.down = m.dn; a.lv = m.lv;
        (m.sh || []).forEach(s => this._spawnBullet(s[0], s[1], s[2], s[3], { ghost: true, ally: true }));
        break; }
      case 'hit': if (this.isHost) { const e = this.enemies.get(m.id); if (e) this._dmgEnemy(e, m.d); } break;
      case 'bld': if (this.isHost) { if (this._canPlace(m.i)) { const c = this._cost(m.k); if (this.scrap >= c) { this.scrap -= c; this._place(m.i, m.k); this._send({ t: 'blt', i: m.i, k: m.k, sc: this.scrap }); } } } break;
      case 'blt': if (!this.isHost) { this.scrap = m.sc; this._place(m.i, m.k, true); this._fx(g2w(m.i % N), g2w((m.i / N) | 0), false, PAL.cyanHex); } break;
      case 'sel': if (this.isHost) { const k = this.occ[m.i]; if (k === 1 || k === 2) { this.scrap += Math.round(this._cost(k) * .7); this._remove(m.i); this._send({ t: 'slt', i: m.i, sc: this.scrap }); } } break;
      case 'slt': if (!this.isHost) { this.scrap = m.sc; this._remove(m.i); } break;
      case 'buy': if (this.isHost) { const u = SHOP.find(s => s.id === m.id); if (!u) break; const cost = Math.round(u.cost * Math.pow(1.5, (this._peerBuys = this._peerBuys || {}, this._peerBuys[m.id] || 0)));
        if (this.scrap >= cost) { this.scrap -= cost; this._peerBuys[m.id] = (this._peerBuys[m.id] || 0) + 1; if (u.g) { u.f(this.g); this._send({ t: 'gup', id: m.id, sc: this.scrap }); } else this._send({ t: 'byk', id: m.id, sc: this.scrap }); } } break;
      case 'byk': if (!this.isHost) { const u = SHOP.find(s => s.id === m.id); this.scrap = m.sc; if (u && u.per) { this.me.buys[u.id] = this._buyCount(u.id) + 1; u.f(this.me); this._beep(760, .1, 'square', .05); if (this.shopEl.style.display === 'flex') this._renderShop(); } } break;
      case 'gup': { const u = SHOP.find(s => s.id === m.id); if (this.isHost) break; this.scrap = m.sc; if (u) { u.f(this.g); this._banner('공용 연구 완료 — ' + u.n); if (this.shopEl.style.display === 'flex') this._renderShop(); } } break;
      case 'skl': if (this.isHost) this._shockwave(m.x, m.z, m.lv, false); else this._shockFx(m.x, m.z, m.lv); break;
      case 'use': this._applyItemFx(m.k, m.x, m.z, false); break;
      case 'dmg': if (!this.isHost) this._hurt(this.me, m.v); break;
      case 'eb': this.ebullets.push({ x: m.x, z: m.z, dx: m.dx, dz: m.dz, life: 3, ghost: !this.isHost }); break;
      case 'itm': if (!this.isHost) { if (m.who === 1) this.me.item = m.k; this.fitems = this.fitems.filter(f => f.id !== m.id); this._beep(700, .1); } break;
      case 'ban': if (!this.isHost) this._banner(m.s); break;
      case 's': if (!this.isHost) this._applyState(m); break;
      case 'end': if (!this.isHost) this._gameOver(m.win, m.why, true); break;
      case 'restart': if (!this.isHost) { this._reset(); this._startOnline(); } break;
    }
  }
  _applyState(m) {
    this.tm = m.tm; if (m.xp !== undefined) this._setXp(m.xp);
    this.scrap = m.sc; this.coreHp = m.core; this.wave = m.wv;
    const wasPhase = this.phase;
    if (this.phase !== 'over' && this.phase !== 'count' && m.ph) { if (m.ph !== this.phase) { this.phase = m.ph; if (m.ph === 'assault') this._banner('WAVE ' + this.wave + ' — 습격!'); else if (m.ph === 'build') { this._banner('준비 단계 — 건설·연구'); this._beep(700, .15, 'square', .05); } } this.phT = m.pt; }
    const seen = new Set();
    (m.en || []).forEach(a => { const [id, ty, x, z, hp] = a; seen.add(id); let e = this.enemies.get(id);
      if (!e) { e = { id, ty, x: x / 10, z: z / 10, tx: x / 10, tz: z / 10, hp, ghost: true }; this.enemies.set(id, e); }
      e.tx = x / 10; e.tz = z / 10; e.hp = hp; });
    for (const [id, e] of this.enemies) if (!seen.has(id)) { this._killFx(e); this.enemies.delete(id); }
    if (m.st) this._structUnpack(m.st);
    this.fitems = (m.itm || []).map(t => ({ id: t[0], k: t[1], x: t[2] / 10, z: t[3] / 10 }));
  }
  /* ---------- combat ---------- */
  _spawnBullet(x, z, dx, dz, o) {
    this.bullets.push({ x, z, dx, dz, life: .9, dmg: o.dmg || 0, pierce: o.pierce || 0, ghost: o.ghost, ally: o.ally, tur: o.tur });
  }
  _fire(p, tx, tz, mine) {
    const base = Math.atan2(tz - p.z, tx - p.x);
    for (let i = 0; i < p.shots; i++) {
      const off = (i - (p.shots - 1) / 2) * .12, a = base + off;
      const dx = Math.cos(a) * 19, dz = Math.sin(a) * 19;
      this._spawnBullet(p.x, p.z, dx, dz, { dmg: p.dmg, pierce: p.pierce, ghost: false, ally: !mine });
      if (mine) this.shotQ.push([+p.x.toFixed(1), +p.z.toFixed(1), +dx.toFixed(1), +dz.toFixed(1)]);
    }
    p.a = base;
  }
  _autoCombat(p, dt, mine) {
    if (p.down) return;
    p.fireT -= dt; if (p.fireT > 0) return;
    let best = null, bd = 110;
    for (const e of this.enemies.values()) { const d = dist2(p.x, p.z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
    if (best) { p.fireT = 1 / p.frate; this._fire(p, best.x, best.z, mine); }
  }
  _dmgEnemy(e, d) {
    e.hp -= d; e.flash = .12;
    if (e.hp <= 0 && !e.deadDone) {
      e.deadDone = true; this.kills++; this._killFx(e); this.enemies.delete(e.id);
      this._grantXp(ETYPES[e.ty].xp);
      this.scrap += ETYPES[e.ty].sc * (this.me.scrapMul || 1);
      if (Math.random() < .04 && this.fitems.length < 2) this.fitems.push({ id: this.eid++, k: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], x: e.x, z: e.z });
    }
  }
  _killFx(e) { this._fx(e.x, e.z, !!ETYPES[e.ty]?.boss, PAL.redHex); const m = this.eMeshes.get(e.id); if (m) { this.scene.remove(m); this.eMeshes.delete(e.id); } }
  isHostish() { return this.mode === 'solo' || this.isHost; }
  _grantXp(v) { this._setXp(this.xp + v); }
  _setXp(v) {
    this.xp = v;
    let need = 25 + this.lv * 18;
    while (this.xp >= need) { this.xp -= need; this.lv++; need = 25 + this.lv * 18; this.pendUp++; if (this.mode === 'solo') this._botUpgrade(); this._beep(600, .12, 'square', .06); this._beep(900, .18, 'square', .05); }
    if (this.pendUp > 0 && this.upEl.style.display === 'none' && !this.over) this._showUpgrades();
  }
  _showUpgrades() {
    const p = this.me;
    const pool = UPG.filter(u => !(u.once && p.taken[u.k]));
    const picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.upTitle.textContent = 'LV ' + this.lv + ' — 강화 선택' + (this.pendUp > 1 ? ' (+' + (this.pendUp - 1) + ' 대기)' : '');
    this.upRow.innerHTML = '';
    picks.forEach(u => {
      const c = document.createElement('button');
      c.style.cssText = `width:118px;border:1px solid ${PAL.line};border-top:2px solid ${PAL.cyan};background:${PAL.panel};color:${PAL.text};padding:10px;cursor:pointer;text-align:left;font-family:${FONT};display:flex;flex-direction:column;gap:4px;backdrop-filter:blur(6px)`;
      c.innerHTML = `<span style="font:700 9px ${FONT};letter-spacing:.14em;color:${PAL.cyan}">${u.k.toUpperCase()}</span><span style="font:700 14px ${FONT}">${u.n}</span><span style="font:400 11px ${FONT};line-height:1.45;color:${PAL.dim}">${u.d}</span>`;
      c.onclick = () => { u.f(p); p.taken[u.k] = 1; this.pendUp--; this.upEl.style.display = 'none'; this._beep(750, .08); if (this.pendUp > 0) this._showUpgrades(); };
      this.upRow.appendChild(c);
    });
    this.upEl.style.display = 'flex';
  }
  _botUpgrade() { const p = this.ally; const pool = UPG.filter(u => !(u.once && p.taken[u.k])); const u = pool[Math.floor(Math.random() * pool.length)]; u.f(p); p.taken[u.k] = 1; }
  _dash(p) {
    if (p.down || p.dashT > 0 || this.phase !== 'assault' && this.phase !== 'build') return;
    p.dashT = p.dashCd; p.dashing = .18; this._beep(300, .07, 'triangle', .04);
  }
  _useSkill() {
    const p = this.me;
    if (p.down || p.sklT > 0 || (this.phase !== 'assault' && this.phase !== 'build')) return;
    p.sklT = Math.max(6, 14 - p.sklLv);
    if (this.isHostish()) this._shockwave(p.x, p.z, p.sklLv, true);
    else { this._shockFx(p.x, p.z, p.sklLv); this._send({ t: 'skl', x: +p.x.toFixed(1), z: +p.z.toFixed(1), lv: p.sklLv }); }
  }
  _shockFx(x, z, lv) { this._fx(x, z, true, PAL.cyanHex); this.shake = Math.max(this.shake || 0, .5); this._beep(220, .25, 'sawtooth', .08); }
  _shockwave(x, z, lv, fx) {
    if (fx !== false) this._shockFx(x, z, lv);
    const r = 3.5 + lv * .5, dmg = 40 + lv * 20;
    for (const e of [...this.enemies.values()]) {
      if (dist2(x, z, e.x, e.z) < r * r) {
        const d = Math.sqrt(dist2(x, z, e.x, e.z)) || 1;
        e.x = clamp(e.x + (e.x - x) / d * 2.2, 1 - HALF, HALF - 1); e.z = clamp(e.z + (e.z - z) / d * 2.2, 1 - HALF, HALF - 1);
        this._dmgEnemy(e, dmg);
      }
    }
  }
  _useItem() {
    const p = this.me; if (!p.item || p.down || (this.phase !== 'assault' && this.phase !== 'build')) return;
    const k = p.item; p.item = null;
    this._applyItemFx(k, p.x, p.z, true);
    if (this.mode !== 'solo') this._send({ t: 'use', k, x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  }
  _applyItemFx(k, x, z, mine) {
    this._fx(x, z, true, k === 'bomb' ? 0xffffff : PAL.cyanHex); this._beep(500, .15, 'square', .06);
    if (k === 'bomb') { if (this.isHostish()) for (const e of [...this.enemies.values()]) if (dist2(x, z, e.x, e.z) < 36) this._dmgEnemy(e, 90); this._banner('융단 폭격'); }
    else if (k === 'turret') { if (this.isHostish()) { const i = ti(w2g(x), w2g(z)); const spots = [i, i + 1, i - 1, i + N, i - N].filter(j => j >= 0 && j < N * N && !this.occ[j]); if (spots.length) this._place(spots[0], 2); } }
    else if (k === 'kit') { if (mine) this.me.hp = this.me.maxhp; }
    else if (k === 'slow') { this.slowT = 5; this._banner('지연 필드 — 적 감속'); }
  }
  _hurt(p, v) {
    if (p.down || p.dashing > 0 || this.over) return;
    p.hp -= v; this._beep(140, .08, 'sawtooth', .05);
    if (p === this.me) { this.dmgFlash = 1; this.shake = Math.max(this.shake || 0, .35); }
    if (p.hp <= 0) { p.hp = 0; p.down = true; p.downT = 40; p.revP = 0; if (p === this.me) this._banner('쓰러짐 — 동료의 구조 대기'); }
  }
  /* ---------- waves (host) ---------- */
  _startBuild() {
    this.phase = 'build'; this.phT = this.wave === 0 ? this.buildTime + 10 : this.buildTime;
    const bonus = 30 + this.wave * 12; this.scrap += bonus;
    if (this.wave > 0) { this._banner(`WAVE ${this.wave} 방어 성공 — 자원 +${bonus}`); if (this.mode === 'solo' && Math.random() < .7) this._botUpgrade(); }
    else this._banner('준비 단계 — 벽과 포탑을 건설하라 (건설 버튼)', 4000);
    if (this.fitems.length < 2 && this.wave > 0) { const g = this.gates[Math.floor(Math.random() * 4)]; this.fitems.push({ id: this.eid++, k: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], x: rnd(-8, 8), z: rnd(-8, 8) }); }
  }
  _startAssault() {
    this.wave++; this.phase = 'assault';
    this._banner('WAVE ' + this.wave + ' — 습격!'); this._beep(180, .3, 'sawtooth', .07);
    const w = this.wave, q = [];
    const count = 7 + w * 4;
    for (let i = 0; i < count; i++) {
      let ty = 0;
      const r = Math.random();
      if (w >= 2 && r < .25) ty = 2; else if (w >= 3 && r < .45) ty = 1;
      q.push(ty);
    }
    if (w % 4 === 0) q.push(3);
    this.spawnQ = q; this.spawnT = .5;
  }
  _spawnLogic(dt) {
    if (!this.spawnQ.length) return;
    this.spawnT -= dt; if (this.spawnT > 0) return;
    this.spawnT = Math.max(.35, 1.1 - this.wave * .05);
    const ty = this.spawnQ.shift();
    const g = this.gates[Math.floor(Math.random() * 4)];
    const id = this.eid++;
    const hpMul = (1 + (this.wave - 1) * .22) * this.diffMul;
    this.enemies.set(id, { id, ty, x: g.x + rnd(-.5, .5), z: g.z + rnd(-.5, .5), hp: ETYPES[ty].hp * hpMul, cool: 0, shootT: rnd(0, 2) });
  }
  /* enemy AI: follow flow field; attack blocking structures / core / nearby players */
  _enemySim(dt) {
    const slow = this.slowT > 0 ? .5 : 1;
    const players = [this.me]; if (this.allyOn) players.push(this.ally);
    for (const e of this.enemies.values()) {
      const et = ETYPES[e.ty];
      let sp = et.sp * slow * this.diffMul * (et.boss ? 1 : 1);
      e.cool -= dt;
      // nearest live player
      let np = null, npd = 1e9; for (const p of players) { if (p.down) continue; const d = dist2(e.x, e.z, p.x, p.z); if (d < npd) { npd = d; np = p; } }
      // ranged behaviour
      if (et.rng && np && npd < 81) {
        const d = Math.sqrt(npd);
        if (d > 7) { e.x += (np.x - e.x) / d * sp * dt; e.z += (np.z - e.z) / d * sp * dt; }
        else if (d < 4.5) { e.x -= (np.x - e.x) / d * sp * dt; e.z -= (np.z - e.z) / d * sp * dt; }
        e.shootT -= dt;
        if (e.shootT <= 0) { e.shootT = 2.1; const a = Math.atan2(np.z - e.z, np.x - e.x); const dx = Math.cos(a) * 10, dz = Math.sin(a) * 10;
          this.ebullets.push({ x: e.x, z: e.z, dx, dz, life: 3 }); if (this.mode !== 'solo') this._send({ t: 'eb', x: +e.x.toFixed(1), z: +e.z.toFixed(1), dx: +dx.toFixed(1), dz: +dz.toFixed(1) }); }
        continue;
      }
      // melee player if adjacent
      if (np && npd < 1.3) { if (e.cool <= 0) { e.cool = .9; this._dealToPlayer(np, et.dmg * this.diffMul); } continue; }
      // flow move
      const gx = w2g(e.x), gz = w2g(e.z), here = ti(gx, gz);
      let bi = -1, bd = this.flowD[here];
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = gx + a, Z = gz + b; if (!inG(X, Z)) continue;
        const j = ti(X, Z); if (this.flowD[j] < bd) { bd = this.flowD[j]; bi = j; }
      }
      if (bi < 0) { // at core
        if (this.occ[here] === 3 || bd <= 1.5) { if (e.cool <= 0) { e.cool = 1; this._dmgCoreBy(et.dmg * this.diffMul, e); } }
        continue;
      }
      const o = this.occ[bi];
      const bx = g2w(bi % N), bz = g2w((bi / N) | 0);
      if (o === 1 || o === 2) { // blocked: attack structure
        if (e.cool <= 0) { e.cool = .8; this.shp[bi] -= et.sdmg * this.diffMul; this._burst(bx, bz, PAL.redHex, 4, 4); this._beep(190, .05, 'square', .02);
          if (this.shp[bi] <= 0) { this._fx(bx, bz, false, PAL.red7Hex); this._remove(bi); } }
        continue;
      }
      if (o === 3) { if (e.cool <= 0) { e.cool = 1; this._dmgCoreBy(et.dmg * this.diffMul * 2, e); } continue; }
      const dx = bx - e.x, dz = bz - e.z, d = Math.hypot(dx, dz) || 1;
      e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
      e.x = clamp(e.x, 1 - HALF, HALF - 1); e.z = clamp(e.z, 1 - HALF, HALF - 1);
    }
  }
  _dmgCoreBy(v, e) {
    this.coreHp -= v; this.shake = Math.max(this.shake || 0, .3);
    this._burst(this.coreMesh.position.x + rnd(-1, 1), this.coreMesh.position.z + rnd(-1, 1), PAL.cyanHex, 5, 4);
    if (!this._coreBanT || this.tm - this._coreBanT > 4) { this._coreBanT = this.tm; this._banner('⚠ 코어 피격!'); this._beep(120, .2, 'sawtooth', .07); }
    if (this.coreHp <= 0) { this.coreHp = 0; this._gameOver(false, '코어 파괴됨'); }
  }
  _dealToPlayer(p, v) {
    if (p === this.me) this._hurt(this.me, v);
    else if (this.mode === 'solo') this._hurt(this.ally, v);
    else this._send({ t: 'dmg', v: +v.toFixed(1) });
  }
  _turretSim(dt) {
    this._turCd = this._turCd || {};
    for (let i = 0; i < N * N; i++) {
      if (this.occ[i] !== 2) continue;
      const cd = (this._turCd[i] || 0) - dt; this._turCd[i] = cd;
      if (cd > 0) continue;
      const x = g2w(i % N), z = g2w((i / N) | 0);
      let best = null, bd = 90; for (const e of this.enemies.values()) { const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
      if (best) { this._turCd[i] = .3; const a = Math.atan2(best.z - z, best.x - x); this._spawnBullet(x, z, Math.cos(a) * 19, Math.sin(a) * 19, { dmg: 8 * this.g.turMul, tur: true }); }
    }
  }
  _pickupSim() {
    for (const f of [...this.fitems]) {
      const meN = dist2(f.x, f.z, this.me.x, this.me.z) < 1.7, alN = this.allyOn && dist2(f.x, f.z, this.ally.x, this.ally.z) < 1.7;
      if (meN && !this.me.down && !this.me.item) { this.me.item = f.k; this.fitems = this.fitems.filter(q => q !== f); this._beep(700, .1); if (this.mode !== 'solo') this._send({ t: 'itm', who: 0, id: f.id, k: f.k }); }
      else if (alN && !this.ally.down && this.mode !== 'solo') { this.fitems = this.fitems.filter(q => q !== f); this._send({ t: 'itm', who: 1, id: f.id, k: f.k }); }
      else if (alN && this.mode === 'solo' && !this.ally.item) { this.ally.item = f.k; this.fitems = this.fitems.filter(q => q !== f); }
    }
  }
  /* ---------- bot ally ---------- */
  _botSim(dt) {
    const b = this.ally, me = this.me;
    if (b.down) return;
    // defend: nearest enemy to core, else near player
    let th = null, bd = 1e9;
    const cx = this.coreMesh.position.x, cz = this.coreMesh.position.z;
    for (const e of this.enemies.values()) { const d = dist2(cx, cz, e.x, e.z); if (d < bd) { bd = d; th = e; } }
    let gx, gz;
    if (me.down) { gx = me.x; gz = me.z; }
    else if (th) { const d = Math.sqrt(dist2(b.x, b.z, th.x, th.z)) || 1; const keep = 6; gx = th.x + (b.x - th.x) / d * keep; gz = th.z + (b.z - th.z) / d * keep; }
    else { gx = me.x + 2.2; gz = me.z + 1.5; }
    const dx = gx - b.x, dz = gz - b.z, d = Math.hypot(dx, dz);
    if (d > .6) { const nx = b.x + dx / d * b.speed * dt, nz = b.z + dz / d * b.speed * dt; if (!this._blockedAt(nx, b.z)) b.x = nx; if (!this._blockedAt(b.x, nz)) b.z = nz; }
    b.x = clamp(b.x, 1 - HALF, HALF - 1); b.z = clamp(b.z, 1 - HALF, HALF - 1);
    b.hp = Math.min(b.maxhp, b.hp + (1 + b.regen) * dt * .5);
    if (b.item && this.enemies.size > 6) { this._applyItemFx(b.item, b.x, b.z, false); if (b.item === 'kit') b.hp = b.maxhp; b.item = null; }
    this._autoCombat(b, dt, false);
  }
  /* ---------- revive ---------- */
  _reviveSim(dt) {
    const near = (a, b) => dist2(a.x, a.z, b.x, b.z) < 2.6;
    const doRev = (p, helper) => {
      if (!p.down) return;
      p.downT -= dt;
      if (helper && !helper.down && near(p, helper)) { p.revP += dt / 2.5; if (p.revP >= 1) { p.down = false; p.hp = p.maxhp * .5; p.revP = 0; p.downT = 0; this._beep(880, .2, 'square', .06); if (p === this.me) this._banner('부활 완료'); } }
      else p.revP = Math.max(0, p.revP - dt);
    };
    doRev(this.me, this.allyOn ? this.ally : null);
    if (this.mode === 'solo') doRev(this.ally, this.me);
    if (this.me.down) { this.revEl.style.display = 'block'; this.revEl.textContent = this.me.revP > 0 ? '구조 중… ' + Math.round(this.me.revP * 100) + '%' : '쓰러짐 — 동료가 접근해야 함 (' + Math.ceil(this.me.downT) + 's)'; }
    else this.revEl.style.display = 'none';
    if (this.isHostish() && !this.over) {
      const allyDown = this.allyOn ? this.ally.down : false;
      if (this.me.down && (allyDown || !this.allyOn)) this._gameOver(false, '전 유닛 무력화');
      if (this.me.down && this.me.downT <= 0) this._gameOver(false, '구조 실패');
    }
  }
  /* ---------- game over ---------- */
  _gameOver(win, why, fromNet) {
    if (this.over) return; this.over = { win, why };
    this.phase = 'over';
    if (this.isHostish() && this.mode !== 'solo' && !fromNet) this._send({ t: 'end', win, why });
    this._beep(win ? 700 : 120, .5, win ? 'square' : 'sawtooth', .07); if (win) this._beep(1050, .6, 'square', .05);
    const mm = String(Math.floor(this.tm / 60)).padStart(2, '0'), ss = String(Math.floor(this.tm % 60)).padStart(2, '0');
    const canRestart = this.isHostish();
    this._overlay(`
      <div style="font:700 11px ${FONT};letter-spacing:.18em;color:${win ? PAL.cyan : PAL.red}">${win ? 'PROTOCOL COMPLETE' : 'PROTOCOL FAILED'}</div>
      <div style="font:700 34px ${FONT};margin:4px 0 10px;text-shadow:0 0 20px ${win ? 'rgba(37,216,255,.4)' : 'rgba(255,59,42,.4)'}">${win ? '방어 성공' : '방어선 붕괴'}</div>
      <div style="font:400 13px ${FONT};line-height:1.7;border-top:1px solid ${PAL.line};padding-top:10px;color:${PAL.dim}">
        사유 — ${why}<br>웨이브 ${this.wave}/${this.maxWave} · 경과 ${mm}:${ss} · 처치 ${this.kills} · 레벨 ${this.lv}
      </div>
      <div style="display:flex;gap:8px;margin-top:18px">
        ${canRestart ? `<button id="egRe" style="${this._obtn(true)}">재도전</button>` : ''}
        <button id="egOut" style="${this._obtn(false)}">로비로</button>
      </div>${canRestart ? '' : `<div style="font:400 11px ${FONT};margin-top:8px;color:${PAL.dim}">방장이 재도전을 시작할 수 있습니다</div>`}`);
    this.ovIn.querySelector('#egOut').onclick = () => this._exit();
    const re = this.ovIn.querySelector('#egRe');
    if (re) re.onclick = () => {
      this._reset();
      if (this.mode === 'solo') { this.phase = 'count'; this.countT = 3; }
      else { this._send({ t: 'restart' }); this._startOnline(); }
    };
  }
  /* ---------- main tick ---------- */
  _tick(dt) {
    if (!this.renderer) return;
    if (this.phase === 'count') {
      this.countT -= dt;
      this._overlay(`<div style="font:700 11px ${FONT};letter-spacing:.18em;color:${PAL.red}">EROSION PROTOCOL</div><div style="font:700 68px ${FONT};color:${PAL.cyan};text-shadow:0 0 24px rgba(37,216,255,.5)">${Math.ceil(this.countT)}</div><div style="font:400 13px ${FONT};line-height:1.7;color:${PAL.dim}">4개의 균열에서 침식체가 몰려온다.<br>벽과 포탑으로 길을 막고, 중앙의 정화 코어를 ${this.maxWave}웨이브 동안 지켜라.</div>`);
      if (this.countT <= 0) { this.phase = 'none'; this.ov.style.display = 'none'; if (this.isHostish()) this._startBuild(); }
    }
    const playing = this.phase === 'build' || this.phase === 'assault';
    if (playing && !this.over) {
      this.tm += dt; this.slowT = Math.max(0, this.slowT - dt);
      this._movePlayer(dt);
      this._autoCombat(this.me, dt, true);
      if (this.mode === 'solo') this._botSim(dt);
      if (this.isHostish()) {
        if (this.phase === 'build') { this.phT -= dt; if (this.phT <= 0) this._startAssault(); }
        else {
          this._spawnLogic(dt); this._enemySim(dt);
          if (!this.spawnQ.length && this.enemies.size === 0) {
            if (this.wave >= this.maxWave) this._gameOver(true, `${this.maxWave}웨이브 방어 완수`);
            else this._startBuild();
          }
        }
        this._turretSim(dt); this._pickupSim();
      } else {
        this.phT -= dt;
        for (const e of this.enemies.values()) { e.x += (e.tx - e.x) * Math.min(1, dt * 10); e.z += (e.tz - e.z) * Math.min(1, dt * 10); }
      }
      this._bulletSim(dt); this._reviveSim(dt);
      const p = this.me; if (!p.down) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
      p.dashT = Math.max(0, p.dashT - dt); p.dashing = Math.max(0, p.dashing - dt); p.sklT = Math.max(0, p.sklT - dt);
      if (this.mode !== 'solo') this._netTick(dt);
      if (this.mode !== 'solo' && this.allyOn) { const a = this.ally; if (a.tx !== undefined) { a.x += (a.tx - a.x) * Math.min(1, dt * 12); a.z += (a.tz - a.z) * Math.min(1, dt * 12); a.a = a.ta || 0; } }
    }
    this._render(dt);
  }
  _blockedAt(x, z) { const i = ti(w2g(x), w2g(z)); const o = this.occ[i]; return o === 1 || o === 2 || o === 3; }
  _movePlayer(dt) {
    const p = this.me; if (p.down) return;
    let mx = this.joyVec.x, mz = this.joyVec.z;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1; if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1; if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    const m = Math.hypot(mx, mz);
    let rx = 0, rz = 0;
    if (m > .01) {
      mx /= Math.max(1, m); mz /= Math.max(1, m);
      const c = Math.cos(-Math.PI / 4), s = Math.sin(-Math.PI / 4);
      rx = mx * c - mz * s; rz = mx * s + mz * c;
    } else if (p.dashing > 0) { rx = Math.cos(p.a); rz = Math.sin(p.a); }
    if (rx || rz) {
      const sp = p.speed * (p.dashing > 0 ? 3.4 : 1);
      const nx = p.x + rx * sp * dt, nz = p.z + rz * sp * dt;
      if (!this._blockedAt(nx + Math.sign(rx) * .3, p.z)) p.x = nx;
      if (!this._blockedAt(p.x, nz + Math.sign(rz) * .3)) p.z = nz;
      p.x = clamp(p.x, 1 - HALF, HALF - 1); p.z = clamp(p.z, 1 - HALF, HALF - 1);
      p.tilt = 1;
      if (this.enemies.size === 0 && m > .01) p.a = Math.atan2(rz, rx);
    } else p.tilt = 0;
  }
  _bulletSim(dt) {
    const host = this.isHostish();
    for (const b of this.bullets) {
      b.x += b.dx * dt; b.z += b.dz * dt; b.life -= dt;
      if (Math.abs(b.x) > HALF || Math.abs(b.z) > HALF) { b.life = 0; continue; }
      for (const e of this.enemies.values()) {
        if (dist2(b.x, b.z, e.x, e.z) < (ETYPES[e.ty].r + .2) ** 2) {
          this._fx(b.x, b.z, false, b.tur || !b.ally ? PAL.cyanHex : PAL.amberHex);
          if (!b.ghost) { if (host) this._dmgEnemy(e, b.dmg); else { e.flash = .12; this._send({ t: 'hit', id: e.id, d: +b.dmg.toFixed(1) }); } }
          if (b.pierce > 0) b.pierce--; else b.life = 0;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.life > 0);
    for (const b of this.ebullets) {
      b.x += b.dx * dt; b.z += b.dz * dt; b.life -= dt;
      if (host) {
        if (!this.me.down && dist2(b.x, b.z, this.me.x, this.me.z) < .49) { this._hurt(this.me, 13 * this.diffMul); b.life = 0; }
        else if (this.allyOn && !this.ally.down && dist2(b.x, b.z, this.ally.x, this.ally.z) < .49) { this._dealToPlayer(this.ally, 13 * this.diffMul); b.life = 0; }
      } else if (!this.me.down && dist2(b.x, b.z, this.me.x, this.me.z) < .49) { b.life = 0; }
    }
    this.ebullets = this.ebullets.filter(b => b.life > 0);
  }
  _netTick(dt) {
    this.sendPoseT -= dt;
    if (this.sendPoseT <= 0) {
      this.sendPoseT = .09;
      const p = this.me;
      const o = { t: 'p', x: +p.x.toFixed(2), z: +p.z.toFixed(2), a: +p.a.toFixed(2), hp: Math.round(p.hp), mh: p.maxhp, dn: p.down, lv: this.lv };
      if (this.shotQ.length) { o.sh = this.shotQ; this.shotQ = []; }
      this._send(o);
    }
    if (this.isHost) {
      this.sendStateT -= dt;
      if (this.sendStateT <= 0) {
        this.sendStateT = .13; this.sendStT -= .13;
        const o = { t: 's', tm: +this.tm.toFixed(1), xp: this.xpTotal(), sc: Math.round(this.scrap), core: Math.round(this.coreHp), wv: this.wave, ph: this.phase, pt: +this.phT.toFixed(1),
          en: [...this.enemies.values()].map(e => [e.id, e.ty, Math.round(e.x * 10), Math.round(e.z * 10), Math.round(e.hp)]),
          itm: this.fitems.map(f => [f.id, f.k, Math.round(f.x * 10), Math.round(f.z * 10)]) };
        if (this.sendStT <= 0) { this.sendStT = 1.4; o.st = this._structPack(); }
        this._send(o);
      }
    }
    if (this.allyOn && this.tm - this.ally.lastSeen > 6 && this.tm > 8) {
      if (!this._lostBan || this.tm - this._lostBan > 6) { this._lostBan = this.tm; this._banner('동료 연결 대기 중…', 3000); }
    }
  }
  xpTotal() { let need = 0; for (let l = 1; l < this.lv; l++) need += 25 + l * 18; return need + this.xp; }
  /* ---------- render ---------- */
  _render(dt) {
    const T = THREE, now = performance.now() / 1000;
    if (this.dust) this.dust.rotation.y += dt * .01;
    // structures
    if (this._structDirty) {
      this._structDirty = false;
      for (let i = 0; i < N * N; i++) {
        const k = this.occ[i], has = this.sMeshes.has(i);
        if ((k === 1 || k === 2)) {
          let g = this.sMeshes.get(i);
          if (!g || g.kind !== k) { if (g) this.scene.remove(g); g = this._sMesh(k); g.kind = k; this.sMeshes.set(i, g); g.position.set(g2w(i % N), 0, g2w((i / N) | 0)); }
        } else if (has) { this.scene.remove(this.sMeshes.get(i)); this.sMeshes.delete(i); }
      }
    }
    for (const [i, g] of this.sMeshes) {
      if (g.kind === 1) { const hpP = this.shp[i] / (WALL_HP * this.g.wallMul); g.trim.material = hpP < .35 ? this.mGlowRed : this.mGlowCyan; g.children[0].scale.y = .55 + .45 * clamp(hpP, 0, 1); g.children[0].position.y = .75 * g.children[0].scale.y; g.trim.position.y = 1.53 * g.children[0].scale.y; }
      else if (g.gun) { // aim at nearest enemy
        let best = null, bd = 90; const x = g.position.x, z = g.position.z;
        for (const e of this.enemies.values()) { const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
        if (best) g.rotation.y = -Math.atan2(best.z - z, best.x - x) + Math.PI / 2;
      }
    }
    // core
    const c = this.coreMesh;
    c.cry.rotation.y += dt * .8; c.ring.rotation.z += dt * 1.2;
    const chp = this.coreHp / this.coreMax;
    c.cry.material = (this._coreBanT && this.tm - this._coreBanT < .5) ? this.mFlash : this.mGlowCyan;
    c.cry.scale.set(.7 + .3 * chp, 1.9 * (.7 + .3 * chp), .7 + .3 * chp);
    c.lamp.intensity = 1.2 + Math.sin(now * 2.5) * .4;
    // gates pulse
    this.gateMs.forEach((g, i) => { g.rift.material.opacity = .35 + Math.sin(now * 3 + i) * .15 + (this.phase === 'assault' ? .2 : 0); });
    // players
    const setP = (g, p, isMe) => {
      g.position.set(p.x, Math.sin(now * 2.6 + (isMe ? 0 : 2)) * .06, p.z);
      g.rotation.y = -p.a - Math.PI / 2;
      g.rotation.z = 0;
      if (p.down) { g.rotation.z = 1.2; g.position.y = -.15; g.accents.forEach(a => a.material = ((now * 4 | 0) % 2) ? this.mGlowRed : g.accentMat); }
      else g.accents.forEach(a => a.material = g.accentMat);
      g.ring.scale.setScalar(1 + Math.sin(now * 3) * .06);
      if (p.dashing > 0) this._burst(p.x, p.z, isMe ? PAL.cyanHex : PAL.amberHex, 2, 3);
    };
    setP(this.meG, this.me, true);
    if (this.allyOn) { this.allyG.visible = true; setP(this.allyG, this.ally, false); } else this.allyG.visible = false;
    // enemies
    for (const [id, e] of this.enemies) {
      let m = this.eMeshes.get(id); if (!m) { m = this._eMesh(e); this.eMeshes.set(id, m); }
      m.position.set(e.x, 0, e.z); m.rotation.y += dt * (e.ty === 2 ? 1.5 : .6);
      if (e.ty === 0) m.position.y = Math.abs(Math.sin(now * 6 + id)) * .12;
      if (e.flash > 0) { e.flash -= dt; m.body.material = this.mFlash; } else m.body.material = this.mEnemy;
    }
    for (const [id, m] of this.eMeshes) if (!this.enemies.has(id)) { this.scene.remove(m); this.eMeshes.delete(id); }
    // bullets
    while (this.bMeshes.length < this.bullets.length + this.ebullets.length) { const m = new T.Mesh(this.bulletG, this.mGlowCyan); this.scene.add(m); this.bMeshes.push(m); }
    let bi = 0;
    for (const b of this.bullets) { const m = this.bMeshes[bi++]; m.visible = true; m.geometry = this.bulletG; m.material = b.ally ? this.mGlowAmber : this.mGlowCyan; m.position.set(b.x, .55, b.z); m.rotation.y = -Math.atan2(b.dz, b.dx); }
    for (const b of this.ebullets) { const m = this.bMeshes[bi++]; m.visible = true; m.geometry = this.ebulletG; m.material = this.mGlowRed; m.position.set(b.x, .55, b.z); }
    for (; bi < this.bMeshes.length; bi++) this.bMeshes[bi].visible = false;
    // items
    while (this.itemMs.length < this.fitems.length) { const g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(.55, .55, .55), this.mGlowAmber); b.position.y = .5; g.add(b); const l = new T.PointLight(PAL.amberHex, .6, 4); l.position.y = 1; g.add(l); this.scene.add(g); this.itemMs.push(g); }
    this.itemMs.forEach((g, i) => { const f = this.fitems[i]; if (f) { g.visible = true; g.position.set(f.x, Math.sin(now * 2.2) * .15 + .1, f.z); g.children[0].rotation.y += dt * 2; } else g.visible = false; });
    // fx
    for (const f of [...this.fxs]) { f.userData.t += dt * 3; const s = 1 + f.userData.t * f.userData.big; f.scale.set(s, s, s); f.material.opacity = Math.max(0, .85 - f.userData.t); if (f.material.opacity <= 0) { this.scene.remove(f); f.material.dispose(); this.fxs.splice(this.fxs.indexOf(f), 1); } }
    if (!this._sparkPool) this._sparkPool = [];
    for (const s of [...this.sparks]) {
      const u = s.userData; u.life -= dt;
      if (u.life <= 0) { s.visible = false; this.scene.remove(s); this.sparks.splice(this.sparks.indexOf(s), 1); if (this._sparkPool.length < 80) this._sparkPool.push(s); continue; }
      u.vy -= 18 * dt; s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (s.position.y < .05) { s.position.y = .05; u.vy *= -.4; }
      s.material.opacity = Math.min(1, u.life * 3);
    }
    // camera
    this.camF.x += (this.me.x * .7 - this.camF.x) * Math.min(1, dt * 5); this.camF.z += (this.me.z * .7 - this.camF.z) * Math.min(1, dt * 5);
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.2);
    const sx = (Math.random() - .5) * this.shake * .5, sz = (Math.random() - .5) * this.shake * .5;
    this.cam.position.set(this.camF.x + 15 + sx, 19, this.camF.z + 15 + sz);
    this.cam.lookAt(this.camF.x + sx, 0, this.camF.z + sz);
    this.dmgFlash = Math.max(0, (this.dmgFlash || 0) - dt * 2.5);
    this.vig.style.opacity = this.dmgFlash;
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.cam);
    this._hudTick(dt);
  }
  _hudTick(dt) {
    this._hudT = (this._hudT || 0) - dt; if (this._hudT > 0) return; this._hudT = .12;
    this.wvEl.textContent = this.phase === 'build' ? `WAVE ${this.wave + 1} 준비` : `WAVE ${Math.max(1, this.wave)} / ${this.maxWave}`;
    if (this.phase === 'build') { this.phEl.textContent = `습격까지 ${Math.max(0, Math.ceil(this.phT))}초 — 건설·연구 단계`; this.phEl.style.color = PAL.cyan; }
    else if (this.phase === 'assault') { this.phEl.textContent = `습격 진행 중 — 잔여 ${this.enemies.size + (this.isHostish() ? this.spawnQ.length : 0)}`; this.phEl.style.color = PAL.red; }
    else this.phEl.textContent = '';
    this.goBtn.style.display = this.isHostish() && this.phase === 'build' ? 'block' : 'none';
    const chp = this.coreHp / this.coreMax;
    this.coreF.style.width = Math.max(0, chp * 100) + '%';
    this.coreF.style.background = chp < .3 ? PAL.red : `linear-gradient(90deg,${PAL.cyan},#7ee8ff)`;
    this.coreLab.textContent = '정화 코어 ' + Math.max(0, Math.round(this.coreHp)) + ' / ' + this.coreMax;
    this.scEl.textContent = '◈ ' + Math.floor(this.scrap);
    const setBar = (k, p, col) => { this.pbar[k].f.style.width = Math.max(0, p.hp / p.maxhp * 100) + '%'; const c2 = p.down ? PAL.red : col; this.pbar[k].f.style.background = c2; this.pbar[k].f.style.boxShadow = '0 0 8px ' + c2; };
    setBar('me', this.me, PAL.cyan);
    this.pbar.ally.row.style.display = this.allyOn ? 'flex' : 'none';
    if (this.allyOn) { setBar('ally', this.ally, PAL.amber); this.pbar.ally.lab.textContent = (this.mode === 'solo' ? '유닛-B · 봇' : '동료') + (this.ally.down ? ' — 쓰러짐!' : ''); }
    this.lvEl.textContent = 'LV ' + this.lv;
    this.xpF.style.width = (this.xp / (25 + this.lv * 18) * 100) + '%';
    const p = this.me;
    this.dashBtn.textContent = p.dashT > 0 ? '대시 ' + p.dashT.toFixed(1) : '대시';
    this.dashBtn.style.opacity = p.dashT > 0 ? .45 : 1;
    this.sklBtn.textContent = p.sklT > 0 ? '충격파 ' + Math.ceil(p.sklT) : '충격파 Lv' + p.sklLv;
    this.sklBtn.style.opacity = p.sklT > 0 ? .45 : 1;
    this.sklBtn.style.borderColor = p.sklT > 0 ? PAL.line : PAL.cyan; this.sklBtn.style.color = p.sklT > 0 ? PAL.text : PAL.cyan;
    this.itemBtn.textContent = p.item ? ITEMS[p.item].n : '아이템 —';
    this.itemBtn.style.background = p.item ? PAL.red : PAL.panel; this.itemBtn.style.color = p.item ? '#fff' : PAL.text;
    this.itemBtn.style.boxShadow = p.item ? '0 0 14px rgba(255,59,42,.5)' : 'none';
    if (this.buildMode) { this.wallChip.textContent = `벽 · ${this._cost(1)}`; this.turChip.textContent = `포탑 · ${this._cost(2)}`; }
    // minimap
    const ctx = this.mm.getContext('2d'), S = 104 / N;
    ctx.fillStyle = 'rgba(8,9,13,.95)'; ctx.fillRect(0, 0, 104, 104);
    for (let z = 0; z < N; z++)for (let x = 0; x < N; x++) {
      const o = this.occ[ti(x, z)];
      if (!o) continue;
      ctx.fillStyle = o === 1 ? '#cfd6e4' : o === 2 ? PAL.cyan : o === 3 ? PAL.cyan : PAL.red;
      ctx.globalAlpha = o === 3 || o === 4 ? .9 : .8;
      ctx.fillRect(x * S, z * S, S, S);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.red;
    for (const e of this.enemies.values()) ctx.fillRect((w2g(e.x) + .5) * S - 1.5, (w2g(e.z) + .5) * S - 1.5, 3, 3);
    const dot = (x, z, c, r) => { ctx.fillStyle = c; ctx.fillRect((w2g(x) + .5) * S - r, (w2g(z) + .5) * S - r, r * 2, r * 2); };
    dot(this.me.x, this.me.z, PAL.cyan, 2.5);
    if (this.allyOn) dot(this.ally.x, this.ally.z, PAL.amber, 2.5);
  }
}
customElements.define('erosion-game', ErosionGame);
})();
