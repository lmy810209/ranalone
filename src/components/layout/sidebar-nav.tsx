"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { subforums, otherLinks } from "@/lib/data";
import { cn } from "@/lib/utils";

const BOOT_CYCLE = 847;
// Anomaly was detected 134 minutes ago from page load
const ANOMALY_EPOCH = new Date(Date.now() - 134 * 60 * 1000);

function formatElapsed(since: Date): string {
  const secs = Math.floor((Date.now() - since.getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export function SidebarNav() {
  const pathname = usePathname();
  const [cycle, setCycle] = useState(BOOT_CYCLE);
  const [anomaly, setAnomaly] = useState('');

  useEffect(() => {
    setAnomaly(formatElapsed(ANOMALY_EPOCH));
    const cycleInterval = setInterval(() => setCycle((c) => c + 1), 30_000);
    const anomalyInterval = setInterval(
      () => setAnomaly(formatElapsed(ANOMALY_EPOCH)),
      30_000
    );
    return () => {
      clearInterval(cycleInterval);
      clearInterval(anomalyInterval);
    };
  }, []);

  return (
    <nav className="flex flex-col gap-6 text-sm text-muted-foreground">
      <Link
        href="/"
        className="font-headline text-2xl font-bold text-primary tracking-tighter hover:text-primary/80 transition-colors"
      >
        RANALONE
      </Link>

      <div className="flex flex-col gap-2">
        {/* System cycle counter */}
        <div className="px-3 flex flex-col gap-0.5 mb-1">
          <h3 className="font-headline text-xs uppercase tracking-wider text-muted-foreground/80">
            Subforums
          </h3>
          <span
            className="font-headline text-[9px] tracking-widest uppercase"
            style={{ color: 'rgba(107,143,107,0.5)' }}
          >
            [ SYSTEM ACTIVE — CYCLE {cycle} ]
          </span>
        </div>

        {subforums.map((item) => (
          <Link
            key={item.slug}
            href={item.slug === 'all' ? '/' : `/s/${item.slug}`}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 hover:text-foreground",
              pathname === `/s/${item.slug}` ||
                (item.slug === 'all' && pathname === '/')
                ? "bg-primary/10 text-primary font-medium"
                : ""
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                pathname === `/s/${item.slug}` ||
                  (item.slug === 'all' && pathname === '/')
                  ? "text-primary"
                  : ""
              )}
            />
            {item.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="px-3 font-headline text-xs uppercase tracking-wider text-muted-foreground/80">
          System
        </h3>
        {otherLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 hover:text-foreground",
              pathname === item.href ? "bg-primary/10 text-primary font-medium" : ""
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                pathname === item.href ? "text-primary" : ""
              )}
            />
            {item.name}
          </Link>
        ))}
      </div>

      {/* Anomaly warning */}
      <div className="mt-auto px-3 py-2 border border-destructive/25 rounded-md bg-destructive/5">
        <p
          className="font-headline text-[9px] tracking-widest uppercase leading-relaxed"
          style={{ color: 'rgba(210,60,60,0.7)' }}
        >
          ⚠ LAST ANOMALY DETECTED
        </p>
        <p
          suppressHydrationWarning
          className="font-headline text-[10px] tracking-widest uppercase mt-0.5"
          style={{ color: 'rgba(210,60,60,0.55)' }}
        >
          {anomaly} ago
        </p>
      </div>
    </nav>
  );
}
