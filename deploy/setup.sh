#!/bin/bash
# ==============================================================================
# One-Time Server Setup Script for Manufacturing ERP
# Subdomain: erp.leonex.net
# Target OS: Ubuntu 22.04 LTS
# ==============================================================================

set -e

echo "======================================================"
echo "🚀 Manufacturing ERP VPS Initial Setup"
echo "Target Domain: erp.leonex.net"
echo "======================================================"

# 1. Ensure Running with sudo or as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script with sudo: sudo bash deploy/setup.sh"
  exit 1
fi

REAL_USER=${SUDO_USER:-$USER}

# 2. Check and Install Node.js 20 LTS if missing
if ! command -v node > /dev/null 2>&1; then
    echo "📦 Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    NODE_VER=$(node -v)
    echo "✅ Node.js is already installed (${NODE_VER})"
fi

# 3. Check and Install PM2 globally
if ! command -v pm2 > /dev/null 2>&1; then
    echo "📦 Installing PM2 process manager globally..."
    npm install -g pm2
    pm2 startup systemd -u $REAL_USER --hp /home/$REAL_USER || true
else
    echo "✅ PM2 is already installed"
fi

# 4. Check PostgreSQL
if command -v psql > /dev/null 2>&1; then
    echo "✅ PostgreSQL is installed."
    echo "Creating database 'erp_manufacture' if not exists..."
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'erp_manufacture'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE erp_manufacture;"
    echo "✅ Database 'erp_manufacture' ready."
else
    echo "⚠️ PostgreSQL not found. Installing postgresql..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    sudo -u postgres psql -c "CREATE DATABASE erp_manufacture;"
    echo "✅ PostgreSQL installed and database 'erp_manufacture' created."
fi

# 5. Setup Project Folder Permissions
PROJECT_DIR="/var/www/manufacture-erp"
echo "📁 Setting up project directory at $PROJECT_DIR..."
mkdir -p $PROJECT_DIR
chown -R $REAL_USER:$REAL_USER $PROJECT_DIR

# 6. Configure Nginx for erp.leonex.net
NGINX_CONF_SRC="$PROJECT_DIR/deploy/nginx/erp.leonex.net.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/erp.leonex.net"
NGINX_ENABLED="/etc/nginx/sites-enabled/erp.leonex.net"

if [ -f "$NGINX_CONF_SRC" ]; then
    echo "⚙️ Linking Nginx configuration..."
    cp "$NGINX_CONF_SRC" "$NGINX_AVAILABLE"
    ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
    
    # Test Nginx syntax
    nginx -t
    systemctl reload nginx
    echo "✅ Nginx reloaded successfully. erp.leonex.net virtual host active!"
else
    echo "⚠️ Nginx config not found at $NGINX_CONF_SRC yet. It will be linked when repo is cloned."
fi

# 7. Ensure Certbot is available for SSL
if ! command -v certbot > /dev/null 2>&1; then
    echo "📦 Installing Certbot for free SSL..."
    apt-get install -y certbot python3-certbot-nginx
fi

echo "======================================================"
echo "🎉 VPS Setup Completed Successfully!"
echo ""
echo "Next Steps:"
echo "1. Configure GitHub Actions Secrets in your repository:"
echo "   - VPS_HOST: 66.116.199.153"
echo "   - VPS_USER: $REAL_USER (or root)"
echo "   - VPS_SSH_KEY: Your private SSH key (or VPS_PASSWORD)"
echo ""
echo "2. Obtain free HTTPS Certificate with Certbot:"
echo "   sudo certbot --nginx -d erp.leonex.net"
echo "======================================================"
