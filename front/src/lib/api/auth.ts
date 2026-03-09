import { apiRequest } from './client';

export interface LoginResponse {
  accessToken: string;
}

export interface RegisterResponse {
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  roleIds: number[];
}

// Role IDs matching the backend enum
export const ROLE_IDS = { Customer: 1, Merchant: 2, Admin: 3 } as const;

export async function login(email: string, password: string): Promise<string> {
  const res = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.data.accessToken;
}

export async function register(
  email: string,
  password: string,
): Promise<void> {
  await apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile(): Promise<UserProfile> {
  const res = await apiRequest<UserProfile>('/user/profile');
  return res.data;
}
