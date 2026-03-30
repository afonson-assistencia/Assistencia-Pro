import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, Smartphone, Wrench, Zap } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function Landing() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleStart = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-blue-500/30 font-sans">
      {/* Background Image with Gradient */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://imgs.search.brave.com/AHeyD522AJ4SUUgYQziCqKzYyTgQkIvIKHndTeukzJA/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9ybXRl/bGVmb25pYS5jb20u/YnIvd3AtY29udGVu/dC91cGxvYWRzLzIw/MjQv/MDUvUXVhbC1v/LXNhbGFyaW8tZGUt/dW0tdGVjbmljby1l/bS1jZWx1bGFyLmpw/Zw"
          alt="Background"
          className="h-full w-full object-cover opacity-30"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/70 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-white" />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight">{settings.name}</span>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/login')}
          className="rounded-full bg-white/10 px-6 py-2 text-sm font-medium backdrop-blur-md transition-all hover:bg-white/20 border border-white/10"
        >
          Entrar
        </motion.button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 text-center lg:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400 backdrop-blur-sm"
          >
            <Zap className="h-4 w-4" />
            <span>A plataforma #1 para Assistências Técnicas</span>
          </motion.div>
          
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1]">
            Sua Assistência <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Profissional
            </span>
          </h1>
          
          <p className="mt-6 mx-auto max-w-2xl text-base text-slate-400 sm:text-lg md:text-xl lg:text-2xl leading-relaxed">
            Gerencie ordens de serviço, estoque e vendas em uma interface moderna e intuitiva. 
            Feito para técnicos que buscam excelência.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:mt-12"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_rgba(37,99,235,0.4)] sm:px-10 sm:py-5 sm:text-xl"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              <Wrench className="h-6 w-6" />
              <span>Começar a Consertar</span>
              <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <div className="mt-32 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:max-w-6xl w-full">
          {[
            { icon: Smartphone, title: 'Gestão de O.S.', desc: 'Acompanhe cada etapa do reparo com status automatizados.' },
            { icon: Zap, title: 'Vendas & PDV', desc: 'Venda acessórios e serviços com controle total de caixa.' },
            { icon: ShieldCheck, title: 'Nuvem Segura', desc: 'Seus dados sincronizados e protegidos com tecnologia Firebase.' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="group rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-blue-500/30 hover:bg-white/10"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-white">{feature.title}</h3>
              <p className="mt-3 text-lg text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-bold">{settings.name}</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 {settings.name}. Desenvolvido para alta performance técnica.
          </p>
        </div>
      </footer>
    </div>
  );
}
