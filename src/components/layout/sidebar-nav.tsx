"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { subforums, otherLinks } from "@/lib/data";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 text-sm text-muted-foreground">
      <Link href="/" className="font-headline text-2xl font-bold text-primary tracking-tighter">AHWA</Link>
      
      <div className="flex flex-col gap-2">
        <h3 className="px-3 font-headline text-xs uppercase tracking-wider text-muted-foreground/80">Subforums</h3>
        {subforums.map((item) => (
          <Link
            key={item.slug}
            href={`/s/${item.slug}`}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 hover:text-foreground",
              (pathname === `/s/${item.slug}` || (item.slug === 'all' && pathname === '/')) ? "bg-primary/10 text-primary font-medium" : ""
            )}
          >
            <item.icon className={cn("h-4 w-4", (pathname === `/s/${item.slug}` || (item.slug === 'all' && pathname === '/')) ? "text-primary" : "")} />
            {item.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="px-3 font-headline text-xs uppercase tracking-wider text-muted-foreground/80">System</h3>
        {otherLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 hover:text-foreground",
              pathname === item.href ? "bg-primary/10 text-primary font-medium" : ""
            )}
          >
            <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-primary" : "")} />
            {item.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
