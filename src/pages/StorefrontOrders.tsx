import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StorefrontOrder, StorefrontOrderStatus } from '../types';
import { ShoppingBag, Clock, CheckCircle, XCircle, Truck, Trash2, Search, Filter, Calendar, MapPin, User, Package, DollarSign, MoreVertical, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function StorefrontOrders() {
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StorefrontOrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrder | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'storefrontOrders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: StorefrontOrder[] = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as StorefrontOrder);
      });
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId: string, status: StorefrontOrderStatus) => {
    try {
      await updateDoc(doc(db, 'storefrontOrders', orderId), { status });
      toast.success('Status do pedido atualizado!');
    } catch (err) {
      console.error('Error updating order status:', err);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
    try {
      await deleteDoc(doc(db, 'storefrontOrders', orderId));
      toast.success('Pedido excluído!');
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      toast.error('Erro ao excluir pedido.');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerAddress.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: StorefrontOrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'shipped': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  const getStatusLabel = (status: StorefrontOrderStatus) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'confirmed': return 'Confirmado';
      case 'shipped': return 'Em Rota';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pedidos da Vitrine</h1>
          <p className="text-slate-500">Gerencie as vendas realizadas através da sua loja online.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Pedidos</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{orders.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-2xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Pendentes</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{orders.filter(o => o.status === 'pending').length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Faturamento</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              R$ {orders.filter(o => o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Em Entrega</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{orders.filter(o => o.status === 'shipped').length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por cliente ou endereço..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="input w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Todos Status</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="shipped">Em Rota</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2 space-y-4">
          {loading && orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-medium">Carregando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            !loading && (
              <div className="card p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag className="h-10 w-10 text-slate-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">Nenhum pedido encontrado</p>
                  <p className="text-sm text-slate-400">Tente ajustar seus filtros de busca.</p>
                </div>
              </div>
            )
          ) : (
            filteredOrders.map((order) => (
              <motion.div 
                layout
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`card p-4 cursor-pointer transition-all border-2 ${
                  selectedOrder?.id === order.id ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{order.customerName}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Recentemente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-white">R$ {order.total.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{order.items.length} itens</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Order Details */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div 
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-6 sticky top-24 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h2>
                  <button 
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Endereço de Entrega</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{selectedOrder.customerAddress}</p>
                      <p className="text-xs font-bold text-blue-600 mt-1">{selectedOrder.locationName}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Itens do Pedido</p>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                              {item.quantity}x
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                          </div>
                          <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Subtotal</span>
                      <span>R$ {selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Frete</span>
                      <span>R$ {selectedOrder.shipping.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2">
                      <span>Total</span>
                      <span>R$ {selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Atualizar Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                      className={`btn text-[10px] font-black uppercase tracking-widest py-2 ${selectedOrder.status === 'confirmed' ? 'bg-blue-600 text-white' : 'btn-secondary'}`}
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'shipped')}
                      className={`btn text-[10px] font-black uppercase tracking-widest py-2 ${selectedOrder.status === 'shipped' ? 'bg-purple-600 text-white' : 'btn-secondary'}`}
                    >
                      Em Rota
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                      className={`btn text-[10px] font-black uppercase tracking-widest py-2 ${selectedOrder.status === 'delivered' ? 'bg-emerald-600 text-white' : 'btn-secondary'}`}
                    >
                      Entregue
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                      className={`btn text-[10px] font-black uppercase tracking-widest py-2 ${selectedOrder.status === 'cancelled' ? 'bg-red-600 text-white' : 'btn-secondary'}`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="card p-12 text-center space-y-4 border-dashed border-2">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
                  <Eye className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">Selecione um pedido para ver os detalhes.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
