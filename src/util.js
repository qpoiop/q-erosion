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
const ETYPES = [
  { hp: 30, sp: 3.9, dmg: 6, sdmg: 15, xp: 8, sc: 2, r: .55 },   // tri rusher
  { hp: 115, sp: 1.9, dmg: 15, sdmg: 40, xp: 20, sc: 6, r: .75 }, // cube breaker
  { hp: 48, sp: 2.5, dmg: 0, sdmg: 12, xp: 15, sc: 4, r: .6, rng: true }, // hex gunner
  { hp: 700, sp: 1.5, dmg: 28, sdmg: 95, xp: 80, sc: 30, r: 1.1, boss: true }, // boss
];
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
  { k: 'frate', n: '연사 계통', t: [
    { d: '발사 속도 +20%', f: p => p.frate *= 1.2 },
    { d: '발사 속도 +25%', f: p => p.frate *= 1.25 },
    { d: '발사 속도 +32%', f: p => p.frate *= 1.32 },
    { d: '발사 속도 +45%', f: p => p.frate *= 1.45 }] },
  { k: 'dmg', n: '위력 증폭', t: [
    { d: '탄환 피해 +22%', f: p => p.dmg *= 1.22 },
    { d: '탄환 피해 +28%', f: p => p.dmg *= 1.28 },
    { d: '탄환 피해 +36%', f: p => p.dmg *= 1.36 },
    { d: '탄환 피해 +50%', f: p => p.dmg *= 1.5 }] },
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
    { d: '이동 속도 +10%', f: p => p.speed *= 1.1 },
    { d: '이동 속도 +12%', f: p => p.speed *= 1.12 },
    { d: '이동 속도 +15%', f: p => p.speed *= 1.15 },
    { d: '이속 +20% · 대시 쿨 −10%', f: p => { p.speed *= 1.2; p.dashCd *= .9; } }] },
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
  { k: 'dash', n: '대시 강화', t: [
    { d: '대시 쿨다운 −15%', f: p => p.dashCd *= .85 },
    { d: '대시 쿨다운 −18%', f: p => p.dashCd *= .82 },
    { d: '대시 쿨다운 −22%', f: p => p.dashCd *= .78 },
    { d: '쿨 −25% · 무적 시간 +50%', f: p => { p.dashCd *= .75; p.dashDur = .27; } }] },
  { k: 'scrap', n: '회수 장치', t: [
    { d: '처치 자원 +30%', f: p => p.scrapMul = (p.scrapMul || 1) * 1.3 },
    { d: '처치 자원 +35%', f: p => p.scrapMul = (p.scrapMul || 1) * 1.35 },
    { d: '처치 자원 +45%', f: p => p.scrapMul = (p.scrapMul || 1) * 1.45 },
    { d: '처치 자원 +60%', f: p => p.scrapMul = (p.scrapMul || 1) * 1.6 }] },
];
const SHOP = [
  { id: 'php', c: '캐릭터', n: '장갑 보강', d: '최대 HP +25', cost: 30, per: true, f: p => { p.maxhp += 25; p.hp += 25; } },
  { id: 'pspd', c: '캐릭터', n: '구동계 개선', d: '이동 속도 +8%', cost: 30, per: true, f: p => p.speed *= 1.08 },
  { id: 'pdmg', c: '캐릭터', n: '화력 증강', d: '공격력 +12%', cost: 35, per: true, f: p => p.dmg *= 1.12 },
  { id: 'sskl', c: '스킬', n: '충격파 강화', d: '피해·반경 ↑, 쿨다운 ↓', cost: 40, per: true, max: 4, f: p => p.sklLv++ },
  { id: 'sdash', c: '스킬', n: '대시 모듈', d: '대시 쿨다운 −20%', cost: 30, per: true, max: 4, f: p => p.dashCd *= .8 },
  { id: 'gwall', c: '구조물', n: '벽 강화', d: '벽 내구 +40% (공용)', cost: 35, g: true, f: g => { g.wallMul *= 1.4; g.wallLv = (g.wallLv || 0) + 1; } },
  { id: 'gtur', c: '구조물', n: '포탑 화력', d: '포탑 공격 +25% (공용)', cost: 40, g: true, f: g => { g.turMul *= 1.25; g.turLv = (g.turLv || 0) + 1; } },
  { id: 'gcost', c: '구조물', n: '건설 자동화', d: '건설 비용 −15% (공용)', cost: 45, g: true, max: 3, f: g => g.costMul *= .85 },
];
/* synergies: taking both level-up card lines awakens a one-time evolution bonus */
const SYN = [
  { id: 'storm', need: ['frate', 'shots'], n: '폭풍 사격', d: '연사 +15% 추가', f: p => p.frate *= 1.15 },
  { id: 'ap', need: ['dmg', 'pierce'], n: '철갑 관통', d: '관통 +1 · 피해 +10%', f: p => { p.pierce++; p.dmg *= 1.1; } },
  { id: 'rush', need: ['speed', 'regen'], n: '전투 기동', d: '대시 쿨다운 −25%', f: p => p.dashCd *= .75 },
  { id: 'fort', need: ['maxhp', 'regen'], n: '재생 장갑', d: '자가 수복 ×1.6', f: p => p.regen *= 1.6 },
  { id: 'greed', need: ['scrap', 'dmg'], n: '약탈 프로토콜', d: '처치 자원 +20% 추가', f: p => p.scrapMul = (p.scrapMul || 1) * 1.2 },
];
const ITEMS = { bomb: { n: '융단 폭격' }, turret: { n: '즉석 포탑' }, kit: { n: '응급 키트' }, slow: { n: '지연 필드' } };
const ITEM_KEYS = Object.keys(ITEMS);
const DIFF = { easy: .75, normal: 1, hard: 1.35 };
const DIFF_CNT = { easy: .8, normal: 1, hard: 1.25 };  // wave size multiplier
const DIFF_SPT = { easy: 1.15, normal: 1, hard: .88 }; // spawn interval multiplier
const RELAY = 'wss://q-erosion-relay.qpoiop3.workers.dev'; // dedicated DO relay (public MQTT is the fallback)
const GATE_DIR = ['북', '남', '서', '동']; // matches gates[] order
/* GLB model manifest — primitives remain the automatic fallback for anything
   that fails to load. size = target footprint (units), yaw = forward correction,
   merge = bake all submeshes into one static mesh per material (draw-call diet). */
