import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(new Error(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h1>
          <p className="text-slate-600 mb-6">
            Ocorreu um erro inesperado. Por favor, tente recarregar a página.
          </p>
          {error && (
            <pre className="bg-slate-50 p-4 rounded-lg text-left text-xs text-red-600 overflow-auto max-h-40 mb-6 font-mono">
              {error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
