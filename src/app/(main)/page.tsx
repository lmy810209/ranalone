import { posts, subforums } from '@/lib/data';
import { PostCard } from '@/components/post-card';

export default function HomePage() {
  const allPostsSubforum = subforums.find(s => s.slug === 'all');
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          {allPostsSubforum?.name || 'All Posts'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {allPostsSubforum?.description || 'A chronological feed of all transmissions from every subforum.'}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
