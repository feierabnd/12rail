const axios = require('axios');

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to run tests
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Tests
test('API is running', async () => {
  const res = await axios.get(`${API_URL}/api/health`);
  assert(res.status === 200, 'Health check should return 200');
  assert(res.data.status === 'ok', 'Status should be ok');
});

test('Basic search Berlin to Hamburg', async () => {
  const res = await axios.get(`${API_URL}/api/search?from=Berlin&to=Hamburg`);
  assert(res.status === 200, 'Search should return 200');
  assert(Array.isArray(res.data.connections), 'Should return connections array');
  if (res.data.connections.length > 0) {
    assert(res.data.connections[0].from, 'Should have from');
    assert(res.data.connections[0].to, 'Should have to');
    assert(res.data.connections[0].totalDuration, 'Should have duration');
  }
});

test('Search with date', async () => {
  const res = await axios.get(`${API_URL}/api/search?from=Berlin&to=Hamburg&date=2026-03-15`);
  assert(res.status === 200, 'Search with date should return 200');
});

test('Station autocomplete', async () => {
  const res = await axios.get(`${API_URL}/api/stations?search=berlin`);
  assert(res.status === 200, 'Station search should return 200');
  assert(Array.isArray(res.data), 'Should return array');
});

test('Invalid station', async () => {
  const res = await axios.get(`${API_URL}/api/search?from=Berlin&to=NotARealCity12345`);
  assert(res.status === 200, 'Invalid search should return 200');
  assert(res.data.error || res.data.connections.length === 0, 'Should return error or empty');
});

test('Missing parameters', async () => {
  try {
    await axios.get(`${API_URL}/api/search?from=Berlin`);
    assert(false, 'Should throw error');
  } catch (e) {
    assert(e.response.status === 400, 'Should return 400 for missing params');
  }
});

// Run tests
async function runTests() {
  console.log('🧪 Running 12rail Tests...\n');
  let passed = 0;
  let failed = 0;
  
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`❌ ${t.name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
