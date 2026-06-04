#!/usr/bin/env node
const { spawnSync } = require('child_process');

if (process.env.VERCEL) {
  console.log('VERCEL detected — skipping workspace typecheck.');
  process.exit(0);
}

const res = spawnSync('tsc', ['--build'], { stdio: 'inherit' });
process.exit(res.status || 0);
