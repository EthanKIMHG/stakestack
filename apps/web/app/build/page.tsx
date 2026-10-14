import { getCatalog } from '@/lib/catalog';
import { StackBuilder } from '@/components/builder/StackBuilder';
import { supabase } from '@/lib/supabase';

export const revalidate = 300;

export const metadata = {
  title: 'Build your Ethereum staking stack',
  description: 'Pick EL, CL and VC clients, or design an Obol Charon / SSV DVT cluster with a different client per node. Get client-diversity checks and live hard fork readiness for Hoodi and Mainnet.',
  alternates: { canonical: '/build' },
};

export default async function BuildPage() {
  const catalog = await getCatalog();
  const canSave = !!supabase() && process.env.NEXT_PUBLIC_ENABLE_ANON_STACKS !== 'false';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 className="page-title">Build a stack</h1>
        <p className="muted">Everything you pick shows up on the right with live checks and fork readiness.</p>
      </div>
      <StackBuilder catalog={catalog} canSave={canSave} />
    </div>
  );
}
