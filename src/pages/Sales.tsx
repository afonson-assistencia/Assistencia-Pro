import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Product } from '../types';
import { ShoppingCart, Search, Plus, Calendar, X, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';

export default function Sales() {
  const { user, profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingSale, setDeletingSale] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, []);

  async function fetchSales() {
    try {
      const q = query(collection(db, 'sales'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const list: Sale[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(list);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
    const list: Product[] = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
    setProducts(list);
  }

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) {
      setError('Estoque insuficiente!');
      return;
    }

    try {
      const totalValue = product.price * quantity;
      
      // 1. Record Sale
      await addDoc(collection(db, 'sales'), {
        productId,
        productName: product.name,
        quantity,
        totalValue,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 2. Update Stock
      await updateDoc(doc(db, 'products', productId), {
        stock: product.stock - quantity
      });

      setIsModalOpen(false);
      setProductId('');
      setQuantity(1);
      fetchSales();
      fetchProducts();
    } catch (error) {
      console.error('Error adding sale:', error);
      setError('Erro ao registrar venda.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'sales', id));
      setDeletingSale(null);
      fetchSales();
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      setError('Erro ao excluir venda: ' + (error.message || 'Sem permissão'));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendas</h1>
          <p className="text-slate-500">Histórico de vendas de acessórios.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Nova Venda
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h3 className="mb-4 font-semibold text-slate-900">Resumo de Vendas</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Total de Vendas</span>
              <span className="font-bold text-slate-900">{sales.length}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Faturamento Total</span>
              <span className="font-bold text-slate-900">
                R$ {sales.reduce((acc, s) => acc + s.totalValue, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Itens Vendidos</span>
              <span className="font-bold text-slate-900">
                {sales.reduce((acc, s) => acc + s.quantity, 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Produto</th>
                <th className="px-6 py-3 font-semibold">Qtd</th>
                <th className="px-6 py-3 font-semibold">Valor</th>
                <th className="px-6 py-3 font-semibold">Data</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{sale.productName}</td>
                    <td className="px-6 py-4 text-slate-600">{sale.quantity}x</td>
                    <td className="px-6 py-4 text-slate-600">R$ {sale.totalValue.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {sale.date?.toDate ? format(sale.date.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDeletingSale(sale.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    {loading ? 'Carregando...' : 'Nenhuma venda registrada.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmação de Exclusão */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingSale(null)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingSale)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Venda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Registrar Venda</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddSale} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Produto</label>
                <select
                  required
                  className="input mt-1"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Selecione um produto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                      {p.name} - R$ {p.price.toFixed(2)} ({p.stock} em estoque)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="input mt-1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                />
              </div>
              
              {productId && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Valor Unitário:</span>
                    <span className="font-medium text-slate-900">
                      R$ {products.find(p => p.id === productId)?.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-lg font-bold">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-slate-900">
                      R$ {((products.find(p => p.id === productId)?.price || 0) * quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Finalizar Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
