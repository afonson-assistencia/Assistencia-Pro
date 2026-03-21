import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer } from '../types';
import { Plus, Search, UserPlus, Phone, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../App';
import { maskPhone } from '../utils/masks';

export default function Customers() {
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const list: Customer[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(list);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name,
          phone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          name,
          phone,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
      fetchCustomers();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      setError('Erro ao salvar cliente. Verifique os dados e tente novamente.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'customers', id));
      setDeletingCustomer(null);
      fetchCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      
      // Detailed error info for debugging
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        operationType: 'delete',
        path: `customers/${id}`,
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          providerInfo: auth.currentUser?.providerData.map(p => ({
            providerId: p.providerId,
            displayName: p.displayName,
            email: p.email
          })) || []
        }
      };
      
      console.error('Firestore Error Details:', JSON.stringify(errInfo));
      setError(`Erro ao excluir cliente: ${error.message || 'Sem permissão'}. Detalhes no console.`);
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const openModal = (customer?: Customer) => {
    setError(null);
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone);
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setError(null);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Clientes</h1>
          <p className="text-[var(--text-muted)]">Gerencie sua base de clientes.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-6 py-3 font-semibold">Nome</th>
              <th className="px-6 py-3 font-semibold">Telefone</th>
              <th className="px-6 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-[var(--text-main)]">{customer.name}</td>
                  <td className="px-6 py-4 text-[var(--text-muted)]">{customer.phone}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
                      >
                        <Phone className="h-4 w-4" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                      <button
                        onClick={() => openModal(customer)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingCustomer(customer.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-[var(--text-muted)]">
                  {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Confirmação de Exclusão */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingCustomer(null)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingCustomer)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                {editingCustomer ? 'Editar Cliente' : 'Cadastrar Cliente'}
              </h2>
              <button onClick={closeModal} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                  <button type="button" onClick={() => setError(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Telefone (WhatsApp)</label>
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  className="input mt-1"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingCustomer ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
