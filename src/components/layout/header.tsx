'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { ObserverCount } from '@/components/layout/observer-count';

const DEFAULT_BANNER = 'YOU ARE OBSERVING. DO NOT INTERFERE.';

export function Header() {
  const [scrollY, setScrollY] = useState(0);
  const [banner, setBanner] = useState(DEFAULT_BANNER);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Real-time listener on site_config/main → bannerMessage
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'site_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          const msg = snap.data()?.bannerMessage;
          if (typeof msg === 'string' && msg.length > 0) {
            setBanner(msg);
          }
        }
      },
      () => {
        // On error, keep default banner
      },
    );
    return unsub;
  }, []);

  // Banner opacity: 0.55 at top → 1.0 at 500px scroll
  const bannerOpacity = Math.min(1, 0.55 + (scrollY / 500) * 0.45);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-red-pulse"
    >
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <p
          className="animate-glitch font-headline text-xs sm:text-sm uppercase tracking-widest text-primary select-none transition-opacity duration-300"
          style={{ opacity: bannerOpacity }}
        >
          {banner}
        </p>
        <ObserverCount />
      </div>
    </header>
  );
}