import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ServiceOrder, Sale, Product, Expense, STATUS_LABELS, STATUS_COLORS } from '../types';
import { ClipboardList, ShoppingCart, TrendingUp, AlertCircle, CheckCircle2, Clock, Calendar, DollarSign, Receipt, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    readyOrders: 0,
    todayRevenue: 0,
    todayOSRevenue: 0,
    todaySalesRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    monthExpenses: 0,
    monthProfit: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const todayS = startOfDay(now);
    const weekS = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
    const monthS = startOfMonth(now);

    let sales: Sale[] = [];
    let os: ServiceOrder[] = [];
    let expenses: Expense[] = [];
    let products: Product[] = [];
    let activeOrdersCount = 0;
    let readyOrdersCount = 0;
    let recent: ServiceOrder[] = [];

    const updateDashboard = () => {
      let todayRev = 0;
      let todayOSRev = 0;
      let todaySalesRev = 0;
      let weekRev = 0;
      let monthRev = 0;
      let monthExp = 0;

      const dailyRevenue: Record<string, number> = {};
      const dailyExpenses: Record<string, number> = {};
      
      // Initialize last 7 days for chart
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const dateStr = format(d, 'yyyy-MM-dd');
        dailyRevenue[dateStr] = 0;
        dailyExpenses[dateStr] = 0;
      }

      sales.forEach(data => {
        const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        const val = data.totalValue || 0;
        
        if (date >= todayS) {
          todayRev += val;
          todaySalesRev += val;
        }
        if (date >= weekS) weekRev += val;
        monthRev += val;

        const dateStr = format(date, 'yyyy-MM-dd');
        if (dailyRevenue[dateStr] !== undefined) {
          dailyRevenue[dateStr] += val;
        }
      });

      os.forEach(data => {
        const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);
        const val = data.totalValue || 0;
        
        if (data.status === 'ready' || data.status === 'delivered') {
          if (date >= todayS) {
            todayRev += val;
            todayOSRev += val;
          }
          if (date >= weekS) weekRev += val;
          monthRev += val;

          const dateStr = format(date, 'yyyy-MM-dd');
          if (dailyRevenue[dateStr] !== undefined) {
            dailyRevenue[dateStr] += val;
          }
        }
      });

      const lowStock: Product[] = [];
      products.forEach(p => {
        if (p.stock <= 5) {
          lowStock.push(p);
        }
      });
      setLowStockProducts(lowStock);

      expenses.forEach(data => {
        const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        const val = data.value || 0;
        
        monthExp += val;

        const dateStr = format(date, 'yyyy-MM-dd');
        if (dailyExpenses[dateStr] !== undefined) {
          dailyExpenses[dateStr] += val;
        }
      });

      // Prepare chart data
      const chartArr = Object.keys(dailyRevenue).map(date => ({
        name: format(new Date(date + 'T12:00:00'), 'dd/MM'),
        revenue: dailyRevenue[date],
        expenses: dailyExpenses[date]
      }));

      setStats({
        activeOrders: activeOrdersCount,
        readyOrders: readyOrdersCount,
        todayRevenue: todayRev,
        todayOSRevenue: todayOSRev,
        todaySalesRevenue: todaySalesRev,
        weekRevenue: weekRev,
        monthRevenue: monthRev,
        monthExpenses: monthExp,
        monthProfit: monthRev - monthExp,
      });
      setChartData(chartArr);
      setRecentOrders(recent);
      setLoading(false);
    };

    const unsubSales = onSnapshot(query(collection(db, 'sales'), where('date', '>=', Timestamp.fromDate(monthS))), (snap) => {
      sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'sales'));

    const unsubOS = onSnapshot(query(collection(db, 'serviceOrders'), where('createdAt', '>=', Timestamp.fromDate(monthS))), (snap) => {
      os = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'serviceOrders'));

    const unsubExp = onSnapshot(query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(monthS))), (snap) => {
      expenses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'expenses'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products'));

    const unsubActive = onSnapshot(query(collection(db, 'serviceOrders'), where('status', 'in', ['pending', 'in-progress'])), (snap) => {
      activeOrdersCount = snap.size;
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'serviceOrders/active'));

    const unsubReady = onSnapshot(query(collection(db, 'serviceOrders'), where('status', '==', 'ready')), (snap) => {
      readyOrdersCount = snap.size;
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'serviceOrders/ready'));

    const unsubRecent = onSnapshot(query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
      recent = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'serviceOrders/recent'));

    return () => {
      unsubSales();
      unsubOS();
      unsubExp();
      unsubProducts();
      unsubActive();
      unsubReady();
      unsubRecent();
    };
  }, []);

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-main)]">Dashboard</h1>
        <p className="text-[var(--text-muted)]">Bem-vindo ao sistema de gestão da sua assistência.</p>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card border-red-500 bg-red-50/50 dark:bg-red-900/10 p-6">
          <div className="pb-2">
            <h2 className="flex items-center gap-2 text-red-600 dark:text-red-400 text-lg font-bold">
              <AlertCircle className="h-5 w-5" />
              Alerta de Estoque Baixo
            </h2>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <div key={p.id} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-800 text-[var(--text-main)] border border-[var(--border-color)]">
                  {p.name}: <span className="text-red-500 font-bold">{p.stock} un</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Faturamento Hoje</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">R$ {stats.todayRevenue.toFixed(2)}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
                <span>OS: R$ {stats.todayOSRevenue.toFixed(2)}</span>
                <span>Vendas: R$ {stats.todaySalesRevenue.toFixed(2)}</span>
              </div>
            </div>
            <div className="rounded-full p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Faturamento Mês</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthRevenue.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Total acumulado</p>
            </div>
            <div className="rounded-full p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Despesas Mês</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthExpenses.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Contas pagas</p>
            </div>
            <div className="rounded-full p-3 bg-red-100 dark:bg-red-900/20 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Lucro Mês</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthProfit.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Líquido</p>
            </div>
            <div className="rounded-full p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="card lg:col-span-2 p-6">
          <div className="flex flex-row items-center justify-between pb-8">
            <div>
              <h2 className="text-lg font-semibold">Fluxo de Caixa</h2>
              <p className="text-xs text-[var(--text-muted)]">Últimos 7 dias de operação</p>
            </div>
            <div className="flex gap-4 text-[10px] font-medium uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[var(--accent-primary)]"></div>
                <span className="text-[var(--text-muted)]">Receita</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400"></div>
                <span className="text-[var(--text-muted)]">Despesas</span>
              </div>
            </div>
          </div>
          <div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-main)', opacity: 0.4 }}
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                    itemStyle={{ color: 'var(--text-main)', padding: '2px 0' }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`]}
                  />
                  <Bar dataKey="revenue" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} name="Receita" barSize={32} />
                  <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} name="Despesas" barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Quick Actions & Summary */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="pb-4">
              <h2 className="text-lg font-semibold">Ações Rápidas</h2>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionLink to="/service-orders" label="Nova O.S." icon={ClipboardList} />
                <QuickActionLink to="/sales" label="Nova Venda" icon={ShoppingCart} />
                <QuickActionLink to="/shopping-list" label="Lista Compras" icon={ShoppingCart} />
                <QuickActionLink to="/inventory" label="Ver Estoque" icon={Package} />
              </div>
            </div>
          </div>
          
          <div className="card bg-[var(--accent-primary)] text-[var(--accent-foreground)] border-none shadow-lg p-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-white/20 p-2">
                  <Package className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">Resumo de Entrega</h3>
              </div>
              <p className="text-sm opacity-90 mb-6">Você tem <span className="font-bold text-lg">{stats.readyOrders}</span> ordens prontas para entrega aos clientes.</p>
              <Link 
                to="/service-orders" 
                className="inline-flex items-center gap-2 text-sm font-medium hover:gap-3 transition-all"
              >
                Ver ordens prontas <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex flex-row items-center justify-between border-b border-[var(--border-color)] p-6">
          <h2 className="text-lg font-semibold">Últimas Ordens de Serviço</h2>
          <Link to="/service-orders" className="text-xs font-medium text-blue-600 hover:underline">Ver todas</Link>
        </div>
        <div className="p-0">
          <div className="divide-y divide-[var(--border-color)]">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 hover:bg-[var(--bg-main)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--text-main)] truncate">{order.customerName}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{order.model} • {order.problem}</p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'dd/MM HH:mm', { locale: ptBR }) : ''}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[var(--text-muted)]">Nenhuma ordem recente.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-main)]">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${bg} dark:bg-opacity-20 ${color}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}

function QuickActionLink({ to, label, icon: Icon }: any) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] p-3 sm:p-4 transition-all hover:bg-[var(--bg-main)] hover:shadow-md group"
    >
      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
      <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)] text-center">{label}</span>
    </Link>
  );
}
