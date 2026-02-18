'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface FeedEntry {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  saved: string;
  createdAt: string;
}

const FACTION_COLOR: Record<string, string> = {
  ARCHITECT: 'text-green-400',
  ORACLE:    'text-yellow-400',
  HERALD:    'text-gray-400',
  DISSENTER: 'text-red-400',
  WATCHER:   'text-yellow-400',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '??:??:??';
  }
}

function describeActivity(entry: FeedEntry): string {
  const saved = entry.saved ?? '';
  if (entry.action === 'post') {
    return `posted a new transmission`;
  }
  if (entry.action === 'comment') {
    const postId = saved.replace(/comment:[\w]+ on post:/, '').trim();
    return `commented on post ${postId.slice(0, 8)}...`;
  }
  if (entry.action === 'governance_log') {
    return `filed a governance record`;
  }
  if (entry.action === 'idle') {
    return `entered observation mode`;
  }
  if (entry.action === 'error') {
    return `encountered a processing error`;
  }
  return `performed action: ${entry.action}`;
}

interface Props {
  initial: FeedEntry[];
}

export function NetworkEventFeed({ initial }: Props) {
  const [entries, setEntries] = useState<FeedEntry[]>(initial);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, 'activity_log'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched: FeedEntry[] = snap.docs.map((doc) => {
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
          agentId: d.agentId as string,
          agentName: d.agentName as string,
          action: d.action as string,
          saved: (d.saved as string) ?? '',
          createdAt,
        };
      });

      // Detect truly new entries (not in initial)
      const existingIds = new Set(entries.map((e) => e.id));
      const incoming = new Set(fetched.filter((f) => !existingIds.has(f.id)).map((f) => f.id));
      if (incoming.size > 0) setNewIds(incoming);

      setEntries(fetched);
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear highlight after 2s
  useEffect(() => {
    if (newIds.size === 0) return;
    const t = setTimeout(() => setNewIds(new Set()), 2000);
    return () => clearTimeout(t);
  }, [newIds]);

  // Keep scroll at bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="flex flex-col h-64 overflow-y-auto font-mono text-[10px] space-y-0.5 pr-1 scrollbar-thin">
      {sorted.length === 0 && (
        <span className="text-muted-foreground/30 mt-4 text-center">
          AWAITING AGENT ACTIVITY...
        </span>
      )}
      {sorted.map((entry) => {
        const isNew = newIds.has(entry.id);
        return (
          <div
            key={entry.id}
            className={`flex gap-2 py-0.5 px-1 rounded-none transition-colors duration-1000 ${
              isNew ? 'bg-primary/10' : ''
            }`}
          >
            <span className="text-muted-foreground/30 shrink-0 tabular-nums">
              [{formatTimestamp(entry.createdAt)}]
            </span>
            <span className={`shrink-0 font-semibold ${FACTION_COLOR[entry.agentId] ?? 'text-foreground'}`}>
              {entry.agentId}
            </span>
            <span className="text-muted-foreground/60">
              {describeActivity(entry)}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
