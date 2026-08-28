/**
 * Tests: Firebase Authentication, Error Mapping & Data Sync Unit Suite (9 Tests)
 */

import assert from 'assert';
import { setupTestEnvironment } from './test-helper.js';

function setupMockFirebase() {
  const env = setupTestEnvironment();

  global.firebase = {
    apps: [],
    initializeApp: (config) => {
      const app = { name: '[DEFAULT]', options: config };
      global.firebase.apps.push(app);
      return app;
    },
    app: () => global.firebase.apps[0],
    firestore: Object.assign(() => {
      const makeSubcollection = () => ({
        doc: () => ({
          get: async () => ({ exists: false, data: () => null }),
          set: async () => {},
          delete: async () => {}
        }),
        onSnapshot: (callback) => {
          global.firebase._snapshotCallback = callback;
          return () => {};
        }
      });

      return {
        collection: () => ({
          doc: () => ({
            get: async () => ({ exists: false, data: () => null }),
            set: async () => {},
            delete: async () => {},
            collection: () => makeSubcollection()
          }),
          onSnapshot: (callback) => {
            global.firebase._snapshotCallback = callback;
            return () => {};
          }
        })
      };
    }, {}),
    auth: Object.assign(() => ({
      setPersistence: async () => {},
      onAuthStateChanged: (cb) => {
        global.firebase._authChangedCb = cb;
      },
      signInWithPopup: async () => {},
      signOut: async () => {}
    }), {
      GoogleAuthProvider: function () {
        this.scopes = [];
        this.customParams = {};
        this.addScope = (s) => this.scopes.push(s);
        this.setCustomParameters = (p) => Object.assign(this.customParams, p);
      },
      Auth: {
        Persistence: { LOCAL: 'LOCAL', SESSION: 'SESSION', NONE: 'NONE' }
      }
    })
  };

  return env;
}

