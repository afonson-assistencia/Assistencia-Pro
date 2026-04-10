import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { DeliveryLocation, DeliveryRun, DeliveryStatus, Motoboy } from '../types';
import { Plus, Trash2, CheckCircle, XCircle, Clock, MapPin, DollarSign, Calendar, Filter, UserPlus, Users, Bike, Loader2, Search, MoreVertical, Eye, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function DeliveryManagement() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [activeTab, setActiveTab] = useState<'runs' | 'locations' | 'motoboys'>('runs');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<DeliveryRun | null>(null);
  const [editForm, setEditForm] = useState({
    motoboyId: '',
    locationId: '',
    quantity: 1,
    value: 0,
    date: '',
    status: 'pending' as DeliveryRun['status']
  });
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationMotoboyFee, setNewLocationMotoboyFee] = useState('');
  const [newLocationType] = useState<'neighborhood' | 'service'>('service');
  
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [actionMenuRun, setActionMenuRun] = useState<DeliveryRun | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMotoboy, setSelectedMotoboy] = useState('all');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  const baseFilteredRuns = runs.filter(run => {
    const matchesDate = filterDate === '' || run.date === filterDate;
    const matchesMotoboy = selectedMotoboy === 'all' || run.motoboyName === selectedMotoboy;
    const matchesSearch = run.motoboyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         run.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesMotoboy && matchesSearch;
  });

  const filteredRuns = baseFilteredRuns.filter(run => {
    // Se o filtro de status for 'all' e estivermos vendo 'todas as datas', mostra apenas 'pendente'
    // para não poluir a lista com corridas já pagas do passado.
    if (statusFilter === 'all' && filterDate === '') {
      return run.status === 'pending';
    }
    return statusFilter === 'all' || run.status === statusFilter;
  });

  const globalFilteredRuns = runs.filter(run => {
    return selectedMotoboy === 'all' || run.motoboyName === selectedMotoboy;
  });

  const globalTotalPending = globalFilteredRuns
    .filter(r => r.status === 'pending')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const globalTotalApproved = globalFilteredRuns
    .filter(r => r.status === 'approved')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const globalTotalPaid = globalFilteredRuns
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payingMotoboyId, setPayingMotoboyId] = useState('');
  const [selectedRunsToPay, setSelectedRunsToPay] = useState<string[]>([]);

  const handleToggleRunSelection = (runId: string) => {
    setSelectedRunsToPay(prev => 
      prev.includes(runId) ? prev.filter(id => id !== runId) : [...prev, runId]
    );
  };

  const handleSelectAllUnpaid = () => {
    const unpaidIds = runs
      .filter(r => r.motoboyId === payingMotoboyId && (r.status === 'approved' || r.status === 'pending'))
      .map(r => r.id);
    setSelectedRunsToPay(unpaidIds);
  };

  const handleAutoSelectByValue = (value: string) => {
    setPayAmount(value);
    const amount = parseFloat(value);
    if (isNaN(amount) || !payingMotoboyId || amount <= 0) {
      setSelectedRunsToPay([]);
      return;
    }

    const unpaidRuns = runs
      .filter(r => r.motoboyId === payingMotoboyId && (r.status === 'approved' || r.status === 'pending'))
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

    let currentSum = 0;
    const selectedIds: string[] = [];
    for (const run of unpaidRuns) {
      const runVal = run.totalValue || (run.value * (run.quantity || 1));
      // Use a small epsilon for float comparison
      if (currentSum + runVal <= amount + 0.01) {
        currentSum += runVal;
        selectedIds.push(run.id);
      }
    }
    setSelectedRunsToPay(selectedIds);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRunsToPay.length === 0) return;

    setLoading(prev => ({ ...prev, paying: true }));
    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      
      selectedRunsToPay.forEach(runId => {
        batch.update(doc(db, 'deliveryRuns', runId), {
          status: 'paid',
          paidAt: timestamp
        });
      });

      await batch.commit();
      alert(`${selectedRunsToPay.length} corridas marcadas como pagas com sucesso!`);
      setIsPayModalOpen(false);
      setSelectedRunsToPay([]);
      setPayAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveryRuns/pay');
    } finally {
      setLoading(prev => ({ ...prev, paying: false }));
    }
  };

  if (profile?.role === 'motoboy') {
    return <Navigate to="/motoboy-dashboard" />;
  }

  useEffect(() => {
    const qLocations = query(collection(db, 'deliveryLocations'), orderBy('name', 'asc'));
    const unsubscribeLocations = onSnapshot(qLocations, (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryLocation)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'deliveryLocations'));

    const qRuns = query(collection(db, 'deliveryRuns'), orderBy('createdAt', 'desc'));
    const unsubscribeRuns = onSnapshot(qRuns, (snap) => {
      setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'deliveryRuns'));

    const qMotoboys = query(collection(db, 'motoboys'), orderBy('name', 'asc'));
    const unsubscribeMotoboys = onSnapshot(qMotoboys, (snap) => {
      setMotoboys(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motoboy)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'motoboys'));

    return () => {
      unsubscribeLocations();
      unsubscribeRuns();
      unsubscribeMotoboys();
    };
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName || !newLocationMotoboyFee) return;

    setLoading(prev => ({ ...prev, addLocation: true }));
    try {
      if (editingLocation) {
        await updateDoc(doc(db, 'deliveryLocations', editingLocation.id), {
          name: newLocationName,
          value: 0,
          motoboyFee: parseFloat(newLocationMotoboyFee) || 0,
          type: 'service'
        });
      } else {
        await addDoc(collection(db, 'deliveryLocations'), {
          name: newLocationName,
          value: 0,
          motoboyFee: parseFloat(newLocationMotoboyFee) || 0,
          type: 'service',
          createdAt: serverTimestamp()
        });
      }
      setNewLocationName('');
      setNewLocationMotoboyFee('');
      setEditingLocation(null);
      setIsLocationModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deliveryLocations');
    } finally {
      setLoading(prev => ({ ...prev, addLocation: false }));
    }
  };

  const handleEditLocation = (location: DeliveryLocation) => {
    setEditingLocation(location);
    setNewLocationName(location.name);
    setNewLocationMotoboyFee((location.motoboyFee || 0).toString());
    setIsLocationModalOpen(true);
  };

  const handleAddMotoboy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotoboyName) return;

    setLoading(prev => ({ ...prev, addMotoboy: true }));
    try {
      await addDoc(collection(db, 'motoboys'), {
        name: newMotoboyName.trim(),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewMotoboyName('');
      setIsMotoboyModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'motoboys');
    } finally {
      setLoading(prev => ({ ...prev, addMotoboy: false }));
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este local?')) return;
    setLoading(prev => ({ ...prev, [`deleteLocation_${id}`]: true }));
    try {
      await deleteDoc(doc(db, 'deliveryLocations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `deliveryLocations/${id}`);
    } finally {
      setLoading(prev => ({ ...prev, [`deleteLocation_${id}`]: false }));
    }
  };

  const handleToggleMotoboy = async (id: string, currentStatus: boolean) => {
    setLoading(prev => ({ ...prev, [`toggleMotoboy_${id}`]: true }));
    try {
      await updateDoc(doc(db, 'motoboys', id), { active: !currentStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `motoboys/${id}`);
    } finally {
      setLoading(prev => ({ ...prev, [`toggleMotoboy_${id}`]: false }));
    }
  };

  const handleUpdateRunStatus = async (id: string, status: DeliveryStatus) => {
    setLoading(prev => ({ ...prev, [`updateRun_${id}_${status}`]: true }));
    try {
      const updateData: any = { status };
      if (status === 'paid') {
        updateData.paidAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'deliveryRuns', id), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deliveryRuns/${id}`);
    } finally {
      setLoading(prev => ({ ...prev, [`updateRun_${id}_${status}`]: false }));
    }
  };

  const handleBulkUpdateStatus = async (status: DeliveryStatus) => {
    if (selectedRunIds.length === 0) return;
    
    setLoading(prev => ({ ...prev, bulkUpdate: true }));
    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      
      selectedRunIds.forEach(id => {
        const runRef = doc(db, 'deliveryRuns', id);
        const updateData: any = { status };
        if (status === 'paid') {
          updateData.paidAt = timestamp;
        }
        batch.update(runRef, updateData);
      });
      
      await batch.commit();
      setSelectedRunIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveryRuns/bulk');
    } finally {
      setLoading(prev => ({ ...prev, bulkUpdate: false }));
    }
  };

  const toggleSelectRun = (id: string) => {
    setSelectedRunIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRunIds.length === filteredRuns.length) {
      setSelectedRunIds([]);
    } else {
      setSelectedRunIds(filteredRuns.map(r => r.id));
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta corrida?')) return;
    try {
      await deleteDoc(doc(db, 'deliveryRuns', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deliveryRuns');
    }
  };

  const handleEditRun = (run: DeliveryRun) => {
    setEditingRun(run);
    setEditForm({
      motoboyId: run.motoboyId,
      locationId: run.locationId,
      quantity: run.quantity || 1,
      value: run.value,
      date: run.date,
      status: run.status
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRun) return;

    try {
      const motoboy = motoboys.find(m => m.id === editForm.motoboyId);
      const location = locations.find(l => l.id === editForm.locationId);

      if (!motoboy || !location) {
        alert('Motoboy ou Local inválido');
        return;
      }

      await updateDoc(doc(db, 'deliveryRuns', editingRun.id), {
        motoboyId: editForm.motoboyId,
        motoboyName: motoboy.name,
        locationId: editForm.locationId,
        locationName: location.name,
        quantity: editForm.quantity,
        value: editForm.value,
        totalValue: editForm.value * editForm.quantity,
        date: editForm.date,
        status: editForm.status
      });

      setIsEditModalOpen(false);
      setEditingRun(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'deliveryRuns');
    }
  };

  const openNewLocationModal = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setNewLocationMotoboyFee('');
    setIsLocationModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Gestão de Logística</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Gerencie motoboys, locais e aprove corridas.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab === 'locations' && (
            <button
              onClick={openNewLocationModal}
              className="btn btn-primary flex items-center justify-center gap-2 flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              Novo Local
            </button>
          )}
          {activeTab === 'motoboys' && (
            <button
              onClick={() => setIsMotoboyModalOpen(true)}
              className="btn btn-primary flex items-center justify-center gap-2 flex-1 sm:flex-none"
            >
              <UserPlus className="h-4 w-4" />
              Novo Motoboy
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 sm:gap-4 border-b border-[var(--border-color)] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('runs')}
          className={`pb-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'runs' ? 'text-blue-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Corridas
          {activeTab === 'runs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`pb-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'locations' ? 'text-blue-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Locais
          {activeTab === 'locations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab('motoboys')}
          className={`pb-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
            activeTab === 'motoboys' ? 'text-blue-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Motoboys
          {activeTab === 'motoboys' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
      </div>

      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Controle de Corridas
            </h2>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Buscar motoboy ou local..."
                    className="input pl-10 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    className="input text-sm dark:text-white [color-scheme:dark] flex-1 sm:w-40"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                  <button 
                    onClick={() => setFilterDate('')}
                    className={`btn btn-secondary text-xs px-2 h-10 ${filterDate === '' ? 'bg-blue-100 text-blue-600' : ''}`}
                    title="Ver todas as datas"
                  >
                    Todas
                  </button>
                </div>
                <select
                  className="input text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos Status</option>
                  <option value="pending">Pendentes</option>
                  <option value="approved">Aprovadas</option>
                  <option value="paid">Pagas</option>
                  <option value="rejected">Rejeitadas</option>
                </select>
                <select
                  className="input text-sm"
                  value={selectedMotoboy}
                  onChange={(e) => setSelectedMotoboy(e.target.value)}
                >
                  <option value="all">Todos Motoboys</option>
                  {motoboys.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedRunIds.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-y border-blue-100 dark:border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">
                    {selectedRunIds.length} selecionadas
                  </span>
                  <button 
                    onClick={() => setSelectedRunIds([])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Limpar seleção
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleBulkUpdateStatus('approved')}
                    disabled={loading.bulkUpdate}
                    className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-xs py-2 flex-1 sm:flex-none gap-2"
                  >
                    {loading.bulkUpdate ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    Aprovar Selecionadas
                  </button>
                  <button
                    onClick={() => handleBulkUpdateStatus('paid')}
                    disabled={loading.bulkUpdate}
                    className="btn bg-blue-600 text-white hover:bg-blue-700 text-xs py-2 flex-1 sm:flex-none gap-2"
                  >
                    {loading.bulkUpdate ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                    Pagar Selecionadas
                  </button>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Total Corridas</p>
                <p className="text-xl font-bold">{globalFilteredRuns.reduce((acc, r) => acc + (r.quantity || 1), 0)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4 border-yellow-200">
              <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Pendente Aprovação</p>
                <p className="text-xl font-bold text-yellow-600">R$ {globalTotalPending.toFixed(2)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4 border-emerald-200">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Total a Pagar</p>
                <p className="text-xl font-bold text-emerald-600">R$ {globalTotalApproved.toFixed(2)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4 border-blue-200">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Total Pago</p>
                <p className="text-xl font-bold text-blue-600">R$ {globalTotalPaid.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Pagar Motoboy (Baixa por Valor)
            </button>
          </div>

          <div className="card overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={filteredRuns.length > 0 && selectedRunIds.length === filteredRuns.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Motoboy</th>
                    <th className="px-4 py-3 font-semibold">Local</th>
                    <th className="px-4 py-3 font-semibold">Qtd</th>
                    <th className="px-4 py-3 font-semibold">Valor Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredRuns.length > 0 ? (
                    filteredRuns.map(run => (
                      <tr key={run.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedRunIds.includes(run.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedRunIds.includes(run.id)}
                            onChange={() => toggleSelectRun(run.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">
                          {run.date ? format(new Date(run.date + 'T12:00:00'), 'dd/MM/yy') : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium">{run.motoboyName}</td>
                        <td className="px-4 py-3">{run.locationName}</td>
                        <td className="px-4 py-3">{run.quantity || 1}</td>
                        <td className="px-4 py-3">R$ {(run.totalValue || run.value).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            run.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            run.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                            run.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {run.status === 'approved' ? 'Aprovado' :
                             run.status === 'paid' ? 'Pago' :
                             run.status === 'rejected' ? 'Rejeitado' :
                             'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end relative">
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === run.id ? null : run.id)}
                              className="p-1.5 text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>

                            {openDropdownId === run.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setOpenDropdownId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl z-20 py-1 animate-in fade-in zoom-in duration-150">
                                  <button
                                    onClick={() => {
                                      handleEditRun(run);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                    Editar Corrida
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteRun(run.id);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir Corrida
                                  </button>
                                  <div className="h-px bg-[var(--border-color)] my-1" />
                                  
                                  {run.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          handleUpdateRunStatus(run.id, 'approved');
                                          setOpenDropdownId(null);
                                        }}
                                        disabled={loading[`updateRun_${run.id}_approved`]}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                        Aprovar Corrida
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleUpdateRunStatus(run.id, 'rejected');
                                          setOpenDropdownId(null);
                                        }}
                                        disabled={loading[`updateRun_${run.id}_rejected`]}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        Rejeitar Corrida
                                      </button>
                                    </>
                                  )}
                                  {run.status === 'approved' && (
                                    <button
                                      onClick={() => {
                                        handleUpdateRunStatus(run.id, 'paid');
                                        setOpenDropdownId(null);
                                      }}
                                      disabled={loading[`updateRun_${run.id}_paid`]}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                      Marcar como Pago
                                    </button>
                                  )}
                                  {run.status !== 'pending' && (
                                    <button
                                      onClick={() => {
                                        handleUpdateRunStatus(run.id, 'pending');
                                        setOpenDropdownId(null);
                                      }}
                                      disabled={loading[`updateRun_${run.id}_pending`]}
                                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                    >
                                      <Clock className="h-4 w-4" />
                                      Reverter Status
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        Nenhuma corrida encontrada para este dia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-[var(--border-color)]">
              {filteredRuns.length > 0 ? (
                filteredRuns.map(run => (
                  <div key={run.id} className={`p-4 space-y-3 transition-colors ${selectedRunIds.includes(run.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <input 
                          type="checkbox" 
                          className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedRunIds.includes(run.id)}
                          onChange={() => toggleSelectRun(run.id)}
                        />
                        <div>
                          <p className="font-bold text-[var(--text-main)]">{run.motoboyName}</p>
                          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {run.date ? format(new Date(run.date + 'T12:00:00'), 'dd/MM/yy') : '-'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {run.locationName}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        run.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        run.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                        run.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {run.status === 'approved' ? 'Aprovado' :
                         run.status === 'paid' ? 'Pago' :
                         run.status === 'rejected' ? 'Rejeitado' :
                         'Pendente'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm">
                        <span className="text-[var(--text-muted)]">Qtd: </span>
                        <span className="font-medium">{run.quantity || 1}</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--text-main)]">
                        R$ {(run.totalValue || run.value).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setActionMenuRun(run)}
                        className="btn btn-secondary flex-1 h-9 text-xs gap-2"
                      >
                        <MoreVertical className="h-4 w-4" />
                        Ações
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  Nenhuma corrida encontrada para este dia.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Locais de Busca (Motoboy)
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {locations.filter(l => (l.type || 'neighborhood') === 'service').map(loc => (
              <div key={loc.id} className="card p-5 flex flex-col justify-between group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditLocation(loc)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(loc.id)}
                    disabled={loading[`deleteLocation_${loc.id}`]}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    {loading[`deleteLocation_${loc.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="font-bold text-xl text-[var(--text-main)] mb-1">{loc.name}</h3>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-lg">
                    <Bike className="h-4 w-4" />
                    <span>{((loc.motoboyFee !== undefined && loc.motoboyFee !== null) ? loc.motoboyFee : loc.value).toFixed(2)}</span>
                    <span className="text-[10px] font-normal text-[var(--text-muted)] ml-1 uppercase">Taxa de Busca (Motoboy)</span>
                  </div>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
            </div>
          ))}
          {locations.filter(l => (l.type || 'neighborhood') === 'service').length === 0 && (
            <div className="col-span-full py-12 text-center card">
              <MapPin className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
              <p className="text-[var(--text-muted)]">Nenhum local de busca cadastrado.</p>
            </div>
          )}
        </div>
      </div>
    )}

      {activeTab === 'motoboys' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {motoboys.map(m => (
            <div key={m.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${m.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{m.name}</p>
                  <p className={`text-xs ${m.active ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggleMotoboy(m.id, m.active)}
                disabled={loading[`toggleMotoboy_${m.id}`]}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors flex items-center gap-1 disabled:opacity-50 ${
                  m.active 
                    ? 'border-red-200 text-red-600 hover:bg-red-50' 
                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {loading[`toggleMotoboy_${m.id}`] && <Loader2 className="h-3 w-3 animate-spin" />}
                {m.active ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          ))}
          {motoboys.length === 0 && (
            <div className="col-span-full py-12 text-center card">
              <Users className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
              <p className="text-[var(--text-muted)]">Nenhum motoboy cadastrado.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Ações Mobile Corridas */}
      {actionMenuRun && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-[var(--text-main)]">Ações: Corrida #{actionMenuRun.id.slice(-4).toUpperCase()}</h3>
              <button onClick={() => setActionMenuRun(null)} className="text-[var(--text-muted)]">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  handleEditRun(actionMenuRun);
                  setActionMenuRun(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-blue-600 dark:text-blue-400 h-auto"
              >
                <Edit2 className="h-6 w-6" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => {
                  handleDeleteRun(actionMenuRun.id);
                  setActionMenuRun(null);
                }}
                className="btn btn-secondary flex-col gap-2 py-4 text-red-600 dark:text-red-400 h-auto"
              >
                <Trash2 className="h-6 w-6" />
                <span>Excluir</span>
              </button>

              {actionMenuRun.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleUpdateRunStatus(actionMenuRun.id, 'approved');
                      setActionMenuRun(null);
                    }}
                    className="btn btn-secondary flex-col gap-2 py-4 text-emerald-600 dark:text-emerald-400 h-auto"
                  >
                    <CheckCircle className="h-6 w-6" />
                    <span>Aprovar</span>
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateRunStatus(actionMenuRun.id, 'rejected');
                      setActionMenuRun(null);
                    }}
                    className="btn btn-secondary flex-col gap-2 py-4 text-red-600 dark:text-red-400 h-auto"
                  >
                    <XCircle className="h-6 w-6" />
                    <span>Rejeitar</span>
                  </button>
                </>
              )}
              {actionMenuRun.status === 'approved' && (
                <button
                  onClick={() => {
                    handleUpdateRunStatus(actionMenuRun.id, 'paid');
                    setActionMenuRun(null);
                  }}
                  className="btn btn-secondary flex-col gap-2 py-4 text-blue-600 dark:text-blue-400 h-auto col-span-2"
                >
                  <DollarSign className="h-6 w-6" />
                  <span>Marcar como Pago</span>
                </button>
              )}
              {actionMenuRun.status !== 'pending' && (
                <button
                  onClick={() => {
                    handleUpdateRunStatus(actionMenuRun.id, 'pending');
                    setActionMenuRun(null);
                  }}
                  className="btn btn-secondary flex-col gap-2 py-4 text-[var(--text-muted)] h-auto col-span-2"
                >
                  <Clock className="h-6 w-6" />
                  <span>Reverter para Pendente</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Run Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl p-6 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Editar Corrida</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-[var(--text-muted)]">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateRun} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Motoboy</label>
                <select
                  className="input w-full"
                  value={editForm.motoboyId}
                  onChange={(e) => setEditForm({ ...editForm, motoboyId: e.target.value })}
                  required
                >
                  {motoboys.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Local</label>
                <select
                  className="input w-full"
                  value={editForm.locationId}
                  onChange={(e) => {
                    const loc = locations.find(l => l.id === e.target.value);
                    setEditForm({ 
                      ...editForm, 
                      locationId: e.target.value,
                      value: loc ? ((loc.motoboyFee !== undefined && loc.motoboyFee !== null) ? loc.motoboyFee : loc.value) : editForm.value
                    });
                  }}
                  required
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} (R$ {((l.motoboyFee !== undefined && l.motoboyFee !== null) ? l.motoboyFee : l.value).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    className="input w-full"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Valor Unitário</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Data</label>
                <input
                  type="date"
                  className="input w-full dark:text-white [color-scheme:dark]"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Status</label>
                <select
                  className="input w-full"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as DeliveryRun['status'] })}
                  required
                >
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="paid">Pago</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] p-8 shadow-2xl border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <MapPin className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold">{editingLocation ? 'Editar Local' : 'Novo Local de Entrega'}</h2>
            </div>
            
            <form onSubmit={handleAddLocation} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Nome do Local / Assistência</label>
                <input
                  type="text"
                  required
                  className="input py-3"
                  placeholder="Ex: Assistência X, Loja Y, etc."
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Taxa de Busca (R$)</label>
                <div className="relative">
                  <Bike className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input py-3 pl-12"
                    placeholder="0.00"
                    value={newLocationMotoboyFee}
                    onChange={(e) => setNewLocationMotoboyFee(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocationModalOpen(false);
                    setEditingLocation(null);
                    setNewLocationName('');
                    setNewLocationMotoboyFee('');
                  }}
                  className="btn btn-secondary flex-1 py-3"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={loading.addLocation} className="btn btn-primary flex-1 py-3 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  {loading.addLocation ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    editingLocation ? 'Salvar Alterações' : 'Cadastrar Local'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Motoboy Modal */}
      {isMotoboyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)]">
            <h2 className="text-xl font-bold mb-4">Cadastrar Motoboy</h2>
            <form onSubmit={handleAddMotoboy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="Ex: João da Silva"
                  value={newMotoboyName}
                  onChange={(e) => setNewMotoboyName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMotoboyModalOpen(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={loading.addMotoboy} className="btn btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                  {loading.addMotoboy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    'Cadastrar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Pagar Motoboy */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[var(--bg-card)] rounded-2xl p-6 shadow-2xl border border-[var(--border-color)] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Dar Baixa em Pagamentos</h2>
                <p className="text-xs text-[var(--text-muted)]">Selecione as corridas ou informe um valor para auto-seleção.</p>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-[var(--text-muted)]">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--text-muted)] block mb-1">Motoboy</label>
                  <select
                    className="input w-full"
                    value={payingMotoboyId}
                    onChange={(e) => {
                      setPayingMotoboyId(e.target.value);
                      setSelectedRunsToPay([]);
                      setPayAmount('');
                    }}
                    required
                  >
                    <option value="">Selecione o motoboy...</option>
                    {motoboys.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--text-muted)] block mb-1">Auto-selecionar por Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    placeholder="Ex: 50.00"
                    value={payAmount}
                    onChange={(e) => handleAutoSelectByValue(e.target.value)}
                  />
                </div>
              </div>

              {payingMotoboyId && (
                <>
                  <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Total Selecionado</p>
                      <p className="text-xl font-black text-emerald-600">
                        R$ {runs
                          .filter(r => selectedRunsToPay.includes(r.id))
                          .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Corridas</p>
                      <p className="text-xl font-black">{selectedRunsToPay.length}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleSelectAllUnpaid}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Selecionar Tudo
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {runs
                      .filter(r => r.motoboyId === payingMotoboyId && (r.status === 'approved' || r.status === 'pending'))
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
                      .map(run => (
                        <div 
                          key={run.id}
                          onClick={() => handleToggleRunSelection(run.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                            selectedRunsToPay.includes(run.id)
                              ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20'
                              : 'bg-[var(--bg-main)] border-[var(--border-color)] hover:border-zinc-400'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                            selectedRunsToPay.includes(run.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300'
                          }`}>
                            {selectedRunsToPay.includes(run.id) && <CheckCircle className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{run.locationName}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  run.status === 'approved' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' 
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                }`}>
                                  {run.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                </span>
                              </div>
                              <span className="font-black text-emerald-600">R$ {(run.totalValue || run.value).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)]">
                              <span>{run.createdAt?.toDate ? format(run.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'Data N/A'}</span>
                              <span>Qtd: {run.quantity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {runs.filter(r => r.motoboyId === payingMotoboyId && (r.status === 'approved' || r.status === 'pending')).length === 0 && (
                      <div className="text-center py-10 text-[var(--text-muted)]">
                        Nenhuma corrida pendente de pagamento para este motoboy.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t border-[var(--border-color)] mt-4">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="btn btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={loading.paying || selectedRunsToPay.length === 0}
                className="btn btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {loading.paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                Confirmar Pagamento ({selectedRunsToPay.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
