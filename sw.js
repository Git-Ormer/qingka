/* 轻卡 · 离线缓存
 * 静态资源缓存优先；条码查询（Open Food Facts）不缓存，始终走网络。
 */
var CACHE = 'qingka-v4';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/nutrition.js',
  './js/foods.js',
  './js/foods-extra.js',
  './js/packs/nz.js',
  './js/state.js',
  './js/ui.js',
  './js/scanner.js',
  './js/off.js',
  './js/ai.js',
  './js/pwa.js',
  './js/app.js',
  './vendor/zxing.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
        // 先返回缓存，同时后台更新，下次打开即为新版本
        return hit || network;
      });
    })
  );
});
