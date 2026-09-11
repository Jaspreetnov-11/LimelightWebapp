'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/controllers/AuthController';

export default function Home() {
  const { ready, isAuthed } = useAuth();
  const router = useRouter();
  useEffect(() => { if (ready) router.replace(isAuthed ? '/dashboard' : '/login'); }, [ready, isAuthed, router]);
  return <div className="sky" aria-hidden="true"><div className="spot"></div></div>;
}
