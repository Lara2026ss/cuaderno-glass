# Cuaderno Glass Pro 5.0 — Data Model & Firestore Schema

## 1. Local AppStore Schema (`DATA_VERSION = 5`)

```typescript
interface AppState {
  version: 5;
  session: {
    isAuthenticated: boolean;
    isChecking: boolean;
    lastActive: number;
    idToken: string | null;
  };
  user: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;
    isAnonymous: boolean;
  } | null;
  tasks: TaskItem[];
  notes: NoteItem[];
  documents: DocumentItem[];
  priceTrackers: PriceTrackerItem[];
  notifications: NotificationItem[];
  settings: UserSettings;
  pomodoro: PomodoroState;
  sync: SyncState;
}
```

## 2. Entity Definitions

### TaskItem
```typescript
interface TaskItem {
  id: string; // UUID v4 or timestamp string
  text: string;
  category: 'Trabajo' | 'Personal' | 'Estudio' | 'Ideas';
  priority: 'alta' | 'media' | 'baja';
  completed: boolean;
  status?: 'todo' | 'in_progress' | 'done'; // Kanban board column
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### DocumentItem
```typescript
interface DocumentItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: string; // Markdown content
  driveFileId?: string; // Real Google Drive file ID
  driveWebViewLink?: string;
  lastExportedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### PriceTrackerItem
```typescript
interface PriceTrackerItem {
  id: string;
  productName: string;
  store: 'Amazon' | 'Eneba' | 'Mercado Libre' | 'Steam' | 'Tienda Online';
  url: string;
  currency: string;
  normalPrice: number;
  currentPrice: number;
  targetPrice: number;
  discountPercent: number;
  savings: number;
  status: 'NORMAL' | 'DISCOUNT' | 'TARGET_REACHED' | 'PRICE_DROP' | 'ERROR';
  enabled: boolean;
  lastChecked: string;
  lastChanged: string;
  lastAlertAt: string | null;
  priceHistory: { timestamp: number; price: number; source: 'initial' | 'scraper' | 'manual' }[];
}
```

## 3. Firestore Cloud Path Hierarchy

```
/users/{userId}/
  ├── tasks/{taskId}
  ├── notes/{noteId}
  ├── documents/{documentId}
  ├── priceTrackers/{trackerId}
  └── settings/userSettings
```
All read and write access is strictly constrained by `firestore.rules` matching `request.auth.uid == userId`.
