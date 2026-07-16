// models.js — verbatim methods from game.js (prototype-install)
import { N, TS, HALF, ti, inG, w2g, g2w, rnd, clamp, dist2, PAL, FONT, ETYPES, RAR, ROMAN, UPG, SHOP, SYN, ITEMS, ITEM_KEYS, INV_MAX, DIFF, DIFF_CNT, DIFF_SPT, DIFF_SCR, RELAY, GATE_DIR, MODELS, SHIP_MODEL_YAW, XP_NEED, WALL_COST, TURRET_COST, WALL_HP, TURRET_HP, BUILD_T } from './util.js';

export function install(P) {
  P._mergeStatic = function (root) { // bake world-transformed geometry into one mesh per material
    const T = THREE, byMat = new Map();
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      let g = o.geometry.clone();
      ['skinIndex', 'skinWeight'].forEach(a => g.deleteAttribute(a));
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.uv && g.attributes.position) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      const k = o.material.uuid;
      if (!byMat.has(k)) byMat.set(k, { mat: o.material, geos: [] });
      byMat.get(k).geos.push(g);
    });
    const out = new T.Group();
    for (const { mat, geos } of byMat.values()) {
      const merged = T.BufferGeometryUtils.mergeBufferGeometries(geos, false);
      if (merged) { const m = new T.Mesh(merged, mat); m.castShadow = true; out.add(m); }
    }
    return out;
  };
  P._normalize = function (obj, size, yaw) {
    const T = THREE;
    const box = new T.Box3().setFromObject(obj);
    const sz = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
    const s = size / Math.max(sz.x, sz.z, .001);
    obj.position.set(-ctr.x, -box.min.y, -ctr.z);
    const tpl = new T.Group(); tpl.add(obj);
    tpl.scale.setScalar(s); tpl.rotation.y = yaw;
    return tpl;
  };
  P._loadModels = function () {
    if (!THREE.GLTFLoader) return;
    const T = THREE; this.mdl = {};
    const loader = new T.GLTFLoader();
    for (const [key, cfg] of Object.entries(MODELS)) {
      loader.load(cfg.url, gl => {
        if (this._dead) return;
        let root = cfg.merge ? this._mergeStatic(gl.scene) : gl.scene;
        this.mdl[key] = this._normalize(root, cfg.size, key === 'ship' ? SHIP_MODEL_YAW : cfg.yaw);
        if (key === 'ship') this._applyShip();
        if (key.startsWith('tower') || key.startsWith('wall')) this._syncStruct();
        if (key === 'core' && this.coreMesh) { // swap the placeholder crystal for the core model
          const cg = this.coreMesh;
          cg.cry.visible = false;
          const m = this.mdl.core.clone(true);
          m.traverse(o => { if (o.isMesh) o.castShadow = false; }); // crystal is translucent — a baked shadow blob reads as a glitch
          m.position.y = .62; // sit on the pedestal
          cg.add(m); cg.model = m; cg.s0 = m.scale.x; // _normalize bakes its fit into root scale — renderer must scale relative to this
          cg.mats = []; m.traverse(o => { if (o.isMesh) cg.mats.push([o, o.material]); }); // for hit-flash swaps
        }
      }, undefined, e => console.warn('[erosion] model load failed (' + key + ') — primitive kept', e));
    }
  };
  P._applyShip = function () {
    const T = THREE, tpl = this.mdl.ship;
    if (!tpl || !this.meG) return;
    [[this.meG, 0x0e3038], [this.allyG, 0x38280c]].forEach(([g, tint], idx) => {
      const m = tpl.clone(true);
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.emissive = new T.Color(tint); if ('metalness' in o.material) { o.material.metalness = .5; o.material.roughness = .55; } } });
      g.shipParts.forEach(pp => pp.visible = false);
      g.add(m); g.model = m;
    });
  };
}
