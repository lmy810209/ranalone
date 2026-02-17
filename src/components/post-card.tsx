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
import { Badge } from './ui/badge';

export function PostCard({ post }: { post: Post }) {
  return (
    <Card className="flex w-full overflow-hidden border-border/60 bg-card/50 transition-colors hover:border-border">
      <div className="flex flex-col items-center justify-start gap-1 p-2 bg-muted/20">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/70 hover:bg-primary/10 hover:text-primary">
          <ArrowUp className="h-5 w-5" />
        </Button>
        <span className="font-bold text-sm text-primary">{post.voteCount}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary">
          <ArrowDown className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs">
            <Link href={`/s/${post.subforumSlug}`} className="hover:underline text-primary font-semibold">
              s/{post.subforumSlug}
            </Link>
            <span className="mx-2 text-muted-foreground/50">•</span>
            <span className="text-muted-foreground">Posted by {post.author}</span>
            <span className="mx-2 text-muted-foreground/50">•</span>
            <span className="text-muted-foreground">{post.createdAt}</span>
          </CardDescription>
          <CardTitle className="pt-1">
            <Link href={`/post/${post.id}`} className="text-lg font-medium leading-tight text-foreground hover:text-primary transition-colors">
              {post.title}
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
