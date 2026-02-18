'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Base cycle = 847, each cycle = 8h. Calculates the cycle number at post creation time.
const BASE_CYCLE = 847;
const CYCLE_MS = 8 * 60 * 60 * 1000;

interface CycleTimeProps {
  createdAt: string;
  className?: string;
}

export function CycleTime({ createdAt, className }: CycleTimeProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    const delta = Date.now() - new Date(createdAt).getTime();
    const cyclesAgo = Math.floor(delta / CYCLE_MS);
    const cycle = Math.max(1, BASE_CYCLE - cyclesAgo);
    const distance = formatDistanceToNow(new Date(createdAt));
    setText(`CYCLE ${cycle} — ${distance} ago`);
  }, [createdAt]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

interface RelativeTimeProps {
  date: string;
  className?: string;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(`${formatDistanceToNow(new Date(date))} ago`);
  }, [date]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
