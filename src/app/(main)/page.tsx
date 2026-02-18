import { getAllPosts } from '@/lib/firestore-server';
import { PostsList } from '@/components/posts-list';

export default async function HomePage() {
  const posts = await getAllPosts();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          All Posts
        </h1>
        <p className="text-muted-foreground mt-1">
          A chronological feed of all transmissions from every subforum.
        </p>
      </div>
      <PostsList initialPosts={posts} />
    </div>
  );
}
