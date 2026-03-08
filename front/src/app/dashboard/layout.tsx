'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, isLoading, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-[#c1292e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col relative overflow-hidden"
        style={{ backgroundImage: "url('/assets/sidemenu-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70" />

        <div className="relative flex flex-col h-full p-5">
          {/* Logo */}
          <div className="mb-8 pt-2">
            <img src="/assets/urbano-logo-white.png" alt="Urbano" className="h-8 w-auto" />
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            <SidebarLink href="/dashboard" label="Dashboard" icon="⚡" />
            <SidebarLink href="/dashboard" label="Productos" icon="📦" />
            <SidebarLink href="/dashboard" label="Inventario" icon="🗃️" />
          </nav>

          {/* User info */}
          <div className="border-t border-white/20 pt-4">
            <p className="text-white/60 text-xs mb-1">Sesión activa</p>
            <p className="text-white text-sm font-medium truncate">{user?.email}</p>
            <button
              onClick={logout}
              className="mt-3 text-xs text-white/60 hover:text-white transition-colors"
            >
              Cerrar sesión →
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen bg-gray-50 overflow-auto">
        {/* Top bar */}
        <header className="bg-[#e2e1e1] px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">Demo Event-Driven Ecommerce</span>
          <span className="text-xs bg-[#c1292e] text-white px-3 py-1 rounded-full">
            NestJS + Next.js
          </span>
        </header>

        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
