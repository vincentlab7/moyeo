/* ═══════════════════════════════════════════════════════════
   db.js — Firestore CRUD + 실시간 리스너
   ═══════════════════════════════════════════════════════════ */

if (!IS_FIREBASE_READY) {
  /* Firebase 미설정 → 모든 함수를 noop/빈 반환으로 */
  ['addSchedule','updateSchedule','deleteSchedule','onSchedules',
   'addTodo','updateTodo','deleteTodo','onTodos',
   'onMembers','onActivities','confirmActivities','toggleReaction','updateMyProfile','onUserGroups',
   'updateGroup','kickMember','deleteGroup','notifyGroup'].forEach(fn => {
    window[fn] = () => Promise.resolve();
  });
} else {

  /* ── 공통 헬퍼 ── */
  function uid()      { return auth.currentUser?.uid || ''; }
  function myName()   { return window._myProfile?.displayName || '사용자'; }
  function groupId()  { return window._currentGroup?.id || ''; }
  function serverTs() { return firebase.firestore.FieldValue.serverTimestamp(); }

  function logActivity(gId, type, content, targetId) {
    if (!gId || !uid()) return;
    db.collection('groups').doc(gId).collection('activities').add({
      type, content, targetId: targetId || '',
      actorId:    uid(),
      actorName:  myName(),
      actorColor: window._myProfile?.color || '#8B95A1',
      createdAt:  serverTs(),
      readBy:     {},     // { uid: Timestamp } — 계정별 독립 읽음 상태
      expiresAt:  null,   // confirmActivities 호출 시 30일 TTL 설정
    });
  }

  /* ═════════ 일정 ═════════ */
  window.addSchedule = (gId, data) =>
    db.collection('groups').doc(gId).collection('schedules').add({
      ...data,
      authorId:      uid(),
      authorName:    myName(),
      authorColor:   window._myProfile?.color  || '#4f7cff',
      authorInitial: myName().charAt(0),
      createdAt:     serverTs(),
      updatedAt:     serverTs(),
    }).then(ref => {
      if (!data.isPrivate) {
        logActivity(gId, 'schedule_create', `새 일정을 등록했어요 — ${data.title}`, ref.id);
        window.notifyGroup(gId, '📅 새 일정 등록', `${myName()}님이 "${data.title}" 일정을 추가했어요`);
      }
      console.log('[GCal] addSchedule .then() 진입, _gcalCreate type:', typeof window._gcalCreate);
      try { window._gcalCreate(ref.id, data); } catch(e) { console.error('[GCal] _gcalCreate 호출 오류:', e); }
      return ref;
    });

  window.updateSchedule = (gId, sid, data) =>
    db.collection('groups').doc(gId).collection('schedules').doc(sid).update({
      ...data, updatedAt: serverTs(),
    }).then(() => {
      if (!data.isPrivate) logActivity(gId, 'schedule_update', `일정을 수정했어요 — ${data.title || ''}`, sid);
      try { window._gcalUpdate(sid, data); } catch(e) {}
    });

  window.deleteSchedule = (gId, sid, title) =>
    db.collection('groups').doc(gId).collection('schedules').doc(sid).delete()
      .then(() => {
        logActivity(gId, 'schedule_delete', `일정을 삭제했어요 — ${title || ''}`, sid);
        try { window._gcalDelete(sid); } catch(e) {}
      });

  window.onSchedules = (gId, cb) =>
    db.collection('groups').doc(gId).collection('schedules')
      .orderBy('startDate', 'asc')
      .onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

  /* ═════════ 할일 ═════════ */
  window.addTodo = (gId, data) =>
    db.collection('groups').doc(gId).collection('todos').add({
      ...data,
      createdBy: uid(),
      createdAt: serverTs(),
      updatedAt: serverTs(),
    }).then(ref => {
      if (data.type !== 'personal') {
        logActivity(gId, 'todo_create', `할일을 추가했어요 — ${data.title}`, ref.id);
        window.notifyGroup(gId, '✅ 새 할일 추가', `${myName()}님이 "${data.title}" 할일을 추가했어요`);
      }
      return ref;
    });

  window.updateTodo = (gId, tid, data, todoType) => {
    const updateFields = { ...data, updatedAt: serverTs() };
    if (data.status === 'done') {
      updateFields.completedBy = uid();
    } else if (data.status === 'pending' || data.status === 'doing') {
      updateFields.completedBy = null;
    }
    return db.collection('groups').doc(gId).collection('todos').doc(tid).update(updateFields)
      .then(() => {
        if (data.status === 'done' && todoType !== 'personal') {
          logActivity(gId, 'todo_done', `할일을 완료했어요 🎉`, tid);
          window.notifyGroup(gId, '🎉 할일 완료', `${myName()}님이 할일을 완료했어요!`);
        }
      });
  };

  window.deleteTodo = (gId, tid) =>
    db.collection('groups').doc(gId).collection('todos').doc(tid).delete();

  window.onTodos = (gId, cb) =>
    db.collection('groups').doc(gId).collection('todos')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

  /* ═════════ 멤버 ═════════ */
  window.onMembers = (gId, cb) =>
    db.collection('groups').doc(gId).collection('members')
      .onSnapshot(snap => cb(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));

  /* ═════════ 활동 ═════════ */
  /* Firestore TTL 설정 방법:
     Firebase 콘솔 → Firestore → TTL 정책 추가
     컬렉션 그룹: activities / TTL 필드: expiresAt */
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  window.onActivities = (gId, cb) =>
    db.collection('groups').doc(gId).collection('activities')
      .orderBy('createdAt', 'desc').limit(100)
      .onSnapshot(snap => {
        const now = Date.now();
        const currentUid = uid();
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => {
            const isReadByMe = currentUid && a.readBy && a.readBy[currentUid];
            if (!isReadByMe) return true; // 내가 미확인: 기간 무관 항상 표시
            const createdMs = a.createdAt?.toDate?.().getTime() || 0;
            return now - createdMs < THIRTY_DAYS_MS; // 내가 확인: 30일 이내만
          });
        cb(list);
      });

  /* 새 알림 → 이전 알림 확정: 계정별 readBy 기록 + 30일 TTL 설정 */
  window.confirmActivities = (gId, ids) => {
    if (!ids || !ids.length) return Promise.resolve();
    const myUid = uid();
    if (!myUid) return Promise.resolve();
    const expiresAt = firebase.firestore.Timestamp.fromDate(
      new Date(Date.now() + THIRTY_DAYS_MS)
    );
    const batch = db.batch();
    ids.forEach(id => {
      const ref = db.collection('groups').doc(gId).collection('activities').doc(id);
      batch.update(ref, { ['readBy.' + myUid]: serverTs(), expiresAt });
    });
    return batch.commit();
  };

  /* ═════════ 사용자 그룹 목록 ═════════ */
  window.onUserGroups = cb => {
    const u = auth.currentUser;
    if (!u) return () => {};
    return db.collection('users').doc(u.uid).onSnapshot(async snap => {
      const ids = snap.data()?.groups || [];
      if (!ids.length) { cb([]); return; }
      const docs = await Promise.all(ids.map(id => db.collection('groups').doc(id).get()));
      cb(docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() })));
    });
  };

  /* ═════════ 그룹 관리 (Owner only) ═════════ */
  window.updateGroup = (gId, data) =>
    db.collection('groups').doc(gId).update(data).then(() => {
      if (window._currentGroup && window._currentGroup.id === gId) Object.assign(window._currentGroup, data);
    });

  window.kickMember = async (gId, memberUid) => {
    await db.collection('groups').doc(gId).collection('members').doc(memberUid).delete();
    await db.collection('groups').doc(gId).update({ memberIds: firebase.firestore.FieldValue.arrayRemove(memberUid) });
    const userSnap = await db.collection('users').doc(memberUid).get();
    if (userSnap.exists) {
      const updates = { groups: firebase.firestore.FieldValue.arrayRemove(gId) };
      if ((userSnap.data().activeGroupId || '') === gId) updates.activeGroupId = '';
      await db.collection('users').doc(memberUid).update(updates);
    }
  };

  window.deleteGroup = async (gId, memberIds) => {
    const u = auth.currentUser;
    const batch = db.batch();
    (memberIds || []).forEach(uid =>
      batch.update(db.collection('users').doc(uid), { groups: firebase.firestore.FieldValue.arrayRemove(gId) })
    );
    batch.delete(db.collection('groups').doc(gId));
    await batch.commit();
    if (u) {
      const snap = await db.collection('users').doc(u.uid).get();
      const remaining = snap.data()?.groups || [];
      await db.collection('users').doc(u.uid).update({ activeGroupId: remaining[0] || '' });
    }
  };

  /* ═════════ 이모지 반응 ═════════ */
  window.toggleReaction = (gId, activityId, emoji, hasReacted) => {
    const myUid = uid();
    if (!myUid) return Promise.resolve();
    const val = hasReacted
      ? firebase.firestore.FieldValue.arrayRemove(myUid)
      : firebase.firestore.FieldValue.arrayUnion(myUid);
    return db.collection('groups').doc(gId).collection('activities').doc(activityId)
      .update({ ['reactions.' + emoji]: val })
      .catch(() => {});
  };

  /* ═════════ 그룹 푸시 알림 ═════════ */
  /* 서버가 Firestore에서 직접 토큰 조회 — 클라이언트 권한 문제 우회 */
  window.notifyGroup = function (gId, title, body) {
    const u = auth.currentUser;
    if (!u || !gId) return;
    fetch('/api/send-push', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ groupId: gId, senderUid: u.uid, title, body }),
    }).catch(() => {});
  };

  /* ═════════ 프로필 ═════════ */
  window.updateMyProfile = async data => {
    const u = auth.currentUser;
    if (!u) return;
    await db.collection('users').doc(u.uid).update(data);
    window._myProfile = { ...window._myProfile, ...data };
    const gId = groupId();
    if (!gId) return;
    const memberData = {};
    if (data.displayName)          memberData.displayName = data.displayName;
    if (data.color)                memberData.color       = data.color;
    if (data.status)               memberData.status      = data.status;
    if (data.photoURL !== undefined) memberData.photoURL  = data.photoURL;
    if (Object.keys(memberData).length > 0) {
      await db.collection('groups').doc(gId).collection('members').doc(u.uid).update(memberData);
    }
  };
}

