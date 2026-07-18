// world.js — verbatim methods from game.js (prototype-install)
import { PV, CAP_WALL, CAP_TUR, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

const FDIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function install(P) {
  P._reset = function () {
    const mk = (x, z) => ({ x, z, a: 0, hp: 100, maxhp: 100, speed: 6, dmg: 9, frate: 2.5, shots: 1, pierce: 0, regen: 0, dashCd: 3.5, sklLv: 1, sklT: 0, scrapMul: 1, range: 9, wallMul: 1, turMul: 1, turHpMul: 1, costMul: 1, wallLv: 0, turLv: 0, fireT: 0, dashT: 0, dashing: 0, down: false, downT: 0, revP: 0, items: [], taken: {}, buys: {}, lastSeen: 0 });
    this.me = mk(-2.5, 5); this.ally = mk(2.5, 5);
    this.allyOn = this.mode === 'solo';
    this.occ = new Uint8Array(N * N); this.shp = new Float32Array(N * N);
    this.bld = new Float32Array(N * N); this.building = new Set();
    this._al50 = this._al25 = false; this._coreHitT = -9; this._lastCore = undefined;
    this.enemies = new Map(); this.eid = 1; this.bullets = []; this.ebullets = []; this.fitems = [];
    this.tm = 0; this.xp = 0; this.lv = 1; this.kills = 0; this.pendUp = 0; this.slowT = 0;
    this.scrap = 50; this.allyScrap = 50;
    this.own = new Uint8Array(N * N); // structure builder: 0 = host, 1 = guest (research is per-owner)
    this.coreHp = this.coreMax = 2000; // doubled with the boss-swing pass — repairs/core augs scaled ×2 with it
    this.wave = 0; this.phT = 0; this.spawnQ = []; this.spawnT = 0;
    this.shotQ = []; this.over = null;
    this.stat = { k: 0, g: 0, b: 0, r: 0 }; this.allyStat = { k: 0, g: 0, b: 0, r: 0 }; // per-player: kills / gold earned / builds / research buys
    this.buildMode = false; this.buildSel = 1; // 1 wall 2 turret 3 sell
    // core 2x2 at center
    this.coreTiles = [];
    for (let a = 15; a <= 16; a++)for (let b = 15; b <= 16; b++) { this.occ[ti(a, b)] = 3; this.coreTiles.push(ti(a, b)); }
    // wide gates (4 tiles) at 4 mid-edges; one is active per wave
    this.gates = [{ gx: 15, gz: 0 }, { gx: 15, gz: N - 1 }, { gx: 0, gz: 15 }, { gx: N - 1, gz: 15 }];
    this.gates.forEach(g => { for (let o = -2; o < 4; o++) { const x = g.gx + (g.gz === 0 || g.gz === N - 1 ? o : 0), z = g.gz + (g.gx === 0 || g.gx === N - 1 ? o : 0); this.occ[ti(x, z)] = 4; } g.x = g2w(g.gx + (g.gz === 0 || g.gz === N - 1 ? .5 : 0) * 1); g.z = g2w(g.gz) + (g.gx === 0 || g.gx === N - 1 ? TS / 2 : 0); });
    this._pickGates();
    // stale cross-game state: restart reuses the element, so net/infiltration scope must clear too
    this.inf = false; this.infFinal = false; this.infBossN = 0; this._infCount = null; this.escGate = undefined;
    this._cntMulNow = 1; this._infGhostB = 0; this._peerBuys = {}; if (this._fiSeen) this._fiSeen.clear();
    if (this.coreMesh) { this.coreMesh.position.set(g2w(15) + TS / 2, 0, g2w(15) + TS / 2); this.coreMesh.visible = true; }
    if (this.coreBar) { this.coreBar.position.x = g2w(15) + TS / 2; this.coreBar.position.z = g2w(15) + TS / 2; }
    if (this.mm) this.mm.style.display = '';
    if (this.fxs) { for (const f of this.fxs) { f.visible = false; this.scene.remove(f); if (this._fxPool && this._fxPool.length < 64) this._fxPool.push(f); } this.fxs.length = 0; }
    if (this.sparks) { for (const s of this.sparks) { s.visible = false; this.scene.remove(s); if (this._sparkPool && this._sparkPool.length < 160) this._sparkPool.push(s); } this.sparks.length = 0; }
    if (this.bMeshes) for (const m of this.bMeshes) m.visible = false;
    if (this.teles) this.teles.length = 0; if (this._teleP) for (const m of this._teleAllMeshes()) m.visible = false; // boss telegraphs don't survive a restart
    this._turFlash = {};
    this._flow(); this._syncStruct();
    this._hudReset();
  };
  P._nmRamp = function () { // nightmare eases in: waves 1-3 play like hard, full brutality from wave 6
    return this.diffKey === 'nightmare' ? clamp(((this.wave || 0) - 3) / 7, 0, 1) : 0; // full brutality lands at wave 10, not 6
  };
  P._dMul = function () { // effective difficulty multiplier (nightmare ramps 1.35 → 1.49)
    return this.diffKey === 'nightmare' ? 1.35 + .14 * this._nmRamp() : this.diffMul;
  };
  P._pickGates = function () { // nightmare rifts stage in: w5+ solo 2 / multi 3, w9+ multi 4; other modes 1
    const w3 = this.wave || 0;
    const want = this.diffKey !== 'nightmare' || w3 < 4 ? 1 : this.mode === 'solo' ? 2 : (w3 >= 8 ? 4 : 3);
    const idx = [0, 1, 2, 3];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    this.activeGates = idx.slice(0, want).sort();
    this.activeGate = this.activeGates[0];
  };
  P._flow = function () {
    const dist = this.flowD = (this.flowD && this.flowD.fill(1e9)) || new Float32Array(N * N).fill(1e9);
    const buckets = [[]];
    for (const i of this.coreTiles) { dist[i] = 0; buckets[0].push(i); }
    for (let d = 0; d < buckets.length; d++) {
      const b = buckets[d]; if (!b) continue;
      for (let n = 0; n < b.length; n++) {
        const cur = b[n];
        if (dist[cur] !== d) continue; // stale entry — already relaxed cheaper
        const gx = cur % N, gz = (cur / N) | 0;
        for (const [a, c] of FDIRS) {
          const X = gx + a, Z = gz + c; if (!inG(X, Z)) continue;
          const j = ti(X, Z), o = this.occ[j];
          if (o === 5) continue; // erosion rock — impassable
          const nd = d + 1 + (o === 1 || o === 2 ? 24 : 0);
          if (nd < dist[j]) { dist[j] = nd; (buckets[nd] || (buckets[nd] = [])).push(j); }
        }
      }
    }
  };
  P._ownerOf = function (i) { const mine = this.isHostish() ? 0 : 1; return this.own[i] === mine ? this.me : this.ally; }
  P._structHp = function (k, q) { q = q || this.me; return k === 1 ? WALL_HP * (q.wallMul || 1) : TURRET_HP * (q.turHpMul || 1); }
  P._turBand = function (q) { const l = (q || this.me).turLv || 0; return l >= 8 ? 2 : l >= 4 ? 1 : 0; }
  P._place = function (i, k, silent, owner) {
    this.occ[i] = k; this.own[i] = owner || 0; this.shp[i] = this._structHp(k, this._ownerOf(i));
    this.bld[i] = 0; this.building.add(i);
    this._flow(); this._syncStruct();
    if (!silent) this._beep(520, .08, 'square', .05);
  };
  P._remove = function (i) { this.occ[i] = 0; this.own[i] = 0; this.shp[i] = 0; this.bld[i] = 0; this.building.delete(i); this._flow(); this._syncStruct(); }
  P._cost = function (k, q) { // build costs inflate with the wave (income does too) — late-game gold shouldn't trivialize walls
    const waveMul = Math.min(2.5, 1 + Math.max(0, this.wave - 4) * .08); // inflation starts at wave 5 — early econ untouched
    return Math.round((k === 1 ? WALL_COST : TURRET_COST) * ((q || this.me).costMul || 1) * waveMul);
  }
  P._canPlace = function (i) {
    if (this.occ[i]) return false;
    const gx = i % N, gz = (i / N) | 0, x = g2w(gx), z = g2w(gz);
    for (const e of this.enemies.values()) if (dist2(e.x, e.z, x, z) < 2.3) return false;
    if (dist2(this.me.x, this.me.z, x, z) < .9 || (this.allyOn && dist2(this.ally.x, this.ally.z, x, z) < .9)) return false;
    return true;
  };
  P._structCount = function (ownVal, k) { let n = 0; for (let i = 0; i < N * N; i++) if (this.occ[i] === k && this.own[i] === ownVal) n++; return n; }
  P._tryBuild = function (i, k) { // local action (me)
    if (!this._canPlace(i)) return;
    const cap = k === 1 ? CAP_WALL : CAP_TUR;
    if (this._structCount(this.isHostish() ? 0 : 1, k) >= cap) { this._banner(`${k === 1 ? '벽' : '포탑'} 최대 ${cap}개 — 판매 후 재배치`); return; }
    const c = this._cost(k); if (this.scrap < c) { this._banner('자원 부족'); return; }
    if (this.isHostish()) { this.scrap -= c; this.stat.b++; this._place(i, k); if (this.mode !== 'solo') this._send({ t: 'blt', i, k, sc: this.scrap }); }
    else this._send({ t: 'bld', i, k });
  };
  P._trySell = function (i) {
    const k = this.occ[i]; if (k !== 1 && k !== 2) return;
    if (this.isHostish()) { this.scrap += Math.round(this._cost(k) * .7); this._remove(i); if (this.mode !== 'solo') this._send({ t: 'slt', i, sc: this.scrap }); }
    else this._send({ t: 'sel', i });
  };
  P._syncStruct = function () { this._structDirty = true; }
  P._structDone = function (i) { // construction complete
    const x = g2w(i % N), z = g2w((i / N) | 0);
    this._fx(x, z, false, PAL.cyanHex);
    this._beep(880, .1, 'square', .05); this._beep(1320, .14, 'square', .04);
    const g = this.sMeshes.get(i); if (g) g.userData.pop = .28;
  };
  P._buildSim = function (dt) { // advance construction gauges (runs on every client)
    for (const i of this.building) {
      const k = this.occ[i];
      if (k !== 1 && k !== 2) { this.building.delete(i); continue; }
      if (this.bld[i] >= 1) { this.building.delete(i); continue; }
      this.bld[i] += dt / BUILD_T[k];
      if (this.bld[i] >= 1) { this.bld[i] = 1; this.building.delete(i); this._structDone(i); }
    }
  };
  P._refreshShp = function () { for (let i = 0; i < N * N; i++) { const k = this.occ[i]; if (k !== 1 && k !== 2) continue; const mx = this._structHp(k, this._ownerOf(i)); if (this.shp[i] > mx) this.shp[i] = mx; } }
  P._applyStructUpg = function (u, q, ownVal) { // per-player structure research — rescale ONLY the buyer's structures, keeping HP RATIO
    q = q || this.me; ownVal = ownVal || 0;
    const ow = this._structHp(1, q), ot = this._structHp(2, q);
    u.f(q);
    const rw = this._structHp(1, q) / ow, rt = this._structHp(2, q) / ot;
    if (rw !== 1 || rt !== 1) {
      for (let i = 0; i < N * N; i++) { if (this.own[i] !== ownVal) continue; if (this.occ[i] === 1) this.shp[i] *= rw; else if (this.occ[i] === 2) this.shp[i] *= rt; }
      this._syncStruct();
    }
  };
  P._unstuck = function (p) { // shove a unit off a tile that just became solid
    if (!this._blockedAt(p.x, p.z)) return;
    const gx = w2g(p.x), gz = w2g(p.z);
    for (let r = 1; r < 8; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const X = gx + dx, Z = gz + dz;
      if (inG(X, Z) && !this.occ[ti(X, Z)]) { p.x = g2w(X); p.z = g2w(Z); return; }
    }
  };
  P._saveRun = function () {
    try {
      const st = [];
      for (let i = 0; i < N * N; i++) if (this.occ[i] === 1 || this.occ[i] === 2) st.push([i, this.occ[i], Math.round(this.shp[i]), this.own[i]]);
      const pick = q => ({ hp: q.hp, maxhp: q.maxhp, speed: q.speed, dmg: q.dmg, frate: q.frate, shots: q.shots, pierce: q.pierce, regen: q.regen, dashCd: q.dashCd, dashDur: q.dashDur, sklLv: q.sklLv, scrapMul: q.scrapMul, armor: q.armor, dropMul: q.dropMul, range: q.range, wallMul: q.wallMul, turMul: q.turMul, turHpMul: q.turHpMul, costMul: q.costMul, wallLv: q.wallLv, turLv: q.turLv, taken: q.taken, syn: q.syn || {}, synGrade: q.synGrade || {}, buys: q.buys, items: q.items || [] });
      localStorage.setItem('eg_save', JSON.stringify({ v: 1, wave: this.wave, core: Math.round(this.coreHp), coreMax: Math.round(this.coreMax), scrap: Math.round(this.scrap), lv: this.lv, xp: Math.round(this.xp), kills: this.kills, tm: Math.round(this.tm), st, me: pick(this.me), ally: pick(this.ally), diff: this.diffKey, waves: this.maxWave, bt: this.buildTime }));
    } catch (e) {}
  };
  P._loadRun = function (s) {
    this.wave = s.wave; this.coreHp = s.core; if (s.coreMax) this.coreMax = s.coreMax; this.scrap = s.scrap; this.lv = s.lv; this.xp = s.xp; this.kills = s.kills; this.tm = s.tm;
    if (s.g) Object.assign(this.me, s.g); // legacy shared-research saves fold into my research
    for (const [i, k, hp, ow] of s.st) { this.occ[i] = k; this.shp[i] = hp; this.bld[i] = 1; this.own[i] = ow || 0; }
    Object.assign(this.me, s.me); Object.assign(this.ally, s.ally);
    // saves from the single-slot era carry `item`; fold it into the inventory
    for (const q of [this.me, this.ally]) if (!Array.isArray(q.items)) q.items = q.item ? [q.item] : [];
    this._flow(); this._syncStruct();
    this.phase = 'build'; this.phT = this.buildTime;
    this.ov.style.display = 'none';
    this._banner(`이어하기 — WAVE ${this.wave + 1} 준비`, 3200);
  };
  P._blockedAt = function (x, z) { const i = ti(w2g(x), w2g(z)); const o = this.occ[i]; return o === 1 || o === 3 || o === 5; } // turrets (2) are walk-through
}