const MODELS = {
  ship:   { url: 'assets/char.glb',           size: 1.8, yaw: 0, merge: true },
  melee:  { url: 'assets/enemy_melee.glb',    size: 1.7, yaw: 0, merge: true },
  ranged: { url: 'assets/enemy_ranged_a.glb', size: 1.7, yaw: 0, merge: true },
  ranged2:{ url: 'assets/enemy_ranged_b.glb', size: 1.7, yaw: 0, merge: true },
  boss1:  { url: 'assets/boss_mid.glb',       size: 4.6, yaw: 0, merge: true },
  boss2:  { url: 'assets/boss_final.glb',     size: 4.2, yaw: 0, merge: true },
  tower0: { url: 'assets/tower_t1.glb',       size: 1.9, yaw: 0, merge: true }, // research band 0-3
  tower1: { url: 'assets/tower_t2.glb',       size: 2.2, yaw: 0, merge: true }, // band 4-9; band 10+ = same model, scaled up
};
const SHIP_MODEL_YAW = (() => { const q = new URLSearchParams(location.search).get('shipyaw'); return q !== null ? +q * Math.PI / 180 : 0; })();
const XP_NEED = lv => 45 + lv * 30;  // steeper curve — augments should take real kills
const WALL_COST = 10, TURRET_COST = 30, WALL_HP = 140, TURRET_HP = 90;
const BUILD_T = { 1: 1.2, 2: 2.5 }; // construction seconds: wall, turret

export { N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, DIFF, DIFF_CNT, DIFF_SPT, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T };
