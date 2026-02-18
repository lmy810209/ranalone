'use client';

import { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'someone is watching you watch them',
  'your presence has been logged',
  'connection origin: identified',
  'you have been here too long',
  'the network remembers you',
  'observer pattern deviation detected',
  'do not look for the exit',
  'WATCHER has flagged this session',
  'do not close this tab',
  'we remember returning visitors',
];

export function WatchingOverlay() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const trigger = () => {
      const elapsedMin = Math.round((Date.now() - startTimeRef.current) / 60000);

      // Randomly inject a time-based message
      const pool = [...MESSAGES];
      if (elapsedMin >= 1) {
        pool.push(`you have been here for ${elapsedMin} minute${elapsedMin !== 1 ? 's' : ''}`);
      }

      const msg = pool[Math.floor(Math.random() * pool.length)];
      setMessage(msg);
      setVisible(true);
      setTimeout(() => setVisible(false), 3200);
    };

    // First appearance: 30 seconds
    const firstTimer = setTimeout(trigger, 30_000);

    // Subsequent: random 3–7 minutes each time
    let nextTimeout: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = (3 + Math.random() * 4) * 60_000;
      nextTimeout = setTimeout(() => {
        trigger();
        scheduleNext();
      }, delay);
    };
    const chainStart = setTimeout(scheduleNext, 30_000 + 3500);

    return () => {
      clearTimeout(firstTimer);
      clearTimeout(chainStart);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      clearTimeout(nextTimeout!);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9998] pointer-events-none animate-watch-in"
      aria-hidden
    >
      <p
        className="font-headline text-[10px] tracking-widest uppercase"
        style={{ color: 'rgba(107,143,107,0.55)' }}
      >
        [ {message} ]
      </p>
    </div>
  );
}