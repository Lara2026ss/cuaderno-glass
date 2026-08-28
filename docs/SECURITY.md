# Cuaderno Glass Pro 5.0 — Security Hardening & Threat Model

## 1. Secrets Management
- **Zero Frontend Secrets**: No private keys, service account JSON, administrative tokens, or raw LLM API keys are ever bundled, committed, or exposed to the client.
- **Client Configuration**: Only public client parameters (`projectId`, `appId`, `apiKey`, `authDomain`) are loaded by the frontend.
- **Automated Scanning**: The codebase is continuously validated by `tests/security-scan.test.js` against 8 threat regex rules.

## 2. SSRF Protection (Price Scraper)
- **Domain Whitelist**: Scraper requests are strictly filtered to authorized e-commerce domains:
  - `amazon.(com|es|com.mx|...)`
  - `eneba.com`
  - `steampowered.com`
  - `mercadolibre.(com|com.mx|...)` / `mercadolivre.com.br`
- **Private IP & Loopback Filter**: Requests to `127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` (cloud metadata), and `0.0.0.0` are blocked with HTTP 400.

## 3. Cross-Site Scripting (XSS) & Content Security Policy (CSP)
- **DOM Sanitization**: HTML output in toasts, copilot responses, and card titles is escaped using `escapeHtml()` utilities.
- **CSP Headers**: Standardized CSP policies deployed in `server.js` restricting `default-src 'self'`, `frame-src https://accounts.google.com`, `script-src` and `connect-src` to official Google and Firebase endpoints.
