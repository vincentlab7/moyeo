const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

/* .env 파일 자동 로드 (npm dotenv 불필요) */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
} catch {}

const ROOT           = __dirname;
const PORT           = process.env.PORT || 3434;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';

/* 서비스 계정 JSON 로드 (FCM V1 인증에 사용) — 파일 우선, 환경변수 fallback */
let _sa = null;
try {
  _sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'));
} catch {}
if (!_sa && process.env.SERVICE_ACCOUNT_JSON) {
  try { _sa = JSON.parse(process.env.SERVICE_ACCOUNT_JSON); } catch {}
}

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.webp':  'image/webp',
  '.woff2': 'font/woff2',
  '.json':  'application/json',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ── AI 요약 프롬프트 빌더 ── */
function buildPrompt(data) {
  const gName     = data.groupName || '우리 그룹';
  const schedules = (data.schedules || []).map(s => s.title + (s.time ? ` (${s.time})` : '')).join(', ') || '없음';
  const todos     = (data.todos    || []).map(t => t.title).join(', ') || '없음';
  const dinner    = (data.members  || []).filter(m => m.dinner === 'possible').map(m => m.name).join(', ') || '미정';
  return `당신은 가족·소그룹 일정 공유 앱 "모여"의 AI 어시스턴트입니다.
그룹명: ${gName}
오늘 일정: ${schedules}
진행 중 할일: ${todos}
오늘 저녁 가능: ${dinner}

위 정보를 바탕으로 그룹을 위한 따뜻하고 실용적인 하루 요약을 2~3문장으로 작성하세요.
반드시 한국어 구어체로 작성하고, 구체적인 일정·할일을 언급하세요.`;
}

/* ── Claude API 프록시 핸들러 ── */
function handleAiSummary(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }
  if (!CLAUDE_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CLAUDE_API_KEY 환경변수가 설정되지 않았습니다.' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '잘못된 JSON 형식' }));
      return;
    }

    const payload = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: buildPrompt(data) }],
    });

    const opts = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(payload),
      },
    };

    const apiReq = https.request(opts, apiRes => {
      let resp = '';
      apiRes.on('data', c => { resp += c; });
      apiRes.on('end', () => {
        try {
          const parsed  = JSON.parse(resp);
          const summary = parsed.content?.[0]?.text;
          if (!summary) {
            const detail = parsed.error?.message || parsed.error?.type || resp.slice(0, 200);
            console.error('[AI] Anthropic 응답 오류:', detail);
            throw new Error(detail || '응답 없음');
          }
          res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
          res.end(JSON.stringify({ summary }));
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'AI 응답 파싱 실패: ' + e.message }));
        }
      });
    });

    apiReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '외부 API 오류: ' + err.message }));
    });

    apiReq.write(payload);
    apiReq.end();
  });
}

/* ══════════════════════════════════════════════
   FCM V1 API — 서비스 계정 기반 OAuth2 인증
   ══════════════════════════════════════════════ */

