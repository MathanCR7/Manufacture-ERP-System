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
function deletePaymentImageFromDisk(imagePath, cleanRef = null) {
  // 1. Delete by specific file path
  if (imagePath && typeof imagePath === 'string') {
    const cleanUrl = imagePath.split('?')[0]; // remove query string
    if (cleanUrl.startsWith('/uploads/payments/')) {
      const filename = path.basename(cleanUrl);
      const fullPath = path.join(UPLOADS_DIR, filename);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`[Storage] Cleaned up previous payment receipt: ${filename}`);
        }
      } catch (err) {
        console.error('Error deleting previous payment image file:', err);
      }
    }
  }

  // 2. Scan and delete any files starting with the same PO reference name
  if (cleanRef && cleanRef !== 'PO' && cleanRef !== 'PAYMENT') {
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        const targetPrefix = `${cleanRef}-receipt.`;
        for (const file of files) {
          if (file.startsWith(targetPrefix)) {
            try {
              fs.unlinkSync(path.join(UPLOADS_DIR, file));
              console.log(`[Storage] Deleted existing receipt file for ${cleanRef}: ${file}`);
            } catch (e) {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      console.error('Error scanning/cleaning old receipt files:', err);
    }
  }
}

/**
 * Saves a base64 payment proof image to the disk folder apps/backend/uploads/payments/
 * Automatically removes any old photo for this PO so disk space is kept minimal,
 * and names the new photo using the same clean PO reference (e.g. PO-000004-receipt.webp).
 *
 * @param {string|null} imageData - Base64 Data URL or existing file URL
 * @param {string} [referenceOrId='PO'] - PO reference number or ID
 * @param {string|null} [oldImagePath=null] - The previous paymentImage stored in database
 * @returns {string|null} - Clean URL path with cache-busting timestamp query parameter
 */
function savePaymentImageToDisk(imageData, referenceOrId = 'PO', oldImagePath = null) {
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

  // Automatically delete old image(s) for this PO before saving the new one
  deletePaymentImageFromDisk(oldImagePath, cleanRef);

  // Keep the exact same clean name for this PO: <PO_REF>-receipt.<ext>
  const filename = `${cleanRef}-receipt.${ext}`;
  const targetPath = path.join(UPLOADS_DIR, filename);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    console.log(`[Storage] Saved updated payment proof to: ${filename}`);

    // Return the URL with a cache-buster query parameter so browsers instantly show the new photo
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
