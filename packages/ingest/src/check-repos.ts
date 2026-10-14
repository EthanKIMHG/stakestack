import { execSync } from 'node:child_process';
import { loadCatalog } from '@stakestack/shared/catalog';
import { Budget } from './github/budget';
import { repoExists } from './github/client';
import { log } from './config';

/**
 * CI helper for catalog PRs: confirm each *changed* component's repo exists.
 * One REST call per changed repo; never the whole catalog.
 */
async function main() {
  const baseIdx = process.argv.indexOf('--changed');
  const base = baseIdx > -1 ? process.argv[baseIdx + 1] : null;
  const cat = loadCatalog();
  let repos = [...new Set(cat.components.map(c => c.repo))];
  if (base) {
    const diff = execSync(`git diff --unified=0 ${base} -- catalog/components`, { encoding: 'utf8' });
    const changed = new Set([...diff.matchAll(/^\+\s*repo:\s*(\S+)/gm)].map(m => m[1]!));
    repos = repos.filter(r => changed.has(r));
  }
  if (repos.length === 0) { log.info('no changed repos'); return; }
  const budget = new Budget();
  let bad = 0;
  for (const r of repos) {
    const [owner, name] = r.split('/') as [string, string];
    const ok = await repoExists(owner, name, budget);
    log.info(`${ok ? '✓' : '✗'} ${r}`);
    if (!ok) bad += 1;
  }
  budget.report();
  if (bad) process.exit(1);
}
main().catch(e => { log.error(e); process.exit(1); });
