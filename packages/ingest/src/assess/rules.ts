import type { Assessor, Assessment, Evidence, Flag, Release, Severity } from '@stakestack/shared/types';

export const ASSESSOR_VERSION = '2026.10.1';

/* ------------------------------------------------------------------ shared -- */
const FORK_WORDS: Record<string, string[]> = {
  pectra: ['pectra', 'prague', 'electra'],
  fusaka: ['fusaka', 'fulu', 'osaka', 'peerdas'],
  glamsterdam: ['glamsterdam', 'gloas', 'amsterdam', 'epbs'],
  hegota: ['hegota', 'heze', 'bogota', 'focil'],
};
const NETWORK_WORDS = ['mainnet', 'hoodi', 'sepolia', 'holesky', 'ephemery'];

interface Kw { re: RegExp; flag?: Flag; score: number; label: string }
const KEYWORDS: Kw[] = [
  { re: /\b(security|vulnerabilit(y|ies)|cve-\d{4}-\d+|exploit|dos\b|denial[- ]of[- ]service|remote code|rce\b)/i, flag: 'security', score: 45, label: 'security wording' },
  { re: /\b(mandatory|required (release|upgrade|update)|must (upgrade|update)|all users (must|should|are (strongly )?(advised|recommended) to) (upgrade|update))/i, flag: 'mandatory', score: 40, label: 'mandatory wording' },
  { re: /\b(hard ?fork|network upgrade|fork (epoch|block|time)|activation epoch|supports? (the )?(upcoming )?fork)\b/i, flag: 'hardfork', score: 35, label: 'fork wording' },
  { re: /\b(hotfix|hot-fix|critical (bug|fix|issue)|urgent)\b/i, flag: 'hotfix', score: 30, label: 'hotfix wording' },
  { re: /\b(breaking change|breaking:|backwards?[- ]incompatible|incompatible with|requires? (migration|resync|re-sync|database (upgrade|migration)))/i, flag: 'breaking', score: 20, label: 'breaking wording' },
  { re: /\b(deprecat(ed|ion)|removed? (flag|option|support))\b/i, flag: 'deprecation', score: 5, label: 'deprecation wording' },
  { re: /\b(performance|faster|memory (usage|leak)|cpu)\b/i, flag: 'performance', score: 3, label: 'performance wording' },
  { re: /\b(slash(ing|ed)|missed (attestation|proposal)s?|liveness|finality|consensus (bug|failure|split)|chain split|invalid block)/i, score: 25, label: 'consensus-safety wording' },
];

function snippet(text: string, re: RegExp, len = 160): string {
  const m = re.exec(text); if (!m) return '';
  const start = Math.max(0, m.index - 60);
  return text.slice(start, start + len).replace(/\s+/g, ' ').trim();
}

function detectNetworksAndWave(text: string): { networks: string[]; wave: string | null } {
  const lower = text.toLowerCase();
  const networks = NETWORK_WORDS.filter(n => lower.includes(n));
  let wave: string | null = null;
  for (const [w, words] of Object.entries(FORK_WORDS)) if (words.some(x => lower.includes(x))) { wave = w; break; }
  return { networks, wave };
}

function toSeverity(score: number, flags: Set<Flag>): Severity {
  if (flags.has('security') && score >= 60) return 'critical';
  if (flags.has('mandatory') || flags.has('hardfork') || score >= 60) return 'high';
  if (score >= 25) return 'recommended';
  if (score > 0) return 'optional';
  return 'unassessed';
}

function keywordPass(text: string): { score: number; flags: Set<Flag>; evidence: Evidence[] } {
  let score = 0; const flags = new Set<Flag>(); const evidence: Evidence[] = [];
  for (const k of KEYWORDS) {
    if (!k.re.test(text)) continue;
    score += k.score; if (k.flag) flags.add(k.flag);
    evidence.push({ kind: 'keyword', text: `${k.label}: "${snippet(text, k.re)}"`, weight: k.score });
  }
  return { score, flags, evidence };
}

