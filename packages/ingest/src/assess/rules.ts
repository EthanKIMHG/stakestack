import type { Assessor, Assessment, Evidence, Flag, Release, Severity } from '@stakestack/shared/types';

/**
 * Rule-based release assessment. See docs/ASSESSMENT.md.
 *
 * The team's own urgency statement ("high-priority", "`medium-urgency` for Sepolia",
 * "required for the Sepolia network", an Update Priority table) sets the level.
 * Keyword signals (security, hotfix, breaking, ...) are read from prose only, never
 * from auto-generated PR/commit lists, and can only move the score inside the
 * stated level. The one exception: a stated high + security wording is critical.
 * When no statement exists, the signals alone decide.
 */
export const ASSESSOR_VERSION = '2026.10.2';

/* ------------------------------------------------------------------ shared -- */
type Level = 'high' | 'medium' | 'low';
const LEVEL_RANK: Record<Level, number> = { high: 3, medium: 2, low: 1 };
const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, recommended: 2, optional: 1, unassessed: 0 };
const BANDS: Record<Severity, [number, number]> = { critical: [85, 100], high: [60, 84], recommended: [25, 59], optional: [1, 24], unassessed: [0, 0] };

/** Oldest to newest; when several are mentioned the newest wins. "peerdas" is a feature that outlives Fusaka, so it is not a wave word. */
const FORK_WAVES: Array<[string, RegExp]> = [
  ['pectra', /\b(pectra|prague|electra)\b/i],
  ['fusaka', /\b(fusaka|fulu|osaka)\b/i],
  ['glamsterdam', /\b(glamsterdam|gloas|amsterdam|epbs)\b/i],
  ['hegota', /\b(hegota|heze|bogota|focil)\b/i],
];
const ETH_NETS = ['mainnet', 'hoodi', 'sepolia', 'holesky', 'ephemery'] as const;
const OTHER_CHAINS = /\b(gnosis|chiado|optimism|arbitrum|polygon|l2s?|op[- ]stack)\b/i;
const FORK_WORD = /\b(hard ?forks?|forks?|network upgrades?)\b/i;

function ethNetworks(text: string): string[] {
  const lower = text.toLowerCase();
  const nets: string[] = ETH_NETS.filter(n => new RegExp(`\\b${n}s?\\b`).test(lower));
  if (!nets.includes('mainnet') && /\bethereum\b(?! on arm)/.test(lower)) nets.unshift('mainnet');
  return nets;
}

function latestWave(text: string): string | null {
  let wave: string | null = null;
  for (const [id, re] of FORK_WAVES) if (re.test(text)) wave = id;
  return wave;
}

/** The wave a text talks about most; ties go to the newer wave. */
function dominantWave(text: string): string | null {
  let best: string | null = null; let bestN = 0;
  for (const [id, re] of FORK_WAVES) {
    const n = text.match(new RegExp(re.source, 'gi'))?.length ?? 0;
    if (n > 0 && n >= bestN) { best = id; bestN = n; }
  }
  return best;
}

/** Negations and hedges right before a statement ("is not mandatory", "you may need to update", "only need to upgrade if"). */
const NEGATION_BEFORE = /\b(not|no|never|nor|without|only|may|might|could|possibly|isn't|aren't|doesn't|don't|won't|wasn't)\s+(\w+\s+){0,2}$/i;

function clip(text: string, len = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > len ? `${t.slice(0, len - 1)}…` : t;
}

/* ---------------------------------------------------------- text preparation -- */
interface Prepared {
  /** Every line after cleaning, in order (prose and changelog). Used for heading sections and tables. */
  lines: string[];
  /** Prose sentences: release-note text a human wrote, without PR / commit lists or tables. */
  sentences: string[];
  /** The first sentences up to ~2,500 characters: where teams state urgency. */
  lead: string[];
  /** Auto-generated or per-PR changelog entries. */
  changelog: string[];
}

