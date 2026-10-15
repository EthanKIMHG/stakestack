'use client';
import { useState } from 'react';
import { Check, CircleAlert, Copy, ExternalLink, Link2, Rss, UserPlus } from 'lucide-react';
import { Modal } from '../Modal';
import { Loader } from '../Loader';

export type SaveState =
  | { phase: 'saving'; kind: 'guest' | 'member' }
  | { phase: 'done'; kind: 'guest' | 'member'; slug: string; title: string }
  | { phase: 'error'; kind: 'guest' | 'member'; error: string };

/**
 * The save result, centred on screen: a loader while the stack is checked and stored, then the share
 * link and feeds. Guests also get the sign-up pitch here, where they just saw what saving gives them.
 */
export function SaveModal({ state, name, items, canSignUp, onClose, onRetry, onSignUp }: {
  state: SaveState | null;
  name: string;
  items: number;
  /** Sign-in is configured on this deployment. */
  canSignUp: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSignUp: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = state?.phase === 'done' && typeof window !== 'undefined' ? `${window.location.origin}/s/${state.slug}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  return (
    <Modal open={!!state} onClose={onClose} labelledBy="save-modal-title" dismissible={state?.phase !== 'saving'}>
      {state?.phase === 'saving' && (
        <div className="save-modal save-modal-center">
          <h2 id="save-modal-title" className="sr-only">Saving</h2>
          <Loader label={state.kind === 'member' ? 'Saving to My stacks…' : 'Saving your stack…'} sub="Checking the picks and creating a share link" />
        </div>
      )}

      {state?.phase === 'error' && (
        <div className="save-modal save-modal-center">
          <span className="save-icon err" aria-hidden><CircleAlert /></span>
          <h2 id="save-modal-title" className="save-title">Couldn’t save</h2>
          <p className="save-sub">{state.error}</p>
          <div className="save-actions">
            <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>Try again</button>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      {state?.phase === 'done' && (
        <div className="save-modal">
          <div className="save-modal-center">
            <span className="save-icon ok" aria-hidden><Check strokeWidth={3} /></span>
            <h2 id="save-modal-title" className="save-title">{state.title}</h2>
            <p className="save-sub">“{name}” · {items} item{items === 1 ? '' : 's'}</p>
          </div>

          <div className="save-link">
            <input className="field field-sm mono" readOnly value={url} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
            <button type="button" className="btn btn-sm" onClick={copy} autoFocus>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="save-links">
            <a className="btn btn-sm btn-quiet" href={`/s/${state.slug}`}><ExternalLink aria-hidden />Open stack page</a>
            <a className="btn btn-sm btn-quiet" href={`/api/feed/${state.slug}.rss`}><Rss aria-hidden />RSS</a>
            <a className="btn btn-sm btn-quiet" href={`/api/feed/${state.slug}.json`}><Link2 aria-hidden />JSON</a>
          </div>

          {state.kind === 'guest' && canSignUp ? (
            <div className="save-nudge">
              <span className="save-nudge-icon" aria-hidden><UserPlus /></span>
              <div>
                <b>Keep it in your account</b>
                <p>Sign up with GitHub or Google to save several stacks, switch between them and see your tools first. This stack comes with you.</p>
              </div>
              <div className="save-actions">
                <button type="button" className="btn btn-primary" onClick={onSignUp}>Sign up free</button>
                <button type="button" className="btn btn-quiet" onClick={onClose}>Maybe later</button>
              </div>
            </div>
          ) : (
            <div className="save-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