export async function runAuthTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Firebase Authentication & Error Mapping (9 Tests)...');
  const env = setupMockFirebase();

  const { fetchServerFirebaseConfig, isValidFirebaseConfig } = await import('../src/firebase/config.js');
  const { authService, AUTH_ERRORS } = await import('../src/firebase/auth.js');
  const { store } = await import('../src/app/state.js');
  const { events } = await import('../src/app/events.js');
  const { synchronizer } = await import('../src/firebase/sync.js');

  // Test 1 — Firebase Configuration Validation
  const config = await fetchServerFirebaseConfig();
  assert.strictEqual(config.projectId, 'alero-company-works', 'projectId debe ser alero-company-works');
  assert.ok(config.authDomain.includes('alero-company-works'), 'authDomain debe corresponder a alero-company-works');
  assert.ok(config.apiKey.length > 10, 'apiKey debe estar presente y no vacía');
  assert.ok(isValidFirebaseConfig(config), 'Configuración debe ser válida');
  console.log('  ✓ Test 1: Consistencia de configuración de Firebase validada');

  // Test 2 — Google Provider Creation
  const provider = authService.createGoogleProvider();
  assert.ok(provider instanceof global.firebase.auth.GoogleAuthProvider, 'Debe crear una instancia de GoogleAuthProvider');
  assert.ok(provider.scopes.includes('profile'), 'Debe incluir scope profile');
  assert.ok(provider.scopes.includes('email'), 'Debe incluir scope email');
  assert.strictEqual(provider.customParams.prompt, 'select_account', 'Debe solicitar prompt select_account');
  console.log('  ✓ Test 2: Creación y scopes de GoogleAuthProvider validados');

  // Test 3 — Error Mapping: auth/configuration-not-found
  const errConfig = authService.mapAuthError({ code: AUTH_ERRORS.CONFIGURATION_NOT_FOUND, message: 'Configuration not found' });
  assert.strictEqual(errConfig.code, 'auth/configuration-not-found');
  assert.strictEqual(errConfig.isConfigError, true, 'Debe marcarse como error de configuración');
  assert.ok(errConfig.friendlyMessage.includes('alero-company-works'), 'Mensaje debe mencionar el proyecto alero-company-works');
  assert.ok(errConfig.actionUrl.includes('console.firebase.google.com'), 'Debe proveer URL directa a Firebase Console');
  console.log('  ✓ Test 3: Mapeo de auth/configuration-not-found validado');

  // Test 4 — Error Mapping: auth/popup-blocked
  const errPopup = authService.mapAuthError({ code: AUTH_ERRORS.POPUP_BLOCKED, message: 'Popup blocked' });
  assert.strictEqual(errPopup.code, 'auth/popup-blocked');
  assert.ok(errPopup.friendlyMessage.includes('bloqueó la ventana'), 'Mensaje debe indicar cómo desbloquear popups');
  console.log('  ✓ Test 4: Mapeo de auth/popup-blocked validado');

  // Test 5 — Error Mapping: auth/unauthorized-domain
  const errDomain = authService.mapAuthError({ code: AUTH_ERRORS.UNAUTHORIZED_DOMAIN, message: 'Unauthorized domain' });
  assert.strictEqual(errDomain.code, 'auth/unauthorized-domain');
  assert.strictEqual(errDomain.isConfigError, true);
  assert.ok(errDomain.friendlyMessage.includes('Dominios Autorizados'), 'Debe indicar Dominios Autorizados');
  console.log('  ✓ Test 5: Mapeo de auth/unauthorized-domain validado');

  // Test 6 — Error Mapping: auth/network-request-failed
  const errNetwork = authService.mapAuthError({ code: AUTH_ERRORS.NETWORK_FAILED, message: 'Network failed' });
  assert.strictEqual(errNetwork.code, 'auth/network-request-failed');
  assert.strictEqual(errNetwork.isConfigError, false, 'No debe confundirse fallo de red con error de configuración');
  assert.ok(errNetwork.friendlyMessage.includes('conexión a internet'));
  console.log('  ✓ Test 6: Mapeo y diferenciación de fallos de red validado');

  // Test 7 — Logout Behavior & State Reset
  let logoutEmitted = false;
  events.on('auth:user-signed-out', () => { logoutEmitted = true; });
  
  store.set('user', { uid: 'test-user', email: 'test@example.com' });
  store.set('session.isAuthenticated', true);
  
  await authService.signOut();
  assert.strictEqual(store.get('user'), null, 'El usuario en store debe ser null tras logout');
  assert.strictEqual(store.get('session.isAuthenticated'), false, 'isAuthenticated debe ser false');
  assert.strictEqual(logoutEmitted, true, 'Debe emitir evento auth:user-signed-out');
  console.log('  ✓ Test 7: Comportamiento de logout y reseteo de sesión validado');

  // Test 8 — Session Restoration & State Resolution
  let loginEmitted = false;
  events.on('auth:user-signed-in', () => { loginEmitted = true; });

  await authService.init();
  assert.strictEqual(typeof global.firebase._authChangedCb, 'function', 'Listener onAuthStateChanged debe estar registrado');

  // Simular evento onAuthStateChanged con usuario válido
  await global.firebase._authChangedCb({
    uid: 'google-uid-12345',
    displayName: 'Mauricio Test',
    email: 'mauricio@example.com',
    photoURL: 'https://example.com/avatar.png',
    isAnonymous: false,
    getIdToken: async () => 'mock-id-token-abc'
  });

  assert.strictEqual(store.get('session.isAuthenticated'), true);
  assert.strictEqual(store.get('user.uid'), 'google-uid-12345');
  assert.strictEqual(store.get('user.email'), 'mauricio@example.com');
  assert.strictEqual(loginEmitted, true, 'Debe emitir evento auth:user-signed-in');
  console.log('  ✓ Test 8: Restauración y resolución de sesión validada');

  // Test 9 — Guest Data Preservation on Sign-in (BUG-001)
  store.set('user', null);
  store.set('session.isAuthenticated', false);
  store.set('tasks', [{ id: 'guest-t1', text: 'Important Guest Task', category: 'Personal', completed: false }]);
  store.set('notes', [{ id: 'guest-n1', title: 'Guest Note', content: 'Secret idea' }]);

  let migrationEventEmitted = false;
  events.on('sync:migration-available', (counts) => {
    if (counts && counts.tasks === 1) migrationEventEmitted = true;
  });

  synchronizer.init();
  await authService.init();

  // Simular login con Firestore remoto vacío
  await global.firebase._authChangedCb({
    uid: 'new-cloud-user-999',
    displayName: 'New Cloud User',
    email: 'newuser@example.com',
    getIdToken: async () => 'mock-token'
  });

  // Simular snapshot de Firestore que retorna vacío
  if (global.firebase._snapshotCallback) {
    global.firebase._snapshotCallback({ docs: [], forEach: () => {} });
  }

  // Verificar que los datos del invitado no fueron destruidos/sobreescritos a 0
  assert.strictEqual(migrationEventEmitted, true, 'Debe emitir sync:migration-available preservando el snapshot de datos guest');
  assert.ok(store.get('tasks').length > 0, 'Las tareas locales del guest no deben ser destruidas silenciosamente');
  assert.strictEqual(store.get('tasks')[0].id, 'guest-t1');
  console.log('  ✓ Test 9: Protección de datos locales y buffer de migración verificado (BUG-001)');

  console.log('✅ Todas las pruebas de Authentication pasaron con éxito (9/9).\n');
}

if (process.argv[1] && process.argv[1].endsWith('unit-auth.test.js')) {
  runAuthTests().catch(err => {
    console.error('❌ Error en pruebas de Authentication:', err);
    process.exit(1);
  });
}
