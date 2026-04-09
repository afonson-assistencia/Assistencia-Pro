import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { DeliveryLocation } from '../types';
import { Plus, Trash2, Edit2, MapPin, Loader2, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function DeliverySettings() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [name, setName] = useState('');
  const [value, setValue] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'deliveryLocations'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: DeliveryLocation[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as DeliveryLocation));
      setLocations(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'deliveryLocations');
      setError('Erro ao carregar regiões de entrega.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome da região é obrigatório.');
      return;
    }

    setActionLoading(prev => ({ ...prev, submit: true }));
    try {
      const data = {
        name: name.trim(),
        value: Number(value),
        updatedAt: serverTimestamp(),
      };

      if (editingLocation) {
        await updateDoc(doc(db, 'deliveryLocations', editingLocation.id), data);
        setSuccess('Região atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'deliveryLocations'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        setSuccess('Região cadastrada com sucesso!');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'deliveryLocations');
      setError('Erro ao salvar região.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta região?')) return;
    
    setActionLoading(prev => ({ ...prev, [`delete_${id}`]: true }));
    try {
      await deleteDoc(doc(db, 'deliveryLocations', id));
      setSuccess('Região excluída com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `deliveryLocations/${id}`);
      setError('Erro ao excluir região.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: false }));
    }
  };

  const openModal = (location?: DeliveryLocation) => {
    if (location) {
      setEditingLocation(location);
      setName(location.name);
      setValue(location.value);
    } else {
      setEditingLocation(null);
      resetForm();
    }
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setName('');
    setValue(0);
    setEditingLocation(null);
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-slate-500">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Taxas de Entrega</h1>
          <p className="text-[var(--text-muted)]">Gerencie as regiões e valores de frete para sua vitrine.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Nova Região
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-6 py-3 font-semibold">Região / Bairro</th>
                <th className="px-6 py-3 font-semibold">Taxa de Entrega</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {locations.length > 0 ? (
                locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--text-main)]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        {loc.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-main)] font-bold">
                      R$ {loc.value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal(loc)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          disabled={actionLoading[`delete_${loc.id}`]}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          {actionLoading[`delete_${loc.id}`] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    Nenhuma região cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                {editingLocation ? 'Editar Região' : 'Nova Região'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Nome da Região / Bairro</label>
                <input
                  type="text"
                  required
                  className="input mt-1"
                  placeholder="Ex: Centro, Cohab, etc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Taxa de Entrega (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input mt-1"
                  value={value}
                  onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading.submit} className="btn btn-primary flex-1 gap-2">
                  {actionLoading.submit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingLocation ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
