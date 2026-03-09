'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (token) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [token, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <img src="/assets/urbano-logo.png" alt="Urbano" className="h-10 w-auto" />
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
