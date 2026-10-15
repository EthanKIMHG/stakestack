import 'server-only';
import { compose } from '@stakestack/shared/composer';
import type { StackSelection, Topology } from '@stakestack/shared/types';
import { getCatalog } from './catalog';
import { supabaseAdmin } from './supabase-admin';

export interface StackInput { name?: string; selection?: StackSelection; topology?: Topology | null; running_versions?: Record<string, string> }
export interface StackRecord { name: string; selection: StackSelection; topology: Topology | null; running_versions: Record<string, string> }
export interface MemberStack { id: string; slug: string; name: string; selection: StackSelection; topology: Topology | null; created_at: string; updated_at: string }

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Max saved stacks per member. Keeps one account from filling the table. */
export const MEMBER_STACK_LIMIT = 50;
const COLUMNS = 'id, slug, name, selection, topology, created_at, updated_at';

/**
 * Validate a stack with the same compose() the builder uses, then keep only what is visible after
 * rules; cluster roles are the union of node clients. Shared by anonymous and member saves.
 */
export async function normalizeStack(body: StackInput | null): Promise<Result<StackRecord>> {
  if (!body?.selection || typeof body.selection !== 'object') return { ok: false, status: 400, error: 'selection required' };
  const catalog = await getCatalog();
  const result = compose(catalog, body.selection, body.topology ?? null);
  const errors = result.diagnostics.filter(d => d.level === 'error');
  if (errors.length) return { ok: false, status: 422, error: errors.map(e => e.message).join(' ') };

  const selection: StackSelection = { network: result.networks };
  for (const s of result.slots) if (s.slot.id !== 'network' && s.visible && s.selected.length) selection[s.slot.id] = s.selected;
  const topology = result.cluster && body.topology?.nodes?.length
    ? { nodes: body.topology.nodes.slice(0, 16).map(n => ({ label: (n.label ?? '').slice(0, 40) || undefined, host: typeof n.host === 'string' ? n.host.trim().slice(0, 40) || undefined : undefined, execution: n.execution, consensus: n.consensus, validator: result.cluster!.roles.includes('validator') ? n.validator : undefined })), threshold: body.topology.threshold }
    : null;
  return { ok: true, value: { name: (body.name ?? '').trim().slice(0, 80) || 'Untitled stack', selection, topology, running_versions: body.running_versions ?? {} } };
}

function db() {
  const admin = supabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SECRET_KEY is not set');
  return admin;
}

export async function listMemberStacks(userId: string): Promise<MemberStack[]> {
  const { data: owned, error } = await db().from('stack_owners').select('stack_id').eq('privy_user_id', userId);
  if (error) throw new Error(error.message);
  const ids = (owned ?? []).map(r => r.stack_id as string);
  if (ids.length === 0) return [];
  const { data, error: e2 } = await db().from('stacks').select(COLUMNS).in('id', ids).order('updated_at', { ascending: false });
  if (e2) throw new Error(e2.message);
  return (data ?? []) as MemberStack[];
}

async function owns(userId: string, stackId: string): Promise<boolean> {
  const { data, error } = await db().from('stack_owners').select('stack_id').eq('stack_id', stackId).eq('privy_user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function createMemberStack(userId: string, value: StackRecord): Promise<Result<MemberStack>> {
  const { count, error: ce } = await db().from('stack_owners').select('stack_id', { count: 'exact', head: true }).eq('privy_user_id', userId);
  if (ce) throw new Error(ce.message);
  if ((count ?? 0) >= MEMBER_STACK_LIMIT) return { ok: false, status: 409, error: `You can keep up to ${MEMBER_STACK_LIMIT} stacks. Delete one first.` };
  const { data, error } = await db().from('stacks').insert(value).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  const stack = data as MemberStack;
  const { error: oe } = await db().from('stack_owners').insert({ stack_id: stack.id, privy_user_id: userId });
  if (oe) {
    await db().from('stacks').delete().eq('id', stack.id);
    throw new Error(oe.message);
  }
  return { ok: true, value: stack };
}

export async function updateMemberStack(userId: string, stackId: string, value: StackRecord): Promise<Result<MemberStack>> {
  if (!(await owns(userId, stackId))) return { ok: false, status: 404, error: 'stack not found' };
  const { data, error } = await db().from('stacks').update({ name: value.name, selection: value.selection, topology: value.topology }).eq('id', stackId).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return { ok: true, value: data as MemberStack };
}

export async function deleteMemberStack(userId: string, stackId: string): Promise<Result<null>> {
  if (!(await owns(userId, stackId))) return { ok: false, status: 404, error: 'stack not found' };
  const { error } = await db().from('stacks').delete().eq('id', stackId);
  if (error) throw new Error(error.message);
  return { ok: true, value: null };
}
