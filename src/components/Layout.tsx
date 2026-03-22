import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, Package, ShoppingCart, LogOut, Menu, X, Receipt, Moon, Sun, ShieldCheck, Download, Wallet, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../App';
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

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/customers', label: 'Clientes', icon: Users },
    { path: '/service-orders', label: 'Ordens de Serviço', icon: ClipboardList },
    { path: '/inventory', label: 'Estoque', icon: Package },
    { path: '/sales', label: 'Vendas', icon: ShoppingCart },
    { path: '/expenses', label: 'Despesas', icon: Receipt },
    { path: '/cash-closure', label: 'Fechamento', icon: Wallet },
    ...(profile?.role === 'admin' ? [{ path: '/settings', label: 'Configurações', icon: SettingsIcon }] : []),
  ];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
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
    <div className="flex min-h-screen bg-[var(--bg-main)]">
      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--border-color)] bg-[var(--bg-card)] md:block">
          <div className="flex h-16 items-center gap-3 border-b border-[var(--border-color)] px-6">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <span className="text-xl font-bold text-[var(--text-main)] truncate">{settings.name}</span>
        </div>
        <nav className="space-y-1 p-4">
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
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-[var(--text-muted)] hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-[var(--border-color)] p-4">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="mb-4 flex w-full items-center gap-3 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
            >
              <Download className="h-4 w-4" />
              Instalar App
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="mb-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          </button>
          <div className="mb-4 px-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">Logado como</p>
            <p className="truncate text-sm font-semibold text-[var(--text-main)]">{profile?.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{profile?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 md:hidden">
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-slate-900 dark:text-white" />
            )}
            <span className="text-lg font-bold text-[var(--text-main)] truncate">{settings.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-main)]"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-[var(--bg-card)] md:hidden">
            <div className="flex h-16 items-center justify-between border-b border-[var(--border-color)] px-4">
              <div className="flex items-center gap-2">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-[var(--text-main)]" />
                )}
                <span className="text-lg font-bold text-[var(--text-main)] truncate">{settings.name}</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-main)]"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-2 p-4">
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
                        ? 'bg-[var(--text-main)] text-[var(--bg-card)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="flex w-full items-center gap-3 rounded-lg bg-emerald-500 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-600"
                >
                  <Download className="h-5 w-5" />
                  Instalar App
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </nav>
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
