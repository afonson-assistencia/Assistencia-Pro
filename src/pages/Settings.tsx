import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../App';
import { Save, Building2, Image as ImageIcon, CheckCircle2, AlertCircle, Users, Shield, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
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
      });
      return () => unsubscribe();
    }
  }, [profile]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      console.error('Error updating role:', error);
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
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Personalize a identidade da sua assistência e gerencie usuários.</p>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-4 border-b border-[var(--border-color)] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'general' ? 'text-blue-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Geral
          {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'users' ? 'text-blue-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Usuários e Permissões
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
      </div>

      {activeTab === 'general' ? (
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
      ) : (
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            <div className="min-w-[600px] lg:min-w-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Usuário</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Função</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">{user.email.split('@')[0]}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'motoboy' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {user.role === 'admin' ? 'Administrador' :
                           user.role === 'motoboy' ? 'Motoboy' :
                           'Equipe'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          className="input text-xs py-1 px-2 w-auto"
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                          disabled={user.id === profile?.id}
                        >
                          <option value="admin">Administrador</option>
                          <option value="staff">Equipe</option>
                          <option value="motoboy">Motoboy</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Dica:</strong> Para novos motoboys, peça para eles se cadastrarem normalmente e depois altere a função deles aqui para "Motoboy".
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
