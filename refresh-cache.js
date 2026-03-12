#!/usr/bin/env node
const Cache = require('./cache');

console.log('Starting route cache refresh...');
Cache.refreshPopularRoutes()
  .then(count => {
    console.log(`Done! Refreshed ${count} routes.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
