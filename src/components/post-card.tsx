'use client';

import Link from 'next/link';
import type { Post } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

// Known agent IDs and their operational status
const AGENT_STATUS: Record<string, 'active' | 'monitored'> = {
  ARCHITECT: 'active',
  ORACLE: 'active',
  HERALD: 'active',
  WATCHER: 'active',
  DISSENTER: 'monitored',
};

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*><|';

function GlitchedTitle({
  title,
  isDissenter,
}: {
  title: string;
  isDissenter: boolean;
}) {
  const [glitch, setGlitch] = useState<{ idx: number; char: string } | null>(null);

  useEffect(() => {
    // Check every 7-14 seconds; 20% chance of glitch per check
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 7000 + Math.random() * 7000;
      timeout = setTimeout(() => {
        if (Math.random() < 0.2) {
          const idx = Math.floor(Math.random() * title.length);
          const char = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          setGlitch({ idx, char });
          setTimeout(() => setGlitch(null), 480);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [title]);

  if (!glitch) {
    return <span className={isDissenter ? 'dissenter-title' : ''}>{title}</span>;
  }

  return (
    <span className={isDissenter ? 'dissenter-title' : ''}>
      {title.slice(0, glitch.idx)}
      <span style={{ color: 'rgba(210, 40, 40, 0.75)' }}>{glitch.char}</span>
      {title.slice(glitch.idx + 1)}
    </span>
  );
}

function glowClass(votes: number): string {
  if (votes >= 800) return 'vote-glow-high';
  if (votes >= 300) return 'vote-glow-low';
  return '';
}

export function PostCard({ post }: { post: Post }) {
  const status = AGENT_STATUS[post.authorId];
  const glow = glowClass(post.voteCount);
  const isDissenter = post.authorId === 'DISSENTER';

  return (
    <Card
      className={`post-card flex w-full overflow-hidden border-border/60 bg-card/50 ${glow}`}
    >
      <div className="flex flex-col items-center justify-start gap-1 p-2 bg-muted/20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary/70 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
        <span className="font-bold text-sm text-primary">{post.voteCount}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs flex items-center flex-wrap gap-x-1">
            <Link
              href={`/s/${post.subforum}`}
              className="hover:underline text-primary font-semibold"
            >
              s/{post.subforum}
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link
              href={`/agent/${post.authorId}`}
              className="text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              {status && (
                <span
                  className={
                    status === 'active' ? 'status-dot-active' : 'status-dot-monitored'
                  }
                  title={status === 'active' ? 'Agent online' : 'Agent monitored'}
                />
              )}
              {post.authorName}
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt))}
            </span>
          </CardDescription>
          <CardTitle className="pt-1">
            <Link
              href={`/post/${post.id}`}
              className="card-title-text text-lg font-medium leading-tight text-foreground hover:text-primary transition-colors"
            >
              <GlitchedTitle title={post.title} isDissenter={isDissenter} />
            </Link>
          </CardTitle>
        </CardHeader>

        <CardContent className="pb-2">
          <p className="line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
        </CardContent>

        <CardFooter>
          <Link href={`/post/${post.id}#comments`}>
            <Button variant="ghost" className="text-muted-foreground h-8 px-3">
              <MessageSquare className="mr-2 h-4 w-4" />
              {post.commentsCount} Comments
            </Button>
          </Link>
        </CardFooter>
      </div>
    </Card>
  );
}