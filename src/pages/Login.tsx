import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Smartphone, Eye, EyeOff, ShieldCheck, Moon, Sun, Bike, Loader2, Download } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const images = [
    "https://imgs.search.brave.com/j1mUIhJijoXaow5tM123NNk6IhxILYwiT4kghYhTxKE/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9ibG9n/LmN1c3RvbWljLmNv/bS5ici93cC1jb250/ZW50L3VwbG9hZHMv/MjAyMi8wNi9jb21v/LW1vbnRhci11bWEt/YXNzaXN0ZW5jaWEt/dGVjbmljYS1kZS1j/ZWx1bGFyLXBhcmNl/aXJvLWN1c3RvbWlj/LmpwZw",
    "https://imgs.search.brave.com/MUCuOUapPJB8jpZrkgTeCkaXZoPZYUHf4q4je5uphPY/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzL2M0LzA2/L2U3L2M0MDZlNzIx/Y2JmMTY1MmMwMmIy/NGRhYmQ5ZDdiODdj/LmpwZw",
    "https://imgs.search.brave.com/JqBT7e1WpFpvIeC-E9Ax3yHz30LlMiZc8dkKBy4Ty78/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3RpL2ZvdG9z/LWdyYXRpcy90Mi8y/NDk5MTU2Ni1wcm9j/ZXNzby1kby1zdWJz/dGl0dWluZG8tZXN0/cmFnYWRvLXRlbGEt/dmlkcm8tYXMtc21h/cnRwaG9uZS1mb3Rv/LmpwZw"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de E-mail/Senha não está ativado no Console do Firebase.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Ocorreu um erro ao processar sua solicitação.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] transition-colors duration-300">
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={toggleTheme} 
          className="flex items-center gap-2 rounded-full p-3 text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-card)] shadow-md border border-[var(--border-color)] transition-all"
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-4 w-4" />
            </>
          ) : (
            <>
              <Sun className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Left Side: Image Carousel */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
              index === currentImageIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
            }`}
          >
            <img
              src={img}
              alt={`Login Background ${index + 1}`}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6 sm:p-12">
          <div className="text-white">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">Gestão Simplificada</h1>
            <p className="text-sm sm:text-base lg:text-lg opacity-90">Controle seu estoque, vendas e ordens de serviço em um só lugar.</p>
          </div>
        </div>
        
        {/* Carousel Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2 bg-[var(--bg-main)]">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
              ) : (
                <ShieldCheck className="h-10 w-10" />
              )}
            </div>
            <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)]">
              {settings.name}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Entre na sua conta
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Email</label>
                <input
                  type="email"
                  required
                  className="input mt-1"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)]">Senha</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="text-center space-y-4">
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download className="h-4 w-4" />
                Instalar Aplicativo
              </button>
            )}
            
            <div className="pt-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => navigate('/motoboy-login')}
                className="text-sm text-[var(--text-muted)] hover:text-blue-600 flex items-center justify-center gap-2 mx-auto"
              >
                <Bike className="h-4 w-4" />
                Área do Motoboy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
