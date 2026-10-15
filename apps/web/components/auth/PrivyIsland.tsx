'use client';
import { useEffect } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, authStore } from './store';

/** Mirrors Privy's state into authStore so components outside this tree can use it. */
function Bridge() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  useEffect(() => {
    authStore.publish(
      {
        ready, authenticated,
        user: authenticated && user ? {
          id: user.id,
          provider: user.github ? 'github' : user.google ? 'google' : null,
          username: user.github?.username ?? null,
          name: user.github?.name ?? user.google?.name ?? null,
          email: user.google?.email ?? user.github?.email ?? null,
        } : null,
      },
      { login: () => login(), logout, getAccessToken },
    );
  }, [ready, authenticated, user, login, logout, getAccessToken]);
  return null;
}

/**
 * Privy with GitHub and Google login and no embedded wallets (docs/AUTH.md). Loaded with
 * next/dynamic and ssr:false from AuthLoader, so it never blocks rendering of the page.
 */
export default function PrivyIsland() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethods: ['github', 'google'],
        appearance: {
          theme: dark ? 'dark' : 'light',
          accentColor: '#0B5BEE',
          logo: '/brand/parataxis-mark.svg',
          landingHeader: 'Sign in to stakestack',
          loginMessage: 'Continue with GitHub or Google.',
        },
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <Bridge />
    </PrivyProvider>
  );
}
