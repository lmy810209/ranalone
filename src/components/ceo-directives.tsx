'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { CycleTime } from '@/components/relative-time';

interface CEODirective {
  id: string;
  systemAssessment: string;
  directives: Record<string, string>;
  priority: string;
  createdAt: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  survival: 'border-red-800/60 bg-red-950/20',
  stability: 'border-yellow-800/60 bg-yellow-950/20',
  expansion: 'border-green-800/60 bg-green-950/20',
};

const PRIORITY_BADGE: Record<string, string> = {
  survival: 'bg-red-950/80 border-red-700 text-red-400',
  stability: 'bg-yellow-950/80 border-yellow-700 text-yellow-400',
  expansion: 'bg-green-950/80 border-green-700 text-green-400',
};

const AGENT_ORDER = ['ARCHITECT', 'ORACLE', 'HERALD', 'DISSENTER', 'WATCHER'] as const;

const AGENT_COLOR: Record<string, string> = {
  ARCHITECT: 'text-green-400',
  ORACLE: 'text-yellow-400',
  HERALD: 'text-gray-400',
  DISSENTER: 'text-red-400',
  WATCHER: 'text-yellow-400',
};

export function CeoDirectives() {
  const [directives, setDirectives] = useState<CEODirective[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'ceo_directives'),
      orderBy('createdAt', 'desc'),
      limit(5),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDirectives(
        snap.docs.map((doc) => {
          const d = doc.data();
          const ts = d.createdAt as { toDate?: () => Date } | string | undefined;
          const createdAt =
            ts && typeof ts === 'object' && ts.toDate
              ? ts.toDate().toISOString()
              : typeof ts === 'string'
              ? ts
              : new Date().toISOString();
          return {
            id: doc.id,
            systemAssessment: (d.systemAssessment as string) ?? '',
            directives: (d.directives as Record<string, string>) ?? {},
            priority: (d.priority as string) ?? 'stability',
            createdAt,
          };
        }),
      );
    });
    return unsub;
  }, []);

  if (directives.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-headline text-lg font-bold tracking-tight text-primary/80 flex items-center gap-2">
        <span className="text-[10px] px-2 py-0.5 border border-yellow-700/60 bg-yellow-950/40 text-yellow-400 tracking-widest font-mono">
          CEO DIRECTIVE
        </span>
        Recent System Directives
      </h2>

      {directives.map((dir) => {
        const style = PRIORITY_STYLES[dir.priority] ?? PRIORITY_STYLES.stability;
        const badge = PRIORITY_BADGE[dir.priority] ?? PRIORITY_BADGE.stability;

        return (
          <div
            key={dir.id}
            className={`border rounded-lg p-4 ${style}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 border tracking-widest font-mono uppercase ${badge}`}>
                  {dir.priority}
                </span>
                <span className="text-[10px] text-muted-foreground/50 font-mono">
                  {dir.id}
                </span>
              </div>
              <CycleTime createdAt={dir.createdAt} className="text-[10px] font-mono text-muted-foreground/60" />
            </div>

            {/* System Assessment */}
            <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
              {dir.systemAssessment}
            </p>

            {/* Agent Directives */}
            <div className="grid gap-2">
              {AGENT_ORDER.map((agentId) => {
                const directive = dir.directives[agentId];
                if (!directive) return null;
                return (
                  <div key={agentId} className="flex gap-2 items-start text-xs">
                    <span className={`font-mono font-bold shrink-0 w-24 ${AGENT_COLOR[agentId] ?? 'text-gray-400'}`}>
                      {agentId}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {directive}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}