import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ServiceOrder, Sale, Product, STATUS_LABELS, STATUS_COLORS } from '../types';
import { ClipboardList, ShoppingCart, TrendingUp, AlertCircle, CheckCircle2, Clock, Calendar, DollarSign, Receipt, Package } from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
    async function fetchDashboardData() {
      try {
        const now = new Date();
        const todayS = startOfDay(now);
        const weekS = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
        const monthS = startOfMonth(now);
        
        // Fetch all sales, service orders, and expenses from start of month
        let salesSnap, osSnap, expSnap, productsSnap;
        try {
          [salesSnap, osSnap, expSnap, productsSnap] = await Promise.all([
            getDocs(query(collection(db, 'sales'), where('date', '>=', Timestamp.fromDate(monthS)))),
            getDocs(query(collection(db, 'serviceOrders'), where('createdAt', '>=', Timestamp.fromDate(monthS)))),
            getDocs(query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(monthS)))),
            getDocs(collection(db, 'products'))
          ]);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'dashboard_initial_fetch');
          return; // Should not reach here as handleFirestoreError throws
        }

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

        salesSnap.forEach(doc => {
          const data = doc.data();
          const date = data.date.toDate();
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

        osSnap.forEach(doc => {
          const data = doc.data();
          const date = data.createdAt.toDate();
          const val = data.totalValue || 0;
          
          if (data.status === 'ready' || data.status === 'delivered' || data.status === 'completed') {
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
        productsSnap.forEach(doc => {
          const p = { id: doc.id, ...doc.data() } as Product;
          if (p.stock <= 5) {
            lowStock.push(p);
          }
        });
        setLowStockProducts(lowStock);

        expSnap.forEach(doc => {
          const data = doc.data();
          const date = data.date.toDate();
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

        // Active Orders (pending + in-progress)
        const activeQuery = query(
          collection(db, 'serviceOrders'),
          where('status', 'in', ['pending', 'in-progress'])
        );
        const activeSnap = await getDocs(activeQuery);
        
        // Ready Orders
        const readyQuery = query(
          collection(db, 'serviceOrders'),
          where('status', '==', 'ready')
        );
        const readySnap = await getDocs(readyQuery);

        // Recent Orders
        const recentQuery = query(
          collection(db, 'serviceOrders'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentSnap = await getDocs(recentQuery);
        const recent: ServiceOrder[] = [];
        recentSnap.forEach(doc => recent.push({ id: doc.id, ...doc.data() } as ServiceOrder));

        setStats({
          activeOrders: activeSnap.size,
          readyOrders: readySnap.size,
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
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
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
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-900/30">
          <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-bold">Alerta de Estoque Baixo</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {lowStockProducts.map(p => (
              <div key={p.id} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-800 text-[var(--text-main)] border border-[var(--border-color)]">
                {p.name}: <span className="text-red-500 font-bold">{p.stock} un</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)]">Faturamento Hoje</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">R$ {stats.todayRevenue.toFixed(2)}</p>
              <div className="mt-1 flex gap-2 text-[10px] text-[var(--text-muted)]">
                <span>OS: R$ {stats.todayOSRevenue.toFixed(2)}</span>
                <span>Vendas: R$ {stats.todaySalesRevenue.toFixed(2)}</span>
              </div>
            </div>
            <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
        <StatCard
          title="Faturamento Mês"
          value={`R$ ${stats.monthRevenue.toFixed(2)}`}
          icon={Receipt}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Despesas Mês"
          value={`R$ ${stats.monthExpenses.toFixed(2)}`}
          icon={AlertCircle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          title="Lucro Mês"
          value={`R$ ${stats.monthProfit.toFixed(2)}`}
          icon={DollarSign}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Ordens Ativas"
          value={stats.activeOrders}
          icon={Clock}
          color="text-orange-600"
          bg="bg-orange-50"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="card lg:col-span-2 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-main)]">Fluxo de Caixa (Últimos 7 dias)</h3>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-slate-900 dark:bg-white"></div>
                <span className="text-[var(--text-muted)]">Receita</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <span className="text-[var(--text-muted)]">Despesas</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`]}
                />
                <Bar dataKey="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-4 font-semibold text-[var(--text-main)]">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-4">
              <QuickActionLink to="/service-orders" label="Nova O.S." icon={ClipboardList} />
              <QuickActionLink to="/sales" label="Nova Venda" icon={ShoppingCart} />
              <QuickActionLink to="/cash-closure" label="Fechar Caixa" icon={DollarSign} />
              <QuickActionLink to="/inventory" label="Ver Estoque" icon={Package} />
            </div>
          </div>
          
          <div className="card p-6 bg-slate-900 dark:bg-slate-800 text-white border-none">
            <h3 className="mb-2 font-semibold">Resumo de Entrega</h3>
            <p className="text-sm text-slate-400 mb-4">Você tem {stats.readyOrders} ordens prontas para entrega.</p>
            <Link to="/service-orders" className="text-sm font-medium text-white underline underline-offset-4">
              Ver ordens prontas →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-1">
        {/* Recent Orders */}
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4 flex justify-between items-center">
            <h3 className="font-semibold text-[var(--text-main)]">Últimas Ordens de Serviço</h3>
            <Link to="/service-orders" className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]">Ver todas</Link>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 hover:bg-[var(--bg-main)]">
                  <div>
                    <p className="font-medium text-[var(--text-main)]">{order.customerName}</p>
                    <p className="text-sm text-[var(--text-muted)]">{order.model} - {order.problem}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
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
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-main)]">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${bg} dark:bg-opacity-20 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function QuickActionLink({ to, label, icon: Icon }: any) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] p-4 transition-all hover:bg-[var(--bg-main)] hover:shadow-md group"
    >
      <Icon className="h-6 w-6 text-[var(--text-muted)] group-hover:text-[var(--text-main)]" />
      <span className="text-sm font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)]">{label}</span>
    </Link>
  );
}
