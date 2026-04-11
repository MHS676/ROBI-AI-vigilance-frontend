import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Falcon Intelli-Sense',
    template: '%s — Falcon Intelli-Sense',
  },
  description:
    'Enterprise AI Surveillance Management Platform — Falcon Security Limited',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
