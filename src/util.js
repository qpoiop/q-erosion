// shared constants & pure helpers (extracted verbatim from game.js)
/* EROSION PROTOCOL — co-op base-defense. <erosion-game mode="solo|host|join" room="ABCD" diff="normal" waves="8" buildtime="25"> */


const N = 32, TS = 2, HALF = N * TS / 2;
const ti = (gx, gz) => gz * N + gx;
const inG = (x, z) => x >= 0 && x < N && z >= 0 && z < N;
const w2g = v => Math.max(0, Math.min(N - 1, Math.floor((v + HALF) / TS)));
const g2w = g => g * TS - HALF + TS / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const PAL = { bg: 0x0b0c10, line: '#3a4052', panel: 'rgba(12,14,20,.82)', text: '#e8eaf0', dim: '#9aa3b5', cyan: '#25d8ff', cyanHex: 0x25d8ff, amber: '#ffb020', amberHex: 0xffb020, red: '#ff3b2a', redHex: 0xff3b2a, red7: '#c22212', red7Hex: 0xc22212 };
const FONT = "'Chakra Petch','Noto Sans KR',sans-serif";
/* swarm balance: many weaker mobs rather than few strong ones */
const ETYPES = [ // sdmg trimmed ~20% when turret retaliation landed — structures were melting. dmg (vs players/core) trimmed 20% across the board 2026-07-18
  { hp: 30, sp: 3.9, dmg: 4, sdmg: 11, xp: 8, sc: 2, r: .55 },   // tri rusher
  { hp: 115, sp: 1.9, dmg: 10.4, sdmg: 33, xp: 20, sc: 6, r: .75 }, // cube breaker
  { hp: 48, sp: 2.5, dmg: 0, sdmg: 9, xp: 15, sc: 4, r: .6, rng: true }, // hex gunner
  { hp: 700, sp: 1.5, dmg: 20, sdmg: 80, xp: 80, sc: 30, r: 1.1, boss: true }, // boss
];
const DIFF_SCR = { easy: 1, normal: 1, hard: 1.2, nightmare: 1.45 }; // scrap income — harder waves fund a bigger arsenal
/* card rarity tiers — each line levels 기본→레어→에픽→레전드; a tier only
   appears after the previous tier of the same line was taken */
