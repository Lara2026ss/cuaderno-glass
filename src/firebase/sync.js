/**
 * Cuaderno Glass Pro 4.0 — Sincronizador de Datos & Migración Cloud
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { events } from '../app/events.js';
import { firestoreRepo } from './firestore.js';

export class DataSynchronizer {
  constructor() {
    this.isProcessingQueue = false;
  }

  init() {
    window.addEventListener('online', () => {
      logger.info('DataSync', 'Conexión a internet restablecida');
      store.set('sync.isOnline', true);
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      logger.warn('DataSync', 'Dispositivo desconectado de internet; operando en modo offline');
      store.set('sync.isOnline', false);
    });

    events.on('auth:user-signed-in', async (user) => {
      await this.handleUserSignIn(user);
    });

    events.on('auth:user-signed-out', () => {
      firestoreRepo.unsubscribeAll();
    });
  }

  async handleUserSignIn(user) {
    logger.info('DataSync', `Iniciando sincronización para usuario ${user.uid}`);
    
    // 1. Snapshot defensivo de datos locales previo a cualquier onSnapshot
    const localTasks = store.get('tasks', []);
    const localNotes = store.get('notes', []);
    const localDocs = store.get('documents', []);
    const localTrackers = store.get('priceTrackers', []);

    this.localMigrationSnapshot = {
      tasks: Array.isArray(localTasks) ? [...localTasks] : [],
      notes: Array.isArray(localNotes) ? [...localNotes] : [],
      documents: Array.isArray(localDocs) ? [...localDocs] : [],
      priceTrackers: Array.isArray(localTrackers) ? [...localTrackers] : []
    };

    const totalLocalItems = this.localMigrationSnapshot.tasks.length +
                            this.localMigrationSnapshot.notes.length +
                            this.localMigrationSnapshot.documents.length +
                            this.localMigrationSnapshot.priceTrackers.length;

    if (totalLocalItems > 0 && !store.get('sync.migrationCompleted', false)) {
      store.set('sync.migrationSnapshot', this.localMigrationSnapshot, { skipSave: false });
    }

    // 2. Suscribir colecciones en tiempo real de Firestore
    firestoreRepo.subscribeToCollection('tasks', 'tasks');
    firestoreRepo.subscribeToCollection('notes', 'notes');
    firestoreRepo.subscribeToCollection('documents', 'documents');
    firestoreRepo.subscribeToCollection('priceTrackers', 'priceTrackers');

    // 3. Procesar mutaciones pendientes
    await this.processOfflineQueue();

    // 4. Verificar si hay datos locales previos para ofrecer migración
    this.checkPendingLocalMigration();
  }

  checkPendingLocalMigration() {
    const snapshot = this.localMigrationSnapshot || store.get('sync.migrationSnapshot');
    if (!snapshot) return;

    const tasks = snapshot.tasks || [];
    const notes = snapshot.notes || [];
    const docs = snapshot.documents || [];
    const trackers = snapshot.priceTrackers || [];

    const totalLocalItems = tasks.length + notes.length + docs.length + trackers.length;
    if (totalLocalItems > 0 && !store.get('sync.migrationCompleted', false)) {
      events.emit('sync:migration-available', {
        tasks: tasks.length,
        notes: notes.length,
        docs: docs.length,
        trackers: trackers.length,
        tasksCount: tasks.length,
        notesCount: notes.length,
        docsCount: docs.length,
        trackersCount: trackers.length
      });
    }
  }

  async migrateLocalToCloud() {
    logger.info('DataSync', 'Ejecutando migración de datos locales a Firestore...');
    store.set('sync.isSyncing', true);

    try {
      const snapshot = this.localMigrationSnapshot || store.get('sync.migrationSnapshot') || {
        tasks: store.get('tasks', []),
        notes: store.get('notes', []),
        documents: store.get('documents', []),
        priceTrackers: store.get('priceTrackers', [])
      };

      const tasks = snapshot.tasks || [];
      for (const t of tasks) {
        await firestoreRepo.saveItem('tasks', t);
      }

      const notes = snapshot.notes || [];
      for (const n of notes) {
        await firestoreRepo.saveItem('notes', n);
      }

      const docs = snapshot.documents || [];
      for (const d of docs) {
        await firestoreRepo.saveItem('documents', d);
      }

      const trackers = snapshot.priceTrackers || [];
      for (const tr of trackers) {
        await firestoreRepo.saveItem('priceTrackers', tr);
      }

      store.set('sync.migrationCompleted', true);
      store.set('sync.migrationSnapshot', null);
      this.localMigrationSnapshot = null;
      store.set('sync.lastCloudSync', new Date().toISOString());
      logger.info('DataSync', 'Migración local a cloud completada con éxito');
      return true;
    } catch (err) {
      logger.error('DataSync', 'Error durante la migración a cloud', { error: err.message });
      throw err;
    } finally {
      store.set('sync.isSyncing', false);
    }
  }

  async processOfflineQueue() {
    if (this.isProcessingQueue || !store.get('sync.isOnline', true)) return;
    const queue = [...store.offlineQueue];
    if (queue.length === 0) return;

    this.isProcessingQueue = true;
    store.set('sync.isSyncing', true);
    logger.info('DataSync', `Procesando ${queue.length} operaciones offline pendientes...`);

    for (const mutation of queue) {
      try {
        if (mutation.type === 'save') {
          await firestoreRepo.saveItem(mutation.collection, mutation.item);
        } else if (mutation.type === 'delete') {
          await firestoreRepo.deleteItem(mutation.collection, mutation.itemId);
        }
        store.dequeueMutation(mutation.id);
      } catch (err) {
        logger.warn('DataSync', 'Fallo al sincronizar mutación offline, se reintentará luego', { id: mutation.id });
        break;
      }
    }

    store.set('sync.isSyncing', false);
    this.isProcessingQueue = false;
  }
}

export const synchronizer = new DataSynchronizer();
