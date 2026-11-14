import { baseRequest, API_BASE_URL } from './base';

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return baseRequest<T>(endpoint, { baseUrl: API_BASE_URL, ...options });
}
