import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { DeliveryLocation, DeliveryRun, DeliveryStatus, Motoboy } from '../types';
import { Plus, Trash2, CheckCircle, XCircle, Clock, MapPin, DollarSign, Calendar, Filter, UserPlus, Users, Bike, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../App';
import { Navigate } from 'react-router-dom';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function DeliveryManagement() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [activeTab, setActiveTab] = useState<'runs' | 'locations' | 'motoboys'>('runs');
  
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationValue, setNewLocationValue] = useState('');
  
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMotoboy, setSelectedMotoboy] = useState('all');

  if (profile?.role === 'motoboy') {
    return <Navigate to="/motoboy-dashboard" />;
  }

  useEffect(() => {
    const qLocations = query(collection(db, 'deliveryLocations'), orderBy('name', 'asc'));
    const unsubscribeLocations = onSnapshot(qLocations, (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryLocation)));
    });

    const qRuns = query(collection(db, 'deliveryRuns'), orderBy('createdAt', 'desc'));
    const unsubscribeRuns = onSnapshot(qRuns, (snap) => {
      setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
    });

    const qMotoboys = query(collection(db, 'motoboys'), orderBy('name', 'asc'));
    const unsubscribeMotoboys = onSnapshot(qMotoboys, (snap) => {
      setMotoboys(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motoboy)));
    });

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
      await updateDoc(doc(db, 'deliveryRuns', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `deliveryRuns/${id}`);
    } finally {
      setLoading(prev => ({ ...prev, [`updateRun_${id}_${status}`]: false }));
    }
  };

  const filteredRuns = runs.filter(run => {
    const matchesDate = run.date === filterDate;
    const matchesMotoboy = selectedMotoboy === 'all' || run.motoboyName === selectedMotoboy;
    return matchesDate && matchesMotoboy;
  });

  const totalValue = filteredRuns
    .filter(r => r.status === 'approved')
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
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input text-sm"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="card overflow-x-auto">
            <div className="min-w-[600px] lg:min-w-0">
              <table className="w-full text-left text-sm">
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
                            run.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {run.status === 'approved' ? 'Aprovado' :
                             run.status === 'rejected' ? 'Rejeitado' :
                             'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {run.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleUpdateRunStatus(run.id, 'approved')}
                                  disabled={loading[`updateRun_${run.id}_approved`]}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                  title="Aprovar"
                                >
                                  {loading[`updateRun_${run.id}_approved`] ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                                </button>
                                <button
                                  onClick={() => handleUpdateRunStatus(run.id, 'rejected')}
                                  disabled={loading[`updateRun_${run.id}_rejected`]}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                  title="Rejeitar"
                                >
                                  {loading[`updateRun_${run.id}_rejected`] ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                                </button>
                              </>
                            )}
                            {run.status !== 'pending' && (
                              <button
                                onClick={() => handleUpdateRunStatus(run.id, 'pending')}
                                disabled={loading[`updateRun_${run.id}_pending`]}
                                className="text-xs text-[var(--text-muted)] hover:underline disabled:opacity-50 flex items-center gap-1"
                              >
                                {loading[`updateRun_${run.id}_pending`] && <Loader2 className="h-3 w-3 animate-spin" />}
                                Reverter
                              </button>
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
