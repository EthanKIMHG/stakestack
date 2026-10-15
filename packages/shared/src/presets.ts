import type { StackSelection, Topology } from './types';

export type PresetGroup = 'single' | 'dvt' | 'protocol' | 'multi-bn';

export const PRESET_GROUPS: Array<{ id: PresetGroup; label: string; hint: string }> = [
  { id: 'single', label: 'Single node', hint: 'One machine runs EL, CL and VC.' },
  { id: 'dvt', label: 'DVT cluster', hint: 'One validator split across several nodes (Obol, SSV).' },
  { id: 'protocol', label: 'Staking protocol', hint: 'Run validators for Lido, Rocket Pool, StakeWise or EigenLayer.' },
  { id: 'multi-bn', label: 'Multi-node VC', hint: 'One validator client over several beacon nodes, with a remote signer.' },
];

/**
 * Starting points for the stack builder. Every preset must compose without errors or warnings,
 * and cite the documentation its shape comes from (see __tests__/sources.test.ts).
 */
export interface Preset {
  id: string;
  name: string;
  blurb: string;
  group: PresetGroup;
  selection: StackSelection;
  topology?: Topology;
  /** Official docs the template follows: protocol requirements, supported clients, recommended setup. */
  sources: string[];
  /** Date (YYYY-MM-DD) the template was last checked against its sources. */
  verified_at: string;
}

const NETS = ['hoodi', 'mainnet'];

