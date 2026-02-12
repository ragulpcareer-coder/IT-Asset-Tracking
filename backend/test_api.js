const fetch = global.fetch || require('node-fetch');

const BASE = 'http://localhost:5000';

async function req(path, method='GET', body=null, token=null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

async function run() {
  console.log('Starting tests...');

  const ts = Date.now();
  const adminEmail = `tempadmin+${ts}@example.com`;
  const userEmail = `tempuser+${ts}@example.com`;

  console.log('Register admin...');
  let r = await req('/api/auth/register', 'POST', { name: 'Temp Admin', email: adminEmail, password: 'Password123!', role: 'Admin' });
  console.log(r.status, r.body);

  console.log('Register user...');
  r = await req('/api/auth/register', 'POST', { name: 'Temp User', email: userEmail, password: 'Password123!', role: 'User' });
  console.log(r.status, r.body);

  console.log('Login admin...');
  r = await req('/api/auth/login', 'POST', { email: adminEmail, password: 'Password123!' });
  console.log(r.status, r.body);
  const adminToken = r.body.token;

  console.log('Login user...');
  r = await req('/api/auth/login', 'POST', { email: userEmail, password: 'Password123!' });
  console.log(r.status, r.body);
  const userToken = r.body.token;

  if (!adminToken || !userToken) {
    console.error('Login failed for one or both accounts');
    process.exit(1);
  }

  console.log('Create asset as admin...');
  r = await req('/api/assets', 'POST', { name: 'Test Laptop', type: 'Laptop', serialNumber: `SN${ts}`, status: 'available' }, adminToken);
  console.log(r.status, r.body);
  const assetId = r.body._id;

  console.log('Get assets...');
  r = await req('/api/assets', 'GET');
  console.log(r.status, Array.isArray(r.body.assets) ? `Got ${r.body.assets.length} assets` : r.body);

  console.log('Update asset as admin...');
  r = await req(`/api/assets/${assetId}`, 'PUT', { name: 'Test Laptop Updated' }, adminToken);
  console.log(r.status, r.body);

  console.log('Delete asset as admin...');
  r = await req(`/api/assets/${assetId}`, 'DELETE', null, adminToken);
  console.log(r.status, r.body);

  console.log('Get audit logs as admin...');
  r = await req('/api/audit', 'GET', null, adminToken);
  console.log(r.status, Array.isArray(r.body) ? `Got ${r.body.length} logs` : r.body);

  console.log('All tests completed successfully');
}

run().catch(err => { console.error(err); process.exit(1); });
