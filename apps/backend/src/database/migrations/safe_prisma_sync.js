const { execSync } = require('child_process');
const path = require('path');
const prisma = require('../prisma');

/**
 * Safely splits a Prisma migrate diff SQL script into top-level DDL statements
 * while stripping pure comment lines.
 */
function parseSqlStatements(sqlScript) {
  const cleanedLines = String(sqlScript || '')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'));
  return cleanedLines
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map(stmt => stmt.trim())
    .filter(Boolean);
}

/**
 * Determines whether a generated Prisma DDL statement is strictly additive/non-destructive.
 * Never allows DROP TABLE / DROP COLUMN / DROP CONSTRAINT / DROP INDEX to wipe raw-SQL tables
 * (such as production_batch_merge, production_batch_days, finished_product_stock_lots, or ice_cream_moulds).
 */
function isSafeAdditiveStatement(stmt) {
  if (!stmt) return false;
  if (/\bDROP\s+(?:TABLE|COLUMN|INDEX|CONSTRAINT|FOREIGN\s+KEY|VIEW)\b/i.test(stmt)) {
    return false;
  }
  if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(stmt)) return true;
  if (/^CREATE\s+TABLE\b/i.test(stmt)) return true;
  if (/^ALTER\s+TABLE\b/i.test(stmt)) {
    // Allow ADD COLUMN / ADD CONSTRAINT only; skip risky DROP / ALTER COLUMN SET NOT NULL changes
    if (/\bALTER\s+COLUMN\b/i.test(stmt)) return false;
    return /\bADD\s+(?:COLUMN|CONSTRAINT|FOREIGN\s+KEY)\b/i.test(stmt);
  }
  return false;
}

/**
 * Makes CREATE / CREATE INDEX / ADD COLUMN statements idempotent.
 */
function normalizeIdempotentStatement(stmt) {
  let out = stmt;
  if (/^CREATE\s+TABLE\s+"/i.test(out)) {
    out = out.replace(/^CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
  } else if (/^CREATE\s+UNIQUE\s+INDEX\s+"/i.test(out)) {
    out = out.replace(/^CREATE\s+UNIQUE\s+INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
  } else if (/^CREATE\s+INDEX\s+"/i.test(out)) {
    out = out.replace(/^CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ');
  } else if (/^ALTER\s+TABLE\b/i.test(out) && /\bADD\s+COLUMN\b/i.test(out)) {
    out = out.replace(/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi, 'ADD COLUMN IF NOT EXISTS ');
  }
  return out;
}

/**
 * Computes additive diff from live DB to schema.prisma and applies safe statements only.
 */
async function runSafePrismaSync() {
  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const schemaPath = 'src/database/prisma/schema.prisma';

  const diffSql = execSync(
    `npx prisma migrate diff --from-schema-datasource "${schemaPath}" --to-schema-datamodel "${schemaPath}" --script`,
    {
      cwd: backendRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  const statements = parseSqlStatements(diffSql);
  let applied = 0;
  let skipped = 0;

  for (const rawStmt of statements) {
    if (!isSafeAdditiveStatement(rawStmt)) {
      skipped += 1;
      continue;
    }
    const safeSql = normalizeIdempotentStatement(rawStmt);
    try {
      await prisma.$executeRawUnsafe(`${safeSql};`);
      applied += 1;
    } catch (err) {
      // Ignore benign duplicate constraint errors when re-running against synced databases
      if (/already exists/i.test(err.message)) {
        skipped += 1;
      } else {
        console.warn('[safe_prisma_sync] Statement warning:', err.message, '\nSQL:', safeSql);
      }
    }
  }

  console.log(`[safe_prisma_sync] Applied ${applied} additive schema change(s); safely skipped ${skipped} non-additive/legacy diff statement(s).`);
}

if (require.main === module) {
  runSafePrismaSync()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('[safe_prisma_sync] Sync failed:', err.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { runSafePrismaSync, parseSqlStatements, isSafeAdditiveStatement, normalizeIdempotentStatement };

