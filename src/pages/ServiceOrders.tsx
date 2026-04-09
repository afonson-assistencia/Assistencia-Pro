import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ServiceOrder, Customer, OSStatus, STATUS_LABELS, STATUS_COLORS } from '../types';
import { Plus, Search, Filter, MessageSquare, ChevronRight, X, Check, Send, AlertCircle, Trash2, Eye, History, FileText, Edit2, ClipboardList, LayoutGrid, List, Loader2, MoreVertical, CheckCircle2, Clock, DollarSign, ShieldCheck, Package, TrendingUp, Smartphone, ArrowUpRight, BarChart3, PieChart, CalendarDays, ArrowDownRight } from 'lucide-react';
import { PHONE_MODELS, SERVICES } from '../constants';
import { format, addDays, startOfMonth, endOfMonth, isWithinInterval, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendToN8N } from '../services/n8nService';
import { maskPhone } from '../utils/masks';
import { getWhatsAppUrl } from '../utils/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import PixQRCodeModal from '../components/PixQRCodeModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function ServiceOrders() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [sendingN8N, setSendingN8N] = useState<string | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);
  const [pixDescription, setPixDescription] = useState('');

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
  const [productCost, setProductCost] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentMethod, setDownPaymentMethod] = useState<'pix' | 'cash' | 'card'>('pix');
  const [finalPayment, setFinalPayment] = useState(0);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<'pix' | 'cash' | 'card'>('pix');

  // View state
  const [viewingOrder, setViewingOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [actionMenuOrder, setActionMenuOrder] = useState<ServiceOrder | null>(null);

  const [showDashboard, setShowDashboard] = useState(true);

  const getCustomerInfo = (order: ServiceOrder) => {
    const customer = customers.find(c => c.id === order.customerId);
    return {
      name: customer?.name || order.customerName,
      phone: customer?.phone || order.customerPhone
    };
  };

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

  const validateOSForm = () => {
    if (!isAddingCustomer && !customerId) {
      setError('Selecione um cliente ou cadastre um novo.');
      return false;
    }
    if (isAddingCustomer) {
      if (newCustomerName.trim().length < 3) {
        setError('O nome do novo cliente deve ter pelo menos 3 caracteres.');
        return false;
      }
      const cleanPhone = newCustomerPhone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        setError('Telefone do novo cliente inválido.');
        return false;
      }
    }
    if (model.trim().length < 2) {
      setError('Informe o modelo do aparelho.');
      return false;
    }
    if (problem.trim().length < 3) {
      setError('Descreva o problema relatado.');
      return false;
    }
    if (totalValue < 0) {
      setError('O valor total não pode ser negativo.');
      return false;
    }
    return true;
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateOSForm()) return;
    
    setActionLoading(prev => ({ ...prev, submit: true }));
    
    let currentCustomerId = customerId;
    let currentCustomerName = '';
    let currentCustomerPhone = '';

    try {
      if (isAddingCustomer) {
        const customerRef = await addDoc(collection(db, 'customers'), {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          createdAt: serverTimestamp(),
        });
        currentCustomerId = customerRef.id;
        currentCustomerName = newCustomerName.trim();
        currentCustomerPhone = newCustomerPhone.trim();
      } else if (customerId === 'consumidor-final') {
        currentCustomerId = 'consumidor-final';
        currentCustomerName = 'Consumidor Final';
        currentCustomerPhone = '00000000000';
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
        model: model.trim(),
        services: selectedServices,
        problem: problem.trim(),
        deadline: Timestamp.fromDate(deadline),
        warrantyDays,
        notes: notes.trim(),
        totalValue,
        productCost,
        downPayment,
        downPaymentMethod,
        finalPayment,
        finalPaymentMethod,
      };

      if (editingOrder) {
        await updateDoc(doc(db, 'serviceOrders', editingOrder.id), {
          ...orderData,
          updatedAt: serverTimestamp(),
        });
        
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
      setError(`Erro ao ${editingOrder ? 'atualizar' : 'criar'} ordem de serviço. Verifique sua conexão.`);
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
    setProductCost(order.productCost || 0);
    setDownPayment(order.downPayment || 0);
    setDownPaymentMethod(order.downPaymentMethod || 'pix');
    setFinalPayment(order.finalPayment || 0);
    setFinalPaymentMethod(order.finalPaymentMethod || 'pix');
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
    setProductCost(0);
    setDownPayment(0);
    setDownPaymentMethod('pix');
    setFinalPayment(0);
    setFinalPaymentMethod('pix');
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

      const customerInfo = getCustomerInfo(order);
      try {
        await sendToN8N({
          event: 'os_status_updated',
          orderId: id,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
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
    const customerInfo = getCustomerInfo(order);
    try {
      await sendToN8N({
        event: 'os_manual_send',
        ...order,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
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
    const customerInfo = getCustomerInfo(order);
    const servicesList = order.services?.length > 0 ? `\n🛠️ *Serviços:* ${order.services.join(', ')}` : '';
    const assistanceName = settings.name || 'ASSISTÊNCIA';
    
    let statusEmoji = '⏳';
    let statusText = STATUS_LABELS[order.status].toUpperCase();
    
    if (order.status === 'ready') {
      statusEmoji = '✅';
      statusText = 'PRONTO PARA RETIRADA';
    } else if (order.status === 'delivered') {
      statusEmoji = '📦';
      statusText = 'ENTREGUE';
    } else if (order.status === 'in-progress') {
      statusEmoji = '🔧';
    }

    const downPaymentInfo = order.downPayment && order.downPayment > 0 ? `\n💰 *Entrada:* R$ ${order.downPayment.toFixed(2)} (${order.downPaymentMethod?.toUpperCase()})` : '';
    const finalPaymentInfo = order.finalPayment && order.finalPayment > 0 ? `\n💰 *Pago na Entrega:* R$ ${order.finalPayment.toFixed(2)} (${order.finalPaymentMethod?.toUpperCase()})` : '';
    const remainingBalance = (order.totalValue || 0) - (order.downPayment || 0) - (order.finalPayment || 0);
    const balanceInfo = remainingBalance > 0 ? `\n💳 *Saldo a Pagar:* R$ ${remainingBalance.toFixed(2)}` : '';

    const message = `📱 *${assistanceName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
📄 *ORDEM DE SERVIÇO #${order.id.slice(-6).toUpperCase()}*
📅 *Data:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}

👤 *CLIENTE:* ${customerInfo.name}
📱 *CONTATO:* ${customerInfo.phone}
📱 *APARELHO:* ${order.model}
${statusEmoji} *STATUS:* ${statusText}
${servicesList}

⚠️ *PROBLEMA:* ${order.problem}
💰 *VALOR TOTAL:* R$ ${order.totalValue?.toFixed(2)}${downPaymentInfo}${finalPaymentInfo}${balanceInfo}
📅 *PRAZO:* ${order.deadline?.toDate ? format(order.deadline.toDate(), 'dd/MM/yyyy') : '-'}
🛡️ *GARANTIA:* ${order.warrantyDays} dias
━━━━━━━━━━━━━━━━━━━━
${order.status === 'ready' 
  ? '✨ *Seu aparelho está pronto!* Pode vir retirá-lo quando desejar.' 
  : order.status === 'delivered'
    ? '✨ *Seu aparelho foi entregue!* Obrigado pela confiança.'
    : 'Este documento é o seu comprovante de entrada. Guarde-o para a retirada do aparelho.'}

🙏 *Obrigado pela preferência!*`;
    
    return getWhatsAppUrl(customerInfo.phone, message);
  };

  const filteredOrders = orders.filter(o => {
    const customerInfo = getCustomerInfo(o);
    const matchesSearch = customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         o.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalDeliveredValue = orders
    .filter(o => o.status === 'delivered')
    .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);

  const totalPendingValue = orders
    .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
    .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);

  // Dashboard Calculations
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const currentMonthOrders = orders.filter(o => {
    const date = o.deliveredAt?.toDate ? o.deliveredAt.toDate() : (o.createdAt?.toDate ? o.createdAt.toDate() : null);
    if (!date) return false;
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  });

  const currentMonthRevenue = currentMonthOrders
    .filter(o => o.status === 'delivered')
    .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);

  const currentMonthInvestment = currentMonthOrders
    .filter(o => o.status === 'delivered')
    .reduce((acc, curr) => acc + (curr.productCost || 0), 0);

  const currentMonthProfit = currentMonthRevenue - currentMonthInvestment;

  const currentMonthCount = currentMonthOrders.filter(o => o.status === 'delivered').length;
  const averageTicket = currentMonthCount > 0 ? currentMonthRevenue / currentMonthCount : 0;

  // Last 6 months data for chart
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const monthDate = subMonths(now, 5 - i);
    const monthName = format(monthDate, 'MMM', { locale: ptBR });
    const monthOrders = orders.filter(o => o.status === 'delivered' && o.deliveredAt?.toDate && isSameMonth(o.deliveredAt.toDate(), monthDate));
    
    const revenue = monthOrders.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    const cost = monthOrders.reduce((acc, curr) => acc + (curr.productCost || 0), 0);
    const profit = revenue - cost;
    
    return { 
      name: monthName.toUpperCase(), 
      valor: revenue,
      lucro: profit,
      investimento: cost
    };
  }).filter(d => d.valor > 0 || true);

  const isWarrantyExpired = (order: ServiceOrder) => {
    if (order.status !== 'delivered' || !order.deliveredAt || !order.warrantyDays) return false;
    const deliveredDate = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
    const expirationDate = addDays(deliveredDate, order.warrantyDays);
    return new Date() > expirationDate;
  };

  const getWarrantyCountdown = (order: ServiceOrder) => {
    if (order.status !== 'delivered' || !order.deliveredAt || !order.warrantyDays) return null;
    const deliveredDate = order.deliveredAt.toDate ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
    const expirationDate = addDays(deliveredDate, order.warrantyDays);
    const diffTime = expirationDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Ordens de Serviço</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie os consertos em andamento.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por cliente..."
              className="input pl-10 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowDashboard(!showDashboard)} 
              className={`btn h-10 gap-2 flex-1 sm:flex-none ${showDashboard ? 'btn-secondary' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{showDashboard ? 'Ocultar Dashboard' : 'Ver Dashboard'}</span>
              <span className="sm:hidden">Dash</span>
            </button>
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn btn-primary h-10 gap-2 flex-1 sm:flex-none">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova O.S.</span>
              <span className="sm:hidden">Nova</span>
            </button>
          </div>
        </div>
      </div>

      {showDashboard && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          {/* Stats Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="card p-5 border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Recebido (Mês)</span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[var(--text-main)]">R$ {currentMonthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                {format(now, 'MMMM', { locale: ptBR })}
              </p>
            </div>

            <div className="card p-5 border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Investido em Peças</span>
                <Package className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[var(--text-main)]">R$ {currentMonthInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Custo total de produtos</p>
            </div>

            <div className="card p-5 border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Lucro Real</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-600">R$ {currentMonthProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Faturamento - Investimento</p>
            </div>

            <div className="card p-5 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Ticket Médio</span>
                <Smartphone className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[var(--text-main)]">R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Média por O.S. concluída</p>
            </div>

            <div className="card p-5 border-l-4 border-l-purple-500 bg-purple-50/30 dark:bg-purple-900/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Valor em Aberto</span>
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[var(--text-main)]">R$ {totalPendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Total de O.S. ativas</p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-[var(--text-main)]">Desempenho Semestral</h3>
                  <p className="text-xs text-[var(--text-muted)]">Receita vs Lucro Real</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-[var(--text-muted)]">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[var(--text-muted)]">Lucro</span>
                  </div>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-muted)' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-muted)' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--text-main)'
                      }}
                      itemStyle={{ color: '#3b82f6' }}
                      formatter={(value: number, name: string) => [
                        `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
                        name === 'valor' ? 'Receita' : 'Lucro Real'
                      ]}
                    />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} name="Receita" />
                    <Bar dataKey="lucro" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} name="Lucro" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6 flex flex-col">
              <h3 className="font-bold text-[var(--text-main)] mb-1">Distribuição de Status</h3>
              <p className="text-xs text-[var(--text-muted)] mb-6">Visão geral das ordens ativas</p>
              
              <div className="space-y-4 flex-1">
                {Object.entries(STATUS_LABELS).map(([status, label]) => {
                  const count = orders.filter(o => o.status === status).length;
                  const percentage = orders.length > 0 ? (count / orders.length) * 100 : 0;
                  const colorClass = STATUS_COLORS[status as OSStatus].split(' ')[0]; // Get bg color
                  
                  return (
                    <div key={status} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-[var(--text-main)]">{label}</span>
                        <span className="text-[var(--text-muted)]">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)] font-medium">Total de Ordens</span>
                  <span className="font-black text-[var(--text-main)]">{orders.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row items-center">
        <div className={`w-full sm:w-64 input flex items-center gap-2 transition-all ${
          statusFilter !== 'all' 
            ? `${STATUS_COLORS[statusFilter as OSStatus]} ring-2 ring-opacity-20 ring-blue-500` 
            : ''
        }`}>
          <Filter className={`h-4 w-4 ${statusFilter !== 'all' ? 'text-inherit' : 'text-[var(--text-muted)]'}`} />
          <select
            className="bg-transparent border-none p-0 focus:ring-0 text-inherit w-full text-sm font-medium cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all" className="bg-[var(--bg-card)] text-[var(--text-main)]">Todos os Status</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val} className="bg-[var(--bg-card)] text-[var(--text-main)]">{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <div key={order.id} className={`card p-6 transition-all hover:shadow-md border ${
              isWarrantyExpired(order) 
                ? 'bg-red-50 dark:bg-red-900/10 border-red-500 ring-1 ring-red-500' 
                : 'border-[var(--border-color)]'
            }`}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-[var(--text-main)]">{order.model}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{getCustomerInfo(order).name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--text-main)]">R$ {order.totalValue?.toFixed(2)}</p>
                  {order.downPayment && order.downPayment > 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium">Entrada: R$ {order.downPayment.toFixed(2)}</p>
                  )}
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
                {order.status === 'delivered' && (
                  <div className="flex justify-between border-t border-[var(--border-color)] pt-2 mt-2">
                    <span className="text-[var(--text-muted)]">Garantia:</span>
                    <span className={`font-bold ${isWarrantyExpired(order) ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isWarrantyExpired(order) ? 'EXPIRADA' : `${getWarrantyCountdown(order)} dias restantes`}
                    </span>
                  </div>
                )}
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
                    <option value="consumidor-final" className="font-bold text-blue-600">Consumidor Final (Não cadastrado)</option>
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
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Custo da Peça/Produto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input mt-1 border-red-200 dark:border-red-900/30 focus:border-red-500"
                  placeholder="Apenas para controle interno"
                  value={productCost}
                  onChange={(e) => setProductCost(parseFloat(e.target.value) || 0)}
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
                <label className="text-sm font-medium text-[var(--text-muted)]">Problema Relatado / Defeito (Opcional)</label>
                <textarea
                  rows={2}
                  className="input mt-1 h-auto py-2"
                  placeholder="Descreva o problema detalhadamente..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4 mt-2">
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)]">Valor de Entrada (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input mt-1"
                    placeholder="0.00"
                    value={downPayment}
                    onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)]">Forma de Pagamento (Entrada)</label>
                  <select
                    className="input mt-1"
                    value={downPaymentMethod}
                    onChange={(e) => setDownPaymentMethod(e.target.value as any)}
                  >
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="card">Cartão</option>
                  </select>
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4 mt-2">
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)]">Valor Pago na Entrega (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input mt-1"
                    placeholder="0.00"
                    value={finalPayment}
                    onChange={(e) => setFinalPayment(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)]">Forma de Pagamento (Entrega)</label>
                  <select
                    className="input mt-1"
                    value={finalPaymentMethod}
                    onChange={(e) => setFinalPaymentMethod(e.target.value as any)}
                  >
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="card">Cartão</option>
                  </select>
                </div>
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
                  onClick={() => {
                    if (downPayment > 0) {
                      setPixAmount(downPayment);
                      setPixDescription(`Entrada O.S. ${model}`);
                    } else {
                      setPixAmount(totalValue);
                      setPixDescription(`Pagamento O.S. ${model}`);
                    }
                    setIsPixModalOpen(true);
                  }}
                  disabled={totalValue <= 0}
                  className="btn bg-emerald-600 text-white hover:bg-emerald-700 flex-1 gap-2"
                >
                  <Smartphone className="h-4 w-4" />
                  Gerar PIX
                </button>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cliente</p>
                  <p className="mt-1 font-medium text-[var(--text-main)]">{getCustomerInfo(viewingOrder).name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{getCustomerInfo(viewingOrder).phone}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aparelho</p>
                  <p className="mt-1 font-medium text-[var(--text-main)]">{viewingOrder.model}</p>
                  <p className="text-sm text-[var(--text-muted)]">Entrada: {viewingOrder.entryDate?.toDate ? format(viewingOrder.entryDate.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Financeiro</p>
                  <p className="mt-1 font-medium text-[var(--text-main)]">Total: R$ {viewingOrder.totalValue?.toFixed(2)}</p>
                  <div className="mt-1 space-y-1">
                    {viewingOrder.downPayment && viewingOrder.downPayment > 0 && (
                      <p className="text-xs text-emerald-600">Entrada: R$ {viewingOrder.downPayment.toFixed(2)} ({viewingOrder.downPaymentMethod?.toUpperCase()})</p>
                    )}
                    {viewingOrder.finalPayment && viewingOrder.finalPayment > 0 && (
                      <p className="text-xs text-blue-600">Final: R$ {viewingOrder.finalPayment.toFixed(2)} ({viewingOrder.finalPaymentMethod?.toUpperCase()})</p>
                    )}
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-800">
                      Saldo Restante: R$ {((viewingOrder.totalValue || 0) - (viewingOrder.downPayment || 0) - (viewingOrder.finalPayment || 0)).toFixed(2)}
                    </p>
                  </div>
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

              {viewingOrder.status === 'delivered' && viewingOrder.deliveredAt && (
                <div className="rounded-lg border border-[var(--border-color)] p-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Garantia do Serviço
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isWarrantyExpired(viewingOrder) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isWarrantyExpired(viewingOrder) ? 'EXPIRADA' : 'ATIVA'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">Prazo Total</p>
                      <p className="font-medium text-[var(--text-main)]">{viewingOrder.warrantyDays} dias</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">Status</p>
                      <p className={`font-bold ${isWarrantyExpired(viewingOrder) ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isWarrantyExpired(viewingOrder) ? 'Expirada' : `${getWarrantyCountdown(viewingOrder)} dias restantes`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">Data de Entrega</p>
                      <p className="font-medium text-[var(--text-main)]">
                        {viewingOrder.deliveredAt.toDate ? format(viewingOrder.deliveredAt.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const balance = (viewingOrder.totalValue || 0) - (viewingOrder.downPayment || 0) - (viewingOrder.finalPayment || 0);
                  setPixAmount(balance > 0 ? balance : viewingOrder.totalValue || 0);
                  setPixDescription(`Pagamento O.S. ${viewingOrder.model}`);
                  setIsPixModalOpen(true);
                }}
                className="btn bg-emerald-600 text-white hover:bg-emerald-700 flex-1 gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Cobrar PIX
              </button>
              <button
                onClick={() => setViewingOrder(null)}
                className="btn btn-secondary flex-1"
              >
                Fechar
              </button>
              <a
                href={generateWhatsAppLink(viewingOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      <PixQRCodeModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        amount={pixAmount}
        description={pixDescription}
        transactionId={viewingOrder?.id.slice(-6).toUpperCase() || 'OS'}
      />
    </div>
  );
}
