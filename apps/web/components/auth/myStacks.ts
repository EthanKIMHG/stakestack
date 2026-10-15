'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { StackSelection, Topology } from '@stakestack/shared/types';
import { authStore, useAuth } from './store';

export interface MyStack { id: string; slug: string; name: string; selection: StackSelection; topology: Topology | null; created_at: string; updated_at: string }
export interface MyStacksState { status: 'signed-out' | 'loading' | 'ready' | 'error'; stacks: MyStack[]; error?: string }
export interface StackDraft { name: string; selection: StackSelection; topology: Topology | null }

/** The signed-in member's saved stacks, shared by the builder, the releases page and the header. */
const SIGNED_OUT: MyStacksState = { status: 'signed-out', stacks: [] };
let state = SIGNED_OUT;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: MyStacksState) => { state = next; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await authStore.actions().getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  const res = await fetch(path, { ...init, headers, cache: 'no-store' });
  const json = await res.json().catch(() => ({})) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export const myStacks = {
  load(): Promise<void> {
    inflight ??= (async () => {
      if (!state.stacks.length) set({ status: 'loading', stacks: [] });
      try {
        const { stacks } = await call<{ stacks: MyStack[] }>('/api/my/stacks');
        set({ status: 'ready', stacks });
      } catch (e) {
        set({ status: 'error', stacks: state.stacks, error: (e as Error).message });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
  reset() { set(SIGNED_OUT); },
  /** Create (no id) or update a stack; the saved row moves to the front. */
  async save(draft: StackDraft, id: string | null): Promise<MyStack> {
    const { stack } = await call<{ stack: MyStack }>(id ? `/api/my/stacks/${id}` : '/api/my/stacks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(draft) });
    set({ status: 'ready', stacks: [stack, ...state.stacks.filter(s => s.id !== stack.id)] });
    return stack;
  },
  async remove(id: string): Promise<void> {
    await call(`/api/my/stacks/${id}`, { method: 'DELETE' });
    set({ ...state, stacks: state.stacks.filter(s => s.id !== id) });
  },
};

/** Every component slug in the member's stacks: picks in any slot plus each cluster node's clients. */
export function toolsOf(stacks: MyStack[]): Set<string> {
  const out = new Set<string>();
  for (const s of stacks) {
    for (const [slot, slugs] of Object.entries(s.selection ?? {})) if (slot !== 'network') for (const x of slugs ?? []) out.add(x);
    for (const n of s.topology?.nodes ?? []) for (const x of [n.execution, n.consensus, n.validator]) if (x) out.add(x);
  }
  return out;
}

export function useMyStacks() {
  const { ready, authenticated } = useAuth();
  const s = useSyncExternalStore(subscribe, () => state, () => SIGNED_OUT);
  useEffect(() => {
    if (!ready) return;
    if (authenticated && s.status === 'signed-out') void myStacks.load();
    if (!authenticated && s.status !== 'signed-out') myStacks.reset();
  }, [ready, authenticated, s.status]);
  const tools = useMemo(() => toolsOf(s.stacks), [s.stacks]);
  return { ...s, tools, signedIn: ready && authenticated };
}
