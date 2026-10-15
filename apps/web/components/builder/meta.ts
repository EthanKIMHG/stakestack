import { Activity, FileKey, KeyRound, LayoutDashboard, Puzzle, ScrollText, Server, Split, Wrench, Zap, type LucideIcon } from 'lucide-react';

/** Short names for slot tabs and cart rows; the catalog labels are written for docs. */
export const SLOT_SHORT: Record<string, string> = {
  execution: 'Execution', consensus: 'Consensus', validator: 'Validator', dvt: 'DVT', 'dvt-extras': 'DVT extras',
  'remote-signer': 'Signer', mev: 'MEV', protocol: 'Protocols', 'node-manager': 'Node manager', monitoring: 'Monitoring',
  'key-tooling': 'Keys', ui: 'Dashboards', spec: 'Specs',
};

export const SLOT_ICON: Record<string, LucideIcon> = {
  'dvt-extras': Split, 'remote-signer': KeyRound, mev: Zap, protocol: Puzzle, 'node-manager': Wrench, monitoring: Activity,
  'key-tooling': FileKey, ui: LayoutDashboard, spec: ScrollText,
};
export const DEFAULT_SLOT_ICON = Server;

export const ROLE_SHORT: Record<string, string> = { execution: 'EL', consensus: 'CL', validator: 'VC' };

export const slotShort = (id: string, label: string) => SLOT_SHORT[id] ?? label.replace(/ \(.+\)$/, '');
