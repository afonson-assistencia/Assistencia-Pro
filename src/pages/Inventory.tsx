import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { Plus, Search, Package, AlertTriangle, TrendingUp, X, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../App';

export default function Inventory() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [category, setCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const list: Product[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'products'), {
        name,
        price,
        stock,
        category,
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setPrice(0);
    setStock(0);
    setCategory('');
  };

  const updateStock = async (id: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'products', id), { stock: newStock });
      fetchProducts();
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'products', id));
      setDeletingProduct(null);
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setError('Erro ao excluir produto: ' + (error.message || 'Sem permissão'));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque</h1>
          <p className="text-slate-500">Gerencie seus acessórios e peças.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total de Itens</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-red-50 p-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Estoque Baixo</p>
              <p className="text-2xl font-bold text-slate-900">
                {products.filter(p => p.stock <= 5).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Valor em Estoque</p>
              <p className="text-2xl font-bold text-slate-900">
                R$ {products.reduce((acc, p) => acc + (p.price * p.stock), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou categoria..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Produto</th>
              <th className="px-6 py-3 font-semibold">Categoria</th>
              <th className="px-6 py-3 font-semibold">Preço</th>
              <th className="px-6 py-3 font-semibold">Estoque</th>
              <th className="px-6 py-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 text-slate-600">{product.category || '-'}</td>
                  <td className="px-6 py-4 text-slate-600">R$ {product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      product.stock <= 5 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {product.stock} unidades
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => updateStock(product.id, product.stock + 1)}
                        className="btn btn-secondary h-8 w-8 p-0"
                      >
                        +
                      </button>
                      <button
                        onClick={() => updateStock(product.id, Math.max(0, product.stock - 1))}
                        className="btn btn-secondary h-8 w-8 p-0"
                      >
                        -
                      </button>
                      <button
                        onClick={() => setDeletingProduct(product.id)}
                        className="btn btn-secondary h-8 w-8 p-0 text-red-600"
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
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  {loading ? 'Carregando...' : 'Nenhum produto encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Confirmação de Exclusão */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProduct(null)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingProduct)}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Novo Produto</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome do Produto</label>
                <input
                  type="text"
                  required
                  className="input mt-1"
                  placeholder="Ex: Fone Bluetooth JBL"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Categoria</label>
                <input
                  type="text"
                  className="input mt-1"
                  placeholder="Ex: Áudio, Carregadores"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input mt-1"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    className="input mt-1"
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value))}
                  />
                </div>
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
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
