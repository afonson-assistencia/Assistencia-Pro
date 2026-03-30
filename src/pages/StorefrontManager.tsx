import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';
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
  const { settings } = useSettings();
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [editingStorefront, setEditingStorefront] = useState<Storefront | null>(null);
  const [selectedProductForImage, setSelectedProductForImage] = useState<Product | null>(null);

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
                {editingStorefront && (
                  <a 
                    href={`/s/${editingStorefront.slug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visualizar Vitrine
                  </a>
                )}
                <button 
                  onClick={handleSubmit} 
                  disabled={actionLoading.submit}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                >
                  {actionLoading.submit ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
              <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
                <div className="grid lg:grid-cols-12 gap-8">
                  {/* Left Column: Basic Info & Theme (7 cols) */}
                  <div className="lg:col-span-7 space-y-8">
                    <section className="card p-6 space-y-6">
                      <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                          <Layout className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Informações da Vitrine</h3>
                          <p className="text-xs text-[var(--text-muted)]">Configure os detalhes principais da sua página.</p>
                        </div>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="sm:col-span-2">
                          <label className="text-sm font-semibold text-[var(--text-main)] mb-1.5 block">Nome da Vitrine</label>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="Ex: Minha Loja de Acessórios"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-semibold text-[var(--text-main)] mb-1.5 block">Link Personalizado</label>
                          <div className="flex items-center">
                            <span className="bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-l-xl border border-r-0 border-[var(--border-color)] text-sm text-[var(--text-muted)] font-medium">/s/</span>
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
                          <label className="text-sm font-semibold text-[var(--text-main)] mb-1.5 block">WhatsApp</label>
                          <div className="relative">
                            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                            <input 
                              type="text" 
                              className="input pl-10" 
                              placeholder="Ex: 559887327719"
                              value={whatsappNumber}
                              onChange={(e) => setWhatsappNumber(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-sm font-semibold text-[var(--text-main)] mb-1.5 block">Descrição da Vitrine</label>
                          <textarea 
                            className="input min-h-[100px] py-3" 
                            placeholder="Conte um pouco sobre sua loja, promoções ou informações importantes..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-sm font-semibold text-[var(--text-main)] mb-1.5 block flex items-center justify-between">
                            <span>URL da Logo (Opcional)</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Cole o link da sua logo aqui</span>
                          </label>
                          <div className="flex gap-3">
                            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-[var(--border-color)]">
                              {logoUrl || settings.logoUrl ? (
                                <img src={logoUrl || settings.logoUrl} alt="Logo Preview" className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="text-slate-400 font-black text-xl">{name?.charAt(0).toUpperCase() || settings.name?.charAt(0).toUpperCase() || 'V'}</div>
                              )}
                            </div>
                            <input 
                              type="url" 
                              className="input flex-1" 
                              placeholder="https://exemplo.com/logo.png"
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="card p-6 space-y-6">
                      <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                          <Palette className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Identidade Visual</h3>
                          <p className="text-xs text-[var(--text-muted)]">Personalize as cores para combinar com sua marca.</p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--text-muted)]">Cor Principal</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              className="h-12 w-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 shadow-sm"
                              value={theme.primaryColor}
                              onChange={(e) => setTheme({...theme, primaryColor: e.target.value})}
                            />
                            <input type="text" className="input text-sm h-12 font-mono uppercase" value={theme.primaryColor} onChange={(e) => setTheme({...theme, primaryColor: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--text-muted)]">Cor dos Botões</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              className="h-12 w-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 shadow-sm"
                              value={theme.buttonColor}
                              onChange={(e) => setTheme({...theme, buttonColor: e.target.value})}
                            />
                            <input type="text" className="input text-sm h-12 font-mono uppercase" value={theme.buttonColor} onChange={(e) => setTheme({...theme, buttonColor: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--text-muted)]">Fundo da Página</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              className="h-12 w-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 shadow-sm"
                              value={theme.backgroundColor}
                              onChange={(e) => setTheme({...theme, backgroundColor: e.target.value})}
                            />
                            <input type="text" className="input text-sm h-12 font-mono uppercase" value={theme.backgroundColor} onChange={(e) => setTheme({...theme, backgroundColor: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--text-muted)]">Cor do Texto</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              className="h-12 w-12 rounded-xl cursor-pointer border-2 border-white dark:border-slate-700 shadow-sm"
                              value={theme.textColor}
                              onChange={(e) => setTheme({...theme, textColor: e.target.value})}
                            />
                            <input type="text" className="input text-sm h-12 font-mono uppercase" value={theme.textColor} onChange={(e) => setTheme({...theme, textColor: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Product Selection (5 cols) */}
                  <div className="lg:col-span-5 space-y-8">
                    <section className="card p-6 flex flex-col min-h-[600px] lg:h-[calc(100vh-200px)]">
                      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">Catálogo de Produtos</h3>
                            <p className="text-xs text-[var(--text-muted)]">Selecione os itens para esta vitrine.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full shadow-sm">
                            {selectedProductIds.length} selecionados
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                        <input 
                          type="text" 
                          className="input pl-10 h-11 text-sm bg-slate-50 dark:bg-slate-800/50 border-none" 
                          placeholder="Buscar por nome ou categoria..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {filteredProducts.map(product => {
                          const isSelected = selectedProductIds.includes(product.id);
                          return (
                            <div
                              key={product.id}
                              className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all duration-200 ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm'
                                  : 'border-[var(--border-color)] hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div 
                                onClick={() => toggleProduct(product.id)}
                                className="flex-1 flex items-center gap-4 cursor-pointer min-w-0"
                              >
                                <div className="h-14 w-14 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Package className="h-7 w-7 text-slate-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-[var(--text-main)] truncate">{product.name}</p>
                                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">R$ {product.price.toFixed(2)}</p>
                                  {product.category && (
                                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{product.category}</span>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="bg-blue-600 rounded-full p-1 shadow-lg shadow-blue-600/20">
                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Manage Image Button - More Professional */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProductForImage(product);
                                  setEditingProductImageUrl(product.imageUrl || '');
                                  setIsImageModalOpen(true);
                                }}
                                className={`p-2.5 rounded-xl transition-all ${
                                  isSelected 
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm hover:bg-blue-600 hover:text-white' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title="Adicionar/Editar Imagem"
                              >
                                <Palette className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          );
                        })}
                        
                        {filteredProducts.length === 0 && (
                          <div className="py-12 text-center space-y-3">
                            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                              <Search className="h-6 w-6" />
                            </div>
                            <p className="text-sm text-[var(--text-muted)]">Nenhum produto encontrado.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Image Modal */}
      <AnimatePresence>
        {isImageModalOpen && selectedProductForImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                    <Palette className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Gerenciar Imagem</h3>
                    <p className="text-xs text-slate-500">Adicione uma URL para a imagem do produto.</p>
                  </div>
                </div>
                <button onClick={() => setIsImageModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="h-24 w-24 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                    {editingProductImageUrl ? (
                      <img src={editingProductImageUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="h-10 w-10 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{selectedProductForImage.name}</p>
                    <p className="text-blue-600 dark:text-blue-400 font-semibold">R$ {selectedProductForImage.price.toFixed(2)}</p>
                    {selectedProductForImage.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {selectedProductForImage.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">URL da Imagem</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="url" 
                      className="input pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20" 
                      placeholder="https://exemplo.com/imagem-do-produto.jpg"
                      value={editingProductImageUrl}
                      onChange={(e) => setEditingProductImageUrl(e.target.value)}
                    />
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3">
                    <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded text-blue-600 dark:text-blue-400 h-fit">
                      <Settings2 className="h-3 w-3" />
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      Dica: Use links diretos de imagens (terminando em .jpg, .png ou .webp). Você pode hospedar suas imagens em serviços como Imgur ou PostImages.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button 
                  onClick={() => setIsImageModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    await handleUpdateProductImage(selectedProductForImage.id);
                    setIsImageModalOpen(false);
                  }}
                  disabled={actionLoading[`update_img_${selectedProductForImage.id}`]}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading[`update_img_${selectedProductForImage.id}`] ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Salvar Imagem
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
