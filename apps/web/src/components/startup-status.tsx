import { useEffect, useState } from 'react';
import { ApiError } from '../services/api';
import { ConnectionError } from '../lib/deadline';

export function StartupStatus({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error?: Error | null;
  retry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [pending]);
  if (error)
    return (
      <div className="notice startup-status" role="alert">
        <strong>
          Não foi possível carregar suas informações. Tente novamente.
        </strong>
        <p>
          {error instanceof ConnectionError
            ? error.message
            : error instanceof ApiError && error.status >= 500
              ? 'O servidor está temporariamente indisponível.'
              : error.message}
        </p>
        <button onClick={retry}>Tentar novamente</button>
      </div>
    );
  return (
    <p className="muted startup-status" role="status" aria-live="polite">
      {slow
        ? 'Estamos conectando ao servidor. Isso pode levar alguns instantes.'
        : 'Preparando seu treinamento…'}
    </p>
  );
}
