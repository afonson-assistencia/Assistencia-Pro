import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ServiceOrder, Sale, Product, Expense, STATUS_LABELS, STATUS_COLORS } from '../types';
import { ClipboardList, ShoppingCart, TrendingUp, AlertCircle, CheckCircle2, Clock, Calendar, DollarSign, Receipt, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays, isAfter, isBefore, addDays, subMonths, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, LineChart, Line, Legend } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeOrders: 0,
    readyOrders: 0,
    todayRevenue: 0,
    todayOSRevenue: 0,
    todaySalesRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    monthProductCosts: 0,
    monthExpenses: 0,
    monthProfit: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [expiringOrders, setExpiringOrders] = useState<ServiceOrder[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [statusChartData, setStatusChartData] = useState<any[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const todayS = startOfDay(now);
    const weekS = startOfWeek(now, { weekStartsOn: 0 });
    const monthS = startOfMonth(now);
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const thirtyDaysAgo = subDays(now, 30);
    const threeDaysFromNow = addDays(now, 3);

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
      let monthProductCosts = 0;
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

      // 1. Expiring Orders (next 3 days, not delivered/cancelled)
      const expiring = os.filter(order => {
        if (order.status === 'delivered' || order.status === 'cancelled') return false;
        if (!order.deadline) return false;
        const deadlineDate = order.deadline instanceof Timestamp ? order.deadline.toDate() : new Date(order.deadline);
        return isAfter(deadlineDate, now) && isBefore(deadlineDate, threeDaysFromNow);
      });
      setExpiringOrders(expiring);

      // 2. Top 5 Products (last month)
      const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};
      sales.forEach(sale => {
        const saleDate = sale.date instanceof Timestamp ? sale.date.toDate() : new Date(sale.date);
        if (isAfter(saleDate, monthS)) {
          sale.items.forEach(item => {
            const key = item.productId || item.productName;
            if (!productSales[key]) {
              productSales[key] = { name: item.productName, quantity: 0, revenue: 0 };
            }
            productSales[key].quantity += item.quantity;
            productSales[key].revenue += (item.price * item.quantity);
          });
        }
      });
      const sortedProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      setTopProducts(sortedProducts);

      // 3. OS Status Chart (last 30 days)
      const statusCounts: Record<string, number> = {
        'pending': 0,
        'in-progress': 0,
        'ready': 0,
        'delivered': 0,
        'cancelled': 0
      };
      os.forEach(order => {
        const orderDate = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
        if (isAfter(orderDate, thirtyDaysAgo)) {
          if (statusCounts[order.status] !== undefined) {
            statusCounts[order.status]++;
          }
        }
      });
      setStatusChartData(Object.entries(statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
        count,
        status
      })));

      // 4. Monthly Revenue Chart (last 6 months)
      const monthlyData: Record<string, { name: string, revenue: number, date: Date }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, 'yyyy-MM');
        monthlyData[key] = {
          name: format(d, 'MMM/yy', { locale: ptBR }),
          revenue: 0,
          date: d
        };
      }

      sales.forEach(sale => {
        const date = sale.date instanceof Timestamp ? sale.date.toDate() : new Date(sale.date);
        const key = format(date, 'yyyy-MM');
        if (monthlyData[key]) {
          monthlyData[key].revenue += (sale.totalValue || 0);
        }
      });

      os.forEach(order => {
        if (order.status === 'delivered' && order.deliveredAt) {
          const date = order.deliveredAt instanceof Timestamp ? order.deliveredAt.toDate() : new Date(order.deliveredAt);
          const key = format(date, 'yyyy-MM');
          if (monthlyData[key]) {
            monthlyData[key].revenue += (order.totalValue || 0);
          }
        }
      });

      setMonthlyRevenueData(Object.values(monthlyData));

      // Existing stats logic
      sales.forEach(data => {
        const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        const val = data.totalValue || 0;
        
        if (date >= todayS) {
          todayRev += val;
          todaySalesRev += val;
        }
        if (date >= weekS) weekRev += val;
        if (date >= monthS) monthRev += val;

        const dateStr = format(date, 'yyyy-MM-dd');
        if (dailyRevenue[dateStr] !== undefined) {
          dailyRevenue[dateStr] += val;
        }
      });

      os.forEach(data => {
        const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);
        const val = data.totalValue || 0;
        
        if (data.status === 'delivered') {
          const deliveredDate = data.deliveredAt instanceof Timestamp ? data.deliveredAt.toDate() : (data.deliveredAt ? new Date(data.deliveredAt) : null);
          if (deliveredDate) {
            if (deliveredDate >= todayS) {
              todayRev += val;
              todayOSRev += val;
            }
            if (deliveredDate >= weekS) weekRev += val;
            if (deliveredDate >= monthS) {
              monthRev += val;
              monthProductCosts += (data.productCost || 0);
            }

            const dateStr = format(deliveredDate, 'yyyy-MM-dd');
            if (dailyRevenue[dateStr] !== undefined) {
              dailyRevenue[dateStr] += val;
            }
            
            if (dailyExpenses[dateStr] !== undefined) {
              dailyExpenses[dateStr] += (data.productCost || 0);
            }
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
        
        if (date >= monthS) monthExp += val;

        const dateStr = format(date, 'yyyy-MM-dd');
        if (dailyExpenses[dateStr] !== undefined) {
          dailyExpenses[dateStr] += val;
        }
      });

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
        monthProductCosts: monthProductCosts,
        monthExpenses: monthExp,
        monthProfit: monthRev - monthExp - monthProductCosts,
      });
      setChartData(chartArr);
      setRecentOrders(recent);
      setLoading(false);
    };

    const unsubSales = onSnapshot(query(collection(db, 'sales'), where('date', '>=', Timestamp.fromDate(sixMonthsAgo))), (snap) => {
      sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      updateDashboard();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'sales'));

    const unsubOS = onSnapshot(query(collection(db, 'serviceOrders'), where('createdAt', '>=', Timestamp.fromDate(sixMonthsAgo))), (snap) => {
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
    <div className="space-y-8 w-full overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-main)]">Dashboard</h1>
        <p className="text-[var(--text-muted)]">Bem-vindo ao sistema de gestão da sua assistência.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Faturamento Hoje</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-main)]">R$ {stats.todayRevenue.toFixed(2)}</p>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                <span>OS: R$ {stats.todayOSRevenue.toFixed(2)}</span>
                <span>Vendas: R$ {stats.todaySalesRevenue.toFixed(2)}</span>
              </div>
            </div>
            <div className="rounded-full p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Faturamento Mês</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthRevenue.toFixed(2)}</p>
              <p className="mt-1 text-[9px] sm:text-[10px] text-[var(--text-muted)]">Total acumulado</p>
            </div>
            <div className="rounded-full p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Despesas Mês</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthExpenses.toFixed(2)}</p>
              <p className="mt-1 text-[9px] sm:text-[10px] text-[var(--text-muted)]">Contas pagas</p>
            </div>
            <div className="rounded-full p-2 sm:p-3 bg-red-100 dark:bg-red-900/20 text-red-600">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Lucro Mês</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--text-main)]">R$ {stats.monthProfit.toFixed(2)}</p>
              <p className="mt-1 text-[9px] sm:text-[10px] text-[var(--text-muted)]">Líquido</p>
            </div>
            <div className="rounded-full p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="card lg:col-span-2 p-4 sm:p-6">
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
                  <Bar dataKey="revenue" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} name="Receita" />
                  <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="flex flex-row items-center justify-between border-b border-[var(--border-color)] p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Últimas O.S.</h2>
            <Link to="/service-orders" className="text-xs font-medium text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="p-0">
            <div className="divide-y divide-[var(--border-color)]">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 hover:bg-[var(--bg-main)] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text-main)] truncate">{order.customerName}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{order.model}</p>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
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

      {/* Alerts & New Info (Moved to bottom to preserve layout) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expiring Orders Alert */}
        {expiringOrders.length > 0 && (
          <div className="card border-amber-500 bg-amber-50/50 dark:bg-amber-900/10 p-4 sm:p-6">
            <div className="pb-4">
              <h2 className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-lg font-bold">
                <Clock className="h-5 w-5" />
                O.S. Próximas do Vencimento
              </h2>
            </div>
            <div className="space-y-2">
              {expiringOrders.map(order => (
                <Link key={order.id} to="/service-orders" className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800 border border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-main)]">{order.customerName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{order.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">
                      {order.deadline?.toDate ? format(order.deadline.toDate(), 'dd/MM/yyyy') : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="card border-red-500 bg-red-50/50 dark:bg-red-900/10 p-4 sm:p-6">
            <div className="pb-4">
              <h2 className="flex items-center gap-2 text-red-600 dark:text-red-400 text-lg font-bold">
                <AlertCircle className="h-5 w-5" />
                Estoque Baixo
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <div key={p.id} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-800 text-[var(--text-main)] border border-[var(--border-color)]">
                  {p.name}: <span className="text-red-500 font-bold">{p.stock} un</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Charts (Moved to bottom) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Status de O.S. (30 dias)</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-main)', fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Quantidade">
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.status === 'pending' ? '#eab308' :
                      entry.status === 'in-progress' ? '#3b82f6' :
                      entry.status === 'ready' ? '#22c55e' :
                      entry.status === 'delivered' ? '#64748b' :
                      '#ef4444'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Top 5 Produtos (Mês)</h2>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                  <p className="text-sm font-medium text-[var(--text-main)]">{product.name}</p>
                </div>
                <p className="text-sm font-bold text-emerald-600">R$ {product.revenue.toFixed(2)}</p>
              </div>
            ))}
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
