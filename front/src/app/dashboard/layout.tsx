'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { ProductsProvider } from '@/lib/context/ProductsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading, user, logout, isAdmin, isMerchant } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cierra sidebar al navegar (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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

  const pageTitle = pathname === '/dashboard'
    ? 'Dashboard — Productos activos'
    : pathname.startsWith('/dashboard/inventory')
    ? 'Inventario — Gestión de productos'
    : '';

  /* ─── Sidebar content ─── */
  const SidebarInner = () => (
    <div className="relative flex flex-col h-full p-5">
      <div className="mb-8 pt-2 flex items-center justify-between">
        <img src="/assets/urbano-logo-white.png" alt="Urbano" className="h-7 w-auto" />
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Cerrar menú"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

      <div className="border-t border-white/20 pt-4 space-y-2">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
          isAdmin ? 'bg-[#c1292e] text-white' : isMerchant ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/80'
        }`}>
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
  );

  return (
    /* ProductsProvider envuelve TODO el dashboard para que ambas páginas
       (Dashboard e Inventario) compartan el mismo refreshKey */
    <ProductsProvider>
      <div className="min-h-screen flex">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-60 flex-shrink-0 flex flex-col overflow-hidden
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:relative lg:translate-x-0 lg:z-auto
          `}
          style={{
            backgroundImage: "url('/assets/sidemenu-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <SidebarInner />
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-h-screen bg-gray-50 overflow-auto min-w-0">
          <header className="bg-[#e2e1e1] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex flex-col gap-1.5 p-1.5 rounded-lg hover:bg-gray-300/50 transition-colors flex-shrink-0"
              aria-label="Abrir menú"
            >
              <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
              <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
              <span className="block w-5 h-0.5 bg-gray-700 rounded-full" />
            </button>
            <span className="text-sm font-medium text-gray-700 flex-1 truncate">{pageTitle}</span>
            <span className="text-xs bg-[#c1292e] text-white px-3 py-1 rounded-full flex-shrink-0">
              NestJS + Next.js
            </span>
          </header>

          {/* key={pathname} fuerza el remount del page component en cada navegación,
              garantizando que los refs y estado se reseteen incluso si Next.js
              intenta restaurar el árbol desde su router cache. */}
          <div key={pathname} className="flex-1 p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </ProductsProvider>
  );
}
