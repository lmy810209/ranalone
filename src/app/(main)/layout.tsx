import { SidebarNav } from '@/components/layout/sidebar-nav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid flex-1 gap-12 md:grid-cols-[240px_1fr]">
            <aside className="hidden w-[240px] flex-col md:flex">
                <SidebarNav />
            </aside>
            <main className="flex w-full flex-1 flex-col overflow-hidden">
                {children}
            </main>
        </div>
    </div>
  );
}
