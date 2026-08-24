/* ═══════════════════════════════════════════════════════════
   firebase-messaging-sw.js — FCM 백그라운드 메시지 Service Worker
   ─ 위치: 반드시 루트(/)에 있어야 합니다
   ═══════════════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

/* 대기 없이 즉시 활성화 — 페이지 새로고침 없이도 새 SW 적용 */
self.addEventListener('install',  function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

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
