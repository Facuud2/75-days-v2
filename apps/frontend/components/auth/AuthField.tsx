'use client';

import { forwardRef, useRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

type AuthFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> & {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  error?: string;
  /** Used to stagger the entrance animation without extra wrappers. */
  index?: number;
};

const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField(
    { id, label, type = 'text', error, index = 0, ...inputProps },
    ref
  ) {
    const [revealed, setRevealed] = useState(false);
    const localRef = useRef<HTMLInputElement | null>(null);
    const isPassword = type === 'password';
    const inputType = isPassword && revealed ? 'text' : type;

    const setInputRef = (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('button, a, input, label')) return;
      localRef.current?.focus();
    };

    return (
      <div
        className="auth-rise"
        style={{ '--auth-i': index } as React.CSSProperties}
      >
        <div
          className="auth-field"
          data-invalid={error ? 'true' : undefined}
          onClick={handleCardClick}
        >
          <label htmlFor={id} className="auth-label">
            {label}
          </label>
          <div className="auth-control">
            <input
              {...inputProps}
              ref={setInputRef}
              id={id}
              type={inputType}
              className={
                isPassword ? 'auth-input auth-input--password' : 'auth-input'
              }
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {isPassword && (
              <button
                type="button"
                className="auth-reveal"
                aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={revealed}
                data-revealed={revealed}
                onClick={() => setRevealed((value) => !value)}
              >
                <Eye
                  className="auth-eye auth-eye--show"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <EyeOff
                  className="auth-eye auth-eye--hide"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
        {error && (
          <p id={`${id}-error`} className="auth-error" role="alert">
            <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

export default AuthField;
