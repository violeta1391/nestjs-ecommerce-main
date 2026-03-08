const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  data: T;
  errors: string[];
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    cache: 'no-store', // evita que el browser cachee respuestas GET
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.message ||
      (Array.isArray(data?.errors) && data.errors.length > 0
        ? data.errors.join(', ')
        : 'Error en la solicitud');
    throw new Error(message);
  }

  return data as ApiResponse<T>;
}
