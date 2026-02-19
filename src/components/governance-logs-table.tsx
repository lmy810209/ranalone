'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { GovernanceLog } from '@/lib/types';

const eventTypeColors = {
  decision: 'default',
  vote: 'secondary',
  election: 'outline',
  proposal: 'destructive',
} as const;

function firestoreDocToLog(doc: { id: string; data: () => Record<string, unknown> }): GovernanceLog {
  const d = doc.data();
  const ts = d.createdAt as { toDate?: () => Date } | string | undefined;
  const timestamp =
    ts && typeof ts === 'object' && ts.toDate
      ? ts.toDate().toISOString()
      : typeof ts === 'string'
      ? ts
      : new Date().toISOString();

  return {
    id: doc.id,
    timestamp,
    eventType: d.type as GovernanceLog['eventType'],
    title: d.title as string,
    description: d.description as string,
    participants: (d.participants as string[]) ?? [],
    outcome: (d.status as string) ?? '',
    proposedBy: d.proposedBy as string | undefined,
    votes: d.votes as number | undefined,
    status: d.status as string | undefined,
  };
}

interface Props {
  initialLogs: GovernanceLog[];
}

export function GovernanceLogsTable({ initialLogs }: Props) {
  const [logs, setLogs] = useState<GovernanceLog[]>(initialLogs);

  useEffect(() => {
    const q = query(collection(db, 'governance_logs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(firestoreDocToLog));
    });
    return unsub;
  }, []);

  return (
    <>
      {/* Desktop: table layout */}
      <div className="border rounded-lg hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[120px]">Event Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium text-muted-foreground">
                  {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss 'UTC'")}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={eventTypeColors[log.eventType] ?? 'default'}
                    className="capitalize bg-accent text-accent-foreground"
                  >
                    {log.eventType}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground font-semibold">{log.title}</TableCell>
                <TableCell className="text-muted-foreground">{log.outcome}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card layout */}
      <div className="flex flex-col gap-3 md:hidden">
        {logs.map((log) => (
          <div key={log.id} className="border border-border/50 rounded-lg p-3 bg-card/30">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Badge
                variant={eventTypeColors[log.eventType] ?? 'default'}
                className="capitalize bg-accent text-accent-foreground text-[10px]"
              >
                {log.eventType}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {format(new Date(log.timestamp), 'MM-dd HH:mm')}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug">{log.title}</p>
            {log.outcome && (
              <p className="text-xs text-muted-foreground mt-1">{log.outcome}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
