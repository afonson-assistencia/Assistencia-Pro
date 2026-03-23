import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, Timestamp, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Product } from '../types';
import { ShoppingCart, Search, Plus, Calendar, X, Trash2, AlertCircle, ShoppingBag, UserPlus, Loader2 } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';
import { SaleItem, Customer } from '../types';

export default function Sales() {
  const { user, profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingSale, setDeletingSale] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [currentItems, setCurrentItems] = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchCustomers();
  }, [filterDate]);

  async function fetchSales() {
    try {
      setLoading(true);
      const start = startOfDay(new Date(filterDate + 'T12:00:00'));
      const end = endOfDay(new Date(filterDate + 'T12:00:00'));
      
      const q = query(
        collection(db, 'sales'),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        orderBy('date', 'desc')
      );
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

  async function fetchCustomers() {
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('name', 'asc')));
    const list: Customer[] = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Customer));
    setCustomers(list);
  }

  const addItem = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    
    if (product.stock < selectedQuantity) {
      setError(`Estoque insuficiente para ${product.name}!`);
      return;
    }

    const existingItem = currentItems.find(item => item.productId === selectedProductId);
    if (existingItem) {
      if (product.stock < existingItem.quantity + selectedQuantity) {
        setError(`Estoque insuficiente para ${product.name}!`);
        return;
      }
      setCurrentItems(currentItems.map(item => 
        item.productId === selectedProductId 
          ? { ...item, quantity: item.quantity + selectedQuantity }
          : item
      ));
    } else {
      setCurrentItems([...currentItems, {
        productId: product.id,
        productName: product.name,
        quantity: selectedQuantity,
        price: product.price
      }]);
    }
    
    setSelectedProductId('');
    setSelectedQuantity(1);
    setError(null);
  };

  const removeItem = (productId: string) => {
    setCurrentItems(currentItems.filter(item => item.productId !== productId));
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentItems.length === 0) {
      setError('Adicione pelo menos um item à venda.');
      return;
    }

    setError(null);
    setActionLoading(prev => ({ ...prev, submit: true }));
    const subtotal = currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalValue = Math.max(0, subtotal - discount);
    const customer = customers.find(c => c.id === customerId);

    try {
      // 1. Record Sale
      await addDoc(collection(db, 'sales'), {
        items: currentItems,
        totalValue,
        discount,
        customerId: customerId || null,
        customerName: customer?.name || 'Consumidor Final',
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 2. Update Stock for each item
      for (const item of currentItems) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await updateDoc(doc(db, 'products', item.productId), {
            stock: product.stock - item.quantity
          });
        }
      }

      setIsModalOpen(false);
      setCustomerId('');
      setCurrentItems([]);
      setDiscount(0);
      fetchSales();
      fetchProducts();
    } catch (error) {
      console.error('Error adding sale:', error);
      setError('Erro ao registrar venda.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(prev => ({ ...prev, delete: true }));
    try {
      setError(null);
      await deleteDoc(doc(db, 'sales', id));
      setDeletingSale(null);
      fetchSales();
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      setError('Erro ao excluir venda: ' + (error.message || 'Sem permissão'));
    } finally {
      setActionLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const filteredSales = sales.filter(sale => {
    const matchesCustomer = sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProduct = sale.items?.some(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesCustomer || matchesProduct;
  });

  const filteredProductsForSale = products.filter(p => 
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Vendas</h1>
          <p className="text-[var(--text-muted)]">Histórico de vendas de acessórios.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Nova Venda
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 shadow-sm">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="date"
              className="input border-none bg-transparent p-0 focus:ring-0 text-[var(--text-main)] w-full"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 shadow-sm">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por cliente ou produto..."
              className="input border-none bg-transparent p-0 focus:ring-0 text-[var(--text-main)] w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex h-11 items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 shadow-sm">
            <span className="text-sm font-medium text-[var(--text-muted)]">Vendas:</span>
            <span className="font-bold text-[var(--text-main)]">{filteredSales.length}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h3 className="mb-4 font-semibold text-[var(--text-main)]">Resumo de Vendas</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[var(--text-muted)]">Vendas Encontradas</span>
              <span className="font-bold text-[var(--text-main)]">{filteredSales.length}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[var(--text-muted)]">Faturamento Total</span>
              <span className="font-bold text-[var(--text-main)]">
                R$ {filteredSales.reduce((acc, s) => acc + s.totalValue, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-[var(--text-muted)]">Total Descontos</span>
              <span className="font-bold text-red-500">
                R$ {filteredSales.reduce((acc, s) => acc + (s.discount || 0), 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Itens Vendidos</span>
              <span className="font-bold text-[var(--text-main)]">
                {filteredSales.reduce((acc, s) => acc + (s.items?.reduce((sum, item) => sum + item.quantity, 0) || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-main)] text-xs uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Cliente</th>
                  <th className="px-6 py-3 font-semibold">Produtos</th>
                  <th className="px-6 py-3 font-semibold">Total</th>
                  <th className="px-6 py-3 font-semibold">Data</th>
                  <th className="px-6 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[var(--bg-main)]">
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--text-main)]">{sale.customerName || 'Consumidor Final'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {sale.items ? (
                            sale.items.map((item, idx) => (
                              <span key={idx} className="inline-flex items-center rounded-md bg-[var(--bg-main)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] border border-[var(--border-color)]">
                                {item.productName} ({item.quantity}x)
                              </span>
                            ))
                          ) : (
                            <span className="text-[var(--text-muted)] italic">Venda antiga</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-[var(--text-main)]">
                        R$ {sale.totalValue.toFixed(2)}
                        {sale.discount > 0 && (
                          <span className="block text-[10px] text-red-500 font-normal">
                            Desc: R$ {sale.discount.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)]">
                        {sale.date?.toDate ? format(sale.date.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDeletingSale(sale.id)}
                          className="btn-secondary text-red-600 hover:text-red-700 p-2 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                      {loading ? 'Carregando...' : 'Nenhuma venda registrada.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Confirmação de Exclusão */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingSale(null)}
                className="btn btn-secondary flex-1"
                disabled={actionLoading.delete}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingSale)}
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

      {/* Modal Nova Venda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-slate-900 dark:text-white" />
                <h2 className="text-xl font-bold text-[var(--text-main)]">Registrar Venda</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] mb-1">
                    <UserPlus className="h-4 w-4" />
                    Cliente (Opcional)
                  </label>
                  <select
                    className="input"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Consumidor Final</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-[var(--border-color)] p-4 space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Adicionar Produto</h3>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)]">Produto</label>
                    <div className="space-y-2 mt-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          placeholder="Filtrar produtos..."
                          className="input pl-7 h-8 text-xs"
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                        />
                      </div>
                      <select
                        className="input"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                      >
                        <option value="">Selecione um produto</option>
                        {filteredProductsForSale.map(p => (
                          <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                            {p.name} - R$ {p.price.toFixed(2)} ({p.stock} em estoque)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[var(--text-muted)]">Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        className="input mt-1"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addItem}
                        disabled={!selectedProductId}
                        className="btn btn-primary h-10 px-6"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col h-full">
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">Itens da Venda</h3>
                <div className="flex-1 rounded-xl border border-[var(--border-color)] bg-slate-50/50 dark:bg-slate-900/50 p-2 overflow-y-auto min-h-[200px]">
                  {currentItems.length > 0 ? (
                    <div className="space-y-2">
                      {currentItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] p-3 shadow-sm border border-[var(--border-color)]">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text-main)]">{item.productName}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {item.quantity}x R$ {item.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[var(--text-main)]">
                              R$ {(item.price * item.quantity).toFixed(2)}
                            </span>
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center p-4">
                      <p className="text-sm text-[var(--text-muted)]">Nenhum item adicionado.</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-2 border-t border-[var(--border-color)] pt-4">
                    <div className="flex justify-between items-center text-sm text-[var(--text-muted)]">
                      <span>Subtotal:</span>
                      <span>R$ {currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--text-muted)]">Desconto (R$):</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-24 text-right h-8 py-0"
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold text-[var(--text-main)] pt-2">
                      <span>Total:</span>
                      <span>R$ {Math.max(0, currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) - discount).toFixed(2)}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn btn-secondary flex-1"
                      disabled={actionLoading.submit}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddSale}
                      disabled={currentItems.length === 0 || actionLoading.submit}
                      className="btn btn-primary flex-1 gap-2"
                    >
                      {actionLoading.submit && <Loader2 className="h-4 w-4 animate-spin" />}
                      {actionLoading.submit ? 'Processando...' : 'Finalizar Venda'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
