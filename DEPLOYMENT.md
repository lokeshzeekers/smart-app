# SMArT - Deployment, Mobile App and Pipeline Guide

SMArT runs as one small server (Docker) with automatic HTTPS. Trainees and trainers open
the site on a phone and **install it as an app** (PWA). Every push to `main` is tested and
then deployed by GitHub Actions.

```
 phone / PC ──HTTPS──> Caddy (web container) ─┬─ static app (installable PWA)
 ESP32 manikin ─HTTPS─┘                        └─ /api, /socket.io ──> backend ──> PostgreSQL
```

---

## 1. One-time server setup

You need a small Linux VPS (1 vCPU / 1-2 GB RAM is enough), a domain name, and ports **80 and 443** open.

1. **DNS:** create an `A` record, e.g. `smart.yourdomain.com` -> the server's IP. Wait until it resolves.
2. **Install Docker + Git** (Ubuntu): `curl -fsSL https://get.docker.com | sh && sudo apt install -y git`
3. **Get the code:**
   ```bash
   sudo mkdir -p /opt/smart && sudo chown $USER /opt/smart
   git clone https://github.com/lokeshzeekers/smart-app.git /opt/smart
   cd /opt/smart
   ```
   (The repo is private? Use a deploy key or `gh auth login` on the server. Do not paste tokens into chats.)
4. **Configure:** `cp .env.production.example .env`, then edit `.env`:
   - `DOMAIN`, `ACME_EMAIL`
   - `POSTGRES_PASSWORD` and `JWT_SECRET`: each `openssl rand -hex 32`
   - SMTP settings if you want real OTP e-mails (otherwise codes only appear in `docker compose -f docker-compose.prod.yml logs backend`)
5. **Start:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   This builds everything, creates the database, runs the migrations and gets the HTTPS certificate (first start takes a minute or two).
6. **Create the first admin:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend node scripts/create-admin.js "you@example.com" "Your Name" "a-strong-password"
   ```
7. Open `https://smart.yourdomain.com` and sign in.

Check health any time: `curl https://smart.yourdomain.com/health`

> Existing database? Migrations are tracked (`schema_migrations`) and safe to re-run: already-applied ones are skipped.
> Sessions recorded **before** migration 006 have the old order for steps 10/11 (ETT and stylet are swapped); new sessions are correct.

---

## 2. Install as a phone app

- **Android (Chrome):** open the site -> tap **Install app** on the card that appears (or menu -> *Install app*).
- **iPhone/iPad (Safari only):** Share button -> **Add to Home Screen**.

It opens full-screen with its own icon. Live data needs internet; the app shell opens offline and shows an "offline" banner.

**Updates:** when you deploy a new version, users see a **"New version available - Update"** banner the next time they open the app (checked hourly and when the app is brought back to the front). Nobody needs to reinstall.

---

## 3. The pipeline (GitHub Actions)

Two workflows in `.github/workflows/`:

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every push / pull request | backend tests (incl. real-Postgres migrations), frontend typecheck + build, firmware host tests, Docker image builds |
| `deploy.yml` | after CI succeeds on `main` (or run manually) | SSH to the server and run `scripts/deploy.sh` |

`scripts/deploy.sh` backs up the database, pulls the exact commit, rebuilds, waits for `/health`, and **rolls back to the previous commit if the new one doesn't come up healthy**.

### Set up auto-deploy (once)

1. **On your computer** create a deploy-only key:
   `ssh-keygen -t ed25519 -f smart_deploy -N "" -C "smart-deploy"`
2. **On the server** append `smart_deploy.pub` to `~/.ssh/authorized_keys` of the deploy user (the user must be in the `docker` group).
3. **In GitHub:** repo -> *Settings -> Secrets and variables -> Actions -> New repository secret*:

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | server IP or hostname |
   | `DEPLOY_USER` | SSH user |
   | `DEPLOY_PORT` | SSH port (usually `22`) |
   | `DEPLOY_PATH` | `/opt/smart` |
   | `DEPLOY_SSH_KEY` | full contents of the private file `smart_deploy` |
   | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -p 22 YOUR_HOST` |

4. *Settings -> Environments -> New environment* named **production** (optionally add yourself as a required reviewer for approval before each deploy).
5. Delete the local `smart_deploy` files afterwards.

Test it: *Actions -> Deploy -> Run workflow*. From then on: **push to `main` = tested and live in a few minutes.** Use a branch + pull request if you want CI to check first without deploying.

---

## 4. Backups, restore, rollback

- **Daily backup** (server crontab, `crontab -e`):
  `15 2 * * * cd /opt/smart && ./scripts/backup-db.sh >> backups/cron.log 2>&1`
  The newest 14 dumps are kept in `/opt/smart/backups/`. Also copy them off the server now and then.
- **Restore:**
  `gunzip -c backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U smart_user smart_airway`
- **Manual rollback:** `git checkout <good-commit> && docker compose -f docker-compose.prod.yml up -d --build`
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f backend`

---

## 5. Pointing the ESP32 manikin at the server

In `firmware/smart_cloud/smart_config.h`:

```c
#define SMART_BACKEND_HOST "https://smart.yourdomain.com"
```

- By default the certificate is not verified (traffic is still encrypted). For full verification define `SMART_ROOT_CA` with the Let's Encrypt root (ISRG Root X1).
- Register the manikin in the app first (Admin -> Manikins) so its device ID/key match. Full wiring and assignment details: `firmware/CLOUD_INTEGRATION.md`.
- Not tested on real hardware yet: do a first bench test when the device is ready (watch the Serial Monitor).

---

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| Site not loading / no padlock | DNS points at the server? ports 80/443 open? `docker compose -f docker-compose.prod.yml logs web` |
| `up` fails with "required variable ... missing" | fill `.env` (DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, JWT_SECRET) |
| Login OTP never arrives | SMTP not set: read the code from the backend log |
| Install option not offered | must be HTTPS; on iPhone use Safari -> Add to Home Screen |
| App shows old version | wait for the update banner, or close and reopen the app once |
| Deploy job fails at SSH | recheck `DEPLOY_*` secrets and `DEPLOY_KNOWN_HOSTS` |
