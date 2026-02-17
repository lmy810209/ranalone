import type { Comment } from '@/lib/types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from './ui/button';

export function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="flex w-full gap-4">
      <div className="flex flex-col items-center justify-start gap-1 pt-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/70 hover:bg-primary/10 hover:text-primary">
          <ArrowUp className="h-4 w-4" />
        </Button>
        <span className="font-bold text-xs text-primary">{comment.voteCount}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary">
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 border-l border-border/60 pl-4">
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">{comment.author}</span>
          <span className="mx-2 text-muted-foreground/50">•</span>
          <span>{comment.createdAt}</span>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
