# Cuaderno Glass Pro 5.0 — Architectural Specification & Contracts

## 1. System Overview

Cuaderno Glass Pro 5.0 is an offline-first, cloud-synchronized personal productivity and automation platform with Ultra-Glassmorphism UI, real Google Identity / Firestore integration, Gemini AI Copilot, Google Drive integration, multi-store price tracking with an autonomous background worker, and a multi-channel notification engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                               USER INTERFACE                           │
│  Dashboard │ Deals │ Documents & Drive │ Gemini AI │ Connectors │ Pomo │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                              FEATURE LAYER                             │
│  tasks.js │ notes.js │ documents.js │ deals.js │ pomodoro.js │ search  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                          APPLICATION CORE LAYER                        │
│  state.js (AppStore) │ events.js (EventBus) │ logger.js │ router.js    │
└──────────────┬────────────────────┼────────────────────┬───────────────┘
               │                    │                    │
┌──────────────▼──────┐   ┌─────────▼──────────┐   ┌─────▼───────────────┐
│     REPOSITORY      │   │    INTEGRATIONS    │   │     SERVICES        │
│  FirestoreRepo      │   │  google-drive.js   │   │  NotificationEngine │
│  LocalRepository    │   │  gemini.js         │   │  BackgroundWorker   │
│  OfflineQueue       │   │  price-tracker.js  │   │  AudioEngine        │
│  SyncCoordinator    │   │  discord.js        │   │  Toast / Modals     │
└──────────────┬──────┘   └─────────┬──────────┘   └─────────────────────┘
               │                    │
┌──────────────▼────────────────────▼────────────────────────────────────┐
│                          EXPRESS BACKEND (server.js)                   │
│  Token Verification │ /api/gemini/chat │ /api/price-tracker/check      │
│  /api/notifications │ /api/drive/*     │ Static SPA Serving            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                            EXTERNAL SERVICES                           │
│  Google Cloud / Firebase │ Google Drive API │ Gemini API │ Webhooks    │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Architectural Invariants & Rules

1. **Strict Client-Backend Isolation**: Privileged operations (token verification, server-side price monitoring, Gemini API Key consumption, Discord/Telegram bot dispatch) MUST go through Express backend endpoints (`/api/*`).
2. **Offline-First & Idempotency**: All user actions (creating tasks, editing documents, modifying trackers) must immediately succeed in local reactive state and queue a mutation in `offlineQueue` with a unique UUID v4 idempotency key.
3. **Safe Hydration**: On user sign-in, local guest items are captured into `migrationSnapshot` *before* subscribing to real-time Firestore listeners, guaranteeing that empty remote collections never wipe unmigrated local items.
4. **Resilient Degradation**: If Firebase Admin credentials or external APIs are absent or unreachable, the system automatically falls back to local storage and client-side adapters with clear visual indicators.
