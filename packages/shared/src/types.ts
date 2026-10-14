// Shared domain types. Keep in sync with supabase/migrations and catalog/schema.

export type Role =
  | 'execution' | 'consensus' | 'validator' | 'dvt' | 'remote-signer' | 'mev'
  | 'node-manager' | 'monitoring' | 'protocol' | 'key-tooling' | 'ui'
  | 'network-config' | 'spec' | 'infra';

export type ComponentStatus = 'active' | 'beta' | 'experimental' | 'maintenance' | 'deprecated' | 'archived';

export type Assessor =
  | 'lighthouse-table' | 'reth-table' | 'nimbus-urgency' | 'geth-prose'
  | 'teku-notes' | 'prysm-notes' | 'charon-notes' | 'generic';

export interface ComponentSupports {
  charon?: boolean; ssv?: boolean; web3signer?: boolean; dirk?: boolean;
  mev_boost?: boolean; commit_boost?: boolean; keymanager_api?: boolean; doppelganger?: boolean;
}

export interface Component {
  slug: string;
  name: string;
  vendor?: string;
  summary?: string;
  roles: Role[];
  repo: string;                 // owner/name
  release_source?: 'releases' | 'tags';
  stable_tag_pattern?: string;
  homepage?: string;
  docs?: string;
  docker_image?: string;
  language?: string;
  license?: string;
  networks?: string[];
  status: ComponentStatus;
  assessor: Assessor;
  embeds?: Array<'validator' | 'consensus'>;
  supports?: ComponentSupports;
  tags?: string[];
  priority_weight?: number;
  notes?: string;
}

export interface Slot {
  id: string;
  label: string;
  description?: string;
  role: Role;
  cardinality: 'one' | 'many';
  required: boolean;
  hidden_by_default?: boolean;
  order?: number;
  include_tag?: string;
  exclude_tag?: string;
}

export interface RuleWhen { component?: string; any_of?: string[]; slot_filled?: string; network?: string }
export interface RuleRestrict { slot: string; to?: string[]; to_supporting?: keyof ComponentSupports }
export type ClusterRole = 'execution' | 'consensus' | 'validator';
export interface ClusterSpec { default_nodes?: number; roles: ClusterRole[] }
export interface RuleThen {
  open_slots?: string[]; hide_slots?: string[]; require_slots?: string[];
  allow_many?: string[]; cluster?: ClusterSpec;
  restrict?: RuleRestrict[]; recommend?: string[]; require?: string[]; conflict?: string[]; warn?: string;
}
export interface Rule { id: string; description?: string; when: RuleWhen; then: RuleThen }
export interface SlotsFile { slots: Slot[]; rules: Rule[] }

export interface Network {
  id: string; name: string; kind: 'mainnet' | 'testnet' | 'ephemeral';
  chain_id?: number; config_repo?: string; rollout_order: number; deprecated?: boolean; description?: string;
}
export type WaveStatus = 'planning' | 'in_progress' | 'completed';
export interface Wave { id: string; name: string; status: WaveStatus; meta_eip?: string | null }
export type UpgradeStatus = 'draft' | 'planned' | 'scheduled' | 'activated' | 'cancelled';
export interface Upgrade {
  id: string; wave: string; network: string; status: UpgradeStatus;
  activation_epoch?: number | null; activation_time?: string | null; announcement?: string | null;
  verified?: boolean; tentative?: boolean; required_versions: Record<string, string>; notes?: string;
}
export interface NetworksFile { networks: Network[]; rollout_sequence: string[]; waves: Wave[]; upgrades: Upgrade[] }

export interface Catalog {
  components: Component[];
  slots: Slot[];
  rules: Rule[];
  networks: Network[];
  rollout_sequence: string[];
  waves: Wave[];
  upgrades: Upgrade[];
}

// ---------------------------------------------------------------- releases --
export type Severity = 'critical' | 'high' | 'recommended' | 'optional' | 'unassessed';
export type Flag = 'security' | 'mandatory' | 'hardfork' | 'breaking' | 'hotfix' | 'prerelease' | 'testnet-only' | 'performance' | 'deprecation';

export interface Release {
  id?: number;
  component_slug: string;
  repo: string;
  tag: string;
  name?: string | null;
  url: string;
  body?: string | null;
  is_prerelease: boolean;
  is_draft?: boolean;
  published_at: string;
  github_node_id?: string | null;
  github_database_id?: number | null;
  source: 'releases' | 'tags';
}

export interface Evidence { kind: 'table' | 'heading' | 'keyword' | 'manual'; text: string; weight: number }

export interface Assessment {
  release_tag: string;
  component_slug: string;
  severity: Severity;
  score: number;                 // 0..100, pre-weight
  flags: Flag[];
  networks?: string[];           // networks mentioned (fork tags, "hoodi", ...)
  wave?: string | null;          // fork wave detected in notes
  evidence: Evidence[];
  assessor: Assessor;
  assessor_version: string;
  overridden?: boolean;
  summary?: string | null;
}

// ------------------------------------------------------------------ stacks --
export interface StackSelection {
  // slot id -> component slug(s). `network` holds network ids.
  [slotId: string]: string[];
}
/** One machine in a DVT cluster. Each node may run different clients. */
export interface ClusterNode { label?: string; execution?: string; consensus?: string; validator?: string }
export interface Topology { nodes: ClusterNode[]; threshold?: number }

export interface Stack {
  id?: string; slug?: string; name: string; selection: StackSelection;
  topology?: Topology | null;
  running_versions?: Record<string, string>;   // component slug -> version the operator runs now (optional)
  created_at?: string; owner_id?: string | null;
}
