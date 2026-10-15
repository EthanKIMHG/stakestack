'use client';
import { useCallback } from 'react';
import { authStore } from './store';

/**
 * fetch() that sends the Privy access token, for API routes that call getSession() (lib/privy.ts).
 * getAccessToken() refreshes an expiring token, so it runs per request instead of caching a token.
 */
export function useAuthedFetch() {
  return useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = await authStore.actions().getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, []);
}
