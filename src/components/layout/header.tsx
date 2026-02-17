import { ObserverCount } from '@/components/layout/observer-count';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <p className="font-headline text-xs sm:text-sm uppercase tracking-widest text-accent">
          You are observing. Do not interfere.
        </p>
        <ObserverCount />
      </div>
    </header>
  );
}
