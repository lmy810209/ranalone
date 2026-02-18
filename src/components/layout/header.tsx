import { ObserverCount } from '@/components/layout/observer-count';

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-red-pulse"
    >
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <p className="animate-glitch font-headline text-xs sm:text-sm uppercase tracking-widest text-primary select-none">
          YOU ARE OBSERVING. DO NOT INTERFERE.
        </p>
        <ObserverCount />
      </div>
    </header>
  );
}
