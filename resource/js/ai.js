/* ═══════════════════════════════════════════════════════════
   ai.js — Claude AI 요약 카드 모듈
   ═══════════════════════════════════════════════════════════ */

/* ── 날짜 범위 체크 (오늘 일정 필터) ── */
function _isToday(ts) {
  if (!ts) return false;
  const d     = ts.toDate ? ts.toDate() : new Date(ts);
  const now   = new Date();
  return d.getFullYear() === now.getFullYear()
      && d.getMonth()    === now.getMonth()
      && d.getDate()     === now.getDate();
}

/* ── 서버에서 AI 요약 요청 ── */
async function fetchAiSummary(group, schedules, todos) {
  const todaySchedules = (schedules || [])
    .filter(s => _isToday(s.startDate))
    .slice(0, 5)
    .map(s => ({ title: s.title, time: s.startTime || '', author: s.authorName || '', dinner: s.dinner || 'none' }));

  const activeTodos = (todos || [])
    .filter(t => t.status !== 'done')
    .slice(0, 5)
    .map(t => ({ title: t.title }));

  const res = await fetch('/api/ai-summary', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      groupName: group?.name || '우리 그룹',
      schedules: todaySchedules,
      todos:     activeTodos,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.summary || '';
}

/* ── AI 카드 DOM 업데이트 ── */
function updateAiCard(text) {
  const el = document.querySelector('.ai-card__body');
  if (!el) return;
  el.style.opacity  = '0';
  el.textContent    = text;
  el.style.transition = 'opacity 0.3s';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

/* ── 공개 함수: 그룹 로드 후 호출 ── */
window.loadAiSummary = async (group, schedules, todos) => {
  const el = document.querySelector('.ai-card__body');
  if (!el) return;

  el.textContent = 'AI가 오늘을 분석하는 중...';

  try {
    const summary = await fetchAiSummary(group, schedules, todos);
    updateAiCard(summary || '오늘도 좋은 하루 되세요! 😊');
  } catch {
    updateAiCard('오늘도 좋은 하루 되세요! 😊');
  }
};
