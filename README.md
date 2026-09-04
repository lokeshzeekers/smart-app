# SMArT — Simulation-based Management of Airway Training

A production-style full-stack app for airway/intubation training on an ESP32-instrumented
manikin, with separate **Trainee** and **Trainer** experiences.

```
smart-app/
├── backend/         Node.js + Express + PostgreSQL + Socket.io API
├── frontend/        React + Vite installable PWA (Trainee + Trainer UI)
└── docker-compose.yml
```

---

## 1. What's real vs. what's mocked (read this first)

| Feature | Status |
|---|---|
| Trainee email + OTP login | ✅ Real (OTP is printed to backend console — plug in SES/SendGrid via `SMTP_*` env vars to actually email it) |
| Trainer email + password login | ✅ Real (bcrypt-hashed passwords, JWT) |
| APAAR ID / Aadhaar "Continue with" buttons | ⚠️ **Mocked.** Real UIDAI eKYC / DigiLocker integration requires government sandbox approval that's outside what can be built generically. The endpoint (`POST /api/auth/identity/mock`) simulates a successful verification callback and issues a real JWT, so swapping in the real provider later only touches this one endpoint — the rest of the app (sessions, auth, DB) doesn't change. |
| ESP32 → app real-time data | ✅ Real. Device authenticates with an API key (not a user login), pushes step-by-step events over the API, and the app reflects them live via WebSocket. |
| Auto Pass / Fail / Bad Technique scoring | ✅ Real, rule-based (see `backend/src/utils/scoring.js`), fully editable thresholds per institution in `scoring_thresholds` table. Trainer always has final say — this is a *suggestion*, not an auto-decision. |
| Push notifications to phone (native) | ⚠️ Not included — the app currently shows in-app notification badges over WebSocket. Real push (FCM/APNs) needs native wrapping (see §5). |

---

## 2. Local setup

### Prerequisites
- Node.js 18+
- Docker (recommended) or a local PostgreSQL 16 instance

### Fastest path (Docker)
```bash
cd smart-app
cp backend/.env.example backend/.env      # edit JWT_SECRET at minimum
docker compose up -d                      # starts Postgres (schema+seed auto-applied) + backend on :4000
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                               # http://localhost:5173
```

### Manual backend (without Docker)
```bash
cd backend
cp .env.example .env                      # point DATABASE_URL at your Postgres
npm install
npm run migrate                           # applies schema.sql
npm run seed                              # loads 11 steps + demo institutions
npm run dev                               # nodemon on :4000
```

### Create your first trainer account
There's no public trainer sign-up screen (by design — trainers are provisioned by an admin).
Insert one directly for now:
```sql
INSERT INTO institutions (name, short_code) VALUES ('Test Institute','TEST')
  ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, role, institution_id, is_verified)
VALUES (
  'trainer@test.edu',
  '$2a$10$examplehashreplaceme',   -- generate with: node -e "console.log(require('bcryptjs').hashSync('yourpassword',10))"
  'Dr. Trainer',
  'trainer',
  (SELECT id FROM institutions WHERE short_code='TEST'),
  true
);
```

---

## 3. ESP32 firmware integration

Each manikin device is registered once in the `devices` table with a hashed API key.
The firmware then calls two endpoints during a trainee's attempt:

**Per-step, as each of the 11 steps is detected:**
```
POST /api/esp32/sessions/:sessionId/steps
Headers: x-device-id: <device_uid>, x-device-key: <raw api key>
Body:    { "stepNo": 7, "metricValue": 22 }
```

**Once the trial finishes, with the four fixed summary metrics:**
```
POST /api/esp32/sessions/:sessionId/complete
Headers: x-device-id: <device_uid>, x-device-key: <raw api key>
Body: {
  "laryngoscopeLiftForce": 22,
  "timeToPlaceEtt": 2.18,
  "ettLocationCm": -1,
  "totalTimeToIntubate": 62
}
```

