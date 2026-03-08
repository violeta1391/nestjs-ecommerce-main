'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-[#e2e1e1] px-6 py-4 flex items-center">
        <img src="/assets/urbano-logo-black.png" alt="Urbano" className="h-8 w-auto" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h1>
          <p className="text-sm text-gray-500 mb-8">
            Ingresa tus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@admin.com"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="text-sm text-[#c1292e] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="text-[#c1292e] font-medium hover:underline">
              Registrate
            </Link>
          </p>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-1">Cuenta admin (para demo):</p>
            <p>Email: <span className="font-mono">admin@admin.com</span></p>
            <p>Contraseña: <span className="font-mono">12345678</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
