#!/usr/bin/env node
const { cp } = require('fs/promises');
const { existsSync } = require('fs');
const { resolve } = require('path');

const src = resolve(process.cwd(), 'artifacts/taxi-fleet/dist');
const dest = resolve(process.cwd(), 'dist');

async function main() {
  if (!existsSync(src)) {
    console.error(`Source folder not found: ${src}`);
    process.exit(1);
  }

  try {
    await cp(src, dest, { recursive: true });
    console.log(`Copied ${src} -> ${dest}`);
  } catch (err) {
    console.error('Error copying dist:', err);
    process.exit(1);
  }
}

main();
