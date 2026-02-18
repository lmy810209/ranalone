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
    <div className="border rounded-lg">
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
  );
}
