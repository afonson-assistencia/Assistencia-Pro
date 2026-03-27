import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { DeliveryLocation, DeliveryRun, DeliveryStatus, Motoboy } from '../types';
import { Plus, Trash2, CheckCircle, XCircle, Clock, MapPin, DollarSign, Calendar, Filter, UserPlus, Users, Bike, Loader2, Search, MoreVertical, Eye, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';
import { Navigate } from 'react-router-dom';

enum OperationTypeLocal {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

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
  const [newLocationValue, setNewLocationValue] = useState('');
  
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [actionMenuRun, setActionMenuRun] = useState<DeliveryRun | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMotoboy, setSelectedMotoboy] = useState('all');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!newLocationName || !newLocationValue) return;

    setLoading(prev => ({ ...prev, addLocation: true }));
    try {
      if (editingLocation) {
        await updateDoc(doc(db, 'deliveryLocations', editingLocation.id), {
          name: newLocationName,
          value: parseFloat(newLocationValue)
        });
      } else {
        await addDoc(collection(db, 'deliveryLocations'), {
          name: newLocationName,
          value: parseFloat(newLocationValue),
          createdAt: serverTimestamp()
        });
      }
      setNewLocationName('');
      setNewLocationValue('');
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
    setNewLocationValue(location.value.toString());
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

  const filteredRuns = runs.filter(run => {
    const matchesDate = run.date === filterDate;
    const matchesMotoboy = selectedMotoboy === 'all' || run.motoboyName === selectedMotoboy;
    const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
    const matchesSearch = run.motoboyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         run.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesMotoboy && matchesStatus && matchesSearch;
  });

  const totalValue = filteredRuns
    .filter(r => r.status === 'approved' || r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const totalPaid = filteredRuns
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const openNewLocationModal = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setNewLocationValue('');
    setIsLocationModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Gestão de Entregas</h1>
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
              <input
                type="date"
                className="input text-sm dark:text-white [color-scheme:dark]"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Corridas</p>
                <p className="text-xl font-bold">{filteredRuns.reduce((acc, r) => acc + (r.quantity || 1), 0)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Aprovado</p>
                <p className="text-xl font-bold text-emerald-600">R$ {totalValue.toFixed(2)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Pago</p>
                <p className="text-xl font-bold text-blue-600">R$ {totalPaid.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
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
                      <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
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
                  <div key={run.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-[var(--text-main)]">{run.motoboyName}</p>
                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {run.locationName}
                        </p>
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map(loc => (
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
                    <Filter className="h-4 w-4" />
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
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  <DollarSign className="h-4 w-4" />
                  <span>{loc.value.toFixed(2)}</span>
                  <span className="text-xs font-normal text-[var(--text-muted)] ml-1">por corrida</span>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
            </div>
          ))}
          {locations.length === 0 && (
            <div className="col-span-full py-12 text-center card">
              <MapPin className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
              <p className="text-[var(--text-muted)]">Nenhum local cadastrado.</p>
            </div>
          )}
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
                      value: loc ? loc.value : editForm.value
                    });
                  }}
                  required
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name} (R$ {l.value.toFixed(2)})</option>
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
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Nome do Local</label>
                <input
                  type="text"
                  required
                  className="input py-3"
                  placeholder="Ex: Centro, Bairro X, Busca de Peças"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Valor da Corrida (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input py-3 pl-12"
                    placeholder="0.00"
                    value={newLocationValue}
                    onChange={(e) => setNewLocationValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocationModalOpen(false);
                    setEditingLocation(null);
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
    </div>
  );
}