/**
 * Machine-generated changelog lines: GitHub's "* title by @x in https://.../pull/N", commit-hash and
 * merge lines, dependency bumps and the generated footer. Bullets a team wrote by hand (Geth, Prysm,
 * Erigon highlights) stay prose even when they link a PR.
 */
function isChangelogLine(l: string): boolean {
  if (/merge pull request #\d+/i.test(l) || /\bfull changelog\b/i.test(l) || /made their first contribution/i.test(l)) return true;
  if (/^\s*[-*+]?\s*[0-9a-f]{7,40}\s/.test(l)) return true;
  if (!/^\s*([-*+]|\d+\.)\s/.test(l)) return false;
  return /\bby @[\w[\]-]+ in https?:\/\//.test(l) || /\b(?:dependabot|renovate)\b/i.test(l) || /^\s*[-*+]\s*(?:(?:chore|build|deps)\(deps?\)|bump\s)/i.test(l);
}

function cleanLine(l: string): string {
  return l
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')           // [text](url) -> text
    .replace(/<[^>]+>/g, ' ')                          // inline html
    .replace(/https?:\/\/\S+/g, ' ')                   // bare urls (".../security/advisories" is not a statement)
    .replace(/\*\*|__|`/g, '')                         // bold / code markers
    .replace(/:[a-z_]+:/g, ' ')                        // :warning: style emoji codes
    .replace(/[ \t]+/g, ' ')
    .trimEnd();
}

function prepare(name: string | null | undefined, body: string | null | undefined): Prepared {
  const text = `${name ?? ''}\n${body ?? ''}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // "Hegotá" -> "Hegota"
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')  // "haven’t" -> "haven't" so negations match
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ');
  const lines: string[] = []; const prose: string[] = []; const changelog: string[] = [];
  for (const raw of text.split('\n')) {
    const cl = cleanLine(raw);
    lines.push(cl);
    if (isChangelogLine(raw)) changelog.push(cl.trim());
    else prose.push(cl);
  }
  const sentences = prose.join('\n')
    .split(/\n\s*\n|\n(?=\s*(?:[-*+]|\d+\.|#{1,6})\s)|(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 0 && (s.match(/\|/g)?.length ?? 0) < 2);   // table rows are read by the table parser
  const lead: string[] = []; let used = 0;
  for (const s of sentences) { if (used > 2500) break; lead.push(s); used += s.length; }
  return { lines, sentences, lead, changelog };
}

/* --------------------------------------------------------------- statements -- */
interface Statement { level: Level; score: number; mandatory: boolean; networks: string[]; sentence: string; fork: boolean }

interface Pattern { re: RegExp; level: Level; score: number; mandatory?: boolean; negatable?: boolean; notFollowedBy?: RegExp }
const STATEMENTS: Pattern[] = [
  // high
  { re: /\b(?:high|critical)[- ](?:priority|urgency)\b/gi, level: 'high', score: 70 },
  { re: /\bcritical\s+(?:security\s+)?(?:release|update|upgrade)\b/gi, level: 'high', score: 75 },
  { re: /\bmandatory\b/gi, level: 'high', score: 70, mandatory: true, notFollowedBy: /^\s+(flags?|fields?|param\w*|arguments?|options?|headers?|checks?)\b/i },
  { re: /\b(?:(?:must|have to|has to)\s+(?:also\s+)?(?:upgrade|update|run|be\s+(?:upgraded|updated))|needs?\s+to\s+(?:also\s+)?(?:upgrade|update))\b/gi, level: 'high', score: 70, mandatory: true, notFollowedBy: /^\s+(?:their|your|the)\s+(?:config\w*|flags?|scripts?|compose|settings|\.env)\b/i },
  { re: /\b(?:(?:is|are)\s+required\s+to\s+(?:upgrade|update)|required\s+(?:update|upgrade|release)|(?:release|update|upgrade)\s+is\s+required|(?<!\bchanges?\s+(?:\w+\s+)?)required\s+(?:for|before)\s+(?:the\s+)?(?:[\w()-]+\s+){0,3}(?:fork|hard ?fork|upgrade|network|activation))\b/gi, level: 'high', score: 70, mandatory: true },
  { re: /\b(?:upgrade|update)\w*\s+(?:[\w-]+\s+){0,4}?(?:immediately|as soon as (?:possible|practical)|asap|promptly|urgently|without delay)\b/gi, level: 'high', score: 65 },
  { re: /\burgent(?:ly)?\b/gi, level: 'high', score: 65 },
  { re: /\b(?:upgrade|update)\s+(?:[\w-]+\s+){0,3}?before\s+(?:the\s+)?(?:[\w-]+\s+)?(?:fork|hard ?fork|activation|epoch|\d)/gi, level: 'high', score: 70, mandatory: true },
  { re: /\b(?:cluster[- ]wide|coordinated)\s+upgrade\b|\ball\s+(?:nodes|operators)\s+in\s+(?:the|a|your)\s+cluster\s+(?:must|need to|should)\s+(?:upgrade|update)\b/gi, level: 'high', score: 70, mandatory: true },
  // medium
  { re: /\b(?:medium|moderate)[- ](?:priority|urgency)\b/gi, level: 'medium', score: 40 },
  { re: /\b(?:strongly|highly)\s+recommended\s+(?:[\w-]+\s+){0,2}?(?:upgrade|update|release|for)\b|\b(?:release|update|upgrade|it)\s+is\s+(?:strongly|highly)\s+recommended\b|\bstrongly\s+(?:recommend|encourage|advise)\w*\s+(?:upgrading|updating|moving|that|all|operators|users)\b/gi, level: 'medium', score: 50 },
  { re: /\brecommended\s+(?:for\s+(?:all\b|(?:[\w-]+\s+){0,2}(?:users|operators|nodes|validators)\b)|update|upgrade|release|patch|maintenance|to\s+(?:upgrade|update))/gi, level: 'medium', score: 40 },
  { re: /\brecommend\s+(?:upgrading|updating|that\s+(?:all\s+)?(?:[\w-]+\s+){0,2}(?:users|operators|nodes)\s+(?:upgrade|update))\b/gi, level: 'medium', score: 40 },
  { re: /\b(?:should|encouraged\s+to|advised\s+to)\s+(?:upgrade|update)\b/gi, level: 'medium', score: 40, notFollowedBy: /^\s+(?:to\s+(?:consume|use|read|fetch)|your|their|the\s+(?:config\w*|binar\w+|scripts?|automation))\b/i },
  // low
  { re: /\blow[- ](?:priority|urgency)\b/gi, level: 'low', score: 10 },
  { re: /\boptional\s+(?:upgrade|update|release)\b/gi, level: 'low', score: 10 },
  { re: /\bno\s+(?:need|urgency)\s+to\s+(?:upgrade|update)\b/gi, level: 'low', score: 10, negatable: false },
];

interface Hit { start: number; end: number; level: Level; score: number; mandatory: boolean }

function hitsIn(sentence: string): Hit[] {
  const hits: Hit[] = [];
  // "If you are running v7.0.0 then you should update ..." is advice for a subset, not the release's level.
  // "If you haven't upgraded yet, we strongly recommend ..." addresses everyone and still counts.
  const conditional = /^(?:[-*+>]\s*)*if\b/i.test(sentence) && !/^(?:[-*+>]\s*)*if you (?:have not|haven't) (?:yet )?(?:upgraded|updated)/i.test(sentence);
  for (const p of STATEMENTS) {
    if (conditional && p.level !== 'high') continue;
    for (const m of sentence.matchAll(p.re)) {
      const start = m.index!; const end = start + m[0].length;
      if (p.negatable !== false && NEGATION_BEFORE.test(sentence.slice(Math.max(0, start - 25), start))) continue;
      if (p.notFollowedBy?.test(sentence.slice(end))) continue;
      hits.push({ start, end, level: p.level, score: p.score, mandatory: !!p.mandatory });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  // merge overlapping hits ("should upgrade as soon as practical"): keep the stronger one
  const merged: Hit[] = [];
  for (const h of hits) {
    const last = merged.at(-1);
    if (last && h.start < last.end) {
      if (h.score > last.score) { last.level = h.level; last.score = h.score; }
      last.mandatory ||= h.mandatory; last.end = Math.max(last.end, h.end);
    } else merged.push({ ...h });
  }
  return merged;
}

/**
 * Urgency statements with their network scope. A hit's own scope runs from the hit to the next
 * hit (cut at "except"); the text between the previous hit and this one is its lead-in. A statement
 * whose scope names only other chains ("`high-urgency` for Gnosis") is ignored.
 */
/** Legends that define the vocabulary ("high-urgency: update as soon as you can", "This table provides priorities ..."). */
const DEFINITION = /^(?:[-*+]\s*)?(?:high|medium|low|critical)[- ](?:urgency|priority)\s*:|\bthis table provides priorities\b|\bsee update priorities\b/i;

function readStatements(lead: string[]): Statement[] {
  const out: Statement[] = [];
  for (const s of lead) {
    if (DEFINITION.test(s)) continue;
    const hits = hitsIn(s);
    hits.forEach((h, i) => {
      const leadIn = s.slice(i === 0 ? 0 : hits[i - 1]!.end, h.start);
      let own = s.slice(h.start, hits[i + 1]?.start ?? s.length);
      const exc = own.search(/\bexcept\b/i); if (exc > 0) own = own.slice(0, exc);
      const context = leadIn + own;
      const nets = ethNetworks(context);
      if (OTHER_CHAINS.test(context) && nets.length === 0) return;
      const fork = (FORK_WORD.test(s) || !!latestWave(s)) && !/\bnot\s+(?:yet\s+)?(?:been\s+)?(?:scheduled|\S+-ready|ready)\b|n't\s+(?:yet\s+)?(?:been\s+)?scheduled/i.test(s);
      out.push({ level: h.level, score: h.score, mandatory: h.mandatory, networks: ethNetworks(i === 0 ? context : own), sentence: s, fork });
    });
  }
  return out;
}

/** "Update Priority" / "Upgrade Priority" tables (Lighthouse, Anchor, Reth, SSV, ...). */
function readPriorityTable(lines: string[]): Statement[] {
  const idx = lines.findIndex(l => /\b(update|upgrade) priority\b/i.test(l));
  if (idx < 0) return [];
  const out: Statement[] = [];
  let started = false;
  for (const l of lines.slice(idx + 1, idx + 16)) {
    if (!l.includes('|')) { if (started && l.trim()) break; continue; }
    started = true;
    const cells = l.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2 || cells.every(c => /^[-:\s]+$/.test(c))) continue;
    const [label, ...values] = cells as [string, ...string[]];
    if (/non[- ]?staking/i.test(label)) continue;
    let best: Level | null = null;
    for (const cell of values) {
      // "High for Gnosis, Low otherwise": drop clauses about other chains
      const v = cell.split(/[,;]/).filter(part => !(OTHER_CHAINS.test(part) && ethNetworks(part).length === 0)).join(' ');
      const lvl: Level | null = /\b(critical|mandatory|required|high)\b/i.test(v) ? 'high' : /\b(medium|recommended)\b/i.test(v) ? 'medium' : /\b(low|optional)\b/i.test(v) ? 'low' : null;
      if (lvl && (!best || LEVEL_RANK[lvl] > LEVEL_RANK[best])) best = lvl;
    }
    if (!best) continue;
    out.push({ level: best, score: best === 'high' ? 70 : best === 'medium' ? 40 : 10, mandatory: false, networks: ethNetworks(label), sentence: clip(cells.join(' | '), 160), fork: false });
  }
  return out;
}

/* -------------------------------------------------------------------- forks -- */
const SCHEDULE = /\bscheduled\b|\bschedul(?:es|ing)\s+(?:the\s+)?(?:[\w()-]+\s+){0,3}(?:fork|hard ?fork|upgrade|activation|pectra|prague|electra|fusaka|fulu|osaka|glamsterdam|gloas|amsterdam|hegota|heze|bogota)\b|\benabl(?:es|ing)\b|\bfork (?:epoch|time|timestamp|block)\b|\bactivation (?:epoch|time|timestamp)\b|\bat epoch\s*\d|\btimestamp\s*\d{9,}|\bepoch\s+\d{3,}/i;
const NOT_SCHEDULED = /\bnot\s+(?:yet\s+)?(?:been\s+)?scheduled\b|n't\s+(?:yet\s+)?(?:been\s+)?scheduled\b|\bunscheduled\b|\bTB[AD]\b/i;
const WAVE_WORDS = FORK_WAVES.map(([, re]) => re.source.replace(/^\\b\(|\)\\b$/g, '')).join('|');
const READINESS = new RegExp(`\\b(?:ready for|(?:prepares?|primes?)\\s+(?:[\\w-]+\\s+){0,3}for|supports?(?: for)?|compatible with)\\s+(?:the\\s+)?(?:upcoming\\s+|impending\\s+)?(?:[\\w-]+\\s+)?(?:${WAVE_WORDS}|hard ?fork|fork)\\b|\\b(?:${WAVE_WORDS})-ready\\b`, 'i');
const NOT_READY = /\bnot\b|n't\b|\bwill be\b/i;

interface ForkRead { schedules: Statement[]; ready: string | null; wave: string | null }

function readForks(p: Prepared): ForkRead {
  const schedules: Statement[] = []; let ready: string | null = null; let wave: string | null = null;
  for (const s of p.lead) {
    const w = latestWave(s);
    if (!w && !FORK_WORD.test(s)) continue;
    const nets = ethNetworks(s);
    // Gas-limit schedules are fork configuration, not the fork being scheduled.
    if (SCHEDULE.test(s) && !NOT_SCHEDULED.test(s) && !/\bgas[_ ]limit\b/i.test(s) && nets.length > 0) {
      schedules.push({ level: 'high', score: 60, mandatory: false, networks: nets, sentence: s, fork: true });
      wave ??= w;
    } else if (READINESS.test(s) && !NOT_READY.test(s) && !(OTHER_CHAINS.test(s) && nets.length === 0)) {
      ready ??= s;
      wave ??= w;
    }
  }
  return { schedules, ready, wave };
}

/* ------------------------------------------------------------------ signals -- */
const SECURITY = /\b(?:security[- ](?:fix(?:es)?|patch(?:es)?|release|update|issues?|vulnerabilit(?:y|ies)|advisor(?:y|ies)|bugs?|focused|critical|hardening)|vulnerabilit(?:y|ies)|vulnerable|cve-\d{4}-\d+|ghsa(?:-[0-9a-z]{4}){3}|denial[- ]of[- ]service|dos (?:risk|attack|vector|vulnerabilit\w*|issues?|resistance)|remote code execution|exploitable)\b/i;
const NO_SECURITY = /\bno (?:known )?security (?:fix|update|issue|change|patch)/i;
const CHANGELOG_SECURITY = /\b(?:cve-\d{4}-\d+|ghsa-[0-9a-z-]+|security (?:fix|patch)(?:es)?|fix(?:es|ed)?\s+(?:[\w-]+\s+){0,4}vulnerabilit(?:y|ies))\b/i;
const HOTFIX = /\b(?:hot-?fix|critical (?:bug|fix|issue)s?)\b/i;
const BREAKING_INLINE = /(?<!upcoming |no |non-|without )\bbreaking changes?\b|\brequires? (?:a )?(?:full )?(?:re-?sync|database (?:migration|upgrade)|migration)\b/i;
const CONSENSUS = /\b(?:risk of (?:being )?slash\w*|(?:could|may|might|can) (?:lead to|result in|cause) (?:a |being )?slash\w*|slashing protection (?:bug|issue|fix|import)|fix(?:es|ed)? [^.]{0,40}slashing protection|missed (?:attestation|proposal|block|dut)\w*|chain split|consensus (?:bug|failure|issue|split|fault)s?|forked off|falsely rejected|invalid blocks?\b(?!\s*hash)|(?:loss of|lost) finality|finality (?:issue|incident|loss))\b/i;
const DEPRECATION = /\bdeprecat(?:ed|ion|es)\b|\bremoved? (?:the )?(?:flag|option|support)\b/i;
const PERFORMANCE = /\b(?:performance|faster|memory (?:usage|leak)|cpu usage|optimi[sz]\w*)\b/i;

/** Body of a heading section ("### Security", "Breaking Changes") up to the next heading. */
function section(lines: string[], heading: RegExp): string | null {
  const i = lines.findIndex(l => heading.test(l.trim()));
  if (i < 0) return null;
  const body: string[] = [];
  for (const l of lines.slice(i + 1)) { if (/^\s*#{1,6}\s/.test(l)) break; body.push(l); }
  const text = body.join('\n').trim();
  const content = text.replace(/[-*+\s]/g, '');
  if (content.length < 4 || /^(n\/?a|none|nothing|no\b|-)/i.test(text.replace(/^[-*+\s]+/, ''))) return null;
  return text;
}

interface Signals { score: number; flags: Set<Flag>; evidence: Evidence[]; security: boolean; hotfix: boolean; consensus: boolean }

function readSignals(p: Prepared): Signals {
  const flags = new Set<Flag>(); const evidence: Evidence[] = []; let score = 0;
  const firstMatch = (re: RegExp) => p.sentences.find(s => re.test(s) && !NO_SECURITY.test(s));

  let sec = 0;
  const secSentence = firstMatch(SECURITY);
  if (secSentence) { sec = 40; evidence.push({ kind: 'keyword', text: `security wording: "${clip(secSentence, 180)}"`, weight: 40 }); }
  const secSection = section(p.lines, /^#{1,6}\s*\W*\s*security\b/i);
  if (secSection && !NO_SECURITY.test(secSection)) { evidence.push({ kind: 'heading', text: `Security: ${clip(secSection, 160)}`, weight: 40 }); sec = 40; }
  const secEntry = p.changelog.find(l => CHANGELOG_SECURITY.test(l));
  if (secEntry) { evidence.push({ kind: 'keyword', text: `changelog entry: "${clip(secEntry, 160)}"`, weight: 15 }); sec = Math.max(sec, 15); }
  if (sec) { flags.add('security'); score += sec; }

  const add = (re: RegExp, flag: Flag | null, weight: number, label: string) => {
    const s = p.sentences.find(x => !/^#{1,6}\s/.test(x) && re.test(x));
    if (!s) return false;
    if (flag) flags.add(flag);
    score += weight; evidence.push({ kind: 'keyword', text: `${label}: "${clip(s, 180)}"`, weight });
    return true;
  };
  const hotfix = add(HOTFIX, 'hotfix', 20, 'hotfix wording');
  const consensus = add(CONSENSUS, null, 25, 'consensus-safety wording');

  const brk = section(p.lines, /^(?:#{1,6}\s*)?breaking changes?:?$/i);
  if (brk) { flags.add('breaking'); score += 25; evidence.push({ kind: 'heading', text: `Breaking changes: ${clip(brk, 160)}`, weight: 25 }); }
  else add(BREAKING_INLINE, 'breaking', 25, 'breaking wording');

  add(DEPRECATION, 'deprecation', 1, 'deprecation wording');
  add(PERFORMANCE, 'performance', 1, 'performance wording');
  return { score, flags, evidence, security: sec > 0, hotfix, consensus };
}

/* -------------------------------------------------------------- entrypoint -- */
function clampToBand(score: number, severity: Severity): number {
  const [lo, hi] = BANDS[severity];
  return Math.max(lo, Math.min(hi, Math.round(score)));
}

/** Several statements in one sentence ("mandatory for Hoodi and recommended for mainnet") become one evidence line. */
function mergeBySentence(statements: Statement[]): Evidence[] {
  const bySentence = new Map<string, Statement[]>();
  for (const s of statements) bySentence.set(s.sentence, [...(bySentence.get(s.sentence) ?? []), s]);
  return [...bySentence.entries()].map(([sentence, ss]) => {
    const parts = [...new Set(ss.map(s => `${s.level} (${s.networks.length ? s.networks.join(', ') : 'all networks'})`))];
    return { kind: 'statement' as const, text: `${parts.join('; ')}: ${clip(sentence, 200)}`, weight: Math.max(...ss.map(s => s.score)) };
  });
}

function statementEvidence(s: Statement, kind: Evidence['kind']): Evidence {
  const scope = s.networks.length ? s.networks.join(', ') : 'all networks';
  return { kind, text: `${s.level} (${scope}): ${clip(s.sentence, 200)}`, weight: s.score };
}

export function assessRelease(release: Release, assessor: Assessor, opts: { capSeverity?: Severity } = {}): Assessment {
  // `assessor` is kept for provenance; the parsers below cover every format the catalog uses.
  const p = prepare(release.name, release.body);
  const table = readPriorityTable(p.lines);
  const statements = readStatements(p.lead);
  const forks = readForks(p);
  const signals = readSignals(p);

  const flags = new Set<Flag>(signals.flags);
  const evidence: Evidence[] = [
    ...table.map(s => statementEvidence(s, 'table')),
    ...mergeBySentence(statements),
    ...forks.schedules.map(s => ({ ...statementEvidence(s, 'statement'), text: `fork scheduled (${s.networks.join(', ')}): ${clip(s.sentence, 200)}` })),
  ];

  // The team's own words win; a scheduled fork only implies "high" when the notes state no level at all.
  const explicit = [...table, ...statements];
  const stated = explicit.length ? explicit : forks.schedules;
  if (stated.some(s => s.mandatory && s.level === 'high')) flags.add('mandatory');
  const forkDriven = statements.filter(s => s.fork && s.level !== 'low');
  if (forks.schedules.length || forkDriven.length) flags.add('hardfork');

  let signalScore = signals.score;
  if (forks.ready && !flags.has('hardfork')) {
    flags.add('hardfork'); signalScore += 5;
    evidence.push({ kind: 'keyword', text: `fork readiness: "${clip(forks.ready, 180)}"`, weight: 5 });
  }
  evidence.push(...signals.evidence);

  let severity: Severity; let score: number;
  const top = stated.reduce<Statement | null>((b, s) => (!b || LEVEL_RANK[s.level] > LEVEL_RANK[b.level] || (s.level === b.level && s.score > b.score) ? s : b), null);
  if (top) {
    severity = top.level === 'high' ? (signals.security ? 'critical' : 'high') : top.level === 'medium' ? 'recommended' : 'optional';
    score = top.score + signalScore * 0.5 + (severity === 'critical' ? 15 : 0);
  } else {
    score = signalScore;
    // Without a statement from the team, only risk signals (security, hotfix, consensus safety) can reach high.
    const risk = signals.security || signals.hotfix || signals.consensus;
    severity = signals.security && (signals.hotfix || signals.consensus) && score >= 60 ? 'critical'
      : risk && score >= 60 ? 'high' : score >= 25 ? 'recommended' : score > 0 ? 'optional' : 'unassessed';
  }

  const networks = ethNetworks(p.sentences.join(' '));
  const wave = forks.wave ?? dominantWave(forkDriven.map(s => s.sentence).join(' ')) ?? dominantWave(p.lead.join(' ')) ?? dominantWave(p.sentences.join(' '));
  if (release.is_prerelease) {
    flags.add('prerelease');
    if (networks.length && !networks.includes('mainnet')) flags.add('testnet-only');
  }

  if (opts.capSeverity && SEVERITY_RANK[severity] > SEVERITY_RANK[opts.capSeverity]) severity = opts.capSeverity;
  score = clampToBand(score, severity);
  return {
    release_tag: release.tag,
    component_slug: release.component_slug,
    severity,
    score,
    flags: [...flags],
    networks,
    wave,
    evidence: evidence.sort((a, b) => b.weight - a.weight).slice(0, 12),
    assessor,
    assessor_version: ASSESSOR_VERSION,
  };
}
