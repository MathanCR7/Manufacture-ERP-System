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
 * Deletes any existing file (receipt, PO, or order attachment) from the server uploads disk.
 * Supports absolute URLs, relative paths, query strings, and plain filenames.
 *
 * @param {string|null} imagePath - Stored path or URL (e.g. /uploads/payments/order_100100001_1791203006388.pdf or http://localhost:5173/uploads/payments/...)
 * @returns {boolean} - True if file was deleted, false otherwise
 */
function deletePaymentImageFromDisk(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return false;

  try {
    const cleanUrl = imagePath.split('?')[0].trim();
    let filename = '';

    if (cleanUrl.includes('/uploads/payments/')) {
      filename = cleanUrl.split('/uploads/payments/').pop();
    } else if (cleanUrl.includes('\\uploads\\payments\\')) {
      filename = cleanUrl.split('\\uploads\\payments\\').pop();
    } else if (cleanUrl.includes('/') || cleanUrl.includes('\\')) {
      filename = path.basename(cleanUrl);
    } else {
      filename = cleanUrl;
    }

    if (!filename) return false;

    // Sanitize filename to prevent directory traversal
    filename = path.basename(filename);
    const fullPath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`[Storage] Deleted file from UPLOADS_DIR: ${filename}`);
      return true;
    } else {
      console.log(`[Storage] File not found on disk to delete: ${filename}`);
      return false;
    }
  } catch (err) {
    console.error('Error deleting file from disk:', err);
    return false;
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

/**
 * Saves an order attachment image (camera capture or gallery upload) to UPLOADS_DIR
 * Named using order ID or document number: `order_${cleanOrderId}_${timestamp}.${ext}`
 *
 * @param {string} imageData - Base64 Data URL or file string
 * @param {string} orderId - Order ID or reference number
 * @param {string|null} [oldFilePath=null] - Previous attachment URL/filename to remove on update
 * @returns {string|null} - Static URL path for access
 */
function saveOrderAttachmentToDisk(imageData, orderId = 'ORDER', oldFilePath = null) {
  if (!imageData || typeof imageData !== 'string') return null;

  const trimmed = imageData.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const matches = trimmed.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return trimmed;
  }

  // If replacing an old attachment, delete it from disk
  if (oldFilePath) {
    deletePaymentImageFromDisk(oldFilePath);
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  let ext = 'jpg';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('pdf')) ext = 'pdf';

  const cleanOrder = String(orderId || 'ORDER').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `order_${cleanOrder}_${Date.now()}.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    console.log(`[Storage] Saved order attachment to UPLOADS_DIR: ${filename}`);

    return `/uploads/payments/${filename}?t=${Date.now()}`;
  } catch (err) {
    console.error('Error writing order attachment to disk:', err);
    return null;
  }
}

/**
 * Saves a binary file buffer (e.g. from multer multipart upload) to UPLOADS_DIR
 * Named using order ID: `order_${cleanOrderId}_${timestamp}.${ext}`
 *
 * @param {Buffer} buffer - Binary file buffer
 * @param {string} [originalname='photo.jpg'] - Original file name to extract extension
 * @param {string} [orderId='ORDER'] - Order ID or document reference number
 * @param {string|null} [oldFilePath=null] - Previous attachment URL/filename to remove on update
 * @returns {string|null} - Static URL path for access
 */
function saveOrderAttachmentBufferToDisk(buffer, originalname = 'photo.jpg', orderId = 'ORDER', oldFilePath = null) {
  if (!buffer) return null;

  // If replacing an old attachment, delete it from disk
  if (oldFilePath) {
    deletePaymentImageFromDisk(oldFilePath);
  }

  let ext = path.extname(originalname).replace('.', '').toLowerCase() || 'jpg';
  if (ext === 'jpeg') ext = 'jpg';

  const cleanOrder = String(orderId || 'ORDER').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `order_${cleanOrder}_${Date.now()}.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  try {
    fs.writeFileSync(targetPath, buffer);
    console.log(`[Storage] Saved order attachment buffer to UPLOADS_DIR: ${filename}`);

    return `/uploads/payments/${filename}?t=${Date.now()}`;
  } catch (err) {
    console.error('Error writing order attachment buffer to disk:', err);
    return null;
  }
}

/**
 * Saves a supplier invoice file (PDF or image) to apps/backend/uploads/payments/
 * Automatically deletes oldFilePath if replaced to prevent server disk bloat.
 *
 * @param {string} fileData - Base64 Data URL (data:application/pdf;base64,... or data:image/...;base64,...)
 * @param {string} poRefOrId - PO reference number or ID
 * @param {string|null} [oldFilePath=null] - Previous invoice file to delete on replacement
 * @returns {string|null} - URL path with timestamp query parameter
 */
function saveSupplierInvoiceToDisk(fileData, poRefOrId = 'PO', oldFilePath = null) {
  if (!fileData || typeof fileData !== 'string') return null;

  const trimmed = fileData.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const matches = trimmed.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return trimmed;
  }

  // If replacing an old file, delete it from disk immediately
  if (oldFilePath) {
    deletePaymentImageFromDisk(oldFilePath);
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  let ext = 'pdf';
  if (mimeType.includes('pdf')) ext = 'pdf';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';

  const cleanRef = String(poRefOrId || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `invoice_${cleanRef}_${Date.now()}.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    console.log(`[Storage] Saved supplier invoice to UPLOADS_DIR: ${filename}`);

    return `/uploads/payments/${filename}?t=${Date.now()}`;
  } catch (err) {
    console.error('Error writing supplier invoice file to disk:', err);
    return null;
  }
}

module.exports = {
  savePaymentImageToDisk,
  saveOrderAttachmentToDisk,
  saveOrderAttachmentBufferToDisk,
  saveSupplierInvoiceToDisk,
  deletePaymentImageFromDisk,
  UPLOADS_DIR,
};
