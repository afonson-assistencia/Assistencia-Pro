import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ServiceOrder, Customer, OSStatus, STATUS_LABELS, STATUS_COLORS } from '../types';
import { Plus, Search, Filter, Printer, MessageSquare, ChevronRight, X, Check, Send, AlertCircle, Trash2, Eye, History, FileText, Edit2, ClipboardList, LayoutGrid, List, Loader2, MoreVertical } from 'lucide-react';
import { PHONE_MODELS, SERVICES } from '../constants';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import { sendToN8N } from '../services/n8nService';
import { maskPhone } from '../utils/masks';
import { useAuth } from '../App';

export default function ServiceOrders() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [sendingN8N, setSendingN8N] = useState<string | null>(null);

  // New Customer state
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [model, setModel] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [problem, setProblem] = useState('');
  const [warrantyDays, setWarrantyDays] = useState(90);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [notes, setNotes] = useState('');
  const [totalValue, setTotalValue] = useState(0);

  // Print state
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [actionMenuOrder, setActionMenuOrder] = useState<ServiceOrder | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  useEffect(() => {
    const qOrders = query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      const list: ServiceOrder[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setOrders(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'serviceOrders');
      setError('Erro ao carregar ordens de serviço.');
      setLoading(false);
    });

    const qCustomers = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snap) => {
      const list: Customer[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'customers');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
    };
  }, []);

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(prev => ({ ...prev, submit: true }));
    
    let currentCustomerId = customerId;
    let currentCustomerName = '';
    let currentCustomerPhone = '';

    try {
      if (isAddingCustomer) {
        if (!newCustomerName || !newCustomerPhone) {
          setError('Por favor, preencha o nome e telefone do cliente.');
          return;
        }
        const customerRef = await addDoc(collection(db, 'customers'), {
          name: newCustomerName,
          phone: newCustomerPhone,
          createdAt: serverTimestamp(),
        });
        currentCustomerId = customerRef.id;
        currentCustomerName = newCustomerName;
        currentCustomerPhone = newCustomerPhone;
      } else {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) {
          setError('Por favor, selecione um cliente.');
          return;
        }
        currentCustomerName = customer.name;
        currentCustomerPhone = customer.phone;
      }

      const now = editingOrder ? (editingOrder.createdAt?.toDate?.() || new Date()) : new Date();
      const deadline = addDays(now, deadlineDays);

      const orderData: any = {
        customerId: currentCustomerId,
        customerName: currentCustomerName,
        customerPhone: currentCustomerPhone,
        model,
        services: selectedServices,
        problem,
        deadline: Timestamp.fromDate(deadline),
        warrantyDays,
        notes,
        totalValue,
      };

      if (editingOrder) {
        await updateDoc(doc(db, 'serviceOrders', editingOrder.id), orderData);
        
        try {
          await sendToN8N({
            event: 'os_updated',
            orderId: editingOrder.id,
            ...orderData,
            deadline: deadline.toISOString(),
          });
        } catch (n8nErr) {
          console.warn('N8N update send failed:', n8nErr);
        }
      } else {
        orderData.entryDate = serverTimestamp();
        orderData.status = 'pending';
        orderData.createdAt = serverTimestamp();
        
        const orderRef = await addDoc(collection(db, 'serviceOrders'), orderData);
        
        try {
          await sendToN8N({
            event: 'os_created',
            orderId: orderRef.id,
            ...orderData,
            entryDate: now.toISOString(),
            deadline: deadline.toISOString(),
          });
        } catch (n8nErr) {
          console.warn('N8N auto-send failed:', n8nErr);
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'serviceOrders');
      setError(`Erro ao ${editingOrder ? 'atualizar' : 'criar'} ordem de serviço. Verifique os dados e tente novamente.`);
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleEditOrder = (order: ServiceOrder) => {
    setEditingOrder(order);
    setCustomerId(order.customerId);
    setModel(order.model);
    setSelectedServices(order.services || []);
    setProblem(order.problem);
    setWarrantyDays(order.warrantyDays || 90);
    
    // Calculate deadline days
    if (order.deadline?.toDate) {
      const start = order.createdAt?.toDate?.() || new Date();
      const end = order.deadline.toDate();
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDeadlineDays(diffDays);
    } else {
      setDeadlineDays(3);
    }
    
    setNotes(order.notes || '');
    setTotalValue(order.totalValue || 0);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setCustomerId('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setIsAddingCustomer(false);
    setModel('');
    setSelectedServices([]);
    setProblem('');
    setWarrantyDays(90);
    setDeadlineDays(3);
    setNotes('');
    setTotalValue(0);
    setError(null);
    setEditingOrder(null);
  };

  const updateStatus = async (id: string, newStatus: OSStatus) => {
    setActionLoading(prev => ({ ...prev, [`status_${id}`]: true }));
    try {
      const order = orders.find(o => o.id === id);
      if (!order) return;

      const historyEntry = {
        status: newStatus,
        date: Timestamp.now(),
        notes: `Status alterado para ${STATUS_LABELS[newStatus]}`
      };

      const updatedHistory = [...(order.statusHistory || []), historyEntry];
      
      const updateData: any = { 
        status: newStatus,
        statusHistory: updatedHistory
      };

      if (newStatus === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'serviceOrders', id), updateData);

      try {
        await sendToN8N({
          event: 'os_status_updated',
          orderId: id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          model: order.model,
          status: newStatus,
          statusLabel: STATUS_LABELS[newStatus],
        });
      } catch (n8nErr) {
        console.warn('N8N status update send failed:', n8nErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${id}`);
      setError('Erro ao atualizar status.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`status_${id}`]: false }));
    }
  };

  const handleManualN8NSend = async (order: ServiceOrder) => {
    setSendingN8N(order.id);
    try {
      await sendToN8N({
        event: 'os_manual_send',
        ...order,
        entryDate: order.entryDate?.toDate?.()?.toISOString(),
        deadline: order.deadline?.toDate?.()?.toISOString(),
        createdAt: order.createdAt?.toDate?.()?.toISOString(),
      });
      alert('Dados enviados para o n8n com sucesso!');
    } catch (error: any) {
      alert(`Erro ao enviar para o n8n: ${error.message}`);
    } finally {
      setSendingN8N(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    setActionLoading(prev => ({ ...prev, delete: true }));
    try {
      setError(null);
      await deleteDoc(doc(db, 'serviceOrders', id));
      setDeletingOrder(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
      setError('Erro ao excluir ordem de serviço: ' + (error.message || 'Sem permissão'));
    } finally {
      setActionLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase() === 'afonsocnj@gmail.com' || 
                  user?.email?.toLowerCase() === 'afonsocnj@gmail.com';

  const generateWhatsAppLink = (order: ServiceOrder) => {
    const servicesList = order.services?.length > 0 ? `\nServiços: ${order.services.join(', ')}` : '';
    const message = `Olá ${order.customerName}! Sua ordem de serviço para o ${order.model} está com o status: ${STATUS_LABELS[order.status].toUpperCase()}.${servicesList}
    
Problema: ${order.problem}
Valor: R$ ${order.totalValue?.toFixed(2)}
Garantia: ${order.warrantyDays} dias
    
Obrigado pela preferência!`;
    
    const encoded = encodeURIComponent(message);
    return `https://wa.me/55${order.customerPhone.replace(/\D/g, '')}?text=${encoded}`;
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         o.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Ordens de Serviço</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie os consertos em andamento.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn btn-primary gap-2 flex-1 sm:flex-none">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova O.S.</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row items-center">
        <div className="flex-1 w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por cliente ou modelo..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-64 input">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--text-muted)]" />
            <select
              className="input border-none bg-transparent p-0 focus:ring-0 text-[var(--text-main)] w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">Todos os Status</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <div key={order.id} className="card p-6 transition-all hover:shadow-md border border-[var(--border-color)]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-[var(--text-main)]">{order.model}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{order.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--text-main)]">R$ {order.totalValue?.toFixed(2)}</p>
                  <p className="text-xs text-[var(--text-muted)]">#{order.id.slice(-4).toUpperCase()}</p>
                </div>
              </div>

              <div className="mb-6 space-y-2 text-sm">
                {order.services?.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[var(--text-muted)]">Serviços:</span>
                    <div className="flex flex-wrap gap-1">
                      {order.services.map(s => (
                        <span key={s} className="rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Problema:</span>
                  <span className="font-medium text-[var(--text-main)]">{order.problem}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Entrada:</span>
                  <span className="font-medium text-[var(--text-main)]">
                    {order.entryDate?.toDate ? format(order.entryDate.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Prazo:</span>
                  <span className="font-medium text-[var(--text-main)]">
                    {order.deadline?.toDate ? format(order.deadline.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1">
                  <select
                    className="btn btn-secondary w-full text-xs h-8 py-0 appearance-none pr-8 disabled:opacity-50"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as OSStatus)}
                    disabled={actionLoading[`status_${order.id}`]}
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {actionLoading[`status_${order.id}`] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditOrder(order)}
                    className="btn btn-secondary h-8 w-8 p-0 text-amber-600 dark:text-amber-400"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewingOrder(order)}
                    className="btn btn-secondary h-8 w-8 p-0 text-slate-600 dark:text-slate-400"
                    title="Ver Detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={generateWhatsAppLink(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary h-8 w-8 p-0 text-green-600 dark:text-green-400"
                    title="Enviar WhatsApp"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleManualN8NSend(order)}
                    disabled={sendingN8N === order.id}
                    className={`btn btn-secondary h-8 w-8 p-0 text-blue-600 dark:text-blue-400 ${sendingN8N === order.id ? 'opacity-50' : ''}`}
                    title="Enviar para n8n"
                  >
                    <Send className={`h-4 w-4 ${sendingN8N === order.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setTimeout(() => handlePrint(), 100);
                    }}
                    className="btn btn-secondary h-8 w-8 p-0 text-[var(--text-muted)]"
                    title="Imprimir"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingOrder(order.id)}
                    className="btn btn-secondary h-8 w-8 p-0 text-red-600 dark:text-red-400"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
            {loading ? 'Carregando...' : 'Nenhuma ordem de serviço encontrada.'}
          </div>
        )}
      </div>

      {/* Modal Ações Mobile */}
      {actionMenuOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-[var(--text-main)]">Ações: #{actionMenuOrder.id.slice(-4).toUpperCase()}</h3>
              <button onClick={() => setActionMenuOrder(null)} className="text-[var(--text-muted)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <a
                href={generateWhatsAppLink(actionMenuOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary flex-col gap-2 py-4 text-green-600 dark:text-green-400 h-auto"
                onClick={() => setActionMenuOrder(null)}
              >
                <MessageSquare className="h-6 w-6" />
                <span>WhatsApp</span>
              </a>
              <button
                onClick={() => {
                  setViewingOrder(actionMenuOrder);
                  setActionMenuOrder(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-slate-600 dark:text-slate-400 h-auto"
              >
                <Eye className="h-6 w-6" />
                <span>Ver</span>
              </button>
              <button
                onClick={() => {
                  handleEditOrder(actionMenuOrder);
                  setActionMenuOrder(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-blue-600 dark:text-blue-400 h-auto"
              >
                <Edit2 className="h-6 w-6" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(actionMenuOrder);
                  setTimeout(() => handlePrint(), 100);
                  setActionMenuOrder(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-slate-600 dark:text-slate-400 h-auto"
              >
                <Printer className="h-6 w-6" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => {
                  setDeletingOrder(actionMenuOrder.id);
                  setActionMenuOrder(null);
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
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>
            <p className="text-[var(--text-muted)] mb-6">
              Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingOrder(null)}
                className="btn btn-secondary flex-1"
                disabled={actionLoading.delete}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteOrder(deletingOrder)}
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

      {/* Modal Nova O.S. */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-[var(--border-color)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                {editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddOrder} className="grid gap-4 md:grid-cols-2">
              {error && (
                <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                  <button type="button" onClick={() => setError(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[var(--text-muted)]">Cliente</label>
                  <button 
                    type="button" 
                    onClick={() => setIsAddingCustomer(!isAddingCustomer)}
                    className="text-xs font-semibold text-[var(--text-main)] hover:underline"
                  >
                    {isAddingCustomer ? 'Selecionar existente' : '+ Novo Cliente'}
                  </button>
                </div>
                
                {isAddingCustomer ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="Nome do cliente"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                    />
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="Telefone (WhatsApp)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(maskPhone(e.target.value))}
                    />
                  </div>
                ) : (
                  <select
                    required
                    className="input"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Modelo do Aparelho</label>
                <input
                  list="phone-models"
                  type="text"
                  required
                  className="input mt-1"
                  placeholder="Ex: iPhone 13"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <datalist id="phone-models">
                  {PHONE_MODELS.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Valor Estimado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input mt-1"
                  value={totalValue}
                  onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-[var(--text-muted)]">Serviços Solicitados</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SERVICES.map(service => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => {
                        setSelectedServices(prev => 
                          prev.includes(service) 
                            ? prev.filter(s => s !== service)
                            : [...prev, service]
                        );
                      }}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                        selectedServices.includes(service)
                          ? 'border-slate-900 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-slate-300'
                      }`}
                    >
                      <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                        selectedServices.includes(service) ? 'border-white bg-white text-slate-900' : 'border-slate-300'
                      }`}>
                        {selectedServices.includes(service) && <Check className="h-3 w-3" />}
                      </div>
                      {service}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-[var(--text-muted)]">Problema Relatado / Defeito</label>
                <textarea
                  required
                  rows={2}
                  className="input mt-1 h-auto py-2"
                  placeholder="Descreva o problema detalhadamente..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Prazo de Entrega (Dias)</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    min="0"
                    className="input flex-1"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    onClick={() => setDeadlineDays(0)}
                    className={`btn px-3 text-xs ${deadlineDays === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Hoje
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Garantia (Dias)</label>
                <input
                  type="number"
                  className="input mt-1"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-[var(--text-muted)]">Observações Extras</label>
                <textarea
                  rows={2}
                  className="input mt-1 h-auto py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4 md:col-span-2">
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
                  {actionLoading.submit ? 'Processando...' : (editingOrder ? 'Salvar Alterações' : 'Criar Ordem de Serviço')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da O.S. */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Detalhes da O.S. #{viewingOrder.id.slice(-6).toUpperCase()}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cliente</p>
                  <p className="mt-1 font-medium text-[var(--text-main)]">{viewingOrder.customerName}</p>
                  <p className="text-sm text-[var(--text-muted)]">{viewingOrder.customerPhone}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aparelho</p>
                  <p className="mt-1 font-medium text-[var(--text-main)]">{viewingOrder.model}</p>
                  <p className="text-sm text-[var(--text-muted)]">Entrada: {viewingOrder.entryDate?.toDate ? format(viewingOrder.entryDate.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 font-semibold text-[var(--text-main)]">
                  <ClipboardList className="h-4 w-4" />
                  Serviços e Problema
                </div>
                <div className="rounded-lg border border-[var(--border-color)] p-4">
                  <p className="text-sm font-medium text-[var(--text-main)] mb-2">Problema Relatado:</p>
                  <p className="text-sm text-[var(--text-muted)] mb-4">{viewingOrder.problem}</p>
                  <p className="text-sm font-medium text-[var(--text-main)] mb-2">Serviços:</p>
                  <div className="flex flex-wrap gap-2">
                    {viewingOrder.services.map(s => (
                      <span key={s} className="rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {viewingOrder.notes && (
                <div>
                  <div className="flex items-center gap-2 mb-2 font-semibold text-[var(--text-main)]">
                    <FileText className="h-4 w-4" />
                    Observações
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] p-4 text-sm text-[var(--text-muted)] whitespace-pre-wrap">
                    {viewingOrder.notes}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2 font-semibold text-[var(--text-main)]">
                  <History className="h-4 w-4" />
                  Histórico de Status
                </div>
                <div className="space-y-3">
                  {viewingOrder.statusHistory && viewingOrder.statusHistory.length > 0 ? (
                    viewingOrder.statusHistory.map((h, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className={`h-2 w-2 rounded-full mt-1.5 ${
                            h.status === 'ready' ? 'bg-emerald-500' :
                            h.status === 'in-progress' ? 'bg-blue-500' :
                            h.status === 'awaiting-parts' ? 'bg-amber-500' :
                            'bg-slate-400'
                          }`} />
                          {i < viewingOrder.statusHistory!.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800 my-1" />}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-main)]">{STATUS_LABELS[h.status]}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {h.date?.toDate ? format(h.date.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                          </p>
                          {h.notes && <p className="mt-1 text-[var(--text-muted)] italic">"{h.notes}"</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full mt-1.5 bg-slate-400" />
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{STATUS_LABELS[viewingOrder.status]}</p>
                        <p className="text-xs text-[var(--text-muted)]">Status atual (sem histórico registrado)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Componente Oculto para Impressão */}
      <div className="hidden">
        <PrintOS ref={printRef} order={selectedOrder} />
      </div>
    </div>
  );
}

// Componente de Impressão
import React from 'react';
const PrintOS = React.forwardRef<HTMLDivElement, { order: ServiceOrder | null }>(({ order }, ref) => {
  if (!order) return null;

  return (
    <div ref={ref} className="p-12 text-slate-900 font-sans">
      <div className="mb-8 flex justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase">Assistência Pro</h1>
          <p className="text-sm">Consertos e Acessórios</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">O.S. #{order.id.slice(-6).toUpperCase()}</p>
          <p className="text-sm">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <h3 className="mb-2 font-bold uppercase text-[var(--text-muted)]">Cliente</h3>
          <p className="text-lg font-semibold">{order.customerName}</p>
          <p>{order.customerPhone}</p>
        </div>
        <div>
          <h3 className="mb-2 font-bold uppercase text-[var(--text-muted)]">Aparelho</h3>
          <p className="text-lg font-semibold">{order.model}</p>
          <p>Status: {STATUS_LABELS[order.status]}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="mb-2 font-bold uppercase text-[var(--text-muted)]">Serviços e Problema</h3>
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50 space-y-4">
          {order.services?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-[var(--text-muted)] opacity-70 mb-1">Serviços Solicitados:</p>
              <p className="font-semibold">{order.services.join(', ')}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)] opacity-70 mb-1">Problema Relatado:</p>
            <p>{order.problem}</p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Valor Total</p>
          <p className="text-xl font-bold">R$ {order.totalValue?.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Prazo</p>
          <p className="text-xl font-bold">
            {order.deadline?.toDate ? format(order.deadline.toDate(), 'dd/MM/yyyy') : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Garantia</p>
          <p className="text-xl font-bold">{order.warrantyDays} dias</p>
        </div>
      </div>

      {order.notes && (
        <div className="mb-8">
          <h3 className="mb-2 font-bold uppercase text-[var(--text-muted)]">Observações</h3>
          <p className="text-sm italic text-slate-600">{order.notes}</p>
        </div>
      )}

      <div className="mt-24 flex justify-between gap-12">
        <div className="flex-1 border-t border-slate-900 pt-2 text-center text-xs">
          Assinatura do Cliente
        </div>
        <div className="flex-1 border-t border-slate-900 pt-2 text-center text-xs">
          Assinatura do Técnico
        </div>
      </div>

      <div className="mt-12 text-center text-[10px] text-[var(--text-muted)] opacity-50">
        Este documento é um comprovante de entrada de serviço. Guarde-o para a retirada do aparelho.
      </div>
    </div>
  );
});
