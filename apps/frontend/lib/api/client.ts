import { baseRequest, API_BASE_URL, type RequestOptions } from './base';

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  return baseRequest<T>(endpoint, { baseUrl: API_BASE_URL, ...options });
}
