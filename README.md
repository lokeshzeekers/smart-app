# SMArT - Airway Training

Trainee/trainer web app (React + Node + PostgreSQL, installable on phones as a PWA) paired with an ESP32 intubation manikin.

- **Deploy, install as a phone app, CI/CD pipeline:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Manikin firmware, wiring and how manikin/trainer/trainee connect:** [firmware/CLOUD_INTEGRATION.md](firmware/CLOUD_INTEGRATION.md)

## Local development

```bash
docker compose up -d postgres         # or any local PostgreSQL
cd backend && cp .env.example .env && npm install && node scripts/migrate.js && npm run dev
cd frontend && npm install && npm run dev
```

## Tests

```bash
cd backend && npm test                  # API, scoring, migrations (in-memory Postgres)
cd frontend && npm run typecheck && npm run build
firmware/smart_cloud/test/run_tests.sh  # real firmware code against the real backend routes
```
