import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Sale, Expense, DeliveryRun } from '../types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Wallet, Printer, ClipboardList, ShoppingBag, Receipt, MessageSquare, Bike } from 'lucide-react';

export default function CashClosure() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    osRevenue: 0,
    salesRevenue: 0,
    expenses: 0,
    deliveryExpenses: 0,
    totalRevenue: 0,
    netProfit: 0,
    osCount: 0,
    salesCount: 0,
    expenseCount: 0,
    deliveryCount: 0,
    osList: [] as ServiceOrder[],
    salesList: [] as Sale[],
    expenseList: [] as Expense[],
    deliveryList: [] as DeliveryRun[],
  });

  useEffect(() => {
    fetchClosureData();
  }, [date]);

  async function fetchClosureData() {
    setLoading(true);
    try {
      const start = startOfDay(new Date(date + 'T12:00:00'));
      const end = endOfDay(new Date(date + 'T12:00:00'));

      const [osSnap, salesSnap, expSnap, deliverySnap] = await Promise.all([
        getDocs(query(collection(db, 'serviceOrders'), where('deliveredAt', '>=', Timestamp.fromDate(start)), where('deliveredAt', '<=', Timestamp.fromDate(end)))),
        getDocs(query(collection(db, 'sales'), where('date', '>=', Timestamp.fromDate(start)), where('date', '<=', Timestamp.fromDate(end)))),
        getDocs(query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(start)), where('date', '<=', Timestamp.fromDate(end)))),
        getDocs(query(collection(db, 'deliveryRuns'), where('paidAt', '>=', Timestamp.fromDate(start)), where('paidAt', '<=', Timestamp.fromDate(end))))
      ]);

      let osRev = 0;
      const osList: ServiceOrder[] = [];
      osSnap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() } as ServiceOrder;
        osRev += d.totalValue || 0;
        osList.push(d);
      });

      let salesRev = 0;
      const salesList: Sale[] = [];
      salesSnap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() } as Sale;
        salesRev += d.totalValue || 0;
        salesList.push(d);
      });

      let expTotal = 0;
      const expenseList: Expense[] = [];
      expSnap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() } as Expense;
        expTotal += d.value || 0;
        expenseList.push(d);
      });

      let deliveryTotal = 0;
      const deliveryList: DeliveryRun[] = [];
      deliverySnap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() } as DeliveryRun;
        deliveryTotal += d.totalValue || d.value || 0;
        deliveryList.push(d);
      });

      setData({
        osRevenue: osRev,
        salesRevenue: salesRev,
        expenses: expTotal,
        deliveryExpenses: deliveryTotal,
        totalRevenue: osRev + salesRev,
        netProfit: (osRev + salesRev) - (expTotal + deliveryTotal),
        osCount: osSnap.size,
        salesCount: salesSnap.size,
        expenseCount: expSnap.size,
        deliveryCount: deliverySnap.size,
        osList,
        salesList,
        expenseList,
        deliveryList,
      });
    } catch (error) {
      console.error('Error fetching closure data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const formattedDate = format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy');
    const message = `*Relatório de Fechamento de Caixa*
*Data:* ${formattedDate}

*Resumo Financeiro:*
💰 Entradas (OS): R$ ${data.osRevenue.toFixed(2)}
🛒 Entradas (Vendas): R$ ${data.salesRevenue.toFixed(2)}
📉 Saídas (Despesas): R$ ${data.expenses.toFixed(2)}
🏍️ Saídas (Entregas): R$ ${data.deliveryExpenses.toFixed(2)}
📊 *Saldo Líquido: R$ ${data.netProfit.toFixed(2)}*

*Movimentação:*
🛠️ Serviços: ${data.osCount}
🛍️ Vendas: ${data.salesCount}
💸 Despesas: ${data.expenseCount}
🏍️ Entregas: ${data.deliveryCount}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Fechamento de Caixa</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Resumo financeiro diário.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="flex flex-1 sm:flex-none items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 shadow-sm">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="date"
              className="border-none bg-transparent p-0 text-sm font-medium focus:ring-0 text-[var(--text-main)] w-full sm:w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button onClick={handleWhatsAppShare} className="btn bg-emerald-500 text-white hover:bg-emerald-600 gap-2 flex-1 sm:flex-none justify-center">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden xs:inline">WhatsApp</span>
          </button>
          <button onClick={handlePrint} className="btn btn-secondary gap-2 flex-1 sm:flex-none justify-center">
            <Printer className="h-4 w-4" />
            <span className="hidden xs:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold uppercase text-black">Relatório de Fechamento de Caixa</h1>
        <p className="text-sm text-slate-500">Data: {format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--text-main)]"></div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Entradas (OS)</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-main)]">R$ {data.osRevenue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20">
                  <ClipboardList className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="card p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Entradas (Vendas)</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-main)]">R$ {data.salesRevenue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="card p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Saídas (Despesas)</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-main)]">R$ {data.expenses.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-900/20">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="card p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Saídas (Entregas)</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-main)]">R$ {data.deliveryExpenses.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-orange-900/20">
                  <Bike className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="card p-6 border-l-4 border-slate-900 dark:border-slate-100 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Saldo Líquido</p>
                  <p className={`mt-1 text-xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    R$ {data.netProfit.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Serviços Realizados ({data.osCount})
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {data.osList.length > 0 ? (
                  data.osList.map(os => (
                    <div key={os.id} className="p-4 flex justify-between items-center text-sm hover:bg-[var(--bg-main)]">
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{os.customerName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{os.model}</p>
                      </div>
                      <span className="font-bold text-[var(--text-main)]">R$ {os.totalValue?.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="p-6 text-center text-[var(--text-muted)] text-sm">Nenhum serviço hoje.</p>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Vendas Realizadas ({data.salesCount})
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {data.salesList.length > 0 ? (
                  data.salesList.map(sale => (
                    <div key={sale.id} className="p-4 flex justify-between items-center text-sm hover:bg-[var(--bg-main)]">
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{sale.customerName || 'Consumidor Final'}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {sale.items?.length || 0} itens
                        </p>
                      </div>
                      <span className="font-bold text-[var(--text-main)]">R$ {sale.totalValue?.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="p-6 text-center text-[var(--text-muted)] text-sm">Nenhuma venda hoje.</p>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Despesas do Dia ({data.expenseCount})
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {data.expenseList.length > 0 ? (
                  data.expenseList.map(exp => (
                    <div key={exp.id} className="p-4 flex justify-between items-center text-sm hover:bg-[var(--bg-main)]">
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{exp.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">{exp.category}</p>
                      </div>
                      <span className="font-bold text-red-600">- R$ {exp.value?.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="p-6 text-center text-[var(--text-muted)] text-sm">Nenhuma despesa hoje.</p>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  Entregas Pagas ({data.deliveryCount})
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {data.deliveryList.length > 0 ? (
                  data.deliveryList.map(run => (
                    <div key={run.id} className="p-4 flex justify-between items-center text-sm hover:bg-[var(--bg-main)]">
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{run.motoboyName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{run.locationName}</p>
                      </div>
                      <span className="font-bold text-orange-600">- R$ {(run.totalValue || run.value).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="p-6 text-center text-[var(--text-muted)] text-sm">Nenhuma entrega paga hoje.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
