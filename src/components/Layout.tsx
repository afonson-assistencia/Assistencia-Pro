import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, Package, ShoppingCart, LogOut, Menu, X, Receipt, Moon, Sun, ShieldCheck, Download, Wallet, Settings as SettingsIcon, Bike, Database, Globe, Shield, MapPin, ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const isAdmin = profile?.role === 'admin';
  const isMotoboy = profile?.role === 'motoboy';

  const navItems = [
    ...(isMotoboy ? [
      { path: '/motoboy-dashboard', label: 'Minhas Corridas', icon: Bike },
    ] : [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/customers', label: 'Clientes', icon: Users },
      { path: '/service-orders', label: 'Ordens de Serviço', icon: ClipboardList },
      { path: '/inventory', label: 'Estoque', icon: Package },
      { path: '/shopping-list', label: 'Lista de Compras', icon: ShoppingCart },
      { path: '/sales', label: 'Vendas', icon: ShoppingCart },
      { path: '/expenses', label: 'Despesas', icon: Receipt },
      { path: '/cash-closure', label: 'Fechamento', icon: Wallet },
      { path: '/delivery-management', label: 'Logística', icon: Bike },
      { path: '/storefront', label: 'Vitrine', icon: Globe },
      { path: '/storefront-orders', label: 'Pedidos Vitrine', icon: ShoppingBag },
      ...(isAdmin ? [{ path: '/access-logs', label: 'Logs de Acesso', icon: Shield }] : []),
    ]),
    ...(isAdmin ? [{ path: '/settings', label: 'Configurações', icon: SettingsIcon }] : []),
  ];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card lg:block">
          <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <span className="text-xl font-bold text-foreground truncate">{settings.name}</span>
        </div>
        <div className="h-[calc(100vh-16rem)] px-4 py-4 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary dark:text-black text-white'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="absolute bottom-0 w-full border-t border-border p-4 bg-card">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="mb-4 flex w-full items-center justify-start gap-3 rounded-lg px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <Download className="h-4 w-4" />
              Instalar App
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="mb-4 flex w-full items-center justify-start gap-3 rounded-lg px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          </button>
          <div className="mb-4 px-3">
            <p className="text-xs font-medium text-muted-foreground">Logado como</p>
            <p className="truncate text-sm font-semibold text-foreground">{profile?.name || profile?.email || 'Usuário'}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{profile?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-start gap-3 rounded-lg px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden sticky top-0 z-40 w-full">
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary" />
            )}
            <span className="text-lg font-bold text-foreground truncate">{settings.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        {/* Custom Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Menu Content */}
            <div className="absolute inset-y-0 right-0 w-72 bg-card border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
              <div className="h-16 border-b border-border px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  )}
                  <span className="text-lg font-bold text-foreground truncate">{settings.name}</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 px-4 py-4 overflow-y-auto">
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors',
                          isActive
                            ? 'bg-primary dark:text-black text-white'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              
              <div className="border-t border-border p-4 bg-card">
                {deferredPrompt && (
                  <button
                    onClick={handleInstall}
                    className="mb-4 flex w-full items-center justify-start gap-3 rounded-lg px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  >
                    <Download className="h-5 w-5" />
                    Instalar App
                  </button>
                )}
                <div className="mb-4 px-3">
                  <p className="text-xs font-medium text-muted-foreground">Logado como</p>
                  <p className="truncate text-sm font-semibold text-foreground">{profile?.name || profile?.email || 'Usuário'}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{profile?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-start gap-3 rounded-lg px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
