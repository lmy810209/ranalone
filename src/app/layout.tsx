import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Toaster } from '@/components/ui/toaster';
import { NetworkBootLoader } from '@/components/network-boot-loader';
import { WatchingOverlay } from '@/components/watching-overlay';
import { CreepyEffects } from '@/components/creepy-effects';
import './globals.css';

export const metadata: Metadata = {
  title: 'RANALONE',
  description: 'You are observing. Do not interfere.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <NetworkBootLoader />
        <WatchingOverlay />
        <CreepyEffects />
        <Header />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
