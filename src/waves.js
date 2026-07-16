// waves.js — verbatim methods from game.js (prototype-install)
import { PV, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._startBuild = function () {
    this.phase = 'build'; this.phT = this.wave === 0 ? this.buildTime + 10 : this.buildTime;
    this._pickGates(); // next assault pours through the active gate(s) — nightmare opens several
    if (this.mode === 'solo') this._saveRun();
    const bonus = Math.round((30 + this.wave * 12) * (DIFF_SCR[this.diffKey] || 1)); this.scrap += bonus; if (this.mode !== 'solo' && this.isHost) this.allyScrap += bonus;
    const dirs = this.activeGates.map(i => GATE_DIR[i]).join('·');
    if (this.wave > 0) { this._banner(`WAVE ${this.wave} 방어 성공 — 자원 +${bonus} · 다음 균열: ${dirs}쪽`, 3600); if (this.mode === 'solo' && Math.random() < .7) this._botUpgrade(); }
    else this._banner(`준비 단계 — ${dirs}쪽 균열을 막아라 (건설 버튼)`, 4200);
    if (this.fitems.length < 2 && this.wave > 0) { const g = this.gates[Math.floor(Math.random() * 4)]; this.fitems.push({ id: this.eid++, k: ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)], x: rnd(-8, 8), z: rnd(-8, 8) }); }
  };
  P._startAssault = function () {
    this.wave++; this.phase = 'assault';
    this.dmgWaveMul = 1 + (this.wave - 1) * .05; // late waves hit harder, not just tankier
    this._banner('WAVE ' + this.wave + ' — 습격!'); this._beep(180, .3, 'sawtooth', .07);
    const w = this.wave, q = [];
    let cntMul = DIFF_CNT[this.diffKey] || 1;
    if (this.diffKey === 'nightmare') cntMul = 1.25 + (2.5 - 1.25) * this._nmRamp(); // waves 1-3 ≈ hard, full 2.5x by wave 6
    const count = Math.round((14 + Math.min(w, 10) * 6 + Math.max(0, w - 10) * 3) * cntMul); // waves 11+ grow slower — 15 waves shouldn't become a swarm wall
    // guaranteed mix: ranged gunners from wave 2, breakers from wave 3, rest melee rushers
    const nG = w >= 2 ? Math.max(3, Math.round(count * .22)) : 0;
    const nB = w >= 3 ? Math.round(count * .25) : 0;
    for (let i = 0; i < count; i++) q.push(i < nG ? 2 : i < nG + nB ? 1 : 0);
    for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
    if (w % 5 === 0 || w === this.maxWave) q.push(3); // boss every 5th wave and on the final wave
    this.spawnQ = q; this.spawnT = .5;
  };
  P._spawnLogic = function (dt) {
    if (!this.spawnQ.length) return;
    this.spawnT -= dt; if (this.spawnT > 0) return;
    let sptMul = DIFF_SPT[this.diffKey] || 1;
    if (this.diffKey === 'nightmare') sptMul = .88 + (.5 - .88) * this._nmRamp();
    this.spawnT = Math.max(.24, (.7 - this.wave * .035) * sptMul);
    const burst = Math.min(3, 1 + ((this.wave / 3) | 0)); // w1-2: 1, w3-5: 2, w6+: 3 at once
    for (let bn = 0; bn < burst && this.spawnQ.length; bn++) this._spawnOne();
  };
  P._spawnOne = function () {
    const ty = this.spawnQ.shift();
    const g = this.gates[this.activeGates[Math.floor(Math.random() * this.activeGates.length)]]; // wave streams through the active gate(s)
    const id = this.eid++;
    const hpMul = (1 + (this.wave - 1) * .18) * this._dMul();
    // spawn OUTSIDE the gate, spread across its widened front, walk in
    const nx = g.gx === 0 ? -1 : g.gx === N - 1 ? 1 : 0, nz = g.gz === 0 ? -1 : g.gz === N - 1 ? 1 : 0;
    const off = rnd(1.8, 4), lat = rnd(-4.6, 4.6);
    const e = { id, ty, x: g.x + nx * off + lat * (nz ? 1 : 0), z: g.z + nz * off + lat * (nx ? 1 : 0), hp: ETYPES[ty].hp * hpMul, cool: 0, shootT: rnd(0, 2), entering: true, gx: g.x + lat * (nz ? 1 : 0), gz: g.z + lat * (nx ? 1 : 0), wsp: 1 + (this.wave - 1) * .035 };
    if (ETYPES[ty].boss) { // boss tiers: w5 mid, w10 heavy, final wave = colossal structure-wrecker
      e.btier = this.wave >= this.maxWave ? 3 : this.wave >= 10 ? 2 : 1;
      if (e.btier === 2) { e.hp *= 4; e.wsp *= 1.15; }
      else if (e.btier === 3) { e.final = true; e.hp *= 14; e.smash = 2; e.wsp *= 1.4; } // colossal but NOT slow
    }
    e.mhp = e.hp;
    this.enemies.set(id, e);
    if (ETYPES[ty].boss) { this._banner(e.btier === 3 ? '⚠ 최종 보스 출현!' : e.btier === 2 ? '⚠ 대형 보스 출현!' : '⚠ 중간 보스 출현!', 3200); this._beep(70, .5, 'sawtooth', .09); this.shake = Math.max(this.shake || 0, .5); }
  };
  P._enemySim = function (dt) {
    const slow = this.slowT > 0 ? .5 : 1;
    const players = [this.me]; if (this.allyOn) players.push(this.ally);
    { // soft separation: enemies sharing a tile push apart — kills the stacked-blob look and mobile overdraw
      const grid = this._sepGrid = this._sepGrid || new Map();
      grid.clear();
      for (const e of this.enemies.values()) { if (e.entering) continue; const k = ti(w2g(e.x), w2g(e.z)); const arr = grid.get(k); if (arr) arr.push(e); else grid.set(k, [e]); }
      for (const arr of grid.values()) {
        for (let i = 1; i < arr.length; i++) { // chained pair repulsion — converges over frames, stays O(E)
          const a = arr[i - 1], c = arr[i];
          let dx = c.x - a.x, dz = c.z - a.z; const d2 = dx * dx + dz * dz;
          if (d2 > .49) continue;
          const d = Math.sqrt(d2) || .01, push = (0.7 - d) * .5;
          dx = d > .01 ? dx / d : 1; dz = d > .01 ? dz / d : 0;
          const heavyA = ETYPES[a.ty] && ETYPES[a.ty].boss, heavyC = ETYPES[c.ty] && ETYPES[c.ty].boss;
          if (!heavyC) { c.x = clamp(c.x + dx * push, 1 - HALF, HALF - 1); c.z = clamp(c.z + dz * push, 1 - HALF, HALF - 1); }
          if (!heavyA) { a.x = clamp(a.x - dx * push, 1 - HALF, HALF - 1); a.z = clamp(a.z - dz * push, 1 - HALF, HALF - 1); }
        }
      }
    }
    for (const e of this.enemies.values()) {
      const et = ETYPES[e.ty];
      if (e.stunT > 0) { e.stunT -= dt; continue; } // paralyzed — no move, no attack
      if (e.slowT2 > 0) e.slowT2 -= dt;
      let sp = et.sp * slow * this._dMul() * (e.wsp || 1) * (e.slowT2 > 0 ? (e.slowF || .7) : 1);
      e.cool -= dt;
      // spawned outside: walk in through the gate before anything else
      if (e.entering) {
        const dx = e.gx - e.x, dz = e.gz - e.z, d = Math.hypot(dx, dz);
        if (d > .4) { e.x += dx / d * sp * dt; e.z += dz / d * sp * dt; continue; }
        e.entering = false;
      }
      // nearest live player
      let np = null, npd = 1e9; for (const p of players) { if (p.down) continue; const d = dist2(e.x, e.z, p.x, p.z); if (d < npd) { npd = d; np = p; } }
      // ranged behaviour
      if (et.rng && np && npd < 81) {
        const d = Math.sqrt(npd);
        if (d > 7) { e.x += (np.x - e.x) / d * sp * dt; e.z += (np.z - e.z) / d * sp * dt; }
        else if (d < 4.5) { e.x -= (np.x - e.x) / d * sp * dt; e.z -= (np.z - e.z) / d * sp * dt; }
        e.shootT -= dt;
        if (e.shootT <= 0) { e.shootT = 2.8; const a = Math.atan2(np.z - e.z, np.x - e.x); const dx = Math.cos(a) * 8.5, dz = Math.sin(a) * 8.5;
          this.ebullets.push({ x: e.x, z: e.z, dx, dz, life: 3 }); if (this.mode !== 'solo') this._send({ t: 'eb', x: +e.x.toFixed(1), z: +e.z.toFixed(1), dx: +dx.toFixed(1), dz: +dz.toFixed(1) }); }
        continue;
      }
      // melee player if adjacent
      if (np && npd < (et.boss ? 11 : 5)) { if (e.cool <= 0) { e.cool = .9; this._dealToPlayer(np, et.dmg * this._dMul() * (this.dmgWaveMul || 1)); } continue; }
      // melee mobs hunt a nearby player; structures in the way get smashed
      if (!et.rng && !et.boss && np && npd < 49) {
        const dx = np.x - e.x, dz = np.z - e.z, d = Math.hypot(dx, dz) || 1;
        const bi2 = ti(w2g(e.x + dx / d * 1.3), w2g(e.z + dz / d * 1.3));
        const o2 = this.occ[bi2];
        if (o2 === 1 || o2 === 2) { if (e.cool <= 0) this._atkStruct(e, et, bi2); }
        else { e.x = clamp(e.x + dx / d * sp * dt, 1 - HALF, HALF - 1); e.z = clamp(e.z + dz / d * sp * dt, 1 - HALF, HALF - 1); }
        continue;
      }
      const gx = w2g(e.x), gz = w2g(e.z), here = ti(gx, gz);
      // breakers & bosses smash any adjacent structure; every enemy type retaliates against adjacent TURRETS.
      // reach scales with body radius — big bosses used to fail the old fixed 1.9u check and ignored structures
      if (e.cool <= 0) {
        const smasher = e.ty === 1 || et.boss;
        const rr = 1.5 + (et.r || .55) * (et.boss ? (e.final ? 2.4 : 1.9) : 1), rr2 = rr * rr; // bosses swing wide
        let hit = -1;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const X = gx + a, Z = gz + b; if (!inG(X, Z)) continue;
          const j = ti(X, Z), o2 = this.occ[j];
          if ((smasher ? (o2 === 1 || o2 === 2) : o2 === 2) && dist2(e.x, e.z, g2w(X), g2w(Z)) < rr2) { hit = j; break; }
        }
        if (hit >= 0) { this._atkStruct(e, et, hit); continue; }
      }
      // flow move — pick among near-best downhill neighbors (per-enemy stable choice) so columns fan out instead of single-filing
      let bi = -1, bd = this.flowD[here];
      {
        const cands = [];
        let best = 1e9;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = gx + a, Z = gz + b; if (!inG(X, Z)) continue;
          const j = ti(X, Z), dj = this.flowD[j];
          if (dj < bd) { cands.push([j, dj]); if (dj < best) best = dj; }
        }
        if (cands.length) {
          const near = cands.filter(c => c[1] <= best + 2);
          const pick = near[(e.id + gx * 7 + gz * 13) % near.length];
          bi = pick[0]; bd = pick[1];
        }
      }
      if (bi < 0) { // at core
        if (this.occ[here] === 3 || bd <= 1.5) { if (e.cool <= 0) { e.cool = 1; this._dmgCoreBy(et.dmg * this._dMul() * (this.dmgWaveMul || 1), e); } }
        continue;
      }
      const o = this.occ[bi];
      // per-enemy lateral bias inside the corridor — breaks the single-file look
      const lat = ((e.id % 7) - 3) * .3;
      const bx = g2w(bi % N) + ((bi % N) === gx ? lat : 0), bz = g2w((bi / N) | 0) + ((bi % N) === gx ? 0 : lat);
      if (o === 1 || o === 2) { // blocked: attack structure
        if (e.cool <= 0) this._atkStruct(e, et, bi);
        continue;
      }
      if (o === 3) { if (e.cool <= 0) { e.cool = 1; this._dmgCoreBy(et.dmg * this._dMul() * 2 * (this.dmgWaveMul || 1), e); } continue; }
      const dx = bx - e.x, dz = bz - e.z, d = Math.hypot(dx, dz) || 1;
      e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
      e.x = clamp(e.x, 1 - HALF, HALF - 1); e.z = clamp(e.z, 1 - HALF, HALF - 1);
    }
  };
  P._atkStruct = function (e, et, j) {
    e.cool = .8;
    const x = g2w(j % N), z = g2w((j / N) | 0);
    this.shp[j] -= et.sdmg * this._dMul() * (this.dmgWaveMul || 1) * (e.smash || 1); // final boss wrecks structures at 2x
    this._burst(x, z, PAL.redHex, 4, 4); this._beep(190, .05, 'square', .02);
    if (this.shp[j] <= 0) { this._fx(x, z, false, PAL.red7Hex); this._remove(j); }
  };
  P._dmgCoreBy = function (v, e) {
    this.coreHp -= v; this.shake = Math.max(this.shake || 0, .3);
    this._burst(this.coreMesh.position.x + rnd(-1, 1), this.coreMesh.position.z + rnd(-1, 1), PAL.cyanHex, 5, 4);
    this._coreHitFx();
    if (this.coreHp <= 0) { this.coreHp = 0; this._gameOver(false, '코어 파괴됨'); }
  };
  P._coreHitFx = function () { // shared by host (direct damage) and joiner (state diff): alert + escalating alarms
    this._coreHitT = this.tm;
    if (!this._coreBanT || this.tm - this._coreBanT > 4) {
      this._coreBanT = this.tm; this._banner('⚠ 코어 피격!'); this._beep(120, .2, 'sawtooth', .07);
      this.dmgFlash = Math.max(this.dmgFlash || 0, .45);
    }
    const r = this.coreHp / this.coreMax;
    if (r <= .25 && !this._al25) { this._al25 = this._al50 = true; this._banner('⚠ 코어 위험 — 25% 미만! 방어선을 복구하라', 3800); this._beep(90, .4, 'sawtooth', .09); this._beep(140, .4, 'sawtooth', .07); this.shake = Math.max(this.shake || 0, .5); }
    else if (r <= .5 && !this._al50) { this._al50 = true; this._banner('코어 손상 심각 — 잔량 50%', 3200); this._beep(110, .3, 'sawtooth', .08); }
  };
  P._botSim = function (dt) {
    const b = this.ally, me = this.me;
    if (b.down) return;
    // defend: nearest enemy to core, else near player
    let th = null, bd = 1e9;
    const cx = this.coreMesh.position.x, cz = this.coreMesh.position.z;
    for (const e of this.enemies.values()) { const d = dist2(cx, cz, e.x, e.z); if (d < bd) { bd = d; th = e; } }
    let gx, gz;
    if (me.down) { gx = me.x; gz = me.z; }
    else if (th) { const d = Math.sqrt(dist2(b.x, b.z, th.x, th.z)) || 1; const keep = 6; gx = th.x + (b.x - th.x) / d * keep; gz = th.z + (b.z - th.z) / d * keep; }
    else if (this.phase === 'build') { gx = cx + 4.5; gz = cz + 3; } // prep phase: hold position near the core
    else { gx = me.x + 2.2; gz = me.z + 1.5; }
    const dx = gx - b.x, dz = gz - b.z, d = Math.hypot(dx, dz);
    if (d > .6) { const nx = b.x + dx / d * b.speed * dt, nz = b.z + dz / d * b.speed * dt; if (!this._blockedAt(nx, b.z)) b.x = nx; if (!this._blockedAt(b.x, nz)) b.z = nz; if (!th) b.a = Math.atan2(dz, dx); }
    b.x = clamp(b.x, 1 - HALF, HALF - 1); b.z = clamp(b.z, 1 - HALF, HALF - 1);
    b.hp = Math.min(b.maxhp, b.hp + (1 + b.regen) * dt * .5);
    if (b.items && b.items.length && this.enemies.size > 6) { const k = b.items.shift(); this._applyItemFx(k, b.x, b.z, false); if (k === 'kit') b.hp = b.maxhp; }
    this._autoCombat(b, dt, false);
  };
  P._reviveSim = function (dt) {
    const near = (a, b) => dist2(a.x, a.z, b.x, b.z) < 7.3; // ~2.7 units — ships got bigger
    const doRev = (p, helper) => {
      if (!p.down) return;
      p.downT -= dt;
      if (helper && !helper.down && near(p, helper)) { p.revP += dt / 2.5; if (p.revP >= 1) { p.down = false; p.hp = p.maxhp * .5; p.revP = 0; p.downT = 0; this._beep(880, .2, 'square', .06); if (p === this.me) this._banner('부활 완료'); } }
      else p.revP = Math.max(0, p.revP - dt);
    };
    doRev(this.me, this.allyOn ? this.ally : null);
    if (this.mode === 'solo') doRev(this.ally, this.me);
    if (this.me.down) { this.revEl.style.display = 'block'; this.revEl.textContent = this.me.revP > 0 ? '구조 중… ' + Math.round(this.me.revP * 100) + '%' : '쓰러짐 — 동료가 접근해야 함 (' + Math.ceil(this.me.downT) + 's)'; }
    else if (this.allyOn && this.ally.down) { // rescuer view
      this.revEl.style.display = 'block';
      const nearAlly = dist2(this.me.x, this.me.z, this.ally.x, this.ally.z) < 7.3;
      this.revEl.textContent = nearAlly ? (this.mode === 'solo' && this.ally.revP > 0 ? '동료 구조 중… ' + Math.round(this.ally.revP * 100) + '%' : '동료 구조 중… 곁을 지켜라') : '동료 다운! 화살표를 따라가 구조하라';
    }
    else this.revEl.style.display = 'none';
    if (this.isHostish() && !this.over) {
      const allyDown = this.allyOn ? this.ally.down : false;
      if (this.me.down && (allyDown || !this.allyOn)) this._gameOver(false, '전 유닛 무력화');
      if (this.me.down && this.me.downT <= 0) this._gameOver(false, '구조 실패');
    }
  };
  P._gameOver = function (win, why, fromNet) {
    if (this.over) return; this.over = { win, why };
    this.phase = 'over';
    if (this.mode === 'solo') { // run ended: clear resume save, record stats
      try {
        localStorage.removeItem('eg_save');
        const st = JSON.parse(localStorage.getItem('eg_stats') || '{}');
        st.plays = (st.plays || 0) + 1;
        if (win) st.wins = (st.wins || 0) + 1;
        st.bestWave = Math.max(st.bestWave || 0, win ? this.maxWave : this.wave);
        localStorage.setItem('eg_stats', JSON.stringify(st));
      } catch (e) {}
    }
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
  };
}