export const PRESETS: Preset[] = [
  // ------------------------------------------------------------ single node --
  {
    id: 'solo',
    name: 'Solo staker',
    blurb: 'One machine. Nethermind + Lighthouse, MEV-Boost, Eth Docker.',
    group: 'single',
    selection: {
      network: NETS,
      execution: ['nethermind'], consensus: ['lighthouse'], validator: ['lighthouse'],
      mev: ['mev-boost'], 'node-manager': ['eth-docker'], monitoring: ['ethereum-metrics-exporter'],
    },
    sources: ['https://github.com/eth-educators/eth-docker', 'https://github.com/flashbots/mev-boost'],
    verified_at: '2026-10-15',
  },
  {
    id: 'minority',
    name: 'Minority clients',
    blurb: 'Besu + Teku, the Consensys pair, with Web3Signer holding keys and slashing protection.',
    group: 'single',
    selection: {
      network: NETS,
      execution: ['besu'], consensus: ['teku'], validator: ['teku'],
      'remote-signer': ['web3signer'], mev: ['mev-boost'],
    },
    sources: ['https://clientdiversity.org', 'https://docs.web3signer.consensys.com/concepts/slashing-protection'],
    verified_at: '2026-10-15',
  },
  {
    id: 'erigon-caplin',
    name: 'Erigon + Caplin',
    blurb: 'Erigon with its embedded consensus layer. Caplin has no VC, so the Lighthouse VC connects to its Beacon API.',
    group: 'single',
    selection: {
      network: NETS,
      execution: ['erigon'], consensus: ['caplin'], validator: ['lighthouse'], mev: ['mev-boost'],
    },
    sources: ['https://docs.erigon.tech/staking/caplin'],
    verified_at: '2026-10-15',
  },
  {
    id: 'commit-boost',
    name: 'Solo with Commit-Boost',
    blurb: 'Reth + Lighthouse with Commit-Boost instead of MEV-Boost: same relays and builder API, plus modules such as preconfirmations.',
    group: 'single',
    selection: {
      network: NETS,
      execution: ['reth'], consensus: ['lighthouse'], validator: ['lighthouse'], mev: ['commit-boost'],
    },
    sources: ['https://commit-boost.github.io/commit-boost-client/get_started/overview'],
    verified_at: '2026-10-15',
  },

  // ------------------------------------------------------------ DVT cluster --
  {
    id: 'obol-4',
    name: 'Obol DVT, 4 nodes',
    blurb: 'Charon cluster, threshold 3 of 4, a different EL/CL pair on every node.',
    group: 'dvt',
    selection: {
      network: NETS,
      dvt: ['charon'], mev: ['mev-boost'], monitoring: ['obol-monitoring'],
    },
    topology: {
      nodes: [
        { label: 'node-1', execution: 'nethermind', consensus: 'lighthouse', validator: 'lighthouse' },
        { label: 'node-2', execution: 'geth', consensus: 'teku', validator: 'teku' },
        { label: 'node-3', execution: 'besu', consensus: 'nimbus-eth2', validator: 'nimbus-eth2' },
        { label: 'node-4', execution: 'reth', consensus: 'lodestar', validator: 'lodestar' },
      ],
    },
    sources: ['https://docs.obol.org/learn/charon/cluster-configuration', 'https://github.com/ObolNetwork/charon/releases'],
    verified_at: '2026-10-15',
  },
  {
    id: 'obol-web3signer',
    name: 'Obol DVT + Web3Signer',
    blurb: 'The 4-node Charon cluster with each key share held in Web3Signer instead of the validator client.',
    group: 'dvt',
    selection: {
      network: NETS,
      dvt: ['charon'], 'remote-signer': ['web3signer'], mev: ['mev-boost'], monitoring: ['obol-monitoring'],
    },
    topology: {
      nodes: [
        { label: 'node-1', execution: 'nethermind', consensus: 'lighthouse', validator: 'lighthouse' },
        { label: 'node-2', execution: 'geth', consensus: 'teku', validator: 'teku' },
        { label: 'node-3', execution: 'besu', consensus: 'nimbus-eth2', validator: 'nimbus-eth2' },
        { label: 'node-4', execution: 'reth', consensus: 'lodestar', validator: 'lodestar' },
      ],
    },
    sources: ['https://docs.obol.org/run-a-dv/prepare/deployment-best-practices', 'https://docs.web3signer.consensys.com/concepts/slashing-protection'],
    verified_at: '2026-10-15',
  },
  {
    id: 'ssv',
    name: 'SSV operator',
    blurb: 'SSV node performs duties itself; Geth + Teku as its EL/CL. Your node is one operator in a 4, 7, 10 or 13 operator cluster.',
    group: 'dvt',
    selection: {
      network: NETS,
      dvt: ['ssv-node'], 'dvt-extras': ['ssv-dkg'], mev: ['mev-boost'],
    },
    topology: { nodes: [{ label: 'node-1', execution: 'geth', consensus: 'teku' }] },
    sources: ['https://docs.ssv.network/operators/operator-node/node-setup/', 'https://docs.ssv.network/learn/network-overview/clusters/cluster-creation'],
    verified_at: '2026-10-15',
  },
  {
    id: 'anchor',
    name: 'SSV operator on Anchor',
    blurb: "Sigma Prime's Rust SSV client instead of the Go node, for client diversity inside SSV clusters. Besu + Lighthouse underneath.",
    group: 'dvt',
    selection: {
      network: NETS,
      dvt: ['anchor'], 'dvt-extras': ['ssv-dkg'], mev: ['mev-boost'],
    },
    topology: { nodes: [{ label: 'node-1', execution: 'besu', consensus: 'lighthouse' }] },
    sources: ['https://anchor-book.sigmaprime.io/running_an_operator/', 'https://github.com/sigp/anchor/releases'],
    verified_at: '2026-10-15',
  },

  // ------------------------------------------------------- staking protocol --
  {
    id: 'lido-csm',
    name: 'Lido CSM operator',
    blurb: 'Community Staking Module with the validator-ejector for exit requests. Nethermind + Teku.',
    group: 'protocol',
    selection: {
      network: NETS,
      execution: ['nethermind'], consensus: ['teku'], validator: ['teku'],
      mev: ['mev-boost'], protocol: ['lido-csm', 'validator-ejector', 'lido-keys-api'], monitoring: ['ethereum-validators-monitoring'],
    },
    sources: ['https://docs.lido.fi/staking-modules/validator-exits', 'https://docs.lido.fi/run-on-lido/csm/troubleshooting/setting-the-fee-recipient-for-csm-validators', 'https://docs.lido.fi/run-on-lido/csm/troubleshooting/mev-install'],
    verified_at: '2026-10-15',
  },
  {
    id: 'rocket-pool',
    name: 'Rocket Pool node',
    blurb: 'Smartnode runs the containers (megapools since Saturn 1); Nethermind + Nimbus.',
    group: 'protocol',
    selection: {
      network: NETS,
      execution: ['nethermind'], consensus: ['nimbus-eth2'], validator: ['nimbus-eth2'],
      protocol: ['rocketpool-smartnode'], mev: ['mev-boost'],
    },
    sources: ['https://docs.rocketpool.net/node-staking/eth-clients', 'https://docs.rocketpool.net/node-staking/install-modes', 'https://docs.rocketpool.net/upgrades/saturn-1/whats-new'],
    verified_at: '2026-10-15',
  },
  {
    id: 'stakewise',
    name: 'StakeWise V3 vault operator',
    blurb: 'The v3 operator service registers validators for your vault; Geth + Lodestar perform the duties.',
    group: 'protocol',
    selection: {
      network: NETS,
      execution: ['geth'], consensus: ['lodestar'], validator: ['lodestar'],
      protocol: ['stakewise-v3-operator'], mev: ['mev-boost'],
    },
    sources: ['https://github.com/stakewise/v3-operator', 'https://docs.stakewise.io/operator/operator-service-v3/run-operator-service-v3/prepare-operator'],
    verified_at: '2026-10-15',
  },
  {
    id: 'eigenpod',
    name: 'Solo with native restaking',
    blurb: 'A solo stack whose withdrawal credentials point at an EigenPod, with the proofs CLI for credential and checkpoint proofs.',
    group: 'protocol',
    selection: {
      network: NETS,
      execution: ['nethermind'], consensus: ['lighthouse'], validator: ['lighthouse'],
      mev: ['mev-boost'], protocol: ['eigenpod-proofs'],
    },
    sources: ['https://github.com/Layr-Labs/eigenpod-proofs-generation/blob/master/cli/README.md'],
    verified_at: '2026-10-15',
  },

  // --------------------------------------------------------- multi-node VC --
  {
    id: 'vouch-dirk',
    name: 'Vouch + Dirk',
    blurb: 'Vouch spreads duties over two beacon nodes; Dirk signs with distributed keys.',
    group: 'multi-bn',
    selection: {
      network: NETS,
      execution: ['nethermind', 'besu'], consensus: ['lighthouse', 'teku'], validator: ['vouch'],
      'remote-signer': ['dirk'], mev: ['mev-boost'],
    },
    sources: ['https://github.com/attestantio/vouch', 'https://github.com/attestantio/vouch/blob/master/docs/accountmanager.md', 'https://github.com/attestantio/dirk'],
    verified_at: '2026-10-15',
  },
  {
    id: 'vero',
    name: 'Vero, 3 beacon nodes',
    blurb: 'Vero attests only when a majority of three different beacon nodes agree, and signs through Web3Signer.',
    group: 'multi-bn',
    selection: {
      network: NETS,
      execution: ['nethermind', 'besu', 'reth'], consensus: ['lighthouse', 'teku', 'lodestar'], validator: ['vero'],
      'remote-signer': ['web3signer'], mev: ['mev-boost'],
    },
    sources: ['https://vero.docs.serenita.io/', 'https://vero.docs.serenita.io/reference/using_multiple_beacon_nodes/'],
    verified_at: '2026-10-15',
  },
];
