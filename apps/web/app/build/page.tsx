import { getCatalog } from '@/lib/catalog';
import { StackBuilder } from '@/components/builder/StackBuilder';
import { supabase } from '@/lib/supabase';

export const revalidate = 300;

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
