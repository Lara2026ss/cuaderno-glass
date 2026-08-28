# AUDIT REPORT — Cuaderno Glass Pro 5.0 Baseline Audit (Phase 0)

**Date:** 2026-08-25  
**Target Codebase:** `C:\Users\mauri\OneDrive\Documents\FLUX-MCP-DOC\cuaderno-glass`  
**Baseline Version:** 4.0.0 $\rightarrow$ Target: 5.0.0 Production Suite  
**Audit Conducted by:** Project Orchestrator via Parallel Explorers (Explorer 1: Architecture, Explorer 2: Features, Explorer 3: Security & Quality)

---

## 1. Executive Summary

A comprehensive architectural, functional, security, and quality audit was conducted across the 46 files comprising the `cuaderno-glass` codebase.

- **Baseline Health**: The existing v4.0.0 codebase is clean, well-modularized (vanilla ES6 + CSS variables + Express backend), and all 6 existing automated test suites (`tests/run-all.js`) execute cleanly with 0 failures.
- **Architectural Foundation**: Core state management (`AppStore` pub/sub), procedural audio synthesis (`Web Audio API`), Firebase Google Authentication, and Discord webhooks are solidly designed and functioning.
- **Critical Gaps for 5.0**: To fulfill the requirements of Cuaderno Glass Pro 5.0 (`ORIGINAL_REQUEST.md`), major functional gaps must be addressed: lack of Kanban board views, absence of Gemini Function Calling tools, missing Google Drive Picker and Docs conversion, absence of an autonomous background monitoring daemon, missing Telegram bot adapter, lack of PWA Service Worker (`sw.js`) and `manifest.json`, and basic text-only price history.
- **Security & Integrity Risks**: 1 Critical data-loss race condition (guest data wiped on cloud login), 3 High vulnerabilities (backend SSRF in price scraper, dead action buttons from `cloneNode`, missing Google Client ID config), and 6 Medium risks (DOM XSS vectors, hardcoded bundler paths, sibling directory traversal) were identified and cataloged for immediate remediation in Phase 1.

---

## 2. Codebase Architecture & Structural Inventory

### 2.1 File & Module Layout (46 Files)
- **Root**:
  - `index.html`: Master single-page container (471 lines) with 6 view sections (Dashboard, Deals, Documents, Gemini, Connectors, Pomodoro) and modals.
  - `server.js`: Express backend (380 lines) providing Firebase Admin verification, data proxying, AI completion, and price scraper.
  - `build.js`: HTML/CSS bundler script.
  - `package.json`: Dependencies (`express`, `cors`, `firebase-admin`). Missing `"type": "module"`.
  - `firestore.rules`: User-scoped Firestore security rules (`/users/{userId}/{allPaths=**}`).
- **`src/app/`**:
  - `bootstrap.js`: Master UI coordinator, navigation, auth listener, and event binder.
  - `state.js`: Centralized reactive `AppStore` with `DATA_VERSION = 4`, legacy migration, and localStorage persistence.
  - `events.js`: Central `EventBus` pub/sub emitter.
  - `logger.js`: In-memory ring buffer (200 entries) with automatic secret redaction.
  - `router.js`: Hash-based SPA router.
- **`src/features/`**:
  - `tasks.js`: Flat task list, category filters, priority badges, confetti trigger.
  - `notes.js`: Scratchpad notes with static markdown formatting template.
  - `documents.js`: Markdown document editor with `.md` blob export and Google Drive upload.
  - `deals.js`: Price tracker dashboard cards and price history modal trigger.
  - `pomodoro.js`: 25/5/15m timer with procedural audio and confetti.
  - `search.js`: Global search query dispatcher.
- **`src/integrations/`**:
  - `auth.js` (`src/firebase/`): Real Google Auth popup with 9-code error mapper (`mapAuthError`).
  - `firestore.js` (`src/firebase/`): Scoped collection CRUD and realtime `onSnapshot` subscriptions.
  - `sync.js` (`src/firebase/`): Online/offline event listener and local-to-cloud migration coordinator.
  - `gemini.js`: Gemini 1.5 Flash text generation (zero function calling schemas).
  - `google-drive.js`: GIS token client and multipart `.md` uploader (no Picker UI).
  - `price-tracker.js`: Store URL detection (Amazon, Eneba, Steam, Mercado Libre) and alert calculations.
  - `registry.js`: Integration status tracker with health-check dispatchers.
  - `discord.js`: Discord webhook embed formatter and dispatcher.
- **`src/audio/`**:
  - `audio-engine.js`: Procedural Web Audio API sound synthesizer (6 distinct chimes/fanfares).
- **`src/styles/`**:
  - `variables.css`, `glass.css`, `layout.css`, `components.css`, `responsive.css`.

---

## 3. Comprehensive Feature & Integration Matrix

