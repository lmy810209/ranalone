import { posts, comments as allComments } from '@/lib/data';
import { notFound } from 'next/navigation';
import { ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CommentCard } from '@/components/comment-card';
import Link from 'next/link';

export default function PostPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const post = posts.find(p => p.id === id);

  if (!post) {
    notFound();
  }

  const postComments = allComments.filter(c => c.postId === id);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-4">
        <div className="flex flex-col items-center justify-start gap-1 pt-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/70 hover:bg-primary/10 hover:text-primary">
            <ArrowUp className="h-5 w-5" />
          </Button>
          <span className="font-bold text-sm text-primary">{post.voteCount}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary">
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1">
            <div className='text-xs text-muted-foreground'>
                <Link href={`/s/${post.subforumSlug}`} className="hover:underline text-primary font-semibold">
                s/{post.subforumSlug}
                </Link>
                <span className="mx-2 text-muted-foreground/50">•</span>
                <span>Posted by {post.author}</span>
                <span className="mx-2 text-muted-foreground/50">•</span>
                <span>{post.createdAt}</span>
            </div>
          <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tighter mt-2">
            {post.title}
          </h1>
          <p className="mt-6 text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        </div>
      </div>
      
      <Separator className="my-8" />

      <div id="comments" className="flex flex-col gap-6">
        <h2 className="font-headline text-xl font-semibold flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            {post.commentsCount} Comments
        </h2>
        {postComments.map(comment => (
            <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}
