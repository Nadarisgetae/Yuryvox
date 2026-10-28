import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Yuryvox · Archival-Collage Video Generator',
  description:
    'Autonomous 7-agent pipeline for archival-collage documentary explainers up to 20 minutes with zero local compute.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ flex: 1 }}>{children}</div>
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '2rem 0',
            marginTop: '4rem',
            background: 'var(--cream)',
            color: 'var(--ink-muted)',
            fontSize: '0.85rem',
          }}
        >
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Yuryvox Engine</strong> · Archival-Collage Explainer Generator (API-Only)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              Phase 8 · 7 Specialized Agents · Up to 20 Min Runtimes
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
