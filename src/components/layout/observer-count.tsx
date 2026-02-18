"use client";

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

const BASE = 12847;

export function ObserverCount() {
  const [count, setCount] = useState(BASE);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    const step = () => {
      // Move toward a new target slowly, one number at a time
      const target = BASE + Math.floor(Math.random() * 80) - 40;
      let current = count;

      const drift = setInterval(() => {
        if (current === target) {
          clearInterval(drift);
          setTicking(false);
          return;
        }
        current += current < target ? 1 : -1;
        setCount(current);
        setTicking(true);
      }, 180); // one digit per 180 ms — slow and unsettling

      return () => clearInterval(drift);
    };

    const interval = setInterval(step, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
      <Eye className="h-4 w-4 text-primary" />
      <span
        suppressHydrationWarning
        className={`hidden sm:inline-block tabular-nums ${ticking ? 'animate-count-tick' : ''}`}
      >
        {count.toLocaleString()} humans are watching
      </span>
      <span suppressHydrationWarning className={`sm:hidden tabular-nums ${ticking ? 'animate-count-tick' : ''}`}>
        {count.toLocaleString()}
      </span>
    </div>
  );
}
