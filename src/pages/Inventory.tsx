import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category } from '../types';
import { Plus, Search, Package, AlertTriangle, TrendingUp, X, AlertCircle, Trash2, Edit2, CheckCircle2, MoreVertical, Settings2, Tag, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../App';

export default function Inventory() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [category, setCategory] = useState('');
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    setLoading(true);
    
    // Real-time products
    const qProducts = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snap) => {
      const list: Product[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching products:', err);
      setError('Erro ao carregar produtos.');
      setLoading(false);
    });

    // Real-time categories
    const qCategories = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(qCategories, (snap) => {
      const list: Category[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({ id: doc.id, name: data.name, createdAt: data.createdAt } as Category);
      });
      setCategories(list);
    }, (err) => {
      console.error('Error fetching categories:', err);
      setError('Erro ao carregar categorias.');
    });

    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    
    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(prev => ({ ...prev, submitProduct: true }));
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          name,
          price,
          stock,
          category,
          updatedAt: serverTimestamp(),
        });
        setSuccess('Produto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'products'), {
          name,
          price,
          stock,
          category,
          createdAt: serverTimestamp(),
        });
        setSuccess('Produto cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      setError('Erro ao salvar produto.');
    } finally {
      setActionLoading(prev => ({ ...prev, submitProduct: false }));
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(prev => ({ ...prev, submitCategory: true }));
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          name: categoryName,
        });
        setSuccess('Categoria atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'categories'), {
          name: categoryName,
          createdAt: serverTimestamp(),
        });
        setSuccess('Categoria cadastrada com sucesso!');
      }
      setCategoryName('');
      setEditingCategory(null);
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Erro ao salvar categoria.');
    } finally {
      setActionLoading(prev => ({ ...prev, submitCategory: false }));
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return;
    setActionLoading(prev => ({ ...prev, [`deleteCategory_${id}`]: true }));
    try {
      await deleteDoc(doc(db, 'categories', id));
      setSuccess('Categoria excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Erro ao excluir categoria.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`deleteCategory_${id}`]: false }));
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setPrice(product.price);
      setStock(product.stock);
      setCategory(product.category || '');
    } else {
      setEditingProduct(null);
      resetForm();
    }
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setName('');
    setPrice(0);
    setStock(0);
    setCategory('');
  };

  const updateStock = async (id: string, newStock: number) => {
    setActionLoading(prev => ({ ...prev, [`updateStock_${id}`]: true }));
    try {
      await updateDoc(doc(db, 'products', id), { stock: newStock });
    } catch (error) {
      console.error('Error updating stock:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [`updateStock_${id}`]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [`deleteProduct_${id}`]: true }));
    try {
      setError(null);
      await deleteDoc(doc(db, 'products', id));
      setDeletingProduct(null);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setError('Erro ao excluir produto: ' + (error.message || 'Sem permissão'));
    } finally {
      setActionLoading(prev => ({ ...prev, [`deleteProduct_${id}`]: false }));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const categoryOptions = categories.map(c => c.name).sort();

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || (p.category || 'Sem Categoria') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Estoque</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie seus acessórios e peças.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsCategoryModalOpen(true)} className="btn btn-secondary gap-2 flex-1 sm:flex-none">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Categorias</span>
          </button>
          <button onClick={() => openModal()} className="btn btn-primary gap-2 flex-1 sm:flex-none">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5 sm:p-3 text-blue-600 dark:text-blue-400">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">Itens Encontrados</p>
              <p className="text-lg sm:text-2xl font-bold text-[var(--text-main)]">{filteredProducts.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2.5 sm:p-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">Estoque Baixo (Filtro)</p>
              <p className="text-lg sm:text-2xl font-bold text-[var(--text-main)]">
                {filteredProducts.filter(p => p.stock <= 5).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5 sm:p-3 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">Valor em Estoque (Filtro)</p>
              <p className="text-lg sm:text-2xl font-bold text-[var(--text-main)]">
                R$ {filteredProducts.reduce((acc, p) => acc + (p.price * p.stock), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nome ou categoria..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input md:w-48"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Todas Categorias</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">Carregando estoque...</p>
        </div>
      ) : (
        <>
          {/* Mobile View (Cards) */}
          <div className="grid gap-4 sm:hidden">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div key={product.id} className="card p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-[var(--text-main)]">{product.name}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{product.category || 'Sem Categoria'}</p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === product.id ? null : product.id);
                        }}
                        className="btn btn-secondary h-8 w-8 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {activeDropdown === product.id && (
                        <div className="absolute right-0 mt-2 w-32 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-lg z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(product);
                              setActiveDropdown(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProduct(product.id);
                              setActiveDropdown(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-[var(--text-main)]">R$ {product.price.toFixed(2)}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      product.stock <= 5 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {product.stock} unidades
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                    <button
                      onClick={() => updateStock(product.id, Math.max(0, product.stock - 1))}
                      disabled={actionLoading[`updateStock_${product.id}`]}
                      className="btn btn-secondary flex-1 h-9 disabled:opacity-50"
                    >
                      {actionLoading[`updateStock_${product.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : '-'}
                    </button>
                    <button
                      onClick={() => updateStock(product.id, product.stock + 1)}
                      disabled={actionLoading[`updateStock_${product.id}`]}
                      className="btn btn-secondary flex-1 h-9 disabled:opacity-50"
                    >
                      {actionLoading[`updateStock_${product.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : '+'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="card p-8 text-center text-[var(--text-muted)]">
                Nenhum produto encontrado.
              </div>
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden sm:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-[var(--text-muted)]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Produto</th>
                    <th className="px-6 py-3 font-semibold">Categoria</th>
                    <th className="px-6 py-3 font-semibold">Preço</th>
                    <th className="px-6 py-3 font-semibold">Estoque</th>
                    <th className="px-6 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-[var(--text-main)]">{product.name}</td>
                        <td className="px-6 py-4 text-[var(--text-muted)]">{product.category || '-'}</td>
                        <td className="px-6 py-4 text-[var(--text-muted)]">R$ {product.price.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            product.stock <= 5 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {product.stock} unidades
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <div className="flex items-center gap-1 mr-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStock(product.id, Math.max(0, product.stock - 1));
                                }}
                                disabled={actionLoading[`updateStock_${product.id}`]}
                                className="btn btn-secondary h-7 w-7 p-0 text-xs disabled:opacity-50"
                                title="Diminuir Estoque"
                              >
                                {actionLoading[`updateStock_${product.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : '-'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStock(product.id, product.stock + 1);
                                }}
                                disabled={actionLoading[`updateStock_${product.id}`]}
                                className="btn btn-secondary h-7 w-7 p-0 text-xs disabled:opacity-50"
                                title="Aumentar Estoque"
                              >
                                {actionLoading[`updateStock_${product.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : '+'}
                              </button>
                            </div>

                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(activeDropdown === product.id ? null : product.id);
                                }}
                                className="btn btn-secondary h-8 w-8 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {activeDropdown === product.id && (
                                <div className="absolute right-0 mt-2 w-32 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-lg z-10">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openModal(product);
                                      setActiveDropdown(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingProduct(product.id);
                                      setActiveDropdown(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProduct(null)}
                className="btn btn-secondary flex-1"
                disabled={actionLoading[`deleteProduct_${deletingProduct}`]}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingProduct)}
                disabled={actionLoading[`deleteProduct_${deletingProduct}`]}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1 gap-2"
              >
                {actionLoading[`deleteProduct_${deletingProduct}`] && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionLoading[`deleteProduct_${deletingProduct}`] ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Nome do Produto</label>
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
                <label className="text-sm font-medium text-[var(--text-muted)]">Categoria</label>
                <select
                  className="input mt-1"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)]">Preço (R$)</label>
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
                  <label className="text-sm font-medium text-[var(--text-muted)]">Estoque Inicial</label>
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
                  disabled={actionLoading.submitProduct}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading.submitProduct} className="btn btn-primary flex-1 gap-2">
                  {actionLoading.submitProduct && <Loader2 className="h-4 w-4 animate-spin" />}
                  {actionLoading.submitProduct ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Categorias */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Gerenciar Categorias</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCategorySubmit} className="mb-6 flex gap-2">
              <input
                type="text"
                required
                className="input"
                placeholder="Nova categoria..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                disabled={actionLoading.submitCategory}
              />
              <button type="submit" disabled={actionLoading.submitCategory} className="btn btn-primary min-w-[44px]">
                {actionLoading.submitCategory ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingCategory ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />)}
              </button>
              {editingCategory && !actionLoading.submitCategory && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryName('');
                  }}
                  className="btn btn-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between rounded-lg border border-[var(--border-color)] p-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[var(--text-muted)]" />
                      <span className="text-sm font-medium text-[var(--text-main)]">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryName(cat.name);
                        }}
                        disabled={actionLoading[`deleteCategory_${cat.id}`] || actionLoading.submitCategory}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md disabled:opacity-50"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        disabled={actionLoading[`deleteCategory_${cat.id}`] || actionLoading.submitCategory}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md disabled:opacity-50"
                      >
                        {actionLoading[`deleteCategory_${cat.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-[var(--text-muted)] py-4">Nenhuma categoria cadastrada.</p>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="btn btn-secondary w-full"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