const RAR = [
  { n: '기본', c: '#9aa3b5' },
  { n: '레어', c: '#25d8ff' },
  { n: '에픽', c: '#b26bff' },
  { n: '레전드', c: '#ffb020' },
];
const ROMAN = ['I', 'II', 'III', 'IV'];
const UPG = [
  // 연사/위력 are ADDITIVE on the base stat (base 2.5 / 9) — multiplicative stacking turned bullets into a laser
  { k: 'frate', n: '연사 계통', t: [
    { d: '발사 속도 +20%', f: p => p.frate += 2.5 * .2 },
    { d: '발사 속도 +25%', f: p => p.frate += 2.5 * .25 },
    { d: '발사 속도 +32%', f: p => p.frate += 2.5 * .32 },
    { d: '발사 속도 +45%', f: p => p.frate += 2.5 * .45 }] },
  { k: 'dmg', n: '위력 증폭', t: [
    { d: '탄환 피해 +22%', f: p => p.dmg += 9 * .22 },
    { d: '탄환 피해 +28%', f: p => p.dmg += 9 * .28 },
    { d: '탄환 피해 +36%', f: p => p.dmg += 9 * .36 },
    { d: '탄환 피해 +50%', f: p => p.dmg += 9 * .5 }] },
  { k: 'shots', n: '확산 사격', t: [
    { d: '탄환 +1 (피해 −15%)', f: p => { p.shots++; p.dmg *= .85; } },
    { d: '탄환 +1 (피해 −12%)', f: p => { p.shots++; p.dmg *= .88; } },
    { d: '탄환 +1 (피해 −8%)', f: p => { p.shots++; p.dmg *= .92; } },
    { d: '탄환 +2', f: p => p.shots += 2 }] },
  { k: 'pierce', n: '관통탄', t: [
    { d: '관통 +1', f: p => p.pierce++ },
    { d: '관통 +1', f: p => p.pierce++ },
    { d: '관통 +2', f: p => p.pierce += 2 },
    { d: '관통 +3', f: p => p.pierce += 3 }] },
  { k: 'speed', n: '기동 개선', t: [
    { d: '이동 속도 +10%', f: p => p.speed += 6 * .1 },
    { d: '이동 속도 +12%', f: p => p.speed += 6 * .12 },
    { d: '이동 속도 +15%', f: p => p.speed += 6 * .15 },
    { d: '이속 +20% · 대시 쿨 −10%', f: p => { p.speed += 6 * .2; p.dashCd *= .9; } }] },
  { k: 'regen', n: '자가 수복', t: [
    { d: '초당 HP +1.2', f: p => p.regen += 1.2 },
    { d: '초당 HP +1.6', f: p => p.regen += 1.6 },
    { d: '초당 HP +2.2', f: p => p.regen += 2.2 },
    { d: '초당 HP +3.5', f: p => p.regen += 3.5 }] },
  { k: 'maxhp', n: '장갑 보강', t: [
    { d: '최대 HP +30, 즉시 회복', f: p => { p.maxhp += 30; p.hp = Math.min(p.maxhp, p.hp + 30); } },
    { d: '최대 HP +40, 즉시 회복', f: p => { p.maxhp += 40; p.hp = Math.min(p.maxhp, p.hp + 40); } },
    { d: '최대 HP +55, 즉시 회복', f: p => { p.maxhp += 55; p.hp = Math.min(p.maxhp, p.hp + 55); } },
    { d: '최대 HP +80, 완전 회복', f: p => { p.maxhp += 80; p.hp = p.maxhp; } }] },
  { k: 'dash', n: '대시 강화', t: [ // additive on the 3.5s base, floored at 1.2s
    { d: '대시 쿨다운 −15%', f: p => p.dashCd = Math.max(1.2, p.dashCd - 3.5 * .15) },
    { d: '대시 쿨다운 −18%', f: p => p.dashCd = Math.max(1.2, p.dashCd - 3.5 * .18) },
    { d: '대시 쿨다운 −22%', f: p => p.dashCd = Math.max(1.2, p.dashCd - 3.5 * .22) },
    { d: '쿨 −25% · 무적 시간 +50%', f: p => { p.dashCd = Math.max(1.2, p.dashCd - 3.5 * .25); p.dashDur = .27; } }] },
  { k: 'scrap', n: '회수 장치', t: [ // additive
    { d: '처치 자원 +30%', f: p => p.scrapMul = (p.scrapMul || 1) + .3 },
    { d: '처치 자원 +35%', f: p => p.scrapMul = (p.scrapMul || 1) + .35 },
    { d: '처치 자원 +45%', f: p => p.scrapMul = (p.scrapMul || 1) + .45 },
    { d: '처치 자원 +60%', f: p => p.scrapMul = (p.scrapMul || 1) + .6 }] },
  { k: 'armor', n: '피해 감쇠', t: [ // additive reduction, floored at 35% taken
    { d: '받는 피해 −10%', f: p => p.armor = Math.max(.35, (p.armor || 1) - .10) },
    { d: '받는 피해 −12%', f: p => p.armor = Math.max(.35, (p.armor || 1) - .12) },
    { d: '받는 피해 −15%', f: p => p.armor = Math.max(.35, (p.armor || 1) - .15) },
    { d: '받는 피해 −20%', f: p => p.armor = Math.max(.35, (p.armor || 1) - .20) }] },
  { k: 'drop', n: '전리품 탐지', t: [ // additive
    { d: '아이템 드랍 확률 +40%', f: p => p.dropMul = (p.dropMul || 1) + .4 },
    { d: '아이템 드랍 확률 +50%', f: p => p.dropMul = (p.dropMul || 1) + .5 },
    { d: '아이템 드랍 확률 +70%', f: p => p.dropMul = (p.dropMul || 1) + .7 },
    { d: '아이템 드랍 확률 +100%', f: p => p.dropMul = (p.dropMul || 1) + 1 }] },
  { k: 'skl', n: '충격파 공명', t: [ // additive on the shockwave multipliers, cooldown floored at 45%
    { d: '충격파 피해 +30%', f: p => p.sklDmgMul = (p.sklDmgMul || 1) + .3 },
    { d: '충격파 범위 +25%', f: p => p.sklRMul = (p.sklRMul || 1) + .25 },
    { d: '충격파 쿨다운 −20%', f: p => p.sklCdMul = Math.max(.45, (p.sklCdMul || 1) - .2) },
    { d: '피해 +40% · 범위 +20% · 쿨 −15%', f: p => { p.sklDmgMul = (p.sklDmgMul || 1) + .4; p.sklRMul = (p.sklRMul || 1) + .2; p.sklCdMul = Math.max(.45, (p.sklCdMul || 1) - .15); } }] },
  { k: 'core', n: '코어 정비', t: [ // second arg = game element (host-authoritative via _coreAug); values track coreMax 2000
    { d: '코어 최대 HP +160 · 즉시 +160', f: (p, g) => g && g._coreAug(160, 160) },
    { d: '코어 최대 HP +200 · 즉시 +200', f: (p, g) => g && g._coreAug(200, 200) },
    { d: '코어 최대 HP +260 · 즉시 +260', f: (p, g) => g && g._coreAug(260, 260) },
    { d: '코어 최대 HP +320 · 완전 수리', f: (p, g) => g && g._coreAug(320, 1e9) }] },
];
const SHOP = [
  { id: 'php', c: '캐릭터', n: '장갑 보강', d: '최대 HP +25', cost: 30, per: true, f: p => { p.maxhp += 25; p.hp += 25; } },
  { id: 'pspd', c: '캐릭터', n: '구동계 개선', d: '이동 속도 +8%', cost: 30, per: true, f: p => p.speed += 6 * .08 },
  { id: 'pdmg', c: '캐릭터', n: '화력 증강', d: '공격력 +12%', cost: 35, per: true, f: p => p.dmg += 9 * .12 },
  { id: 'prng', c: '캐릭터', n: '조준 광학', d: '사거리 +12%', cost: 35, per: true, max: 5, f: p => p.range = (p.range || 9) + 9 * .12 },
  { id: 'sskl', c: '스킬', n: '충격파 강화', d: '피해·반경 ↑, 쿨다운 ↓', cost: 40, per: true, max: 4, f: p => p.sklLv++ },
  { id: 'sdash', c: '스킬', n: '대시 모듈', d: '대시 쿨다운 −20%', cost: 30, per: true, max: 4, f: p => p.dashCd = Math.max(1.2, p.dashCd - 3.5 * .2) },
  // structure research is PER-PLAYER: it applies to structures the buyer built (st flag → owner-scoped HP rescale)
  { id: 'gwall', c: '구조물', n: '벽 강화', d: '내가 지은 벽 내구 +40%', cost: 35, per: true, st: true, max: 6, f: p => { p.wallMul = (p.wallMul || 1) + .4; p.wallLv = (p.wallLv || 0) + 1; } },
  { id: 'gtur', c: '구조물', n: '포탑 화력', d: '내 포탑 공격 +15% · 내구 +15%', cost: 40, per: true, st: true, max: 8, f: p => { p.turMul *= 1.15; p.turHpMul = (p.turHpMul || 1) * 1.15; p.turLv = (p.turLv || 0) + 1; } },
  { id: 'gcost', c: '구조물', n: '건설 자동화', d: '내 건설 비용 −15%', cost: 45, per: true, st: true, max: 3, f: p => p.costMul *= .85 },
  { id: 'crep', c: '구조물', n: '코어 수리', d: '코어 HP +300 즉시 회복', cost: 50, per: true, f: (p, g) => g && g._coreAug(0, 300) },
];
/* synergies: awaken when both lines are taken, then DEEPEN — f re-applies for every
   tier gained across the two lines (see _checkSyn), so leveling either line keeps paying */
