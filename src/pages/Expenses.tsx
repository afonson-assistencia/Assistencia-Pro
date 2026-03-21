import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense } from '../types';
import { Plus, Search, Trash2, Receipt, Calendar, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';

export default function Expenses() {
  const { user, profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'expenses', id));
      setDeletingExpense(null);
      fetchExpenses();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      setError('Erro ao excluir despesa: ' + (error.message || 'Sem permissão'));
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
          <h1 className="text-2xl font-bold text-slate-900">Despesas</h1>
          <p className="text-slate-500">Controle seus gastos e custos operacionais.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Nova Despesa
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h3 className="mb-4 font-semibold text-slate-900">Resumo de Gastos</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Total de Despesas</span>
              <span className="font-bold text-slate-900">{expenses.length}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Valor Total Gasto</span>
              <span className="font-bold text-red-600">
                R$ {expenses.reduce((acc, e) => acc + e.value, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Descrição</th>
                <th className="px-6 py-3 font-semibold">Categoria</th>
                <th className="px-6 py-3 font-semibold">Valor</th>
                <th className="px-6 py-3 font-semibold">Data</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length > 0 ? (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{expense.description}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-red-600 font-medium">R$ {expense.value.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {expense.date?.toDate ? format(expense.date.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDeletingExpense(expense.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
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
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingExpense(null)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteExpense(deletingExpense)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Registrar Despesa</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Descrição</label>
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
                <label className="text-sm font-medium text-slate-700">Categoria</label>
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
                <label className="text-sm font-medium text-slate-700">Valor (R$)</label>
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
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
