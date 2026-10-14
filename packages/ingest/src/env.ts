import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import dotenv from 'dotenv';

/**
 * Load .env from the current directory, then walk up to the monorepo root
 * (first ancestor containing pnpm-workspace.yaml). Earlier files win; real
 * environment variables always win over files.
 */
let dir = resolve(process.cwd());
let root = dir;
for (let i = 0; i < 6; i++) {
  const f = join(dir, '.env');
  if (existsSync(f)) dotenv.config({ path: f, override: false });
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) { root = dir; break; }
  const parent = dirname(dir); if (parent === dir) break; dir = parent;
}
/** Monorepo root (directory containing pnpm-workspace.yaml), or cwd when not found. Relative paths in .env resolve against it. */
export const repoRoot = root;
