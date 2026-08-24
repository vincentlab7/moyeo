/* ═══════════════════════════════════════════════════════════════
   app.js — SPA 탭 라우터
   ─ 로드 순서: auth.js → db.js → ai.js → app.js → main.js
   ─ app.js가 main.js보다 먼저 로드되어야 data-go 핸들러 우선권 확보
   ═══════════════════════════════════════════════════════════════ */
(function () {

  /* ── 상태 ── */
  var _activeTab  = 'home';
  var _group      = null;
  var _initialized = {};

  /* 탭 초기화 레지스트리 (각 탭의 인라인 스크립트에서 등록) */
  window._tabInit = {};
  /* 탭 진입 리셋 레지스트리 (탭 전환 시마다 — 새 탭 기준) */
  window._tabReset = {};
  /* 탭 이탈 레지스트리 (탭 전환 시마다 — 이전 탭 기준) */
  window._tabLeave = {};

  /* ── auth.js 콜백 ── */
  window.onGroupLoaded = function (group) {
    _group = group;
    _initTab('home');
    var el = document.getElementById('page-loading');
    if (el) el.remove();
    /* 알림 토글이 켜져 있을 때 FCM 토큰 자동 등록 */
    if (localStorage.getItem('notif_enabled') !== '0' && typeof window._registerPush === 'function') {
      window._registerPush();
    }
    /* 하단 탭 프로필 아바타 — 내정보 탭 방문 전에도 즉시 표시 */
    if (window._myProfile && typeof window._applyTabAvatar === 'function') {
      window._applyTabAvatar(window._myProfile.photoURL || '');
    }
  };

  window.onGroupRequired = function () {
    location.href = '01_auth.html';
  };

  /* ── 탭 초기화 (최초 방문 시 1회) ── */
  function _initTab(tabName) {
    if (_initialized[tabName]) return;
    _initialized[tabName] = true;
    var fn = window._tabInit[tabName];
    if (typeof fn === 'function') fn(_group);
  }

  /* ── 탭 전환 ── */
  function _switchTab(tabName) {
    if (tabName === _activeTab) return;

    /* 이탈 훅: 현재 탭에서 나가기 전에 호출 */
    var leaveFn = window._tabLeave[_activeTab];
    if (typeof leaveFn === 'function') leaveFn();

    _activeTab = tabName;

    document.querySelectorAll('[data-tab-screen]').forEach(function (el) {
      el.classList.toggle('is-tab-active', el.dataset.tabScreen === tabName);
    });
    document.querySelectorAll('[data-app-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.appTab === tabName);
    });

    /* 탭 전환 시 서브 화면을 첫 번째(기본) 화면으로 항상 리셋 */
    var newTabEl = document.querySelector('[data-tab-screen="' + tabName + '"]');
    if (newTabEl) {
      var wraps = newTabEl.querySelectorAll('[data-screen-wrap]');
      wraps.forEach(function (w, i) {
        w.classList.toggle('is-active', i === 0);
      });
    }

    if (_group) _initTab(tabName);

    /* 탭 재진입 리셋 (매번 호출) */
    var resetFn = window._tabReset[tabName];
    if (typeof resetFn === 'function') resetFn();
  }

  document.addEventListener('DOMContentLoaded', function () {

    /* ── 초기 탭 화면 상태 설정 ── */
    document.querySelectorAll('[data-tab-screen]').forEach(function (el) {
      el.classList.toggle('is-tab-active', el.dataset.tabScreen === 'home');
    });
    document.querySelectorAll('[data-app-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.appTab === 'home');
    });

    /* ── data-go 핸들러 (main.js보다 먼저 등록 → stopImmediatePropagation으로 차단)
          탭 화면 내부로만 범위를 한정해 다른 탭의 screen-wrap에 영향 없음 ── */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-go]');
      if (!btn) return;
      e.stopImmediatePropagation();

      var screenName = btn.dataset.go;
      var tabScreen  = btn.closest('[data-tab-screen]') || document;
      tabScreen.querySelectorAll('[data-screen-wrap]').forEach(function (w) {
        w.classList.toggle('is-active', w.dataset.screenWrap === screenName);
      });
    });

    /* ── data-app-tab 클릭 → 탭 전환 ── */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-app-tab]');
      if (!btn) return;
      _switchTab(btn.dataset.appTab);
    });

  });

})();
