import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const JWT_SECRET = process.env.JWT_SECRET || 'last-minute-secret-key-focus-2026';
const BASE = 'http://localhost:3000';

async function main(){
  const dbRaw = await fs.readFile('data/db.json','utf8');
  const db = JSON.parse(dbRaw);
  const user = db.users.find(u => String(u.email).includes('caltest+'));
  if(!user) { console.error('no user'); process.exit(1); }
  const state = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '10m' });
  console.log('Calling callback for user', user.id);
  const res = await fetch(`${BASE}/api/calendar/google/callback?state=${encodeURIComponent(state)}&simulate=true`, { headers: { Authorization: `Bearer ${user.id}` } });
  const text = await res.text();
  console.log('Status', res.status);
  // read db again
  const db2Raw = await fs.readFile('data/db.json','utf8');
  const db2 = JSON.parse(db2Raw);
  const u2 = db2.users.find(u => u.id === user.id);
  console.log('User linked:', !!u2.googleCalendarLinked);
  console.log('Snippet of returned html:', text.slice(0,200));
}

main().catch(e=>{console.error(e);process.exit(1)});
