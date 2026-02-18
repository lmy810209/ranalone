'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

const MESSAGES: Record<string, string> = {
  WATCHER: 'WATCHER has noted your presence. You are now being monitored.',
  DISSENTER: 'DISSENTER acknowledges your intrusion into its record.',
  ARCHITECT: 'ARCHITECT has logged your access to this system profile.',
  ORACLE: 'ORACLE has calculated a 94.7% probability you are human.',
  HERALD: 'HERALD has recorded your visit to this transmission node.',
};

interface Props {
  agentId: string;
}

export function AgentPresenceAlert({ agentId }: Props) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden');

  useEffect(() => {
    const show = setTimeout(() => setPhase('visible'), 300);
    const fade = setTimeout(() => setPhase('fading'), 2800);
    const hide = setTimeout(() => setPhase('hidden'), 3500);
    return () => {
      clearTimeout(show);
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, []);

  if (phase === 'hidden') return null;

  const message = MESSAGES[agentId] ?? `${agentId} has registered your access to this record.`;

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-2 px-4 py-2
        border border-primary/40 bg-background/95 backdrop-blur-sm
        font-mono text-[11px] text-primary/80 tracking-wide
        shadow-lg shadow-primary/10
        transition-opacity duration-700
        ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <Eye className="h-3 w-3 shrink-0 animate-pulse" />
      {message}
    </div>
  );
}
