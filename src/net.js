// net.js — verbatim methods from game.js (prototype-install)
import { PV, CAP_WALL, CAP_TUR, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._initNet = function () {
    const tb = 'dc-erosion/v3/' + this.room;
    this.isHost = this.mode === 'host';
    this.pubT = tb + (this.isHost ? '/h' : '/g'); this.subT = tb + (this.isHost ? '/g' : '/h');
    const kick = `<div style="font:700 11px ${FONT};letter-spacing:.16em;color:${PAL.red}">`;
    this._overlay(this.isHost
      ? `${kick}방 개설됨 — 접속 대기</div><div style="font:700 54px ${FONT};letter-spacing:.18em;margin:6px 0 2px;color:${PAL.cyan};text-shadow:0 0 20px rgba(37,216,255,.5)">${this.room}</div><div style="font:400 13px ${FONT};line-height:1.6;color:${PAL.dim}">동료가 이 코드로 참가하면 자동으로 시작됩니다.<br>릴레이 서버에 연결 중…</div><div style="margin-top:16px;display:flex;gap:8px;justify-content:center"><button id="egCopy" style="${this._obtn(true)}">코드 복사</button><button id="egCancel" style="${this._obtn(false)}">취소</button></div>`
      : `${kick}참가 중</div><div style="font:700 40px ${FONT};letter-spacing:.18em;margin:6px 0 2px;color:${PAL.cyan}">${this.room}</div><div id="egWaitMsg" style="font:400 13px ${FONT};line-height:1.6;color:${PAL.dim}">방장을 찾는 중… 상대가 방을 열어두었는지 확인하세요.</div><div style="margin-top:16px"><button id="egCancel" style="${this._obtn(false)}">취소</button></div>`);
    this.ovIn.querySelector('#egCancel').onclick = () => this._exit();
    const cp = this.ovIn.querySelector('#egCopy');
    if (cp) cp.onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(this.room); ok = true; } catch (e) {
        try { const ta = document.createElement('textarea'); ta.value = this.room; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) {}
      }
      cp.textContent = ok ? '복사됨 ✓' : '복사 실패';
      setTimeout(() => { if (cp.isConnected) cp.textContent = '코드 복사'; }, 1600);
    };
    if (!this.isHost) this._waitHintT = setTimeout(() => {
      if (this._dead || this.phase !== 'wait') return;
      const d = this.ovIn.querySelector('#egWaitMsg');
      if (d) { d.textContent = '아직 응답이 없습니다 — 코드가 정확한지, 방장이 대기 화면을 열어두었는지 확인하세요.'; d.style.color = PAL.amber; }
    }, 12000);
    this._connectRelay();
    this._mqtt2(); // parallel matchmaking channel
    this.sendPoseT = 0; this.sendStateT = 0; this.sendStT = 0;
  };
  P._onNetReady = function () { // shared post-connect handshake (relay & mqtt paths)
    if (!this.isHost) {
      clearInterval(this._helloIv);
      this._helloIv = setInterval(() => { if (this.phase === 'wait') this._send({ t: 'hello', v: PV }); else clearInterval(this._helloIv); }, 1500);
      this._send({ t: 'hello', v: PV });
    }
  };
  P._connectRelay = function () { // dedicated Cloudflare DO relay first; public MQTT as fallback
    if (this._dead || this._relayTrying) return;
    this._relayTrying = true;
    let settled = false;
    try {
      const ws = new WebSocket(RELAY + '/room/' + this.room + '?role=' + (this.isHost ? 'h' : 'g'));
      const to = setTimeout(() => { settled = true; this._relayTrying = false; if (!(this.net && this.net.isRelay)) { try { ws.close(); } catch (e) {} this._connectMqtt(); } }, 5000);
      ws.onopen = () => {
        if (settled && this.net && this.net.isRelay) { try { ws.close(); } catch (e) {} return; }
        settled = true; this._relayTrying = false; clearTimeout(to);
        const prev = this.net;
        this.net = { ws, connected: true, isRelay: true, publish: (t, m) => { try { ws.send(m); } catch (e) {} }, end: () => { try { ws.close(); } catch (e) {} } };
        if (prev && !prev.isRelay) { try { prev.end(true); } catch (e) {} } // was on the MQTT fallback — relay recovered, drop it
        clearInterval(this._relayRetryIv); this._relayRetryIv = null;
        this._netUp = true;
        ws.onmessage = ev => { try { this._onMsg(JSON.parse(ev.data)); } catch (e) {} };
        ws.onclose = () => {
          if (this.net && this.net.ws === ws) this.net.connected = false;
          if (!this._dead && this.phase !== 'over') setTimeout(() => { if (!this._dead && this.net && !this.net.connected) this._connectRelay(); }, 1500);
        };
        this._onNetReady();
      };
      ws.onerror = () => { if (!settled) { settled = true; this._relayTrying = false; clearTimeout(to); this._connectMqtt(); } };
    } catch (e) { this._relayTrying = false; this._connectMqtt(); }
  };
  P._connectMqtt = function () {
    if (this._dead) return;
    // fallback split-brain guard: one peer on relay + one on MQTT never meet.
    // keep probing the relay and switch back the moment it answers.
    if (!this._relayRetryIv) this._relayRetryIv = setInterval(() => {
      if (this._dead || (this.net && this.net.isRelay)) { clearInterval(this._relayRetryIv); this._relayRetryIv = null; return; }
      this._connectRelay();
    }, 4000);
    const urls = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
    let ui = 0;
    const connect = () => {
      if (this._dead) return;
      const c = mqtt.connect(urls[ui], { clientId: 'eg_' + Math.random().toString(16).slice(2, 10), clean: true, connectTimeout: 8000, reconnectPeriod: 3000 });
      this.net = c;
      c.on('connect', () => { c.subscribe(this.subT); this._onNetReady(); });
      c.on('message', (t, m) => { try { this._onMsg(JSON.parse(m.toString())); } catch (e) {} });
      c.on('error', () => { if (ui === 0 && !this._netUp) { ui = 1; try { c.end(true); } catch (e) {} connect(); } });
    };
    connect();
  };
  P._send = function (o) {
    const s = JSON.stringify(o);
    if (this.net && this.net.connected) { this._netUp = true; this.net.publish(this.pubT, s); }
    if (this.net2) { try { this.net2.publish(this.pubT, s); } catch (e) {} } // matchmaking runs on BOTH transports
  }
  P._mqtt2 = function () { // secondary MQTT channel for the wait phase — kills relay/MQTT split-brain during matchmaking
    if (this.net2 || this._dead || typeof mqtt === 'undefined') return;
    try {
      const c = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: 'eg2_' + Math.random().toString(16).slice(2, 10), clean: true, connectTimeout: 8000, reconnectPeriod: 0 });
      c.on('connect', () => { c.subscribe(this.subT); });
      c.on('message', (t, m) => { try { this._onMsg(JSON.parse(m.toString())); } catch (e) {} });
      c.on('error', () => {});
      this.net2 = c;
    } catch (e) {}
  };
  P._dropMqtt2 = function () { if (this.net2) { const c = this.net2; this.net2 = null; setTimeout(() => { try { c.end(true); } catch (e) {} }, 1500); } }
  P._allyR = function () { const a = this.ally; return { wallMul: a.wallMul, turMul: a.turMul, turHpMul: a.turHpMul, costMul: a.costMul, wallLv: a.wallLv || 0, turLv: a.turLv || 0 }; }
  P._structPack = function () { const a = []; for (let i = 0; i < N * N; i++) if (this.occ[i] === 1 || this.occ[i] === 2 || this.occ[i] === 5) a.push([i, this.occ[i], Math.round(this.shp[i]), +this.bld[i].toFixed(2), this.own[i]]); return a; }
  P._structUnpack = function (a) {
    const had = new Set();
    for (const [i, k, hp, b, ow] of a) {
      had.add(i); if (this.occ[i] !== k) this.occ[i] = k; this.shp[i] = hp; this.own[i] = ow || 0;
      if (k === 5) { this.bld[i] = 1; continue; }
      const nb = b ?? 1;
      if (nb >= 1) { if (this.bld[i] < 1) { this.bld[i] = 1; this.building.delete(i); } }
      else if (this.bld[i] < 1) { this.bld[i] = Math.max(this.bld[i], nb); this.building.add(i); }
    }
    for (let i = 0; i < N * N; i++) if ((this.occ[i] === 1 || this.occ[i] === 2 || this.occ[i] === 5) && !had.has(i)) { this.occ[i] = 0; this.shp[i] = 0; this.bld[i] = 0; this.building.delete(i); }
    this._syncStruct(); this._unstuck(this.me);
  };
  P._startOnline = function () {
    this._lastStateAt = performance.now(); this._peerSeenAt = performance.now(); this._hostLost = false; this._peerPaused = false;
    this.phase = 'count'; this.countT = 3; this.allyOn = true; this.allyG.visible = true;
    setTimeout(() => this._dropMqtt2(), 2500); // matchmaking done — single transport from here
    this.pbar.ally.lab.textContent = '동료 · ' + (this.isHost ? '유닛-B' : '유닛-A');
    this.ov.style.display = 'none';
  };
  P._onMsg = function (m) {
    switch (m.t) {
      case 'hello': if (this.isHost) {
        if (m.v !== PV) this._banner('⚠ 상대 클라이언트가 구버전입니다 — 양쪽 모두 새로고침 권장', 5200);
        if (this.phase === 'wait') { this._send({ t: 'welcome', diff: this.diffMul, dk: this.diffKey, waves: this.maxWave, bt: this.buildTime, st: this._structPack(), sc: Math.round(this.allyScrap), ar: this._allyR(), abuys: this._peerBuys || {}, v: PV }); this._startOnline(); }
        else if (performance.now() - (this._peerSeenAt || 0) > 3000) { // teammate silent 3s (wall-clock — tm freezes on pause) — allow rejoin mid-game
          this._send({ t: 'welcome', diff: this.diffMul, dk: this.diffKey, waves: this.maxWave, bt: this.buildTime, st: this._structPack(), sc: Math.round(this.allyScrap), ar: this._allyR(), abuys: this._peerBuys || {}, v: PV });
          this._banner('동료 재접속!', 2600);
        }
        else this._send({ t: 'busy' });
      } break;
      case 'welcome': if (!this.isHost && this.phase === 'wait') {
        clearInterval(this._helloIv);
        this.diffMul = m.diff; if (m.dk) { this.diffKey = m.dk; this._setDiffTag && this._setDiffTag(); } this.maxWave = m.waves; this.buildTime = m.bt; this.scrap = m.sc;
        if (m.v !== PV) this._banner('⚠ 방장 클라이언트 버전이 다릅니다 — 양쪽 모두 새로고침 권장', 5200);
        if (m.ar) Object.assign(this.me, m.ar); if (m.abuys) this.me.buys = { ...m.abuys }; // rejoin: my research/buy counts live on the host
        this._structUnpack(m.st); this._startOnline();
      } break;
      case 'busy': if (!this.isHost && this.phase === 'wait') { this._overlay(`<div style="font:700 20px ${FONT}">방이 가득 찼습니다</div><div style="margin-top:14px"><button id="egCancel" style="${this._obtn(false)}">돌아가기</button></div>`); this.ovIn.querySelector('#egCancel').onclick = () => this._exit(); } break;
      case 'p': { this._peerSeenAt = performance.now(); const a = this.ally; a.lastSeen = this.tm; a.tx = m.x; a.tz = m.z; a.ta = m.a; a.hp = m.hp; a.maxhp = m.mh; a.down = m.dn; a.lv = m.lv; this._peerPaused = !!m.bg; if (m.sm) a.scrapMul = m.sm; if (m.au !== undefined) a.au = m.au;
        (m.sh || []).forEach(s => this._spawnBullet(s[0], s[1], s[2], s[3], { ghost: true, ally: true, life: s[4] || .55 }));
        break; }
      case 'hit': if (this.isHost) { const e = this.enemies.get(m.id); if (e) this._dmgEnemy(e, m.d, { ally: true }); } break;
      case 'bld': if (this.isHost) { if (this._canPlace(m.i) && this._structCount(1, m.k) < (m.k === 1 ? CAP_WALL : CAP_TUR)) { const c = this._cost(m.k, this.ally); if (this.allyScrap >= c) { this.allyScrap -= c; this.allyStat.b++; this._place(m.i, m.k, false, 1); this._send({ t: 'blt', i: m.i, k: m.k, o: 1, sc: Math.round(this.allyScrap) }); } } } break;
      case 'blt': if (!this.isHost) { if (m.o === 1) { this.scrap = m.sc; this.stat.b++; } this._place(m.i, m.k, true, m.o || 0); this._fx(g2w(m.i % N), g2w((m.i / N) | 0), false, PAL.cyanHex); } break;
      case 'sel': if (this.isHost) { const k = this.occ[m.i]; if (k === 1 || k === 2) { this.allyScrap += Math.round(this._cost(k) * .7); this._remove(m.i); this._send({ t: 'slt', i: m.i, sc: Math.round(this.allyScrap) }); } } break;
      case 'slt': if (!this.isHost) { this.scrap = m.sc; this._remove(m.i); } break;
      case 'buy': if (this.isHost) { const u = SHOP.find(s => s.id === m.id); if (!u) break; if (u.max && ((this._peerBuys || {})[m.id] || 0) >= u.max) break; const cost = Math.round(u.cost * Math.pow(1.5, (this._peerBuys = this._peerBuys || {}, this._peerBuys[m.id] || 0)));
        if (this.allyScrap >= cost) { this.allyScrap -= cost; this.allyStat.r++; this._peerBuys[m.id] = (this._peerBuys[m.id] || 0) + 1; if (u.st) { this._applyStructUpg(u, this.ally, 1); this._structUpgFx(u.id); } this._send({ t: 'byk', id: m.id, sc: Math.round(this.allyScrap) }); } } break;
      case 'byk': if (!this.isHost) { const u = SHOP.find(s => s.id === m.id); this.scrap = m.sc; if (u && u.per) { this.stat.r++; this.me.buys[u.id] = this._buyCount(u.id) + 1; u.f(this.me, this); if (u.st) { this._structUpgFx(u.id); this._syncStruct(); } this._beep(760, .1, 'square', .05); if (this.shopEl.style.display === 'flex') this._renderShop(); } } break;
      case 'skl': if (this.isHost) this._shockwave(m.x, m.z, Math.min(m.r || 4, 12), Math.min(m.dmg || 60, 500), false, m.deb && { f: Math.max(.4, m.deb.f || .7), t: Math.min(m.deb.t || 2.5, 5), c: Math.min(m.deb.c || 0, .5), ct: Math.min(m.deb.ct || 1, 2) }); else this._shockFx(m.x, m.z); break;
      case 'caug': if (this.isHost) this._coreAug(m.a, m.h); break;
      case 'inen': if (this.isHost && this.phase === 'escape') this._startInfiltration(); break; // joiner stepped into the rift
      case 'ingo': if (!this.isHost && !this.inf && !this._infCount) { this._infCount = { ref: m.ar || 0 }; this.phase = 'count'; this.countT = 3.4; } break;
      case 'infin': if (!this.isHost) { this.infFinal = true; this._startFinale ? (() => {})() : 0; const bl = this.H('div', 'position:absolute;inset:0;background:#000;z-index:45;opacity:0;pointer-events:none', this.hud); let c2 = 0; const iv = setInterval(() => { bl.style.opacity = bl.style.opacity === '1' ? '0' : '1'; if (++c2 >= 6) { clearInterval(iv); bl.remove(); } }, 300); this._banner('⚠⚠ 침식의 근원 — 모든 것의 시작이 모습을 드러냈다', 5200); this.shake = 1.2; } break;
      case 'use': { if (this.isHost && this.ally.items) { const ix = this.ally.items.indexOf(m.k); if (ix >= 0) this.ally.items.splice(ix, 1); } this._applyItemFx(m.k, m.x, m.z, false); } break;
      case 'dmg': if (!this.isHost) this._hurt(this.me, m.v); break;
      case 'eb': this.ebullets.push({ x: m.x, z: m.z, dx: m.dx, dz: m.dz, life: 3, ghost: !this.isHost }); break;
      case 'itm': if (!this.isHost) { if (m.who === 1 && this.me.items.length < INV_MAX) { this.me.items.push(m.k); this._banner(`아이템 획득 — ${ITEMS[m.k].n} (${this.me.items.length}/${INV_MAX})`, 2600); } else if (m.who === 0) this._banner(`동료가 ${ITEMS[m.k].n} 획득`, 2200); this.fitems = this.fitems.filter(f => f.id !== m.id); this._beep(700, .1); } break;
      case 'ban': if (!this.isHost) this._banner(m.s); break;
      case 's': if (!this.isHost) this._applyState(m); break;
      case 'end': if (!this.isHost) this._gameOver(m.win, m.why, true); break;
      case 'restart': if (!this.isHost) { this._reset(); this._startOnline(); } break;
    }
  };
  P._applyState = function (m) {
    this.tm = m.tm; if (m.xp !== undefined) this._setXpTotal(m.xp);
    this._lastStateAt = performance.now(); this._peerSeenAt = performance.now(); this._hostLost = false;
    if (!this.isHost) this._peerPaused = !!m.bg;
    this.scrap = m.asc !== undefined ? m.asc : m.sc;
    this.coreHp = m.core; if (m.cm) this.coreMax = m.cm;
    if (m.ss) { const a = this.allyStat; [a.k, a.g, a.b, a.r] = m.ss; } // host's stats → my ally view
    if (m.as) { this.stat.k = m.as[0]; this.stat.g = m.as[1]; } // my kills/gold are host-authoritative
    if (m.hr) { const a = this.ally; [a.wallMul, a.turMul, a.turHpMul, a.costMul, a.wallLv, a.turLv] = m.hr; } // host's research → my ally view (bands/HP of host-built structures)
    if (this._lastCore !== undefined && m.core < this._lastCore) this._coreHitFx();
    this._lastCore = m.core;
    this.wave = m.wv; this._qn = m.qn || 0;
    const gts = m.gts || (m.gt !== undefined ? [m.gt] : null);
    if (gts && gts.join() !== (this.activeGates || []).join()) { this.activeGates = gts; this.activeGate = gts[0]; if (this.phase === 'build') this._banner(`다음 균열: ${gts.map(i => GATE_DIR[i]).join('·')}쪽`, 2600); }
    const wasPhase = this.phase;
    if (m.eg !== undefined) this.escGate = m.eg;
    if (this.phase !== 'over' && this.phase !== 'count' && this.phase !== 'wait' && m.ph) { if (m.ph !== this.phase) {
      if (m.ph === 'inf' && !this.inf) this._buildInfMap(); // host advanced without me (missed ingo) — catch up
      this.phase = m.ph;
      if (m.ph === 'assault') this._banner('WAVE ' + this.wave + ' — 습격!');
      else if (m.ph === 'escape') { this._banner(`⚑ 적의 코어로 통하는 균열이 열렸다 — ${GATE_DIR[m.eg ?? this.escGate ?? 0]}쪽 균열로 진입하라!`, 6000); }
      else if (m.ph === 'build') { this._banner('준비 단계 — 건설·연구'); this._beep(700, .15, 'square', .05); }
    } this.phT = m.pt; }
    const seen = new Set();
    (m.en || []).forEach(a => { const [id, ty, x, z, hp, fl] = a; seen.add(id); let e = this.enemies.get(id);
      if (!e) { e = { id, ty, x: x / 10, z: z / 10, tx: x / 10, tz: z / 10, hp, ghost: true }; if (ETYPES[ty] && ETYPES[ty].boss) { // tier travels in the packet flags — the old inference mislabeled the SOURCE as a tier-2 boss on laggy joiners
          if (fl & 2) { e.btier = 3; e.final = true; e.giant = true; }
          else if (this.inf) e.btier = (fl & 1) ? 2 : 1;
          else { e.btier = this.wave >= this.maxWave ? 3 : (fl & 1) || this.wave >= 10 ? 2 : 1; if (e.btier === 3) e.final = true; }
        } this.enemies.set(id, e); if (ETYPES[ty] && ETYPES[ty].boss) { this._banner(e.btier === 3 ? '⚠ 최종 보스 출현!' : e.btier === 2 ? '⚠ 대형 보스 출현!' : '⚠ 중간 보스 출현!', 3200); this._beep(70, .5, 'sawtooth', .09); } }
      e.tx = x / 10; e.tz = z / 10; e.hp = hp; if (!e.mhp || hp > e.mhp) e.mhp = hp; });
    for (const [id, e] of this.enemies) if (!seen.has(id)) { this._killFx(e); this.enemies.delete(id); }
    if (m.st) this._structUnpack(m.st);
    {
      const prev = this._fiSeen = this._fiSeen || new Set();
      this.fitems = (m.itm || []).map(t => ({ id: t[0], k: t[1], x: t[2] / 10, z: t[3] / 10 }));
      for (const f of this.fitems) if (!prev.has(f.id)) { prev.add(f.id); this._banner(`💠 필드 아이템 출현 — ${ITEMS[f.k].n}`, 2400); }
    }
  };
  P._netTick = function (dt) {
    this.sendPoseT -= dt;
    if (this.sendPoseT <= 0) {
      this.sendPoseT = .09;
      const p = this.me;
      const o = { t: 'p', x: +p.x.toFixed(2), z: +p.z.toFixed(2), a: +p.a.toFixed(2), hp: Math.round(p.hp), mh: p.maxhp, dn: p.down, lv: this.lv, bg: this._bgPaused ? 1 : 0, sm: +(p.scrapMul || 1).toFixed(2), au: Object.values(p.taken || {}).reduce((a, b) => a + b, 0) };
      if (this.shotQ.length) { o.sh = this.shotQ; this.shotQ = []; }
      this._send(o);
    }
    if (this.isHost) {
      this.sendStateT -= dt;
      if (this.sendStateT <= 0) {
        this.sendStateT = .13; this.sendStT -= .13;
        const o = { t: 's', tm: +this.tm.toFixed(1), xp: this.xpTotal(), sc: Math.round(this.scrap), core: Math.round(this.coreHp), wv: this.wave, ph: this.phase, pt: +this.phT.toFixed(1), qn: this.spawnQ.length, gt: this.activeGate, gts: this.activeGates, eg: this.escGate, cm: this.coreMax, ss: [this.stat.k, Math.round(this.stat.g), this.stat.b, this.stat.r], as: [this.allyStat.k, Math.round(this.allyStat.g)], hr: [this.me.wallMul, this.me.turMul, this.me.turHpMul, this.me.costMul, this.me.wallLv || 0, this.me.turLv || 0], bg: this._bgPaused ? 1 : 0, asc: Math.round(this.allyScrap),
          en: [...this.enemies.values()].map(e => [e.id, e.ty, Math.round(e.x * 10), Math.round(e.z * 10), Math.round(e.hp), (e.giant ? 2 : 0) | (e.btier === 2 ? 1 : 0)]),
          itm: this.fitems.map(f => [f.id, f.k, Math.round(f.x * 10), Math.round(f.z * 10)]) };
        if (this.sendStT <= 0) { this.sendStT = 1.4; o.st = this._structPack(); }
        this._send(o);
      }
    }
    if (this.allyOn && this.tm - this.ally.lastSeen > 6 && this.tm > 8) {
      if (!this._lostBan || this.tm - this._lostBan > 6) { this._lostBan = this.tm; this._banner('동료 연결 대기 중…', 3000); }
    }
  };
}
