import fs from 'fs/promises';

const BASE = 'http://localhost:3000';

async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return { status: res.status, body: JSON.parse(txt) }; } catch { return { status: res.status, body: txt }; }
}

async function put(path, body, token) {
  const res = await fetch(BASE + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return { status: res.status, body: JSON.parse(txt) }; } catch { return { status: res.status, body: txt }; }
}

async function main() {
  console.log('Phase 2 Notification tests');

  // create user A
  const aEmail = `userA+${Date.now()}@example.com`;
  const bEmail = `userB+${Date.now()}@example.com`;
  const password = 'TestPass123!';

  console.log('Signup A:', aEmail);
  const suA = await post('/api/auth/signup', { email: aEmail, password, name: 'User A' });
  console.log('->', suA.status);

  console.log('Signup B:', bEmail);
  const suB = await post('/api/auth/signup', { email: bEmail, password, name: 'User B' });
  console.log('->', suB.status);

  const tokenA = suA.body && suA.body.token;
  const tokenB = suB.body && suB.body.token;
  if (!tokenA || !tokenB) {
    console.error('Failed to signup users. Aborting tests.');
    process.exit(1);
  }

  // read db and create a notification for B
  // Poll db.json for the created users (server writes may be async)
  let db;
  let userB;
  for (let i = 0; i < 10; i++) {
    const dbRaw = await fs.readFile('data/db.json','utf8');
    db = JSON.parse(dbRaw);
    userB = db.users.find(u => String(u.email).toLowerCase() === String(bEmail).toLowerCase());
    if (userB) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (!userB) { console.error('User B not in db'); process.exit(1); }

  const note = {
    id: `n-test-${Date.now()}`,
    userId: userB.id,
    title: 'Test Notification',
    message: 'This is a test notification for user B',
    type: 'info',
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications = db.notifications || [];
  db.notifications.push(note);
  await fs.writeFile('data/db.json', JSON.stringify(db, null, 2), 'utf8');
  console.log('Created notification for B:', note.id);

  // A attempts to mark B's notification as read -> expect 403
  console.log('A attempting to mark read (expect 403):');
  const aAttempts = await put(`/api/notifications/${note.id}/read`, {}, tokenA);
  console.log(aAttempts);

  // B attempts -> expect success
  console.log('B attempting to mark read (expect success):');
  const bAttempts = await put(`/api/notifications/${note.id}/read`, {}, tokenB);
  console.log(bAttempts);

  // Confirm DB state
  const dbFinalRaw = await fs.readFile('data/db.json','utf8');
  const dbFinal = JSON.parse(dbFinalRaw);
  const nFinal = dbFinal.notifications.find(n => n.id === note.id);
  console.log('Final DB notification state:', nFinal);
}

main().catch(e => { console.error(e); process.exit(1); });
