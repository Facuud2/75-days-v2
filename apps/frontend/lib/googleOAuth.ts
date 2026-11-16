'use client';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            include_granted_scopes?: boolean;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              scope?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
    /** Hook used by automated E2E / unit tests to simulate Google OAuth popup responses */
    __MOCK_GOOGLE_OAUTH__?: () => Promise<string> | string;
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google OAuth requires a browser environment'));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          gsiScriptPromise = null;
          reject(new Error('No pudimos cargar los servicios de Google.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('No pudimos cargar los servicios de Google.'));
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

export interface GoogleTokenRequestHandle {
  promise: Promise<string>;
  cancel: () => void;
}

/**
 * Opens the Google Identity Services OAuth2 Popup and resolves with an `access_token`.
 * Supports cancellation if the user clicks the back arrow button before completing auth.
 */
export function requestGoogleAccessToken(): GoogleTokenRequestHandle {
  let isCancelled = false;
  let rejectFn: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<string>((resolve, reject) => {
    rejectFn = reject;

    (async () => {
      try {
        // Test hook for Playwright / local E2E verification
        if (typeof window !== 'undefined' && typeof window.__MOCK_GOOGLE_OAUTH__ === 'function') {
          const mockToken = await window.__MOCK_GOOGLE_OAUTH__();
          if (isCancelled) return;
          resolve(mockToken);
          return;
        }

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
        if (!clientId) {
          throw new Error(
            'Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID en las variables de entorno.'
          );
        }

        await loadGoogleIdentityScript();
        if (isCancelled) return;

        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          throw new Error('Google Identity Services no está disponible en este navegador.');
        }

        const tokenClient = oauth2.initTokenClient({
          client_id: clientId,
          scope:
            'openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/user.birthday.read',
          include_granted_scopes: true,
          callback: (response) => {
            if (isCancelled) return;
            if (response.error || !response.access_token) {
              reject(
                new Error(
                  response.error_description ||
                    response.error ||
                    'Se canceló el inicio de sesión con Google.'
                )
              );
              return;
            }
            resolve(response.access_token);
          },
          error_callback: (err) => {
            if (isCancelled) return;
            if (err?.type === 'popup_closed') {
              reject(new Error('Cerraste la ventana de Google antes de completar el acceso.'));
            } else {
              reject(new Error(err?.message || 'No se pudo abrir la ventana de Google.'));
            }
          },
        });

        tokenClient.requestAccessToken();
      } catch (err) {
        if (!isCancelled) {
          reject(err);
        }
      }
    })();
  });

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (rejectFn) {
        rejectFn(new Error('GOOGLE_AUTH_CANCELLED'));
      }
    },
  };
}
