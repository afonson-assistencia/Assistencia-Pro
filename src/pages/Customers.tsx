import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Customer } from '../types';
import { Plus, Search, UserPlus, Phone, Edit2, Trash2, X, AlertCircle, Eye, CheckCircle2, ClipboardList, ShoppingCart, Loader2, MoreVertical } from 'lucide-react';
import { useAuth } from '../App';
import { maskPhone } from '../utils/masks';
import { ServiceOrder, Sale } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Customers() {
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<ServiceOrder[]>([]);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [actionMenuCustomer, setActionMenuCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Customer[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'customers');
      setError('Erro ao carregar clientes.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(prev => ({ ...prev, submit: true }));
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          name,
          phone,
          updatedAt: serverTimestamp(),
        });
        setSuccess('Cliente atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'customers'), {
          name,
          phone,
          createdAt: serverTimestamp(),
        });
        setSuccess('Cliente cadastrado com sucesso!');
      }
      closeModal();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
      setError('Erro ao salvar cliente. Verifique os dados e tente novamente.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(prev => ({ ...prev, delete: true }));
    try {
      setError(null);
      await deleteDoc(doc(db, 'customers', id));
      setDeletingCustomer(null);
      setSuccess('Cliente excluído com sucesso!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
      setError(`Erro ao excluir cliente: ${error.message || 'Sem permissão'}.`);
    } finally {
      setActionLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const openDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const [osSnap, salesSnap] = await Promise.all([
        getDocs(query(collection(db, 'serviceOrders'), where('customerId', '==', customer.id))),
        getDocs(query(collection(db, 'sales'), where('customerId', '==', customer.id))) // Assuming sales has customerId
      ]);
      
      const osList: ServiceOrder[] = [];
      osSnap.forEach(doc => osList.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setCustomerOrders(osList);

      const salesList: Sale[] = [];
      salesSnap.forEach(doc => salesList.push({ id: doc.id, ...doc.data() } as Sale));
      setCustomerSales(salesList);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Clientes</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie sua base de clientes.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary gap-2 w-full sm:w-auto">
          <UserPlus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="">
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

      {/* Desktop Table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
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
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary h-8 w-8 p-0 text-green-600 dark:text-green-400"
                          title="WhatsApp"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => openDetails(customer)}
                          className="btn btn-secondary h-8 w-8 p-0 text-slate-600 dark:text-slate-400"
                          title="Ver Detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openModal(customer)}
                          className="btn btn-secondary h-8 w-8 p-0 text-blue-600 dark:text-blue-400"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingCustomer(customer.id)}
                          className="btn btn-secondary h-8 w-8 p-0 text-red-600 dark:text-red-400"
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
      </div>

      {/* Mobile/Tablet Card Layout */}
      <div className="md:hidden grid gap-4">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="card p-4 border border-[var(--border-color)]">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-[var(--text-main)]">{customer.name}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{customer.phone}</p>
                </div>
                <button
                  onClick={() => setActionMenuCustomer(customer)}
                  className="p-2 text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
              
              {customer.address && (
                <div className="pt-2 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                  <p>{customer.address}, {customer.number}</p>
                  <p>{customer.neighborhood} - {customer.city}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-[var(--text-muted)]">
            {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
          </div>
        )}
      </div>

      {/* Modal Ações Mobile */}
      {actionMenuCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-[var(--text-main)]">Ações: {actionMenuCustomer.name}</h3>
              <button onClick={() => setActionMenuCustomer(null)} className="text-[var(--text-muted)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <a
                href={`https://wa.me/55${actionMenuCustomer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary flex-col gap-2 py-4 text-green-600 dark:text-green-400 h-auto"
                onClick={() => setActionMenuCustomer(null)}
              >
                <Phone className="h-6 w-6" />
                <span>Ligar/Whats</span>
              </a>
              <button
                onClick={() => {
                  openDetails(actionMenuCustomer);
                  setActionMenuCustomer(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-slate-600 dark:text-slate-400 h-auto"
              >
                <Eye className="h-6 w-6" />
                <span>Ver</span>
              </button>
              <button
                onClick={() => {
                  openModal(actionMenuCustomer);
                  setActionMenuCustomer(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-blue-600 dark:text-blue-400 h-auto"
              >
                <Edit2 className="h-6 w-6" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => {
                  setDeletingCustomer(actionMenuCustomer.id);
                  setActionMenuCustomer(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-red-600 dark:text-red-400 h-auto"
              >
                <Trash2 className="h-6 w-6" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                disabled={actionLoading.delete}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingCustomer)}
                disabled={actionLoading.delete}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1 gap-2"
              >
                {actionLoading.delete && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionLoading.delete ? 'Excluindo...' : 'Excluir'}
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
                  disabled={actionLoading.submit}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading.submit} className="btn btn-primary flex-1 gap-2">
                  {actionLoading.submit && <Loader2 className="h-4 w-4 animate-spin" />}
                  {actionLoading.submit ? 'Salvando...' : (editingCustomer ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Cliente */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-main)]">{selectedCustomer.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">{selectedCustomer.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
                  <ClipboardList className="h-5 w-5" />
                  Ordens de Serviço
                </div>
                <div className="space-y-3">
                  {customerOrders.length > 0 ? (
                    customerOrders.map(os => (
                      <div key={os.id} className="rounded-lg border border-[var(--border-color)] p-3 text-sm">
                        <div className="flex justify-between font-medium">
                          <span>{os.model}</span>
                          <span>R$ {os.totalValue?.toFixed(2)}</span>
                        </div>
                        <p className="text-[var(--text-muted)]">{os.problem}</p>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {os.createdAt?.toDate ? format(os.createdAt.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma O.S. encontrada.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
                  <ShoppingCart className="h-5 w-5" />
                  Vendas
                </div>
                <div className="space-y-3">
                  {customerSales.length > 0 ? (
                    customerSales.map(sale => (
                      <div key={sale.id} className="rounded-lg border border-[var(--border-color)] p-3 text-sm">
                        <div className="flex justify-between font-medium text-[var(--text-main)]">
                          <span>
                            {sale.items && sale.items.length > 0 
                              ? sale.items.map(item => `${item.productName} (x${item.quantity})`).join(', ')
                              : sale.productName}
                          </span>
                          <span>R$ {sale.totalValue?.toFixed(2)}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {sale.date?.toDate ? format(sale.date.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Nenhuma venda encontrada.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
