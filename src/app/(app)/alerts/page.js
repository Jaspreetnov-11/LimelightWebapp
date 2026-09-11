'use client';
// Alerts merged into Notifications.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AlertsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/notifications'); }, [router]);
  return null;
}
