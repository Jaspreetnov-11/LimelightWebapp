'use client';
// Self sign-up is disabled: accounts are created by an admin under Staff.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/login'); }, [router]);
  return null;
}
