/**
 * Tests: Firebase Authentication & Error Mapping Unit Suite (8 Tests)
 */

const assert = require('assert');

function setupMockFirebase() {
  global.window = {
    location: { hostname: 'localhost' }
  };
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };

  global.firebase = {
    apps: [],
    initializeApp: (config) => {
      const app = { name: '[DEFAULT]', options: config };
      global.firebase.apps.push(app);
      return app;
    },
    app: () => global.firebase.apps[0],
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
}

async function runAuthTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Firebase Authentication & Error Mapping (8 Tests)...');
  setupMockFirebase();

  const { fetchServerFirebaseConfig, isValidFirebaseConfig } = await import('../src/firebase/config.js');
  const { authService, AUTH_ERRORS } = await import('../src/firebase/auth.js');
  const { store } = await import('../src/app/state.js');
  const { events } = await import('../src/app/events.js');

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

  console.log('✅ Todas las pruebas de Authentication pasaron con éxito (8/8).\n');
}

if (require.main === module) {
  runAuthTests().catch(err => {
    console.error('❌ Error en pruebas de Authentication:', err);
    process.exit(1);
  });
}

module.exports = { runAuthTests };
