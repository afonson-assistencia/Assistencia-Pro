import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useAuth } from '../contexts/AuthContext';
import { DeliveryLocation, DeliveryRun, Motoboy } from '../types';
import { Bike, Calendar, Plus, Clock, CheckCircle, XCircle, DollarSign, MapPin, LogOut, Loader2, Edit2, Trash2, MoreVertical, History } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';

export default function MotoboyDashboard() {
  const { user, profile, signOut } = useAuth();
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [unpaidRuns, setUnpaidRuns] = useState<DeliveryRun[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [editingRun, setEditingRun] = useState<DeliveryRun | null>(null);
  const [editForm, setEditForm] = useState({
    locationId: '',
    quantity: 1,
    value: 0
  });
  
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [runValue, setRunValue] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [tempRuns, setTempRuns] = useState<{locationId: string, locationName: string, value: number, quantity: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyRuns, setHistoryRuns] = useState<DeliveryRun[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  if (!user || profile?.role !== 'motoboy') {
    return <Navigate to="/motoboy-login" />;
  }

  // Effect for unpaid runs (Total a Receber) - Only depends on motoboyId
  useEffect(() => {
    if (!profile.motoboyId) return;

    const qUnpaid = query(
      collection(db, 'deliveryRuns'),
      where('motoboyId', '==', profile.motoboyId),
      where('status', 'in', ['pending', 'approved'])
    );

    const unsubscribeUnpaid = onSnapshot(qUnpaid, (snap) => {
      setUnpaidRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
      setLoadingStats(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'deliveryRuns/unpaid');
      setLoadingStats(false);
    });

    return () => unsubscribeUnpaid();
  }, [profile.motoboyId]);

  // Effect for locations and today's runs
  useEffect(() => {
    // Fetch locations
    const qLocations = query(collection(db, 'deliveryLocations'), orderBy('name', 'asc'));
    const unsubscribeLocations = onSnapshot(qLocations, (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryLocation)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'deliveryLocations'));

    // Fetch runs for this motoboy and selected date
    if (profile.motoboyId) {
      setLoadingRuns(true);
      const qRuns = query(
        collection(db, 'deliveryRuns'),
        where('motoboyId', '==', profile.motoboyId),
        where('date', '==', selectedDate),
        orderBy('createdAt', 'desc')
      );

      const unsubscribeRuns = onSnapshot(qRuns, (snap) => {
        setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
        setLoadingRuns(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'deliveryRuns');
        setLoadingRuns(false);
      });

      return () => {
        unsubscribeLocations();
        unsubscribeRuns();
      };
    }

    return () => unsubscribeLocations();
  }, [profile.motoboyId, selectedDate]);

  const totalPendingApproval = unpaidRuns
    .filter(r => r.status === 'pending')
    .reduce((acc, run) => acc + (run.totalValue || (run.value * run.quantity)), 0);

  const totalApprovedToReceive = unpaidRuns
    .filter(r => r.status === 'approved')
    .reduce((acc, run) => acc + (run.totalValue || (run.value * run.quantity)), 0);

  const totalToReceive = totalPendingApproval + totalApprovedToReceive;

  const totalRunsToday = runs.reduce((acc, r) => acc + (r.quantity || 1), 0);
  const totalRunsMonth = historyRuns.reduce((acc, r) => acc + (r.quantity || 1), 0);

  const handleAddRun = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalRuns = [...tempRuns];
    if (selectedLocationId) {
      const location = locations.find(l => l.id === selectedLocationId);
      if (location) {
        finalRuns.push({
          locationId: location.id,
          locationName: location.name,
          value: parseFloat(runValue),
          quantity: parseInt(quantity)
        });
      }
    }

    if (finalRuns.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const promises = finalRuns.map(run => 
        addDoc(collection(db, 'deliveryRuns'), {
          motoboyId: profile.motoboyId,
          motoboyName: profile.name,
          locationId: run.locationId,
          locationName: run.locationName,
          value: run.value,
          quantity: run.quantity,
          totalValue: run.value * run.quantity,
          status: 'pending',
          date: selectedDate,
          createdAt: serverTimestamp()
        })
      );

      await Promise.all(promises);
      
      setIsAddModalOpen(false);
      setSelectedLocationId('');
      setQuantity('1');
      setTempRuns([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deliveryRuns');
      alert('Erro ao salvar corridas. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToTempList = () => {
    if (!selectedLocationId) return;
    const location = locations.find(l => l.id === selectedLocationId);
    if (location) {
      setTempRuns([...tempRuns, {
        locationId: location.id,
        locationName: location.name,
        value: parseFloat(runValue),
        quantity: parseInt(quantity)
      }]);
      setSelectedLocationId('');
      setRunValue('0');
      setQuantity('1');
    }
  };

  const removeFromTempList = (index: number) => {
    setTempRuns(tempRuns.filter((_, i) => i !== index));
  };

  const handleEditRun = (run: DeliveryRun) => {
    setEditingRun(run);
    setEditForm({
      locationId: run.locationId,
      quantity: run.quantity || 1,
      value: run.value
    });
    setIsEditModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleUpdateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRun) return;

    try {
      const location = locations.find(l => l.id === editForm.locationId);
      if (!location) return;

      await updateDoc(doc(db, 'deliveryRuns', editingRun.id), {
        locationId: editForm.locationId,
        locationName: location.name,
        quantity: editForm.quantity,
        value: editForm.value,
        totalValue: editForm.value * editForm.quantity
      });

      setIsEditModalOpen(false);
      setEditingRun(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveryRuns');
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta corrida?')) return;
    try {
      await deleteDoc(doc(db, 'deliveryRuns', id));
      setOpenDropdownId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deliveryRuns');
    }
  };

  const totalEarned = runs
    .filter(r => r.status === 'approved' || r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const totalPaid = runs
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const pendingCount = runs.filter(r => r.status === 'pending').length;

  const fetchHistory = () => {
    if (!profile.motoboyId) return;
    setLoadingHistory(true);
    
    // Create date range for the selected month
    const monthDate = new Date(historyMonth + '-02'); // -02 to avoid timezone issues with -01
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    const qHistory = query(
      collection(db, 'deliveryRuns'),
      where('motoboyId', '==', profile.motoboyId),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(qHistory, (snap) => {
      setHistoryRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
      setLoadingHistory(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'deliveryRuns/history');
      setLoadingHistory(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    if (showHistory) {
      const unsub = fetchHistory();
      return () => unsub && unsub();
    }
  }, [showHistory, profile.motoboyId, historyMonth]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between bg-[var(--bg-card)] p-3 sm:p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
              <Bike className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">{profile.name}</h1>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Motoboy Tech</p>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
        
        <div className="px-1">
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Meu Dashboard</h2>
          <p className="text-sm text-[var(--text-muted)]">Acompanhe seus ganhos e corridas em tempo real.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4 bg-zinc-900 border-yellow-500 shadow-lg shadow-yellow-500/10">
          <div className="p-3 bg-yellow-500 text-black rounded-lg">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Total a Receber</p>
            {loadingStats ? (
              <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-yellow-500">R$ {totalToReceive.toFixed(2)}</p>
            )}
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4 bg-zinc-900 border-emerald-500 shadow-lg shadow-emerald-500/10">
          <div className="p-3 bg-emerald-500 text-white rounded-lg">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Aprovado p/ Pagar</p>
            {loadingStats ? (
              <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-emerald-500">R$ {totalApprovedToReceive.toFixed(2)}</p>
            )}
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4 bg-zinc-900 border-blue-500 shadow-lg shadow-blue-500/10">
          <div className="p-3 bg-blue-500 text-white rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Aguardando Aprovação</p>
            {loadingStats ? (
              <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-2xl font-black text-blue-500">R$ {totalPendingApproval.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 bg-[var(--bg-card)] border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Corridas Hoje</p>
          <p className="text-xl font-bold">{totalRunsToday}</p>
        </div>
        <div className="card p-3 bg-[var(--bg-card)] border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Ganhos Hoje</p>
          <p className="text-xl font-bold text-emerald-600">R$ {totalEarned.toFixed(2)}</p>
        </div>
        <div className="card p-3 bg-[var(--bg-card)] border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Corridas Mês</p>
          <p className="text-xl font-bold">{totalRunsMonth}</p>
        </div>
        <div className="card p-3 bg-[var(--bg-card)] border-[var(--border-color)]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Pagos Hoje</p>
          <p className="text-xl font-bold text-blue-600">R$ {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="card p-4 space-y-3">
        <label className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Selecionar Data
        </label>
        <input
          type="date"
          className="input w-full text-sm sm:text-base dark:text-white [color-scheme:dark]"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Runs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(false)}
              className={`text-lg font-bold flex items-center gap-2 pb-1 border-b-2 transition-colors ${!showHistory ? 'border-blue-500 text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)]'}`}
            >
              <Clock className="h-5 w-5" />
              Hoje
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`text-lg font-bold flex items-center gap-2 pb-1 border-b-2 transition-colors ${showHistory ? 'border-blue-500 text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)]'}`}
            >
              <History className="h-5 w-5" />
              Histórico
            </button>
          </div>
          {!showHistory && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary py-2 px-4 flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              Lançar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {showHistory ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <input
                    type="month"
                    className="input py-1 px-2 text-sm font-bold dark:text-white [color-scheme:dark]"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Total Mês</p>
                    <p className="font-bold text-lg">R$ {historyRuns.reduce((acc, r) => acc + (r.totalValue || (r.value * r.quantity)), 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center border-l border-[var(--border-color)] pl-4">
                    <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Pagos</p>
                    <p className="font-bold text-lg text-blue-600">R$ {historyRuns.filter(r => r.status === 'paid').reduce((acc, r) => acc + (r.totalValue || (r.value * r.quantity)), 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : historyRuns.length > 0 ? (
                historyRuns.map(run => (
                  <div key={run.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        run.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                        run.status === 'paid' ? 'bg-blue-100 text-blue-600' :
                        run.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {run.status === 'approved' ? <CheckCircle className="h-5 w-5" /> : 
                         run.status === 'paid' ? <DollarSign className="h-5 w-5" /> :
                         run.status === 'rejected' ? <XCircle className="h-5 w-5" /> :
                         <Clock className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-[var(--text-main)]">{run.locationName}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span>{run.date}</span>
                          <span>•</span>
                          <span>{run.quantity || 1}x R$ {run.value.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">R$ {(run.totalValue || run.value).toFixed(2)}</p>
                      <p className={`text-[10px] uppercase font-bold tracking-tighter ${
                        run.status === 'approved' ? 'text-emerald-600' : 
                        run.status === 'paid' ? 'text-blue-600' :
                        run.status === 'rejected' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {run.status === 'approved' ? 'Aprovado' : 
                         run.status === 'paid' ? 'Pago' :
                         run.status === 'rejected' ? 'Rejeitado' :
                         'Pendente'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card p-12 text-center">
                  <p className="text-[var(--text-muted)]">Nenhuma corrida no histórico para este mês.</p>
                </div>
              )}
            </>
          ) : (
            loadingRuns ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : runs.length > 0 ? (
              runs.map(run => (
              <div key={run.id} className="card p-4 flex items-center justify-between hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    run.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                    run.status === 'paid' ? 'bg-blue-100 text-blue-600' :
                    run.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {run.status === 'approved' ? <CheckCircle className="h-5 w-5" /> :
                     run.status === 'paid' ? <DollarSign className="h-5 w-5" /> :
                     run.status === 'rejected' ? <XCircle className="h-5 w-5" /> :
                     <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text-main)]">{run.locationName}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span>{run.quantity || 1}x R$ {run.value.toFixed(2)}</span>
                      <span>•</span>
                      <span>{run.createdAt?.toDate ? format(run.createdAt.toDate(), 'HH:mm') : 'Recent'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ {(run.totalValue || run.value).toFixed(2)}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-tighter ${
                      run.status === 'approved' ? 'text-emerald-600' :
                      run.status === 'paid' ? 'text-blue-600' :
                      run.status === 'rejected' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {run.status === 'approved' ? 'Aprovado' :
                       run.status === 'paid' ? 'Pago' :
                       run.status === 'rejected' ? 'Rejeitado' :
                       'Pendente'}
                    </p>
                  </div>
                  {run.status === 'pending' && (
                    <div className="relative">
                      <button 
                        onClick={() => setOpenDropdownId(openDropdownId === run.id ? null : run.id)}
                        className="p-1 hover:bg-[var(--bg-main)] rounded-full transition-colors"
                      >
                        <MoreVertical className="h-5 w-5 text-[var(--text-muted)]" />
                      </button>
                      
                      {openDropdownId === run.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setOpenDropdownId(null)}
                          />
                          <div className="absolute right-0 mt-2 w-36 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in duration-150">
                            <button
                              onClick={() => handleEditRun(run)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteRun(run.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card p-12 text-center">
              <div className="bg-slate-50 dark:bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <p className="text-[var(--text-muted)]">Nenhuma corrida lançada para este dia.</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Run Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border-t sm:border border-[var(--border-color)] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Lançar Nova Corrida</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[var(--text-muted)]">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddRun} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Local da Busca / Entrega
                </label>
                <select
                  className="input w-full text-base"
                  value={selectedLocationId}
                  onChange={(e) => {
                    const locId = e.target.value;
                    setSelectedLocationId(locId);
                    const location = locations.find(l => l.id === locId);
                    if (location) {
                      const fee = (location.motoboyFee !== undefined && location.motoboyFee !== null) 
                        ? location.motoboyFee 
                        : location.value;
                      setRunValue(fee.toString());
                    }
                  }}
                >
                  <option value="">Selecione o local...</option>
                  {locations.filter(l => (l.type || 'neighborhood') === 'service').map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} - R$ {((loc.motoboyFee !== undefined && loc.motoboyFee !== null) ? loc.motoboyFee : loc.value).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor da Busca / Corrida (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full text-lg font-bold"
                  value={runValue}
                  onChange={(e) => setRunValue(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Quantidade de Viagens
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, parseInt(q) - 1).toString())}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-[var(--border-color)] btn btn-primary text-xl font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="input flex-1 text-center text-xl font-bold py-3"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(q => (parseInt(q) + 1).toString())}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-[var(--border-color)] btn btn-primary text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={addToTempList}
                disabled={!selectedLocationId}
                className="btn btn-secondary w-full py-3 flex items-center justify-center gap-2 border-dashed border-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar à Lista
              </button>

              {tempRuns.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Itens na Lista:</p>
                  {tempRuns.map((run, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg text-sm border border-[var(--border-color)]">
                      <div className="flex-1">
                        <p className="font-bold">{run.locationName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{run.quantity}x R$ {run.value.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-blue-600">R$ {(run.value * run.quantity).toFixed(2)}</p>
                        <button 
                          type="button"
                          onClick={() => removeFromTempList(index)}
                          className="text-red-500 p-1"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(selectedLocationId || tempRuns.length > 0) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Valor Total:</span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      R$ {(
                        (tempRuns.reduce((acc, r) => acc + (r.value * r.quantity), 0)) +
                        ((() => {
                          const loc = locations.find(l => l.id === selectedLocationId);
                          if (!loc) return 0;
                          return (loc.motoboyFee !== undefined && loc.motoboyFee !== null) ? loc.motoboyFee : loc.value;
                        })() * parseInt(quantity || '0'))
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setTempRuns([]);
                  }}
                  className="btn btn-secondary flex-1 py-4"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || (tempRuns.length === 0 && !selectedLocationId)}
                  className="btn btn-primary flex-1 py-4 shadow-lg shadow-blue-500/30 gap-2"
                >
                  {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                  {isSubmitting ? 'Salvando...' : 'Confirmar Tudo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Run Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border-t sm:border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Editar Corrida</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-[var(--text-muted)]">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateRun} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Local da Busca / Entrega
                </label>
                <select
                  className="input w-full text-base"
                  value={editForm.locationId}
                  onChange={(e) => {
                    const locId = e.target.value;
                    const location = locations.find(l => l.id === locId);
                    setEditForm({
                      ...editForm,
                      locationId: locId,
                      value: location ? ((location.motoboyFee !== undefined && location.motoboyFee !== null) ? location.motoboyFee : location.value) : editForm.value
                    });
                  }}
                  required
                >
                  <option value="">Selecione o local...</option>
                  {locations.filter(l => (l.type || 'neighborhood') === 'service').map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} - R$ {((loc.motoboyFee !== undefined && loc.motoboyFee !== null) ? loc.motoboyFee : loc.value).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor da Busca / Corrida (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full text-lg font-bold"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Quantidade de Viagens
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-[var(--border-color)] btn btn-primary text-xl font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="input flex-1 text-center text-xl font-bold py-3"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, quantity: f.quantity + 1 }))}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-[var(--border-color)] btn btn-primary text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary flex-1 py-4"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1 py-4 shadow-lg shadow-blue-500/30">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
