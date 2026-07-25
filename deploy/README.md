# Deploy — FinInvest (fininvest.uz)

Production runs the stack with Docker Compose: **MySQL + backend + 4 role web apps + nginx + certbot**.
nginx **terminates TLS itself**, published on **`8080` (HTTP)** + **`9443` (HTTPS)**. An **edge box
(`87.x`)** receives the public domains and forwards **public `:80` → this host `:8080`** and
**public `:443` → this host `:9443`**. Deploy is **manual** (CI only builds/tests — it does not deploy).

```
 domains ─▶ 87.x  (edge: pure port-forward / NAT, no TLS)
              │  public :80  ──▶  app-host :8080  ──▶  nginx :80   (ACME + redirect)
              └  public :443 ──▶  app-host :9443  ──▶  nginx :443  (TLS terminates here)
```

## 0. Server setup (one time — Ubuntu 22.04 or 24.04)

```bash
git clone https://github.com/khurshid28/fininvest.git
cd fininvest
sudo bash deploy/server-setup.sh   # installs Docker + Compose plugin, opens firewall (22/8080/9443)
```

- **DNS A-records** (you manage these) all point at the **edge IP `87.x`**:
  `api`, `operator`, `moderator`, `director`, `admin` `.fininvest.uz`.
  (apex / `www` / `mail` / `ftp` are not used by the app.)
- **Edge port-forward** (you configure on `87.x`): public `80 → <app-host>:8080`,
  public `443 → <app-host>:9443`. Both must be a plain L4 forward — the edge must **not**
  terminate TLS (this stack does), and must preserve the client's `Host`/SNI.

## 1. First install

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env            # set MYSQL_ROOT_PASSWORD, JWT_SECRET, DATABASE_URL
bash deploy/deploy.sh       # builds, starts, syncs schema (prisma db push), seeds
```

Seed logins (password `parol123`): `operator`, `moderator`, `director`, `admin`.

## 2. TLS (one time, after DNS + the edge `80 → 8080` forward are live)

```bash
bash deploy/init-letsencrypt.sh
```

Issues one Let's Encrypt certificate covering all 5 names and reloads nginx. The ACME http-01
challenge is fetched over `http://<domain>/` → edge `:80` → this host `:8080` → nginx `:80`
(served from the certbot webroot), so the edge's `80 → 8080` forward **must** be working first.
The `certbot` container then auto-renews every 12h.

> Cert lives in this stack (`deploy/nginx/certs`), not on the edge — the edge only forwards
> packets. Email is `CERTBOT_EMAIL` in `deploy/.env` (preset to `khurshidi2827@gmail.com`).

## 3. Update (deploy new code)

```bash
bash deploy/update.sh        # git pull → rebuild → restart (schema re-synced on backend start)
```

## 4. Environment (`deploy/.env`)

| Var | Meaning |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password (internal network only) |
| `JWT_SECRET` | backend JWT signing secret (long random) |
| `DATABASE_URL` | `mysql://root:<pw>@mysql:3306/fininvest` |
| `VITE_API_URL` | baked into web builds — `https://api.fininvest.uz` |
| `CORS_ORIGINS` | the 4 role origins, comma-separated |
| `CERTBOT_EMAIL` | Let's Encrypt contact (nginx terminates TLS in-stack) |
| `PUBLIC_VERIFY_URL` | origin the printed QR points at — `https://api.fininvest.uz` |

`deploy/.env` is gitignored — never commit it.

**`PUBLIC_VERIFY_URL` must be set before anyone signs.** The URL is encoded into a QR, printed
onto every document and frozen into the stored PDF. Unset, the backend refuses to sign in
production rather than issue documents whose QR resolves to `localhost` — a failure that would
only surface when someone first scanned one, by which time the documents cannot be reprinted.

## 4a. E-IMZO (director signing)

Signing runs entirely on the director's own machine: E-IMZO reads the key from their disk, asks
for the password in its own window, and only the finished PKCS#7 reaches us. Neither the key nor
the password touches the browser or the server.

Two things the directors have to be told:

**The password window opens behind the browser.** It is a separate desktop window and it is easy
to miss — the signing dialog says so at that step, but people still report "it froze". Check the
taskbar.

**«Режим разработчика» is currently required, and it is not free.** E-IMZO only accepts requests
from `localhost` and `127.0.0.1`; any other origin gets `-1022 API-key для домена … недействителен`.
Until NIC issues a domain API-KEY for our production host, each director must enable E-IMZO's
developer mode — which drops the origin check **for every site they visit, not just ours**.
E-IMZO's password window does not name who asked for it, so with that mode on it is the human,
not the code, deciding whether a prompt is legitimate. Getting the domain API-KEY removes this.

Signatures are stored but **not verified**: checking an O'zDSt 1092:2009 signature needs
E-IMZO-SERVER and a NIC contract we do not have. `CaseSignature.verified` is always `false`, and
nothing in the UI claims otherwise. A third party with E-IMZO-SERVER can verify what we store.

## 5. Routing

The edge forwards every subdomain to this host's `8080`/`9443`; the stack's nginx terminates
TLS and splits by `Host`:

| Host | → |
|---|---|
| `api.fininvest.uz` | backend (NestJS :3000) |
| `operator/moderator/director/admin.fininvest.uz` | the matching role web app |

## 6. Ops

- Logs: `docker compose logs -f backend` (or `nginx`, `web-operator`, …).
- Status: `docker compose ps`.
- Rollback: `git checkout <previous-commit-or-tag> && bash deploy/update.sh`.
- DB is **not** exposed to the host; reach it via `docker compose exec mysql mysql -uroot -p`.

## Notes

- Schema is applied with `prisma db push` (additive-safe, matches dev). For audited migrations later,
  switch the backend `Dockerfile.backend` CMD to `prisma migrate deploy` and add migration files.
- The 4 web apps share `packages/ui` (`RoleApp`); each image is built with its own `APP` arg.
