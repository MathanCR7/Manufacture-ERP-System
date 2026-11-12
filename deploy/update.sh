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

echo "⚙️ [2/5] Updating Backend (dependencies, prisma schema, db push, migrations)..."
cd /var/www/manufacture-erp/apps/backend
npm install

# Ensure database permissions, ownership and Employee Master schema
sudo -u postgres psql -d erp_manufacture -c "
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"contact_no\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"dob\" TIMESTAMP WITHOUT TIME ZONE;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"doj\" TIMESTAMP WITHOUT TIME ZONE;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"gender\" VARCHAR(20);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"blood_group\" VARCHAR(20);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"father_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"father_contact\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"mother_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"mother_contact\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"husband_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"husband_contact\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"spouse_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"spouse_contact\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"present_address\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"permanent_address\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"aadhar\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"pan\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"epfo_no\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"esi_no\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_account_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_name\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_account_no\" VARCHAR(100);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_branch\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_ifsc\" VARCHAR(50);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"family_remarks\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"attachments\" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"gross_pay\" NUMERIC(12, 2);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"yearly_ctc\" NUMERIC(12, 2);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"working_hours\" VARCHAR(100);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"family_photos\" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"selfie_photo\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"selfie_location\" VARCHAR(255);
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"cv\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"present_address_proof\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"permanent_address_proof\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"aadhar_doc\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"pan_doc\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"bank_proof\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"family_doc\" TEXT;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"contacts\" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"emails\" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"has_app_access\" BOOLEAN DEFAULT true;
  ALTER TABLE \"User\" OWNER TO leonex_web_user;
  ALTER TABLE production_batches OWNER TO leonex_web_user;
  GRANT erp_user TO leonex_web_user;
  GRANT ALL PRIVILEGES ON SCHEMA public TO leonex_web_user, erp_user, PUBLIC;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO leonex_web_user, erp_user, PUBLIC;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO leonex_web_user, erp_user, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO leonex_web_user, erp_user, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO leonex_web_user, erp_user, PUBLIC;
" 2>/dev/null || true

sudo -u postgres psql -d erp_manufacture <<'EOSQL' 2>/dev/null || true
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'leonex_web_user' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO leonex_web_user', r.tablename);
  END LOOP;
  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewowner <> 'leonex_web_user' LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO leonex_web_user', r.viewname);
  END LOOP;
END
$$;
EOSQL

npx prisma generate
node src/database/migrations/ensure_expense_and_asset_schema.js
node src/database/migrations/ensure_production_batches_redesign_schema.js || true
node src/database/migrations/ensure_user_employee_master_schema.js || true
node src/database/migrations/safe_prisma_sync.js
node src/database/migrations/run_standard_production_migration.js || true
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

echo "📁 Ensuring uploads directory permissions..."
mkdir -p /var/www/manufacture-erp/apps/backend/uploads/employees
mkdir -p /var/www/manufacture-erp/apps/backend/uploads/invoices
mkdir -p /var/www/manufacture-erp/apps/backend/uploads/payments
if [ -d "/var/www/manufacture-erp/apps/backend/uploads/employees/VTE000001" ] && [ ! -d "/var/www/manufacture-erp/apps/backend/uploads/employees/VTE0001" ]; then
    cp -r /var/www/manufacture-erp/apps/backend/uploads/employees/VTE000001 /var/www/manufacture-erp/apps/backend/uploads/employees/VTE0001 || true
fi
chmod -R 777 /var/www/manufacture-erp/apps/backend/uploads || true

echo "🌐 [5/5] Updating & Reloading Nginx Web Server..."
if [ -f /etc/nginx/sites-available/erp.leonex.net ]; then
    sudo cp /var/www/manufacture-erp/deploy/nginx/erp.leonex.net.conf /etc/nginx/sites-available/erp.leonex.net
    sudo ln -sf /etc/nginx/sites-available/erp.leonex.net /etc/nginx/sites-enabled/ || true
fi
sudo nginx -t && sudo systemctl reload nginx

echo "=========================================================="
echo "🎉 SUCCESS: Production has been updated to $CURRENT_COMMIT!"
echo "Visit: https://erp.leonex.net/finance/expenses"
echo "=========================================================="
