import React, { useState, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Bike, LogIn, ShieldCheck, Moon, Sun, User, AlertCircle, Loader2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MotoboyLogin() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
    
    // Check if prompt was already captured
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handler = () => {
      console.log('PWA Install Available event received');
      setDeferredPrompt((window as any).deferredPrompt);
    };

    window.addEventListener('pwa-install-available', handler);
    return () => window.removeEventListener('pwa-install-available', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      }
    }
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError('');
    setShowConfigHelp(false);

    try {
      // 1. Search for motoboy by name
      const motoboysRef = collection(db, 'motoboys');
      const q = query(motoboysRef, where('name', '==', name.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Motoboy não encontrado. Verifique o nome ou peça ao administrador para cadastrá-lo.');
        setLoading(false);
        return;
      }

      const motoboyDoc = querySnapshot.docs[0];
      const motoboyData = motoboyDoc.data();

      if (motoboyData.active === false) {
        setError('Este cadastro está inativo.');
        setLoading(false);
        return;
      }

      // 2. Sign in anonymously
      try {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        // 3. Create/Update user profile as motoboy
        await setDoc(doc(db, 'users', user.uid), {
          name: motoboyData.name,
          role: 'motoboy',
          motoboyId: motoboyDoc.id,
          email: `${motoboyDoc.id}@motoboy.local`, // Dummy email for compatibility
          createdAt: serverTimestamp(),
        }, { merge: true });

        navigate('/motoboy-dashboard');
      } catch (authErr: any) {
        if (authErr.code === 'auth/admin-restricted-operation') {
          setError('O login anônimo não está ativado no Firebase.');
          setShowConfigHelp(true);
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 transition-colors duration-300">
      {/* Left Side - Image */}
      <div className="hidden md:block md:w-1/2 lg:w-3/5 relative overflow-hidden">
        <img 
          src="/motoboy_pwa.png" 
          alt="Motoboy Tech" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
        <div className="absolute bottom-12 left-12 text-white">
          <h2 className="text-4xl font-bold mb-2">Motoboy Tech</h2>
          <p className="text-lg opacity-90">Gerencie suas corridas com facilidade.</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">

        <div className="w-full max-w-md">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4 sm:mb-6">
              <Bike className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Motoboy Tech</h1>
            <p className="text-sm sm:text-lg text-white mt-2 sm:mt-3">Bem-vindo de volta! Digite seu nome para entrar.</p>
          </div>

          <div>
            {error && (
              <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex flex-col gap-3 text-red-600 dark:text-red-400">
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                  {error}
                </div>
                {showConfigHelp && (
                  <div className="mt-2 text-xs bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                    <p className="font-bold mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Ação Necessária:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                      <li>Vá ao Console do Firebase</li>
                      <li>Authentication {'>'} Sign-in method</li>
                      <li>Ative o provedor <b>"Anônimo"</b></li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wider">Seu Nome</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
                  <input
                    type="text"
                    required
                    className="w-full pl-14 pr-6 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-xl font-medium"
                    placeholder="Ex: Ronald Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-6 w-6" />
                    Entrar no Painel
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
              {isIframe && (
                <div className="p-5 bg-amber-900/30 border-2 border-amber-500/50 rounded-3xl text-amber-100 text-sm shadow-lg shadow-amber-900/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-500 text-black rounded-full">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <p className="font-black uppercase tracking-tight text-base">Instalação Bloqueada</p>
                  </div>
                  <p className="opacity-90 leading-relaxed">
                    Você está no modo de visualização. Para instalar o **Motoboy Tech** no seu celular, você deve abrir o link direto no seu navegador.
                  </p>
                  <button 
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="mt-4 w-full py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-2xl font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    Abrir em Nova Aba
                  </button>
                </div>
              )}

              {deferredPrompt ? (
                <div className="space-y-3">
                  <p className="text-center text-xs font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
                    Aplicativo Pronto para Instalar!
                  </p>
                  <button
                    onClick={handleInstall}
                    className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-emerald-500/30 active:scale-95 group"
                  >
                    <Download className="h-7 w-7 group-hover:bounce" />
                    INSTALAR AGORA
                  </button>
                </div>
              ) : (
                !isIframe && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowIOSGuide(!showIOSGuide)}
                      className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-500/30 active:scale-95 group"
                    >
                      <Download className="h-7 w-7 group-hover:bounce" />
                      INSTALAR APLICATIVO
                    </button>
                    <p className="text-center text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      Clique acima para ver como instalar no seu celular
                    </p>
                  </div>
                )
              )}

              {showIOSGuide && (
                <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-2xl text-white text-sm space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                  <p className="font-bold flex items-center gap-2 text-blue-400">
                    <AlertCircle className="h-4 w-4" /> 
                    Instruções para iPhone/iOS:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 opacity-90">
                    <li>Abra este site no <b>Safari</b></li>
                    <li>Toque no botão <b>Compartilhar</b> (quadrado com seta)</li>
                    <li>Role para baixo e toque em <b>"Adicionar à Tela de Início"</b></li>
                    <li>Toque em <b>Adicionar</b> no canto superior</li>
                  </ol>
                  <p className="text-[10px] text-blue-300/60 pt-2 border-t border-blue-800/50">
                    Para Android, use o Google Chrome e aguarde o aviso de instalação.
                  </p>
                </div>
              )}
              
              <p className="text-center text-sm text-white">
                Não é motoboy? <button onClick={() => navigate('/login')} className="text-blue-600 font-bold hover:underline">Acesso Administrativo</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
