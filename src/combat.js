// combat.js — verbatim methods from game.js (prototype-install)
import { N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._spawnBullet = function (x, z, dx, dz, o) {
    this.bullets.push({ x, z, dx, dz, life: .9, dmg: o.dmg || 0, pierce: o.pierce || 0, ghost: o.ghost, ally: o.ally, tur: o.tur, band: o.band || 0 });
  };
  P._fire = function (p, tx, tz, mine) {
    const base = Math.atan2(tz - p.z, tx - p.x);
    for (let i = 0; i < p.shots; i++) {
      const off = (i - (p.shots - 1) / 2) * .12, a = base + off;
      const dx = Math.cos(a) * 19, dz = Math.sin(a) * 19;
      this._spawnBullet(p.x, p.z, dx, dz, { dmg: p.dmg, pierce: p.pierce, ghost: false, ally: !mine });
      if (mine) this.shotQ.push([+p.x.toFixed(1), +p.z.toFixed(1), +dx.toFixed(1), +dz.toFixed(1)]);
    }
    if (!mine || !this._meMoving) p.a = base; // aim-facing only when idle; movement owns facing otherwise
  };
  P._autoCombat = function (p, dt, mine) {
    if (p.down) return;
    p.fireT -= dt; if (p.fireT > 0) return;
    let best = null, bd = 110;
    for (const e of this.enemies.values()) { const d = dist2(p.x, p.z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
    if (best) { p.fireT = 1 / p.frate; this._fire(p, best.x, best.z, mine); }
  };
  P._dmgEnemy = function (e, d, src) { // src: killing bullet/context — scrap multiplier belongs to the KILLER
    e.hp -= d; e.flash = .12;
    if (e.hp <= 0 && !e.deadDone) {
      e.deadDone = true; this.kills++; this._killFx(e); this.enemies.delete(e.id);
      this._grantXp(ETYPES[e.ty].xp);
      const base = ETYPES[e.ty].sc;
      if (this.mode === 'solo') this.scrap += base * (src && src.ally ? (this.ally.scrapMul || 1) : src && src.tur ? 1 : (this.me.scrapMul || 1));
      else if (src && src.tur) { this.scrap += base / 2; this.allyScrap += base / 2; } // turret kills split
      else if (src && src.ally) this.allyScrap += base * (this.ally.scrapMul || 1);
      else this.scrap += base * (this.me.scrapMul || 1);
      const dropMul = src && src.ally ? (this.ally.dropMul || 1) : src && src.tur ? 1 : (this.me.dropMul || 1); // killer's loot-detection augment
      if (Math.random() < .04 * dropMul && this.fitems.length < 3) this.fitems.push({ id: this.eid++, k: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], x: e.x, z: e.z });
    }
  };
  P._killFx = function (e) { this._fx(e.x, e.z, !!ETYPES[e.ty]?.boss, PAL.redHex); const m = this.eMeshes.get(e.id); if (m) { if (m.bossBar) this.scene.remove(m.bossBar); this.scene.remove(m); this.eMeshes.delete(e.id); } }
  P._grantXp = function (v) { this._setXp(this.xp + v); }
  P._setXpTotal = function (total) { // joiner path: host sends cumulative XP — rebuild lv/remainder
    let lv = 1, rem = total;
    while (rem >= XP_NEED(lv)) { rem -= XP_NEED(lv); lv++; }
    const gained = lv - this.lv;
    this.xp = rem;
    if (gained <= 0) { this.lv = Math.max(this.lv, lv); return; }
    this.lv = lv; this.pendUp += gained;
    this._beep(600, .12, 'square', .06); this._beep(900, .18, 'square', .05);
    if (this.scene) {
      this._fx(this.me.x, this.me.z, this.lv % 5 === 0 || gained > 1, PAL.cyanHex);
      if (this.allyOn) this._fx(this.ally.x, this.ally.z, false, PAL.cyanHex);
      if (this.lvEl.animate) this.lvEl.animate([{ transform: 'scale(1.55)', color: '#7ee8ff' }, { transform: 'scale(1)' }], { duration: 380 });
      if (this.lv % 5 === 0) { this._banner(`⬆ 레벨 ${this.lv} 돌파!`, 2600); this._beep(880, .18, 'square', .06); }
    }
    if (this.pendUp > 0 && this.upEl.style.display === 'none' && !this.over && this.phase !== 'assault') this._showUpgrades();
  };
  P._setXp = function (v) {
    this.xp = v;
    const lv0 = this.lv;
    let need = XP_NEED(this.lv);
    while (this.xp >= need) { this.xp -= need; this.lv++; need = XP_NEED(this.lv); this.pendUp++; if (this.mode === 'solo') this._botUpgrade(); this._beep(600, .12, 'square', .06); this._beep(900, .18, 'square', .05); }
    if (this.lv > lv0 && this.scene) { // level-up flair on the units + HUD
      const milestone = this.lv % 5 === 0 || this.lv - lv0 > 1;
      this._fx(this.me.x, this.me.z, milestone, PAL.cyanHex);
      if (this.allyOn) this._fx(this.ally.x, this.ally.z, false, PAL.cyanHex);
      if (this.lvEl.animate) this.lvEl.animate([{ transform: 'scale(1.55)', color: '#7ee8ff' }, { transform: 'scale(1)' }], { duration: 380 });
      if (this.lv % 5 === 0) { this._banner(`⬆ 레벨 ${this.lv} 돌파!`, 2600); this._beep(880, .18, 'square', .06); this._beep(1180, .22, 'square', .05); }
    }
    // solo pauses while the sheet is open, so it can open any time. multiplayer:
    // build phase opens immediately, assault holds as a chip (see _hudTick).
    if (this.pendUp > 0 && this.upEl.style.display === 'none' && !this.over && (this.mode === 'solo' || this.phase !== 'assault')) this._showUpgrades();
  };
  P._coreAug = function (add, heal) { // core augment — host-authoritative; joiners forward the request
    if (this.isHostish()) { this.coreMax += add; this.coreHp = Math.min(this.coreMax, this.coreHp + heal); this._coreBanT = this.tm; }
    else this._send({ t: 'caug', a: add, h: heal });
  };
  P._botUpgrade = function () {
    const p = this.ally;
    const pool = UPG.filter(u => (p.taken[u.k] || 0) < u.t.length);
    if (!pool.length) return;
    const u = pool[Math.floor(Math.random() * pool.length)], tier = p.taken[u.k] || 0;
    u.t[tier].f(p, this); p.taken[u.k] = tier + 1; this._checkSyn(p, false);
  };
  P._checkSyn = function (p, mine) { // combo of taken card lines → one-time evolution bonus
    p.syn = p.syn || {};
    for (const s of SYN) {
      if (p.syn[s.id] || !s.need.every(k => p.taken[k])) continue;
      p.syn[s.id] = 1; s.f(p, this);
      if (mine) { this._banner(`✦ 시너지 각성 — ${s.n}! ${s.d}`, 3800); this._beep(660, .12, 'square', .06); this._beep(990, .16, 'square', .05); }
    }
  };
  P._dash = function (p) {
    if (p.down || p.dashT > 0 || this.phase !== 'assault' && this.phase !== 'build') return;
    p.dashT = p.dashCd; p.dashing = p.dashDur || .18; this._beep(300, .07, 'triangle', .04);
  };
  P._useSkill = function () {
    const p = this.me;
    if (p.down || p.sklT > 0 || (this.phase !== 'assault' && this.phase !== 'build')) return;
    p.sklT = Math.max(6, 14 - p.sklLv);
    if (this.isHostish()) this._shockwave(p.x, p.z, p.sklLv, true);
    else { this._shockFx(p.x, p.z, p.sklLv); this._send({ t: 'skl', x: +p.x.toFixed(1), z: +p.z.toFixed(1), lv: p.sklLv }); }
  };
  P._shockFx = function (x, z, lv) { this._fx(x, z, true, PAL.cyanHex); this.shake = Math.max(this.shake || 0, .5); this._beep(220, .25, 'sawtooth', .08); }
  P._shockwave = function (x, z, lv, fx) {
    if (fx !== false) this._shockFx(x, z, lv);
    const r = 3.5 + lv * .5, dmg = 40 + lv * 20;
    for (const e of [...this.enemies.values()]) {
      if (dist2(x, z, e.x, e.z) < r * r) {
        const d = Math.sqrt(dist2(x, z, e.x, e.z)) || 1;
        e.x = clamp(e.x + (e.x - x) / d * 2.2, 1 - HALF, HALF - 1); e.z = clamp(e.z + (e.z - z) / d * 2.2, 1 - HALF, HALF - 1);
        this._dmgEnemy(e, dmg);
      }
    }
  };
  P._useItem = function (idx) {
    const p = this.me; if (p.down || (this.phase !== 'assault' && this.phase !== 'build')) return;
    const k = p.items[idx ?? 0]; if (!k) return;
    p.items.splice(idx ?? 0, 1);
    this._applyItemFx(k, p.x, p.z, true);
    if (this.mode !== 'solo') this._send({ t: 'use', k, x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  };
  P._applyItemFx = function (k, x, z, mine) {
    this._fx(x, z, true, k === 'bomb' ? 0xffffff : PAL.cyanHex); this._beep(500, .15, 'square', .06);
    if (k === 'bomb') {
      if (this.isHostish()) for (const e of [...this.enemies.values()]) this._dmgEnemy(e, 90, mine ? null : { ally: true });
      this._banner('융단 폭격 — 전 구역 타격');
      for (let i = 0; i < 22; i++) setTimeout(() => { if (!this._dead && this.scene) { this._fx(rnd(4 - HALF, HALF - 4), rnd(4 - HALF, HALF - 4), i % 5 === 0, 0xffffff); this.shake = Math.max(this.shake || 0, .3); } }, i * 70);
    }
    else if (k === 'turret') { if (this.isHostish()) { const i = ti(w2g(x), w2g(z)); const spots = [i, i + 1, i - 1, i + N, i - N].filter(j => j >= 0 && j < N * N && !this.occ[j]); if (spots.length) { this._place(spots[0], 2); this.bld[spots[0]] = .75; this.sendStT = 0; } } }
    else if (k === 'kit') { if (mine) this.me.hp = this.me.maxhp; }
    else if (k === 'slow') { this.slowT = 5; this._banner('지연 필드 — 적 감속'); }
  };
  P._hurt = function (p, v) {
    if (p.down || p.dashing > 0 || this.over) return;
    p.hp -= v * (p.armor || 1); this._beep(140, .08, 'sawtooth', .05);
    if (p === this.me) { this.dmgFlash = 1; this.shake = Math.max(this.shake || 0, .35); }
    if (p.hp <= 0) { p.hp = 0; p.down = true; p.downT = 40; p.revP = 0; if (p === this.me) this._banner('쓰러짐 — 동료의 구조 대기'); }
  };
  P._dealToPlayer = function (p, v) {
    if (p === this.me) this._hurt(this.me, v);
    else if (this.mode === 'solo') this._hurt(this.ally, v);
    else this._send({ t: 'dmg', v: +v.toFixed(1) });
  };
  P._turretSim = function (dt) {
    this._turCd = this._turCd || {};
    for (let i = 0; i < N * N; i++) {
      if (this.occ[i] !== 2 || this.bld[i] < 1) continue; // under construction — offline
      const cd = (this._turCd[i] || 0) - dt; this._turCd[i] = cd;
      if (cd > 0) continue;
      const x = g2w(i % N), z = g2w((i / N) | 0);
      let best = null, bd = 90; for (const e of this.enemies.values()) { const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
      if (best) { this._turCd[i] = .3; const a = Math.atan2(best.z - z, best.x - x); this._spawnBullet(x, z, Math.cos(a) * 19, Math.sin(a) * 19, { dmg: 8 * this.g.turMul, tur: true, band: this._turBand() }); }
    }
  };
  P._pickupSim = function () {
    for (const f of [...this.fitems]) {
      const meN = dist2(f.x, f.z, this.me.x, this.me.z) < 1.7, alN = this.allyOn && dist2(f.x, f.z, this.ally.x, this.ally.z) < 1.7;
      if (meN && !this.me.down && this.me.items.length < INV_MAX) { this.me.items.push(f.k); this.fitems = this.fitems.filter(q => q !== f); this._beep(700, .1); this._banner(`아이템 획득 — ${ITEMS[f.k].n} (${this.me.items.length}/${INV_MAX})`, 2600); if (this.mode !== 'solo') this._send({ t: 'itm', who: 0, id: f.id, k: f.k }); }
      else if (alN && !this.ally.down && this.mode !== 'solo' && this.ally.items.length < INV_MAX) { this.ally.items.push(f.k); this.fitems = this.fitems.filter(q => q !== f); this._send({ t: 'itm', who: 1, id: f.id, k: f.k }); }
      else if (alN && this.mode === 'solo' && this.ally.items.length < INV_MAX) { this.ally.items.push(f.k); this.fitems = this.fitems.filter(q => q !== f); }
    }
  };
  P._movePlayer = function (dt) {
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
      this._meMoving = m > .01;
      if (this._meMoving) p.a = Math.atan2(rz, rx); // facing follows movement while moving
    } else { p.tilt = 0; this._meMoving = false; }
  };
  P._bulletSim = function (dt) {
    const host = this.isHostish();
    for (const b of this.bullets) {
      b.x += b.dx * dt; b.z += b.dz * dt; b.life -= dt;
      if (Math.abs(b.x) > HALF || Math.abs(b.z) > HALF) { b.life = 0; continue; }
      for (const e of this.enemies.values()) {
        if (dist2(b.x, b.z, e.x, e.z) < (ETYPES[e.ty].r + .2) ** 2) {
          this._fx(b.x, b.z, false, b.tur ? (b.band === 2 ? 0xd98aff : b.band === 1 ? PAL.amberHex : PAL.cyanHex) : !b.ally ? PAL.cyanHex : PAL.amberHex);
          if (!b.ghost) { if (host) this._dmgEnemy(e, b.dmg, b); else { e.flash = .12; this._send({ t: 'hit', id: e.id, d: +b.dmg.toFixed(1) }); } }
          if (b.pierce > 0) b.pierce--; else b.life = 0;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.life > 0);
    for (const b of this.ebullets) {
      b.x += b.dx * dt; b.z += b.dz * dt; b.life -= dt;
      if (host) {
        if (!this.me.down && dist2(b.x, b.z, this.me.x, this.me.z) < .49) { this._hurt(this.me, 6 * this._dMul() * (this.dmgWaveMul || 1)); b.life = 0; }
        else if (this.allyOn && !this.ally.down && dist2(b.x, b.z, this.ally.x, this.ally.z) < .49) { this._dealToPlayer(this.ally, 6 * this._dMul() * (this.dmgWaveMul || 1)); b.life = 0; }
      } else if (!this.me.down && dist2(b.x, b.z, this.me.x, this.me.z) < .49) { b.life = 0; }
    }
    this.ebullets = this.ebullets.filter(b => b.life > 0);
  };
  P.xpTotal = function () { let need = 0; for (let l = 1; l < this.lv; l++) need += XP_NEED(l); return need + this.xp; }
}
