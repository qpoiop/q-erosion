// hud.js — verbatim methods from game.js (prototype-install)
import { N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._buildDOM = function () {
    this.style.cssText = 'position:fixed;inset:0;z-index:50;display:block;background:#0b0c10;font-family:' + FONT + ';color:' + PAL.text + ';touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden';
    const H = (t, s, parent) => { const e = document.createElement(t); e.style.cssText = s; (parent || this).appendChild(e); return e; };
    this.H = H;
    this.cv = H('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block');
    this.vig = H('div', 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(255,40,20,.55);opacity:0;transition:opacity .12s');
    const hud = this.hud = H('div', 'position:absolute;inset:0;pointer-events:none');
    const pe = 'pointer-events:auto;';
    const panel = 'background:' + PAL.panel + ';border:1px solid ' + PAL.line + ';backdrop-filter:blur(6px);';
    // top-left: wave/timer + core + players + scrap — one panel, keeps center clear
    const tl = H('div', 'position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:5px;width:170px;background:rgba(12,14,20,.55);border:1px solid rgba(58,64,82,.55);backdrop-filter:blur(4px);padding:8px', hud);
    const tcRow = H('div', 'display:flex;align-items:baseline;gap:7px', tl);
    this.wvEl = H('div', 'font-size:13px;font-weight:700;letter-spacing:.06em', tcRow);
    this.phEl = H('div', 'font-size:10px;font-weight:700;letter-spacing:.06em;color:' + PAL.dim, tcRow);
    const cbRow = H('div', 'display:flex;align-items:center;gap:6px', tl);
    const cb = H('div', 'flex:1;height:5px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5)', cbRow);
    this.coreF = H('div', 'height:100%;width:100%;background:linear-gradient(90deg,' + PAL.cyan + ',#7ee8ff);box-shadow:0 0 10px ' + PAL.cyan, cb);
    this.coreLab = H('div', 'font-size:9px;font-weight:700;letter-spacing:.04em;color:' + PAL.dim + ';white-space:nowrap', cbRow);
    this.goBtn = H('button', pe + 'font:700 11px ' + FONT + ';border:1px solid ' + PAL.red + ';background:rgba(255,59,42,.15);color:' + PAL.red + ';padding:4px 0;width:100%;cursor:pointer;letter-spacing:.06em;display:none', tl);
    this.goBtn.textContent = '습격 즉시 개시 ▶';
    this.goBtn.onclick = () => { if (this.isHostish() && this.phase === 'build' && this.phT > 1.2) { this.phT = Math.min(this.phT, 1); this._banner('⚔ 습격 개시!', 1800); this._beep(240, .2, 'sawtooth', .07); this.goBtn.textContent = '습격 개시!'; this.goBtn.style.background = PAL.red; this.goBtn.style.color = '#fff'; setTimeout(() => { this.goBtn.textContent = '습격 즉시 개시 ▶'; this.goBtn.style.background = 'rgba(255,59,42,.15)'; this.goBtn.style.color = PAL.red; }, 1200); } };
    H('div', 'border-top:1px solid ' + PAL.line, tl);
    this.pbar = {}; ['me', 'ally'].forEach(k => {
      const row = H('div', 'display:flex;flex-direction:column;gap:3px', tl);
      const lab = H('div', 'font-size:10px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;color:' + PAL.dim, row);
      const bo = H('div', 'height:8px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5)', row);
      const f = H('div', 'height:100%;width:100%;transition:width .15s', bo);
      this.pbar[k] = { lab, f, row };
    });
    this.pbar.me.lab.textContent = '나 · 유닛-A';
    // scrap
    const sc = H('div', 'display:flex;align-items:center;gap:7px;border-top:1px solid ' + PAL.line + ';padding-top:7px;margin-top:2px', tl);
    H('div', 'width:10px;height:10px;background:' + PAL.amber + ';box-shadow:0 0 10px ' + PAL.amber, sc);
    this.scEl = H('div', 'font:700 19px ' + FONT + ';color:' + PAL.amber + ';text-shadow:0 0 10px rgba(255,176,32,.45)', sc);
    H('div', 'font-size:10px;color:' + PAL.dim + ';letter-spacing:.08em', sc).textContent = '보유 자원';
    // top-right
    const tr = H('div', 'position:absolute;top:10px;right:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px', hud);
    const trb = H('div', 'display:flex;gap:5px', tr);
    const smBtn = txt => { const b = H('button', pe + 'font:700 11px ' + FONT + ';border:1px solid ' + PAL.line + ';background:' + PAL.panel + ';color:' + PAL.text + ';padding:6px 9px;cursor:pointer;letter-spacing:.05em', trb); b.textContent = txt; return b; };
    this.sndBtn = smBtn('소리 ON');
    this.sndBtn.onclick = () => { this.mute = !this.mute; this.sndBtn.textContent = this.mute ? '소리 OFF' : '소리 ON'; };
    const xb = smBtn('나가기 ✕'); xb.style.borderColor = PAL.red7; xb.onclick = () => this._exitConfirm();
    this.mm = H('canvas', 'position:absolute;right:10px;top:48px;width:104px;height:104px;border:1px solid rgba(58,64,82,.7);border-radius:50%;background:transparent', hud);
    this.mm.width = 104; this.mm.height = 104;
    // bottom-center XP
    const bc = H('div', 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;' + panel + 'padding:6px 12px', hud);
    this.lvEl = H('div', 'font-size:13px;font-weight:700;letter-spacing:.08em;color:' + PAL.cyan, bc);
    const xpb = H('div', 'width:140px;height:6px;border:1px solid ' + PAL.line + ';background:rgba(0,0,0,.5);overflow:hidden', bc);
    this.xpF = H('div', 'height:100%;width:0%;background:' + PAL.cyan + ';box-shadow:0 0 8px ' + PAL.cyan, xpb);
    // pending level-up chip (assault: cards wait here instead of auto-opening)
    this.upChip = H('button', pe + 'font:700 11px ' + FONT + ';border:1px solid ' + PAL.cyan + ';background:rgba(37,216,255,.14);color:' + PAL.cyan + ';padding:5px 11px;cursor:pointer;letter-spacing:.06em;display:none;animation:egUpPulse 1.1s ease-in-out infinite', bc);
    this.upChip.onclick = () => { if (this.pendUp > 0 && this.upEl.style.display === 'none') this._showUpgrades(); };
    const pulseCss = document.createElement('style');
    pulseCss.textContent = '@keyframes egUpPulse { 0%,100% { box-shadow:0 0 4px rgba(37,216,255,.3); } 50% { box-shadow:0 0 16px rgba(37,216,255,.75); } } @keyframes egGateBlink { 0%,100% { opacity:.55; } 50% { opacity:1; } }';
    this.appendChild(pulseCss);
    // first-wave controls hint
    this.hintEl = H('div', 'position:absolute;bottom:88px;left:50%;transform:translateX(-50%);font:400 11px ' + FONT + ';color:' + PAL.dim + ';letter-spacing:.05em;display:none;text-align:center;background:rgba(12,14,20,.45);padding:4px 12px;border:1px solid rgba(58,64,82,.4)', hud);
    this.hintEl.textContent = ('ontouchstart' in window) ? '드래그 이동 · 대시(무적 돌진)/아이템 버튼 · 건설/연구는 좌하단' : '이동 WASD · 대시 Space(무적 돌진) · 아이템 E · 건설/연구는 좌하단';
    // owned card lines (tier-colored) + awakened synergy badges
    this.ownedEl = H('div', 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:4px;flex-wrap:wrap;justify-content:center;max-width:64vw', hud);
    this.synEl = H('div', 'position:absolute;bottom:64px;left:50%;transform:translateX(-50%);display:flex;gap:5px;flex-wrap:wrap;justify-content:center;max-width:60vw', hud);
    // square action buttons — uniform centered label layout
    const sqBtn = (parent, label, accent) => {
      const b = H('button', pe + 'width:68px;height:68px;border:1px solid ' + (accent || PAL.line) + ';background:' + PAL.panel + ';color:' + (accent || PAL.text) + ';font:700 12px ' + FONT + ';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;gap:2px;text-align:center;backdrop-filter:blur(6px);line-height:1.3', parent);
      b.textContent = label; return b;
    };
    const press = (b, fn) => { b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
    // skill buttons (right)
    const br = H('div', 'position:absolute;bottom:18px;right:14px;display:flex;gap:10px;align-items:flex-end', hud);
    this.sklBtn = sqBtn(br, '충격파'); this.dashBtn = sqBtn(br, '대시');
    press(this.dashBtn, () => this._dash(this.me)); press(this.sklBtn, () => this._useSkill());
    // build bar (left): 건설 · 연구 · 아이템
    const bl = H('div', 'position:absolute;bottom:18px;left:14px;display:flex;flex-direction:column;gap:8px;align-items:flex-start', hud);
    this.chipRow = H('div', 'display:none;flex-direction:column;gap:6px', bl);
    this.chips = [];
    const mkChip = (label, sel) => { const b = H('button', pe + 'min-width:104px;border:1px solid ' + PAL.line + ';background:' + PAL.panel + ';color:' + PAL.text + ';font:700 12px ' + FONT + ';cursor:pointer;padding:9px 10px;text-align:left;backdrop-filter:blur(6px)', this.chipRow); b.textContent = label; press(b, () => { this.buildSel = sel; this._buildBarSync(); }); this.chips.push(b); return b; };
    this.wallChip = mkChip('벽', 1); this.turChip = mkChip('포탑', 2); this.sellChip = mkChip('판매 (70%)', 3);
    const blRow = H('div', 'display:flex;gap:8px', bl);
    this.buildBtn = sqBtn(blRow, '건설', PAL.cyan);
    press(this.buildBtn, () => { this.buildMode = !this.buildMode; this._buildBarSync(); });
    this.shopBtn = sqBtn(blRow, '연구', PAL.amber);
    press(this.shopBtn, () => this._toggleShop());
    this.itemBtn = sqBtn(blRow, '아이템');
    press(this.itemBtn, () => this._toggleInv());
    // item inventory sheet — pick one of the carried items to use
    this.invBg = H('div', 'position:absolute;inset:0;display:none;background:rgba(5,6,10,.45);z-index:24;' + pe, hud);
    this.invBg.addEventListener('pointerdown', e => { e.stopPropagation(); this._toggleInv(false); });
    this.invEl = H('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;gap:8px;z-index:25;' + pe + panel + 'padding:16px;min-width:min(86vw,320px);max-height:70vh;overflow:auto', hud);
    // banner / revive
    this.ban = H('div', 'position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(12,14,20,.6);border:1px solid rgba(58,64,82,.55);backdrop-filter:blur(4px);color:' + PAL.text + ';font:700 12px ' + FONT + ';padding:6px 13px;letter-spacing:.07em;display:none;white-space:nowrap;border-left:3px solid ' + PAL.red, hud);
    this.revEl = H('div', 'position:absolute;left:50%;top:58%;transform:translateX(-50%);display:none;' + panel + 'padding:7px 14px;font:700 12px ' + FONT, hud);
    // level-up sheet — fullscreen overlay, gameplay pauses beneath it (solo)
    this.upEl = H('div', 'position:absolute;inset:0;display:none;flex-direction:column;gap:16px;align-items:center;justify-content:center;background:rgba(5,6,10,.72);backdrop-filter:blur(3px);z-index:40;' + pe, hud);
    this.upTitle = H('div', 'background:' + PAL.red + ';color:#fff;font:700 15px ' + FONT + ';padding:8px 20px;letter-spacing:.12em;box-shadow:0 0 20px rgba(255,59,42,.55)', this.upEl);
    this.upRow = H('div', 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:92vw', this.upEl);
    this.upHint = H('div', 'font:400 11px ' + FONT + ';color:' + PAL.dim + ';letter-spacing:.06em', this.upEl);
    this.upHint.textContent = '카드를 선택하면 게임이 재개됩니다';
    // shop sheet
    this.shopBg = H('div', 'position:absolute;inset:0;display:none;background:rgba(5,6,10,.45);z-index:20;' + pe, hud);
    this.shopBg.addEventListener('pointerdown', e => { e.stopPropagation(); this._toggleShop(); });
    this.shopEl = H('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;flex-direction:column;gap:8px;z-index:21;' + pe + panel + 'padding:16px;max-width:min(92vw,560px);max-height:76vh;overflow:auto', hud);
    // overlay
    this.ov = H('div', 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,10,.82);backdrop-filter:blur(4px);' + pe, hud);
    this.ovIn = H('div', 'max-width:430px;width:min(86vw,430px);border:1px solid ' + PAL.line + ';border-top:3px solid ' + PAL.red + ';background:rgba(13,15,21,.96);padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.6)', this.ov);
  };
  P._buildBarSync = function () {
    this.chipRow.style.display = this.buildMode ? 'flex' : 'none';
    this.buildBtn.style.background = this.buildMode ? 'rgba(37,216,255,.18)' : PAL.panel;
    this.buildBtn.textContent = this.buildMode ? '건설 종료' : '건설';
    if (this.ghost) this.ghost.visible = false;
    const sel = this.buildSel;
    this.wallChip.textContent = `벽 · ${this._cost(1)}`; this.turChip.textContent = `포탑 · ${this._cost(2)}`;
    [this.wallChip, this.turChip, this.sellChip].forEach((c, i) => { const on = sel === i + 1; c.style.borderColor = on ? PAL.cyan : PAL.line; c.style.color = on ? PAL.cyan : PAL.text; c.style.background = on ? 'rgba(37,216,255,.14)' : PAL.panel; });
  };
  P._obtn = function (primary) { return `font:700 13px ${FONT};border:1px solid ${primary ? PAL.red : PAL.line};background:${primary ? PAL.red : 'transparent'};color:${primary ? '#fff' : PAL.text};padding:10px 16px;cursor:pointer;letter-spacing:.04em`; }
  P._hudReset = function () { if (this.upEl) { this.upEl.style.display = 'none'; this.shopEl.style.display = 'none'; if (this.shopBg) { this.shopBg.style.display = 'none'; this.shopBtn.textContent = '연구'; this.shopBtn.style.background = PAL.panel; } if (this.invEl) { this.invEl.style.display = 'none'; this.invBg.style.display = 'none'; } this.ov.style.display = 'none'; this.buildMode = false; this._buildBarSync(); } }
  P._banner = function (t, ms) { this.ban.textContent = t; this.ban.style.display = 'block'; clearTimeout(this._banT); this._banT = setTimeout(() => this.ban.style.display = 'none', ms || 2600); }
  P._exitConfirm = function () { // exit button & browser-back both land here
    if (this.phase === 'over' || this.phase === 'wait') { this._exit(); return; } // no game in progress — leave directly
    if (this._exitCfEl) return;
    const d = this._exitCfEl = this.H('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,6,10,.55);pointer-events:auto', this.hud);
    const box = this.H('div', `background:${PAL.panel};border:1px solid ${PAL.line};border-top:3px solid ${PAL.red};padding:20px 26px;display:flex;flex-direction:column;gap:10px;align-items:center;backdrop-filter:blur(6px)`, d);
    box.innerHTML = `<div style="font:700 15px ${FONT}">게임을 나갈까요?</div><div style="font:400 12px ${FONT};color:${PAL.dim}">진행 상황은 저장되지 않습니다.</div>`;
    const row = this.H('div', 'display:flex;gap:8px;margin-top:4px', box);
    const mk = (t, primary) => { const b = this.H('button', `font:700 13px ${FONT};padding:9px 22px;cursor:pointer;border:1px solid ${primary ? PAL.red : PAL.line};background:${primary ? PAL.red : 'transparent'};color:${primary ? '#fff' : PAL.text}`, row); b.textContent = t; return b; };
    mk('계속하기', false).onclick = () => { d.remove(); this._exitCfEl = null; };
    mk('나가기', true).onclick = () => { d.remove(); this._exitCfEl = null; this._exit(); };
  };
  P._overlay = function (html) { this.ov.style.display = 'flex'; this.ovIn.innerHTML = html; }
  P._buyCount = function (id) { return this.me.buys[id] || 0; }
  P._shopCost = function (u) { return Math.round(u.cost * Math.pow(1.5, this._buyCount(u.id))); }
  P._toggleInv = function (force) {
    const open = force !== undefined ? force : this.invEl.style.display !== 'flex';
    if (open && !this.me.items.length) { this._banner('보유한 아이템이 없습니다'); return; }
    this.invEl.style.display = open ? 'flex' : 'none';
    this.invBg.style.display = open ? 'block' : 'none';
    if (open) this._renderInv();
  };
  P._renderInv = function () {
    const el = this.invEl; el.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = `display:flex;justify-content:space-between;align-items:center;font:700 13px ${FONT};letter-spacing:.1em`;
    head.innerHTML = `<span>인벤토리 <span style="color:${PAL.dim}">${this.me.items.length}/${INV_MAX}</span></span>`;
    const close = document.createElement('button');
    close.textContent = '✕'; close.style.cssText = `background:transparent;border:none;color:${PAL.dim};font:700 14px ${FONT};cursor:pointer;padding:2px 6px`;
    close.onclick = () => this._toggleInv(false); head.appendChild(close);
    el.appendChild(head);
    this.me.items.forEach((k, idx) => {
      const it = ITEMS[k];
      const row = document.createElement('button');
      row.style.cssText = `display:flex;gap:10px;align-items:center;text-align:left;background:rgba(20,23,32,.85);border:1px solid ${PAL.line};padding:10px 12px;cursor:pointer;color:${PAL.text}`;
      row.innerHTML = `<span style="font-size:20px">${it.i || '▪'}</span><span style="flex:1"><span style="font:700 13px ${FONT};display:block">${it.n}</span><span style="font:400 11px ${FONT};color:${PAL.dim}">${it.d || ''}</span></span><span style="font:700 11px ${FONT};color:${PAL.cyan}">사용</span>`;
      row.onclick = () => { this._useItem(idx); this._beep(500, .1); this.me.items.length ? this._renderInv() : this._toggleInv(false); };
      el.appendChild(row);
    });
    const note = document.createElement('div');
    note.textContent = '단축키 E — 인벤토리 열기/닫기';
    note.style.cssText = `font:400 10.5px ${FONT};color:${PAL.dim};letter-spacing:.05em;text-align:center;margin-top:2px`;
    el.appendChild(note);
  };
  P._toggleShop = function () {
    const open = this.shopEl.style.display !== 'flex';
    this.shopEl.style.display = open ? 'flex' : 'none';
    this.shopBg.style.display = open ? 'block' : 'none';
    this.shopBtn.textContent = open ? '연구 중지' : '연구';
    this.shopBtn.style.background = open ? 'rgba(255,176,32,.18)' : PAL.panel;
    if (open) this._renderShop();
  };
  P._renderShop = function () {
    const el = this.shopEl; el.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = `display:flex;align-items:center;gap:10px;font:700 14px ${FONT};letter-spacing:.1em`;
    head.innerHTML = `<span style="color:${PAL.amber}">연구 — 업그레이드</span><span class="shop-bal" style="margin-left:auto;color:${PAL.amber};font-size:13px">◈ ${Math.floor(this.scrap)}</span>`;
    const close = document.createElement('button'); close.textContent = '✕'; close.style.cssText = `border:1px solid ${PAL.line};background:transparent;color:${PAL.text};cursor:pointer;padding:2px 8px;font:700 12px ${FONT}`;
    close.onclick = () => this._toggleShop(); head.appendChild(close);
    el.appendChild(head);
    let cat = '';
    for (const u of SHOP) {
      if (u.c !== cat) { cat = u.c; const h = document.createElement('div'); h.textContent = cat; h.style.cssText = `font:700 10px ${FONT};letter-spacing:.2em;color:${PAL.dim};margin-top:6px`; el.appendChild(h); }
      const cnt = this._buyCount(u.id), maxed = u.max && cnt >= u.max, cost = this._shopCost(u);
      const row = document.createElement('button');
      row.style.cssText = `display:flex;align-items:center;gap:10px;border:1px solid ${PAL.line};background:rgba(0,0,0,.3);color:${PAL.text};padding:9px 12px;cursor:${maxed ? 'default' : 'pointer'};text-align:left;font-family:${FONT};opacity:${maxed ? .45 : 1}`;
      row.innerHTML = `<span style="min-width:86px;font:700 13px ${FONT}">${u.n}${cnt ? ` <span style=\"color:${PAL.cyan};font-size:10px\">Lv${cnt + (u.id === 'sskl' ? 1 : 0)}</span>` : ''}</span><span style="flex:1;font-size:11px;color:${PAL.dim}">${u.d}</span><span class="shop-cost" data-cost="${maxed ? -1 : cost}" style="font:700 13px ${FONT};color:${this.scrap >= cost ? PAL.amber : PAL.red}">${maxed ? 'MAX' : '◈ ' + cost}</span>`;
      if (!maxed) row.onclick = () => this._buy(u);
      el.appendChild(row);
    }
    const note = document.createElement('div');
    note.style.cssText = `font-size:10px;color:${PAL.dim};margin-top:4px`;
    note.textContent = '비용은 본인 지갑에서 차감 · 구조물 연구 효과는 팀 전체 적용';
    el.appendChild(note);
  };
  P._buy = function (u) {
    const cost = this._shopCost(u);
    if (this.scrap < cost) { this._beep(140, .1, 'sawtooth', .05); return; }
    if (this.isHostish()) {
      this.scrap -= cost;
      this.me.buys[u.id] = this._buyCount(u.id) + 1;
      if (u.per) u.f(this.me); else { u.f(this.g); this._structUpgFx(u.id); if (this.mode !== 'solo') this._send({ t: 'gup', id: u.id, sc: Math.round(this.allyScrap) }); }
      if (this.mode === 'solo' && u.per && Math.random() < .8) { const b = SHOP.find(s => s.id === u.id); this.ally.buys[u.id] = (this.ally.buys[u.id] || 0); } // bot upgrades via wave bonus below
      this._beep(760, .1, 'square', .05); this._renderShop(); this._refreshShp();
    } else { this._send({ t: 'buy', id: u.id }); this._beep(500, .06, 'square', .04); }
  };
  P._structUpgFx = function (id) { // structure research feedback: every matching structure pops + sparks
    this._syncStruct();
    const kind = id === 'gwall' ? 1 : id === 'gtur' ? 2 : 0;
    if (!kind || !this.sMeshes) return;
    for (const [i, g] of this.sMeshes) if (g.kind === kind) { g.userData.pop = .3; this._burst(g.position.x, g.position.z, kind === 1 ? PAL.cyanHex : PAL.amberHex, 3, 3); }
    this._beep(820, .12, 'square', .05);
  };
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
  P._showUpgrades = function () {
    const p = this.me;
    const pool = UPG.map(u => ({ u, tier: p.taken[u.k] || 0 })).filter(c => c.tier < c.u.t.length);
    if (!pool.length) { this.pendUp = 0; return; }
    const picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this._upBase = 'LV ' + this.lv + ' — 강화 선택' + (this.pendUp > 1 ? ' (+' + (this.pendUp - 1) + ' 대기)' : '');
    this._upDeadline = performance.now() + 30000; // 30s to choose, then the first card auto-picks
    this.upTitle.textContent = this._upBase + ' · 30s';
    this.upRow.innerHTML = '';
    picks.forEach(({ u, tier }) => {
      const r = RAR[tier], tt = u.t[tier];
      const c = document.createElement('button');
      c.style.cssText = `width:190px;min-height:150px;border:1px solid ${PAL.line};border-top:4px solid ${r.c};background:${PAL.panel};color:${PAL.text};padding:16px;cursor:pointer;text-align:left;font-family:${FONT};display:flex;flex-direction:column;gap:7px;backdrop-filter:blur(6px);box-shadow:0 0 ${10 + tier * 8}px ${r.c}44;transition:transform .1s`;
      c.onmouseenter = () => c.style.transform = 'translateY(-4px)';
      c.onmouseleave = () => c.style.transform = '';
      c.innerHTML = `<span style="font:700 10px ${FONT};letter-spacing:.14em;color:${r.c}">${r.n} · ${u.k.toUpperCase()}</span><span style="font:700 18px ${FONT}">${u.n} ${ROMAN[tier]}</span><span style="font:400 12.5px ${FONT};line-height:1.5;color:${PAL.dim}">${tt.d}</span>`;
      const hint = SYN.find(s => !(p.syn || {})[s.id] && s.need.includes(u.k) && !p.taken[u.k] && s.need.every(k => k === u.k || p.taken[k]));
      if (hint) c.innerHTML += `<span style="font:700 11px ${FONT};color:${PAL.amber};margin-top:auto">✦ 시너지 각성: ${hint.n}</span>`;
      c.onclick = () => { tt.f(p); p.taken[u.k] = tier + 1; this._checkSyn(p, true); this.pendUp--; this.upEl.style.display = 'none'; this._upDeadline = 0; this._beep(750, .08); if (this.pendUp > 0) this._showUpgrades(); };
      this.upRow.appendChild(c);
    });
    this.upEl.style.display = 'flex';
  };
  P._hudTick = function (dt) {
    this._hudT = (this._hudT || 0) - dt; if (this._hudT > 0) return; this._hudT = .12;
    this.wvEl.textContent = this.phase === 'build' ? `WAVE ${this.wave + 1} 준비` : `WAVE ${Math.max(1, this.wave)}/${this.maxWave}`;
    if (this.phase === 'build') { this.phEl.textContent = `습격까지 ${Math.max(0, Math.ceil(this.phT))}초`; this.phEl.style.color = PAL.cyan; }
    else if (this.phase === 'assault') { this.phEl.textContent = `잔여 ${this.enemies.size + (this.isHostish() ? this.spawnQ.length : (this._qn || 0))}`; this.phEl.style.color = PAL.red; }
    else this.phEl.textContent = '';
    this.goBtn.style.display = this.isHostish() && this.phase === 'build' ? 'block' : 'none';
    const chp = this.coreHp / this.coreMax;
    this.coreF.style.width = Math.max(0, chp * 100) + '%';
    this.coreF.style.background = chp < .3 ? PAL.red : `linear-gradient(90deg,${PAL.cyan},#7ee8ff)`;
    this.coreLab.textContent = '코어 ' + Math.max(0, Math.round(this.coreHp)) + '/' + this.coreMax;
    this.hintEl.style.display = this.wave === 0 && this.phase === 'build' ? 'block' : 'none';
    // sticky pause notice (peer backgrounded / host silent)
    if ((this.phase === 'build' || this.phase === 'assault') && !this.over) {
      if (this._hostLost) this._banner('⏸ 호스트 연결 대기 중… 재연결되면 자동 재개', 600);
      else if (this._peerPaused) this._banner('⏸ 일시정지 — 상대가 잠시 자리를 비웠습니다', 600);
    }
    // pending upgrades: chip during assault, auto-open when the build phase arrives
    const sheetOpen = this.upEl.style.display !== 'none';
    this.upChip.style.display = this.pendUp > 0 && !sheetOpen ? 'block' : 'none';
    if (this.pendUp > 0) this.upChip.textContent = `⬆ 강화 카드 ${this.pendUp} — 클릭`;
    if ((this.phase === 'build' || this.mode === 'solo') && this.pendUp > 0 && !sheetOpen && !this.over && this.phase !== 'count' && this.phase !== 'wait') this._showUpgrades();
    // card sheet countdown — expiry auto-picks the first card
    if (sheetOpen && this._upDeadline) {
      const rem = Math.ceil((this._upDeadline - performance.now()) / 1000);
      if (rem <= 0) { const first = this.upRow.querySelector('button'); this._upDeadline = 0; if (first) { this._banner('시간 초과 — 첫 번째 카드 자동 선택', 2200); first.click(); } }
      else this.upTitle.textContent = this._upBase + ' · ' + rem + 's';
    }
    // owned card lines (tier-colored)
    const ownKey = JSON.stringify(this.me.taken);
    if (ownKey !== this._ownKey) {
      this._ownKey = ownKey;
      this.ownedEl.innerHTML = UPG.filter(u => this.me.taken[u.k]).map(u => {
        const tier = Math.min(this.me.taken[u.k], u.t.length) - 1, r = RAR[tier];
        return `<div style="background:rgba(12,14,20,.6);border:1px solid ${r.c};color:${r.c};font:700 10px ${FONT};padding:2px 7px;letter-spacing:.04em">${u.n.slice(0, 2)} ${ROMAN[tier]}</div>`;
      }).join('');
    }
    const synKey = Object.keys(this.me.syn || {}).join(',');
    if (synKey !== this._synKey) {
      this._synKey = synKey;
      this.synEl.innerHTML = SYN.filter(s => this.me.syn && this.me.syn[s.id])
        .map(s => `<div style="background:rgba(12,14,20,.6);border:1px solid ${PAL.amber};color:${PAL.amber};font:700 10px ${FONT};padding:3px 8px;letter-spacing:.05em" title="${s.d}">✦ ${s.n}</div>`).join('');
    }
    if (this.shopEl.style.display === 'flex') { // live affordability while the sheet is open
      const bal = this.shopEl.querySelector('.shop-bal');
      if (bal) bal.textContent = '◈ ' + Math.floor(this.scrap);
      this.shopEl.querySelectorAll('.shop-cost').forEach(sp => { const c = +sp.dataset.cost; if (c >= 0) sp.style.color = this.scrap >= c ? PAL.amber : PAL.red; });
    }
    const scNow = Math.floor(this.scrap);
    if (this._scLast !== undefined && scNow !== this._scLast && this.scEl.animate) this.scEl.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240 });
    this._scLast = scNow;
    this.scEl.textContent = '◈ ' + scNow;
    const setBar = (k, p, col) => { this.pbar[k].f.style.width = Math.max(0, p.hp / p.maxhp * 100) + '%'; const c2 = p.down ? PAL.red : col; this.pbar[k].f.style.background = c2; this.pbar[k].f.style.boxShadow = '0 0 8px ' + c2; };
    setBar('me', this.me, PAL.cyan);
    this.pbar.ally.row.style.display = this.allyOn ? 'flex' : 'none';
    if (this.allyOn) { setBar('ally', this.ally, PAL.amber); this.pbar.ally.lab.textContent = (this.mode === 'solo' ? '유닛-B · 봇' : '동료') + (this.ally.down ? ' — 쓰러짐!' : ''); }
    this.lvEl.textContent = 'LV ' + this.lv;
    this.xpF.style.width = Math.min(100, this.xp / XP_NEED(this.lv) * 100) + '%';
    const p = this.me;
    this.dashBtn.innerHTML = p.dashT > 0 ? '대시<br>' + p.dashT.toFixed(1) + 's' : '대시';
    this.dashBtn.style.opacity = p.dashT > 0 ? .45 : 1;
    this.sklBtn.innerHTML = p.sklT > 0 ? '충격파<br>' + Math.ceil(p.sklT) + 's' : '충격파<br>Lv' + p.sklLv;
    this.sklBtn.style.opacity = p.sklT > 0 ? .45 : 1;
    this.sklBtn.style.borderColor = p.sklT > 0 ? PAL.line : PAL.cyan; this.sklBtn.style.color = p.sklT > 0 ? PAL.text : PAL.cyan;
    const nItems = p.items.length;
    this.itemBtn.innerHTML = nItems ? `아이템<br>${nItems}/${INV_MAX}` : '아이템<br>없음';
    this.itemBtn.style.background = nItems ? PAL.red : PAL.panel; this.itemBtn.style.color = nItems ? '#fff' : PAL.dim;
    this.itemBtn.style.boxShadow = nItems ? '0 0 14px rgba(255,59,42,.5)' : 'none';
    this.itemBtn.style.opacity = nItems ? 1 : .45;
    this.itemBtn.style.cursor = nItems ? 'pointer' : 'default';
    this.itemBtn.disabled = !nItems;
    if (!nItems && this.invEl.style.display === 'flex') this._toggleInv(false); // last item spent → close the sheet
    if (this.buildMode) { this.wallChip.textContent = `벽 · ${this._cost(1)}`; this.turChip.textContent = `포탑 · ${this._cost(2)}`; }
    // minimap
    const ctx = this.mm.getContext('2d'), S = 104 / N;
    ctx.clearRect(0, 0, 104, 104);
    ctx.save(); ctx.beginPath(); ctx.arc(52, 52, 52, 0, Math.PI * 2); ctx.clip(); // circular, translucent
    ctx.fillStyle = 'rgba(8,9,13,.45)'; ctx.fillRect(0, 0, 104, 104);
    for (let z = 0; z < N; z++)for (let x = 0; x < N; x++) {
      const o = this.occ[ti(x, z)];
      if (!o) continue;
      const coreBlink = o === 3 && this.tm - this._coreHitT < 1.5 && ((this.tm * 6 | 0) % 2);
      ctx.fillStyle = coreBlink ? PAL.red : o === 1 ? '#cfd6e4' : o === 2 ? PAL.cyan : o === 3 ? PAL.cyan : o === 5 ? '#8a8298' : '#5f2f36';
      ctx.globalAlpha = o === 3 || o === 4 ? .9 : .8;
      ctx.fillRect(x * S, z * S, S, S);
    }
    { // active gate(s) blink bright red on the minimap
      ctx.fillStyle = PAL.red; ctx.globalAlpha = .55 + Math.sin(this.tm * 5) * .35;
      for (const gi of this.activeGates || [this.activeGate]) {
        const ag = this.gates[gi]; if (!ag) continue;
        for (let o = -2; o < 4; o++) { const x = ag.gx + (ag.gz === 0 || ag.gz === N - 1 ? o : 0), z = ag.gz + (ag.gx === 0 || ag.gx === N - 1 ? o : 0); ctx.fillRect(x * S, z * S, S, S); }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.amber;
    for (const f of this.fitems) ctx.fillRect((w2g(f.x) + .5) * S - 1.5, (w2g(f.z) + .5) * S - 1.5, 3, 3);
    ctx.fillStyle = PAL.red;
    for (const e of this.enemies.values()) ctx.fillRect((w2g(e.x) + .5) * S - 1.5, (w2g(e.z) + .5) * S - 1.5, 3, 3);
    const dot = (x, z, c, r) => { ctx.fillStyle = c; ctx.fillRect((w2g(x) + .5) * S - r, (w2g(z) + .5) * S - r, r * 2, r * 2); };
    dot(this.me.x, this.me.z, PAL.cyan, 2.5);
    if (this.allyOn) dot(this.ally.x, this.ally.z, PAL.amber, 2.5);
    ctx.restore();
  };
}
