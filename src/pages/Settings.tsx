import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Save, Building2, Image as ImageIcon, CheckCircle2, AlertCircle, Users, Shield, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { UserProfile, UserRole } from '../types';
import { Plus, Trash2 } from 'lucide-react';

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
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('motoboy');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));
      return () => unsubscribe();
    }
  }, [profile]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin') return;
    
    setCreatingUser(true);
    setError(null);
    
    try {
      // Create a secondary app instance to avoid logging out the current admin
      const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
      const newUser = userCredential.user;
      
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        email: newUserEmail,
        name: newUserEmail.split('@')[0],
        role: newUserRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Sign out from the secondary app and delete it
      await signOut(secondaryAuth);
      // @ts-ignore
      await secondaryApp.delete();
      
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('motoboy');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'Erro ao criar usuário.');
    } finally {
      setCreatingUser(false);
    }
  };

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
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie sua assistência e equipe.</p>
        </div>
      </div>

      {profile?.role === 'admin' && (
        <div className="flex gap-2 border-b border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Usuários
          </button>
        </div>
      )}

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
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Usuário
            </h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="email@exemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Senha</label>
                <input
                  type="password"
                  required
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Cargo</label>
                  <select
                    className="input"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  >
                    <option value="motoboy">Motoboy</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn btn-primary px-4"
                >
                  {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            </form>
            {error && activeTab === 'users' && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-main)] border-b border-[var(--border-color)]">
                    <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">Usuário</th>
                    <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">Cargo</th>
                    <th className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-main)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text-main)]">{u.name || u.email}</span>
                          <span className="text-xs text-[var(--text-muted)]">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                            Administrador
                          </span>
                        ) : (
                          <select
                            className="text-xs bg-transparent border border-[var(--border-color)] rounded px-2 py-1"
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                            disabled={u.id === profile?.id}
                          >
                            <option value="motoboy">Motoboy</option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                          disabled={u.id === profile?.id}
                          title="Excluir usuário (Apenas no Firestore)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
