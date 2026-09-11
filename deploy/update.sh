#!/bin/bash
# ==============================================================================
# Fast Production Update Script for Manufacturing ERP (erp.leonex.net)
# Usage on server: bash /var/www/manufacture-erp/deploy/update.sh
# ==============================================================================

set -e

echo "🚀 [1/5] Pulling latest code from GitHub..."
cd /var/www/manufacture-erp
git fetch origin main
git reset --hard origin/main
CURRENT_COMMIT=$(git log -1 --oneline)
echo "✅ Synced to: $CURRENT_COMMIT"

echo "⚙️ [2/5] Updating Backend (dependencies, prisma schema, db push)..."
cd /var/www/manufacture-erp/apps/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss

echo "🔄 [3/5] Reloading PM2 Backend Server..."
if pm2 describe erp-backend > /dev/null 2>&1; then
    pm2 reload erp-backend --update-env
else
    pm2 start src/server.js --name "erp-backend"
fi
pm2 save

echo "🎨 [4/5] Building Frontend (Vite Production Build)..."
cd /var/www/manufacture-erp/apps/frontend
npm install
npm run build

echo "🌐 [5/5] Reloading Nginx Web Server..."
sudo systemctl reload nginx

echo "=========================================================="
echo "🎉 SUCCESS: Production has been updated to $CURRENT_COMMIT!"
echo "Visit: https://erp.leonex.net/finance/expenses"
echo "=========================================================="
