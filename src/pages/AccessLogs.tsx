import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { AccessLog } from '../types';
import { Shield, Clock, Monitor, MapPin, Globe, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function AccessLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(
      collection(db, 'access_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessLog)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'access_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <Shield className="h-12 w-12 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">Acesso Negado</h1>
        <p className="text-[var(--text-muted)] max-w-md">
          Você não tem permissão para acessar esta página. Apenas administradores podem visualizar os logs de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Logs de Acesso</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Monitore quem acessou o sistema, quando e de onde.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <Shield className="h-12 w-12 text-[var(--text-muted)] mb-4 opacity-20" />
          <p className="text-[var(--text-muted)]">Nenhum log de acesso encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {logs.map((log) => (
            <div key={log.id} className="card p-4 hover:border-blue-500/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    <Monitor className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">{log.userEmail}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)]">
                        {log.ip}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      <span className="truncate max-w-[300px]">{log.device}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.timestamp?.toDate ? format(log.timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Recentemente'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {log.location}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:self-start">
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                    <Shield className="h-3 w-3" />
                    Acesso Verificado
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Segurança:</strong> Estes logs são gerados automaticamente a cada login. Se você notar algum acesso suspeito de um local ou dispositivo desconhecido, recomendamos alterar a senha imediatamente.
        </p>
      </div>
    </div>
  );
}
