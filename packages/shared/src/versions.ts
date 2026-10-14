import semver from 'semver';

/** Normalise a git tag into a semver string, or null when it is not a version tag. */
export function tagToVersion(tag: string): string | null {
  const cleaned = tag.trim()
    .replace(/^(release[-/]|rel[-/]|version[-/])/i, '')
    .replace(/^v(?=\d)/i, '');
  // Only tags that start with a number are versions; "zisk-guest-r8" or "tests-bogota@v1" are other artifacts.
  if (!/^\d/.test(cleaned)) return null;
  const coerced = semver.valid(cleaned) ?? semver.valid(semver.coerce(cleaned, { includePrerelease: true }));
  return coerced;
}

/** True when the tag matches the component's stable pattern (or looks like a plain semver when none is given). */
export function isStableTag(tag: string, pattern?: string): boolean {
  if (pattern) return new RegExp(pattern).test(tag);
  const v = tagToVersion(tag);
  return !!v && semver.prerelease(v) === null;
}

export function compareVersions(a: string, b: string): number {
  const va = tagToVersion(a); const vb = tagToVersion(b);
  if (!va || !vb) return 0;
  return semver.compare(va, vb);
}

/** Does `running` satisfy the minimum `required`? Unknown/unparseable -> null. */
export function satisfiesMinimum(running: string | undefined, required: string | undefined): boolean | null {
  if (!running || !required) return null;
  const vr = tagToVersion(running); const vq = tagToVersion(required);
  if (!vr || !vq) return null;
  return semver.gte(vr, vq);
}

export function newest(tags: string[]): string | null {
  const parsed = tags.map(t => ({ t, v: tagToVersion(t) })).filter(x => x.v) as Array<{ t: string; v: string }>;
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => semver.rcompare(a.v, b.v));
  return parsed[0]!.t;
}