| Feature Domain | Requirement (5.0 Specs) | Current Status | Classification | Audit Finding / Gap |
|---|---|---|---|---|
| **Authentication** | Real Google Auth & Firebase Auth | Real & Working | **REAL & WORKING** | Real `GoogleAuthProvider` popup + 9-error mapper in `src/firebase/auth.js`. |
| **Persistence** | Firestore Realtime + Scoped Rules | Real & Working | **REAL & WORKING** | `/users/{uid}/{collection}` with `firestore.rules` and backend fallback. |
| **Tasks & Projects** | Kanban Board, Subtasks, Drag & Drop | Partial | **PARTIAL / BROKEN** | Only flat list implemented (`src/features/tasks.js`). Zero Kanban columns or DnD. |
| **Notes & Docs** | Rich Text / MD, Live Preview, GDocs export | Partial | **PARTIAL / BROKEN** | Notes format is hardcoded template string; docs export is client `.md` blob only. |
| **Google Drive** | Drive Picker API, GDocs import/export | Partial | **PARTIAL / BROKEN** | Direct multipart upload works; no `google.picker` UI and no GDocs conversion. |
| **Gemini AI Copilot** | Function Calling tools, state mutations | Partial | **PARTIAL / BROKEN** | Raw prompt works; zero tool definitions or action handlers in `src/integrations/gemini.js`. |
| **Price Tracker** | Multi-store scraping, history charts, alerts | Partial | **PARTIAL / BROKEN** | Discount math works; scraper is generic regex; history chart is plain text list. |
| **Background Worker** | Autonomous background price monitoring | Missing | **COMPLETELY MISSING** | Zero cron jobs or background daemon services in `server.js` or client. |
| **Notifications** | Web Push, Discord, Telegram, In-App | Partial | **PARTIAL / BROKEN** | Discord and In-App work; Web Push is basic in-tab; Telegram is absent. |
| **PWA & Offline Sync** | Offline Mutation Queue + SW + Manifest | Partial | **PARTIAL / BROKEN** | `localStorage` queue exists; missing `manifest.json`, `sw.js`, and IndexedDB store. |
| **Design System** | Ultra-Glass 5.0, 320px–1920px responsiveness | Real / Partial | **PARTIAL / BROKEN** | Glass variables and 5 breakpoints exist; typography overflows on 320px screens. |
| **Audio Engine** | Procedural Web Audio synth | Real & Working | **REAL & WORKING** | 6 procedural sound profiles in `audio-engine.js` without external assets. |

---

## 4. Forensic Bug & Vulnerability Registry

| ID | Severity | Location | Root Cause | Impact | Remediation Plan (Phase 1) |
|---|---|---|---|---|---|
| **BUG-001** | **CRITICAL** | `src/firebase/sync.js:36-50`, `src/firebase/firestore.js:120-130` | `onSnapshot` fires immediately on sign-in before guest migration, overwriting local state with `[]`. | Guest data is permanently wiped on first Google login. | Snapshot local guest state into migration buffer before attaching Firestore listeners. |
| **SEC-001** | **HIGH** | `server.js:337-370` | `/api/price-tracker/check` fetches arbitrary client-supplied URL via Node.js `fetch()`. | Unauthenticated SSRF accessing cloud metadata (`169.254.169.254`) or intranet. | Validate and whitelist e-commerce domains; reject internal/private IP ranges. |
| **BUG-002** | **HIGH** | `src/features/deals.js:181-195` | Cards cloned into `#deals-full-list` with `cloneNode(true)` which strips event listeners. | All action buttons (History, Check Now, Delete) in Deals tab are dead. | Create independent DOM elements with direct event listener binding. |
| **BUG-003** | **HIGH** | `src/integrations/google-drive.js:23`, `index.html:388-428` | Missing `googleClientId` input in Settings modal and `store.settings`. | Google Drive integration cannot be configured or initialized. | Add Google Client ID field to settings modal, state schema, and sync handlers. |
| **SEC-002** | **MEDIUM** | `src/app/bootstrap.js:465`, `src/ui/toast.js:38`, `src/app/bootstrap.js:321` | Unescaped interpolation in `innerHTML` for AI responses, toast text, and avatar URL. | Stored and DOM-based Cross-Site Scripting (XSS). | Replace with `escapeHtml()` sanitization or `textContent` / safe DOM elements. |
| **SEC-003** | **MEDIUM** | `build.js:39-45` | Hardcoded absolute Windows path `c:\Users\mauri\Downloads\cuaderno.html`. | Build script fails in non-matching environments and leaks username. | Write build output exclusively to `dist/` relative to project root. |
| **SEC-004** | **MEDIUM** | `server.js:19, 26-37` | Server attempts to read credentials from sibling folder `../windows-doc/storage`. | Insecure directory traversal and fragile external coupling. | Restrict credential loading to project root environment variables / `.env`. |
| **BUG-004** | **MEDIUM** | `src/firebase/firestore.js:74-78` | Mutations only enqueued to offline queue if `!isOnline`. Transient cloud errors are dropped. | Silent data loss on network glitches while browser reports online. | Enqueue to mutation queue on any failed network write and retry with exponential backoff. |
| **BUG-005** | **MEDIUM** | `src/app/state.js:100` | `JSON.parse` on unquoted legacy theme string throws unhandled `SyntaxError`. | App crash on load for users with plain string legacy localStorage. | Wrap migration parsers in safe `try/catch` fallbacks. |
| **UI-001** | **MEDIUM** | `index.html:374`, `src/styles/responsive.css` | Pomodoro `#full-timer-val` set to `4.8rem` without narrow viewport media query. | Visual overflow and layout break on 320px–360px mobile viewports. | Add responsive `@media (max-width: 480px)` font sizing (`2.8rem - 3.2rem`). |
| **QUAL-001**| **LOW** | `package.json` | Missing `"type": "module"` in package configuration. | Node.js emits `[MODULE_TYPELESS_PACKAGE_JSON]` warnings on test runs. | Add `"type": "module"` to `package.json`. |
| **SEC-005** | **LOW** | `server.js:42-45` | Express uses wildcard CORS `cors()` without origin restrictions or security headers. | Permissive cross-origin access and missing CSP headers. | Configure CORS origin whitelist and add Helmet / CSP headers. |
