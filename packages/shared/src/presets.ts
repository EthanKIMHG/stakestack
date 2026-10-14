import type { StackSelection, Topology } from './types';

/** Starting points for the stack builder. Every preset must compose without errors (see tests). */
export interface Preset {
  id: string;
  name: string;
  blurb: string;
  selection: StackSelection;
  topology?: Topology;
}

export const PRESETS: Preset[] = [
  {
    id: 'solo',
    name: 'Solo staker',
    blurb: 'One machine. Nethermind + Lighthouse, MEV-Boost, Eth Docker.',
    selection: {
      network: ['hoodi', 'mainnet'],
      execution: ['nethermind'], consensus: ['lighthouse'], validator: ['lighthouse'],
      mev: ['mev-boost'], 'node-manager': ['eth-docker'], monitoring: ['ethereum-metrics-exporter'],
    },
  },
  {
    id: 'minority',
    name: 'Minority clients',
    blurb: 'Besu + Teku with Web3Signer. Good for client diversity.',
    selection: {
      network: ['hoodi', 'mainnet'],
      execution: ['besu'], consensus: ['teku'], validator: ['teku'],
      'remote-signer': ['web3signer'], mev: ['mev-boost'],
    },
  },
  {
    id: 'obol-4',
    name: 'Obol DVT, 4 nodes',
    blurb: 'Charon cluster, threshold 3 of 4, a different EL/CL pair on every node.',
    selection: {
      network: ['hoodi', 'mainnet'],
      dvt: ['charon'], 'dvt-extras': ['charon-distributed-validator-node'],
      mev: ['mev-boost'], monitoring: ['obol-monitoring', 'ethereum-metrics-exporter'],
    },
    topology: {
      nodes: [
        { label: 'node-1', execution: 'nethermind', consensus: 'lighthouse', validator: 'lighthouse' },
        { label: 'node-2', execution: 'geth', consensus: 'teku', validator: 'teku' },
        { label: 'node-3', execution: 'besu', consensus: 'nimbus-eth2', validator: 'nimbus-eth2' },
        { label: 'node-4', execution: 'reth', consensus: 'lodestar', validator: 'lodestar' },
      ],
    },
  },
  {
    id: 'ssv',
    name: 'SSV operator',
    blurb: 'SSV node performs duties itself; Geth + Teku as its EL/CL.',
    selection: {
      network: ['hoodi', 'mainnet'],
      dvt: ['ssv-node'], 'dvt-extras': ['ssv-dkg'], mev: ['mev-boost'],
    },
    topology: { nodes: [{ label: 'node-1', execution: 'geth', consensus: 'teku' }] },
  },
  {
    id: 'lido-csm',
    name: 'Lido CSM operator',
    blurb: 'Community Staking Module with the required validator-ejector.',
    selection: {
      network: ['hoodi', 'mainnet'],
      execution: ['geth'], consensus: ['teku'], validator: ['teku'],
      mev: ['mev-boost'], protocol: ['lido-csm', 'validator-ejector'], monitoring: ['ethereum-validators-monitoring'],
    },
  },
  {
    id: 'rocket-pool',
    name: 'Rocket Pool node',
    blurb: 'Smartnode manages the containers; Nethermind + Nimbus.',
    selection: {
      network: ['hoodi', 'mainnet'],
      execution: ['nethermind'], consensus: ['nimbus-eth2'], validator: ['nimbus-eth2'],
      protocol: ['rocketpool-smartnode'], mev: ['mev-boost'],
    },
  },
];
