import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Storefront, Product } from '../types';
import { 
  Search, 
  Package, 
  MessageCircle, 
  ShoppingCart, 
  ChevronRight, 
  ChevronLeft,
  X,
  Loader2,
  ArrowLeft,
  Share2,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export default function PublicStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isStorefrontDescriptionExpanded, setIsStorefrontDescriptionExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const DEFAULT_THEME = {
    primaryColor: '#0f172a',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    buttonColor: '#2563eb',
    buttonTextColor: '#ffffff'
  };

  const renderDescription = (desc: string) => {
    const maxLength = 120; // Adjusted threshold for "See More"
    const shouldTruncate = desc.length > maxLength && !isDescriptionExpanded;
    const content = shouldTruncate ? `${desc.substring(0, maxLength)}...` : desc;
    
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Descrição</h4>
        <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
        </div>
        {desc.length > maxLength && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsDescriptionExpanded(!isDescriptionExpanded);
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors mt-1 flex items-center gap-1"
          >
            {isDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
            <ChevronRight className={`h-3 w-3 transition-transform ${isDescriptionExpanded ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!slug) return;

    const fetchStorefront = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'storefronts'), where('slug', '==', slug), where('active', '==', true));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Vitrine não encontrada ou inativa.');
          setLoading(false);
          return;
        }

        const sfData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Storefront;
        setStorefront(sfData);

        // Fetch products
        if (sfData.productIds && sfData.productIds.length > 0) {
          // Firestore 'in' operator is limited to 10 items, but for now we'll assume it's small or fetch all and filter
          // To be safe and support more products, we fetch all and filter client-side if needed, 
          // but usually storefronts have a curated list.
          const productsQuery = query(collection(db, 'products'));
          const productsSnapshot = await getDocs(productsQuery);
          const allProducts: Product[] = [];
          productsSnapshot.forEach(doc => {
            if (sfData.productIds.includes(doc.id)) {
              allProducts.push({ id: doc.id, ...doc.data() } as Product);
            }
          });
          setProducts(allProducts);
        }
      } catch (err) {
        console.error('Error fetching storefront:', err);
        setError('Ocorreu um erro ao carregar a vitrine.');
      } finally {
        setLoading(false);
      }
    };

    fetchStorefront();
  }, [slug]);

  useEffect(() => {
    if (selectedProduct) {
      window.scrollTo(0, 0);
    }
  }, [selectedProduct]);

  const handleWhatsApp = (product?: Product) => {
    if (!storefront?.whatsappNumber) return;
    
    // Sanitize number: remove non-digits
    const sanitizedNumber = storefront.whatsappNumber.replace(/\D/g, '');
    
    let message = `Olá! Vi sua vitrine "${storefront.name}" e gostaria de mais informações.`;
    if (product) {
      message = `Olá! Tenho interesse no produto: *${product.name}* (R$ ${product.price.toFixed(2)}) que vi na sua vitrine "${storefront.name}".`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${sanitizedNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: storefront?.name || 'Minha Vitrine',
        text: storefront?.description || 'Confira meus produtos!',
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !storefront) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-50">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div>
          <Package className="absolute inset-0 m-auto h-6 w-6 text-slate-400 animate-pulse" />
        </div>
        <div className="space-y-1">
          <p className="text-slate-900 font-bold">Carregando Vitrine</p>
          <p className="text-slate-500 text-sm">Preparando os melhores produtos para você...</p>
        </div>
      </div>
    );
  }

  if (error || (!loading && !storefront)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-slate-50">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Ops!</h1>
          <p className="text-slate-600 max-w-xs mx-auto">{error || 'Não conseguimos encontrar a vitrine que você está procurando. Verifique o link e tente novamente.'}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>
          <a href="/" className="btn btn-secondary w-full">
            Voltar para o Início
          </a>
        </div>
      </div>
    );
  }

  const storefrontPlaceholder = storefront || {
    name: 'Carregando...',
    description: 'Buscando informações da vitrine...',
    theme: DEFAULT_THEME
  };

  const currentTheme = { 
    ...DEFAULT_THEME, 
    ...(storefront?.theme || {}) 
  };

  return (
    <div 
      className="min-h-screen pb-24 transition-colors duration-500"
      style={{ backgroundColor: currentTheme.backgroundColor, color: currentTheme.textColor }}
    >
      {/* Header Section */}
      <header 
        className="relative pt-12 pb-20 px-6 text-center space-y-6 overflow-hidden shadow-2xl"
        style={{ backgroundColor: currentTheme.primaryColor, color: '#ffffff' }}
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white blur-3xl"></div>
        </div>

        <div className="relative z-10 space-y-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl overflow-hidden"
          >
            {storefront?.logoUrl ? (
              <img src={storefront.logoUrl} alt={storefront.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Package className="h-12 w-12" />
            )}
          </motion.div>

          <div className="space-y-2">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl font-black tracking-tight"
            >
              {storefrontPlaceholder.name}
            </motion.h1>
            {storefrontPlaceholder.description && (
              <div className="space-y-2">
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className={`text-sm opacity-80 max-w-md mx-auto leading-relaxed whitespace-pre-wrap ${!isStorefrontDescriptionExpanded ? 'line-clamp-3' : ''}`}
                >
                  {storefrontPlaceholder.description}
                </motion.p>
                {storefrontPlaceholder.description.length > 150 && (
                  <button 
                    onClick={() => setIsStorefrontDescriptionExpanded(!isStorefrontDescriptionExpanded)}
                    className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 mx-auto"
                  >
                    {isStorefrontDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
                    <ChevronRight className={`h-3 w-3 transition-transform ${isStorefrontDescriptionExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button 
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Compartilhar'}
            </button>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0]">
          <svg className="relative block w-full h-[40px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C58.47,105.15,123.3,110.15,189.3,105.15c66-5,123.3-25.15,132.09-48.71Z" style={{ fill: currentTheme.backgroundColor }}></path>
          </svg>
        </div>
      </header>

      {/* Search & Filter */}
      <div className="px-6 -mt-8 relative z-20">
        <div className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-0 bg-black/5 blur-xl group-focus-within:bg-blue-500/10 transition-all"></div>
          <div className="relative flex items-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-1">
            <Search className="ml-4 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="O que você está procurando?"
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl mr-1"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-6 mt-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800/50 rounded-3xl p-4 space-y-4 animate-pulse border border-slate-100 dark:border-slate-700/50">
                <div className="aspect-square bg-slate-100 dark:bg-slate-900/50 rounded-2xl"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-900/50 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-900/50 rounded w-1/2"></div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="h-6 bg-slate-100 dark:bg-slate-900/50 rounded w-1/3"></div>
                  <div className="h-8 w-8 bg-slate-100 dark:bg-slate-900/50 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.map((product, idx) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setSelectedProduct(product);
                  setCurrentImageIndex(0);
                  setIsDescriptionExpanded(false);
                }}
                className="group bg-white dark:bg-slate-800 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer flex flex-col"
              >
                <div className="aspect-square bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                    {product.category && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="font-black text-lg text-slate-900 dark:text-white">
                      R$ {product.price.toFixed(2)}
                    </p>
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                      style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Search className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nenhum produto encontrado</h3>
              <p className="text-slate-500">Tente buscar por outro termo ou limpe os filtros.</p>
            </div>
            <button 
              onClick={() => setSearchTerm('')}
              className="text-blue-600 font-bold hover:underline"
            >
              Limpar busca
            </button>
          </div>
        )}
      </main>

      {/* Floating WhatsApp Button */}
      {storefront?.whatsappNumber && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleWhatsApp()}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 transition-colors"
          style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
        >
          <MessageCircle className="h-8 w-8" />
          <span className="absolute -top-2 -right-2 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 border-2 border-white" style={{ backgroundColor: currentTheme.buttonColor }}></span>
          </span>
        </motion.button>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh]"
            >
              <div className="w-full sm:w-1/2 aspect-square sm:aspect-auto bg-slate-100 dark:bg-slate-800 relative group/carousel">
                {selectedProduct.imageUrls && selectedProduct.imageUrls.length > 0 ? (
                  <div className="relative w-full h-full overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentImageIndex}
                        src={selectedProduct.imageUrls[currentImageIndex]}
                        alt={`${selectedProduct.name} - ${currentImageIndex + 1}`}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                    
                    {selectedProduct.imageUrls.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) => (prev === 0 ? selectedProduct.imageUrls!.length - 1 : prev - 1));
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) => (prev === selectedProduct.imageUrls!.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {selectedProduct.imageUrls.map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                i === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : selectedProduct.imageUrl ? (
                  <img 
                    src={selectedProduct.imageUrl} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Package className="h-20 w-20" />
                  </div>
                )}
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors sm:hidden"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
              </div>

              <div className="w-full sm:w-1/2 p-8 flex flex-col justify-between space-y-8 overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      {selectedProduct.category && (
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                          {selectedProduct.category}
                        </span>
                      )}
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                        {selectedProduct.name}
                      </h2>
                    </div>
                    <button 
                      onClick={() => setSelectedProduct(null)}
                      className="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <p className="text-3xl font-black text-slate-900 dark:text-white">
                    R$ {selectedProduct.price.toFixed(2)}
                  </p>

                  {selectedProduct.description && renderDescription(selectedProduct.description)}
                </div>

                <div className="space-y-3 pt-6">
                  <button 
                    onClick={() => handleWhatsApp(selectedProduct)}
                    className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Tenho Interesse
                  </button>
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="w-full py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 py-12 px-6 text-center border-t border-black/5">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Package className="h-5 w-5" />
            <span className="font-bold text-sm uppercase tracking-widest">{storefrontPlaceholder.name}</span>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
