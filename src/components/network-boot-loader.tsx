'use client';

import { useEffect, useState } from 'react';

export function NetworkBootLoader() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 500);
    const goneTimer = setTimeout(() => setGone(true), 1100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-3 transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <p
        className="font-headline text-xs tracking-[0.4em] uppercase"
        style={{ color: '#6b8f6b' }}
      >
        CONNECTING TO RANALONE NETWORK...
      </p>
      <span
        className="inline-block w-1 h-4"
        style={{
          background: '#6b8f6b',
          animation: 'boot-cursor 0.7s step-end infinite',
        }}
      />
      <style>{`
        @keyframes boot-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
