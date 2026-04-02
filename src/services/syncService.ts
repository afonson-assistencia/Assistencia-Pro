import { dbLocal, type SyncOperation } from '../db';
import { db as firestore } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

class SyncService {
  private isSyncing = false;

  async addToQueue(operation: Omit<SyncOperation, 'timestamp'>) {
    await dbLocal.syncQueue.add({
      ...operation,
      timestamp: Date.now()
    });
    this.trySync();
  }

  async trySync() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const queue = await dbLocal.syncQueue.orderBy('timestamp').toArray();
      for (const op of queue) {
        try {
          await this.processOperation(op);
          await dbLocal.syncQueue.delete(op.id!);
        } catch (error) {
          console.error('Failed to sync operation:', op, error);
          // If it's a permission error or similar, we might want to remove it or retry later
          break; 
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async processOperation(op: SyncOperation) {
    const colRef = collection(firestore, op.collection);
    
    switch (op.type) {
      case 'add':
        await addDoc(colRef, {
          ...op.data,
          createdAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        });
        break;
      case 'update':
        const { id, ...updateData } = op.data;
        await updateDoc(doc(firestore, op.collection, id), {
          ...updateData,
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        });
        break;
      case 'delete':
        await deleteDoc(doc(firestore, op.collection, op.data.id));
        break;
    }
  }

  init() {
    window.addEventListener('online', () => this.trySync());
    // Initial sync attempt
    this.trySync();
  }
}

export const syncService = new SyncService();
