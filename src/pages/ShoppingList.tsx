import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ShoppingItem, Product } from '../types';
import { Plus, ShoppingCart, Trash2, CheckCircle2, AlertCircle, Loader2, Package, RefreshCw, Check, X } from 'lucide-react';
import { useAuth } from '../App';

export default function ShoppingList() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState('');

  useEffect(() => {
    setLoading(true);
    
    // Real-time shopping items
    const qItems = query(collection(db, 'shoppingList'), orderBy('createdAt', 'desc'));
    const unsubscribeItems = onSnapshot(qItems, (snap) => {
      const list: ShoppingItem[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ShoppingItem));
      setItems(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'shoppingList');
      setError('Erro ao carregar lista de compras.');
      setLoading(false);
    });

    // Real-time products for linking
    const qProducts = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snap) => {
      const list: Product[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    return () => {
      unsubscribeItems();
      unsubscribeProducts();
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(prev => ({ ...prev, submit: true }));
    try {
      let finalName = name;
      if (selectedProductId) {
        const product = products.find(p => p.id === selectedProductId);
        if (product) finalName = product.name;
      }

      await addDoc(collection(db, 'shoppingList'), {
        name: finalName,
        quantity,
        productId: selectedProductId || null,
        bought: false,
        createdAt: serverTimestamp(),
      });
      
      setSuccess('Item adicionado à lista!');
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'shoppingList');
      setError('Erro ao adicionar item.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setSelectedProductId('');
  };

  const toggleBought = async (item: ShoppingItem) => {
    const newStatus = !item.bought;
    setActionLoading(prev => ({ ...prev, [`bought_${item.id}`]: true }));
    try {
      // If marking as bought and linked to a product, update stock
      if (newStatus && item.productId) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock || 0;
          await updateDoc(productRef, {
            stock: currentStock + item.quantity,
            updatedAt: serverTimestamp()
          });
        }
      }

      await updateDoc(doc(db, 'shoppingList', item.id), {
        bought: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shoppingList/${item.id}`);
      setError('Erro ao atualizar item.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`bought_${item.id}`]: false }));
    }
  };

  const deleteItem = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [`delete_${id}`]: true }));
    try {
      await deleteDoc(doc(db, 'shoppingList', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shoppingList/${id}`);
      setError('Erro ao excluir item.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: false }));
    }
  };

  const lowStockProducts = products.filter(p => p.stock <= 5);
  const pendingItems = items.filter(i => !i.bought);
  const boughtItems = items.filter(i => i.bought);

  const addLowStockToShoppingList = async (product: Product) => {
    setActionLoading(prev => ({ ...prev, [`add_low_${product.id}`]: true }));
    try {
      // Check if already in pending list
      const alreadyPending = pendingItems.find(i => i.productId === product.id);
      if (alreadyPending) {
        setError(`${product.name} já está na lista de compras.`);
        return;
      }

      await addDoc(collection(db, 'shoppingList'), {
        name: product.name,
        quantity: 5, // Default suggested quantity
        productId: product.id,
        bought: false,
        createdAt: serverTimestamp(),
      });
      setSuccess(`${product.name} adicionado à lista!`);
    } catch (error) {
      console.error('Error adding low stock item:', error);
      setError('Erro ao adicionar item de baixo estoque.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`add_low_${product.id}`]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Lista de Compras</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie produtos que precisam ser repostos.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo Item
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Low Stock Suggestions */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
            <AlertCircle className="h-5 w-5" />
            <h2>Estoque Baixo</h2>
          </div>
          <div className="card p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-main)] truncate">{product.name}</p>
                    <p className="text-xs text-red-500 font-bold">{product.stock} em estoque</p>
                  </div>
                  <button 
                    onClick={() => addLowStockToShoppingList(product)}
                    disabled={actionLoading[`add_low_${product.id}`]}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md disabled:opacity-50"
                    title="Adicionar à lista"
                  >
                    {actionLoading[`add_low_${product.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-[var(--text-muted)] py-4">Nenhum produto com estoque baixo.</p>
            )}
          </div>
        </div>

        {/* Shopping List Items */}
        <div className="md:col-span-2 space-y-6">
          {/* Pending Items */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
              <ShoppingCart className="h-5 w-5" />
              <h2>Para Comprar ({pendingItems.length})</h2>
            </div>
            <div className="space-y-2">
              {loading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-[var(--text-muted)]" /></div>
              ) : pendingItems.length > 0 ? (
                pendingItems.map(item => (
                  <div key={item.id} className="card p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleBought(item)}
                        disabled={actionLoading[`bought_${item.id}`]}
                        className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-blue-500 transition-colors"
                      >
                        {actionLoading[`bought_${item.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      </button>
                      <div>
                        <p className="font-bold text-[var(--text-main)]">{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">Qtd: {item.quantity} {item.productId && <span className="ml-2 text-blue-500 font-medium">• Vinculado ao estoque</span>}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      disabled={actionLoading[`delete_${item.id}`]}
                      className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      {actionLoading[`delete_${item.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))
              ) : (
                <div className="card p-8 text-center text-[var(--text-muted)]">
                  Sua lista de compras está vazia.
                </div>
              )}
            </div>
          </div>

          {/* Recently Bought */}
          {boughtItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <h2>Comprados Recentemente</h2>
                </div>
                <button 
                  onClick={async () => {
                    if (window.confirm('Deseja limpar todos os itens comprados da lista?')) {
                      for (const item of boughtItems) {
                        await deleteDoc(doc(db, 'shoppingList', item.id));
                      }
                    }
                  }}
                  className="text-xs font-medium text-red-500 hover:underline"
                >
                  Limpar tudo
                </button>
              </div>
              <div className="space-y-2 opacity-60">
                {boughtItems.slice(0, 10).map(item => (
                  <div key={item.id} className="card p-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleBought(item)}
                        disabled={actionLoading[`bought_${item.id}`]}
                        className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white"
                      >
                        {actionLoading[`bought_${item.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <div>
                        <p className="font-medium text-[var(--text-main)] line-through">{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">Comprado • Qtd: {item.quantity}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Adicionar à Lista</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Vincular a um Produto (Opcional)</label>
                <select 
                  className="input mt-1"
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    if (e.target.value) {
                      const p = products.find(prod => prod.id === e.target.value);
                      if (p) setName(p.name);
                    }
                  }}
                >
                  <option value="">Item não cadastrado no estoque</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock})</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">Se vinculado, o estoque será atualizado automaticamente ao marcar como comprado.</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--text-muted)]">Nome do Item</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Ex: Papel Higiênico, Peça X..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!selectedProductId}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Quantidade para Comprar</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="input mt-1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
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
                  {actionLoading.submit ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