const SYN = [
  /* Synergy GRADE = min(the two lines' tiers) + 1, capped at 레전드:
     기본+기본 → 레어, 레어+레어 → 에픽, 에픽+에픽(이상) → 레전드.
     grade(p, g, gr) is called once per grade LEVEL reached (2=레어, 3=에픽, 4=레전드) — effects stack as it evolves. */
  { id: 'storm', gd: ['연사 +10%', '연사 +12%', '연사 +15%'], need: ['frate', 'shots'], n: '폭풍 사격', d: '연사 +10% / +12% / +15% (등급 누적)',
    grade: (p, g, gr) => p.frate *= gr === 4 ? 1.15 : gr === 3 ? 1.12 : 1.10 },
  { id: 'ap', gd: ['관통 +1 · 피해 +8%', '피해 +10%', '피해 +12% · 관통 +1'], need: ['dmg', 'pierce'], n: '철갑 관통', d: '각성 시 관통 +1 · 피해 +8%/+10%/+12%, 레전드 관통 +1', first: p => p.pierce++,
    grade: (p, g, gr) => { p.dmg *= gr === 4 ? 1.12 : gr === 3 ? 1.10 : 1.08; if (gr === 4) p.pierce++; } },
  { id: 'rush', gd: ['대시 쿨 −8%', '대시 쿨 −10%', '대시 쿨 −12%'], need: ['speed', 'regen'], n: '전투 기동', d: '대시 쿨다운 −8%/−10%/−12%',
    grade: (p, g, gr) => p.dashCd *= gr === 4 ? .88 : gr === 3 ? .90 : .92 },
  { id: 'fort', gd: ['수복 +1/s', '수복 +1.5/s', '수복 +2.5/s'], need: ['maxhp', 'regen'], n: '재생 장갑', d: '초당 수복 +1/+1.5/+2.5',
    grade: (p, g, gr) => p.regen += gr === 4 ? 2.5 : gr === 3 ? 1.5 : 1 },
  { id: 'greed', gd: ['자원 +10%', '자원 +12%', '자원 +15%'], need: ['scrap', 'dmg'], n: '약탈 프로토콜', d: '처치 자원 +10%/+12%/+15%',
    grade: (p, g, gr) => p.scrapMul = (p.scrapMul || 1) * (gr === 4 ? 1.15 : gr === 3 ? 1.12 : 1.10) },
  { id: 'bulwark', gd: ['받는 피해 −5%', '받는 피해 −6%', '받는 피해 −8%'], need: ['armor', 'maxhp'], n: '불괴 장갑', d: '받는 피해 −5%/−6%/−8%',
    grade: (p, g, gr) => p.armor = (p.armor || 1) * (gr === 4 ? .92 : gr === 3 ? .94 : .95) },
  { id: 'sanctum', gd: ['코어 +120', '코어 +180', '코어 +300 · 완전 회복'], need: ['core', 'regen'], n: '성역 프로토콜', d: '코어 최대 +120/+180/+300 · 즉시 회복',
    grade: (p, g, gr) => g && g._coreAug(gr === 4 ? 300 : gr === 3 ? 180 : 120, gr === 4 ? 1e9 : gr === 3 ? 180 : 120) },
  { id: 'hunter', gd: ['드랍 +15% · 자원 +5%', '드랍 +20% · 자원 +5%', '드랍 +30% · 자원 +5%'], need: ['drop', 'scrap'], n: '전리품 사냥꾼', d: '드랍 +15%/+20%/+30% · 자원 +5%씩',
    grade: (p, g, gr) => { p.dropMul = (p.dropMul || 1) * (gr === 4 ? 1.3 : gr === 3 ? 1.2 : 1.15); p.scrapMul = (p.scrapMul || 1) * 1.05; } },
  { id: 'aegis', gd: ['받는 피해 −3% · 코어 +50', '받는 피해 −4% · 코어 +70', '받는 피해 −5% · 코어 +100'], need: ['armor', 'core'], n: '수호자 서약', d: '받는 피해 −3%/−4%/−5% · 코어 +50/+70/+100',
    grade: (p, g, gr) => { p.armor = (p.armor || 1) * (gr === 4 ? .95 : gr === 3 ? .96 : .97); if (g) g._coreAug(gr === 4 ? 100 : gr === 3 ? 70 : 50, 50); } },
  { id: 'reson', gd: ['충격파 +8% · 둔화 30%', '충격파 +8% · 둔화 40%+마비 20%', '충격파 +8% · 둔화 50%+마비 35%'], need: ['skl', 'dmg'], n: '공명 폭발', d: '충격파 피해 +8%씩 · 레어 둔화 30% → 에픽 40%+마비 20% → 레전드 50%+마비 35%',
    grade: (p, g, gr) => {
      p.sklDmgMul = (p.sklDmgMul || 1) * 1.08;
      p.swSlowF = gr >= 4 ? .5 : gr >= 3 ? .6 : .7;
      p.swSlowT = gr >= 4 ? 3.5 : 3;
      p.swStunC = gr >= 4 ? .35 : gr >= 3 ? .2 : 0;
      p.swStunT = gr >= 4 ? 1.2 : 1;
    } },
  { id: 'surge', gd: ['충격파 쿨 −6% · 범위 +6%', '쿨 −8% · 범위 +6%', '쿨 −10% · 범위 +8%'], need: ['skl', 'speed'], n: '연쇄 기동', d: '충격파 쿨 −6%/−8%/−10% · 범위 +6%씩',
    grade: (p, g, gr) => { p.sklCdMul = (p.sklCdMul || 1) * (gr === 4 ? .90 : gr === 3 ? .92 : .94); p.sklRMul = (p.sklRMul || 1) * 1.06; } },
];
const ITEMS = { bomb: { n: '융단 폭격', i: '💣', d: '전 구역의 적에게 90 피해' }, turret: { n: '즉석 포탑', i: '🗼', d: '현재 위치에 포탑 즉시 건설' }, kit: { n: '응급 키트', i: '➕', d: '내 체력 완전 회복' }, slow: { n: '지연 필드', i: '⏳', d: '5초간 모든 적 감속' } };
const ITEM_KEYS = Object.keys(ITEMS);
const INV_MAX = 5; // item inventory slots
const PV = 4; // net protocol version — bump on breaking message changes; peers warn on mismatch
const DIFF = { easy: .75, normal: 1, hard: 1.35, nightmare: 1.49 };   // damage: nightmare = hard +10%
const DIFF_CNT = { easy: .8, normal: 1, hard: 1.25, nightmare: 2.5 }; // wave size: nightmare ≈ 2x hard
const DIFF_SPT = { easy: 1.15, normal: 1, hard: .88, nightmare: .5 }; // spawn interval (2x mobs need 2x flow)
const RELAY = 'wss://q-erosion-relay.qpoiop3.workers.dev'; // dedicated DO relay (public MQTT is the fallback)
const GATE_DIR = ['북', '남', '서', '동']; // matches gates[] order
/* GLB model manifest — primitives remain the automatic fallback for anything
   that fails to load. size = target footprint (units), yaw = forward correction,
   merge = bake all submeshes into one static mesh per material (draw-call diet). */
