import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense } from '../types';
import { Plus, Search, Trash2, Receipt, Calendar, X, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';

export default function Expenses() {
  const { user, profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Form state
  const [description, setDescription] = useState('');
  const [value, setValue] = useState(0);
  const [category, setCategory] = useState('Peças');
  const [error, setError] = useState<string | null>(null);

  const categories = ['Peças', 'Aluguel', 'Energia', 'Internet', 'Marketing', 'Ferramentas', 'Outros'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const list: Expense[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(list);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(prev => ({ ...prev, submit: true }));
    try {
      await addDoc(collection(db, 'expenses'), {
        description,
        value,
        category,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Erro ao registrar despesa.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setActionLoading(prev => ({ ...prev, delete: true }));
    try {
      setError(null);
      await deleteDoc(doc(db, 'expenses', id));
      setDeletingExpense(null);
      fetchExpenses();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      setError('Erro ao excluir despesa: ' + (error.message || 'Sem permissão'));
    } finally {
      setActionLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const resetForm = () => {
    setDescription('');
    setValue(0);
    setCategory('Peças');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Despesas</h1>
          <p className="text-[var(--text-muted)]">Controle seus gastos e custos operacionais.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h3 className="mb-4 font-semibold text-[var(--text-main)]">Resumo de Gastos</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[var(--text-muted)]">Total de Despesas</span>
              <span className="font-bold text-[var(--text-main)]">{expenses.length}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[var(--text-muted)]">Valor Total Gasto</span>
              <span className="font-bold text-red-600">
                R$ {expenses.reduce((acc, e) => acc + e.value, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-main)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-6 py-3 font-semibold">Descrição</th>
                <th className="px-6 py-3 font-semibold">Categoria</th>
                <th className="px-6 py-3 font-semibold">Valor</th>
                <th className="px-6 py-3 font-semibold">Data</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {expenses.length > 0 ? (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-[var(--bg-main)]">
                    <td className="px-6 py-4 font-medium text-[var(--text-main)]">{expense.description}</td>
                    <td className="px-6 py-4 text-[var(--text-muted)]">
                      <span className="rounded-full bg-[var(--bg-main)] px-2 py-0.5 text-xs border border-[var(--border-color)]">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-red-600 font-medium">R$ {expense.value.toFixed(2)}</td>
                    <td className="px-6 py-4 text-[var(--text-muted)]">
                      {expense.date?.toDate ? format(expense.date.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDeletingExpense(expense.id)}
                        className="btn-secondary text-red-600 hover:text-red-700 p-2 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    {loading ? 'Carregando...' : 'Nenhuma despesa registrada.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmação de Exclusão */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingExpense(null)}
                className="btn btn-secondary flex-1"
                disabled={actionLoading.delete}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteExpense(deletingExpense)}
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

      {/* Modal Nova Despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Registrar Despesa</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Descrição</label>
                <input
                  type="text"
                  required
                  className="input mt-1"
                  placeholder="Ex: Compra de telas iPhone 11"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Categoria</label>
                <select
                  className="input mt-1"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input mt-1"
                  value={value}
                  onChange={(e) => setValue(parseFloat(e.target.value))}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary flex-1"
                  disabled={actionLoading.submit}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading.submit} className="btn btn-primary flex-1 gap-2">
                  {actionLoading.submit && <Loader2 className="h-4 w-4 animate-spin" />}
                  {actionLoading.submit ? 'Salvando...' : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