The trainee's `sessionId` is created by the app when they tap Coach/Check/Certification
(`POST /api/trainee/sessions`) — display it as a QR code or short code on the phone screen
for the ESP32/gateway to pick up, or pass it over your existing BLE pairing handshake.

Register a device (run once per manikin, e.g. via a small admin script or `psql`):
```sql
-- generate api_key_hash with: node -e "console.log(require('bcryptjs').hashSync('your-raw-device-key',10))"
INSERT INTO devices (device_uid, label, institution_id, api_key_hash)
VALUES ('ESP32-MANIKIN-01', 'Skills Lab Manikin 1',
        (SELECT id FROM institutions WHERE short_code='IIT-M'), '<hash>');
```

---

## 4. Deploying to production

- **Database**: any managed Postgres (RDS, Supabase, Neon, Azure Database for PostgreSQL). Run `backend/db/schema.sql` then `seed.sql` once.
- **Backend**: the included `Dockerfile` runs anywhere that takes a container (Fly.io, Render, Railway, ECS, a plain VM). Set real env vars — especially `JWT_SECRET`, `DATABASE_URL`, `CLIENT_ORIGIN`, and `SMTP_*` for real OTP emails.
- **Frontend**: `npm run build` in `frontend/` produces a static `dist/` folder — deploy to Vercel, Netlify, Cloudflare Pages, or any static host/CDN. Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to your deployed backend's HTTPS URL before building.
- Put the backend behind HTTPS (required for the PWA install prompt and for camera/BLE APIs if you add device pairing later).

---

## 5. Installing this as a free app on a phone (no store fee)

The frontend is already configured as an installable **Progressive Web App** — this is the
zero-cost path you asked for, since it needs no Apple Developer account ($99/yr) or Google
Play registration ($25 one-time) to get onto a phone's home screen.

**Android (Chrome):**
1. Open the deployed HTTPS site in Chrome.
2. Chrome shows an "Install app" banner automatically, or tap ⋮ → **Install app**.
3. It installs like a native app: home-screen icon, full-screen (no browser bar), works offline for already-visited screens.

**iOS (Safari):**
1. Open the deployed HTTPS site in Safari.
2. Tap the Share icon → **Add to Home Screen**.
3. It launches full-screen from the home screen icon, same as Android.

Both are entirely free, install directly from your own domain, and update automatically
whenever you deploy a new build (the service worker in `vite-plugin-pwa` handles this).

### If you later want real app-store listings (still low/no-cost options)
- **Capacitor** (`@capacitor/core`) can wrap this exact React build into a native iOS/Android
  project with almost no code changes — useful if you need native push notifications,
  Bluetooth pairing with the ESP32, or a Play Store / App Store listing later. This still
  requires the store developer fees mentioned above only if you choose to *list* it; sideloaded
  Android APKs remain free.
- Until then, the PWA path above satisfies "installable, free of cost" exactly as requested.

---

## 6. Design tokens used throughout the UI

- **Type**: Poppins (headings/display) + Roboto (body/data), loaded via Google Fonts.
- **Color**: deep clinical teal-blue (`#0B4F6C` primary) for a trustworthy, professional
  medical feel; semantic green/amber/red strictly reserved for Pass / Bad Technique / Fail
  so status is never ambiguous at a glance.
- Fully defined in `frontend/tailwind.config.js` — change tokens there to re-theme globally.

---

## 7. Open items to confirm with you before going further

- Real SMTP provider for OTP emails (SES / SendGrid / other)?
- Real APAAR/Aadhaar sandbox credentials, once you have them?
- Exact ESP32 → backend transport: direct WiFi HTTP calls (as coded above), or via a BLE-to-phone-to-API relay? The two per-step/complete endpoints work the same either way, just called from a different layer.
- Do trainers need their own self-service sign-up, or will you provision trainer accounts manually per institution?
