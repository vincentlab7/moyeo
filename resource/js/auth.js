/* ═══════════════════════════════════════════════════════════
   auth.js — 인증 모듈 (Google OAuth + 세션 관리)
   ═══════════════════════════════════════════════════════════ */

if (!IS_FIREBASE_READY) {
  console.warn('[모여] Firebase 미설정 → 정적 목업 모드');
} else {
  /* ── 페이지 이름 ── */
  const PAGE = location.pathname.split('/').pop() || '01_auth.html';
  const PUBLIC_PAGES = ['01_auth.html', ''];

  /* ── 인증 상태 감지 ── */
  auth.onAuthStateChanged(async user => {
    if (user) {
      /* 로그인 상태: 공개/보호 모두 initSession 거치도록 통일
         — 그룹 유무는 initSession 내부에서 판단 후 onGroupLoaded/onGroupRequired 호출 */
      await initSession(user);
    } else {
      /* 미로그인: 보호 페이지면 로그인으로 */
      if (!PUBLIC_PAGES.includes(PAGE)) {
        location.href = '01_auth.html';
      }
    }
  });

  /* ── 세션 초기화 ── */
  async function initSession(user) {
    const COLORS = ['#4f7cff', '#f97316', '#a855f7', '#10b981', '#e11d48', '#0ea5e9'];
    const userRef = db.collection('users').doc(user.uid);
    let snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        displayName: user.displayName || '사용자',
        email:       user.email,
        photoURL:    user.photoURL || '',
        color:       COLORS[Math.floor(Math.random() * COLORS.length)],
        status:      '',
        groups:      [],
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      });
      snap = await userRef.get();
    }

    window._myProfile = { uid: user.uid, ...snap.data() };

    const groups = snap.data().groups || [];
    if (groups.length > 0) {
      const activeId = snap.data().activeGroupId || groups[0];
      await loadGroup(activeId);
    } else {
      /* 그룹 없는 신규 사용자 → 그룹 생성 화면으로 */
      hidePageLoading();
      if (typeof onGroupRequired === 'function') onGroupRequired();
    }
  }

  /* ── 페이지 로딩 오버레이 제거 ── */
  function hidePageLoading() {
    const el = document.getElementById('page-loading');
    if (el) el.remove();
  }

  /* ── 그룹 로드 ── */
  async function loadGroup(groupId) {
    const snap = await db.collection('groups').doc(groupId).get();
    if (!snap.exists) {
      /* 그룹 문서가 없으면 그룹 생성 화면으로 */
      hidePageLoading();
      if (typeof onGroupRequired === 'function') onGroupRequired();
      return;
    }
    window._currentGroup = { id: snap.id, ...snap.data() };
    if (typeof onGroupLoaded === 'function') onGroupLoaded(window._currentGroup);
    hidePageLoading();
  }

  /* ── Google 로그인 ── */
  window.signInWithGoogle = () =>
    auth.signInWithPopup(googleProvider).catch(err => {
      console.error('[모여] 로그인 실패:', err.message);
      const errEl = document.querySelector('.form-error[data-google-error]');
      if (errEl) { errEl.textContent = '로그인에 실패했습니다. 다시 시도해 주세요.'; errEl.classList.add('is-visible'); }
    });

  /* ── 로그아웃 ── */
  window.signOut = () => auth.signOut().then(() => { location.href = '01_auth.html'; });

  /* ── 그룹 생성 ── */
  window.createGroup = async (name, emoji) => {
    const user = auth.currentUser;
    if (!user) return;
    const code     = Math.random().toString(36).slice(2, 10).toUpperCase();
    const groupRef = db.collection('groups').doc();

    await groupRef.set({
      name:       name  || '우리 그룹',
      emoji:      emoji || '👨‍👩‍👧‍👦',
      ownerId:    user.uid,
      inviteCode: code,
      memberIds:  [user.uid],
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    });
    await groupRef.collection('members').doc(user.uid).set({
      displayName: window._myProfile?.displayName || user.displayName || '나',
      photoURL:    window._myProfile?.photoURL    || user.photoURL    || '',
      color:       window._myProfile?.color       || '#4f7cff',
      status:      '',
      role:        'owner',
      joinedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('users').doc(user.uid).update({
      groups:        firebase.firestore.FieldValue.arrayUnion(groupRef.id),
      activeGroupId: groupRef.id,
    });
    location.href = 'app.html';
  };

  /* ── 초대 코드로 참여 ── */
  window.joinGroup = async code => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await db.collection('groups').where('inviteCode', '==', code.trim().toUpperCase()).get();
    if (snap.empty) throw new Error('유효하지 않은 초대 코드입니다.');
    const groupDoc = snap.docs[0];
    await groupDoc.ref.collection('members').doc(user.uid).set({
      displayName: window._myProfile?.displayName || '나',
      photoURL:    window._myProfile?.photoURL    || user.photoURL || '',
      color:       window._myProfile?.color       || '#4f7cff',
      status:      '',
      role:        'member',
      joinedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    await groupDoc.ref.update({ memberIds: firebase.firestore.FieldValue.arrayUnion(user.uid) });
    await db.collection('users').doc(user.uid).update({
      groups:        firebase.firestore.FieldValue.arrayUnion(groupDoc.id),
      activeGroupId: groupDoc.id,
    });
    location.href = 'app.html';
  };

  /* ── 그룹 전환 ── */
  window.switchGroup = groupId => {
    db.collection('users').doc(auth.currentUser.uid).update({ activeGroupId: groupId })
      .then(() => location.reload());
  };
}
