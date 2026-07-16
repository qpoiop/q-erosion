/* EROSION PROTOCOL service worker
   - app shell (/, index.html, game.js): network-first so deploys reach users immediately; cache fallback for offline
   - CDN assets (unpkg three/mqtt, google fonts): cache-first — URLs are version-pinned, safe to keep forever */
const BUILD = '__BUILD__'; // stamped by CI per deploy so the browser sees a new SW → update toast
const CACHE = 'erosion-v1';
const APP_SHELL = ['/', '/index.html', '/src/main.js', '/src/util.js', '/src/scene.js', '/src/models.js', '/src/hud.js', '/src/sheets.js', '/src/input.js', '/src/net.js', '/src/world.js', '/src/combat.js', '/src/waves.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png'];
const CDN = [
  'https://unpkg.com/three@0.147.0/build/three.min.js',
  'https://unpkg.com/three@0.147.0/examples/js/shaders/CopyShader.js',
  'https://unpkg.com/three@0.147.0/examples/js/shaders/LuminosityHighPassShader.js',
  'https://unpkg.com/three@0.147.0/examples/js/postprocessing/EffectComposer.js',
  'https://unpkg.com/three@0.147.0/examples/js/postprocessing/RenderPass.js',
  'https://unpkg.com/three@0.147.0/examples/js/postprocessing/ShaderPass.js',
  'https://unpkg.com/three@0.147.0/examples/js/postprocessing/UnrealBloomPass.js',
  'https://unpkg.com/mqtt@5.3.5/dist/mqtt.min.js',
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(APP_SHELL);
    // cross-origin: no-cors fetch + put — cache.add rejects opaque (status 0) responses
    await Promise.all(CDN.map(async u => {
      try { const res = await fetch(new Request(u, { mode: 'no-cors' })); if (res.ok || res.type === 'opaque') await c.put(u, res); } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith('/assets/')) {
    // large binary assets (3D models): cache-first, version by filename
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }
  if (sameOrigin) {
    // network-first: fresh deploys win, cache is the offline fallback
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') { const shell = await caches.match('/index.html'); if (shell) return shell; }
        throw new Error('offline and not cached');
      }
    })());
  } else {
    // cache-first for version-pinned CDN + font files
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
