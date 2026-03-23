import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { DeliveryLocation, DeliveryRun, Motoboy } from '../types';
import { Bike, Calendar, Plus, Clock, CheckCircle, XCircle, DollarSign, MapPin, LogOut, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';

export default function MotoboyDashboard() {
  const { user, profile, signOut } = useAuth();
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [allPendingRuns, setAllPendingRuns] = useState<DeliveryRun[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [runValue, setRunValue] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [tempRuns, setTempRuns] = useState<{locationId: string, locationName: string, value: number, quantity: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || profile?.role !== 'motoboy') {
    return <Navigate to="/motoboy-login" />;
  }

  useEffect(() => {
    // Fetch locations
    const qLocations = query(collection(db, 'deliveryLocations'), orderBy('name', 'asc'));
    const unsubscribeLocations = onSnapshot(qLocations, (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryLocation)));
    });

    // Fetch runs for this motoboy and selected date
    if (profile.motoboyId) {
      const qRuns = query(
        collection(db, 'deliveryRuns'),
        where('motoboyId', '==', profile.motoboyId),
        where('date', '==', selectedDate),
        orderBy('createdAt', 'desc')
      );

      const unsubscribeRuns = onSnapshot(qRuns, (snap) => {
        setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
      });

      // Fetch ALL pending runs for this motoboy to calculate total balance
      const qAllPending = query(
        collection(db, 'deliveryRuns'),
        where('motoboyId', '==', profile.motoboyId),
        where('status', '==', 'pending')
      );

      const unsubscribeAllPending = onSnapshot(qAllPending, (snap) => {
        setAllPendingRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryRun)));
      });

      return () => {
        unsubscribeLocations();
        unsubscribeRuns();
        unsubscribeAllPending();
      };
    }

    return () => unsubscribeLocations();
  }, [profile.motoboyId, selectedDate]);

  const totalPendingBalance = allPendingRuns.reduce((acc, run) => acc + (run.totalValue || (run.value * run.quantity)), 0);

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
      console.error('Error adding runs:', error);
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

  const totalEarned = runs
    .filter(r => r.status === 'approved' || r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const totalPaid = runs
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + (curr.totalValue || curr.value), 0);

  const pendingCount = runs.filter(r => r.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] p-3 sm:p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
            <Bike className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight">{profile.name}</h1>
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Motoboy Parceiro</p>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4 bg-black border-yellow-400">
          <div className="p-3 bg-yellow-400 text-black rounded-lg">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">Saldo Pendente Total</p>
            <p className="text-2xl font-bold text-yellow-400">R$ {totalPendingBalance.toFixed(2)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
            <Bike className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">Corridas Hoje</p>
            <p className="text-2xl font-bold text-[var(--text-main)]">{runs.reduce((acc, r) => acc + (r.quantity || 1), 0)}</p>
          </div>
        </div>
      </div>

      {/* Date Selector & Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4 space-y-3">
          <label className="text-sm font-medium text-[var(--text-muted)] flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Selecionar Data
          </label>
          <input
            type="date"
            className="input w-full text-sm sm:text-base"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Ganhos</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">R$ {totalEarned.toFixed(2)}</p>
          </div>
          <div className="card p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Pagos</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">R$ {totalPaid.toFixed(2)}</p>
          </div>
          <div className="card p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Pendentes</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Runs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Minhas Corridas
          </h2>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary py-2 px-4 flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            Lançar Corrida
          </button>
        </div>

        <div className="space-y-3">
          {runs.length > 0 ? (
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
              <div className="bg-slate-50 dark:bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <p className="text-[var(--text-muted)]">Nenhuma corrida lançada para este dia.</p>
            </div>
          )}
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
                  Local da Entrega
                </label>
                <select
                  className="input w-full text-base"
                  value={selectedLocationId}
                  onChange={(e) => {
                    const locId = e.target.value;
                    setSelectedLocationId(locId);
                    const location = locations.find(l => l.id === locId);
                    if (location) {
                      setRunValue(location.value.toString());
                    }
                  }}
                >
                  <option value="">Selecione o local...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} - R$ {loc.value.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor da Corrida (R$)
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
                        ((locations.find(l => l.id === selectedLocationId)?.value || 0) * parseInt(quantity || '0'))
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
    </div>
  );
}
