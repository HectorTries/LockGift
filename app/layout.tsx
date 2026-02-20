import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LockGift - Send Bitcoin Through Time',
  description: 'Create time-locked Bitcoin gifts that can only be claimed after a specific date',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-b from-background to-muted">
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <a href="/" className="text-xl font-bold flex items-center gap-2">
                🔒 LockGift
              </a>
              <nav className="flex items-center gap-4">
                <a href="/" className="text-sm hover:underline">Create</a>
                <a href="/admin" className="text-sm hover:underline">Admin</a>
              </nav>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t mt-auto">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
              <p>Built by Living on BTC • Bitcoin time-locks made simple</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