/* ═══════════════════════════════════════════════════════════
   Google Calendar 단방향 동기화 (Firebase 독립)
   ═══════════════════════════════════════════════════════════ */
(function () {
  const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  function _token() {
    const expiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
    if (Date.now() > expiry) { localStorage.removeItem('gcal_access_token'); return null; }
    return localStorage.getItem('gcal_access_token');
  }

  function _toCalEvent(data) {
    const ev = { summary: data.title || '', description: data.memo || '' };

    /* Date 객체·Firestore Timestamp·문자열 → "YYYY-MM-DD" */
    function _isoDate(val) {
      if (!val) return '';
      if (val instanceof Date) {
        return val.getFullYear() + '-' +
          ('0' + (val.getMonth() + 1)).slice(-2) + '-' +
          ('0' + val.getDate()).slice(-2);
      }
      if (typeof val.toDate === 'function') return _isoDate(val.toDate());
      return String(val).slice(0, 10);
    }

    /* "오전 9:00" / "오후 3:30" → "09:00" / "15:30" */
    function _isoTime(timeStr) {
      if (!timeStr) return '00:00';
      var m = timeStr.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
      if (m) {
        var h = parseInt(m[2], 10);
        if (m[1] === '오후' && h !== 12) h += 12;
        if (m[1] === '오전' && h === 12) h = 0;
        return ('0' + h).slice(-2) + ':' + m[3];
      }
      return timeStr.slice(0, 5);
    }

    const sd = _isoDate(data.startDate);
    const ed = _isoDate(data.endDate) || sd;
    if (!sd) return ev;

    if (data.isAllDay) {
      const startD = new Date(sd + 'T00:00:00');
      const endD   = new Date(ed + 'T00:00:00');
      if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return ev;
      endD.setDate(endD.getDate() + 1);
      ev.start = { date: sd };
      ev.end   = { date: endD.toISOString().slice(0, 10) };
    } else {
      const st = _isoTime(data.startTime);
      const et = _isoTime(data.endTime) || st;
      ev.start = { dateTime: sd + 'T' + st + ':00', timeZone: 'Asia/Seoul' };
      ev.end   = { dateTime: ed + 'T' + et + ':00', timeZone: 'Asia/Seoul' };
    }
    return ev;
  }

  window.gcalIsConnected = () => !!_token();

  window.gcalConnect = (cb) => {
    const clientId = window._GCAL_CLIENT_ID;
    if (!clientId) { alert('Google Calendar 클라이언트 ID가 설정되지 않았습니다.\n.env 파일에 GCAL_CLIENT_ID를 추가하고 서버를 재시작하세요.'); if (cb) cb(false); return; }
    if (!window.google?.accounts?.oauth2) { if (cb) cb(false); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (resp) => {
        if (resp.access_token) {
          localStorage.setItem('gcal_access_token', resp.access_token);
          localStorage.setItem('gcal_token_expiry', String(Date.now() + (resp.expires_in - 60) * 1000));
          if (cb) cb(true);
        } else {
          if (cb) cb(false);
        }
      },
    });
    client.requestAccessToken();
  };

  window.gcalDisconnect = () => {
    const t = localStorage.getItem('gcal_access_token');
    if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
    localStorage.removeItem('gcal_access_token');
    localStorage.removeItem('gcal_token_expiry');
  };

  window._gcalCreate = (scheduleId, data) => {
    const t = _token();
    console.log('[GCal] token:', t ? '있음' : '없음(연동 필요)');
    if (!t) return;
    const ev = _toCalEvent(data);
    console.log('[GCal] 전송할 이벤트:', JSON.stringify(ev));
    fetch(GCAL_API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    }).then(r => r.json()).then(ev => {
      console.log('[GCal] API 응답:', JSON.stringify(ev));
      if (ev.id) localStorage.setItem('gcal_eid_' + scheduleId, ev.id);
    }).catch(e => console.error('[GCal] 오류:', e));
  };

  window._gcalUpdate = (scheduleId, data) => {
    const t   = _token(); if (!t) return;
    const eid = localStorage.getItem('gcal_eid_' + scheduleId); if (!eid) return;
    fetch(GCAL_API + '/' + eid, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(_toCalEvent(data)),
    }).catch(() => {});
  };

  window._gcalDelete = (scheduleId) => {
    const t   = _token(); if (!t) return;
    const eid = localStorage.getItem('gcal_eid_' + scheduleId); if (!eid) return;
    fetch(GCAL_API + '/' + eid, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + t },
    }).then(() => { localStorage.removeItem('gcal_eid_' + scheduleId); }).catch(() => {});
  };
}());
