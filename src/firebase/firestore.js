/**
 * Cuaderno Glass Pro 4.0 — Repositorio Real Cloud Firestore
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { events } from '../app/events.js';

export class FirestoreRepository {
  constructor() {
    this.db = null;
    this.activeListeners = new Map();
  }

  _getDb() {
    if (!this.db && typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      this.db = firebase.firestore();
    }
    return this.db;
  }

  _getUserDocRef() {
    const user = store.get('user');
    if (!user || !user.uid) return null;
    const db = this._getDb();
    if (!db) return null;
    return db.collection('users').doc(user.uid);
  }

  async saveItem(collectionName, item) {
    const userDoc = this._getUserDocRef();
    if (!userDoc) {
      // Modo local
      return item;
    }

    try {
      const docRef = userDoc.collection(collectionName).doc(String(item.id));
      const payload = {
        ...item,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await docRef.set(payload, { merge: true });
      logger.debug('Firestore', `Item guardado en ${collectionName}/${item.id}`);
      return item;
    } catch (err) {
      logger.error('Firestore', `Error guardando en ${collectionName}`, { id: item.id, error: err.message });
      store.enqueueMutation({ type: 'save', collection: collectionName, item });
      throw err;
    }
  }

  async deleteItem(collectionName, itemId) {
    const userDoc = this._getUserDocRef();
    if (!userDoc) return;

    try {
      await userDoc.collection(collectionName).doc(String(itemId)).delete();
      logger.debug('Firestore', `Item eliminado de ${collectionName}/${itemId}`);
    } catch (err) {
      logger.error('Firestore', `Error eliminando de ${collectionName}`, { id: itemId, error: err.message });
      store.enqueueMutation({ type: 'delete', collection: collectionName, itemId });
      throw err;
    }
  }

  // Sincronización en tiempo real de una colección
  subscribeToCollection(collectionName, statePath) {
    const userDoc = this._getUserDocRef();
    if (!userDoc) return () => {};

    if (this.activeListeners.has(collectionName)) {
      this.activeListeners.get(collectionName)(); // desuscribir previo
    }

    try {
      const unsubscribe = userDoc.collection(collectionName).onSnapshot(
        snapshot => {
          const items = [];
          snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
          });
          store.set(statePath, items, { skipSave: false });
          store.set('connections.firebase.lastSync', new Date().toISOString());
          events.emit(`firestore:${collectionName}:synced`, items);
        },
        err => {
          logger.error('Firestore', `Error en listener de ${collectionName}`, { error: err.message });
        }
      );

      this.activeListeners.set(collectionName, unsubscribe);
      return unsubscribe;
    } catch (err) {
      logger.error('Firestore', `Fallo al suscribir a ${collectionName}`, { error: err.message });
      return () => {};
    }
  }

  unsubscribeAll() {
    this.activeListeners.forEach(unsub => unsub());
    this.activeListeners.clear();
  }
}

export const firestoreRepo = new FirestoreRepository();
