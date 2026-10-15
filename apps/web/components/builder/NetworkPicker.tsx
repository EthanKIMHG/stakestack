'use client';
import { Check, Plus } from 'lucide-react';
import { upgradePhase } from '@stakestack/shared/readiness';
import type { Catalog } from '@stakestack/shared/types';
import { fmtDate, relative, waveName } from '@/lib/format';
import { NetworkGlyph } from '../icons';

const KIND: Record<string, string> = { mainnet: 'Production', testnet: 'Testnet', ephemeral: 'Resets often' };

export function NetworkPicker({ catalog, selected, onToggle }: { catalog: Catalog; selected: string[]; onToggle: (id: string) => void }) {
  const networks = catalog.networks.filter(n => !n.deprecated).sort((a, b) => (a.rollout_order || 9) - (b.rollout_order || 9));
  return (
    <div className="step-body">
      <div className="net-grid">
        {networks.map(n => {
          const on = selected.includes(n.id);
          const up = catalog.upgrades
            .filter(u => u.network === n.id && u.status !== 'cancelled' && u.status !== 'draft')
            .sort((a, b) => (b.activation_time ?? '9999').localeCompare(a.activation_time ?? '9999'))[0] ?? null;
          const ph = upgradePhase(up);
          return (
            <div key={n.id} className="product net-card">
              <button type="button" className="product-btn" aria-pressed={on} onClick={() => onToggle(n.id)}>
                <NetworkGlyph id={n.id} size={26} />
                <span className="product-name">{n.name}</span>
                <span className="product-meta">{KIND[n.kind] ?? n.kind}</span>
                {up && (
                  <span className="product-tags">
                    <span className={`pill pill-sm ${ph === 'activated' ? 'pill-ok' : ph === 'upcoming' ? 'pill-accent' : ''}`}>
                      {waveName(up.wave)} · {ph === 'activated' ? fmtDate(up.activation_time) : ph === 'upcoming' ? `${up.tentative ? '~' : ''}${relative(up.activation_time)}` : 'TBA'}
                    </span>
                  </span>
                )}
              </button>
              <span className="product-pick" aria-hidden>{on ? <Check strokeWidth={3} /> : <Plus strokeWidth={2.5} />}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
