#!/usr/bin/env node
const { spawnSync } = require('child_process');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
}

if (process.env.VERCEL) {
  console.log('VERCEL detected — running frontend-only build');
  run('pnpm', ['run', 'vercel-build']);
  process.exit(0);
}

// Local/default: run the full workspace build
run('pnpm', ['run', 'typecheck']);
run('pnpm', ['--filter', '@workspace/api-server', '--if-present', 'run', 'build']);
run('pnpm', ['--filter', '@workspace/taxi-fleet', '--if-present', 'run', 'build']);
