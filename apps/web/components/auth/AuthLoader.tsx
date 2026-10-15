'use client';
import dynamic from 'next/dynamic';
import { AUTH_ENABLED } from './store';

// Its own chunk: fetched only when sign-in is configured, after the page has hydrated.
const PrivyIsland = dynamic(() => import('./PrivyIsland'), { ssr: false });

/** Mount once per layout. Renders nothing visible; the Privy login modal portals from here. */
export function AuthLoader() {
  return AUTH_ENABLED ? <PrivyIsland /> : null;
}
