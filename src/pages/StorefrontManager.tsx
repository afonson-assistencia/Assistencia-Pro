import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Storefront, Product, StorefrontTheme } from '../types';
import { useAuth } from '../App';
import { 
  Plus, 
  Search, 
  Package, 
  X, 
  CheckCircle2, 
  Loader2, 
  Palette, 
  Layout, 
  MessageCircle, 
  ExternalLink, 
  Copy, 
  Trash2, 
  Eye, 
  ChevronRight,
  Globe,
  Settings2,
  Smartphone,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_THEME: StorefrontTheme = {
  primaryColor: '#0f172a',
  secondaryColor: '#64748b',
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  buttonColor: '#2563eb',
  buttonTextColor: '#ffffff'
};

export default function StorefrontManager() {
  const { user, profile } = useAuth();
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStorefront, setEditingStorefront] = useState<Storefront | null>(null);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [theme, setTheme] = useState<StorefrontTheme>(DEFAULT_THEME);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductImageUrl, setEditingProductImageUrl] = useState('');

  useEffect(() => {
    setLoading(true);
    
    const qStorefronts = query(collection(db, 'storefronts'), orderBy('createdAt', 'desc'));
    const unsubscribeStorefronts = onSnapshot(qStorefronts, (snap) => {
      const list: Storefront[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Storefront));
      setStorefronts(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'storefronts');
      setError('Erro ao carregar vitrines.');
      setLoading(false);
    });

    const qProducts = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snap) => {
      const list: Product[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    return () => {
      unsubscribeStorefronts();
      unsubscribeProducts();
    };
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const resetForm = () => {
    setEditingStorefront(null);
    setName('');
    setSlug('');
    setDescription('');
    setWhatsappNumber('');
    setLogoUrl('');
    setTheme(DEFAULT_THEME);
    setSelectedProductIds([]);
  };

  const openModal = (sf?: Storefront) => {
    if (sf) {
      setEditingStorefront(sf);
      setName(sf.name);
      setSlug(sf.slug);
      setDescription(sf.description || '');
      setWhatsappNumber(sf.whatsappNumber || '');
      setLogoUrl(sf.logoUrl || '');
      setTheme(sf.theme || DEFAULT_THEME);
      setSelectedProductIds(sf.productIds || []);
    } else {
      resetForm();
    }
    setEditingProductId(null);
    setEditingProductImageUrl('');
    setIsModalOpen(true);
  };

  const handleUpdateProductImage = async (productId: string) => {
    if (!editingProductImageUrl) return;
    setActionLoading(prev => ({ ...prev, [`update_img_${productId}`]: true }));
    try {
      await updateDoc(doc(db, 'products', productId), {
        imageUrl: editingProductImageUrl,
        updatedAt: serverTimestamp()
      });
      setSuccess('Imagem do produto atualizada!');
      setEditingProductId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${productId}`);
      setError('Erro ao atualizar imagem.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`update_img_${productId}`]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return setError('Slug é obrigatório');
    
    // Check if slug is unique
    const slugExists = storefronts.find(sf => sf.slug === slug && sf.id !== editingStorefront?.id);
    if (slugExists) return setError('Este link já está em uso.');

    setActionLoading(prev => ({ ...prev, submit: true }));
    try {
      const sfData = {
        name,
        slug: slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description,
        whatsappNumber,
        logoUrl,
        theme,
        productIds: selectedProductIds,
        active: true,
        ownerId: user?.uid,
        updatedAt: serverTimestamp(),
      };

      if (editingStorefront) {
        await updateDoc(doc(db, 'storefronts', editingStorefront.id), sfData);
        setSuccess('Vitrine atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'storefronts'), {
          ...sfData,
          createdAt: serverTimestamp(),
        });
        setSuccess('Vitrine criada com sucesso!');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'storefronts');
      setError('Erro ao salvar vitrine.');
    } finally {
      setActionLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta vitrine?')) return;
    setActionLoading(prev => ({ ...prev, [`delete_${id}`]: true }));
    try {
      await deleteDoc(doc(db, 'storefronts', id));
      setSuccess('Vitrine excluída com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `storefronts/${id}`);
      setError('Erro ao excluir vitrine.');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${id}`]: false }));
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url);
    setSuccess('Link copiado!');
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">Vitrines Personalizadas</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">Crie links para compartilhar seus produtos e serviços.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nova Vitrine
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">Carregando vitrines...</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((sf) => (
            <div key={sf.id} className="card p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-[var(--text-main)]">{sf.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Globe className="h-3.5 w-3.5" />
                    <span>/s/{sf.slug}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(sf)}
                    className="p-2 text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(sf.id)}
                    disabled={actionLoading[`delete_${sf.id}`]}
                    className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    {actionLoading[`delete_${sf.id}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-sm text-[var(--text-muted)] line-clamp-2">
                {sf.description || 'Sem descrição.'}
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-[var(--border-color)]">
                <button 
                  onClick={() => copyLink(sf.slug)}
                  className="flex-1 btn btn-secondary gap-2 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Link
                </button>
                <a 
                  href={`/s/${sf.slug}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 btn btn-primary gap-2 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver Online
                </a>
              </div>
            </div>
          ))}

          {storefronts.length === 0 && (
            <div className="col-span-full card p-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-[var(--text-muted)]">
                <Layout className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--text-main)]">Nenhuma vitrine criada</h3>
                <p className="text-[var(--text-muted)]">Comece criando sua primeira vitrine personalizada.</p>
              </div>
              <button onClick={() => openModal()} className="btn btn-primary gap-2">
                <Plus className="h-4 w-4" />
                Criar Agora
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Screen Modal for Editor */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col"
          >
            {/* Header */}
            <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X className="h-6 w-6" />
                </button>
                <h2 className="text-xl font-bold">{editingStorefront ? 'Editar Vitrine' : 'Nova Vitrine'}</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  <button 
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-2 rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  >
                    <Smartphone className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-2 rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                </div>
                <button 
                  onClick={handleSubmit} 
                  disabled={actionLoading.submit}
                  className="btn btn-primary px-8"
                >
                  {actionLoading.submit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Vitrine'}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Editor Sidebar */}
              <div className="w-full lg:w-[450px] bg-[var(--bg-card)] border-r border-[var(--border-color)] overflow-y-auto p-6 space-y-8">
                {/* Basic Info */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Layout className="h-5 w-5" />
                    <h3 className="font-bold">Informações Básicas</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--text-muted)]">Nome da Vitrine</label>
                      <input 
                        type="text" 
                        className="input mt-1" 
                        placeholder="Ex: Minha Loja de Acessórios"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text-muted)]">Link Personalizado (Slug)</label>
                      <div className="flex items-center mt-1">
                        <span className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-l-lg border border-r-0 border-[var(--border-color)] text-sm text-[var(--text-muted)]">/s/</span>
                        <input 
                          type="text" 
                          className="input rounded-l-none" 
                          placeholder="minha-loja"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text-muted)]">Descrição</label>
                      <textarea 
                        className="input mt-1 min-h-[80px]" 
                        placeholder="Conte um pouco sobre sua loja..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text-muted)]">WhatsApp para Contato</label>
                      <div className="relative mt-1">
                        <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                        <input 
                          type="text" 
                          className="input pl-10" 
                          placeholder="Ex: 559887327719"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Insira apenas números (Ex: 559887327719). Inclua o código do país (55) e o DDD.
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[var(--text-muted)]">URL da Logo (Opcional)</label>
                      <input 
                        type="url" 
                        className="input mt-1" 
                        placeholder="https://exemplo.com/logo.png"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                {/* Theme Customization */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Palette className="h-5 w-5" />
                    <h3 className="font-bold">Personalização de Cores</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)]">Cor Principal</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="color" 
                          className="h-10 w-10 rounded-lg cursor-pointer border-none"
                          value={theme.primaryColor}
                          onChange={(e) => setTheme({...theme, primaryColor: e.target.value})}
                        />
                        <input type="text" className="input text-xs h-10" value={theme.primaryColor} onChange={(e) => setTheme({...theme, primaryColor: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)]">Cor do Botão</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="color" 
                          className="h-10 w-10 rounded-lg cursor-pointer border-none"
                          value={theme.buttonColor}
                          onChange={(e) => setTheme({...theme, buttonColor: e.target.value})}
                        />
                        <input type="text" className="input text-xs h-10" value={theme.buttonColor} onChange={(e) => setTheme({...theme, buttonColor: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)]">Fundo da Página</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="color" 
                          className="h-10 w-10 rounded-lg cursor-pointer border-none"
                          value={theme.backgroundColor}
                          onChange={(e) => setTheme({...theme, backgroundColor: e.target.value})}
                        />
                        <input type="text" className="input text-xs h-10" value={theme.backgroundColor} onChange={(e) => setTheme({...theme, backgroundColor: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)]">Cor do Texto</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="color" 
                          className="h-10 w-10 rounded-lg cursor-pointer border-none"
                          value={theme.textColor}
                          onChange={(e) => setTheme({...theme, textColor: e.target.value})}
                        />
                        <input type="text" className="input text-xs h-10" value={theme.textColor} onChange={(e) => setTheme({...theme, textColor: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Product Selection */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-600">
                      <Package className="h-5 w-5" />
                      <h3 className="font-bold">Produtos Selecionados</h3>
                    </div>
                    <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                      {selectedProductIds.length}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                    <input 
                      type="text" 
                      className="input pl-10 h-10 text-sm" 
                      placeholder="Buscar produtos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          selectedProductIds.includes(product.id)
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'border-[var(--border-color)] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-bold truncate">{product.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">R$ {product.price.toFixed(2)}</p>
                        </div>
                        {selectedProductIds.includes(product.id) && (
                          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Preview Area */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 p-4 sm:p-8 flex items-center justify-center overflow-hidden">
                <div className={`bg-white shadow-2xl transition-all duration-500 overflow-hidden flex flex-col ${
                  previewMode === 'mobile' ? 'w-[375px] h-[667px] rounded-[3rem] border-[8px] border-slate-800' : 'w-full h-full rounded-xl'
                }`}>
                  {/* Mock Browser/Phone Header */}
                  <div className="bg-slate-800 p-2 flex justify-center">
                    <div className="w-20 h-1 bg-slate-700 rounded-full"></div>
                  </div>

                  {/* Storefront Content Preview */}
                  <div 
                    className="flex-1 overflow-y-auto"
                    style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
                  >
                    {/* Header */}
                    <div className="relative pt-12 pb-20 px-6 text-center space-y-6 overflow-hidden" style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}>
                      {/* Decorative Background Elements */}
                      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white blur-3xl"></div>
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white blur-3xl"></div>
                      </div>

                      <div className="relative z-10 space-y-6">
                        <div className="mx-auto w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl overflow-hidden">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="h-10 w-10" />
                          )}
                        </div>
                        <h1 className="text-2xl font-bold">{name || 'Nome da Loja'}</h1>
                        <div className="space-y-2">
                          <p className={`text-sm opacity-80 whitespace-pre-wrap ${description.length > 150 ? 'line-clamp-3' : ''}`}>{description || 'Sua descrição aparecerá aqui.'}</p>
                          {description && description.length > 150 && (
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-1 mx-auto justify-center">
                              Ver mais <ChevronRight className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Wave Divider */}
                      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0]">
                        <svg className="relative block w-full h-[40px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C58.47,105.15,123.3,110.15,189.3,105.15c66-5,123.3-25.15,132.09-48.71Z" style={{ fill: theme.backgroundColor }}></path>
                        </svg>
                      </div>
                    </div>

                    {/* Search Mock */}
                    <div className="p-4 sticky top-0 z-10" style={{ backgroundColor: theme.backgroundColor }}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                        <input 
                          disabled
                          type="text" 
                          className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/50 text-sm"
                          placeholder="Buscar produtos..."
                        />
                      </div>
                    </div>

                    {/* Products Grid */}
                    <div className="p-4 grid grid-cols-2 gap-4">
                      {selectedProducts.length > 0 ? (
                        selectedProducts.map(p => (
                          <div key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
                            <div className="aspect-square bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="h-8 w-8 text-slate-300" />
                              )}
                            </div>
                            <div className="p-3 space-y-1">
                              <h4 className="text-sm font-bold truncate">{p.name}</h4>
                              <p className="text-xs opacity-60">R$ {p.price.toFixed(2)}</p>
                              <button 
                                disabled
                                className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
                              >
                                Comprar
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center opacity-40">
                          <Package className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">Selecione produtos para ver aqui</p>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Button Mock */}
                    {whatsappNumber && (
                      <div className="fixed bottom-8 right-8">
                        <div className="w-14 h-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center text-white">
                          <MessageCircle className="h-7 w-7" />
                        </div>
                      </div>
                    )}
                    {/* Selected Products Images */}
                    {selectedProducts.length > 0 && (
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                          <Package className="h-4 w-4" />
                          <span>Imagens dos Produtos Selecionados</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {selectedProducts.map(product => (
                            <div key={product.id} className="flex flex-col gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Package className="h-5 w-5 text-slate-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold truncate">{product.name}</p>
                                  <p className="text-[10px] text-[var(--text-muted)]">R$ {product.price.toFixed(2)}</p>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setEditingProductId(product.id);
                                    setEditingProductImageUrl(product.imageUrl || '');
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                  <Palette className="h-4 w-4" />
                                </button>
                              </div>
                              
                              {editingProductId === product.id && (
                                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                  <input 
                                    type="url"
                                    placeholder="URL da Imagem"
                                    className="input text-xs"
                                    value={editingProductImageUrl}
                                    onChange={(e) => setEditingProductImageUrl(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateProductImage(product.id)}
                                      disabled={actionLoading[`update_img_${product.id}`]}
                                      className="btn btn-primary py-1.5 text-[10px] flex-1"
                                    >
                                      {actionLoading[`update_img_${product.id}`] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => setEditingProductId(null)}
                                      className="btn btn-secondary py-1.5 text-[10px] flex-1"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
