// Client-safe types shared by server loaders and client components.
export interface Evidence { kind: string; text: string; weight: number }
export interface TimelineRow {
  component_slug: string; component_name: string; tag: string; name: string | null; url: string; is_prerelease: boolean; published_at: string;
  severity: string; score: number; flags: string[]; networks: string[]; wave_id: string | null; evidence: Evidence[]; weighted_score: number;
}
