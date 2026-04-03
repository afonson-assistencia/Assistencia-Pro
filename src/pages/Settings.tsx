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
  const [pixKey, setPixKey] = useState(settings.pixKey || '');
  const [pixCity, setPixCity] = useState(settings.pixCity || '');
  const [pixName, setPixName] = useState(settings.pixName || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(settings.name);
    setLogoUrl(settings.logoUrl);
    setPixKey(settings.pixKey || '');
    setPixCity(settings.pixCity || '');
    setPixName(settings.pixName || '');
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
      await updateSettings({ name, logoUrl, pixKey, pixCity, pixName });
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
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie sua assistência e o gerador de PIX.</p>
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

              <div className="pt-6 border-t border-[var(--border-color)]">
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  Configuração de PIX
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Chave PIX</label>
                    <input
                      type="text"
                      className={`input ${pixKey && (pixKey.length < 10 && !pixKey.includes('@')) ? 'border-amber-500 focus:ring-amber-500' : ''}`}
                      placeholder="CPF, CNPJ, Email ou Celular com DDD"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                    />
                    {pixKey && pixKey.length > 0 && pixKey.length < 10 && !pixKey.includes('@') && (
                      <p className="mt-1 text-[10px] text-amber-600 font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Chave muito curta. Para celular, use DDD + Número (Ex: 98987327719)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Nome do Beneficiário</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Nome que aparece no banco"
                      value={pixName}
                      onChange={(e) => setPixName(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Cidade</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ex: Sao Paulo"
                      value={pixCity}
                      onChange={(e) => setPixCity(e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[var(--text-muted)] italic">
                  * Estes dados são necessários para gerar o QR Code de cobrança nas vendas.
                </p>
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
