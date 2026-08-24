/* ═══════════════════════════════════════════════════════════
   firebase-config.js

   ▶ 설정 방법
   1. https://console.firebase.google.com 에서 프로젝트 생성
   2. 프로젝트 설정 → 일반 → 내 앱 → 웹 앱 추가 → 설정 값 복사
   3. Authentication → 로그인 방법 → Google 활성화
   4. Firestore Database → 데이터베이스 만들기
   5. Firestore → 규칙 탭 → firestore.rules 내용 붙여넣기
   ═══════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDp_yJb8A_ITw77e2F3M3TSoZRD_fqq8aI',
  authDomain:        'moyeo-b0908.firebaseapp.com',
  projectId:         'moyeo-b0908',
  storageBucket:     'moyeo-b0908.firebasestorage.app',
  messagingSenderId: '884150482094',
  appId:             '1:884150482094:web:572e53a7d86f27f6dee93f',
  measurementId:     'G-7BL2TVM9RS',
};

/* Firebase 설정 여부 감지 — 미설정 시 정적 목업 모드로 동작 */
/* Firebase Cloud Messaging 웹 푸시 VAPID 키
   발급: Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → 웹 앱 설정 → 웹 푸시 인증서 생성 */
const VAPID_KEY = 'BPAOcQRtP6EKa2uQnjLEmMW9mBTtjEv6DyKidJQ3_AQW7P_PZA8UnApO9Pul84Ps15sjY5FEd-bk7iDyVRT9Y88';

/* Firebase 설정 여부 감지 — 미설정 시 정적 목업 모드로 동작 */
const IS_FIREBASE_READY = FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';

if (IS_FIREBASE_READY) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const db             = IS_FIREBASE_READY ? firebase.firestore() : null;
const auth           = IS_FIREBASE_READY ? firebase.auth()      : null;
const googleProvider = IS_FIREBASE_READY
  ? (() => {
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      return p;
    })()
  : null;
