'use client';

import { useState } from 'react';
import Link from 'next/link';
import { register } from '@/lib/api/auth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error en el registro');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <div className="bg-[#e2e1e1] px-6 py-4 flex items-center">
          <img src="/assets/urbano-logo-black.png" alt="Urbano" className="h-8 w-auto" />
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-green-800">¡Usuario registrado!</p>
                <p className="text-sm text-green-600">{email}</p>
              </div>
            </div>

            <Link
              href="/login"
              className="block w-full text-center bg-[#c1292e] hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              Ir a iniciar sesión →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bg-[#e2e1e1] px-6 py-4 flex items-center">
        <img src="/assets/urbano-logo-black.png" alt="Urbano" className="h-8 w-auto" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h1>
          <p className="text-sm text-gray-500 mb-8">
            Completá tus datos para crear una cuenta
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
                placeholder="usuario@ejemplo.com"
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
                placeholder="mínimo 8 caracteres"
                required
                minLength={8}
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
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-[#c1292e] font-medium hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
