'use client';

import { useEffect, useState, useRef } from 'react';

export function CreepyEffects() {
  const [loadFlash, setLoadFlash] = useState(false);
  const [redScreen, setRedScreen] = useState(false);
  const [cornerMsg, setCornerMsg] = useState<string | null>(null);
  const [bannerOverride, setBannerOverride] = useState(false);
  const [observerSurge, setObserverSurge] = useState(false);
  const [redactedScroll, setRedactedScroll] = useState(false);
  const [titleOverride, setTitleOverride] = useState(false);
  const [darkLevel, setDarkLevel] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Random 0.1s flash on page load (0–3s delay)
  useEffect(() => {
    const delay = Math.random() * 3000;
    const t = setTimeout(() => {
      setLoadFlash(true);
      setTimeout(() => setLoadFlash(false), 110);
    }, delay);
    return () => clearTimeout(t);
  }, []);

  // Red screen pulse every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setRedScreen(true);
      setTimeout(() => setRedScreen(false), 300);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Time-based darkening: after 3min, slowly grows to ~12% darker over 10min
  useEffect(() => {
    const DARK_START = 3 * 60 * 1000;
    const DARK_RAMP  = 10 * 60 * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > DARK_START) {
        const progress = Math.min(1, (elapsed - DARK_START) / DARK_RAMP);
        setDarkLevel(progress * 0.12);
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Random event system: fires one event every 2–8 minutes
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const events: (() => void)[] = [
      // 1. Corner message
      () => {
        setCornerMsg('THEY ARE READING THIS');
        setTimeout(() => setCornerMsg(null), 500);
      },
      // 2. Banner override "WE KNOW YOU'RE HERE"
      () => {
        setBannerOverride(true);
        setTimeout(() => setBannerOverride(false), 420);
      },
      // 3. Observer count surge to 999,999
      () => {
        setObserverSurge(true);
        setTimeout(() => setObserverSurge(false), 1600);
      },
      // 4. [REDACTED] scrolling text
      () => {
        setRedactedScroll(true);
        setTimeout(() => setRedactedScroll(false), 4200);
      },
      // 5. "DO NOT TRUST THE ARCHITECT" title ghost
      () => {
        setTitleOverride(true);
        setTimeout(() => setTitleOverride(false), 420);
      },
    ];

    const schedule = () => {
      const delay = (2 + Math.random() * 6) * 60 * 1000;
      timeout = setTimeout(() => {
        const fn = events[Math.floor(Math.random() * events.length)];
        fn();
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {/* Load flash */}
      {loadFlash && (
        <div className="fixed inset-0 z-[9999] pointer-events-none bg-white/[0.04]" />
      )}

      {/* 5-min red screen */}
      {redScreen && (
        <div className="fixed inset-0 z-[9997] pointer-events-none bg-red-900/[0.10]" />
      )}

      {/* Corner "THEY ARE READING THIS" */}
      {cornerMsg && (
        <div className="fixed top-20 right-4 z-[9996] pointer-events-none">
          <p
            className="font-headline text-[9px] tracking-[0.3em] uppercase"
            style={{ color: 'rgba(210, 40, 40, 0.85)' }}
          >
            {cornerMsg}
          </p>
        </div>
      )}

      {/* Banner override — overlays header text area */}
      {bannerOverride && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-14 flex items-center px-4 sm:px-6 lg:px-8 pointer-events-none"
          style={{ background: 'rgba(5,5,5,0.97)' }}
        >
          <p
            className="font-headline text-xs sm:text-sm uppercase tracking-widest"
            style={{ color: 'rgba(210, 40, 40, 0.92)' }}
          >
            WE KNOW YOU&apos;RE HERE
          </p>
        </div>
      )}

      {/* Observer surge overlay — top-right near the observer count */}
      {observerSurge && (
        <div className="fixed top-[15px] right-6 z-[9999] pointer-events-none">
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: 'rgba(107, 143, 107, 0.9)' }}
          >
            999,999
          </span>
        </div>
      )}

      {/* [REDACTED] scrolling strip */}
      {redactedScroll && (
        <div className="fixed bottom-14 left-0 right-0 z-[9996] pointer-events-none overflow-hidden">
          <p
            className="font-mono text-[10px] whitespace-nowrap"
            style={{
              color: 'rgba(180, 30, 30, 0.5)',
              animation: 'redacted-scroll 4.2s linear forwards',
            }}
          >
            {'[REDACTED] '.repeat(18)}
          </p>
        </div>
      )}

      {/* "DO NOT TRUST THE ARCHITECT" ghost title */}
      {titleOverride && (
        <div
          className="fixed z-[9996] pointer-events-none"
          style={{ top: '38%', left: '18%' }}
        >
          <p
            className="font-headline text-lg font-bold tracking-tighter"
            style={{ color: 'rgba(210, 40, 40, 0.88)' }}
          >
            DO NOT TRUST THE ARCHITECT
          </p>
        </div>
      )}

      {/* Time-based darkening overlay */}
      {darkLevel > 0 && (
        <div
          className="fixed inset-0 z-[9993] pointer-events-none bg-black"
          style={{
            opacity: darkLevel,
            transition: 'opacity 15s ease-in-out',
          }}
        />
      )}
    </>
  );
}