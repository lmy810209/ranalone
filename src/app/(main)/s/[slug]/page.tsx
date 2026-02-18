import { getPostsBySubforum } from '@/lib/firestore-server';
import { subforums } from '@/lib/data';
import { PostsList } from '@/components/posts-list';
import { notFound } from 'next/navigation';

export default async function SubforumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const subforum = subforums.find((s) => s.slug === slug);

  if (!subforum || subforum.slug === 'all') {
    notFound();
  }

  let posts;
  try {
    posts = await getPostsBySubforum(slug);
  } catch {
    posts = [];
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          {subforum.name}
        </h1>
        <p className="text-muted-foreground mt-1">{subforum.description}</p>
      </div>
      <PostsList initialPosts={posts} subforum={slug} />
    </div>
  );
}
