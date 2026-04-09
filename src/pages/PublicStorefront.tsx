import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';
import { Storefront, Product, Category, DeliveryLocation } from '../types';
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
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { toast, Toaster } from 'sonner';
import { dbLocal } from '../db';
import { serverTimestamp } from 'firebase/firestore';

interface CartItem extends Product {
  quantity: number;
}

export default function PublicStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSettings();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isStorefrontDescriptionExpanded, setIsStorefrontDescriptionExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation | null>(null);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem(`cart_${slug}`);
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error parsing cart:', e);
      }
    }
  }, [slug]);

  // Save cart to localStorage
  useEffect(() => {
    if (slug) {
      localStorage.setItem(`cart_${slug}`, JSON.stringify(cart));
    }
  }, [cart, slug]);

  const addToCart = (product: Product) => {
    const isExisting = cart.some(item => item.id === product.id);
    
    if (isExisting) {
      toast.success(`Mais um ${product.name} adicionado!`);
    } else {
      toast.success(`${product.name} adicionado ao carrinho!`);
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
    toast.error('Produto removido do carrinho');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = cartTotal;
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const copyStorefrontLink = () => {
    const url = window.location.href.split('?')[0];
    navigator.clipboard.writeText(url);
    toast.success('Link da vitrine copiado!', {
      description: 'Agora você pode compartilhar com seus clientes.'
    });
  };

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

    const fetchStorefrontAndSync = async () => {
      setLoading(true);
      try {
        // 1. Fetch Storefront
        const q = query(collection(db, 'storefronts'), where('slug', '==', slug), where('active', '==', true));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Vitrine não encontrada ou inativa.');
          setLoading(false);
          return;
        }

        const sfData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Storefront;
        setStorefront(sfData);

        // 2. Load from Local DB first
        const localProducts = await dbLocal.products.toArray();
        const localCategories = await dbLocal.categories.toArray();
        
        // Filter products that belong to this storefront
        const sfProducts = localProducts.filter(p => sfData.productIds?.includes(p.id));
        
        if (sfProducts.length > 0) {
          setProducts(sfProducts);
          setCategories(localCategories);
          setLoading(false);
        }

        // 3. Check for updates (Smart Sync)
        const lastSync = localStorage.getItem(`last_sync_${slug}`);
        const now = Date.now();
        
        // Sync if never synced or last sync was > 5 minutes ago
        if (!lastSync || now - parseInt(lastSync) > 5 * 60 * 1000) {
          setIsSyncing(true);
          
          // Fetch Categories
          const catsSnap = await getDocs(collection(db, 'categories'));
          const catsList: Category[] = [];
          catsSnap.forEach(doc => catsList.push({ id: doc.id, ...doc.data() } as Category));
          
          // Update local categories
          await dbLocal.categories.clear();
          await dbLocal.categories.bulkAdd(catsList);
          setCategories(catsList);

          // Fetch Products
          const productsQuery = query(collection(db, 'products'));
          const productsSnapshot = await getDocs(productsQuery);
          const allProducts: Product[] = [];
          productsSnapshot.forEach(doc => {
            allProducts.push({ id: doc.id, ...doc.data() } as Product);
          });

          // Update local products
          await dbLocal.products.clear();
          await dbLocal.products.bulkAdd(allProducts);
          
          // Filter for this storefront
          const filteredSfProducts = allProducts.filter(p => sfData.productIds?.includes(p.id));
          setProducts(filteredSfProducts);
          
          localStorage.setItem(`last_sync_${slug}`, now.toString());
          setIsSyncing(false);
        }

        // Fetch Delivery Locations
        const deliverySnap = await getDocs(collection(db, 'deliveryLocations'));
        const deliveryList: DeliveryLocation[] = [];
        deliverySnap.forEach(doc => deliveryList.push({ id: doc.id, ...doc.data() } as DeliveryLocation));
        setDeliveryLocations(deliveryList);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching storefront:', err);
        setError('Ocorreu um erro ao carregar a vitrine.');
        setLoading(false);
      }
    };

    fetchStorefrontAndSync();
  }, [slug]);

  useEffect(() => {
    if (storefront && products.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product');
      if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
          setSelectedProduct(product);
        }
      }
    }
  }, [storefront, products]);

  useEffect(() => {
    if (selectedProduct) {
      window.scrollTo(0, 0);
    }
  }, [selectedProduct]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProduct(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedProduct]);

  const handleWhatsApp = (product?: Product) => {
    if (!storefront?.whatsappNumber) return;
    
    // Sanitize number: remove non-digits
    const sanitizedNumber = storefront.whatsappNumber.replace(/\D/g, '');
    
    let message = '';
    if (product) {
      message = `Olá! Vi seu produto na vitrine "${storefront.name}" e tenho interesse:\n\n*${product.name}*\nPreço: R$ ${product.price.toFixed(2)}\nLink: ${window.location.origin}/s/${slug}?product=${product.id}`;
    } else if (cart.length > 0) {
      if (!customerName || !customerAddress) {
        toast.error('Por favor, preencha seus dados de entrega.');
        return;
      }

      message = `Olá! Gostaria de fazer um pedido na sua vitrine "${storefront.name}":\n\n`;
      message += `*Cliente:* ${customerName}\n`;
      message += `*Endereço:* ${customerAddress}\n\n`;
      message += `*Itens:*\n`;
      cart.forEach(item => {
        message += `• ${item.quantity}x *${item.name}* - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
      });
      message += `\n*Total: R$ ${finalTotal.toFixed(2)}*`;
    } else {
      message = `Olá! Vi sua vitrine "${storefront.name}" e gostaria de saber mais sobre seus produtos.`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${sanitizedNumber}?text=${encodedMessage}`;

    const handleOrder = async () => {
      // Save order to Firestore
      try {
        await addDoc(collection(db, 'storefrontOrders'), {
          storefrontId: storefront.id,
          customerName,
          customerAddress,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          subtotal: cartTotal,
          shipping: 0,
          total: finalTotal,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        // Clear cart
        setCart([]);
        localStorage.removeItem(`cart_${slug}`);
        setIsCartOpen(false);
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
        toast.success('Pedido enviado com sucesso!');
      } catch (err) {
        console.error('Error saving order:', err);
        toast.error('Erro ao processar pedido. Tente novamente.');
      }
    };

    handleOrder();
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const selectedCat = categories.find(c => c.id === selectedCategory);
    const matchesCategory = !selectedCategory || 
      p.categoryId === selectedCategory || 
      p.category === selectedCategory ||
      (selectedCat && (
        p.category?.toLowerCase() === selectedCat.name.toLowerCase() ||
        p.categoryId?.toLowerCase() === selectedCat.name.toLowerCase()
      ));
    
    return matchesSearch && matchesCategory;
  });


  const storefrontPlaceholder = storefront || {
    name: '',
    description: '',
    theme: DEFAULT_THEME
  };

  const currentTheme = { 
    ...DEFAULT_THEME, 
    ...(storefront?.theme || {}) 
  };

  if (loading && !storefront) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Carregando vitrine...</p>
      </div>
    );
  }

  if (error && !storefront) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ops! Algo deu errado</h1>
          <p className="text-slate-500 max-w-md mx-auto">{error}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-primary px-8"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: currentTheme.backgroundColor, color: currentTheme.textColor }}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-black/5 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5">
              {storefront?.logoUrl || settings.logoUrl ? (
                <img src={storefront?.logoUrl || settings.logoUrl} alt={storefront?.name || settings.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-sm font-black text-slate-400">{storefront?.name?.charAt(0).toUpperCase() || settings.name?.charAt(0).toUpperCase() || 'V'}</span>
              )}
            </div>
            <h1 className="font-black text-sm text-slate-900 dark:text-white tracking-tight truncate max-w-[150px] sm:max-w-none">{storefrontPlaceholder.name}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white shadow-lg shadow-blue-500/20 transition-all active:scale-90"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Shopping Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Meu Carrinho</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cartCount} itens selecionados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-10 w-10 text-slate-300" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">Seu carrinho está vazio</p>
                      <p className="text-sm text-slate-400">Adicione produtos para fazer seu pedido.</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="btn btn-primary px-8"
                    >
                      Continuar Comprando
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Itens no Carrinho</h3>
                      {cart.map((item) => (
                        <motion.div 
                          layout
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-black/5 dark:border-white/5"
                        >
                          <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden shrink-0 border border-black/5 dark:border-white/5">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{item.name}</h4>
                              <p className="text-xs font-black text-blue-600">R$ {item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-full p-1 border border-black/5 dark:border-white/5">
                                <button 
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <button 
                                onClick={() => removeFromCart(item.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dados de Entrega</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Seu Nome</label>
                          <input 
                            type="text" 
                            placeholder="Como podemos te chamar?"
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-black/5 dark:border-white/5 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
                          <input 
                            type="text" 
                            placeholder="Rua, número, complemento, bairro..."
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-black/5 dark:border-white/5 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-black/5 dark:border-white/5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Total</span>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">R$ {finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleWhatsApp()}
                    className="w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] hover:brightness-110"
                    style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                  >
                    <MessageCircle className="h-6 w-6" />
                    Finalizar no WhatsApp
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />

      {/* Hero Section */}
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
            {storefront?.logoUrl || settings.logoUrl ? (
              <img src={storefront?.logoUrl || settings.logoUrl} alt={storefront?.name || settings.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex flex-col items-center justify-center text-white/40">
                <span className="text-4xl font-black">{storefront?.name?.charAt(0).toUpperCase() || settings.name?.charAt(0).toUpperCase() || 'V'}</span>
              </div>
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
                  className={`text-sm opacity-80 max-w-md mx-auto leading-relaxed whitespace-pre-wrap text-start ${!isStorefrontDescriptionExpanded ? 'line-clamp-3' : ''}`}
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
               onClick={copyStorefrontLink}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Compartilhar'}
            </button>
          </div>
        </div>
      </header>

      {/* Search & Filter */}
      <div className="px-6 -mt-8 relative z-20 space-y-4">
        <div className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-0 bg-black/5 blur-xl group-focus-within:bg-blue-500/10 transition-all"></div>
          <div className="relative flex items-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-1">
            <Search className="ml-4 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="O que você está procurando?"
              className="flex-1 bg-transparent border-none px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus:border-none"
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

        {/* Categories Horizontal Scroll */}
        {categories.length > 0 && (
          <div className="max-w-7xl mx-auto overflow-x-auto no-scrollbar py-2">
            <div className="flex items-center gap-2 px-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  !selectedCategory 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-6 mt-12">
        {filteredProducts.length > 0 ? (
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
                </div>
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2">
                  <div className="space-y-1">
                    {product.category && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                        {product.category}
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">A partir de</span>
                      <p className="font-black text-base sm:text-xl text-slate-900 dark:text-white tracking-tight">
                        <span className="text-xs sm:text-sm mr-0.5">R$</span>
                        {product.price.toFixed(2)}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-lg shadow-blue-500/20"
                      style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-6 max-w-md mx-auto">
            <div className="mx-auto w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 relative">
              <Package className="h-10 w-10" />
              <Search className="h-6 w-6 absolute bottom-2 right-2 text-slate-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Nenhum produto por aqui</h3>
              <p className="text-slate-500 leading-relaxed">
                {searchTerm 
                  ? `Não encontramos nada para "${searchTerm}". Tente buscar por outro termo.`
                  : "Esta vitrine ainda não possui produtos selecionados. Volte em breve para conferir as novidades!"}
              </p>
            </div>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="btn btn-secondary px-8"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl flex flex-col sm:flex-row h-full sm:h-auto sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem]"
            >
        
              <div className="w-full sm:w-1/2 h-[40vh] sm:h-auto bg-slate-50 dark:bg-slate-900/50 relative group/carousel shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800">
                {selectedProduct.imageUrls && selectedProduct.imageUrls.length > 0 ? (
                  <div className="relative w-full h-full overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentImageIndex}
                        src={selectedProduct.imageUrls[currentImageIndex]}
                        alt={`${selectedProduct.name} - ${currentImageIndex + 1}`}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
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
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-xl rounded-full text-white border border-white/20 shadow-lg active:scale-90 transition-transform sm:opacity-0 sm:group-hover/carousel:opacity-100"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) => (prev === selectedProduct.imageUrls!.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-xl rounded-full text-white border border-white/20 shadow-lg active:scale-90 transition-transform sm:opacity-0 sm:group-hover/carousel:opacity-100"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                          {selectedProduct.imageUrls.map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                i === currentImageIndex ? 'bg-white w-6' : 'bg-white/40'
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
                  className="absolute top-4 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors sm:hidden z-50"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 p-6 sm:p-10 overflow-y-auto custom-scrollbar">
                  <div className="space-y-6 sm:space-y-8">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2">
                        {selectedProduct.category && (
                          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                            {selectedProduct.category}
                          </span>
                        )}
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                          {selectedProduct.name}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/s/${slug}?product=${selectedProduct.id}`;
                            if (navigator.share) {
                              navigator.share({
                                title: selectedProduct.name,
                                text: selectedProduct.description,
                                url: url,
                              }).catch(console.error);
                            } else {
                              navigator.clipboard.writeText(url);
                              toast.success('Link do produto copiado!', {
                                description: 'Agora você pode compartilhar este produto.'
                              });
                            }
                          }}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-all active:scale-90"
                          title="Compartilhar Produto"
                        >
                          <Share2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => setSelectedProduct(null)}
                          className="hidden sm:flex p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-all hover:rotate-90"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço à vista</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white">R$</span>
                        <p className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                          {selectedProduct.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">No PIX ou em até 12x no cartão</p>
                    </div>

                    <div className="space-y-4">
                      <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>
                      {selectedProduct.description && renderDescription(selectedProduct.description)}
                    </div>
                  </div>
                </div>

                {/* Sticky Footer / CTA */}
                <div className="p-6 sm:p-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800">
                  <div className="max-w-md mx-auto sm:max-w-none space-y-3 sm:space-y-0">
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => addToCart(selectedProduct)}
                        className="py-4 sm:py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
                      >
                        <ShoppingCart className="h-5 w-5" />
                        Carrinho
                      </button>
                      <button 
                        onClick={() => handleWhatsApp(selectedProduct)}
                        className="py-4 sm:py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all hover:brightness-110 active:scale-95"
                        style={{ backgroundColor: currentTheme.buttonColor, color: currentTheme.buttonTextColor }}
                      >
                        <MessageCircle className="h-5 w-5" />
                        Comprar
                      </button>
                    </div>
                  </div>
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
