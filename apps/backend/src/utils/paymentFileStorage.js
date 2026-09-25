const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/payments');

// Ensure the directory exists on startup
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create payment uploads directory:', err);
}

/**
 * Deletes any existing receipt file(s) for a given PO from the server disk.
 *
 * @param {string|null} imagePath - Stored path (e.g. /uploads/payments/PO-000004-receipt.webp)
 * @param {string|null} [cleanRef=null] - Clean PO reference (e.g. PO-000004)
 */
function deletePaymentImageFromDisk(imagePath) {
  if (imagePath && typeof imagePath === 'string') {
    const cleanUrl = imagePath.split('?')[0];
    if (cleanUrl.startsWith('/uploads/payments/')) {
      const filename = path.basename(cleanUrl);
      const fullPath = path.join(UPLOADS_DIR, filename);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[Storage] Cleaned up payment receipt file: ${filename}`);
        }
      } catch (err) {
        console.error('Error deleting payment image file:', err);
      }
    }
  }
}

/**
 * Saves a base64 payment proof image to apps/backend/uploads/payments/
 * Supports multiple installments using uniqueKey (e.g. installment ID or timestamp).
 *
 * @param {string|null} imageData - Base64 Data URL or existing file URL
 * @param {string} [referenceOrId='PO'] - PO reference number or ID
 * @param {string|null} [oldImagePath=null] - Previous specific payment image to clean up
 * @param {string|null} [uniqueKey=null] - Unique identifier for the installment
 * @returns {string|null} - URL path with cache-busting timestamp query parameter
 */
function savePaymentImageToDisk(imageData, referenceOrId = 'PO', oldImagePath = null, uniqueKey = null) {
  if (!imageData || typeof imageData !== 'string') return null;

  const trimmed = imageData.trim();

  // If already stored as a file path or URL (not a new base64 upload), keep it
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Check if it is a base64 Data URL
  const matches = trimmed.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return trimmed; // Not a base64 URL
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  let ext = 'webp';
  if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('pdf')) ext = 'pdf';

  const cleanRef = String(referenceOrId || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');

  // If an old image path was specifically provided to replace, remove that specific file
  if (oldImagePath && typeof oldImagePath === 'string' && oldImagePath.startsWith('/uploads/payments/')) {
    deletePaymentImageFromDisk(oldImagePath);
  }

  const keyPart = uniqueKey 
    ? String(uniqueKey).replace(/[^a-zA-Z0-9_-]/g, '_') 
    : `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const filename = `${cleanRef}-pay-${keyPart}.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    console.log(`[Storage] Saved payment proof to: ${filename}`);

    return `/uploads/payments/${filename}?t=${Date.now()}`;
  } catch (err) {
    console.error('Error writing payment proof image to disk:', err);
    return null;
  }
}

module.exports = {
  savePaymentImageToDisk,
  deletePaymentImageFromDisk,
  UPLOADS_DIR,
};
