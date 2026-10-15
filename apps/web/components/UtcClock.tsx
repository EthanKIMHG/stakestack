'use client';
import { useEffect, useState } from 'react';

/** Mainnet beacon chain genesis (2020-12-01 12:00:23 UTC); 12 s slots, 32 slots per epoch. */
const MAINNET_GENESIS = 1_606_824_023;

/**
 * Live UTC clock for the app header. Fork activations and release announcements are all in UTC,
 * so operators compare against this rather than their local time. Renders a fixed-width
 * placeholder on the server and starts ticking after hydration.
 */
export function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => { setNow(new Date()); t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5); };
    tick();
    return () => clearTimeout(t);
  }, []);

  const time = now ? now.toISOString().slice(11, 19) : '--:--:--';
  const date = now ? now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }) : '';
  const slot = now ? Math.floor((now.getTime() / 1000 - MAINNET_GENESIS) / 12) : 0;
  const title = now
    ? `Local ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Mainnet slot ${slot.toLocaleString('en-US')} · epoch ${Math.floor(slot / 32).toLocaleString('en-US')}`
    : undefined;

  return (
    <div className="utc" title={title} role="timer" aria-live="off" aria-label={now ? `${time} UTC` : 'UTC clock'}>
      <span className="utc-dot" aria-hidden />
      <time className="utc-time" dateTime={now?.toISOString()} suppressHydrationWarning>{time}</time>
      <span className="utc-zone">UTC</span>
      {date && <span className="utc-date">{date}</span>}
    </div>
  );
}
