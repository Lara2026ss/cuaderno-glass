# Cuaderno Glass Pro 5.0 — Testing Strategy & Verification Plan

## 1. Testing Pyramid

```
                ┌──────────────┐
                │   E2E Tests  │  (Full Browser Scenarios)
                ├──────────────┤
                │ Integration  │  (Backend API, Token Auth, SSRF)
                ├──────────────┤
                │  Unit Tests  │  (AppState, Trackers, Mappers, Auth)
                ├──────────────┤
                │ Security/Lint│  (Secret Scans, HTML Audit, CSP)
                └──────────────┘
```

## 2. Test Suites Execution

```bash
# Run all test suites
node tests/run-all.js

# Run individual suites
node tests/unit-state.test.js
node tests/unit-price-tracker.test.js
node tests/unit-integrations.test.js
node tests/unit-auth.test.js
node tests/html-audit.test.js
node tests/security-scan.test.js
```

## 3. Verification Criteria
- All tests must run cleanly without network dependency by utilizing `tests/test-helper.js`.
- Security scanner must return 0 violations across all 37+ files.
- HTML structure audit verifies all 36 required IDs and data attributes.
