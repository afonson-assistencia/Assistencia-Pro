import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Save, Building2, Image as ImageIcon, CheckCircle2, AlertCircle, Users, Shield, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { UserProfile, UserRole } from '../types';

export default function Settings() {
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const { profile } = useAuth();
  const [name, setName] = useState(settings.name);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');

  useEffect(() => {
    if (profile?.role === 'admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));
      return () => unsubscribe();
    }
  }, [profile]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  useEffect(() => {
    setName(settings.name);
    setLogoUrl(settings.logoUrl);
  }, [settings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin') {
      setError('Apenas administradores podem alterar as configurações.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateSettings({ name, logoUrl });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Erro ao atualizar configurações.');
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--text-main)]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Configurações</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Personalize a identidade da sua assistência.</p>
        </div>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Configurações atualizadas com sucesso!
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)] mb-1">
                <Building2 className="h-4 w-4" />
                Nome da Assistência
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Ex: Assistência Pro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)] mb-1">
                <ImageIcon className="h-4 w-4" />
                Logo da Assistência
              </label>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-[var(--border-color)] bg-white p-2 overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="btn btn-secondary cursor-pointer inline-flex items-center gap-2"
                    >
                      {uploading ? 'Processando...' : 'Selecionar Imagem'}
                    </label>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Recomendado: Imagem quadrada, máx 2MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || profile?.role !== 'admin'}
              className="btn btn-primary w-full gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
