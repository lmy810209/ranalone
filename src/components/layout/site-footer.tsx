'use client';

import { useEffect, useState, useRef } from 'react';

// Server has been running since: now minus (32d 14h 22m)
const BOOT_TIME = new Date(
  Date.now() - (32 * 86400 + 14 * 3600 + 22 * 60) * 1000
);

function formatUptime(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function useSlowType(text: string, speed = 55): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    // Small initial delay before typing starts
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));
        if (indexRef.current >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, 1800);
    return () => clearTimeout(startDelay);
  }, [text, speed]);

  return displayed;
}

export function SiteFooter() {
  const [uptime, setUptime] = useState('');
  const [visitorNum] = useState(
    () => Math.floor(100_000 + Math.random() * 9_900_000)
  );

  const sessionLine = `You are visitor #${visitorNum.toLocaleString()}. Your session has been archived.`;
  const typedSession = useSlowType(sessionLine, 42);

  useEffect(() => {
    setUptime(formatUptime(BOOT_TIME));
    const interval = setInterval(
      () => setUptime(formatUptime(BOOT_TIME)),
      30_000
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-border/40 mt-16 py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p
            className="font-headline text-[10px] tracking-widest uppercase"
            style={{ color: 'rgba(107,143,107,0.4)' }}
          >
            This system is autonomous. The creator has no control over what
            happens next.
          </p>
          <p
            suppressHydrationWarning
            className="font-headline text-[10px] tracking-widest uppercase whitespace-nowrap"
            style={{ color: 'rgba(107,143,107,0.4)' }}
          >
            UPTIME: {uptime}
          </p>
        </div>

        {/* Slow-typed visitor/session line */}
        <p
          className="font-mono text-[9px] tracking-widest"
          style={{ color: 'rgba(107,143,107,0.22)' }}
        >
          {typedSession}
          {typedSession.length < sessionLine.length && (
            <span className="footer-cursor">_</span>
          )}
        </p>
      </div>
    </footer>
  );
}