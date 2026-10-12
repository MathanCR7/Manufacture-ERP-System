const fs = require('fs');
const path = require('path');

const BASE_UPLOADS_DIR = path.join(__dirname, '../../uploads');
const EXPENSES_UPLOADS_DIR = path.join(BASE_UPLOADS_DIR, 'expenses');

// Ensure the directory exists on startup
try {
  if (!fs.existsSync(EXPENSES_UPLOADS_DIR)) {
    fs.mkdirSync(EXPENSES_UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create expense uploads directory:', err);
}

/**
 * Gets or creates dedicated folder for an expense:
 * uploads/expenses/{expenseId}/
 */
function getExpenseDir(expenseId) {
  const safeId = String(expenseId || 'temp_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(EXPENSES_UPLOADS_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { dir, safeId };
}

/**
 * Deletes a single attachment file from disk based on URL or relative path.
 * Protects storage by ensuring unlinked files are permanently deleted.
 */
function deleteExpenseAttachmentFile(fileUrlOrPath) {
  if (!fileUrlOrPath) return false;
  try {
    const cleanUrl = String(fileUrlOrPath).split('?')[0].trim();
    if (!cleanUrl) return false;

    let targetPath = null;
    if (cleanUrl.includes('/uploads/expenses/') || cleanUrl.includes('\\uploads\\expenses\\')) {
      const rel = cleanUrl.includes('/uploads/expenses/')
        ? cleanUrl.split('/uploads/expenses/').pop()
        : cleanUrl.split('\\uploads\\expenses\\').pop();
      targetPath = path.join(EXPENSES_UPLOADS_DIR, rel);
    } else if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('\\uploads\\')) {
      targetPath = path.join(BASE_UPLOADS_DIR, cleanUrl.replace(/^[/\\]uploads[/\\]/, ''));
    }

    if (targetPath && fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        fs.unlinkSync(targetPath);
        console.log(`[Storage] Permanently deleted expense attachment: ${targetPath}`);

        // If parent directory is now empty and is inside EXPENSES_UPLOADS_DIR, clean it up
        const parentDir = path.dirname(targetPath);
        if (parentDir !== EXPENSES_UPLOADS_DIR && parentDir.startsWith(EXPENSES_UPLOADS_DIR)) {
          const remaining = fs.readdirSync(parentDir);
          if (remaining.length === 0) {
            fs.rmdirSync(parentDir);
            console.log(`[Storage] Removed empty expense directory: ${parentDir}`);
          }
        }
        return true;
      }
    }
  } catch (err) {
    console.warn(`[Storage Warning] Failed to delete file ${fileUrlOrPath}:`, err.message);
  }
  return false;
}

/**
 * Deletes entire folder for an expense when the expense is deleted.
 */
function deleteExpenseFolder(expenseId) {
  if (!expenseId) return false;
  try {
    const safeId = String(expenseId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(EXPENSES_UPLOADS_DIR, safeId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log(`[Storage] Deleted entire folder for expense ${expenseId}: ${targetDir}`);
      return true;
    }
  } catch (err) {
    console.warn(`[Storage Warning] Failed to delete expense folder ${expenseId}:`, err.message);
  }
  return false;
}

/**
 * Compares old attachments with new attachments and removes any deleted files from disk.
 */
function pruneOrphanedExpenseAttachments(oldAttachments, newAttachments) {
  const parseList = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  };

  const oldList = parseList(oldAttachments);
  const newList = parseList(newAttachments);

  const getUrl = (item) => (typeof item === 'string' ? item : item?.url || '');
  const newUrls = new Set(newList.map(getUrl).filter(Boolean));

  for (const item of oldList) {
    const url = getUrl(item);
    if (url && !newUrls.has(url)) {
      deleteExpenseAttachmentFile(url);
    }
  }
}

/**
 * Moves temporary attachments into the final expenseId directory.
 */
function organizeAttachmentsForExpense(expenseId, attachments) {
  if (!attachments || !Array.isArray(attachments)) return attachments;
  const { dir: targetDir, safeId } = getExpenseDir(expenseId);

  return attachments.map((att) => {
    if (!att || !att.url) return att;
    try {
      const url = att.url;
      // If file is in another temp folder inside uploads/expenses/
      if (url.includes('/uploads/expenses/')) {
        const parts = url.split('/uploads/expenses/')[1].split('/');
        const currentFolder = parts[0];
        const fileName = parts.slice(1).join('/');

        if (currentFolder && currentFolder !== safeId && fileName) {
          const currentPath = path.join(EXPENSES_UPLOADS_DIR, currentFolder, fileName);
          const newPath = path.join(targetDir, fileName);

          if (fs.existsSync(currentPath)) {
            fs.renameSync(currentPath, newPath);
            // Cleanup old empty folder
            try {
              const oldDir = path.join(EXPENSES_UPLOADS_DIR, currentFolder);
              if (fs.readdirSync(oldDir).length === 0) {
                fs.rmdirSync(oldDir);
              }
            } catch (_) {}

            return {
              ...att,
              url: `/uploads/expenses/${safeId}/${fileName}`
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[Storage Warning] Failed to relocate attachment to ${expenseId}:`, err.message);
    }
    return att;
  });
}

module.exports = {
  EXPENSES_UPLOADS_DIR,
  getExpenseDir,
  deleteExpenseAttachmentFile,
  deleteExpenseFolder,
  pruneOrphanedExpenseAttachments,
  organizeAttachmentsForExpense
};
