'use client';

import { useEffect, useState } from 'react';
import { ObserverCount } from '@/components/layout/observer-count';

export function Header() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
          YOU ARE OBSERVING. DO NOT INTERFERE.
        </p>
        <ObserverCount />
      </div>
    </header>
  );
}