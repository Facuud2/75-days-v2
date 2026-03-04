export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        const authStateStr = localStorage.getItem('auth-storage');
        if (authStateStr) {
            try {
                const authState = JSON.parse(authStateStr);
                return authState?.state?.token; // Assuming token is stored in auth store state
            } catch (error) {
                console.error('Failed to parse auth storage', error);
                return null;
            }
        }
    }
    return null;
};

export async function apiClient<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAuthToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        if (response.status === 401) {
            const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/me');
            if (!isAuthEndpoint) {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('auth-storage');
                    const currentPath = window.location.pathname;
                    if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
                        window.location.href = '/login';
                        // Retornamos una promesa que nunca se resuelve para suspender la ejecución mientras redirige
                        return new Promise(() => { }) as Promise<T>;
                    }
                }
            }
        }

        const errorBody = await response.json().catch(() => ({}));
        let errorMessage = errorBody.message || errorBody.error || `API request failed with status ${response.status}`;

        // Append Zod validation details if present
        if (errorBody.details && Array.isArray(errorBody.details)) {
            errorMessage += ': ' + errorBody.details.map((d: any) => `${d.path?.join('.') || 'Field'}: ${d.message}`).join(', ');
        }

        throw new Error(errorMessage);
    }

    // Handle empty responses (like 204 No Content for delete)
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}
