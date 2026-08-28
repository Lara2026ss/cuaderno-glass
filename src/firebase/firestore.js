/**
 * Cuaderno Glass Pro 4.0 — Repositorio Cloud Firestore & Repository Layer
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
    if (!this.db && typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
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
    const user = store.get('user');
    const idToken = store.get('session.idToken');
    let savedRemotely = false;

    // 1. Intentar Firestore SDK directo si usuario autenticado
    const userDoc = this._getUserDocRef();
    if (userDoc) {
      try {
        const docRef = userDoc.collection(collectionName).doc(String(item.id));
        const payload = {
          ...item,
          ownerId: user.uid,
          updatedAt: (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue)
            ? firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString()
        };
        await docRef.set(payload, { merge: true });
        logger.debug('Firestore', `Item guardado vía Firestore SDK en ${collectionName}/${item.id}`);
        savedRemotely = true;
        return item;
      } catch (err) {
        logger.warn('Firestore', `Error en Firestore SDK para ${collectionName}, intentando backend fallback`, { error: err.message });
      }
    }

    // 2. Fallback: Endpoint backend autenticado /api/user/:collection
    if (!savedRemotely && idToken) {
      try {
        const endpoint = collectionName === 'priceTrackers' ? 'price-trackers' : collectionName;
        const res = await fetch(`/api/user/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(item)
        });

        if (res.ok) {
          logger.debug('Firestore', `Item guardado vía API Backend en ${collectionName}/${item.id}`);
          savedRemotely = true;
          return item;
        }
      } catch (beErr) {
        logger.warn('Firestore', `Backend API error para ${collectionName}`, { error: beErr.message });
      }
    }

    // 3. Fallback Local & Offline Queue: Capturar mutaciones no confirmadas en la nube
    if (!savedRemotely) {
      store.enqueueMutation({ type: 'save', collection: collectionName, item });
      logger.info('Firestore', `Mutación guardada en offlineQueue para sincronización posterior: ${collectionName}/${item.id}`);
    }
    return item;
  }

  async deleteItem(collectionName, itemId) {
    const idToken = store.get('session.idToken');
    const userDoc = this._getUserDocRef();
    let deletedRemotely = false;

    if (userDoc) {
      try {
        await userDoc.collection(collectionName).doc(String(itemId)).delete();
        logger.debug('Firestore', `Item eliminado vía Firestore SDK de ${collectionName}/${itemId}`);
        deletedRemotely = true;
        return true;
      } catch (err) {
        logger.warn('Firestore', `Error en Firestore SDK al eliminar ${collectionName}/${itemId}`, { error: err.message });
      }
    }

    if (!deletedRemotely && idToken) {
      try {
        const endpoint = collectionName === 'priceTrackers' ? 'price-trackers' : collectionName;
        const res = await fetch(`/api/user/${endpoint}/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (res.ok) {
          deletedRemotely = true;
          return true;
        }
      } catch (e) {
        logger.warn('Firestore', `Backend API error al eliminar ${collectionName}/${itemId}`, { error: e.message });
      }
    }

    if (!deletedRemotely) {
      store.enqueueMutation({ type: 'delete', collection: collectionName, itemId });
      logger.info('Firestore', `Mutación delete guardada en offlineQueue: ${collectionName}/${itemId}`);
    }
    return true;
  }

  // Sincronización en tiempo real con Firestore
  subscribeToCollection(collectionName, statePath) {
    const userDoc = this._getUserDocRef();
    if (!userDoc) return () => {};

    if (this.activeListeners.has(collectionName)) {
      this.activeListeners.get(collectionName)();
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
          logger.warn('Firestore', `Listener degradado en ${collectionName}: ${err.message}`);
        }
      );

      this.activeListeners.set(collectionName, unsubscribe);
      return unsubscribe;
    } catch (err) {
      logger.warn('Firestore', `No se pudo suscribir a ${collectionName}`, { error: err.message });
      return () => {};
    }
  }

  unsubscribeAll() {
    this.activeListeners.forEach(unsub => unsub());
    this.activeListeners.clear();
  }
}

export const firestoreRepo = new FirestoreRepository();
