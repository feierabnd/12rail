const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const db = new Database(path.join(__dirname, 'cache.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS routes (
    from_id TEXT,
    to_id TEXT,
    from_name TEXT,
    to_name TEXT,
    data TEXT,
    timestamp INTEGER,
    PRIMARY KEY (from_id, to_id)
  );
  
  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT,
    latitude REAL,
    longitude REAL
  );
`);

// Cache routes
function cacheRoute(fromId, toId, fromName, toName, data) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO routes (from_id, to_id, from_name, to_name, data, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(fromId, toId, fromName, toName, JSON.stringify(data), Date.now());
}

// Get cached route (max 6 hours old)
function getCachedRoute(fromId, toId, maxAgeMs = 6 * 60 * 60 * 1000) {
  const stmt = db.prepare(`
    SELECT data, timestamp FROM routes 
    WHERE from_id = ? AND to_id = ? AND timestamp > ?
  `);
  const row = stmt.get(fromId, toId, Date.now() - maxAgeMs);
  return row ? JSON.parse(row.data) : null;
}

// Cache station
function cacheStation(id, name, lat, lon) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO stations (id, name, latitude, longitude)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, name, lat, lon);
}

// Get cached station
function getCachedStation(query) {
  const stmt = db.prepare(`
    SELECT * FROM stations 
    WHERE LOWER(name) LIKE LOWER(?)
    LIMIT 1
  `);
  return stmt.get(`%${query}%`);
}

// Fetch and cache a route
async function fetchAndCacheRoute(fromId, toId, fromName, toName) {
  try {
    const response = await axios.get(
      `https://v6.db.transport.rest/journeys?from=${fromId}&to=${toId}&results=10&stopovers=true`,
      { timeout: 30000 }
    );
    
    const journeys = response.data.journeys || [];
    if (journeys.length > 0) {
      cacheRoute(fromId, toId, fromName, toName, journeys);
      console.log(`Cached: ${fromName} → ${toName} (${journeys.length} journeys)`);
      return journeys;
    }
  } catch (error) {
    console.error(`Failed to cache ${fromName} → ${toName}:`, error.message);
  }
  return null;
}

// Popular routes to pre-cache
const popularRoutes = [
  { from: '8011160', to: '8002549', fromName: 'Berlin Hbf', toName: 'Hamburg Hbf' },
  { from: '8011160', to: '8000261', fromName: 'Berlin Hbf', toName: 'München Hbf' },
  { from: '8002549', to: '8000261', fromName: 'Hamburg Hbf', toName: 'München Hbf' },
  { from: '8000105', to: '8000261', fromName: 'Frankfurt Hbf', toName: 'München Hbf' },
  { from: '8000207', to: '8000105', fromName: 'Köln Hbf', toName: 'Frankfurt Hbf' },
  { from: '8011160', to: '8000105', fromName: 'Berlin Hbf', toName: 'Frankfurt Hbf' },
  { from: '8000209', to: '8000261', fromName: 'Düsseldorf Hbf', toName: 'München Hbf' },
  { from: '8000203', to: '8011160', fromName: 'Braunschweig Hbf', toName: 'Berlin Hbf' },
  { from: '8000203', to: '8002549', fromName: 'Braunschweig Hbf', toName: 'Hamburg Hbf' },
  { from: '8000203', to: '8000261', fromName: 'Braunschweig Hbf', toName: 'München Hbf' },
];

// Refresh all popular routes
async function refreshPopularRoutes() {
  console.log('Refreshing popular routes...');
  let success = 0;
  for (const route of popularRoutes) {
    const result = await fetchAndCacheRoute(route.from, route.to, route.fromName, route.toName);
    if (result) success++;
    await new Promise(r => setTimeout(r, 2000)); // Rate limiting
  }
  console.log(`Refreshed ${success}/${popularRoutes.length} routes`);
  return success;
}

module.exports = {
  cacheRoute,
  getCachedRoute,
  cacheStation,
  getCachedStation,
  fetchAndCacheRoute,
  refreshPopularRoutes,
  popularRoutes
};
