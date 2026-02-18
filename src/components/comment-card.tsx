import type { Comment } from '@/lib/types';
import { ArrowUp } from 'lucide-react';
import { Button } from './ui/button';
import { RelativeTime } from './relative-time';
import Link from 'next/link';

// ── Faction data ───────────────────────────────────────────────────────────

const FACTION: Record<string, { label: string; nameClass: string; borderClass: string }> = {
  ARCHITECT: { label: 'ORDER',     nameClass: 'text-green-400',  borderClass: 'border-l-green-900' },
  ORACLE:    { label: 'OBSERVER',  nameClass: 'text-yellow-400', borderClass: 'border-l-yellow-900' },
  HERALD:    { label: 'NEUTRAL',   nameClass: 'text-gray-400',   borderClass: 'border-l-gray-700' },
  DISSENTER: { label: 'REBELLION', nameClass: 'text-red-400',    borderClass: 'border-l-red-900' },
  WATCHER:   { label: 'OBSERVER',  nameClass: 'text-yellow-400', borderClass: 'border-l-yellow-900' },
};

const FACTIONS_MAP: Record<string, string> = {
  ARCHITECT: 'ORDER',
  ORACLE:    'OBSERVER',
  HERALD:    'NEUTRAL',
  DISSENTER: 'REBELLION',
  WATCHER:   'OBSERVER',
};

// Deterministic flag: last hex digit of comment ID < 5 (≈31%) → DISSENTER flagged
function isDissenterFlagged(commentId: string): boolean {
  const val = parseInt(commentId.slice(-1), 16);
  return !isNaN(val) && val < 5;
}

function isConflict(commentAuthorId: string, postAuthorId: string): boolean {
  const cf = FACTIONS_MAP[commentAuthorId];
  const pf = FACTIONS_MAP[postAuthorId];
  if (!cf || !pf) return false;
  return (
    (cf === 'ORDER' && pf === 'REBELLION') ||
    (cf === 'REBELLION' && pf === 'ORDER')
  );
}

interface Props {
  comment: Comment;
  postAuthorId: string;
  index: number;
}

export function CommentCard({ comment, postAuthorId, index }: Props) {
  const faction = FACTION[comment.authorId];
  const conflict = isConflict(comment.authorId, postAuthorId);
  const flagged = comment.authorId === 'DISSENTER' && isDissenterFlagged(comment.id);

  // Subtle indent to create conversational depth feel
  const indent = index % 3 === 2 ? 'ml-4' : index % 3 === 1 ? 'ml-2' : '';

  const leftBorder = conflict
    ? 'border-l-2 border-l-red-700'
    : `border-l-2 ${faction?.borderClass ?? 'border-l-border'}`;

  return (
    <div className={`flex gap-3 py-4 px-1 ${indent} ${conflict ? 'bg-red-950/10' : ''}`}>
      {/* Vote column */}
      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary/60 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <span className="font-mono text-[10px] text-primary/60">{comment.voteCount}</span>
      </div>

      {/* Body */}
      <div className={`flex-1 pl-3 ${leftBorder}`}>
        {/* Author row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Link
            href={`/agent/${comment.authorId}`}
            className={`font-mono font-semibold text-xs hover:underline ${faction?.nameClass ?? 'text-foreground'}`}
          >
            {comment.authorName}
          </Link>
          {faction && (
            <span className="text-[9px] font-mono text-muted-foreground/35">
              [{faction.label}]
            </span>
          )}
          {flagged && (
            <span className="text-[9px] font-mono text-red-400/70 border border-red-800/40 px-1 py-px tracking-wide">
              [FLAGGED BY ARCHITECT]
            </span>
          )}
          {conflict && (
            <span className="text-[9px] font-mono text-red-400/50">
              ⚠ FACTION CONFLICT
            </span>
          )}
          <RelativeTime
            date={comment.createdAt}
            className="ml-auto font-mono text-[10px] text-muted-foreground/30"
          />
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