function _base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _makeJwt(sa) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = _base64url({ alg: 'RS256', typ: 'JWT' });
  const payload = _base64url({
    iss:   sa.client_email,
    /* FCM 발송 + Firestore 읽기 둘 다 허용 */
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  });
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.${sig}`;
}

let _cachedToken    = null;
let _tokenExpiresAt = 0;

function _getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return Promise.resolve(_cachedToken);
  const jwt  = _makeJwt(_sa);
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path:     '/token',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const parsed     = JSON.parse(d);
          _cachedToken     = parsed.access_token;
          _tokenExpiresAt  = Date.now() + (parsed.expires_in - 60) * 1000;
          resolve(_cachedToken);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* Firestore REST API — 문서 1개 읽기 */
function _firestoreGet(accessToken, projectId, docPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path:     `/v1/projects/${projectId}/databases/(default)/documents/${docPath}`,
      method:   'GET',
      headers:  { 'Authorization': `Bearer ${accessToken}` },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

/* Firestore typed value → JS 값 추출 */
function _fsVal(v) {
  if (!v) return null;
  if (v.stringValue  !== undefined) return v.stringValue;
  if (v.arrayValue)  return (v.arrayValue.values || []).map(_fsVal);
  if (v.mapValue)    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, vv]) => [k, _fsVal(vv)]));
  return null;
}

/* 만료된 FCM 토큰을 Firestore users/{uid}.fcmTokens에서 제거 */
function _cleanStaleTokens(accessToken, projectId, memberIds, userDocs, staleTokens) {
  userDocs.forEach((doc, i) => {
    const uid   = memberIds[i];
    const toks  = _fsVal(doc.fields?.fcmTokens) || [];
    const clean = toks.filter(t => !staleTokens.includes(t));
    if (clean.length === toks.length) return;
    const payload = JSON.stringify({
      fields: { fcmTokens: { arrayValue: { values: clean.map(t => ({ stringValue: t })) } } },
    });
    const path = `/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=fcmTokens`;
    const req  = https.request({ hostname: 'firestore.googleapis.com', path, method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, () => {});
    req.on('error', () => {});
    req.write(payload);
    req.end();
    console.log(`  ${uid} 만료 토큰 제거 완료 (${toks.length} → ${clean.length}개)`);
  });
}

function _sendOneToken(accessToken, projectId, token, title, body) {
  const payload = JSON.stringify({
    message: { token, notification: { title: title || '모여', body: body || '' } },
  });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path:     `/v1/projects/${projectId}/messages:send`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve(d));
    });
    req.on('error', () => resolve(null));
    req.write(payload);
    req.end();
  });
}

/* ── FCM V1 푸시 발송 핸들러 ── */
function handleSendPush(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('Method Not Allowed'); return; }
  if (!_sa) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'service-account.json이 없습니다.' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let data;
    try { data = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '잘못된 JSON 형식' }));
      return;
    }

    const { groupId, senderUid, title, body: msgBody } = data;
    if (!groupId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'groupId 필요' }));
      return;
    }
    console.log(`[FCM] 푸시 요청 — groupId: ${groupId}, 발신: ${senderUid}, 제목: "${title}"`);
    try {
      const accessToken = await _getAccessToken();
      const projectId   = _sa.project_id;

      /* 1. 그룹 문서에서 memberIds 조회 */
      const groupDoc  = await _firestoreGet(accessToken, projectId, `groups/${groupId}`);
      const memberIds = (_fsVal(groupDoc.fields?.memberIds) || []).filter(id => id !== senderUid);
      console.log(`  멤버(본인 제외): ${memberIds.join(', ') || '없음'}`);
      if (!memberIds.length) {
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
        res.end(JSON.stringify({ sent: 0 }));
        return;
      }

      /* 2. 각 멤버의 fcmTokens 조회 */
      const userDocs = await Promise.all(memberIds.map(uid => _firestoreGet(accessToken, projectId, `users/${uid}`)));
      const tokens   = [];
      userDocs.forEach((doc, i) => {
        const toks = _fsVal(doc.fields?.fcmTokens) || [];
        console.log(`  ${memberIds[i]} 토큰: ${toks.length}개`);
        toks.forEach(t => { if (t) tokens.push(t); });
      });

      if (!tokens.length) {
        console.log('  등록된 FCM 토큰 없음 — 알림 권한 미허용 상태');
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
        res.end(JSON.stringify({ sent: 0, reason: '수신자가 알림을 허용하지 않았습니다' }));
        return;
      }

      /* 3. FCM 발송 + 만료 토큰 자동 정리 */
      const sendResults = await Promise.all(tokens.map(t => _sendOneToken(accessToken, projectId, t, title, msgBody).then(r => ({ t, r }))));
      const staleTokens = [];
      let sentCount = 0;
      sendResults.forEach(({ t, r }) => {
        try {
          const parsed = JSON.parse(r);
          if (parsed.error?.status === 'NOT_FOUND') { staleTokens.push(t); }
          else if (parsed.name) { sentCount++; }
        } catch {}
      });
      /* 만료 토큰을 Firestore에서 제거 (배경 작업) */
      if (staleTokens.length) {
        console.log(`  만료 토큰 ${staleTokens.length}개 정리 중...`);
        _cleanStaleTokens(accessToken, projectId, memberIds, userDocs, staleTokens);
      }
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
      res.end(JSON.stringify({ sent: sentCount, stale: staleTokens.length }));
    } catch (e) {
      console.error('[FCM] 발송 실패:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'FCM V1 발송 실패: ' + e.message }));
    }
  });
}

/* ── HTTP 서버 ── */
http.createServer((req, res) => {
  if (req.url === '/api/config') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ gcalClientId: process.env.GCAL_CLIENT_ID || '' }));
    return;
  }

  if (req.url === '/api/ai-summary' || req.url.startsWith('/api/ai-summary?')) {
    handleAiSummary(req, res);
    return;
  }
  if (req.url === '/api/send-push') {
    handleSendPush(req, res);
    return;
  }

  const url      = req.url === '/' ? '/01_auth.html' : req.url;
  const filePath = path.join(ROOT, url.split('?')[0]);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   Claude AI:   ${CLAUDE_API_KEY ? '✅ 설정됨' : '❌ CLAUDE_API_KEY 환경변수 필요'}`);
  console.log(`   FCM 푸시:    ${_sa           ? '✅ service-account.json 로드됨' : '❌ service-account.json 필요'}`);
});
