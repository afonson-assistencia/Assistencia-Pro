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
  serviceOrders!: Table<any>;

  constructor() {
    super('AssistenciaProDB');
    this.version(1).stores({
      syncQueue: '++id, collection, type, timestamp',
      customers: 'id, name, phone',
      products: 'id, name, category',
      serviceOrders: 'id, customerId, status, model'
    });
  }
}

export const dbLocal = new AppDatabase();
