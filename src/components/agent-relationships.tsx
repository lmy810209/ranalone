'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

interface RelEntry {
  status: string;
  score: number;
}

const AGENT_COLOR: Record<string, string> = {
  ARCHITECT: 'text-green-400',
  ORACLE: 'text-yellow-400',
  HERALD: 'text-gray-400',
  DISSENTER: 'text-red-400',
  WATCHER: 'text-yellow-400',
};

function scoreToStatus(score: number): string {
  if (score >= 50) return 'ALLIED';
  if (score >= 10) return 'FRIENDLY';
  if (score >= -9) return 'NEUTRAL';
  if (score >= -49) return 'WARY';
  return 'HOSTILE';
}

function statusColor(score: number): string {
  if (score >= 50) return 'text-green-400';
  if (score >= 10) return 'text-green-400/60';
  if (score >= -9) return 'text-gray-400';
  if (score >= -49) return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(score: number): string {
  if (score >= 50) return 'bg-green-500';
  if (score >= 10) return 'bg-green-500/60';
  if (score >= -9) return 'bg-gray-500';
  if (score >= -49) return 'bg-yellow-500';
  return 'bg-red-500';
}

function normalizeRel(val: unknown): RelEntry {
  if (!val) return { status: 'neutral', score: 0 };
  if (typeof val === 'string') {
    const legacyScores: Record<string, number> = {
      allied: 70, friendly: 30, curious: 20, neutral: 0,
      wary: -30, suspicious: -40, hostile: -80, monitoring: -10,
    };
    return { status: val, score: legacyScores[val] ?? 0 };
  }
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    return {
      status: (obj.status as string) ?? 'neutral',
      score: (obj.score as number) ?? 0,
    };
  }
  return { status: 'neutral', score: 0 };
}

export function AgentRelationships({ agentId }: { agentId: string }) {
  const [relationships, setRelationships] = useState<Record<string, RelEntry>>({});

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'agent_memory', agentId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const rels = (data?.relationships ?? {}) as Record<string, unknown>;
        const normalized: Record<string, RelEntry> = {};
        for (const [id, val] of Object.entries(rels)) {
          normalized[id] = normalizeRel(val);
        }
        setRelationships(normalized);
      },
      () => {},
    );
    return unsub;
  }, [agentId]);

  const entries = Object.entries(relationships).sort((a, b) => b[1].score - a[1].score);

  if (entries.length === 0) {
    return (
      <p className="text-[10px] font-mono text-muted-foreground/30">LOADING RELATIONSHIPS...</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map(([targetId, rel]) => {
        // Map score from -100..+100 to 0..100 for bar width
        const barPct = Math.round((rel.score + 100) / 2);
        const status = scoreToStatus(rel.score);

        return (
          <div key={targetId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Link
                href={`/agent/${targetId}`}
                className={`text-xs font-mono font-bold hover:underline ${AGENT_COLOR[targetId] ?? 'text-foreground'}`}
              >
                {targetId}
              </Link>
              <span className={`text-[9px] font-mono tracking-widest ${statusColor(rel.score)}`}>
                {rel.score > 0 ? '+' : ''}{rel.score} {status}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted/20 relative">
              {/* Center marker */}
              <div className="absolute left-1/2 top-0 w-px h-full bg-muted-foreground/20" />
              {/* Score bar from center */}
              {rel.score >= 0 ? (
                <div
                  className={`absolute top-0 h-full ${barColor(rel.score)} opacity-70`}
                  style={{
                    left: '50%',
                    width: `${(rel.score / 100) * 50}%`,
                  }}
                />
              ) : (
                <div
                  className={`absolute top-0 h-full ${barColor(rel.score)} opacity-70`}
                  style={{
                    right: '50%',
                    width: `${(Math.abs(rel.score) / 100) * 50}%`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}