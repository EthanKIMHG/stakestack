import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';

/**
 * Small on-disk state persisted between runs (GitHub Actions restores it with
 * actions/cache). It is what makes conditional requests possible:
 *   - etags:   REST ETag per URL -> 304 responses cost 0 rate-limit units
 *   - seen:    newest release node id per repo -> skip unchanged repos' assessment
 *   - lastAdvisoryPoll: per repo ISO timestamp
 */
export interface IngestState {
  etags: Record<string, string>;
  seen: Record<string, { newestNodeId: string | null; newestPublishedAt: string | null; backfilled: boolean }>;
  lastAdvisoryPoll: Record<string, string>;
  /** "slug@tag" -> content hash of what we last wrote. Unchanged releases are not re-written. */
  releaseHashes?: Record<string, string>;
  /** repo key -> "pushedAt|archived" last written to components. */
  repoMeta?: Record<string, string>;
  lastRun?: string;
}

const file = () => join(config.cacheDir, 'state.json');

export function loadState(): IngestState {
  try {
    if (existsSync(file())) return JSON.parse(readFileSync(file(), 'utf8')) as IngestState;
  } catch { /* corrupt cache -> start fresh */ }
  return { etags: {}, seen: {}, lastAdvisoryPoll: {}, releaseHashes: {}, repoMeta: {} };
}

export function saveState(s: IngestState): void {
  mkdirSync(config.cacheDir, { recursive: true });
  s.lastRun = new Date().toISOString();
  writeFileSync(file(), JSON.stringify(s, null, 2));
}
