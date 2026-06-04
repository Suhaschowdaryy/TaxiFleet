#!/usr/bin/env node
import { cp } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const src = resolve(process.cwd(), 'artifacts/taxi-fleet/dist');
const dest = resolve(process.cwd(), 'dist');

if (!existsSync(src)) {
  console.error(`Source folder not found: ${src}`);
  process.exit(1);
}

await cp(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
