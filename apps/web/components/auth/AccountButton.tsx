'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Layers, LogIn, LogOut } from 'lucide-react';
import { useMyStacks } from './myStacks';
import { AUTH_ENABLED, useAuth } from './store';
import { useAuthedFetch } from './useAuthedFetch';

/**
 * Header sign-in button. Always present: disabled while Privy loads, and with a tooltip on a
 * deployment that has no Privy app id.
 */
export function AccountButton() {
  if (!AUTH_ENABLED) return <SignIn disabled title="Sign-in is not configured on this deployment" />;
  return <Account />;
}

function SignIn({ onClick, disabled, title }: { onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className="btn btn-sm account-signin" onClick={onClick} disabled={disabled} title={title ?? 'Sign in with GitHub or Google'}>
      <LogIn aria-hidden /><span className="label">Sign in</span>
    </button>
  );
}

type Check = 'idle' | 'ok' | 'unconfigured' | 'failed';

function Account() {
  const { ready, authenticated, user, login, logout } = useAuth();
  const mine = useMyStacks();
  const authedFetch = useAuthedFetch();
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<Check>('idle');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  // Ask the server to verify the session once the menu opens: proves PRIVY_APP_SECRET is right.
  useEffect(() => {
    if (!open || check !== 'idle') return;
    authedFetch('/api/me')
      .then(r => setCheck(r.ok ? 'ok' : r.status === 503 ? 'unconfigured' : 'failed'))
      .catch(() => setCheck('failed'));
  }, [open, check, authedFetch]);

  if (!ready) return <SignIn disabled title="Loading sign-in…" />;
  if (!authenticated) return <SignIn onClick={() => login()} />;

  const handle = user?.username ?? user?.name ?? user?.email?.split('@')[0] ?? 'Account';
  // GitHub gives a public avatar by username; Google sign-ins get an initial instead.
  const avatar = user?.username ? `https://github.com/${encodeURIComponent(user.username)}.png?size=64` : null;
  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();
  const via = user?.provider === 'google' ? `Google · ${user.email ?? ''}` : user?.provider === 'github' ? `GitHub · @${handle}` : 'Signed in';
  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} title={`Signed in as ${handle}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- GitHub serves the avatar pre-sized; the image optimizer would only add cost */}
        {avatar ? <img src={avatar} alt="" width={26} height={26} /> : <span className="account-initial" aria-hidden>{initial}</span>}
        <span className="label">{handle}</span>
      </button>
      {open && (
        <div className="popover account-menu" role="menu">
          <div className="account-who">
            {/* eslint-disable-next-line @next/next/no-img-element -- GitHub serves the avatar pre-sized; the image optimizer would only add cost */}
            {avatar ? <img src={avatar} alt="" width={36} height={36} /> : <span className="account-initial lg" aria-hidden>{initial}</span>}
            <div style={{ minWidth: 0 }}>
              <b>{user?.name ?? handle}</b>
              <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{via}</div>
            </div>
          </div>
          <a className="btn btn-sm btn-block" href="/build" role="menuitem"><Layers aria-hidden />My stacks{mine.status === 'ready' && <span className="faint">{mine.stacks.length}</span>}</a>
          <div className={`account-check ${check}`}>
            {check === 'ok' ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            {check === 'idle' ? 'Checking session…' : check === 'ok' ? 'Session verified by the server' : check === 'unconfigured' ? 'Server sign-in not configured' : 'Server could not verify the session'}
          </div>
          <button type="button" role="menuitem" className="btn btn-sm btn-quiet btn-block" onClick={() => { setOpen(false); setCheck('idle'); void logout(); }}>
            <LogOut aria-hidden />Sign out
          </button>
        </div>
      )}
    </div>
  );
}
