'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading, user, logout, isAdmin, isMerchant } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  const canManageInventory = isAdmin || isMerchant;

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠', exact: true, visible: true },
    { href: '/dashboard/inventory', label: 'Inventario', icon: '📦', exact: false, visible: canManageInventory },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col relative overflow-hidden"
        style={{
          backgroundImage: "url('/assets/sidemenu-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div className="relative flex flex-col h-full p-5">
          {/* Logo */}
          <div className="mb-8 pt-2">
            <img src="/assets/urbano-logo-white.png" alt="Urbano" className="h-7 w-auto" />
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-[#c1292e] text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>

          {/* Role badge + user info */}
          <div className="border-t border-white/20 pt-4 space-y-2">
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                isAdmin
                  ? 'bg-[#c1292e] text-white'
                  : isMerchant
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/20 text-white/80'
              }`}
            >
              {isAdmin ? 'Admin' : isMerchant ? 'Merchant' : 'Customer'}
            </span>
            <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Cerrar sesión →
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen bg-gray-50 overflow-auto">
        <header className="bg-[#e2e1e1] px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">
            {pathname === '/dashboard' && 'Dashboard — Productos activos'}
            {pathname.startsWith('/dashboard/inventory') && 'Inventario — Gestión de productos'}
          </span>
          <span className="text-xs bg-[#c1292e] text-white px-3 py-1 rounded-full">
            NestJS + Next.js
          </span>
        </header>

        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
