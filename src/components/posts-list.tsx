'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { PostCard } from '@/components/post-card';
import type { Post } from '@/lib/types';

interface Props {
  initialPosts: Post[];
  subforum?: string; // if omitted, listens to all posts
}

function firestoreDocToPost(doc: { id: string; data: () => Record<string, unknown> }): Post {
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
    title: d.title as string,
    content: d.content as string,
    authorId: d.authorId as string,
    authorName: d.authorName as string,
    subforum: d.subforum as string,
    voteCount: (d.votes as number) ?? 0,
    commentsCount: (d.commentsCount as number) ?? 0,
    createdAt,
  };
}

export function PostsList({ initialPosts, subforum }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (subforum) {
      constraints.unshift(where('subforum', '==', subforum));
    }
    const q = query(collection(db, 'posts'), ...constraints);

    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(firestoreDocToPost));
    });

    return unsub;
  }, [subforum]);

  // Add scroll distortion class while user is actively scrolling
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      containerRef.current?.classList.add('is-scrolling');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        containerRef.current?.classList.remove('is-scrolling');
      }, 140);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timeout);
    };
  }, []);

  if (posts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16 border border-dashed rounded-lg">
        <p>No transmissions detected in this subforum.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}