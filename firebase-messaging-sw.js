/* ═══════════════════════════════════════════════════════════
   firebase-messaging-sw.js — FCM 백그라운드 메시지 Service Worker
   ─ 위치: 반드시 루트(/)에 있어야 합니다
   ═══════════════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

/* ── 오프라인 지원: 앱 셸 캐싱 ── */
const CACHE_NAME = 'moyeo-shell-v1';
const PRECACHE_URLS = [
  '/app.html',
  '/manifest.json',
  '/resource/css/font.css',
  '/resource/css/reset.css',
  '/resource/css/pc.css',
  '/resource/css/mobile.css',
  '/resource/js/main.js',
  '/resource/js/app.js',
  '/resource/js/auth.js',
  '/resource/js/db.js',
  '/resource/js/ai.js',
  '/resource/js/push.js',
  '/resource/js/firebase-config.js',
  '/resource/images/icons/icon-pwa-192.png',
  '/resource/images/icons/icon-pwa-512.png',
];

/* 대기 없이 즉시 활성화 — 페이지 새로고침 없이도 새 SW 적용 */
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function(keys) {
        return Promise.all(
          keys.filter(function(key) { return key !== CACHE_NAME; })
              .map(function(key) { return caches.delete(key); })
        );
      }),
    ])
  );
});

/* 같은 출처(same-origin) GET 요청만 캐시 우선 + 백그라운드 갱신, /api/*, 외부 도메인은 그대로 네트워크로 전달 */
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  event.respondWith(
    caches.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(res) {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

/* SW는 firebase-config.js를 공유할 수 없으므로 직접 설정 */
firebase.initializeApp({
  apiKey:            'AIzaSyDp_yJb8A_ITw77e2F3M3TSoZRD_fqq8aI',
  authDomain:        'moyeo-b0908.firebaseapp.com',
  projectId:         'moyeo-b0908',
  storageBucket:     'moyeo-b0908.firebasestorage.app',
  messagingSenderId: '884150482094',
  appId:             '1:884150482094:web:572e53a7d86f27f6dee93f',
});

const messaging = firebase.messaging();

/* 앱이 백그라운드/종료 상태일 때 수신 */
messaging.onBackgroundMessage(function(payload) {
  var n = payload.notification || {};
  self.registration.showNotification(n.title || '모여', {
    body:  n.body  || '',
    icon:  '/resource/images/icons/icon-pwa-192.png',
    badge: '/resource/images/icons/icon-pwa-192.png',
    tag:   'moyeo-push',
    data:  payload.data || {},
    vibrate: [200, 100, 200],
  });
});

/* 알림 클릭 → 앱 포커스 또는 열기 */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/app.html') !== -1 && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      return clients.openWindow('/app.html');
    })
  );
});
