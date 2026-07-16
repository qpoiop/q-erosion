// scene.js — verbatim methods from game.js (prototype-install)
import { PV, N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._groundTex = function () {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#171a21'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 220; i++) { const w = rnd(30, 160), h = rnd(30, 160); x.fillStyle = `rgba(${20 + rnd(0, 14) | 0},${23 + rnd(0, 14) | 0},${30 + rnd(0, 16) | 0},.55)`; x.fillRect(rnd(0, 1024), rnd(0, 1024), w, h); }
    x.strokeStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 90; i++) { x.beginPath(); const a = rnd(0, 1024), b = rnd(0, 1024); x.moveTo(a, b); x.lineTo(a + rnd(-90, 90), b + rnd(-90, 90)); x.stroke(); }
    const step = 1024 / N;
    x.strokeStyle = 'rgba(90,100,130,.42)'; x.lineWidth = 2;
    for (let i = 0; i <= N; i++) { x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * step); x.lineTo(1024, i * step); x.stroke(); }
    x.strokeStyle = 'rgba(120,135,175,.5)'; x.lineWidth = 4; x.strokeRect(2, 2, 1020, 1020);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  };
  P._initThree = function () {
    const T = THREE;
    this.scene = new T.Scene(); this.scene.background = new T.Color(PAL.bg);
    this.scene.fog = new T.FogExp2(PAL.bg, .011);
    this.cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 300);
    this.camF = new T.Vector3(0, 0, 2);
    this.renderer = new T.WebGLRenderer({ canvas: this.cv, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    const mobile = Math.min(innerWidth, innerHeight) < 700;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
    const hemi = new T.HemisphereLight(0x93a5cc, 0x07070c, .7); this.scene.add(hemi);
    const dir = new T.DirectionalLight(0xdfe8ff, 1.15); dir.position.set(22, 34, 12); dir.castShadow = true;
    dir.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    dir.shadow.camera.left = -42; dir.shadow.camera.right = 42; dir.shadow.camera.top = 42; dir.shadow.camera.bottom = -42; dir.shadow.camera.far = 90; dir.shadow.bias = -.0006;
    this.scene.add(dir);
    const rim = new T.DirectionalLight(0x2a3552, .5); rim.position.set(-18, 12, -20); this.scene.add(rim);
    const gnd = new T.Mesh(new T.PlaneGeometry(N * TS, N * TS), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .55, map: this._groundTex() }));
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; this.scene.add(gnd); this.gnd = gnd;
    const apron = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x0a0b0f, roughness: .9, metalness: .2 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -.06; apron.receiveShadow = true; this.scene.add(apron);
    // perimeter walls with gate cuts
    const wallMat = new T.MeshStandardMaterial({ color: 0x1a1d26, roughness: .4, metalness: .7 });
    const segLen = (N * TS - 12) / 2 - 2;
    const mkSeg = (x, z, w, d) => { const b = new T.Mesh(new T.BoxGeometry(w, 1.3, d), wallMat); b.position.set(x, .65, z); b.castShadow = b.receiveShadow = true; this.scene.add(b); };
    const off = segLen / 2 + 8;
    mkSeg(-off, -HALF - .4, segLen, .8); mkSeg(off, -HALF - .4, segLen, .8);
    mkSeg(-off, HALF + .4, segLen, .8); mkSeg(off, HALF + .4, segLen, .8);
    mkSeg(-HALF - .4, -off, .8, segLen); mkSeg(-HALF - .4, off, .8, segLen);
    mkSeg(HALF + .4, -off, .8, segLen); mkSeg(HALF + .4, off, .8, segLen);
    // monoliths
    const monoMat = new T.MeshStandardMaterial({ color: 0x121620, roughness: .6, metalness: .5 });
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + rnd(-.15, .15), r = HALF + rnd(8, 22);
      const h = rnd(4, 14), m = new T.Mesh(new T.BoxGeometry(rnd(1.4, 3.4), h, rnd(1.4, 3.4)), monoMat);
      m.position.set(Math.cos(a) * r, h / 2 - .5, Math.sin(a) * r); m.rotation.y = rnd(0, Math.PI); m.castShadow = true; this.scene.add(m);
    }
    // dust
    const pg = new T.BufferGeometry(), pts = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { pts[i * 3] = rnd(-HALF, HALF); pts[i * 3 + 1] = rnd(.3, 7); pts[i * 3 + 2] = rnd(-HALF, HALF); }
    pg.setAttribute('position', new T.BufferAttribute(pts, 3));
    this.dust = new T.Points(pg, new T.PointsMaterial({ color: 0x5a6a8a, size: .06, transparent: true, opacity: .5 }));
    this.scene.add(this.dust);
    // materials
    this.mBody = new T.MeshStandardMaterial({ color: 0x1b1e26, roughness: .35, metalness: .8 });
    this.mEnemy = new T.MeshStandardMaterial({ color: 0x191219, roughness: .45, metalness: .6 });
    this.mGlowRed = new T.MeshStandardMaterial({ color: 0x1a0605, emissive: PAL.redHex, emissiveIntensity: 1.1 });
    this.mGlowRed7 = new T.MeshStandardMaterial({ color: 0x140503, emissive: PAL.red7Hex, emissiveIntensity: .9 });
    this.mGlowCyan = new T.MeshStandardMaterial({ color: 0x06141a, emissive: PAL.cyanHex, emissiveIntensity: 1.4 });
    this.mGlowAmber = new T.MeshStandardMaterial({ color: 0x1a1206, emissive: PAL.amberHex, emissiveIntensity: 1.3 });
    this.mFlash = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 });
    this.mWallS = new T.MeshStandardMaterial({ color: 0x232836, roughness: .4, metalness: .75 });
    this.mObs = new T.MeshStandardMaterial({ color: 0x241f31, roughness: .85, metalness: .25 });
    this.bulletG = new T.BoxGeometry(1.8, .07, .07); // laser streak, oriented along velocity
    this.bulletTurG = new T.BoxGeometry(2.6, .13, .13); // turret shots: longer, thicker, white-hot
    this.ebulletG = new T.SphereGeometry(.16, 8, 8);
    this.mBeamCyan = new T.MeshBasicMaterial({ color: 0x8ff2ff, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false });
    this.mBeamAmber = new T.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false });
    this.mBeamTur = new T.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false });
    this.mBeamTur1 = new T.MeshBasicMaterial({ color: 0xffc36e, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false }); // research band 1: amber shots
    this.mBeamTur2 = new T.MeshBasicMaterial({ color: 0xd98aff, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false }); // band 2: violet shots
    this.mGlowViolet = new T.MeshStandardMaterial({ color: 0x150a1e, emissive: 0xb46bff, emissiveIntensity: 1.5 });
    this.fxRingG = new T.RingGeometry(.25, .38, 24); // shared by all impact rings (pooled in _fx)
    this._fxPool = [];
    // core (cyan crystal at center)
    const cg = new T.Group();
    const cb = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, .6, 8), this.mBody); cb.position.y = .3; cb.castShadow = cb.receiveShadow = true; cg.add(cb);
    const cry = new T.Mesh(new T.OctahedronGeometry(1.3), this.mGlowCyan); cry.scale.y = 1.9; cry.position.y = 2.8; cry.castShadow = true; cg.add(cry); cg.cry = cry;
    const ring = new T.Mesh(new T.TorusGeometry(2, .08, 8, 40), this.mGlowCyan); ring.position.y = 2.6; ring.rotation.x = Math.PI / 2.3; cg.add(ring); cg.ring = ring;
    const beam = new T.Mesh(new T.CylinderGeometry(.14, .34, 26, 8, 1, true), new T.MeshBasicMaterial({ color: PAL.cyanHex, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false }));
    beam.position.y = 13; cg.add(beam);
    const lamp = new T.PointLight(PAL.cyanHex, 1.6, 16); lamp.position.y = 3.4; cg.add(lamp); cg.lamp = lamp;
    cg.position.set(g2w(15) + TS / 2, 0, g2w(15) + TS / 2); this.scene.add(cg); this.coreMesh = cg;
    // gates (red rift portals)
    this.gateMs = this.gates.map(g => {
      const gr = new T.Group();
      const f1 = new T.Mesh(new T.BoxGeometry(.6, 4.4, .6), this.mEnemy); f1.position.set(-5.4, 2.2, 0); f1.castShadow = true; gr.add(f1);
      const f2 = f1.clone(); f2.position.x = 5.4; gr.add(f2);
      const top = new T.Mesh(new T.BoxGeometry(11.4, .6, .6), this.mEnemy); top.position.y = 4.4; gr.add(top);
      const rift = new T.Mesh(new T.PlaneGeometry(10.2, 3.9), new T.MeshBasicMaterial({ color: PAL.redHex, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      rift.position.y = 1.8; gr.add(rift); gr.rift = rift;
      const lamp2 = new T.PointLight(PAL.redHex, 1.4, 12); lamp2.position.y = 2; gr.add(lamp2); gr.lamp = lamp2;
      gr.position.set(g2w(g.gx) + (g.gz === 0 || g.gz === N - 1 ? TS / 2 : 0), 0, g2w(g.gz) + (g.gx === 0 || g.gx === N - 1 ? TS / 2 : 0));
      if (g.gx === 0 || g.gx === N - 1) gr.rotation.y = Math.PI / 2;
      this.scene.add(gr); return gr;
    });
    // ally pointer arrow (orbits my unit, aimed at the teammate)
    this.allyArrG = new T.Group();
    this.allyArr = new T.Mesh(new T.ConeGeometry(.26, .75, 3), new T.MeshBasicMaterial({ color: PAL.amberHex, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }));
    this.allyArr.rotation.x = Math.PI / 2; // lie flat, apex toward group +z
    this.allyArrG.add(this.allyArr); this.allyArrG.visible = false; this.scene.add(this.allyArrG);
    // players
    this.meG = this._mkPlayer(true); this.allyG = this._mkPlayer(false);
    this._loadModels();
    this.scene.add(this.meG); this.scene.add(this.allyG);
    this.allyG.visible = this.allyOn;
    // ghost placement cursor
    this.ghost = new T.Mesh(new T.BoxGeometry(TS * .92, 1.4, TS * .92), new T.MeshBasicMaterial({ color: PAL.cyanHex, transparent: true, opacity: .3, depthWrite: false }));
    this.ghost.visible = false; this.scene.add(this.ghost);
    // build-mode overlay: placeable tiles glow green
    const bovC = document.createElement('canvas'); bovC.width = bovC.height = N;
    this._bovCtx = bovC.getContext('2d');
    this._bovTex = new T.CanvasTexture(bovC); this._bovTex.magFilter = T.NearestFilter; this._bovTex.minFilter = T.NearestFilter; // default flipY=true: canvas row gz maps to world +z correctly
    this.buildOv = new T.Mesh(new T.PlaneGeometry(N * TS, N * TS), new T.MeshBasicMaterial({ map: this._bovTex, transparent: true, depthWrite: false }));
    this.buildOv.rotation.x = -Math.PI / 2; this.buildOv.position.y = .04; this.buildOv.visible = false; this.scene.add(this.buildOv);
    this.eMeshes = new Map(); this.bMeshes = []; this.sMeshes = new Map(); this.fxs = []; this.sparks = []; this.itemMs = [];
    this._onRz = () => {
      const w = this.clientWidth || innerWidth, h = this.clientHeight || innerHeight;
      this.renderer.setSize(w, h, false);
      const asp = w / h, vh = Math.max(26, 26 / asp);
      this.cam.left = -vh * asp / 2; this.cam.right = vh * asp / 2; this.cam.top = vh / 2; this.cam.bottom = -vh / 2;
      this.cam.updateProjectionMatrix();
      if (this.composer) this.composer.setSize(w, h);
    };
    if (T.EffectComposer && T.UnrealBloomPass) {
      this.composer = new T.EffectComposer(this.renderer);
      this.composer.addPass(new T.RenderPass(this.scene, this.cam));
      this.bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), .45, .5, .85);
      this.composer.addPass(this.bloom);
    }
    // iOS fires resize/orientationchange before layout settles — re-run sizing a few times
    this._onRzBurst = () => { this._onRz(); setTimeout(this._onRz, 120); setTimeout(this._onRz, 350); setTimeout(this._onRz, 700); };
    window.addEventListener('resize', this._onRzBurst);
    window.addEventListener('orientationchange', this._onRzBurst);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onRzBurst);
    this._onRz();
  };
  P._mkPlayer = function (isMe) {
    const T = THREE, g = new T.Group();
    const accent = isMe ? this.mGlowCyan : this.mGlowAmber;
    const hull = new T.Mesh(new T.BoxGeometry(.8, .3, 1.25), this.mBody); hull.position.y = .5; hull.castShadow = true; g.add(hull);
    const nose = new T.Mesh(new T.BoxGeometry(.42, .22, .5), this.mBody); nose.position.set(0, .52, .78); nose.castShadow = true; g.add(nose);
    const canopy = new T.Mesh(new T.BoxGeometry(.34, .14, .42), accent); canopy.position.set(0, .68, .22); g.add(canopy);
    const wingG = new T.BoxGeometry(.5, .08, .6);
    const wl = new T.Mesh(wingG, this.mBody); wl.position.set(-.62, .46, -.2); wl.rotation.z = .18; wl.castShadow = true; g.add(wl);
    const wr = new T.Mesh(wingG, this.mBody); wr.position.set(.62, .46, -.2); wr.rotation.z = -.18; wr.castShadow = true; g.add(wr);
    const e1 = new T.Mesh(new T.BoxGeometry(.14, .14, .22), accent); e1.position.set(-.3, .46, -.72); g.add(e1);
    const e2 = e1.clone(); e2.position.x = .3; g.add(e2);
    const ring = new T.Mesh(new T.RingGeometry(.7, .86, 32), new T.MeshBasicMaterial({ color: isMe ? PAL.cyanHex : PAL.amberHex, transparent: true, opacity: isMe ? .55 : .35, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
    // ground ripple: expanding fading rings so your unit reads instantly
    g.ripples = [];
    for (let i = 0; i < 3; i++) {
      const rp = new T.Mesh(new T.RingGeometry(.58, .7, 28), new T.MeshBasicMaterial({ color: isMe ? PAL.cyanHex : PAL.amberHex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      rp.rotation.x = -Math.PI / 2; rp.position.y = .05; g.add(rp); g.ripples.push(rp);
    }
    const lamp = new T.PointLight(isMe ? PAL.cyanHex : PAL.amberHex, .8, 5); lamp.position.y = .8; g.add(lamp);
    g.body = hull; g.accents = [canopy, e1, e2]; g.ring = ring; g.accentMat = accent;
    g.shipParts = [hull, nose, canopy, wl, wr, e1, e2]; // hidden when a GLB ship model is applied
    return g;
  };
  P._eMesh = function (e) {
    const T = THREE;
    const key = e.ty === 3 ? (e.btier === 3 ? (this.mdl && this.mdl.boss3 ? 'boss3' : 'boss2') : e.btier === 2 ? 'boss2' : 'boss1') : e.ty === 2 ? (e.id % 2 ? 'ranged' : (this.mdl && this.mdl.ranged2 ? 'ranged2' : 'ranged')) : 'melee';
    const tpl = this.mdl && this.mdl[key];
    if (tpl) {
      const g = new T.Group();
      const m = tpl.clone(true);
      if (e.ty === 1) { m.scale.multiplyScalar(1.25); m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new T.Color(0x3a0d08); } }); } // breaker: bigger, red-tinged
      else if (e.ty === 2) { m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new T.Color(0x521208); } }); } // gunners: strong red tinge — Robo_V2 was reading as the teal player faction
      g.add(m); g.isModel = true;
      if (e.ty === 3) {
        const aura = new T.Mesh(new T.RingGeometry(1.5, 1.85, 40), new T.MeshBasicMaterial({ color: PAL.redHex, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
        aura.rotation.x = -Math.PI / 2; aura.position.y = .07; g.add(aura); g.aura = aura;
        // no PointLight: boss spawn/death would change the light count → full-scene shader recompile stall
      }
      if (e.final && !(this.mdl && this.mdl.boss3)) g.scale.setScalar(2); // boss3 GLB is already colossal; only the fallback needs inflating
      if (e.giant) g.scale.multiplyScalar(2); // 침식의 근원 — twice the final boss
      this.scene.add(g); return g;
    }
    const g = new T.Group();
    let body;
    if (e.ty === 0) {
      body = new T.Mesh(new T.ConeGeometry(.5, .95, 4), this.mEnemy); body.position.y = .55;
      const eye = new T.Mesh(new T.SphereGeometry(.14, 8, 8), this.mGlowRed); eye.position.set(0, .62, .3); g.add(eye);
    } else if (e.ty === 1) {
      body = new T.Mesh(new T.BoxGeometry(1.15, .8, 1.15), this.mEnemy); body.position.y = .45;
      const slit = new T.Mesh(new T.BoxGeometry(1.2, .12, .16), this.mGlowRed); slit.position.set(0, .58, .5); g.add(slit);
      const cap = new T.Mesh(new T.BoxGeometry(.7, .18, .7), this.mGlowRed7); cap.position.y = .92; g.add(cap);
    } else if (e.ty === 2) {
      body = new T.Mesh(new T.CylinderGeometry(.5, .58, .55, 6), this.mEnemy); body.position.y = .42;
      const halo = new T.Mesh(new T.TorusGeometry(.55, .05, 6, 24), this.mGlowRed); halo.position.y = .95; halo.rotation.x = Math.PI / 2; g.add(halo);
    } else { // boss
      body = new T.Mesh(new T.BoxGeometry(2, 1.5, 2), this.mEnemy); body.position.y = .85;
      const crown = new T.Mesh(new T.OctahedronGeometry(.6), this.mGlowRed); crown.position.y = 2.1; g.add(crown);
      const band = new T.Mesh(new T.BoxGeometry(2.1, .2, 2.1), this.mGlowRed7); band.position.y = .85; g.add(band);
      const aura = new T.Mesh(new T.RingGeometry(1.5, 1.85, 40), new T.MeshBasicMaterial({ color: PAL.redHex, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      aura.rotation.x = -Math.PI / 2; aura.position.y = .07; g.add(aura); g.aura = aura;
    }
    body.castShadow = true; g.add(body); g.body = body;
    if (e.final) g.scale.setScalar(2); // final boss towers over the mid-boss
    this.scene.add(g); return g;
  };
  P._sMesh = function (k, i) { // structure mesh
    const T = THREE, g = new T.Group();
    if (k === 1) {
      const oq = this._ownerOf(i);
      const wband = (oq.wallLv || 0) >= 4 ? 1 : 0;
      const wtpl = this.mdl && this.mdl['wall' + wband];
      if (wtpl) {
        const m = wtpl.clone(true); m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        g.add(m); g.wband = wband; g.grounded = true; // model origin is at the ground — HP squash keeps the base
        const bh = new T.Box3().setFromObject(m).max.y;
        const trim = new T.Mesh(new T.BoxGeometry(TS * .96, .1, TS * .96), this.mGlowCyan); trim.position.y = g.trimH = bh + .05; g.add(trim); g.trim = trim;
      } else {
        const b = new T.Mesh(new T.BoxGeometry(TS * .92, 1.5, TS * .92), this.mWallS); b.position.y = .75; b.castShadow = b.receiveShadow = true; g.add(b);
        const trim = new T.Mesh(new T.BoxGeometry(TS * .96, .1, TS * .96), this.mGlowCyan); trim.position.y = g.trimH = 1.53; g.add(trim); g.trim = trim;
      }
    } else if (k === 5) { // erosion rock — per-round terrain obstacle
      const h = 1.1 + (i % 7) * .14;
      const b1 = new T.Mesh(new T.BoxGeometry(TS * .8, h, TS * .8), this.mObs); b1.position.y = h / 2; b1.rotation.y = (i % 9) * .12; b1.castShadow = b1.receiveShadow = true; g.add(b1);
      const b2 = new T.Mesh(new T.BoxGeometry(TS * .5, h * .6, TS * .5), this.mObs); b2.position.set(.3 - (i % 3) * .3, h * .55, .25 - (i % 2) * .5); b2.rotation.y = .5 + (i % 5) * .3; b2.castShadow = true; g.add(b2);
      const rim = new T.Mesh(new T.BoxGeometry(TS * .86, .07, TS * .86), this.mGlowRed7); rim.position.y = .05; g.add(rim);
    } else {
      const band = this._turBand(this._ownerOf(i));
      const tpl = this.mdl && this.mdl['tower' + Math.min(band, 1)]; // top band reuses t2, scaled
      if (tpl) {
        const m = tpl.clone(true);
        m.traverse(o => { if (o.isMesh) o.castShadow = true; });
        g.add(m); g.band = band;
        // research bands recolor barrel + base ring: cyan → amber → violet (matches the shot beams)
        const bMat = band >= 2 ? this.mGlowViolet : band === 1 ? this.mGlowAmber : this.mGlowCyan;
        const gun2 = new T.Mesh(new T.BoxGeometry(.14, .14, 1.1), bMat);
        const bh = new T.Box3().setFromObject(m).max.y;
        gun2.position.set(0, Math.max(1.1, bh * .82), .5); g.add(gun2); g.gun = gun2;
        const bring = new T.Mesh(new T.TorusGeometry(.62, .055, 6, 24), bMat);
        bring.rotation.x = -Math.PI / 2; bring.position.y = .09; g.add(bring);
        this.scene.add(g); return g;
      }
      const base = new T.Mesh(new T.BoxGeometry(.9, .5, .9), this.mWallS); base.position.y = .25; base.castShadow = true; g.add(base);
      const pod = new T.Mesh(new T.BoxGeometry(.55, .45, .8), this.mBody); pod.position.y = .75; pod.castShadow = true; g.add(pod); g.pod = pod;
      const bandMat = band >= 2 ? this.mGlowViolet : band === 1 ? this.mGlowAmber : this.mGlowCyan;
      const gun = new T.Mesh(new T.BoxGeometry(.12, .12, .7), bandMat); gun.position.set(0, .78, .5); pod.add ? g.add(gun) : 0; g.gun = gun;
      const cap2 = new T.Mesh(new T.BoxGeometry(.3, .08, .3), bandMat); cap2.position.y = 1.02; g.add(cap2); // emissive glow instead of a per-turret PointLight
    }
    this.scene.add(g); return g;
  };
  P._warmFx = function () { // fill spark/ring pools and flash them once behind the intro overlay:
    // material shader/uniform init happens on first render, so a first mass-kill would otherwise stall one frame
    const cx = g2w(15) + TS / 2, cz = g2w(15) + TS / 2;
    for (let i = 0; i < 5; i++) this._burst(cx, cz, 0xffffff, 40, .01);
    for (let i = 0; i < 24; i++) this._fx(cx, cz, false, 0xffffff);
    for (const s of this.sparks) { s.userData.life = .1; s.material.opacity = .02; }
    for (const f of this.fxs) { f.userData.t = .8; f.material.opacity = .02; }
  };
  P._mkBar = function (x, z, w) { // progress/HP gauge above a structure
    const T = THREE, gr = new T.Group(); w = w || 1.5;
    const bg = new T.Mesh(new T.BoxGeometry(w, .12, .12), new T.MeshBasicMaterial({ color: 0x10131c }));
    const fill = new T.Mesh(new T.BoxGeometry(w, .14, .14), new T.MeshBasicMaterial({ color: PAL.cyanHex }));
    gr.add(bg); gr.add(fill); gr.fill = fill; gr.w = w;
    gr.position.set(x, 2.25, z); gr.rotation.y = Math.PI / 4; // aligned to the screen horizontal
    this.scene.add(gr); return gr;
  };
  P._setBar = function (bar, p, colHex) {
    bar.fill.scale.x = Math.max(.001, p);
    bar.fill.position.x = -bar.w / 2 * (1 - p);
    bar.fill.material.color.setHex(colHex);
  };
  P._hpColor = function (p) { return p > .6 ? PAL.cyanHex : p > .3 ? PAL.amberHex : PAL.redHex; }
  P._fx = function (x, z, big, colHex) {
    const T = THREE;
    this._burst(x, z, colHex ?? 0xffffff, big ? 26 : 7, big ? 9 : 5);
    if (big) this.shake = Math.max(this.shake || 0, .5);
    if (!big && this.fxs.length >= 48) return; // saturation cap — mass kills keep sparks, drop extra rings
    let m = this._fxPool.pop();
    if (!m) m = new T.Mesh(this.fxRingG, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.material.color.setHex(colHex ?? 0xffffff); m.material.opacity = .85;
    m.rotation.x = -Math.PI / 2; m.position.set(x, .1, z); m.scale.set(1, 1, 1); m.visible = true;
    m.userData.t = 0; m.userData.big = big ? 4 : 1.6;
    this.scene.add(m); this.fxs.push(m);
  };
  P._burst = function (x, z, colHex, n, sp) {
    const T = THREE;
    if (this.sparks.length > 150) n = Math.min(n, 3); // mass-death storm: thin out instead of stalling
    if (this.sparks.length > 240) return;
    for (let i = 0; i < n; i++) {
      let m = this._sparkPool && this._sparkPool.pop();
      if (!m) m = new T.Mesh(new T.BoxGeometry(.09, .09, .09), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      m.material.color.setHex(colHex); m.material.opacity = 1; m.visible = true;
      m.position.set(x, .5, z);
      const a = rnd(0, Math.PI * 2), v = rnd(sp * .3, sp);
      m.userData = { vx: Math.cos(a) * v, vy: rnd(2, 6), vz: Math.sin(a) * v, life: rnd(.3, .6) };
      this.scene.add(m); this.sparks.push(m);
    }
  };
  P._render = function (dt) {
    const T = THREE, now = performance.now() / 1000;
    this._fno = ((this._fno | 0) + 1) & 0xffff;
    if (this.dust) this.dust.rotation.y += dt * .01;
    // build-mode overlay: refresh placeable tiles 4x/s
    const bovOn = this.buildMode && this.buildSel !== 3 && !this.over;
    this.buildOv.visible = bovOn;
    if (bovOn && now - (this._bovT || 0) > .12) {
      this._bovT = now;
      const ctx = this._bovCtx;
      ctx.clearRect(0, 0, N, N);
      ctx.fillStyle = 'rgba(70,235,120,.28)';
      // static blockers only (occ) — unit-proximity denial is shown by the ghost cursor,
      // so the green wash never disagrees with where you can actually click
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) if (!this.occ[ti(gx, gz)]) ctx.fillRect(gx, gz, 1, 1);
      this._bovTex.needsUpdate = true;
    }
    // structures
    if (this._structDirty) {
      this._structDirty = false;
      for (let i = 0; i < N * N; i++) {
        const k = this.occ[i], has = this.sMeshes.has(i);
        if ((k === 1 || k === 2 || k === 5)) {
          let g = this.sMeshes.get(i);
          const oq = this._ownerOf(i);
          const wband = (oq.wallLv || 0) >= 4 ? 1 : 0;
          const bandStale = (k === 2 && g && ((g.band !== undefined && g.band !== this._turBand(oq)) || (g.band === undefined && this.mdl && this.mdl.tower0)))
            || (k === 1 && g && ((g.wband !== undefined && g.wband !== wband) || (g.wband === undefined && this.mdl && this.mdl.wall0)));
          if (!g || g.kind !== k || bandStale) { if (g) { if (g.bar) this.scene.remove(g.bar); this.scene.remove(g); } g = this._sMesh(k, i); g.kind = k; this.sMeshes.set(i, g); g.position.set(g2w(i % N), 0, g2w((i / N) | 0)); }
        } else if (has) { const old = this.sMeshes.get(i); if (old.bar) this.scene.remove(old.bar); this.scene.remove(old); this.sMeshes.delete(i); }
      }
    }
    for (const [i, g] of this.sMeshes) {
      if (g.kind !== 5) {
        const b = this.bld[i];
        if (b < 1) { // rising from the ground + progress gauge
          g.scale.y = .12 + .88 * b;
          if (!g.bar) g.bar = this._mkBar(g.position.x, g.position.z);
          this._setBar(g.bar, b, PAL.cyanHex);
        } else {
          const hpP = clamp(this.shp[i] / this._structHp(g.kind), 0, 1);
          if (hpP < .999) { // damaged: same slot becomes an HP gauge
            if (!g.bar) g.bar = this._mkBar(g.position.x, g.position.z);
            this._setBar(g.bar, hpP, this._hpColor(hpP));
          } else if (g.bar) { this.scene.remove(g.bar); g.bar = null; }
          let sy = 1;
          if (g.userData.pop > 0) { g.userData.pop -= dt; sy = 1 + .22 * Math.sin(Math.min(1, 1 - g.userData.pop / .28) * Math.PI); }
          // research tiers change the silhouette: turrets grow (2x2-scale at Lv10+), wall trims thicken
          const oql = (this._ownerOf(i).turLv || 0);
          const base = g.kind === 2 ? (g.band !== undefined ? (g.band >= 2 ? 1.35 : 1) * (1 + oql * .03) : (oql >= 8 ? 2 : 1 + oql * .07)) : 1;
          g.scale.set(base, base * sy, base);
          if (g.kind === 1 && g.trim) g.trim.scale.y = 1 + (this._ownerOf(i).wallLv || 0) * .8;
        }
      }
      if (g.kind === 1) { const hpP = this.shp[i] / this._structHp(1, this._ownerOf(i)); g.trim.material = hpP < .35 ? this.mGlowRed : this.mGlowCyan; const sy = .55 + .45 * clamp(hpP, 0, 1); g.children[0].scale.y = sy; g.children[0].position.y = g.grounded ? 0 : .75 * sy; g.trim.position.y = (g.trimH || 1.53) * sy; }
      else if (g.gun) {
        if (((i + (this._fno | 0)) & 1) === 0) { // aim at nearest enemy — staggered: half the turrets per frame (O(T×E) scan)
          let best = null, bd = 90; const x = g.position.x, z = g.position.z;
          for (const e of this.enemies.values()) { const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
          if (best) g.rotation.y = -Math.atan2(best.z - z, best.x - x) + Math.PI / 2;
        }
        const tf = this._turFlash && this._turFlash[i]; // muzzle recoil: barrel kicks back and stretches on fire
        if (tf > 0) { this._turFlash[i] = tf - dt * 5; g.gun.scale.z = 1 + tf * .5; g.gun.position.z = (g.gunZ0 ?? (g.gunZ0 = g.gun.position.z)) - tf * .22; }
        else if (g.gunZ0 !== undefined) { g.gun.scale.z = 1; g.gun.position.z = g.gunZ0; }
      }
    }
    // core
    const c = this.coreMesh;
    c.cry.rotation.y += dt * .8; c.ring.rotation.z += dt * 1.2;
    const chp = clamp(this.coreHp / this.coreMax, 0, 1);
    const coreFlash = !!(this._coreBanT && this.tm - this._coreBanT < .5);
    if (c.model) { // GLB core: hp shrinks it slightly, hits flash all its materials
      c.model.rotation.y += dt * .5;
      const cs = (c.s0 || 1) * (.8 + .25 * chp); c.model.scale.setScalar(cs);
      if (coreFlash !== c._fl) { c._fl = coreFlash; for (const [o, m0] of c.mats) o.material = coreFlash ? this.mFlash : m0; }
    } else {
      c.cry.material = coreFlash ? this.mFlash : this.mGlowCyan;
      c.cry.scale.set(.7 + .3 * chp, 1.9 * (.7 + .3 * chp), .7 + .3 * chp);
    }
    c.lamp.intensity = 1.2 + Math.sin(now * 2.5) * .4;
    if (!this.coreBar) { this.coreBar = this._mkBar(c.position.x, c.position.z, 4.2); this.coreBar.position.y = 5.6; }
    this.coreBar.visible = true; // always visible — the core is the win/lose condition
    this._setBar(this.coreBar, chp, this._hpColor(chp));
    // gates pulse
    this.gateMs.forEach((g, i) => {
      if (this.inf) return; // no gates on map 2
      if (this.phase === 'escape') { // the way OUT glows gold
        const esc = i === this.escGate;
        g.rift.material.color.setHex(esc ? PAL.amberHex : 0x6a7180);
        g.rift.material.opacity = esc ? .6 + Math.sin(now * 5) * .3 : .1;
        g.lamp.color.setHex(esc ? PAL.amberHex : 0x6a7180);
        g.lamp.intensity = esc ? 2.2 + Math.sin(now * 6) * .8 : .1;
        return;
      }
      const active = (this.activeGates || [this.activeGate]).includes(i);
      // inactive rifts turn gray so the live gate is unmistakable
      g.rift.material.color.setHex(active ? PAL.redHex : 0x6a7180);
      g.rift.material.opacity = active ? .5 + Math.sin(now * 3 + i) * .2 + (this.phase === 'assault' ? .25 : 0) : .16;
      g.lamp.color.setHex(active ? PAL.redHex : 0x6a7180);
      g.lamp.intensity = active ? 1.6 + Math.sin(now * 4) * .5 : .25;
    });
    // ally pointer: small arrow orbiting MY unit, aimed at the teammate
    {
      const me = this.me, al = this.ally;
      const far = this.allyOn && dist2(me.x, me.z, al.x, al.z) > 90; // teammate ~9.5+ units away
      const show = this.allyOn && !this.over && (far || al.down) && (this.phase === 'build' || this.phase === 'assault');
      this.allyArrG.visible = show;
      if (show) {
        const a = Math.atan2(al.z - me.z, al.x - me.x);
        this.allyArrG.position.set(me.x + Math.cos(a) * 1.7, .55 + Math.sin(now * 4) * .12, me.z + Math.sin(a) * 1.7);
        this.allyArrG.rotation.y = -a + Math.PI / 2;
        this.allyArr.material.color.setHex(al.down ? PAL.redHex : PAL.amberHex);
        this.allyArr.material.opacity = al.down ? (((now * 4 | 0) % 2) ? .95 : .35) : .5 + Math.sin(now * 3) * .25;
      }
    }
    // players
    const setP = (g, p, isMe) => {
      g.position.set(p.x, Math.sin(now * 2.6 + (isMe ? 0 : 2)) * .06, p.z);
      g.rotation.y = -p.a + Math.PI / 2; // model nose = +z; aligns facing with move/aim angle
      g.rotation.z = 0;
      if (p.down) { g.rotation.z = 1.2; g.position.y = -.15; g.accents.forEach(a => a.material = ((now * 4 | 0) % 2) ? this.mGlowRed : g.accentMat); }
      else g.accents.forEach(a => a.material = g.accentMat);
      g.ring.scale.setScalar(1 + Math.sin(now * 3) * .06);
      g.ripples.forEach((rp, i) => { // outward-travelling water-ring pulse
        const ph = (now * .55 + i / 3) % 1;
        rp.scale.setScalar(.7 + ph * 1.9);
        rp.material.opacity = Math.sin(Math.min(1, ph * 3) * Math.PI / 2) * (1 - ph) * (isMe ? .6 : .35);
      });
      if (p.dashing > 0) this._burst(p.x, p.z, isMe ? PAL.cyanHex : PAL.amberHex, 2, 3);
    };
    setP(this.meG, this.me, true);
    if (this.allyOn) { this.allyG.visible = true; setP(this.allyG, this.ally, false); } else this.allyG.visible = false;
    // enemies
    for (const [id, e] of this.enemies) {
      let m = this.eMeshes.get(id); if (!m) { m = this._eMesh(e); this.eMeshes.set(id, m); }
      if (m.isModel) { const mdx = e.x - (m.px ?? e.x), mdz = e.z - (m.pz ?? e.z); if (mdx * mdx + mdz * mdz > 1e-6) m.rotation.y = -Math.atan2(mdz, mdx) + Math.PI / 2; m.px = e.x; m.pz = e.z; }
      else m.rotation.y += dt * (e.ty === 2 ? 1.5 : .6);
      m.position.set(e.x, 0, e.z);
      if (ETYPES[e.ty] && ETYPES[e.ty].boss) { // boss: big red HP bar overhead + pulsing aura
        if (!m.bossBar) { m.bossBar = this._mkBar(e.x, e.z, e.btier === 3 ? 4.6 : 3.6); const bh = new T.Box3().setFromObject(m).max.y; m.bossBar.position.y = Math.max(3.4, bh + 1); } // above the actual model, whatever its height
        m.bossBar.position.x = e.x; m.bossBar.position.z = e.z;
        this._setBar(m.bossBar, clamp(e.hp / (e.mhp || e.hp || 1), 0, 1), PAL.redHex);
        if (m.aura) { m.aura.scale.setScalar(1 + Math.sin(now * 3.2) * .12); m.aura.material.opacity = .4 + Math.sin(now * 3.2) * .2; }
      }
      if (e.ty === 0) m.position.y = Math.abs(Math.sin(now * 6 + id)) * .12;
      if (m.body) { if (e.flash > 0) { e.flash -= dt; m.body.material = this.mFlash; } else m.body.material = this.mEnemy; }
      else if (m.isModel && e.flash > 0) { e.flash -= dt; m.children[0].scale.setScalar(m.children[0].userData.s0 || (m.children[0].userData.s0 = m.children[0].scale.x)); m.children[0].scale.multiplyScalar(1.06); }
    }
    for (const [id, m] of this.eMeshes) if (!this.enemies.has(id)) { if (m.bossBar) this.scene.remove(m.bossBar); this.scene.remove(m); this.eMeshes.delete(id); }
    // bullets
    while (this.bMeshes.length < this.bullets.length + this.ebullets.length) { const m = new T.Mesh(this.bulletG, this.mBeamCyan); this.scene.add(m); this.bMeshes.push(m); }
    let bi = 0;
    for (const b of this.bullets) { const m = this.bMeshes[bi++]; m.visible = true; m.geometry = b.tur ? this.bulletTurG : this.bulletG; m.material = b.tur ? (b.band === 2 ? this.mBeamTur2 : b.band === 1 ? this.mBeamTur1 : this.mBeamTur) : b.ally ? this.mBeamAmber : this.mBeamCyan; m.scale.setScalar(b.tur && b.band ? (b.band === 2 ? 1.5 : 1.2) : 1); m.position.set(b.x, b.y || .55, b.z); m.rotation.y = -Math.atan2(b.dz, b.dx); }
    for (const b of this.ebullets) { const m = this.bMeshes[bi++]; m.visible = true; m.geometry = this.ebulletG; m.material = this.mGlowRed; m.scale.setScalar(1); m.position.set(b.x, .55, b.z); }
    for (; bi < this.bMeshes.length; bi++) this.bMeshes[bi].visible = false;
    // items
    // no PointLight here: adding/removing lights changes the light count and forces a full-scene shader recompile (one-frame stall)
    while (this.itemMs.length < this.fitems.length) { const g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(.55, .55, .55), this.mGlowAmber); b.position.y = .5; g.add(b); const halo = new T.Mesh(new T.CircleGeometry(.7, 20), new T.MeshBasicMaterial({ color: PAL.amberHex, transparent: true, opacity: .22, blending: T.AdditiveBlending, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .06; g.add(halo); this.scene.add(g); this.itemMs.push(g); }
    this.itemMs.forEach((g, i) => { const f = this.fitems[i]; if (f) { g.visible = true; g.position.set(f.x, Math.sin(now * 2.2) * .15 + .1, f.z); g.children[0].rotation.y += dt * 2; } else g.visible = false; });
    // fx
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.userData.t += dt * 3;
      const s = 1 + f.userData.t * f.userData.big; f.scale.set(s, s, s);
      f.material.opacity = Math.max(0, .85 - f.userData.t);
      if (f.material.opacity <= 0) {
        f.visible = false; this.scene.remove(f);
        this.fxs[i] = this.fxs[this.fxs.length - 1]; this.fxs.pop();
        if (this._fxPool.length < 64) this._fxPool.push(f); else f.material.dispose(); // geometry is shared — material only
      }
    }
    if (!this._sparkPool) this._sparkPool = [];
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i], u = s.userData; u.life -= dt;
      if (u.life <= 0) {
        s.visible = false; this.scene.remove(s);
        this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop();
        if (this._sparkPool.length < 160) this._sparkPool.push(s);
        continue;
      }
      u.vy -= 18 * dt; s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (s.position.y < .05) { s.position.y = .05; u.vy *= -.4; }
      s.material.opacity = Math.min(1, u.life * 3);
    }
    // camera
    this.camF.x += (this.me.x * .7 - this.camF.x) * Math.min(1, dt * 5); this.camF.z += (this.me.z * .7 - this.camF.z) * Math.min(1, dt * 5);
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.2);
    const sx = (Math.random() - .5) * this.shake * .5, sz = (Math.random() - .5) * this.shake * .5;
    this.cam.position.set(this.camF.x + 15 + sx, 19, this.camF.z + 15 + sz);
    this.cam.lookAt(this.camF.x + sx, 0, this.camF.z + sz);
    this.dmgFlash = Math.max(0, (this.dmgFlash || 0) - dt * 2.5);
    this.vig.style.opacity = this.dmgFlash;
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.cam);
    this._hudTick(dt);
  };
}
