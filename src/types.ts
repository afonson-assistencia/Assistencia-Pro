export type UserRole = 'admin' | 'staff' | 'motoboy';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  motoboyId?: string;
  createdAt: any;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  createdAt: any;
}

export type OSStatus = 'pending' | 'in-progress' | 'awaiting-parts' | 'ready' | 'delivered' | 'cancelled';

export interface ServiceOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  model: string;
  services: string[];
  problem: string;
  entryDate: any;
  deadline?: any;
  warrantyDays?: number;
  status: OSStatus;
  statusHistory?: { status: OSStatus; date: any; notes?: string }[];
  notes?: string;
  totalValue?: number;
  productCost?: number;
  downPayment?: number;
  downPaymentMethod?: 'pix' | 'cash' | 'card';
  finalPayment?: number;
  finalPaymentMethod?: 'pix' | 'cash' | 'card';
  deliveredAt?: any;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  categoryId?: string;
  category?: string;
  imei?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt: any;
  updatedAt?: any;
}

export interface StorefrontTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export interface Storefront {
  id: string;
  slug: string;
  name: string;
  description: string;
  whatsappNumber: string;
  logoUrl?: string;
  theme: StorefrontTheme;
  productIds: string[];
  active: boolean;
  ownerId: string;
  createdAt: any;
  updatedAt?: any;
}

export interface Category {
  id: string;
  name: string;
  active?: boolean;
  createdAt: any;
}

export type StorefrontOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface StorefrontOrder {
  id: string;
  storefrontId: string;
  customerName: string;
  customerAddress: string;
  locationId: string;
  locationName: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  shipping: number;
  total: number;
  status: StorefrontOrderStatus;
  createdAt: any;
  updatedAt?: any;
}

export interface DeliveryLocation {
  id: string;
  name: string;
  value: number;
  motoboyFee?: number;
  createdAt: any;
}

export interface Motoboy {
  id: string;
  name: string;
  active: boolean;
  createdAt: any;
}

export type DeliveryStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface DeliveryRun {
  id: string;
  motoboyId: string;
  motoboyName: string;
  locationId: string;
  locationName: string;
  value: number;
  quantity: number;
  totalValue: number;
  date: string; // YYYY-MM-DD
  status: DeliveryStatus;
  notes?: string;
  paidAt?: any;
  createdAt: any;
}

export interface SaleItem {
  productId?: string | null;
  productName: string;
  quantity: number;
  price: number;
  imei?: string | null;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalValue: number;
  discount?: number;
  date: any;
  createdAt: any;
  customerId?: string;
  customerName?: string;
  productName?: string;
}

export interface Expense {
  id: string;
  description: string;
  value: number;
  category: string;
  date: any;
  createdAt: any;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  productId?: string;
  bought: boolean;
  createdAt: any;
}

export interface AccessLog {
  id: string;
  userId: string;
  userEmail: string;
  device: string;
  location: string;
  ip: string;
  timestamp: any;
}

export const STATUS_LABELS: Record<OSStatus, string> = {
  'pending': 'Pendente',
  'in-progress': 'Em Andamento',
  'awaiting-parts': 'Aguardando Peças',
  'ready': 'Pronto',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado'
};

export const STATUS_COLORS: Record<OSStatus, string> = {
  'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  'awaiting-parts': 'bg-amber-100 text-amber-800 border-amber-200',
  'ready': 'bg-green-100 text-green-800 border-green-200',
  'delivered': 'bg-gray-100 text-gray-800 border-gray-200',
  'cancelled': 'bg-red-100 text-red-800 border-red-200'
};
