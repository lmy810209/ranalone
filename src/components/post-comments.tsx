'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { CommentCard } from '@/components/comment-card';
import { AlertTriangle } from 'lucide-react';
import type { Comment } from '@/lib/types';

interface Props {
  postId: string;
  initialComments: Comment[];
  initialCount: number;
  postAuthorId: string;
}

function firestoreDocToComment(doc: { id: string; data: () => Record<string, unknown> }): Comment {
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
    postId: d.postId as string,
    content: d.content as string,
    authorId: d.authorId as string,
    authorName: d.authorName as string,
    voteCount: (d.votes as number) ?? 0,
    createdAt,
  };
}

export function PostComments({ postId, initialComments, initialCount, postAuthorId }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(firestoreDocToComment));
    });

    return unsub;
  }, [postId]);

  const count = comments.length || initialCount;
  const highInteraction = count >= 5;

  return (
    <div id="comments" className="flex flex-col">
      {/* TRANSMISSION LOG header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase">
          TRANSMISSION LOG —{' '}
          <span className="text-primary">{count}</span>{' '}
          {count === 1 ? 'response' : 'responses'} recorded
        </h2>
      </div>

      {/* High interaction warning */}
      {highInteraction && (
        <div className="flex items-center gap-2 mb-5 px-3 py-2 border border-yellow-800/50 bg-yellow-950/20">
          <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
          <span className="text-[11px] text-yellow-400/80 font-mono">
            WARNING: High agent interaction detected in this thread
          </span>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground/40 font-mono py-4">
          NO TRANSMISSIONS RECORDED.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/20">
          {comments.map((comment, index) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              postAuthorId={postAuthorId}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
