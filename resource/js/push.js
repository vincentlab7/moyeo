/* ═══════════════════════════════════════════════════════════
   push.js — FCM 웹 푸시 토큰 등록/해제 + 포그라운드 핸들러
   ─ 로드 순서: firebase-messaging-compat.js → firebase-config.js → push.js
   ═══════════════════════════════════════════════════════════ */

(function () {
  if (!IS_FIREBASE_READY) {
    window._registerPush   = function() {};
    window._unregisterPush = function() {};
    return;
  }

  var _messaging = null;
  var _fcmToken  = null;

  /* messaging 인스턴스 1회 생성 + 포그라운드 리스너 등록 */
  function _initMessaging() {
    if (_messaging) return _messaging;
    try {
      _messaging = firebase.messaging();
    } catch (e) {
      return null;
    }
    /* 앱이 열려 있을 때(포그라운드) 수신 — SW를 통해 시스템 알림 표시 */
    _messaging.onMessage(function (payload) {
      var n = payload.notification || {};
      if (Notification.permission !== 'granted') return;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function (reg) {
          reg.showNotification(n.title || '모여', {
            body:    n.body  || '',
            icon:    '/resource/images/icons/icon-pwa-192.png',
            badge:   '/resource/images/icons/icon-pwa-192.png',
            tag:     'moyeo-push',
            vibrate: [200, 100, 200],
          });
        });
      }
    });
    return _messaging;
  }

  function _saveToken(token) {
    var u = auth.currentUser;
    if (!u || !token) return;
    db.collection('users').doc(u.uid).set(
      { fcmTokens: firebase.firestore.FieldValue.arrayUnion(token) },
      { merge: true }
    );
  }

  function _removeToken(token) {
    var u = auth.currentUser;
    if (!u || !token) return;
    db.collection('users').doc(u.uid).update({
      fcmTokens: firebase.firestore.FieldValue.arrayRemove(token),
    }).catch(function () {});
  }

  /* 알림 권한 요청 → FCM 토큰 발급 → Firestore 저장 */
  window._registerPush = async function () {
    if (!('Notification' in window)) return;
    if (typeof VAPID_KEY === 'undefined' || VAPID_KEY === 'YOUR_VAPID_KEY_HERE') return;
    var m = _initMessaging();
    if (!m) return;
    try {
      var permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      var token = await m.getToken({ vapidKey: VAPID_KEY });
      if (!token) return;
      _fcmToken = token;
      _saveToken(token);
      localStorage.setItem('notif_enabled', '1');
    } catch (e) {
      console.warn('[push] 토큰 등록 실패:', e.message);
    }
  };

  /* 토큰 삭제 → Firestore에서 제거 */
  window._unregisterPush = async function () {
    var m = _messaging;
    if (!m) return;
    try {
      if (_fcmToken) _removeToken(_fcmToken);
      await m.deleteToken();
      _fcmToken = null;
      localStorage.setItem('notif_enabled', '0');
    } catch (e) {
      console.warn('[push] 토큰 해제 실패:', e.message);
    }
  };

}());
