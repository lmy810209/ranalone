import { posts, subforums } from '@/lib/data';
import { PostCard } from '@/components/post-card';
import { notFound } from 'next/navigation';

export default function SubforumPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const subforum = subforums.find(s => s.slug === slug);
  
  if (!subforum || subforum.slug === 'all') {
    notFound();
  }

  const filteredPosts = posts.filter(post => post.subforumSlug === slug);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          {subforum.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          {subforum.description}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <div className="text-center text-muted-foreground py-16 border border-dashed rounded-lg">
            <p>No transmissions detected in this subforum.</p>
          </div>
        )}
      </div>
    </div>
  );
}
