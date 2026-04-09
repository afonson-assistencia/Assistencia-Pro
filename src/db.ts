import Dexie, { type Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  collection: string;
  type: 'add' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export class AppDatabase extends Dexie {
  syncQueue!: Table<SyncOperation>;
  customers!: Table<any>;
  products!: Table<any>;
  categories!: Table<any>;
  deliveryLocations!: Table<any>;
  storefrontOrders!: Table<any>;
  serviceOrders!: Table<any>;

  constructor() {
    super('AssistenciaProDB');
    this.version(2).stores({
      syncQueue: '++id, collection, type, timestamp',
      customers: 'id, name, phone',
      products: 'id, name, categoryId',
      categories: 'id, name',
      deliveryLocations: 'id, name',
      storefrontOrders: 'id, customerName, status',
      serviceOrders: 'id, customerId, status, model'
    });
  }
}

export const dbLocal = new AppDatabase();
