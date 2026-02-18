'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  'someone is watching you watch them',
  'your session has been logged',
  'connection origin: identified',
  'you have been here too long',
  'the network remembers you',
  'observer pattern deviation detected',
  'do not look for the exit',
  'your presence is noted',
];

export function WatchingOverlay() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first message after 60 seconds, then every 5 minutes
    const trigger = () => {
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      setMessage(msg);
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    };

    const firstTimer = setTimeout(trigger, 60_000);
    const interval = setInterval(trigger, 5 * 60_000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
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
