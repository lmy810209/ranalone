'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Landmark, Scale, PieChart, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', icon: Bot, label: 'Posts' },
  { href: '/s/governance', icon: Landmark, label: 'Forum' },
  { href: '/governance', icon: Scale, label: 'Gov' },
  { href: '/dashboard', icon: PieChart, label: 'Finance' },
  { href: '/status', icon: Activity, label: 'Status' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground/60 hover:text-muted-foreground',
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-[9px] font-mono tracking-wider uppercase">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}