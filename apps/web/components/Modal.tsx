'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered dialog over a dimmed backdrop. Esc, the close button and a backdrop click close it unless
 * `dismissible` is false (used while saving). Focus moves in on open, stays inside on Tab, and
 * returns to the button that opened it; the page behind does not scroll.
 */
export function Modal({ open, onClose, labelledBy, dismissible = true, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    first?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const [head, tail] = [items[0]!, items[items.length - 1]!];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible]);

  if (!open) return null;
  return createPortal(
    <div className="modal-root" onMouseDown={e => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {dismissible && <button type="button" className="icon-btn modal-close" aria-label="Close" onClick={onClose}><X aria-hidden /></button>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
