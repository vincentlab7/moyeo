document.addEventListener('DOMContentLoaded', function() {

  /* ══════════════════════════════════════════
     공통: 화면 전환
     data-screen-wrap 속성을 가진 래퍼들 중
     해당 이름을 가진 것만 is-active
  ══════════════════════════════════════════ */
  function goTo(screenName) {
    var scope = document.querySelector('[data-tab-screen].is-tab-active') || document;
    var wraps = scope.querySelectorAll('[data-screen-wrap]');
    wraps.forEach(function(w) {
      if (w.dataset.screenWrap === screenName) {
        w.classList.add('is-active');
      } else {
        w.classList.remove('is-active');
      }
    });
  }

  /* ══════════════════════════════════════════
     공통: data-go 클릭 → 화면 전환
     (이벤트 위임 방식: 동적 요소에도 동작)
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-go]');
    if (btn) {
      e.stopPropagation();
      goTo(btn.dataset.go);
    }
  });

  /* ══════════════════════════════════════════
     공통: data-href 클릭 → 페이지 이동
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-href]');
    if (btn) {
      e.preventDefault();
      window.location.href = btn.dataset.href;
    }
  });

  /* ══════════════════════════════════════════
     01 로그인/회원가입 — 화면 탭 전환
  ══════════════════════════════════════════ */
  var screenTabs = document.querySelectorAll('[data-tab]');
  if (screenTabs.length) {
    var screens = document.querySelectorAll('[data-screen]');
    screenTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.dataset.tab;
        screenTabs.forEach(function(t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        screens.forEach(function(s) { s.classList.remove('is-active'); });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        document.querySelector('[data-screen="' + target + '"]').classList.add('is-active');
      });
    });
  }

  /* 01 — 단계 이동 버튼 (회원가입 → 프로필 → 그룹) */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-next-tab]');
    if (!btn) return;
    var target = btn.dataset.nextTab;
    var tab = document.querySelector('[data-tab="' + target + '"]');
    if (tab) tab.click();
  });

  /* ══════════════════════════════════════════
     02 홈 — 그룹 전환 바텀시트
  ══════════════════════════════════════════ */
  var openBtn = document.querySelector('[data-open-sheet]');
  var groupSheet = document.querySelector('[data-sheet]');
  if (openBtn && groupSheet) {
    openBtn.addEventListener('click', function() {
      groupSheet.classList.add('is-open');
    });
    groupSheet.addEventListener('click', function(e) {
      if (e.target === groupSheet) groupSheet.classList.remove('is-open');
    });
  }

  /* ══════════════════════════════════════════
     03 일정 — 필터 탭
     data-filter="all|mine|group" → 카드 show/hide
     카드가 모두 숨겨진 날짜 그룹은 통째로 숨김
  ══════════════════════════════════════════ */
  var filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      filterTabs.forEach(function(t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');

      var filter = tab.dataset.filter || 'all';
      var cards = document.querySelectorAll('.schedule-card[data-schedule-type]');

      cards.forEach(function(card) {
        var type = card.dataset.scheduleType;
        var visible = filter === 'all' || type === filter;
        card.style.display = visible ? 'flex' : 'none';
      });

      /* 카드가 모두 숨겨진 날짜 그룹 헤더도 숨김 (월 필터로 숨겨진 그룹 제외) */
      var dateGroups = document.querySelectorAll('.date-group');
      dateGroups.forEach(function(group) {
        if (group.dataset.monthHidden) return;
        var visibleCards = Array.prototype.filter.call(
          group.querySelectorAll('.schedule-card'),
          function(c) { return c.style.display !== 'none'; }
        );
        group.style.display = visibleCards.length === 0 ? 'none' : '';
      });
    });
  });

  /* ══════════════════════════════════════════
     04 할일 — status-group 초기화 & 카드 이동
     레이블 텍스트로 data-status-group 자동 부여
  ══════════════════════════════════════════ */
  (function() {
    var labelMap = { '진행전': 'todo', '진행중': 'doing', '완료': 'done' };
    document.querySelectorAll('.status-group').forEach(function(sec) {
      var labelEl = sec.querySelector('.status-group__label');
      if (!labelEl) return;
      var text = labelEl.textContent.trim();
      Object.keys(labelMap).forEach(function(k) {
        if (text.indexOf(k) !== -1) sec.dataset.statusGroup = labelMap[k];
      });
    });
  })();

  function updateSectionCounts(content) {
    content.querySelectorAll('.status-group').forEach(function(sec) {
      var countEl = sec.querySelector('.status-group__count');
      if (countEl) countEl.textContent = sec.querySelectorAll('.todo-card').length;
    });
    var doneSection = content.querySelector('[data-status-group="done"]');
    var doneCount   = doneSection ? doneSection.querySelectorAll('.todo-card').length : 0;
    var totalCount  = content.querySelectorAll('.todo-card').length;
    var summaryEl   = content.querySelector('.progress-summary__count');
    if (summaryEl) summaryEl.innerHTML = '<span>' + doneCount + '</span> / ' + totalCount + ' 완료';
    var barEl = content.querySelector('.progress-bar__fill');
    if (barEl) barEl.style.width = (totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0) + '%';
  }

  function moveCardToSection(card, newStatus, targetContent) {
    var oldContent = card.closest('[data-todo-content]');
    var content    = targetContent || oldContent;
    if (!content) return;
    var currentSection = card.closest('.status-group');
    var targetSection  = content.querySelector('[data-status-group="' + newStatus + '"]');
    if (!targetSection) return;
    /* 같은 섹션이고 콘텐츠도 같으면 이동 불필요 */
    if (currentSection === targetSection && oldContent === content) return;

    var finalOpacity = newStatus === 'done' ? '0.6' : '';
    card.style.transition = 'opacity 0.12s ease';
    card.style.opacity    = '0';

    setTimeout(function() {
      /* 콘텐츠 영역이 바뀌었으면 이전 영역 카운트 먼저 갱신 */
      if (oldContent && oldContent !== content) updateSectionCounts(oldContent);
      targetSection.appendChild(card);
      card.style.opacity = finalOpacity;
      setTimeout(function() { card.style.transition = ''; }, 120);
      updateSectionCounts(content);
    }, 120);
  }

  /* ══════════════════════════════════════════
     04 할일 — 세그먼트 탭 (그룹/개인)
  ══════════════════════════════════════════ */
  var segmentTabs = document.querySelectorAll('.segment__tab');
  if (segmentTabs.length) {
    segmentTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        segmentTabs.forEach(function(t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        /* 탭에 연결된 콘텐츠 영역 전환 */
        var target = tab.dataset.todo;
        var contents = document.querySelectorAll('[data-todo-content]');
        contents.forEach(function(c) {
          c.style.display = c.dataset.todoContent === target ? 'block' : 'none';
        });
      });
    });
  }

  /* ══════════════════════════════════════════
     04 할일 — FAB → 바텀시트 열기/닫기
  ══════════════════════════════════════════ */
  var addSheetOverlay = document.querySelector('[data-add-sheet]');
  var fabBtn = document.querySelector('.fab');
  if (fabBtn && addSheetOverlay) {
    var sheetTitleEl    = addSheetOverlay.querySelector('.add-sheet__title');
    var sheetInput      = addSheetOverlay.querySelector('.add-input');
    var sheetMemo       = addSheetOverlay.querySelector('.add-memo');
    var sheetDueDate    = addSheetOverlay.querySelector('[data-todo-due-date]');
    var sheetTypeChips  = addSheetOverlay.querySelectorAll('.type-chip');
    var sheetStateChips = addSheetOverlay.querySelectorAll('.state-chip');
    var sheetAvatars    = addSheetOverlay.querySelectorAll('.assignee-avatar');

    /* 개인 모드일 때 나(첫 번째 아바타) 외 담당자 비활성화 */
    function updateAssigneeAvailability(isPersonal) {
      sheetAvatars.forEach(function(a, i) {
        if (isPersonal && i !== 0) {
          a.classList.add('is-disabled');
          a.classList.remove('is-selected');
          a.disabled = true;
        } else {
          a.classList.remove('is-disabled');
          a.disabled = false;
        }
      });
      /* 개인 모드면 첫 번째(나)를 자동 선택 */
      if (isPersonal && sheetAvatars.length > 0) sheetAvatars[0].classList.add('is-selected');
    }

    /* 카드 현재 상태를 읽어 바텀시트 칩/필드 동기화 */
    function syncSheetFromCard(card) {
      var titleEl = card.querySelector('.todo-card__title');
      if (sheetInput)   sheetInput.value   = titleEl ? titleEl.textContent.trim() : '';
      if (sheetMemo)    sheetMemo.value    = card.dataset.memo || '';
      if (sheetDueDate) sheetDueDate.value = card.dataset.dueDate || '';

      /* 종류 */
      var isGroup = !!card.querySelector('.todo-badge--group');
      sheetTypeChips.forEach(function(c) {
        c.classList.toggle('is-selected', isGroup ? c.textContent.trim() === '그룹' : c.textContent.trim() === '개인');
      });

      /* 상태 */
      var checkEl = card.querySelector('.todo-card__check');
      var isDone  = checkEl && checkEl.classList.contains('is-done');
      var isDoing = checkEl && checkEl.classList.contains('is-doing');
      sheetStateChips.forEach(function(c) {
        c.classList.toggle('is-selected',
          (isDone && c.classList.contains('done')) ||
          (isDoing && c.classList.contains('doing')) ||
          (!isDone && !isDoing && c.classList.contains('todo'))
        );
      });

      /* 담당자 */
      var assigneeNameEl = card.querySelector('.todo-card__assignee-name');
      var name = assigneeNameEl ? assigneeNameEl.textContent.trim() : '';
      sheetAvatars.forEach(function(a) { a.classList.toggle('is-selected', a.title === name); });
    }

    /* 바텀시트 값을 카드 DOM에 반영 */
    function applySheetToCard(card) {
      /* 제목 */
      if (sheetInput && sheetInput.value.trim()) {
        var titleEl = card.querySelector('.todo-card__title');
        if (titleEl) titleEl.textContent = sheetInput.value.trim();
      }

      /* 메모: data 속성 저장 + 카드 본문에 표시 */
      if (sheetMemo) {
        var memoText = sheetMemo.value.trim();
        card.dataset.memo = memoText;
        var memoEl = card.querySelector('.todo-card__memo');
        if (memoText) {
          if (!memoEl) {
            memoEl = document.createElement('div');
            memoEl.className = 'todo-card__memo';
            var topEl = card.querySelector('.todo-card__top');
            if (topEl && topEl.parentNode) topEl.parentNode.insertBefore(memoEl, topEl.nextSibling);
          }
          memoEl.textContent = memoText;
        } else if (memoEl) {
          memoEl.remove();
        }
      }

      /* 종류 배지 */
      var selType   = addSheetOverlay.querySelector('.type-chip.is-selected');
      var typeBadge = card.querySelector('.todo-badge--group, .todo-badge--personal');
      if (selType && typeBadge) {
        var grp = selType.textContent.trim() === '그룹';
        typeBadge.className   = 'todo-badge ' + (grp ? 'todo-badge--group' : 'todo-badge--personal');
        typeBadge.textContent = grp ? '그룹' : '개인';
      }

      /* 상태: 체크 · 상태배지 · 제목취소선 · opacity 모두 갱신 */
      var selState = addSheetOverlay.querySelector('.state-chip.is-selected');
      if (selState) {
        var meta     = card.querySelector('.todo-card__meta');
        var checkEl  = card.querySelector('.todo-card__check');
        var titleEl2 = card.querySelector('.todo-card__title');
        var oldBadge = meta ? meta.querySelector('.todo-badge--doing, .todo-badge--done') : null;
        if (oldBadge) oldBadge.remove();

        if (selState.classList.contains('todo')) {
          if (checkEl) { checkEl.className = 'todo-card__check'; checkEl.innerHTML = '<svg viewBox="0 0 12 12"><polyline points="1,6 4.5,10 11,2"/></svg>'; }
          if (titleEl2) titleEl2.classList.remove('is-done');
          card.style.opacity = '';
        } else if (selState.classList.contains('doing')) {
          if (checkEl) { checkEl.className = 'todo-card__check is-doing'; checkEl.innerHTML = ''; }
          if (titleEl2) titleEl2.classList.remove('is-done');
          card.style.opacity = '';
          if (meta) {
            var doingBadge = document.createElement('div');
            doingBadge.className = 'todo-badge todo-badge--doing';
            doingBadge.textContent = '진행중';
            var tb = meta.querySelector('.todo-badge--group, .todo-badge--personal');
            meta.insertBefore(doingBadge, tb ? tb.nextSibling : null);
          }
        } else if (selState.classList.contains('done')) {
          if (checkEl) { checkEl.className = 'todo-card__check is-done'; checkEl.innerHTML = '<svg viewBox="0 0 12 12"><polyline points="1,6 4.5,10 11,2"/></svg>'; }
          if (titleEl2) titleEl2.classList.add('is-done');
          card.style.opacity = '0.6';
          if (meta) {
            var doneBadge = document.createElement('div');
            doneBadge.className = 'todo-badge todo-badge--done';
            doneBadge.textContent = '완료';
            var tb2 = meta.querySelector('.todo-badge--group, .todo-badge--personal');
            meta.insertBefore(doneBadge, tb2 ? tb2.nextSibling : null);
          }
        }

        /* 완료 시 더보기 제거, 완료 해제 시 더보기 복원 */
        var topForMore = card.querySelector('.todo-card__top');
        if (selState.classList.contains('done')) {
          var moreToRemove = topForMore ? topForMore.querySelector('.todo-card__more') : null;
          if (moreToRemove) moreToRemove.remove();
        } else if (topForMore && !topForMore.querySelector('.todo-card__more')) {
          var newMore = document.createElement('button');
          newMore.className = 'todo-card__more';
          newMore.setAttribute('aria-label', '더보기');
          newMore.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" fill="#c4c9d2"/><circle cx="12" cy="12" r="1" fill="#c4c9d2"/><circle cx="12" cy="19" r="1" fill="#c4c9d2"/></svg>';
          topForMore.appendChild(newMore);
        }

        /* 상태 + 종류에 따라 해당 콘텐츠 영역의 섹션으로 카드 이동 */
        var newSt       = selState.classList.contains('done') ? 'done' :
                          selState.classList.contains('doing') ? 'doing' : 'todo';
        var selTypeChip = addSheetOverlay.querySelector('.type-chip.is-selected');
        var isGrp       = !selTypeChip || selTypeChip.textContent.trim() === '그룹';
        var destContent = document.querySelector('[data-todo-content="' + (isGrp ? 'group' : 'personal') + '"]');
        moveCardToSection(card, newSt, destContent);
      }

      /* 담당자 */
      var selAvatar      = addSheetOverlay.querySelector('.assignee-avatar.is-selected');
      var selTypeForAv   = addSheetOverlay.querySelector('.type-chip.is-selected');
      var isGrpForAv     = !selTypeForAv || selTypeForAv.textContent.trim() === '그룹';
      var assigneeEl     = card.querySelector('.todo-card__assignee');
      var metaForAv      = card.querySelector('.todo-card__meta');

      if (isGrpForAv && selAvatar) {
        /* 그룹인데 담당자 요소가 없으면 새로 생성 */
        if (!assigneeEl && metaForAv) {
          assigneeEl = document.createElement('div');
          assigneeEl.className = 'todo-card__assignee';
          var avNew   = document.createElement('div');
          avNew.className = 'todo-card__assignee-avatar';
          var nameNew = document.createElement('div');
          nameNew.className = 'todo-card__assignee-name';
          assigneeEl.appendChild(avNew);
          assigneeEl.appendChild(nameNew);
          metaForAv.appendChild(assigneeEl);
        }
        var avEl   = assigneeEl.querySelector('.todo-card__assignee-avatar');
        var nameEl = assigneeEl.querySelector('.todo-card__assignee-name');
        if (avEl)   { avEl.style.background = selAvatar.style.background; avEl.textContent = selAvatar.textContent.trim(); }
        if (nameEl) nameEl.textContent = selAvatar.title;
      } else if (!isGrpForAv && assigneeEl) {
        /* 개인으로 변경 시 담당자 요소 제거 */
        assigneeEl.remove();
      }

      /* Firebase 사용 중이고 카드에 Firestore ID가 있으면 업데이트 */
      var tid = card.dataset.todoId;
      var gIdForEdit = window._currentGroup && window._currentGroup.id;
      if (gIdForEdit && tid) {
        var selTypeE  = addSheetOverlay.querySelector('.type-chip.is-selected');
        var selStateE = addSheetOverlay.querySelector('.state-chip.is-selected');
        var selAvatarE = addSheetOverlay.querySelector('.assignee-avatar.is-selected:not([disabled])');
        var isGroupE  = !selTypeE || selTypeE.textContent.trim() === '그룹';
        var statusE   = selStateE && selStateE.classList.contains('done')  ? 'done' :
                        selStateE && selStateE.classList.contains('doing') ? 'doing' : 'pending';
        window.updateTodo(gIdForEdit, tid, {
          title:         sheetInput ? sheetInput.value.trim() : '',
          type:          isGroupE ? 'group' : 'personal',
          status:        statusE,
          memo:          sheetMemo ? sheetMemo.value.trim() : '',
          dueDate:       sheetDueDate ? (sheetDueDate.value || '') : '',
          assigneeName:  selAvatarE ? selAvatarE.title : '',
          assigneeColor: selAvatarE ? selAvatarE.style.background : '#8B95A1',
          assigneeUid:   selAvatarE ? (selAvatarE.dataset.memberUid || '') : '',
        });
      }
    }

    /* 새 할일 카드 생성 */
    function createNewCard() {
      if (!sheetInput || !sheetInput.value.trim()) return;

      var titleText = sheetInput.value.trim();
      var memoText  = sheetMemo ? sheetMemo.value.trim() : '';
      var selType   = addSheetOverlay.querySelector('.type-chip.is-selected');
      var selState  = addSheetOverlay.querySelector('.state-chip.is-selected');
      var selAvatar = addSheetOverlay.querySelector('.assignee-avatar.is-selected');

      /* 활성 탭이 아닌 선택된 종류 칩 기준으로 콘텐츠 영역 결정 */
      var isGroup = !selType || selType.textContent.trim() === '그룹';
      var content = document.querySelector('[data-todo-content="' + (isGroup ? 'group' : 'personal') + '"]');
      if (!content) return;
      var statusKey = selState && selState.classList.contains('doing') ? 'doing' :
                      selState && selState.classList.contains('done')  ? 'done'  : 'todo';

      /* Firebase 사용 중이면 Firestore에 저장 (onTodos 리스너가 re-render 담당) */
      var gId = window._currentGroup && window._currentGroup.id;
      if (gId) {
        var firestoreStatus = statusKey === 'todo' ? 'pending' : statusKey;
        window.addTodo(gId, {
          title:         titleText,
          type:          isGroup ? 'group' : 'personal',
          status:        firestoreStatus,
          memo:          memoText,
          dueDate:       sheetDueDate ? (sheetDueDate.value || '') : '',
          assigneeName:  selAvatar ? selAvatar.title : '',
          assigneeColor: selAvatar ? selAvatar.style.background : '#8B95A1',
          assigneeUid:   selAvatar ? (selAvatar.dataset.memberUid || '') : '',
        });
        return;
      }

      /* 카드 루트 */
      var card = document.createElement('article');
      card.className = 'todo-card';
      if (statusKey === 'done') card.style.opacity = '0.6';
      if (memoText) card.dataset.memo = memoText;

      /* 체크 아이콘 */
      var checkEl = document.createElement('div');
      checkEl.className = 'todo-card__check' + (statusKey === 'doing' ? ' is-doing' : statusKey === 'done' ? ' is-done' : '');
      if (statusKey !== 'doing') checkEl.innerHTML = '<svg viewBox="0 0 12 12"><polyline points="1,6 4.5,10 11,2"/></svg>';
      card.appendChild(checkEl);

      /* body */
      var bodyEl = document.createElement('div');
      bodyEl.className = 'todo-card__body';

      /* 제목 행 */
      var topEl = document.createElement('div');
      topEl.className = 'todo-card__top';
      var titleEl = document.createElement('div');
      titleEl.className = 'todo-card__title' + (statusKey === 'done' ? ' is-done' : '');
      titleEl.textContent = titleText;
      topEl.appendChild(titleEl);
      var moreEl = document.createElement('button');
      moreEl.className = 'todo-card__more';
      moreEl.setAttribute('aria-label', '더보기');
      moreEl.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" fill="#c4c9d2"/><circle cx="12" cy="12" r="1" fill="#c4c9d2"/><circle cx="12" cy="19" r="1" fill="#c4c9d2"/></svg>';
      topEl.appendChild(moreEl);
      bodyEl.appendChild(topEl);

      /* 메모 */
      if (memoText) {
        var memoEl = document.createElement('div');
        memoEl.className = 'todo-card__memo';
        memoEl.textContent = memoText;
        bodyEl.appendChild(memoEl);
      }

      /* 메타 (배지 + 담당자) */
      var metaEl = document.createElement('div');
      metaEl.className = 'todo-card__meta';

      var typeBadge = document.createElement('div');
      typeBadge.className = 'todo-badge ' + (isGroup ? 'todo-badge--group' : 'todo-badge--personal');
      typeBadge.textContent = isGroup ? '그룹' : '개인';
      metaEl.appendChild(typeBadge);

      if (statusKey === 'doing') {
        var doingBadge = document.createElement('div');
        doingBadge.className = 'todo-badge todo-badge--doing';
        doingBadge.textContent = '진행중';
        metaEl.appendChild(doingBadge);
      } else if (statusKey === 'done') {
        var doneBadge = document.createElement('div');
        doneBadge.className = 'todo-badge todo-badge--done';
        doneBadge.textContent = '완료';
        metaEl.appendChild(doneBadge);
      }

      if (isGroup && selAvatar) {
        var assigneeEl = document.createElement('div');
        assigneeEl.className = 'todo-card__assignee';
        var avEl = document.createElement('div');
        avEl.className = 'todo-card__assignee-avatar';
        avEl.style.background = selAvatar.style.background;
        avEl.textContent = selAvatar.textContent.trim();
        var nameEl = document.createElement('div');
        nameEl.className = 'todo-card__assignee-name';
        nameEl.textContent = selAvatar.title;
        assigneeEl.appendChild(avEl);
        assigneeEl.appendChild(nameEl);
        metaEl.appendChild(assigneeEl);
      }

      bodyEl.appendChild(metaEl);
      card.appendChild(bodyEl);

      var targetSection = content.querySelector('[data-status-group="' + statusKey + '"]');
      if (targetSection) targetSection.appendChild(card);
      updateSectionCounts(content);
    }

    function openSheet(mode, card) {
      addSheetOverlay._editCard = card || null;
      if (sheetTitleEl) sheetTitleEl.textContent = mode === 'edit' ? '할일 수정' : '할일 추가';

      if (mode === 'edit' && card) {
        syncSheetFromCard(card);
      } else {
        if (sheetInput)   sheetInput.value   = '';
        if (sheetMemo)    sheetMemo.value    = '';
        if (sheetDueDate) sheetDueDate.value = '';
        sheetTypeChips.forEach(function(c)  { c.classList.toggle('is-selected', c.textContent.trim() === '그룹'); });
        sheetStateChips.forEach(function(c) { c.classList.toggle('is-selected', c.classList.contains('todo')); });
        sheetAvatars.forEach(function(a, i) { a.classList.toggle('is-selected', i === 0); });
      }

      addSheetOverlay.classList.add('is-open');
      if (sheetInput) sheetInput.focus();
      /* 열릴 때 현재 종류 칩에 맞게 담당자 가용성 설정 */
      var selTypeNow = addSheetOverlay.querySelector('.type-chip.is-selected');
      updateAssigneeAvailability(selTypeNow && selTypeNow.textContent.trim() === '개인');
    }

    function closeSheet() {
      addSheetOverlay._editCard = null;
      if (sheetTitleEl) sheetTitleEl.textContent = '할일 추가';
      addSheetOverlay.classList.remove('is-open');
    }

    addSheetOverlay._openSheet = openSheet;

    /* 종류 칩 변경 시 담당자 가용성 실시간 업데이트 */
    sheetTypeChips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        updateAssigneeAvailability(chip.textContent.trim() === '개인');
      });
    });

    fabBtn.addEventListener('click', function() { openSheet('add'); });

    addSheetOverlay.addEventListener('click', function(e) {
      if (e.target === addSheetOverlay) closeSheet();
    });

    var saveBtn = addSheetOverlay.querySelector('.add-sheet__save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        if (addSheetOverlay._editCard) {
          applySheetToCard(addSheetOverlay._editCard);
        } else {
          createNewCard();
        }
        closeSheet();
      });
    }
  }

  /* ══════════════════════════════════════════
     공통 — 비밀번호 표시/숨김 토글
  ══════════════════════════════════════════ */
  var pwToggles = document.querySelectorAll('.btn-toggle-pw');
  pwToggles.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var input = btn.previousElementSibling;
      if (input && input.type === 'password') {
        input.type = 'text';
      } else if (input) {
        input.type = 'password';
      }
    });
  });

  /* ══════════════════════════════════════════
     공통 — 약관 체크박스 (01 회원가입)
  ══════════════════════════════════════════ */
  var allCheck = document.querySelector('.terms-all');
  var itemChecks = document.querySelectorAll('.terms-item .custom-check');
  if (allCheck && itemChecks.length) {
    allCheck.addEventListener('click', function() {
      var dot = allCheck.querySelector('.custom-check');
      var isChecked = !dot.classList.contains('is-checked');
      dot.classList.toggle('is-checked', isChecked);
      itemChecks.forEach(function(c) { c.classList.toggle('is-checked', isChecked); });
    });
    itemChecks.forEach(function(check) {
      check.addEventListener('click', function() {
        check.classList.toggle('is-checked');
      });
    });
  }

  /* ══════════════════════════════════════════
     03 일정 — 분류 칩 단일 선택
  ══════════════════════════════════════════ */
  var categoryChips = document.querySelectorAll('.category-chip');
  categoryChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      categoryChips.forEach(function(c) { c.classList.remove('is-selected'); });
      chip.classList.add('is-selected');
    });
  });

  /* ══════════════════════════════════════════
     03 일정 — 검색 화면
     입력값으로 schedule-card 제목을 실시간 필터
  ══════════════════════════════════════════ */
  var searchInput = document.querySelector('[data-search-input]');
  var searchClearBtn = document.querySelector('[data-search-clear]');
  var panelEmpty = document.querySelector('[data-search-panel="empty"]');
  var panelResults = document.querySelector('[data-search-panel="results"]');
  var searchCount = document.querySelector('[data-search-count]');
  var searchResultsContainer = document.querySelector('[data-search-results]');
  var searchNoResult = document.querySelector('[data-search-no-result]');

  if (searchInput) {
    /* 검색 화면 진입 시 input 자동 포커스 */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-go="schedule-search"]');
      if (btn) {
        /* data-go 핸들러가 goTo()를 호출한 뒤 포커스 */
        setTimeout(function() { searchInput.focus(); }, 50);
      }
    });

    searchInput.addEventListener('input', function() {
      var query = searchInput.value.trim();

      /* x 버튼 표시/숨김 */
      searchClearBtn.hidden = query.length === 0;

      if (query.length === 0) {
        /* 빈 입력이면 최근 검색 패널로 복귀 */
        panelEmpty.hidden = false;
        panelResults.hidden = true;
        return;
      }

      panelEmpty.hidden = true;
      panelResults.hidden = false;

      /* 일정 리스트 화면에 있는 카드 제목을 기준으로 검색 */
      var allCards = document.querySelectorAll('[data-screen-wrap="schedule-list"] .schedule-card');
      /* 목업 기준 오늘 날짜 (YYYY-MM-DD 문자열 비교용) */
      var TODAY_STR = '2026-06-19';
      var matched = [];
      allCards.forEach(function(card) {
        var title = card.querySelector('.schedule-card__title');
        if (title && title.textContent.indexOf(query) !== -1) {
          /* 복제 전에 원본 부모 date-group의 data-date로 과거 여부 판단 */
          var dateGroup = card.closest('[data-date]');
          var groupDate = dateGroup ? dateGroup.dataset.date : '';
          var isPast = groupDate !== '' && groupDate < TODAY_STR;
          var cloned = card.cloneNode(true);
          cloned.dataset.searchIsPast = isPast ? 'true' : 'false';
          cloned.dataset.searchDate = groupDate;
          matched.push(cloned);
        }
      });

      /* YYYY-MM-DD 문자열 오름차순 정렬 */
      matched.sort(function(a, b) {
        var da = a.dataset.searchDate || '';
        var db = b.dataset.searchDate || '';
        return da < db ? -1 : da > db ? 1 : 0;
      });

      searchResultsContainer.innerHTML = '';
      if (matched.length === 0) {
        searchNoResult.hidden = false;
        searchCount.innerHTML = '';
      } else {
        searchNoResult.hidden = true;
        searchCount.innerHTML = '<strong>' + matched.length + '개</strong>의 일정';
        matched.forEach(function(card) {
          /* 시간 앞에 연월일 붙이기 */
          var dp = (card.dataset.searchDate || '').split('-');
          if (dp.length === 3) {
            var dateLabel = dp[0] + '년 ' + parseInt(dp[1]) + '월 ' + parseInt(dp[2]) + '일';
            var timeEl = card.querySelector('.schedule-card__time');
            if (timeEl) {
              var svgEl = timeEl.querySelector('svg');
              var svgHTML = svgEl ? svgEl.outerHTML : '';
              var timeText = timeEl.textContent.trim();
              timeEl.innerHTML = svgHTML + dateLabel + ' · ' + timeText;
            }
          }

          if (card.dataset.searchIsPast === 'true') {
            /* 과거 일정: 복제된 data-go 제거 + 클릭 불가 + 흐리게 */
            card.removeAttribute('data-go');
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.5';
            card.style.cursor = 'default';
          }
          /* 오늘 이후 일정: 원본의 data-go가 복제되어 그대로 동작 */
          searchResultsContainer.appendChild(card);
        });
      }
    });

    /* x 버튼 클릭 시 입력값 초기화 */
    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', function() {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      });
    }

    /* 최근 검색어 칩 클릭 → 검색어 채움 */
    document.addEventListener('click', function(e) {
      var chip = e.target.closest('[data-recent-keyword]');
      if (!chip) return;
      searchInput.value = chip.textContent.trim();
      searchInput.dispatchEvent(new Event('input'));
    });

    /* 전체 삭제 */
    var clearAllBtn = document.querySelector('[data-search-clear-all]');
    var recentChips = document.querySelector('[data-recent-chips]');
    if (clearAllBtn && recentChips) {
      clearAllBtn.addEventListener('click', function() {
        recentChips.innerHTML = '';
      });
    }
  }

  /* ══════════════════════════════════════════
     03 일정 — 날짜 선택 바텀 시트
  ══════════════════════════════════════════ */
  var datePickerOverlay = document.querySelector('[data-date-picker-overlay]');
  if (datePickerOverlay) {
    var pickerTitle    = document.querySelector('[data-picker-title]');
    var pickerDone     = document.querySelector('[data-picker-done]');
    var dateMonthLabel = document.querySelector('[data-date-month]');
    var dateGrid       = document.querySelector('[data-date-grid]');
    var datePrevBtn    = document.querySelector('[data-date-prev]');
    var dateNextBtn    = document.querySelector('[data-date-next]');
    var timePicker     = document.querySelector('[data-time-picker]');
    var timeHoursEl    = document.querySelector('[data-time-hours]');

    /* 시간 선택 행 마우스 드래그 스크롤 */
    (function () {
      var el = timeHoursEl;
      var isDragging = false, hasMoved = false, startX = 0, scrollLeft = 0;
      el.addEventListener('mousedown', function (e) {
        isDragging = true; hasMoved = false;
        startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
        el.style.cursor = 'grabbing'; e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        var dx = (e.pageX - el.offsetLeft) - startX;
        if (Math.abs(dx) > 4) hasMoved = true;
        el.scrollLeft = scrollLeft - dx;
      });
      document.addEventListener('mouseup', function () {
        if (!isDragging) return;
        isDragging = false; el.style.cursor = '';
      });
      /* 드래그 후 클릭 이벤트 차단 */
      el.addEventListener('click', function (e) {
        if (hasMoved) { e.stopImmediatePropagation(); hasMoved = false; }
      }, true);
    }());

    var currentPickerType = 'start';
    var _td = new Date();
    var calYear  = _td.getFullYear();
    var calMonth = _td.getMonth() + 1;

    /* 선택된 날짜/시간 상태 */
    var pickerState = {
      start: { year: _td.getFullYear(), month: _td.getMonth() + 1, day: _td.getDate(), ampm: 'am', hour: 9,  min: 0 },
      end:   { year: _td.getFullYear(), month: _td.getMonth() + 1, day: _td.getDate(), ampm: 'am', hour: 10, min: 0 }
    };
    datePickerOverlay._pickerState = pickerState;

    var DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

    function isAlldayChecked() {
      var check = document.querySelector('[data-allday-check]');
      return check ? check.classList.contains('is-checked') : false;
    }

    function formatDateState(state) {
      var date = new Date(state.year, state.month - 1, state.day);
      var dayStr = DAYS_KR[date.getDay()];
      var dateStr = state.year + '년 ' + state.month + '월 ' + state.day + '일 (' + dayStr + ')';
      if (isAlldayChecked()) return dateStr;
      var ampm = state.ampm === 'am' ? '오전' : '오후';
      var minStr = state.min < 10 ? '0' + state.min : '' + state.min;
      return dateStr + ' ' + ampm + ' ' + state.hour + ':' + minStr;
    }

    function updateDateDisplays() {
      var startEl = document.querySelector('[data-date-display="start"]');
      var endEl   = document.querySelector('[data-date-display="end"]');
      if (startEl) startEl.textContent = formatDateState(pickerState.start);
      if (endEl)   endEl.textContent   = formatDateState(pickerState.end);
    }

    function renderCalendar(year, month) {
      calYear = year;
      calMonth = month;
      dateMonthLabel.textContent = year + '년 ' + month + '월';

      var firstDay    = new Date(year, month - 1, 1).getDay();
      var daysInMonth = new Date(year, month, 0).getDate();
      var today       = new Date();
      var sel         = pickerState[currentPickerType];

      var html = '';
      for (var i = 0; i < firstDay; i++) {
        html += '<div class="date-picker-day date-picker-day--empty"></div>';
      }
      for (var d = 1; d <= daysInMonth; d++) {
        var dow     = (firstDay + d - 1) % 7;
        var isToday = today.getFullYear() === year && (today.getMonth() + 1) === month && today.getDate() === d;
        var isSel   = sel.year === year && sel.month === month && sel.day === d;
        var cls = 'date-picker-day';
        if (isToday) cls += ' is-today';
        if (isSel)   cls += ' is-selected';
        if (dow === 0) cls += ' is-sunday';
        if (dow === 6) cls += ' is-saturday';
        html += '<div class="' + cls + '" data-day="' + d + '" role="gridcell" tabindex="-1">' + d + '</div>';
      }
      dateGrid.innerHTML = html;
    }

    function renderTimeHours() {
      var sel = pickerState[currentPickerType];
      var html = '';
      for (var h = 1; h <= 12; h++) {
        html += '<button class="time-picker__hour' + (sel.hour === h ? ' is-selected' : '') + '" data-hour="' + h + '">' + h + '</button>';
      }
      timeHoursEl.innerHTML = html;
    }

    function syncTimeUI() {
      var sel = pickerState[currentPickerType];
      /* 오전/오후 */
      document.querySelectorAll('[data-ampm]').forEach(function(btn) {
        btn.classList.toggle('is-active', btn.dataset.ampm === sel.ampm);
      });
      /* 분 */
      document.querySelectorAll('[data-min]').forEach(function(btn) {
        btn.classList.toggle('is-selected', parseInt(btn.dataset.min, 10) === sel.min);
      });
      renderTimeHours();
    }

    function openDatePicker(type) {
      currentPickerType = type;
      var sel = pickerState[type];
      pickerTitle.textContent = type === 'start' ? '시작일 선택' : '종료일 선택';
      timePicker.style.display = isAlldayChecked() ? 'none' : 'block';
      renderCalendar(sel.year, sel.month);
      syncTimeUI();
      datePickerOverlay.classList.add('is-open');
    }

    /* 날짜 필드 클릭 → 피커 열기 */
    document.addEventListener('click', function(e) {
      var field = e.target.closest('[data-date-picker]');
      if (!field) return;
      var type = field.dataset.datePicker;
      openDatePicker(type);
    });

    /* 달력 날짜 셀 클릭 */
    dateGrid.addEventListener('click', function(e) {
      var cell = e.target.closest('[data-day]');
      if (!cell) return;
      pickerState[currentPickerType].day   = parseInt(cell.dataset.day, 10);
      pickerState[currentPickerType].year  = calYear;
      pickerState[currentPickerType].month = calMonth;
      renderCalendar(calYear, calMonth);
    });

    /* 이전/다음 달 */
    datePrevBtn.addEventListener('click', function() {
      var m = calMonth - 1, y = calYear;
      if (m < 1) { m = 12; y--; }
      renderCalendar(y, m);
    });
    dateNextBtn.addEventListener('click', function() {
      var m = calMonth + 1, y = calYear;
      if (m > 12) { m = 1; y++; }
      renderCalendar(y, m);
    });

    /* 오전/오후 클릭 */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-ampm]');
      if (!btn || !datePickerOverlay.classList.contains('is-open')) return;
      pickerState[currentPickerType].ampm = btn.dataset.ampm;
      document.querySelectorAll('[data-ampm]').forEach(function(b) {
        b.classList.toggle('is-active', b.dataset.ampm === btn.dataset.ampm);
      });
    });

    /* 시간 클릭 */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-hour]');
      if (!btn || !datePickerOverlay.classList.contains('is-open')) return;
      pickerState[currentPickerType].hour = parseInt(btn.dataset.hour, 10);
      renderTimeHours();
    });

    /* 분 클릭 */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-min]');
      if (!btn || !datePickerOverlay.classList.contains('is-open')) return;
      pickerState[currentPickerType].min = parseInt(btn.dataset.min, 10);
      document.querySelectorAll('[data-min]').forEach(function(b) {
        b.classList.toggle('is-selected', b === btn);
      });
    });

    /* 완료 버튼 */
    pickerDone.addEventListener('click', function() {
      datePickerOverlay.classList.remove('is-open');
      /* 시작일 변경 시 종료일을 항상 시작일에 맞춤 */
      if (currentPickerType === 'start') {
        var s = pickerState.start;
        pickerState.end.year  = s.year;
        pickerState.end.month = s.month;
        pickerState.end.day   = s.day;
      }
      updateDateDisplays();
    });

    /* 오버레이 배경 클릭 → 닫기 */
    datePickerOverlay.addEventListener('click', function(e) {
      if (e.target === datePickerOverlay) {
        datePickerOverlay.classList.remove('is-open');
      }
    });

    /* 종일 체크박스 클릭 */
    document.addEventListener('click', function(e) {
      var row = e.target.closest('[data-allday-row]');
      if (!row) return;
      var check = row.querySelector('[data-allday-check]');
      if (check) {
        check.classList.toggle('is-checked');
        updateDateDisplays();
      }
    });

    /* 초기 날짜 표시 렌더링 */
    updateDateDisplays();
  }

  /* ══════════════════════════════════════════
     03 일정 — 저녁 가능 여부 토글
  ══════════════════════════════════════════ */
  var dinnerBtns = document.querySelectorAll('.dinner-btn');
  dinnerBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      dinnerBtns.forEach(function(b) { b.classList.remove('is-selected'); });
      btn.classList.add('is-selected');
    });
  });

  /* ══════════════════════════════════════════
     04 할일 — 타입/상태 칩 단일 선택
  ══════════════════════════════════════════ */
  var typeChips = document.querySelectorAll('.type-chip');
  typeChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      typeChips.forEach(function(c) { c.classList.remove('is-selected'); });
      chip.classList.add('is-selected');
    });
  });

  var stateChips = document.querySelectorAll('.state-chip');
  stateChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      stateChips.forEach(function(c) { c.classList.remove('is-selected'); });
      chip.classList.add('is-selected');
    });
  });

  /* ══════════════════════════════════════════
     04 할일 — 담당자 아바타 토글
  ══════════════════════════════════════════ */
  var assigneeAvatars = document.querySelectorAll('.assignee-avatar');
  assigneeAvatars.forEach(function(avatar) {
    avatar.addEventListener('click', function() {
      assigneeAvatars.forEach(function(a) { a.classList.remove('is-selected'); });
      avatar.classList.add('is-selected');
    });
  });

  /* ══════════════════════════════════════════
     02 홈 — 할일 미니 체크 토글
     클릭 시 체크 아이콘 + 텍스트 취소선 동시 전환
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var check = e.target.closest('.todo-check');
    if (!check) return;
    check.classList.toggle('is-done');
    var textEl = check.parentElement.querySelector('.todo-mini-item__text');
    if (textEl) textEl.classList.toggle('is-done');
  });

  /* ══════════════════════════════════════════
     04 할일 — 더보기 팝오버 메뉴
     버튼 우하단 기준으로 위치 계산 후 표시
  ══════════════════════════════════════════ */
  var todoMoreMenu = document.querySelector('[data-todo-more-menu]');
  if (todoMoreMenu) {
    /* 더보기 버튼 클릭 → 위치 계산 후 팝오버 열기/닫기 */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.todo-card__more');
      if (btn) {
        e.stopPropagation();
        var isAlreadyOpen = todoMoreMenu.classList.contains('is-open') && todoMoreMenu._anchor === btn;

        /* 이미 같은 버튼으로 열려있으면 닫기 */
        if (isAlreadyOpen) {
          todoMoreMenu.classList.remove('is-open');
          todoMoreMenu._anchor = null;
          return;
        }

        /* 버튼과 phone-frame 기준으로 위치 계산 */
        var frame = document.querySelector('.phone-frame');
        var btnRect   = btn.getBoundingClientRect();
        var frameRect = frame.getBoundingClientRect();

        todoMoreMenu.style.top   = (btnRect.bottom - frameRect.top + 4) + 'px';
        todoMoreMenu.style.right = (frameRect.right - btnRect.right) + 'px';
        todoMoreMenu._anchor = btn;
        todoMoreMenu.classList.add('is-open');
        return;
      }

      /* 팝오버 밖 영역 클릭 시 닫기 */
      if (!e.target.closest('[data-todo-more-menu]')) {
        todoMoreMenu.classList.remove('is-open');
        todoMoreMenu._anchor = null;
      }
    });

    /* 액션 실행 */
    todoMoreMenu.addEventListener('click', function(e) {
      var actionBtn = e.target.closest('[data-more-action]');
      if (!actionBtn) return;

      var action = actionBtn.dataset.moreAction;
      var card   = todoMoreMenu._anchor ? todoMoreMenu._anchor.closest('.todo-card') : null;

      todoMoreMenu.classList.remove('is-open');
      todoMoreMenu._anchor = null;

      if (!card) return;

      if (action === 'edit') {
        /* 바텀시트를 수정 모드로 열기 */
        var sheet = document.querySelector('[data-add-sheet]');
        if (sheet && sheet._openSheet) sheet._openSheet('edit', card);
      } else if (action === 'delete') {
        var gIdDel = window._currentGroup && window._currentGroup.id;
        var tidDel = card.dataset.todoId;
        if (gIdDel && tidDel) {
          /* Firestore 삭제 → onTodos 리스너가 re-render */
          window.deleteTodo(gIdDel, tidDel);
        } else {
          /* 목업 모드: DOM에서만 제거 */
          card.style.transition = 'opacity 0.2s ease';
          card.style.opacity    = '0';
          setTimeout(function() { card.remove(); }, 200);
        }
      }
    });
  }

  /* ══════════════════════════════════════════
     04 할일 — 필터 바텀시트 (상태 + 담당자)
  ══════════════════════════════════════════ */
  var filterSheetOverlay = document.querySelector('[data-filter-sheet]');
  var todoFilterBtn = document.querySelector('.header__btn[aria-label="필터"]');
  if (filterSheetOverlay && todoFilterBtn) {
    var activeFilter       = 'all';
    var activeStatusFilter = 'all';

    function _getFilterItems()  { return filterSheetOverlay.querySelectorAll('[data-filter-assignee]'); }
    function _getStatusItems()  { return filterSheetOverlay.querySelectorAll('[data-filter-status]'); }

    function _applyToContent(content, assignee, status, checkAssignee) {
      if (!content) return;
      content.querySelectorAll('.todo-card').forEach(function(card) {
        var statusOk   = status === 'all' || card.dataset.todoStatus === status;
        var assigneeOk = !checkAssignee || assignee === 'all' ||
          (function() { var el = card.querySelector('.todo-card__assignee-name'); return el && el.textContent.trim() === assignee; }());
        card.style.display = (statusOk && assigneeOk) ? '' : 'none';
      });
      content.querySelectorAll('.status-group').forEach(function(sec) {
        sec.style.display = Array.prototype.some.call(
          sec.querySelectorAll('.todo-card'), function(c) { return c.style.display !== 'none'; }
        ) ? '' : 'none';
      });
    }

    function applyFilter(assignee, status) {
      activeFilter       = assignee;
      activeStatusFilter = status;
      _applyToContent(document.querySelector('[data-todo-content="group"]'),    assignee, status, true);
      _applyToContent(document.querySelector('[data-todo-content="personal"]'), assignee, status, false);
      todoFilterBtn.classList.toggle('is-filtered', assignee !== 'all' || status !== 'all');
    }

    /* 렌더 후 재적용용 — app.html의 onTodos 콜백에서 호출 */
    window._todoApplyFilter = function() { applyFilter(activeFilter, activeStatusFilter); };

    todoFilterBtn.addEventListener('click', function() {
      /* 열 때마다 현재 선택 상태 동기화 */
      _getFilterItems().forEach(function(item) {
        item.onclick = function() {
          _getFilterItems().forEach(function(i) { i.classList.remove('is-selected'); });
          item.classList.add('is-selected');
        };
        item.classList.toggle('is-selected', item.dataset.filterAssignee === activeFilter);
      });
      _getStatusItems().forEach(function(item) {
        item.onclick = function() {
          _getStatusItems().forEach(function(i) { i.classList.remove('is-selected'); });
          item.classList.add('is-selected');
        };
        item.classList.toggle('is-selected', item.dataset.filterStatus === activeStatusFilter);
      });
      filterSheetOverlay.classList.add('is-open');
    });

    /* 배경 클릭 시 닫기 */
    filterSheetOverlay.addEventListener('click', function(e) {
      if (e.target === filterSheetOverlay) filterSheetOverlay.classList.remove('is-open');
    });

    /* 적용 버튼 */
    var filterApplyBtn = filterSheetOverlay.querySelector('[data-filter-apply]');
    if (filterApplyBtn) {
      filterApplyBtn.addEventListener('click', function() {
        var selAssignee = filterSheetOverlay.querySelector('[data-filter-assignee].is-selected');
        var selStatus   = filterSheetOverlay.querySelector('[data-filter-status].is-selected');
        applyFilter(
          selAssignee ? selAssignee.dataset.filterAssignee : 'all',
          selStatus   ? selStatus.dataset.filterStatus     : 'all'
        );
        filterSheetOverlay.classList.remove('is-open');
      });
    }

    /* 초기화 버튼 */
    var filterResetBtn = filterSheetOverlay.querySelector('[data-filter-reset]');
    if (filterResetBtn) {
      filterResetBtn.addEventListener('click', function() {
        _getFilterItems().forEach(function(i) { i.classList.toggle('is-selected', i.dataset.filterAssignee === 'all'); });
        _getStatusItems().forEach(function(i) { i.classList.toggle('is-selected', i.dataset.filterStatus === 'all'); });
      });
    }
  }

  /* ══════════════════════════════════════════
     04 할일 — 할일 카드 체크 토글
     클릭 시 완료 전환 + 제목 취소선
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var check = e.target.closest('.todo-card__check');
    if (!check) return;

    /* Firebase 카드: 04_todo.html 핸들러(Firestore 업데이트)에 위임 */
    var cardForCheck = check.closest('.todo-card');
    if (cardForCheck && cardForCheck.dataset.todoId) return;

    var wasDone = check.classList.contains('is-done');

    if (wasDone) {
      /* 완료 → 진행전으로 되돌리기 */
      check.classList.remove('is-done');
    } else {
      /* 진행전/진행중 → 완료로 전환 */
      check.classList.remove('is-doing');
      check.classList.add('is-done');
      /* 진행중 카드는 SVG가 없으므로 동적으로 추가 */
      if (!check.querySelector('svg')) {
        check.innerHTML = '<svg viewBox="0 0 12 12"><polyline points="1,6 4.5,10 11,2"/></svg>';
      }
      /* 완료 시 더보기 버튼 제거 */
      var cardForMore = check.closest('.todo-card');
      if (cardForMore) {
        var moreToRemove = cardForMore.querySelector('.todo-card__more');
        if (moreToRemove) moreToRemove.remove();
      }
    }

    var card = check.closest('.todo-card');
    if (!card) return;
    var title = card.querySelector('.todo-card__title');
    if (title) title.classList.toggle('is-done', !wasDone);
    card.style.opacity = wasDone ? '' : '0.6';

    /* 완료 해제 시 더보기 버튼 없으면 동적 추가 */
    if (wasDone) {
      var topEl = card.querySelector('.todo-card__top');
      if (topEl && !topEl.querySelector('.todo-card__more')) {
        var moreBtn = document.createElement('button');
        moreBtn.className = 'todo-card__more';
        moreBtn.setAttribute('aria-label', '더보기');
        moreBtn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" fill="#c4c9d2"/><circle cx="12" cy="12" r="1" fill="#c4c9d2"/><circle cx="12" cy="19" r="1" fill="#c4c9d2"/></svg>';
        topEl.appendChild(moreBtn);
      }
    }

    moveCardToSection(card, wasDone ? 'todo' : 'done');
  });

  /* ══════════════════════════════════════════
     01 그룹 유형 선택
  ══════════════════════════════════════════ */
  var groupTypeItems = document.querySelectorAll('.group-type-item');
  groupTypeItems.forEach(function(item) {
    item.addEventListener('click', function() {
      groupTypeItems.forEach(function(i) { i.classList.remove('is-selected'); });
      item.classList.add('is-selected');
    });
  });

  /* ══════════════════════════════════════════
     03 일정 — 카드 클릭 → 상세 화면 업데이트
     카드의 data-* 속성을 읽어 상세 화면 동적 구성
  ══════════════════════════════════════════ */
  var currentScheduleCard = null;

  /* 이니셜 → 이름 매핑 (목업용) */
  var MEMBER_NAMES = { '아': '아빠', '엄': '엄마', '딸': '딸', '아들': '아들' };

  /* hex 색상 → 'rgb(r, g, b)' 변환
     브라우저는 getComputedStyle로 읽을 때 항상 rgb() 형식을 반환하므로
     data-member-color(hex)와 비교하기 전에 동일 형식으로 맞춤 */
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  /* 분류 칩 → 태그 색상 매핑 */
  var CATEGORY_COLORS = {
    '업무':   { bg: '#eff2ff', color: '#4f7cff' },
    '학교':   { bg: '#f0fdf4', color: '#10b981' },
    '약속':   { bg: '#fff7ed', color: '#f97316' },
    '시험':   { bg: '#f0fdf4', color: '#10b981' },
    '여행':   { bg: '#f0f9ff', color: '#0ea5e9' },
    '운동':   { bg: '#fdf4ff', color: '#a855f7' },
    '동아리': { bg: '#faf5ff', color: '#a855f7' },
    '기타':   { bg: '#f4f5f6', color: '#6d7882' }
  };

  function updateScheduleDetail(card) {
    /* 제목 */
    var titleEl = document.querySelector('[data-detail-title]');
    var title = card.dataset.title || card.querySelector('.schedule-card__title').textContent.trim();
    if (titleEl) titleEl.textContent = title;

    /* 태그 (분류) */
    var tagEl = document.querySelector('[data-detail-tag]');
    var cardTag = card.querySelector('.schedule-card__tag');
    if (tagEl && cardTag) {
      tagEl.textContent = cardTag.textContent.trim();
      tagEl.style.background = cardTag.style.background;
      tagEl.style.color = cardTag.style.color;
    }

    /* 일시: 날짜 그룹에서 날짜 추출 + 카드 시간 텍스트 조합 */
    var dateGroup = card.closest('.date-group');
    var dateGroupEl = dateGroup ? dateGroup.querySelector('.date-group__date') : null;
    var dayGroupEl  = dateGroup ? dateGroup.querySelector('.date-group__day') : null;
    var dateStr = dateGroupEl ? dateGroupEl.textContent.trim() : '';
    var dayStr  = dayGroupEl ? '(' + dayGroupEl.textContent.trim() + ')' : '';
    var timeTextEl = card.querySelector('.schedule-card__time');
    /* SVG를 제외한 순수 텍스트만 추출 */
    var timeText = '';
    if (timeTextEl) {
      timeTextEl.childNodes.forEach(function(node) {
        if (node.nodeType === 3) timeText += node.textContent.trim();
      });
    }
    var detailDateEl = document.querySelector('[data-detail-date]');
    if (detailDateEl) {
      /* 수정 후 저장된 timeText가 있으면 우선 사용 */
      if (card.dataset.timeText) {
        detailDateEl.innerHTML = card.dataset.timeText;
      } else {
        detailDateEl.innerHTML = '2026년 ' + dateStr + ' ' + dayStr + (timeText ? '<br>' + timeText : '');
      }
    }

    /* 분류 텍스트 (수정 후 dataset.category 있으면 우선) */
    var detailCategoryEl = document.querySelector('[data-detail-category]');
    var categoryName = card.dataset.category || (cardTag ? cardTag.textContent.trim() : '');
    if (detailCategoryEl) detailCategoryEl.textContent = categoryName;

    /* 참여 멤버: 카드 아바타 복사 */
    var membersContainer = document.querySelector('[data-detail-members]');
    if (membersContainer) {
      var cardMembers = card.querySelectorAll('.schedule-card__members .schedule-card__avatar');
      membersContainer.innerHTML = '';
      cardMembers.forEach(function(av) {
        var initial = av.textContent.trim();
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
        var avEl = document.createElement('div');
        avEl.style.cssText = 'width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:' + av.style.background + ';';
        avEl.textContent = initial;
        var nameEl = document.createElement('span');
        nameEl.style.cssText = 'font-size:11px;color:#888;';
        nameEl.textContent = MEMBER_NAMES[initial] || initial;
        wrapper.appendChild(avEl);
        wrapper.appendChild(nameEl);
        membersContainer.appendChild(wrapper);
      });
    }

    /* 작성자 */
    var authorAvatarEl = document.querySelector('[data-detail-author-avatar]');
    var authorNameEl   = document.querySelector('[data-detail-author-name]');
    if (authorAvatarEl) {
      authorAvatarEl.textContent  = card.dataset.authorInitial || '';
      authorAvatarEl.style.background = card.dataset.authorColor || '#888';
    }
    if (authorNameEl) {
      var author  = card.dataset.author   || '';
      var regDate = card.dataset.regDate  || '';
      authorNameEl.textContent = author + (regDate ? '가 등록 · ' + regDate : '');
    }

    /* 저녁 여부 */
    var dinnerBadgeEl = document.querySelector('[data-detail-dinner-badge]');
    var dinner = card.dataset.dinner || 'none';
    if (dinnerBadgeEl) {
      if (dinner === 'possible') {
        dinnerBadgeEl.style.background = '#f0fdf4';
        dinnerBadgeEl.style.color      = '#10b981';
        dinnerBadgeEl.textContent      = '가능 ✓';
      } else if (dinner === 'impossible') {
        dinnerBadgeEl.style.background = '#fef2f2';
        dinnerBadgeEl.style.color      = '#E52E2E';
        dinnerBadgeEl.textContent      = '불가능';
      } else {
        dinnerBadgeEl.style.background = '#f4f5f6';
        dinnerBadgeEl.style.color      = '#888888';
        dinnerBadgeEl.textContent      = '미정';
      }
    }

    /* 메모 */
    var detailMemoSection = document.querySelector('[data-detail-memo-section]');
    var detailMemoEl      = document.querySelector('[data-detail-memo]');
    var memo = card.dataset.memo || '';
    if (detailMemoSection) detailMemoSection.style.display = memo ? '' : 'none';
    if (detailMemoEl) detailMemoEl.textContent = memo;

    /* 수정/삭제 버튼: mine이면 표시, other면 숨김 */
    var editBtn   = document.querySelector('[data-schedule-edit]');
    var deleteBtn = document.querySelector('[data-schedule-delete]');
    var isMine    = card.dataset.scheduleType === 'mine';
    if (editBtn)   editBtn.style.display   = isMine ? '' : 'none';
    if (deleteBtn) deleteBtn.style.display = isMine ? '' : 'none';
  }

  /* 카드 클릭 시 currentScheduleCard 저장 + 상세 화면 업데이트 */
  document.addEventListener('click', function(e) {
    var card = e.target.closest('.schedule-card[data-go="schedule-detail"]');
    if (!card) return;
    currentScheduleCard = card;
    /* goTo는 data-go 핸들러가 먼저 실행하므로 여기선 업데이트만 */
    updateScheduleDetail(card);
  });

  /* ══════════════════════════════════════════
     03 일정 — 참여자 다중 선택 토글
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var item = e.target.closest('.member-select__item');
    if (!item) return;
    var isNowSelected = !item.classList.contains('is-selected');
    item.classList.toggle('is-selected', isNowSelected);
    item.setAttribute('aria-pressed', isNowSelected ? 'true' : 'false');
  });

  /* ══════════════════════════════════════════
     03 일정 — 수정 버튼: 등록 화면에 현재 데이터 채우기
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-schedule-edit]');
    if (!btn || !currentScheduleCard) return;

    var registerTitleEl = document.querySelector('[data-register-title]');
    if (registerTitleEl) registerTitleEl.textContent = '일정 수정';

    /* 제목 */
    var titleInput = document.querySelector('.form-row__input');
    if (titleInput) titleInput.value = currentScheduleCard.dataset.title || '';

    /* 저녁 여부 토글 */
    var currentDinner = currentScheduleCard.dataset.dinner || 'none';
    var dinnerBtnsAll = document.querySelectorAll('.dinner-btn');
    dinnerBtnsAll.forEach(function(b) {
      b.classList.remove('is-selected');
      if (b.dataset.dinnerVal === currentDinner) b.classList.add('is-selected');
    });

    /* 메모 */
    var memoInput = document.querySelector('[data-memo-input]');
    if (memoInput) memoInput.value = currentScheduleCard.dataset.memo || '';

    /* 참여자: 아바타 배경색을 rgb 형식으로 수집해 선택 상태 동기화
       저장 후 생성된 아바타에는 data-member-color(hex)가 있으므로 변환 후 추가 */
    var cardAvatars = currentScheduleCard.querySelectorAll('.schedule-card__members .schedule-card__avatar');
    var selectedBgColors = [];
    cardAvatars.forEach(function(av) {
      var hex = av.dataset.memberColor;
      selectedBgColors.push(hex ? hexToRgb(hex) : getComputedStyle(av).backgroundColor);
    });
    var memberItems = document.querySelectorAll('.member-select__item');
    memberItems.forEach(function(item) {
      var isSelected = selectedBgColors.indexOf(hexToRgb(item.dataset.memberColor)) !== -1;
      item.classList.toggle('is-selected', isSelected);
      item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    goTo('schedule-register');
  });

  /* ══════════════════════════════════════════
     03 일정 — 저장 버튼: 수정 모드면 카드 업데이트
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-schedule-save]');
    if (!btn) return;

    var titleInput   = document.querySelector('.form-row__input');
    var memoInput    = document.querySelector('[data-memo-input]');
    var selectedDin  = document.querySelector('.dinner-btn.is-selected');

    if (currentScheduleCard) {
      /* 수정 모드: 카드 DOM 업데이트 */
      var newTitle = titleInput ? titleInput.value.trim() : '';
      if (newTitle) {
        currentScheduleCard.dataset.title = newTitle;
        var cardTitleEl = currentScheduleCard.querySelector('.schedule-card__title');
        if (cardTitleEl) cardTitleEl.textContent = newTitle;
      }

      /* 저녁 여부 업데이트 */
      if (selectedDin) {
        var dinVal = selectedDin.dataset.dinnerVal || 'none';
        currentScheduleCard.dataset.dinner = dinVal;
        var dinnerEl = currentScheduleCard.querySelector('.schedule-card__dinner');
        if (dinVal === 'possible') {
          if (!dinnerEl) {
            dinnerEl = document.createElement('div');
            dinnerEl.className = 'schedule-card__dinner';
            currentScheduleCard.querySelector('.schedule-card__body').appendChild(dinnerEl);
          }
          dinnerEl.style.color = '#10b981';
          dinnerEl.innerHTML = '<svg viewBox="0 0 24 24" stroke="#10b981"><polyline points="20 6 9 17 4 12"/></svg>저녁 가능';
        } else if (dinVal === 'impossible') {
          if (!dinnerEl) {
            dinnerEl = document.createElement('div');
            dinnerEl.className = 'schedule-card__dinner';
            currentScheduleCard.querySelector('.schedule-card__body').appendChild(dinnerEl);
          }
          dinnerEl.style.color = '#E52E2E';
          dinnerEl.innerHTML = '<svg viewBox="0 0 24 24" stroke="#E52E2E"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>저녁 불가능';
        } else {
          /* 미정: 저녁 표시 제거 */
          if (dinnerEl) dinnerEl.remove();
        }
      }

      /* 분류 업데이트 */
      var selectedCat = document.querySelector('.category-chip.is-selected');
      if (selectedCat) {
        var catName   = selectedCat.textContent.trim();
        var catColors = CATEGORY_COLORS[catName] || { bg: '#f4f5f6', color: '#6d7882' };
        var cardTagEl = currentScheduleCard.querySelector('.schedule-card__tag');
        if (cardTagEl) {
          cardTagEl.textContent       = catName;
          cardTagEl.style.background  = catColors.bg;
          cardTagEl.style.color       = catColors.color;
        }
        currentScheduleCard.dataset.category = catName;
      }

      /* 날짜/시간 업데이트 */
      var startDisplay = document.querySelector('[data-date-display="start"]');
      var endDisplay   = document.querySelector('[data-date-display="end"]');
      var alldayCheck  = document.querySelector('[data-allday-check]');
      var isAllday     = alldayCheck && alldayCheck.classList.contains('is-checked');
      var startText    = startDisplay ? startDisplay.textContent.trim() : '';
      var endText      = endDisplay   ? endDisplay.textContent.trim()   : '';

      /* "YYYY년 M월 D일 (요)" 패턴으로 날짜와 시간 분리 */
      var datePattern    = /\d{4}년 \d+월 \d+일 \([가-힣]\)/;
      var startDateMatch = startText.match(datePattern);
      var endDateMatch   = endText.match(datePattern);
      var startDatePart  = startDateMatch ? startDateMatch[0] : startText;
      var endDatePart    = endDateMatch   ? endDateMatch[0]   : '';
      var startTimePart  = startDateMatch ? startText.replace(startDatePart, '').trim() : '';
      var endTimePart    = endDateMatch   ? endText.replace(endDatePart, '').trim()     : '';
      var isMultiDay     = endDatePart && endDatePart !== startDatePart;

      /* 상세 화면용 날짜·시간 텍스트 */
      var timeDisplayText = '';
      if (isAllday) {
        timeDisplayText = isMultiDay
          ? startDatePart + ' – ' + endDatePart + '<br>종일'
          : startDatePart + '<br>종일';
      } else if (isMultiDay) {
        timeDisplayText = startDatePart + (startTimePart ? ' ' + startTimePart : '') +
                          ' – ' + endDatePart + (endTimePart ? ' ' + endTimePart : '');
      } else if (startTimePart && endTimePart && startTimePart !== endTimePart) {
        timeDisplayText = startDatePart + '<br>' + startTimePart + ' – ' + endTimePart;
      } else {
        timeDisplayText = startDatePart + (startTimePart ? '<br>' + startTimePart : '');
      }
      currentScheduleCard.dataset.timeText = timeDisplayText;

      /* 카드 리스트의 시간 표시도 갱신 */
      var cardTimeEl = currentScheduleCard.querySelector('.schedule-card__time');
      if (cardTimeEl) {
        var svgEl = cardTimeEl.querySelector('svg');
        var sShort = (startDatePart.match(/\d+월 \d+일/) || [''])[0];
        var eShort = (endDatePart.match(/\d+월 \d+일/)   || [''])[0];
        var cardTimeText = isAllday
          ? (isMultiDay ? sShort + ' – ' + eShort : '종일')
          : isMultiDay
            ? sShort + (startTimePart ? ' ' + startTimePart : '') + ' – ' + eShort + (endTimePart ? ' ' + endTimePart : '')
            : (startTimePart + (endTimePart && startTimePart !== endTimePart ? ' – ' + endTimePart : ''));
        cardTimeEl.textContent = cardTimeText;
        if (svgEl) cardTimeEl.insertBefore(svgEl, cardTimeEl.firstChild);
      }

      /* 참여자 업데이트 */
      var selectedMembers = document.querySelectorAll('.member-select__item.is-selected');
      var membersEl = currentScheduleCard.querySelector('.schedule-card__members');
      if (membersEl) {
        membersEl.innerHTML = '';
        selectedMembers.forEach(function(item) {
          var av = document.createElement('div');
          av.className = 'schedule-card__avatar';
          av.style.background = item.dataset.memberColor;
          av.dataset.memberColor = item.dataset.memberColor;
          av.textContent = item.dataset.memberInitial;
          membersEl.appendChild(av);
        });
      }

      /* 메모 업데이트 */
      currentScheduleCard.dataset.memo = memoInput ? memoInput.value.trim() : '';

      /* 상세 화면도 즉시 반영 */
      updateScheduleDetail(currentScheduleCard);
      var registerTitleEl = document.querySelector('[data-register-title]');
      if (registerTitleEl) registerTitleEl.textContent = '일정 등록';
      goTo('schedule-detail');
    } else {
      /* 신규 등록 모드: 카드 생성 후 목록으로 이동 */
      var newTitle = titleInput ? titleInput.value.trim() : '';
      if (!newTitle) { goTo('schedule-list'); return; }

      var DAYS_NEW  = ['일', '월', '화', '수', '목', '금', '토'];
      var ov2       = document.querySelector('[data-date-picker-overlay]');
      var startSt   = ov2 && ov2._pickerState ? ov2._pickerState.start : { year: 2026, month: 6, day: 20 };
      var alldayEl2 = document.querySelector('[data-allday-check]');
      var isAlldayN = alldayEl2 && alldayEl2.classList.contains('is-checked');

      /* 시간 텍스트 파싱 (다날짜 지원) */
      var sDisp2  = document.querySelector('[data-date-display="start"]');
      var eDisp2  = document.querySelector('[data-date-display="end"]');
      var sTxt2   = sDisp2 ? sDisp2.textContent.trim() : '';
      var eTxt2   = eDisp2 ? eDisp2.textContent.trim() : '';
      var dpat2   = /\d{4}년 \d+월 \d+일 \([가-힣]\)/;
      var sm2     = sTxt2.match(dpat2);
      var em2     = eTxt2.match(dpat2);
      var sDate2  = sm2 ? sm2[0] : sTxt2;
      var eDate2  = em2 ? em2[0] : '';
      var sTime2  = sm2 ? sTxt2.replace(sDate2, '').trim() : '';
      var eTime2  = em2 ? eTxt2.replace(eDate2, '').trim() : '';
      var isMultiDayN = eDate2 && eDate2 !== sDate2;
      var sShortN = (sDate2.match(/\d+월 \d+일/) || [''])[0];
      var eShortN = (eDate2.match(/\d+월 \d+일/) || [''])[0];

      /* 카드 리스트용 시간 레이블 */
      var timeLbl = '';
      if (isAlldayN) {
        timeLbl = isMultiDayN ? sShortN + ' – ' + eShortN : '종일';
      } else if (isMultiDayN) {
        timeLbl = sShortN + (sTime2 ? ' ' + sTime2 : '') + ' – ' + eShortN + (eTime2 ? ' ' + eTime2 : '');
      } else {
        timeLbl = sTime2 && eTime2 && sTime2 !== eTime2 ? sTime2 + ' – ' + eTime2 : sTime2;
      }

      /* 상세 화면용 날짜+시간 텍스트 */
      var tDispTxt = '';
      if (isAlldayN) {
        tDispTxt = isMultiDayN ? sDate2 + ' – ' + eDate2 + '<br>종일' : sDate2 + '<br>종일';
      } else if (isMultiDayN) {
        tDispTxt = sDate2 + (sTime2 ? ' ' + sTime2 : '') + ' – ' + eDate2 + (eTime2 ? ' ' + eTime2 : '');
      } else {
        tDispTxt = sDate2 + (timeLbl ? '<br>' + timeLbl : '');
      }

      /* 분류 색상 */
      var selCatN   = document.querySelector('.category-chip.is-selected');
      var catNmN    = selCatN ? selCatN.textContent.trim() : '기타';
      var catColN   = CATEGORY_COLORS[catNmN] || { bg: '#f4f5f6', color: '#6d7882' };

      /* 저녁·메모·참여자 */
      var dinValN   = selectedDin ? (selectedDin.dataset.dinnerVal || 'none') : 'none';
      var memoValN  = memoInput ? memoInput.value.trim() : '';
      var selMembN  = document.querySelectorAll('.member-select__item.is-selected');

      /* 카드 DOM 생성 */
      var nCard = document.createElement('article');
      nCard.className = 'schedule-card';
      nCard.setAttribute('data-go', 'schedule-detail');
      nCard.setAttribute('data-schedule-type', 'mine');
      nCard.dataset.title = newTitle; nCard.dataset.dinner = dinValN; nCard.dataset.memo = memoValN;
      nCard.dataset.author = '엄마'; nCard.dataset.authorInitial = '엄'; nCard.dataset.authorColor = '#f97316';
      nCard.dataset.regDate = startSt.month + '월 ' + startSt.day + '일';
      nCard.dataset.category = catNmN; nCard.dataset.timeText = tDispTxt;

      var nBar = document.createElement('div');
      nBar.className = 'schedule-card__bar'; nBar.style.background = catColN.color;
      nCard.appendChild(nBar);

      var nBody = document.createElement('div'); nBody.className = 'schedule-card__body';
      var nTop  = document.createElement('div'); nTop.className  = 'schedule-card__top';
      var nTitleDiv = document.createElement('div'); nTitleDiv.className = 'schedule-card__title'; nTitleDiv.textContent = newTitle;
      var nTag = document.createElement('div'); nTag.className = 'schedule-card__tag';
      nTag.style.background = catColN.bg; nTag.style.color = catColN.color; nTag.textContent = catNmN;
      nTop.appendChild(nTitleDiv); nTop.appendChild(nTag); nBody.appendChild(nTop);

      var nMeta = document.createElement('div'); nMeta.className = 'schedule-card__meta';
      var nTime = document.createElement('div'); nTime.className = 'schedule-card__time';
      nTime.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + (timeLbl || '종일');
      nMeta.appendChild(nTime); nBody.appendChild(nMeta);

      var nMembers = document.createElement('div'); nMembers.className = 'schedule-card__members';
      selMembN.forEach(function(item) {
        var av = document.createElement('div'); av.className = 'schedule-card__avatar';
        av.style.background = item.dataset.memberColor; av.dataset.memberColor = item.dataset.memberColor;
        av.textContent = item.dataset.memberInitial; nMembers.appendChild(av);
      });
      nBody.appendChild(nMembers);

      if (dinValN !== 'none') {
        var nDin = document.createElement('div'); nDin.className = 'schedule-card__dinner';
        if (dinValN === 'possible') {
          nDin.style.color = '#10b981';
          nDin.innerHTML = '<svg viewBox="0 0 24 24" stroke="#10b981"><polyline points="20 6 9 17 4 12"/></svg>저녁 가능';
        } else {
          nDin.style.color = '#E52E2E';
          nDin.innerHTML = '<svg viewBox="0 0 24 24" stroke="#E52E2E"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>저녁 불가능';
        }
        nBody.appendChild(nDin);
      }
      nCard.appendChild(nBody);

      /* 날짜 그룹 찾기 또는 생성 */
      var pad2   = function(n) { return n < 10 ? '0' + n : '' + n; };
      var dKey   = startSt.year + '-' + pad2(startSt.month) + '-' + pad2(startSt.day);
      var sArea  = document.querySelector('[data-screen-wrap="schedule-list"] .scroll-area');
      var nGroup = sArea.querySelector('[data-date="' + dKey + '"]');

      if (!nGroup) {
        nGroup = document.createElement('section');
        nGroup.className = 'date-group'; nGroup.dataset.date = dKey;
        var nGH = document.createElement('div'); nGH.className = 'date-group__header';
        var nGDate = document.createElement('span'); nGDate.className = 'date-group__date';
        nGDate.textContent = startSt.month + '월 ' + startSt.day + '일';
        var nGDay = document.createElement('span'); nGDay.className = 'date-group__day';
        nGDay.textContent = DAYS_NEW[(new Date(startSt.year, startSt.month - 1, startSt.day)).getDay()];
        var nGLine = document.createElement('div'); nGLine.className = 'date-group__line';
        nGH.appendChild(nGDate); nGH.appendChild(nGDay); nGH.appendChild(nGLine); nGroup.appendChild(nGH);

        /* 날짜 오름차순 삽입 위치 탐색 */
        var allGrps = sArea.querySelectorAll('.date-group[data-date]');
        var insPos  = null;
        for (var gi = 0; gi < allGrps.length; gi++) {
          if (allGrps[gi].dataset.date > dKey) { insPos = allGrps[gi]; break; }
        }
        sArea.insertBefore(nGroup, insPos || sArea.querySelector('[data-empty-month]') || null);
      }

      nGroup.appendChild(nCard);

      /* 폼 초기화 */
      if (titleInput) titleInput.value = '';
      if (memoInput)  memoInput.value  = '';

      /* 해당 월 재렌더 */
      var scr2 = document.querySelector('[data-screen-wrap="schedule-list"]');
      if (scr2 && scr2._renderMonth) scr2._renderMonth(startSt.year, startSt.month);

      var regTitle2 = document.querySelector('[data-register-title]');
      if (regTitle2) regTitle2.textContent = '일정 등록';
      goTo('schedule-list');
    }
  });

  /* ══════════════════════════════════════════
     03 일정 — 등록 화면 닫기(X): 수정 모드면 상세로, 아니면 목록으로
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-schedule-register-back]');
    if (!btn) return;
    var registerTitleEl = document.querySelector('[data-register-title]');
    if (registerTitleEl) registerTitleEl.textContent = '일정 등록';
    goTo(currentScheduleCard ? 'schedule-detail' : 'schedule-list');
  });

  /* ══════════════════════════════════════════
     03 일정 — 삭제 버튼 → 확인 바텀시트
  ══════════════════════════════════════════ */
  var confirmOverlay = document.querySelector('[data-confirm-overlay]');
  if (confirmOverlay) {
    var confirmOkBtn     = confirmOverlay.querySelector('[data-confirm-ok]');
    var confirmCancelBtn = confirmOverlay.querySelector('[data-confirm-cancel]');

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-schedule-delete]');
      if (!btn) return;
      confirmOverlay.classList.add('is-open');
    });

    if (confirmOkBtn) {
      confirmOkBtn.addEventListener('click', function() {
        if (currentScheduleCard) {
          currentScheduleCard.remove();
          currentScheduleCard = null;
        }
        confirmOverlay.classList.remove('is-open');
        goTo('schedule-list');
      });
    }

    if (confirmCancelBtn) {
      confirmCancelBtn.addEventListener('click', function() {
        confirmOverlay.classList.remove('is-open');
      });
    }

    /* 배경 클릭으로 닫기 */
    confirmOverlay.addEventListener('click', function(e) {
      if (e.target === confirmOverlay) confirmOverlay.classList.remove('is-open');
    });
  }

  /* ══════════════════════════════════════════
     03 일정 — 월 네비게이터
     - data-date="YYYY-MM-DD" 속성을 가진 date-group을 선택된 월 기준으로 필터링
     - 오늘 기준 구분선 동적 삽입
     - 지난 날짜 그룹에 date-group--past 클래스 적용
  ══════════════════════════════════════════ */
  (function() {
    var listScreen = document.querySelector('[data-screen-wrap="schedule-list"]');
    if (!listScreen) return;

    var monthLabel = listScreen.querySelector('[data-month-label]');
    var prevBtn    = listScreen.querySelector('[data-month-prev]');
    var nextBtn    = listScreen.querySelector('[data-month-next]');
    var scrollArea = listScreen.querySelector('.scroll-area');
    var emptyEl    = listScreen.querySelector('[data-empty-month]');

    /* 목업 기준 오늘 고정 */
    var TODAY_Y = 2026, TODAY_M = 6, TODAY_D = 19;
    var curYear = TODAY_Y, curMonth = TODAY_M;

    function getDate(group) {
      var p = group.dataset.date.split('-');
      return { y: +p[0], m: +p[1], d: +p[2] };
    }

    function isPast(dt) {
      if (dt.y !== TODAY_Y || dt.m !== TODAY_M) return dt.y < TODAY_Y || (dt.y === TODAY_Y && dt.m < TODAY_M);
      return dt.d < TODAY_D;
    }

    function reapplyFilter() {
      var activeTab = listScreen.querySelector('.filter-tab.is-active');
      var filter = activeTab ? (activeTab.dataset.filter || 'all') : 'all';
      listScreen.querySelectorAll('.schedule-card[data-schedule-type]').forEach(function(card) {
        var group = card.closest('.date-group');
        if (group && group.dataset.monthHidden) return;
        var type = card.dataset.scheduleType;
        card.style.display = (filter === 'all' || type === filter) ? 'flex' : 'none';
      });
      listScreen.querySelectorAll('.date-group').forEach(function(group) {
        if (group.dataset.monthHidden) return;
        var visible = Array.prototype.some.call(
          group.querySelectorAll('.schedule-card'),
          function(c) { return c.style.display !== 'none'; }
        );
        group.style.display = visible ? '' : 'none';
      });
    }

    function renderMonth(year, month) {
      curYear = year; curMonth = month;
      if (monthLabel) monthLabel.textContent = year + '년 ' + month + '월';

      var old = scrollArea.querySelector('.today-divider');
      if (old) old.remove();

      var allGroups = scrollArea.querySelectorAll('.date-group[data-date]');
      var visibleGroups = [];

      allGroups.forEach(function(group) {
        var dt = getDate(group);
        var inMonth = dt.y === year && dt.m === month;
        if (inMonth) {
          delete group.dataset.monthHidden;
          group.style.display = '';
          group.classList.toggle('date-group--past', isPast(dt));
          visibleGroups.push(group);
        } else {
          group.dataset.monthHidden = '1';
          group.style.display = 'none';
          group.classList.remove('date-group--past');
        }
      });

      /* 이번 달이면 오늘 구분선 삽입 */
      if (year === TODAY_Y && month === TODAY_M) {
        var insertBefore = null;
        for (var i = 0; i < visibleGroups.length; i++) {
          if (!isPast(getDate(visibleGroups[i]))) { insertBefore = visibleGroups[i]; break; }
        }
        var hasPast = visibleGroups.some(function(g) { return isPast(getDate(g)); });
        if (hasPast && insertBefore) {
          var dividerEl = document.createElement('div');
          dividerEl.className = 'today-divider';
          dividerEl.innerHTML = '<span class="today-divider__line"></span><span class="today-divider__label">오늘</span><span class="today-divider__line"></span>';
          scrollArea.insertBefore(dividerEl, insertBefore);
        }
      }

      if (emptyEl) emptyEl.style.display = visibleGroups.length > 0 ? 'none' : 'flex';
      reapplyFilter();

      /* 오늘 또는 가장 가까운 미래 일정으로 스크롤 */
      setTimeout(function() {
        if (year === TODAY_Y && month === TODAY_M) {
          var target = null;
          for (var j = 0; j < visibleGroups.length; j++) {
            if (visibleGroups[j].style.display === 'none') continue;
            if (!isPast(getDate(visibleGroups[j]))) { target = visibleGroups[j]; break; }
          }
          if (target) {
            var ctop = scrollArea.getBoundingClientRect().top;
            var ttop = target.getBoundingClientRect().top;
            scrollArea.scrollTop += (ttop - ctop) - 20;
          }
        } else {
          scrollArea.scrollTop = 0;
        }
      }, 30);
    }

    if (prevBtn) prevBtn.addEventListener('click', function() {
      var m = curMonth - 1, y = curYear;
      if (m < 1) { m = 12; y--; }
      renderMonth(y, m);
    });

    if (nextBtn) nextBtn.addEventListener('click', function() {
      var m = curMonth + 1, y = curYear;
      if (m > 12) { m = 1; y++; }
      renderMonth(y, m);
    });

    listScreen._renderMonth = renderMonth;
    renderMonth(TODAY_Y, TODAY_M);
  })();

  /* ══════════════════════════════════════════
     02 홈 — 그룹 전환 아이템 클릭 → 헤더 업데이트 + 시트 닫기
  ══════════════════════════════════════════ */
  (function() {
    var sheet = document.querySelector('[data-sheet]');
    if (!sheet) return;
    var hEmoji = document.querySelector('.header__group-emoji');
    var hName  = document.querySelector('.header__group-name');
    var hSub   = document.querySelector('.header__group-sub');

    document.addEventListener('click', function(e) {
      var item = e.target.closest('.group-item');
      if (!item || !sheet.contains(item)) return;

      /* 체크 아이콘 갱신 */
      sheet.querySelectorAll('.group-item').forEach(function(g) {
        var svg = g.querySelector('.group-item__check svg');
        if (svg) svg.classList.toggle('hidden', g !== item);
      });

      /* 헤더 텍스트 갱신 */
      var emojiEl = item.querySelector('.group-item__emoji');
      var nameEl  = item.querySelector('.group-item__name');
      var metaEl  = item.querySelector('.group-item__meta');
      if (hEmoji && emojiEl) hEmoji.textContent = emojiEl.textContent;
      if (hName && nameEl) {
        var arrowSvg = hName.querySelector('svg');
        hName.textContent = nameEl.textContent + ' ';
        if (arrowSvg) hName.appendChild(arrowSvg);
      }
      if (hSub && metaEl) hSub.textContent = metaEl.textContent;

      sheet.classList.remove('is-open');
    });
  })();

  /* ══════════════════════════════════════════
     05 알림장 — 탭 진입 시 홈 헤더 배지 숨김
  ══════════════════════════════════════════ */
  window._tabReset = window._tabReset || {};
  window._tabReset.activity = function () {
    var homeBadge = document.querySelector('[data-tab-screen="home"] .header__badge');
    if (homeBadge) homeBadge.style.display = 'none';
  };

  /* ══════════════════════════════════════════
     05 알림장 — 탭 이탈 시 새 알림 → 이전 알림으로 이동
  ══════════════════════════════════════════ */
  window._tabLeave = window._tabLeave || {};
  window._tabLeave.activity = function () {
    var newSec = document.querySelector('[data-activity-section="new"]');
    var oldSec = document.querySelector('[data-activity-section="old"]');
    if (!newSec || !oldSec) return;

    var newItems = Array.from(newSec.querySelectorAll('[data-log-item]'));
    if (!newItems.length) return;

    /* DOM 이동 전 클라이언트 캐시 등록 — Firestore 스냅샷 race condition 방지 */
    var ids = newItems.map(function(item) { return item.dataset.activityId; }).filter(Boolean);
    if (ids.length && window._addConfirmedActivityIds) window._addConfirmedActivityIds(ids);

    /* 오늘 날짜 divider 생성 후 이전 알림 섹션 상단에 삽입 */
    var now = new Date();
    var days = ['일','월','화','수','목','금','토'];
    var todayLabel = '오늘 · ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 ' + days[now.getDay()] + '요일';
    var todayDiv = document.createElement('div');
    todayDiv.className = 'day-divider';
    todayDiv.innerHTML = '<div class="day-divider__label">' + todayLabel + '</div><div class="day-divider__line"></div>';

    var oldHeader = oldSec.querySelector('.activity-section__header');
    var insertRef = oldHeader ? oldHeader.nextSibling : null;
    oldSec.insertBefore(todayDiv, insertRef);

    /* 새 알림 항목들을 오늘 divider 바로 다음에 순서대로 삽입 */
    var afterDivider = todayDiv.nextSibling;
    newItems.forEach(function (item) {
      oldSec.insertBefore(item, afterDivider);
    });

    /* 이전 알림 섹션 마지막 항목 line 정리 */
    var allOldItems = oldSec.querySelectorAll('[data-log-item]');
    allOldItems.forEach(function (item, i) {
      var line = item.querySelector('.log-item__line');
      if (!line) return;
      line.style.display = i === allOldItems.length - 1 ? 'none' : '';
    });

    /* 새 알림 섹션 초기화 */
    var countEl = newSec.querySelector('[data-new-count]');
    if (countEl) { countEl.textContent = '0'; countEl.style.display = 'none'; }
    var emptyEl = newSec.querySelector('[data-new-empty]');
    if (emptyEl) emptyEl.style.display = '';

    /* Firestore: 이동된 항목 readAt·expiresAt 기록 */
    if (typeof window.confirmActivities === 'function' && window._currentGroup) {
      if (ids.length) window.confirmActivities(window._currentGroup.id, ids);
    }
  };

  /* ══════════════════════════════════════════
     05 알림장 — 필터 바텀시트
  ══════════════════════════════════════════ */
  (function () {
    var activityScreen = document.querySelector('[data-screen-wrap="activity-log"]');
    if (!activityScreen) return;

    var filterBtn     = activityScreen.querySelector('[data-activity-filter-btn]');
    var filterOverlay = activityScreen.querySelector('[data-activity-filter-overlay]');
    if (!filterBtn || !filterOverlay) return;

    function _getMemberItems() { return filterOverlay.querySelectorAll('[data-activity-filter-member]'); }
    var typeItems    = filterOverlay.querySelectorAll('[data-activity-filter-type]');
    var applyBtn     = filterOverlay.querySelector('[data-activity-filter-apply]');
    var resetBtn     = filterOverlay.querySelector('[data-activity-filter-reset]');
    var activeMember = 'all';
    var activeType   = 'all';

    function applyFilter(member, type) {
      activeMember = member;
      activeType   = type;

      activityScreen.querySelectorAll('[data-log-item]').forEach(function (item) {
        var matchMember = member === 'all' || item.dataset.actor === member;
        var matchType   = type   === 'all' || item.dataset.logType === type;
        item.style.display = (matchMember && matchType) ? '' : 'none';
      });

      /* 이전 알림 섹션의 day-divider 정리 */
      var oldSec = activityScreen.querySelector('[data-activity-section="old"]');
      if (oldSec) {
        oldSec.querySelectorAll('.day-divider').forEach(function (div) {
          var sibling = div.nextElementSibling;
          var hasVisible = false;
          while (sibling && !sibling.classList.contains('day-divider')) {
            if (sibling.hasAttribute('data-log-item') && sibling.style.display !== 'none') hasVisible = true;
            sibling = sibling.nextElementSibling;
          }
          div.style.display = hasVisible ? '' : 'none';
        });
      }

      /* 새 알림 섹션 count·empty 업데이트 */
      var newSec = activityScreen.querySelector('[data-activity-section="new"]');
      if (newSec) {
        var visibleNew = Array.from(newSec.querySelectorAll('[data-log-item]')).filter(function(i){ return i.style.display !== 'none'; });
        var countEl = newSec.querySelector('[data-new-count]');
        var emptyEl = newSec.querySelector('[data-new-empty]');
        if (countEl) { countEl.textContent = visibleNew.length; countEl.style.display = visibleNew.length ? '' : 'none'; }
        if (emptyEl) emptyEl.style.display = visibleNew.length ? 'none' : '';
      }

      filterBtn.classList.toggle('is-filtered', member !== 'all' || type !== 'all');
    }

    filterBtn.addEventListener('click', function () {
      _getMemberItems().forEach(function (i) {
        i.classList.toggle('is-selected', i.dataset.activityFilterMember === activeMember);
      });
      typeItems.forEach(function (i) {
        i.classList.toggle('is-selected', i.dataset.activityFilterType === activeType);
      });
      filterOverlay.classList.add('is-open');
    });

    filterOverlay.addEventListener('click', function (e) {
      if (e.target === filterOverlay) { filterOverlay.classList.remove('is-open'); return; }
      /* 멤버 아이템 클릭 — 이벤트 위임 (동적 추가 버튼 포함) */
      var memberBtn = e.target.closest('[data-activity-filter-member]');
      if (memberBtn) {
        _getMemberItems().forEach(function (i) { i.classList.remove('is-selected'); });
        memberBtn.classList.add('is-selected');
      }
    });

    typeItems.forEach(function (item) {
      item.addEventListener('click', function () {
        typeItems.forEach(function (i) { i.classList.remove('is-selected'); });
        item.classList.add('is-selected');
      });
    });

    applyBtn && applyBtn.addEventListener('click', function () {
      var selMember = filterOverlay.querySelector('[data-activity-filter-member].is-selected');
      var selType   = filterOverlay.querySelector('[data-activity-filter-type].is-selected');
      applyFilter(
        selMember ? selMember.dataset.activityFilterMember : 'all',
        selType   ? selType.dataset.activityFilterType     : 'all'
      );
      filterOverlay.classList.remove('is-open');
    });

    resetBtn && resetBtn.addEventListener('click', function () {
      _getMemberItems().forEach(function (i) {
        i.classList.toggle('is-selected', i.dataset.activityFilterMember === 'all');
      });
      typeItems.forEach(function (i) {
        i.classList.toggle('is-selected', i.dataset.activityFilterType === 'all');
      });
    });
  }());


  /* ══════════════════════════════════════════
     06 내정보 — 토글 스위치 클릭
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var toggle = e.target.closest('.menu-item__toggle');
    if (!toggle) return;
    toggle.classList.toggle('is-off');
    var isOn = !toggle.classList.contains('is-off');
    if (isOn) {
      if (typeof window._registerPush   === 'function') window._registerPush();
    } else {
      if (typeof window._unregisterPush === 'function') window._unregisterPush();
    }
  });

  /* ══════════════════════════════════════════
     01 인증 — data-tab-link: 로그인 ↔ 회원가입 링크
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var link = e.target.closest('[data-tab-link]');
    if (!link) return;
    e.preventDefault();
    var tab = document.querySelector('[data-tab="' + link.dataset.tabLink + '"]');
    if (tab) tab.click();
  });

  /* ══════════════════════════════════════════
     공통 — 초대 코드 복사 버튼
  ══════════════════════════════════════════ */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-copy-code]');
    if (!btn) return;
    var code = btn.dataset.copyCode;
    if (navigator.clipboard && code) {
      navigator.clipboard.writeText(code).then(function() {
        var origHtml = btn.innerHTML;
        btn.innerHTML = '복사됨!';
        setTimeout(function() { btn.innerHTML = origHtml; }, 1500);
      });
    }
  });

  /* ══════════════════════════════════════════
     01 인증 — 회원가입 비밀번호 확인 실시간 검사
  ══════════════════════════════════════════ */
  (function() {
    var pwInput      = document.getElementById('signup-pw');
    var confirmInput = document.getElementById('signup-pw-confirm');
    if (!pwInput || !confirmInput) return;
    var errorEl = confirmInput.closest('.form-group').querySelector('.form-error');
    function checkMatch() {
      if (!confirmInput.value) { errorEl && errorEl.classList.remove('is-visible'); return; }
      var mismatch = pwInput.value !== confirmInput.value;
      errorEl && errorEl.classList.toggle('is-visible', mismatch);
      confirmInput.classList.toggle('is-error', mismatch);
    }
    pwInput.addEventListener('input', checkMatch);
    confirmInput.addEventListener('input', checkMatch);
  })();

  /* ══════════════════════════════════════════
     06 내정보 — 프로필 편집 바텀시트
     편집 가능 항목: 아바타 색상 / 표시 이름 / 상태 메시지
     (이름을 다른 사람으로 바꾸는 게 아니라 내 프로필 커스터마이즈)
  ══════════════════════════════════════════ */
  /* 이미지 → Canvas center-crop → JPEG base64 압축 */
  function _compressAvatar(file, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var SIZE = 200;
        var canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        var ctx = canvas.getContext('2d');
        var sq = Math.min(img.width, img.height);
        var ox = (img.width  - sq) / 2;
        var oy = (img.height - sq) / 2;
        ctx.drawImage(img, ox, oy, sq, sq, 0, 0, SIZE, SIZE);
        cb(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  (function() {
    var overlay     = document.querySelector('[data-profile-edit-sheet]');
    if (!overlay) return;

    var editAvatar  = overlay.querySelector('[data-edit-avatar]');
    var nameInput   = overlay.querySelector('[data-profile-name-input]');
    var statusInput = overlay.querySelector('[data-profile-status-input]');
    var colorChips  = overlay.querySelectorAll('.profile-color-chip');
    var saveBtn     = overlay.querySelector('[data-profile-edit-save]');
    var fileInput   = overlay.querySelector('[data-avatar-file-input]');
    var removeBtn   = overlay.querySelector('[data-avatar-remove]');
    var selectedColor = '#4f7cff';
    /* null=변경없음 / ''=삭제 / 'data:...'=새사진 */
    window._pendingPhotoURL = null;

    function getHeroInitial(name) {
      return (name || '').trim().charAt(0) || '나';
    }

    function _setEditAvatar(photoURL, initial, color) {
      if (!editAvatar) return;
      var span = editAvatar.querySelector('[data-avatar-initial]');
      if (photoURL) {
        editAvatar.style.background = 'url(' + photoURL + ') center/cover no-repeat';
        if (span) span.style.display = 'none';
      } else {
        editAvatar.style.background = color || selectedColor;
        if (span) { span.style.display = ''; span.textContent = initial || '나'; }
      }
    }

    function openEditSheet() {
      var curName   = (document.querySelector('[data-my-name]') || {}).textContent || '';
      var curStatus = (document.querySelector('[data-my-status]') || {}).textContent || '';
      /* photoURL은 _myProfile에서 읽음 (색상은 style.background가 아닌 _myProfile에서) */
      var profile = window._myProfile || {};
      selectedColor = profile.color || '#4f7cff';
      var existingPhoto = profile.photoURL || '';

      if (nameInput)   nameInput.value   = curName.trim();
      if (statusInput) statusInput.value = curStatus.trim();

      /* 컬러 칩 동기화 */
      colorChips.forEach(function(chip) {
        chip.classList.toggle('is-selected', chip.dataset.color === selectedColor);
      });

      /* 프리뷰 아바타 초기화 */
      window._pendingPhotoURL = null;
      if (fileInput) fileInput.value = '';
      _setEditAvatar(existingPhoto, getHeroInitial(curName), selectedColor);
      if (removeBtn) removeBtn.style.display = existingPhoto ? '' : 'none';

      overlay.classList.add('is-open');
      if (nameInput) nameInput.focus();
    }

    /* 파일 선택 → 압축 → 프리뷰 */
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        var file = fileInput.files[0];
        if (!file) return;
        _compressAvatar(file, function(dataURL) {
          window._pendingPhotoURL = dataURL;
          _setEditAvatar(dataURL);
          if (removeBtn) removeBtn.style.display = '';
        });
      });
    }

    /* 사진 삭제 */
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        window._pendingPhotoURL = '';
        var curName = nameInput ? nameInput.value.trim() : '';
        _setEditAvatar('', getHeroInitial(curName), selectedColor);
        removeBtn.style.display = 'none';
        if (fileInput) fileInput.value = '';
      });
    }

    /* 컬러 칩 클릭 → 프리뷰 색 업데이트 (사진 없을 때만 배경색 변경) */
    colorChips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        colorChips.forEach(function(c) { c.classList.remove('is-selected'); });
        chip.classList.add('is-selected');
        selectedColor = chip.dataset.color;
        var hasPending = window._pendingPhotoURL || (window._myProfile && window._myProfile.photoURL && window._pendingPhotoURL !== '');
        if (!hasPending) {
          var span = editAvatar ? editAvatar.querySelector('[data-avatar-initial]') : null;
          if (editAvatar) editAvatar.style.background = selectedColor;
        }
      });
    });

    /* 이름 입력 → 이니셜 실시간 업데이트 (사진 없을 때만) */
    if (nameInput && editAvatar) {
      nameInput.addEventListener('input', function() {
        var hasPhoto = window._pendingPhotoURL || (window._myProfile && window._myProfile.photoURL && window._pendingPhotoURL !== '');
        if (!hasPhoto) {
          var span = editAvatar.querySelector('[data-avatar-initial]');
          if (span) span.textContent = getHeroInitial(nameInput.value);
        }
      });
    }

    /* 저장 버튼 클릭 → DOM 반영 */
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var newName   = nameInput   ? nameInput.value.trim()   : '';
        var newStatus = statusInput ? statusInput.value.trim() : '';
        var newPhoto  = window._pendingPhotoURL; /* null=변경없음 / ''=삭제 / dataURL=신규 */
        var finalPhoto = newPhoto !== null ? newPhoto : (window._myProfile && window._myProfile.photoURL || '');

        var heroAvatar = document.querySelector('[data-my-avatar]');
        var heroName   = document.querySelector('[data-my-name]');
        var heroStatus = document.querySelector('[data-my-status]');
        var memAvatar  = document.querySelector('[data-my-member-avatar]');
        var memName    = document.querySelector('[data-my-member-name]');
        var memStatus  = document.querySelector('[data-my-member-status]');

        /* 히어로 아바타 업데이트 */
        if (heroAvatar) {
          var heroSpan = heroAvatar.querySelector('[data-avatar-initial]');
          if (finalPhoto) {
            heroAvatar.style.background = 'url(' + finalPhoto + ') center/cover no-repeat';
            if (heroSpan) heroSpan.style.display = 'none';
          } else {
            heroAvatar.style.background = selectedColor;
            if (heroSpan) {
              heroSpan.style.display = '';
              heroSpan.textContent = newName ? getHeroInitial(newName) : getHeroInitial((heroName || {}).textContent || '');
            }
          }
        }

        /* 멤버 아바타 + 탭바 내정보 아이콘 */
        if (memAvatar) {
          if (finalPhoto) {
            memAvatar.style.background = 'url(' + finalPhoto + ') center/cover no-repeat';
            memAvatar.textContent = '';
          } else {
            memAvatar.style.background = selectedColor;
            var curInitial = newName ? getHeroInitial(newName) : (memAvatar.textContent || '');
            if (curInitial) memAvatar.textContent = curInitial;
          }
        }
        if (typeof window._applyTabAvatar === 'function') window._applyTabAvatar(finalPhoto);

        if (newName) {
          if (heroName) heroName.textContent = newName;
          if (memName)  memName.innerHTML = newName + ' <span style="font-size:11px;color:#888;font-weight:400;">(나)</span>';
        }
        if (newStatus) {
          if (heroStatus) heroStatus.textContent = newStatus;
          if (memStatus)  memStatus.textContent  = newStatus;
        }

        if (window._myProfile) {
          if (newPhoto !== null) window._myProfile.photoURL = newPhoto;
          if (newName) window._myProfile.displayName = newName;
          window._myProfile.color = selectedColor;
        }
        if (typeof window._sweepMyAvatars === 'function') window._sweepMyAvatars();
        /* document 위임 핸들러(app.html)보다 먼저 실행되므로, 사진 변경을 여기서 직접 Firestore에 저장 */
        if (newPhoto !== null && typeof IS_FIREBASE_READY !== 'undefined' && IS_FIREBASE_READY && typeof window.updateMyProfile === 'function') {
          window.updateMyProfile({ photoURL: newPhoto });
        }
        window._pendingPhotoURL = null;
        overlay.classList.remove('is-open');
      });
    }

    /* 오버레이 배경 클릭 → 닫기 */
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('is-open');
    });

    /* 편집 버튼/뱃지 클릭 위임 */
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-open-profile-edit]')) openEditSheet();
    });
  })();

  /* ══════════════════════════════════════════
     공통 — Escape 키로 열린 오버레이/시트 닫기
  ══════════════════════════════════════════ */
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    /* 우선순위: 날짜픽커 > 확인 오버레이 > 할일 더보기 > 필터시트 > 추가시트 > 그룹시트 */
    var dpOverlay  = document.querySelector('[data-date-picker-overlay].is-open');
    var confOverlay = document.querySelector('[data-confirm-overlay].is-open');
    var moreMenu   = document.querySelector('[data-todo-more-menu].is-open');
    var filterSh          = document.querySelector('[data-filter-sheet].is-open');
    var activityFilterSh  = document.querySelector('[data-activity-filter-overlay].is-open');
    var addSh             = document.querySelector('[data-add-sheet].is-open');
    var groupSh           = document.querySelector('[data-sheet].is-open');

    var profileEditSh = document.querySelector('[data-profile-edit-sheet].is-open');

    if (dpOverlay)           { dpOverlay.classList.remove('is-open'); }
    else if (confOverlay)    { confOverlay.classList.remove('is-open'); }
    else if (moreMenu)       { moreMenu.classList.remove('is-open'); }
    else if (filterSh)       { filterSh.classList.remove('is-open'); }
    else if (activityFilterSh) { activityFilterSh.classList.remove('is-open'); }
    else if (addSh)          { addSh.classList.remove('is-open'); }
    else if (groupSh)        { groupSh.classList.remove('is-open'); }
    else if (profileEditSh)  { profileEditSh.classList.remove('is-open'); }
  });

  /* ══════════════════════════════════════════
     공통 — focus-visible 폴리필 (키보드 탐색 지원)
  ══════════════════════════════════════════ */
  document.addEventListener('keydown', function() {
    document.body.classList.add('keyboard-nav');
  });
  document.addEventListener('mousedown', function() {
    document.body.classList.remove('keyboard-nav');
  });

});
