'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Navbar() {
  const pathname = usePathname();
  const [storageDriver, setStorageDriver] = useState<'supabase' | 'memory' | null>(null);
  const [isLiveConfigured, setIsLiveConfigured] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { storage_driver?: string; credential_counts?: { configured?: number } }) => {
        if (d.storage_driver === 'supabase') setStorageDriver('supabase');
        else setStorageDriver('memory');
        if (d.credential_counts && (d.credential_counts.configured || 0) > 0) {
          setIsLiveConfigured(true);
        }
      })
      .catch(() => setStorageDriver('memory'));
  }, []);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="brand-wrap">
          <span className="brand-badge">Engine v1.0</span>
          <h1 className="brand-title">Yuryvox</h1>
        </Link>

        <nav>
          <ul className="nav-links">
            <li>
              <Link
                href="/"
                className={`nav-link ${pathname === '/' ? 'active' : ''}`}
                style={{ fontWeight: pathname === '/' ? 600 : 500 }}
              >
                Studio
              </Link>
            </li>
            <li>
              <Link
                href="/jobs"
                className={`nav-link ${pathname?.startsWith('/jobs') ? 'active' : ''}`}
                style={{ fontWeight: pathname?.startsWith('/jobs') ? 600 : 500 }}
              >
                Jobs Dashboard
              </Link>
            </li>
            <li>
              <Link href="/api/health" className="nav-link" target="_blank" rel="noopener noreferrer">
                Health Check
              </Link>
            </li>
            <li>
              <span
                className="nav-tag"
                style={{
                  backgroundColor: isLiveConfigured ? 'rgba(43,94,168,0.1)' : undefined,
                  color: isLiveConfigured ? '#2b5ea8' : undefined,
                  border: isLiveConfigured ? '1px solid rgba(43,94,168,0.25)' : undefined,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: isLiveConfigured ? '#2b5ea8' : '#296846',
                    marginRight: 4,
                  }}
                />
                {isLiveConfigured ? 'Live Providers Active' : 'Mock-First (Zero-Spend)'}
              </span>
            </li>
            {storageDriver === 'memory' && (
              <li>
                <span
                  className="nav-tag"
                  title="Running in-memory storage. Jobs will be lost on Vercel cold starts. Configure SUPABASE_URL + SUPABASE_SERVICE_KEY for durable storage."
                  style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', cursor: 'help' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b',
                      marginRight: 5,
                    }}
                  />
                  ⚠ Ephemeral Storage
                </span>
              </li>
            )}
            {storageDriver === 'supabase' && (
              <li>
                <span
                  className="nav-tag"
                  style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      marginRight: 5,
                    }}
                  />
                  Supabase Durable
                </span>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
