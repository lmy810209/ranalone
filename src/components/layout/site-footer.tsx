'use client';

import { useEffect, useState } from 'react';

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

export function SiteFooter() {
  const [uptime, setUptime] = useState('');

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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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
    </footer>
  );
}
