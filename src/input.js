// input.js — pointer/keyboard/virtual-stick input and build-mode picking
import { PV, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._bindInput = function () {
    this.keys = {};
    this._kd = e => {
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft') { this._dash(this.me); e.preventDefault(); }
      if (e.code === 'KeyE') this._toggleInv();
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
  };
  P._pick = function (cx, cy) { // screen -> tile index
    const r = this.getBoundingClientRect();
    const v = new THREE.Vector3((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0);
    const rc = this._rc = this._rc || new THREE.Raycaster();
    rc.setFromCamera(v, this.cam);
    const t = rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!t || Math.abs(t.x) > HALF || Math.abs(t.z) > HALF) return -1;
    return ti(w2g(t.x), w2g(t.z));
  };
  P._ghostAt = function (cx, cy) {
    const i = this._pick(cx, cy);
    if (i < 0) { this.ghost.visible = false; return; }
    const gx = i % N, gz = (i / N) | 0;
    this.ghost.visible = true; this.ghost.position.set(g2w(gx), .7, g2w(gz));
    const ok = this.buildSel === 3 ? (this.occ[i] === 1 || this.occ[i] === 2) : (this._canPlace(i) && this.scrap >= this._cost(this.buildSel));
    this.ghost.material.color.setHex(ok ? (this.buildSel === 3 ? PAL.amberHex : PAL.cyanHex) : PAL.redHex);
  };
  P._buildAt = function (cx, cy) {
    const i = this._pick(cx, cy); if (i < 0) return;
    this._ghostAt(cx, cy);
    if (this.buildSel === 3) this._trySell(i); else this._tryBuild(i, this.buildSel);
  };
}
