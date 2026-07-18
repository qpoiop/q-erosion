// sheets.js — modal sheets & commerce: research shop, augment cards, inventory, owned-buff viewer
import { PV, CAP_WALL, CAP_TUR, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

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
  P._toggleStats = function (force) {
    const open = force !== undefined ? force : this.statEl.style.display !== 'flex';
    this.statEl.style.display = open ? 'flex' : 'none';
    this.statBg.style.display = open ? 'block' : 'none';
    if (open) this._renderStats();
  };
  P._renderStats = function () { // computed FINAL values per teammate, grouped, with deltas vs the class base
    const el = this.statEl; el.innerHTML = '';
    this.H('div', 'font:700 13px ' + FONT + ';letter-spacing:.1em;color:#e8eaf0;margin-bottom:2px', el).textContent = '유닛 스탯';
    const two = this.allyOn;
    const grid = this.H('div', `display:grid;grid-template-columns:auto 1fr${two ? ' 1fr' : ''};gap:5px 14px;font:500 12px ${FONT};align-items:center`, el);
    this.H('div', '', grid);
    const hd = (t, c) => { const d = this.H('div', 'font:700 10.5px ' + FONT + ';letter-spacing:.08em;text-align:right;color:' + c, grid); d.textContent = t; };
    hd('나', PAL.cyan); if (two) hd(this.mode === 'solo' ? '유닛-B · 봇' : '동료', PAL.amber);
    const allyReady = this.mode === 'solo' || this.ally.sttOk; // multi: filled by the ~2s st2 snapshot
    const sec = (t) => { const d = this.H('div', `grid-column:1/-1;margin-top:7px;padding-bottom:3px;border-bottom:1px solid ${PAL.line};font:700 9.5px ${FONT};letter-spacing:.16em;color:${PAL.dim}`, grid); d.textContent = t; };
    const row = (name, f) => {
      this.H('div', 'color:' + PAL.dim, grid).textContent = name;
      this.H('div', 'text-align:right;font-weight:700;color:' + PAL.cyan, grid).textContent = f(this.me); // my column matches the 나 header — plain white read weaker than the partner's amber
      if (two) this.H('div', 'text-align:right;font-weight:700;color:' + PAL.amber, grid).textContent = allyReady ? f(this.ally) : '—';
    };
    const pct = (v, b) => { const d = Math.round((v / b - 1) * 100); return d ? ` (${d > 0 ? '+' : ''}${d}%)` : ''; };
    sec('⚔ 전투');
    row('공격력', q => `${+(+q.dmg).toFixed(1)}${pct(q.dmg, 9)}`);
    row('연사', q => { const f = Math.min(7.5, q.frate); return `${+f.toFixed(2)}/s${f >= 7.5 ? ' 상한' : pct(q.frate, 2.5)}`; });
    row('산탄 · 관통', q => `${q.shots}발 · ${q.pierce}회`);
    row('사거리', q => `${+(+q.range).toFixed(1)}${pct(q.range, 9)}`);
    sec('♥ 생존');
    row('체력', q => `${Math.ceil(q.hp)}/${q.maxhp}`);
    row('자가 수복', q => `${+(q.regen || 0).toFixed(1)}/s`);
    row('받는 피해', q => `${Math.round(((q.armor || 1) - 1) * 100)}%`);
    sec('⚡ 기동 · 스킬');
    row('이동 속도', q => `${+(+q.speed).toFixed(1)}${pct(q.speed, 6)}`);
    row('대시 쿨', q => `${+(+q.dashCd).toFixed(2)}s${q.dashCd <= 1.2 ? ' 하한' : ''}`);
    row('충격파', q => `Lv${q.sklLv} · ${Math.round((40 + q.sklLv * 20) * (q.sklDmgMul || 1))}dmg · r${+((3.5 + q.sklLv * .5) * (q.sklRMul || 1)).toFixed(1)} · ${+Math.max(4, (14 - q.sklLv) * (q.sklCdMul || 1)).toFixed(1)}s`);
    sec('◆ 경제 · 증강');
    row('처치 자원', q => `×${+(q.scrapMul || 1).toFixed(2)}`);
    row('아이템 드랍', q => `×${+(q.dropMul || 1).toFixed(2)}`);
    row('증강 · 시너지', q => { const n = q === this.me ? Object.values(q.taken || {}).reduce((a, b) => a + b, 0) : (q.au ?? Object.values(q.taken || {}).reduce((a, b) => a + b, 0)); const s = q === this.me ? Object.keys(q.syn || {}).length : (q.synN ?? Object.keys(q.syn || {}).length); return `${n}개 · ${s}`; });
    if (two && !allyReady) this.H('div', `margin-top:6px;font:400 10.5px ${FONT};color:${PAL.dim};text-align:center`, el).textContent = '동료 스탯 수신 대기 중…';
    const cl = this.H('button', 'margin-top:10px;font:700 11px ' + FONT + ';border:1px solid ' + PAL.line + ';background:transparent;color:' + PAL.dim + ';padding:7px;cursor:pointer;letter-spacing:.08em;pointer-events:auto', el);
    cl.textContent = '닫기'; cl.onclick = () => this._toggleStats(false);
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
      row(r.c, '✦ ' + s.n, ROMAN[gr - 1] + ' (' + r.n + ')', s.d);
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
    if (u.max && this._buyCount(u.id) >= u.max) { this._banner('최대 레벨입니다'); return; } // UI disables, but enforce here too
    const cost = this._shopCost(u);
    if (this.scrap < cost) { this._beep(140, .1, 'sawtooth', .05); return; }
    if (this.isHostish()) {
      this.scrap -= cost;
      this.me.buys[u.id] = this._buyCount(u.id) + 1;
      if (u.st) { this._applyStructUpg(u, this.me, 0); this._structUpgFx(u.id); } else u.f(this.me, this);
      if (this.mode === 'solo' && u.per && Math.random() < .8) { const b = SHOP.find(s => s.id === u.id); this.ally.buys[u.id] = (this.ally.buys[u.id] || 0); } // bot upgrades via wave bonus below
      this.stat.r++; this._beep(760, .1, 'square', .05); this._renderShop(); this._refreshShp();
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
    const picks = [];
    // slot 1 favors build coherence: upgrade an owned line, or a line that completes a synergy with one
    const owned = k => (p.taken[k] || 0) > 0;
    const relevant = pool.filter(c => owned(c.u.k) || SYN.some(sy => sy.need.includes(c.u.k) && sy.need.some(k2 => k2 !== c.u.k && owned(k2))));
    if (relevant.length && Math.random() < .5) { const c = relevant[Math.floor(Math.random() * relevant.length)]; picks.push(c); pool.splice(pool.indexOf(c), 1); } // 50%: build-coherent slot
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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
      if (hint) c.innerHTML += `<span style="margin-top:auto"><span style="font:700 11px ${FONT};color:${PAL.amber};display:block">✦ 시너지 각성: ${hint.n} [레어]</span><span style="font:400 10.5px ${FONT};color:${PAL.dim};display:block;line-height:1.4">${hint.gd ? hint.gd[0] : hint.d}</span></span>`;
      c.onclick = () => { tt.f(p, this); p.taken[u.k] = tier + 1; this._checkSyn(p, true); this.pendUp--; this.upEl.style.display = 'none'; this._upDeadline = 0; this._beep(750, .08); if (this.pendUp > 0) this._showUpgrades(); };
      this.upRow.appendChild(c);
    });
    this.upEl.style.display = 'flex';
  };
}
