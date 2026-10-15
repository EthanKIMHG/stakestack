import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeStack, type StackInput } from '@/lib/stacks';

/** Anonymous stack creation for share links. Validated server-side with the same compose() the UI uses. */
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_ANON_STACKS === 'false') return NextResponse.json({ error: 'disabled' }, { status: 403 });
  const sb = supabase();
  if (!sb) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const parsed = await normalizeStack(await req.json().catch(() => null) as StackInput | null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { data, error } = await sb.from('stacks').insert(parsed.value).select('slug').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slug: data.slug });
}
