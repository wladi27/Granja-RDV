import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { SiteHeader } from '@/components/layout/site-header';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: 'Granja Raiz de Vida',
  description: 'Plataforma e-commerce con referidos y comisiones',
};

export const viewport: Viewport = {
  themeColor: '#17372a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${manrope.variable} ${fraunces.variable}`} suppressHydrationWarning>
        <div className="app-shell min-h-screen pb-8" suppressHydrationWarning>
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
