'use client';
import { useSyncExternalStore } from 'react';

const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

// NEXT_PUBLIC_* values are inlined at build time, so changing them needs a rebuild/redeploy.
export const PRIVY_APP_ID = clean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
export const PRIVY_CLIENT_ID = clean(process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID);
/** Sign-in is on only when a Privy app id is configured; without it the app runs as before. */
export const AUTH_ENABLED = PRIVY_APP_ID.length > 0;

export interface AuthUser { id: string; provider: 'github' | 'google' | null; username: string | null; name: string | null; email: string | null }
export interface AuthState { ready: boolean; authenticated: boolean; user: AuthUser | null }
export interface AuthActions { login: () => void; logout: () => Promise<void>; getAccessToken: () => Promise<string | null> }

/**
 * Auth state shared outside Privy's React tree. The Privy SDK is large, so it loads lazily in its own
 * island (PrivyIsland) after the page hydrates and publishes its state here; the rest of the app reads
 * it with useAuth() and never imports Privy.
 */
const SIGNED_OUT: AuthState = { ready: false, authenticated: false, user: null };
let state = SIGNED_OUT;
let actions: AuthActions = { login: () => {}, logout: async () => {}, getAccessToken: async () => null };
const listeners = new Set<() => void>();

export const authStore = {
  get: () => state,
  actions: () => actions,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  /** Privy hands out new function identities on every render: keep the latest actions, notify only on real changes. */
  publish(next: AuthState, nextActions: AuthActions) {
    actions = nextActions;
    const a = state.user, b = next.user;
    if (state.ready === next.ready && state.authenticated === next.authenticated && a?.id === b?.id && a?.provider === b?.provider && a?.username === b?.username && a?.name === b?.name && a?.email === b?.email) return;
    state = next;
    listeners.forEach(l => l());
  },
};

export function useAuth(): AuthState & AuthActions {
  const s = useSyncExternalStore(authStore.subscribe, authStore.get, () => SIGNED_OUT);
  return { ...s, ...authStore.actions() };
}
