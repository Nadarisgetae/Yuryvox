import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yuryvox',
  description: 'Agentic archival-collage explainer pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
