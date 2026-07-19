// main.js — ErosionGame shell: lifecycle & orchestration. Feature methods live in sibling modules.
import { PV, CAP_WALL, CAP_TUR, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';
import { install as installScene } from './scene.js';
import { install as installModels } from './models.js';
import { install as installHud } from './hud.js';
import { install as installSheets } from './sheets.js';
import { install as installInput } from './input.js';
import { install as installNet } from './net.js';
import { install as installWorld } from './world.js';
import { install as installCombat } from './combat.js';
import { install as installWaves } from './waves.js';

class ErosionGame extends HTMLElement {
  connectedCallback() { this._dead = false; this._booted = false; setTimeout(() => { if (this.isConnected) this._init(); }, 0); }
  disconnectedCallback() { setTimeout(() => { if (!this.isConnected) this._destroy(); }, 0); }
  _destroy() {
    this._dead = true;
    cancelAnimationFrame(this._raf);
    clearInterval(this._helloIv); clearTimeout(this._banT); clearInterval(this._wdIv); clearTimeout(this._waitHintT); clearInterval(this._relayRetryIv);
    if (this.net) { try { this.net.end(true); } catch (e) {} this.net = null; }
    if (this.net2) { try { this.net2.end(true); } catch (e) {} this.net2 = null; }
    window.removeEventListener('resize', this._onRzBurst);
    window.removeEventListener('orientationchange', this._onRzBurst);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onRzBurst);
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    if (this.renderer) this.renderer.dispose();
    this.innerHTML = '';
  }
  _init() {
    if (this._dead || this._booted) return; this._booted = true;
    const A = k => this.getAttribute(k) || this[k];
    this.mode = A('mode') || 'solo';
    this.room = (A('room') || '').toUpperCase();
    this.diffKey = DIFF[A('diff')] !== undefined ? A('diff') : 'normal';
    this.diffMul = DIFF[this.diffKey];
    this.maxWave = parseInt(A('waves')) || 15;
    this.buildTime = parseInt(A('buildtime')) || 40;
    this._buildDOM(); this._initAudio(); this._reset();
    try { this._initThree(); } catch (e) {
      console.error('[erosion] WebGL init failed:', e);
      this._overlay(`<div style="font:700 20px ${FONT}">그래픽 초기화 실패</div><div style="font:400 13px ${FONT};margin-top:8px;line-height:1.6;color:${PAL.dim}">이 브라우저에서 WebGL을 사용할 수 없습니다.<br>하드웨어 가속을 켜거나 다른 브라우저로 시도하세요.</div><div style="margin-top:14px"><button id="egGlOut" style="${this._obtn(false)}">로비로</button></div>`);
      this.ovIn.querySelector('#egGlOut').onclick = () => this._exit();
      return;
    }
    this._bindInput();
    this._warmFx(); // pre-compile particle materials while the intro overlay covers the screen
    this._onVis = () => { this._bgPaused = document.hidden; if (!document.hidden) { this._ftAvg = 16; if (this.renderer) this.renderer.shadowMap.needsUpdate = true; } }; // wake-up spikes shouldn't judge the device; refresh any frozen shadows immediately
    document.addEventListener('visibilitychange', this._onVis);
    if (this.mode === 'solo') {
      let resumed = false;
      if (A('resume') === '1') { try { const s = JSON.parse(localStorage.getItem('eg_save') || 'null'); if (s && s.v === 1) { this._loadRun(s); resumed = true; } } catch (e) {} }
      if (!resumed) { this.phase = 'count'; this.countT = 3; }
    }
    else { this.phase = 'wait'; this._initNet(); }
    this._last = performance.now();
    const loop = (t) => { if (this._dead) return; this._raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - this._last) / 1000); this._last = t; this._tick(dt); };
    this._raf = requestAnimationFrame(loop);
    this._wdIv = setInterval(() => { if (this._dead) return; const now = performance.now(); if (now - this._last > 450) { const dt = Math.min(.05, (now - this._last) / 1000); this._last = now; this._tick(dt); } }, 500);
  }
  _exit() { this.dispatchEvent(new CustomEvent('erosion-exit', { bubbles: true, composed: true })); }
  _initAudio() {
    this.mute = true; let ctx = null; // opt-in audio — the HUD button starts at 소리 OFF to match
    this._beep = (f, dur, type, vol) => { if (this.mute) return;
      const now2 = performance.now(); // budget: max 6 beeps per 180ms — hit storms were spawning oscillators faster than GC could reap
      if (!this._beepWin || now2 - this._beepWin > 180) { this._beepWin = now2; this._beepN = 0; }
      if (++this._beepN > 6) return;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol || .05, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur); } catch (e) {} };
  }
  isHostish() { return this.mode === 'solo' || this.isHost; }
  _tick(dt) {
    if (!this.renderer) return;
    if (this.phase === 'count') {
      this.countT -= dt;
      if (this._infCount) this._infCountOverlay();
      else this._overlay(`<div style="font:700 11px ${FONT};letter-spacing:.18em;color:${PAL.red}">${this.diffKey === 'nightmare' ? 'PHASE 1 — 코어 방어' : 'EROSION PROTOCOL'}</div><div style="font:700 68px ${FONT};color:${PAL.cyan};text-shadow:0 0 24px rgba(37,216,255,.5)">${Math.ceil(this.countT)}</div><div style="font:400 13px ${FONT};line-height:1.7;color:${PAL.dim}">웨이브마다 무작위 균열 하나가 열린다.<br>붉게 빛나는 균열을 벽과 포탑으로 막고, 중앙의 정화 코어를 ${this.maxWave}웨이브 동안 지켜라.</div>`);
      if (this.countT <= 0) {
        this.phase = 'none'; this.ov.style.display = 'none';
        if (this._infCount) { this._infCount = null; this._buildInfMap(); }
        else if (this.isHostish()) this._startBuild();
      }
    }
    // pause sources: solo augment sheet, tab in background (mine OR peer's), host silent
    const inPhase = this.phase === 'build' || this.phase === 'assault' || this.phase === 'escape' || this.phase === 'inf';
    if (!this.isHostish() && inPhase && this._lastStateAt) this._hostLost = performance.now() - this._lastStateAt > 5000;
    if (this._peerPaused && performance.now() - (this._peerSeenAt || 0) > 4000) this._peerPaused = false; // partner gone silent — treat as disconnected, not paused
    const sheetPause = this.mode === 'solo' && this.upEl.style.display !== 'none';
    const paused = !this.over && (sheetPause || this._bgPaused || this._peerPaused || this._hostLost);
    const playing = inPhase && !paused;
    if (inPhase && !this.over && this.mode !== 'solo') this._netTick(dt); // keep net alive even while paused
    if (playing && !this.over) {
      this.tm += dt; this.slowT = Math.max(0, this.slowT - dt);
      this._movePlayer(dt); this._buildSim(dt);
      this._autoCombat(this.me, dt, true);
      if (this.mode === 'solo') this._botSim(dt);
      if (this.phase === 'escape') this._escapeSim();
      if (this.isHostish()) {
        if (this.phase === 'build') { this.phT -= dt; if (this.phT <= 0) { if (this.inf) this._startInfWave(); else this._startAssault(); } }
        else if (this.phase === 'escape') { /* waiting for a unit to enter the rift */ }
        else if (this.phase === 'inf') {
          this._spawnLogic(dt); this._enemySim(dt);
          if (!this.spawnQ.length && this.enemies.size === 0 && !this.infFinal) this._startFinale();
        }
        else if (this.phase === 'assault') { // guard: phases can flip to 'count' mid-tick (PHASE 2 transition)
          this._spawnLogic(dt); this._enemySim(dt);
          if (!this.spawnQ.length && this.enemies.size === 0) {
            if (this.wave >= this.maxWave) { this.diffKey === 'nightmare' ? this._startEscape() : this._gameOver(true, `${this.maxWave}웨이브 방어 완수`); } // PHASE 2 is nightmare-only
            else this._startBuild();
          }
        }
        this._turretSim(dt); this._pickupSim();
      } else {
        this.phT -= dt;
        for (const e of this.enemies.values()) { e.x += (e.tx - e.x) * Math.min(1, dt * 10); e.z += (e.tz - e.z) * Math.min(1, dt * 10); }
        this._turretSim(dt); // ghost shots — joiners never saw turrets fire (damage stays host-side)
      }
      this._bulletSim(dt); this._reviveSim(dt);
      const p = this.me; if (!p.down) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
      p.dashT = Math.max(0, p.dashT - dt); p.dashing = Math.max(0, p.dashing - dt); p.sklT = Math.max(0, p.sklT - dt);
      if (this.mode !== 'solo' && this.allyOn) { const a = this.ally; if (a.tx !== undefined) { a.x += (a.tx - a.x) * Math.min(1, dt * 12); a.z += (a.tz - a.z) * Math.min(1, dt * 12); a.a = a.ta || 0; } }
    }
    // battery: when the sim is idle (paused, waiting, game over), render at half rate
    if (!playing && ((this._fskip = ((this._fskip | 0) + 1)) & 1)) return;
    this._render(dt);
  }
}
[installScene, installModels, installHud, installSheets, installInput, installNet, installWorld, installCombat, installWaves].forEach(f => f(ErosionGame.prototype));
if (!customElements.get('erosion-game')) customElements.define('erosion-game', ErosionGame);
