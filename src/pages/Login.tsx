import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { Smartphone, Eye, EyeOff, ShieldCheck, Moon, Sun, Bike, Loader2 } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O provedor de E-mail/Senha não está ativado no Console do Firebase. Por favor, ative-o em Authentication > Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Ocorreu um erro ao processar sua solicitação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
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
              {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
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
                isLogin ? 'Entrar' : 'Cadastrar'
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--border-color)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--bg-card)] px-2 text-[var(--text-muted)]">Ou continue com</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn btn-secondary w-full gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </form>

          <div className="text-center space-y-4">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
            
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
