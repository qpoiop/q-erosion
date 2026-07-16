// sheets.js — modal sheets & commerce: research shop, augment cards, inventory, owned-buff viewer
import { N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
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
  P._toggleBuffs = function (force) {
    const open = force !== undefined ? force : this.buffEl.style.display !== 'flex';
    this.buffEl.style.display = open ? 'flex' : 'none';
    this.buffBg.style.display = open ? 'block' : 'none';
    if (open) this._renderBuffs();
  };
  P._renderBuffs = function () {
    const el = this.buffEl; el.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = `display:flex;justify-content:space-between;align-items:center;font:700 13px ${FONT};letter-spacing:.1em`;
    head.innerHTML = '<span>보유 증강 · 시너지</span>';
    const close = document.createElement('button');
    close.textContent = '✕'; close.style.cssText = `background:transparent;border:none;color:${PAL.dim};font:700 14px ${FONT};cursor:pointer;padding:2px 6px`;
    close.onclick = () => this._toggleBuffs(false); head.appendChild(close);
    el.appendChild(head);
    const sec = (title) => { const t = document.createElement('div'); t.textContent = title; t.style.cssText = `font:700 10px ${FONT};letter-spacing:.18em;color:${PAL.dim};margin-top:6px`; el.appendChild(t); };
    const row = (color, name, tierTxt, desc) => {
      const r = document.createElement('div');
      r.style.cssText = `display:flex;gap:8px;align-items:baseline;background:rgba(20,23,32,.7);border-left:3px solid ${color};padding:6px 10px`;
      r.innerHTML = `<span style="font:700 12px ${FONT};color:${color};white-space:nowrap">${name} ${tierTxt}</span><span style="font:400 10.5px ${FONT};color:${PAL.dim};line-height:1.4">${desc}</span>`;
      el.appendChild(r);
    };
    const taken = UPG.filter(u => this.me.taken[u.k]);
    if (taken.length) sec('증강 ' + taken.length + '계통');
    for (const u of taken) {
      const tier = Math.min(this.me.taken[u.k], u.t.length), r = RAR[tier - 1];
      row(r.c, u.n, ROMAN[tier - 1], u.t.slice(0, tier).map(t => t.d).join(' · '));
    }
    const syns = SYN.filter(s => this.me.syn && this.me.syn[s.id]);
    if (syns.length) sec('시너지 ' + syns.length + '종');
    for (const s of syns) {
      const gr = (this.me.synGrade || {})[s.id] || 1, r = RAR[gr - 1];
      row(r.c, '✦ ' + s.n, ROMAN[gr - 1] + ' (' + r.n + ')', s.d + ' · 누적 ' + this.me.syn[s.id] + '회');
    }
    if (!taken.length && !syns.length) { const e = document.createElement('div'); e.textContent = '아직 획득한 증강이 없습니다'; e.style.cssText = `font:400 11px ${FONT};color:${PAL.dim}`; el.appendChild(e); }
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
    note.textContent = '모든 연구는 개인 단위 — 구조물 연구는 내가 지은 벽·포탑에 적용';
    el.appendChild(note);
  };
  P._buy = function (u) {
    const cost = this._shopCost(u);
    if (this.scrap < cost) { this._beep(140, .1, 'sawtooth', .05); return; }
    if (this.isHostish()) {
      this.scrap -= cost;
      this.me.buys[u.id] = this._buyCount(u.id) + 1;
      if (u.st) { this._applyStructUpg(u, this.me, 0); this._structUpgFx(u.id); } else u.f(this.me, this);
      if (this.mode === 'solo' && u.per && Math.random() < .8) { const b = SHOP.find(s => s.id === u.id); this.ally.buys[u.id] = (this.ally.buys[u.id] || 0); } // bot upgrades via wave bonus below
      this._beep(760, .1, 'square', .05); this._renderShop(); this._refreshShp();
    } else { this._send({ t: 'buy', id: u.id }); this._beep(500, .06, 'square', .04); }
  };
  P._buyCount = function (id) { return this.me.buys[id] || 0; }
  P._shopCost = function (u) { return Math.round(u.cost * Math.pow(1.5, this._buyCount(u.id))); }
  P._structUpgFx = function (id) { // structure research feedback: every matching structure pops + sparks
    this._syncStruct();
    const kind = id === 'gwall' ? 1 : id === 'gtur' ? 2 : 0;
    if (!kind || !this.sMeshes) return;
    for (const [i, g] of this.sMeshes) if (g.kind === kind) { g.userData.pop = .3; this._burst(g.position.x, g.position.z, kind === 1 ? PAL.cyanHex : PAL.amberHex, 3, 3); }
    this._beep(820, .12, 'square', .05);
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
      if (hint) c.innerHTML += `<span style="margin-top:auto"><span style="font:700 11px ${FONT};color:${PAL.amber};display:block">✦ 시너지 각성: ${hint.n}</span><span style="font:400 10.5px ${FONT};color:${PAL.dim};display:block;line-height:1.4">${hint.d}</span></span>`;
      c.onclick = () => { tt.f(p, this); p.taken[u.k] = tier + 1; this._checkSyn(p, true); this.pendUp--; this.upEl.style.display = 'none'; this._upDeadline = 0; this._beep(750, .08); if (this.pendUp > 0) this._showUpgrades(); };
      this.upRow.appendChild(c);
    });
    this.upEl.style.display = 'flex';
  };
}
