# 🚀 Production Deployment & CI/CD Guide for Manufacturing ERP

This guide provides step-by-step instructions to deploy the Manufacturing ERP System to your Ubuntu 22.04 LTS VPS on **`erp.leonex.net`** with automated **GitHub Actions CI/CD**.

---

## 🏗️ Architecture & Isolation

| Component | Setting | Notes |
| :--- | :--- | :--- |
| **Existing Website** | `leonex.net` | **Completely untouched & isolated** |
| **ERP Subdomain** | `erp.leonex.net` | Dedicated Nginx Virtual Host |
| **Server IP** | `66.116.199.153` | Ubuntu 22.04 LTS (KVM VPS) |
| **Backend Service** | PM2 (`erp-backend`) | Node.js Express running on internal port `5000` |
| **Database** | PostgreSQL | Dedicated database: `erp_manufacture` |
| **Frontend Assets** | `/var/www/manufacture-erp/apps/frontend/dist` | Served by Nginx with client-side SPA routing |
| **SSL / HTTPS** | Let's Encrypt Certbot | Free automatic renewal |
| **Real-time Events** | SSE (`/api/notifications/stream`) | Configured with `proxy_buffering off;` |

---

## 📋 Step-by-Step Deployment Procedure

### Step 1: Add DNS Record for `erp.leonex.net`
Log into your domain registrar (GoDaddy, Cloudflare, Namecheap, or Hostinger where `leonex.net` is registered):
1. Go to **DNS Management** for `leonex.net`.
2. Add a new **A Record**:
   - **Type**: `A`
   - **Name / Host**: `erp`
   - **Value / Points to**: `66.116.199.153`
   - **TTL**: `Automatic` or `300 seconds` (5 minutes)
3. Save the record. *(Propagation usually takes 2-10 minutes)*.

---

### Step 2: Configure GitHub Actions Secrets
In your GitHub repository:
👉 [https://github.com/MathanCR7/Manufacture-ERP-System/settings/secrets/actions](https://github.com/MathanCR7/Manufacture-ERP-System/settings/secrets/actions)

Click **New repository secret** and add the following:

| Secret Name | Example Value | Description |
| :--- | :--- | :--- |
| `VPS_HOST` | `66.116.199.153` | Your VPS IP address |
| `VPS_USER` | `root` *(or your ssh user)* | SSH username |
| `VPS_PASSWORD` | *Your VPS Root Password* | Used for SSH connection (if not using SSH key) |
| `VPS_SSH_KEY` | *(Optional if password set)* | Private SSH key (e.g. `id_rsa`) |
| `VPS_PORT` | `22` | Default SSH port |

> [!TIP]
> You only need either `VPS_PASSWORD` OR `VPS_SSH_KEY`. If your VPS accepts password login, `VPS_PASSWORD` is all you need!

---

### Step 3: Run Initial One-Time Server Setup on VPS
Open your VPS terminal (via SSH or VNC Web Terminal):

Run this single setup command:
```bash
# 1. Clone repository into /var/www/manufacture-erp
sudo mkdir -p /var/www/manufacture-erp
sudo chown -R $USER:$USER /var/www/manufacture-erp
git clone https://github.com/MathanCR7/Manufacture-ERP-System.git /var/www/manufacture-erp

# 2. Run the automated server setup script
cd /var/www/manufacture-erp
sudo bash deploy/setup.sh
```

What this does automatically:
- Checks & installs Node.js 20 LTS and PM2 globally.
- Verifies PostgreSQL and creates the dedicated database `erp_manufacture`.
- Links `/etc/nginx/sites-available/erp.leonex.net` to `/etc/nginx/sites-enabled/`.
- Validates Nginx syntax and reloads Nginx safely without interrupting `leonex.net`.

---

### Step 4: Configure Backend Environment Variables
On your VPS, edit the `.env` file to customize your database password or JWT secret:
```bash
cd /var/www/manufacture-erp/apps/backend
nano .env
```
Ensure your database connection string and secrets are set:
```env
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/erp_manufacture?schema=public&connection_limit=50"
DIRECT_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/erp_manufacture?schema=public&connection_limit=50"
JWT_SECRET="super_secret_jwt_key_here"
PORT=5000
FRONTEND_URL="https://erp.leonex.net"
PUBLIC_APP_URL="https://erp.leonex.net"
SMTP_EMAIL="mathanleonex123@gmail.com"
SMTP_PASSWORD="dbwk kcfm ibcl uklh"
```
Press `Ctrl + O`, then `Enter` to save, and `Ctrl + X` to exit.

Run the initial database migration:
```bash
npx prisma db push
```

---

### Step 5: Obtain Free SSL Certificate (HTTPS)
Once your DNS record (`erp.leonex.net`) is pointed to `66.116.199.153`, run:
```bash
sudo certbot --nginx -d erp.leonex.net
```
- Enter your email address for renewal alerts.
- Agree to the terms of service.
- Certbot will automatically install the SSL certificate and redirect all HTTP traffic to HTTPS!

---

### Step 6: Test CI/CD (Push to Deploy)
Every time you push code changes to the `main` branch:
```bash
git add .
git commit -m "feat: new update"
git push origin main
```
1. GitHub Actions will trigger immediately.
2. It builds and verifies the frontend.
3. It connects to your VPS securely over SSH.
4. It pulls the latest code, pushes database changes (`prisma db push`), reloads the PM2 backend process with zero downtime, builds the latest frontend, and reloads Nginx.
5. Your changes are live on **`https://erp.leonex.net`** in ~60 seconds!

---

## 🛠️ Server Cheatsheet & Troubleshooting

### PM2 Backend Process
- View running processes: `pm2 list`
- View real-time logs: `pm2 logs erp-backend`
- Restart backend: `pm2 restart erp-backend`
- Stop backend: `pm2 stop erp-backend`

### Nginx Service
- Test Nginx syntax: `sudo nginx -t`
- Reload Nginx: `sudo systemctl reload nginx`
- View Nginx error logs: `sudo tail -n 50 -f /var/log/nginx/error.log`

### PostgreSQL
- Access PostgreSQL console: `sudo -u postgres psql`
- Connect to ERP database: `\c erp_manufacture`
- View tables: `\dt`
- Exit console: `\q`