/* ------------------------------------------------- client-specific parsers -- */
/** Lighthouse / Anchor / Siren: markdown table "Update Priority" with rows per user class. */
function lighthouseTable(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const idx = text.search(/update priority/i); if (idx < 0) return null;
  const section = text.slice(idx, idx + 1500);
  const rows = section.split('\n').filter(l => l.includes('|'));
  let best = 0; const evidence: Evidence[] = []; const flags = new Set<Flag>();
  for (const r of rows) {
    const lvl = /\b(high|medium|low)[- ]priority\b/i.exec(r)?.[1]?.toLowerCase() ?? /\|\s*(high|medium|low)\s*\|/i.exec(r)?.[1]?.toLowerCase();
    if (!lvl) continue;
    const s = lvl === 'high' ? 70 : lvl === 'medium' ? 40 : 10;
    if (s > best) best = s;
    evidence.push({ kind: 'table', text: r.replace(/\s+/g, ' ').trim().slice(0, 160), weight: s });
  }
  if (evidence.length === 0) return null;
  if (best >= 70) flags.add('mandatory');
  return { score: best, evidence, flags };
}

/** Reth: same idea, rows for payload builders / non-payload builders. */
const rethTable = lighthouseTable;

/** Nimbus: "Urgency guidance:" paragraph. */
function nimbusUrgency(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const m = /urgency guidance:?\s*([\s\S]{0,400})/i.exec(text); if (!m) return null;
  const para = m[1]!.split(/\n\s*\n/)[0]!.replace(/\s+/g, ' ').trim();
  const flags = new Set<Flag>();
  let score = 15;
  if (/\b(must|required|mandatory|as soon as possible|immediately|before (the )?(fork|upgrade))\b/i.test(para)) { score = 70; flags.add('mandatory'); }
  else if (/\b(recommended|should upgrade|advised)\b/i.test(para)) score = 40;
  else if (/\b(no (need|urgency)|optional|low)\b/i.test(para)) score = 5;
  return { score, evidence: [{ kind: 'heading', text: `Urgency guidance: ${para.slice(0, 200)}`, weight: score }], flags };
}

/** Geth: prose; the team uses recurring phrases. */
function gethProse(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const flags = new Set<Flag>(); const evidence: Evidence[] = []; let score = 0;
  const pats: Array<[RegExp, number, Flag | undefined]> = [
    [/recommended for all users/i, 35, 'mandatory'],
    [/(hotfix|hot-fix) release/i, 40, 'hotfix'],
    [/(security|dos) (fix|issue|vulnerabilit)/i, 45, 'security'],
    [/(enables?|schedules?|activates?) (the )?[a-z]+ (fork|upgrade) on (mainnet|hoodi|sepolia|holesky)/i, 50, 'hardfork'],
    [/maintenance release/i, 10, undefined],
    [/pre-?release|release candidate/i, 0, 'prerelease'],
  ];
  for (const [re, s, f] of pats) if (re.test(text)) { score += s; if (f) flags.add(f); evidence.push({ kind: 'keyword', text: snippet(text, re), weight: s }); }
  return evidence.length ? { score, evidence, flags } : null;
}

/** Teku / Besu / Web3Signer: structured headings. */
function tekuNotes(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const flags = new Set<Flag>(); const evidence: Evidence[] = []; let score = 0;
  const brk = /#+\s*breaking changes?\s*\n([\s\S]*?)(\n#+|$)/i.exec(text);
  if (brk && brk[1]!.replace(/[-*\s]/g, '').length > 10 && !/none|no breaking/i.test(brk[1]!)) { score += 25; flags.add('breaking'); evidence.push({ kind: 'heading', text: `Breaking Changes: ${brk[1]!.replace(/\s+/g, ' ').trim().slice(0, 160)}`, weight: 25 }); }
  const upc = /#+\s*upcoming breaking changes?[\s\S]{0,300}/i.exec(text);
  if (upc) evidence.push({ kind: 'heading', text: upc[0].replace(/\s+/g, ' ').slice(0, 160), weight: 0 });
  if (/\b(required|mandatory) (for|before) (the )?[a-z]+ (upgrade|fork|hardfork)/i.test(text) || /this release is required/i.test(text)) { score += 45; flags.add('mandatory'); flags.add('hardfork'); evidence.push({ kind: 'keyword', text: snippet(text, /required|mandatory/i), weight: 45 }); }
  return evidence.length ? { score, evidence, flags } : null;
}

