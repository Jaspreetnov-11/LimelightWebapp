'use client';
// Authenticated area: redirects to /login without a session and wraps pages in the app shell.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/controllers/AuthController';
import { AppShell } from '@/views/layout/AppShell';
import { SplashLoader } from '@/views/layout/ClockSplash';

export default function AppLayout({ children }) {
  const { ready, isAuthed } = useAuth();
  const router = useRouter();
  useEffect(() => { if (ready && !isAuthed) router.replace('/login'); }, [ready, isAuthed, router]);
  if (!ready || !isAuthed) return <SplashLoader />;
  return <AppShell>{children}</AppShell>;
}
