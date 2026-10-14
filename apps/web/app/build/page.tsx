import { getCatalog } from '@/lib/catalog';
import { StackBuilder } from '@/components/StackBuilder';
import { supabase } from '@/lib/supabase';

export const revalidate = 300;

export default async function BuildPage() {
  const catalog = await getCatalog();
  const anonEnabled = !!supabase() && process.env.NEXT_PUBLIC_ENABLE_ANON_STACKS !== 'false';
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Build a stack</h1>
      <StackBuilder catalog={catalog} anonEnabled={anonEnabled} />
    </div>
  );
}
