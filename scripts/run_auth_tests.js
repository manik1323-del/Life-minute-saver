import fs from 'fs/promises';

const BASE = 'http://localhost:3000';
const email = `auto+${Date.now()}@example.com`;
const password = 'TestPass123!';

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

async function get(path, token) {
  const res = await fetch(BASE + path, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

async function put(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

async function main() {
  console.log('TEST_EMAIL:', email);
  const signup = await post('/api/auth/signup', { email, password, name: 'Auto Test' });
  console.log('\nSIGNUP:', signup);

  const login = await post('/api/auth/login', { email, password });
  console.log('\nLOGIN:', login);

  const token = (login.body && login.body.token) || (signup.body && signup.body.token);
  console.log('\nTOKEN:', !!token);

  const me = await get('/api/auth/me', token);
  console.log('\nME:', me);

  const putRes = await put('/api/auth/me', { role: 'admin', name: 'Auto NewName' }, token);
  console.log('\nPUT (attempt role->admin, name->Auto NewName):', putRes);

  const dbRaw = await fs.readFile('data/db.json', 'utf8');
  const db = JSON.parse(dbRaw);
  const user = db.users.find(u => u.email === email);
  console.log('\nDB_USER:', user ? { id: user.id, email: user.email, role: user.role, name: user.name, refreshTokensCount: (user.refreshTokens||[]).length } : null);

  const rt = user && user.refreshTokens && user.refreshTokens[0];
  console.log('\nREFRESH_TOKEN_PRESENT:', !!rt);

  if (rt) {
    const refresh = await post('/api/auth/refresh', { refreshToken: rt });
    console.log('\nREFRESH:', refresh);
  } else {
    console.log('\nSkipping refresh call; no refresh token found for user.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