const MODELS = {
  ship:   { url: 'assets/enemy_melee.glb',    size: 2.0, yaw: 0, merge: true }, // eye-drone flies the player — swapped with the old char robot (now the gunner)
  melee:  { url: 'assets/char.glb',           size: 1.7, yaw: 0, merge: true },
  ranged: { url: 'assets/enemy_ranged_a.glb', size: 2.1, yaw: 0, merge: true },
  ranged2:{ url: 'assets/enemy_ranged_b.glb', size: 1.7, yaw: 0, merge: true },
  boss1:  { url: 'assets/boss_mid.glb',       size: 5.2, yaw: 0, merge: true },
  boss2:  { url: 'assets/boss_final.glb',     size: 5.0, yaw: 0, merge: true },
  boss3:  { url: 'assets/boss_last.glb',      size: 6.8, yaw: 0, merge: true }, // wave-15 final boss
  tower0: { url: 'assets/tower_t1.glb',       size: 1.9, yaw: 0, merge: true }, // research band 0-3
  tower1: { url: 'assets/tower_t2.glb',       size: 2.2, yaw: 0, merge: true }, // band 4-9; band 10+ = same model, scaled up
  wall0:  { url: 'assets/wall_t1.glb',        size: 1.84, yaw: 0, merge: true }, // wall research 0-3 (tile is 2 units)
  wall1:  { url: 'assets/wall_t2.glb',        size: 1.84, yaw: 0, merge: true }, // wall research 4+
  core:   { url: 'assets/core.glb',           size: 4.2, yaw: 0, merge: true }, // crystal core (sits on the 4.8-wide pedestal)
};
const SHIP_MODEL_YAW = (() => { const q = new URLSearchParams(location.search).get('shipyaw'); return q !== null ? +q * Math.PI / 180 : 0; })();
const XP_NEED = lv => 45 + lv * 30 + Math.max(0, lv - 5) * 12; // Lv1-5: original pace; Lv6+: +12/level extra so late cards space out gently
const WALL_COST = 10, TURRET_COST = 30, WALL_HP = 140, TURRET_HP = 90;
const CAP_WALL = 30, CAP_TUR = 20; // per-player build caps
const BUILD_T = { 1: 1.2, 2: 2.5 }; // construction seconds: wall, turret

export { PV, CAP_WALL, CAP_TUR, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T };