/** Prysm: headings such as "Security", plus "required"/"recommended" statements near the top. */
function prysmNotes(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const flags = new Set<Flag>(); const evidence: Evidence[] = []; let score = 0;
  const head = text.slice(0, 1200);
  if (/#+\s*security/i.test(text) && !/no security (updates|fixes)/i.test(text)) { score += 40; flags.add('security'); evidence.push({ kind: 'heading', text: 'Security section present', weight: 40 }); }
  if (/\b(required|mandatory)\b/i.test(head)) { score += 40; flags.add('mandatory'); evidence.push({ kind: 'keyword', text: snippet(head, /required|mandatory/i), weight: 40 }); }
  else if (/\brecommended\b/i.test(head)) { score += 20; evidence.push({ kind: 'keyword', text: snippet(head, /recommended/i), weight: 20 }); }
  return evidence.length ? { score, evidence, flags } : null;
}

/** Charon / CDVN: Obol marks breaking changes and publishes compatibility tables. */
function charonNotes(text: string): { score: number; evidence: Evidence[]; flags: Set<Flag> } | null {
  const flags = new Set<Flag>(); const evidence: Evidence[] = []; let score = 0;
  if (/\bbreaking\b/i.test(text)) { score += 30; flags.add('breaking'); evidence.push({ kind: 'keyword', text: snippet(text, /breaking/i), weight: 30 }); }
  if (/(cluster[- ]wide|all (nodes|operators) (in the cluster )?(must|need to) upgrade|coordinated upgrade)/i.test(text)) { score += 35; flags.add('mandatory'); evidence.push({ kind: 'keyword', text: snippet(text, /cluster[- ]wide|coordinated upgrade|must upgrade/i), weight: 35 }); }
  if (/(compatib(le|ility) (matrix|table)|supported (vc|validator client)s?)/i.test(text)) evidence.push({ kind: 'heading', text: 'compatibility matrix referenced', weight: 0 });
  return evidence.length ? { score, evidence, flags } : null;
}

const SPECIFIC: Record<Exclude<Assessor, 'generic'>, (t: string) => { score: number; evidence: Evidence[]; flags: Set<Flag> } | null> = {
  'lighthouse-table': lighthouseTable,
  'reth-table': rethTable,
  'nimbus-urgency': nimbusUrgency,
  'geth-prose': gethProse,
  'teku-notes': tekuNotes,
  'prysm-notes': prysmNotes,
  'charon-notes': charonNotes,
};

/* -------------------------------------------------------------- entrypoint -- */
export function assessRelease(release: Release, assessor: Assessor): Assessment {
  const text = `${release.name ?? ''}\n${release.body ?? ''}`;
  const flags = new Set<Flag>();
  const evidence: Evidence[] = [];
  let score = 0;

  const specific = assessor === 'generic' ? null : SPECIFIC[assessor](text);
  if (specific) { score += specific.score; specific.flags.forEach(f => flags.add(f)); evidence.push(...specific.evidence); }

  // Keyword pass always runs, but when a client-specific table already set the
  // level, keywords only add half weight so a long changelog cannot outrank
  // the team's own priority statement.
  const kw = keywordPass(text);
  const kwFactor = specific ? 0.5 : 1;
  score += Math.round(kw.score * kwFactor);
  kw.flags.forEach(f => flags.add(f));
  evidence.push(...kw.evidence.map(e => ({ ...e, weight: Math.round(e.weight * kwFactor) })));

  const { networks, wave } = detectNetworksAndWave(text);
  if (release.is_prerelease) {
    flags.add('prerelease');
    if (networks.length && !networks.includes('mainnet')) flags.add('testnet-only');
  }
  if (wave && !flags.has('hardfork')) { flags.add('hardfork'); score += 15; evidence.push({ kind: 'keyword', text: `mentions fork wave "${wave}"`, weight: 15 }); }

  score = Math.max(0, Math.min(100, score));
  return {
    release_tag: release.tag,
    component_slug: release.component_slug,
    severity: toSeverity(score, flags),
    score,
    flags: [...flags],
    networks,
    wave,
    evidence: evidence.sort((a, b) => b.weight - a.weight).slice(0, 12),
    assessor,
    assessor_version: ASSESSOR_VERSION,
  };
}
