import Database from "@tauri-apps/plugin-sql";

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

export class LocalDB {
  private static instance: Database | null = null;

  static async getInstance() {
    if (!this.instance && window.__TAURI__) {
      // Cria o banco sqlite:assistencia.db na pasta de dados do app
      this.instance = await Database.load("sqlite:assistencia.db");
      
      // Inicializa as tabelas
      await this.instance.execute(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
          collection TEXT NOT NULL,
          payload TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS local_cache (
          id TEXT PRIMARY KEY,
          collection TEXT NOT NULL,
          data TEXT NOT NULL,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    return this.instance;
  }

  // Adiciona uma operação à fila de sincronização
  static async addToQueue(operation: 'CREATE' | 'UPDATE' | 'DELETE', collection: string, payload: any) {
    const db = await this.getInstance();
    if (db) {
      await db.execute(
        "INSERT INTO sync_queue (operation, collection, payload) VALUES (?, ?, ?)",
        [operation, collection, JSON.stringify(payload)]
      );
    }
  }

  // Busca todos os itens da fila
  static async getQueue() {
    const db = await this.getInstance();
    if (!db) return [];
    return await db.select<{ id: number, operation: string, collection: string, payload: string }[]>(
      "SELECT * FROM sync_queue ORDER BY timestamp ASC"
    );
  }

  // Remove item da fila após sincronizar
  static async removeFromQueue(id: number) {
    const db = await this.getInstance();
    if (db) await db.execute("DELETE FROM sync_queue WHERE id = ?", [id]);
  }
}
