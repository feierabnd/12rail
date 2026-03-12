const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    return false;
  }
}

async function run() {
  console.log('🧪 12rail Tests\n');
  
  let passed = 0, failed = 0;
  
  if (await test('Health check', async () => {
    const r = await axios.get(`${API_URL}/api/health`);
    if (r.status !== 200 || r.data.status !== 'ok') throw new Error('Health failed');
  })) passed++; else failed++;
  
  if (await test('Search Berlin → Hamburg', async () => {
    const r = await axios.get(`${API_URL}/api/search?from=Berlin&to=Hamburg`);
    if (r.status !== 200) throw new Error('Status not 200');
  })) passed++; else failed++;
  
  if (await test('Station search', async () => {
    const r = await axios.get(`${API_URL}/api/stations?search=berlin`);
    if (r.status !== 200) throw new Error('Status not 200');
  })) passed++; else failed++;
  
  if (await test('Date search', async () => {
    const r = await axios.get(`${API_URL}/api/search?from=Berlin&to=Hamburg&date=2026-03-20`);
    if (r.status !== 200) throw new Error('Status not 200');
  })) passed++; else failed++;
  
  if (await test('Missing params', async () => {
    try { await axios.get(`${API_URL}/api/search?from=Berlin`); throw new Error('Should throw'); }
    catch(e) { if (e.response?.status !== 400) throw new Error('Wrong status'); }
  })) passed++; else failed++;
  
  console.log(`\n📊 ${passed} passed, ${failed} failed`);
}

run();
