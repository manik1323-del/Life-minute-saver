import fs from 'fs/promises';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'last-minute-secret-key-focus-2026';

async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return { status: res.status, body: JSON.parse(txt) }; } catch { return { status: res.status, body: txt }; }
}

async function get(path, headers = {}) {
  const res = await fetch(BASE + path, { method: 'GET', headers });
  const txt = await res.text();
  try { return { status: res.status, body: JSON.parse(txt) }; } catch { return { status: res.status, body: txt }; }
}

async function main() {
  console.log('Calendar linking tests (simulate)');
  const email = `caltest+${Date.now()}@example.com`;
  const password = 'TestPass123!';

  const signup = await post('/api/auth/signup', { email, password, name: 'Cal Test' });
  console.log('Signup status', signup.status);
  if (!signup.body || !signup.body.user) { console.error('Signup failed'); process.exit(1); }

  const dbRaw = await fs.readFile('data/db.json','utf8');
  const db = JSON.parse(dbRaw);
  const user = db.users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
  if (!user) { console.error('User not found in DB'); process.exit(1); }

  // Create a state matching what server.link would create
  const state = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '10m' });

  // Call the callback with simulate=true to emulate Google redirect
  const callbackUrl = `/api/calendar/google/callback?state=${encodeURIComponent(state)}&simulate=true`;
  const res = await get(callbackUrl, { Authorization: `Bearer ${user.id}` });
  console.log('Callback simulated status', res.status);

  // Refresh user from DB
  const db2Raw = await fs.readFile('data/db.json','utf8');
  const db2 = JSON.parse(db2Raw);
  const user2 = db2.users.find(u => u.id === user.id);
  console.log('User googleCalendarLinked:', !!user2.googleCalendarLinked);
}

main().catch(e => { console.error(e); process.exit(1); });
