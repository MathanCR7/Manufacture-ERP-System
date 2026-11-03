const fs = require('fs');
const path = require('path');

const BASE_UPLOADS_DIR = path.join(__dirname, '../../uploads');
const EMPLOYEES_UPLOADS_DIR = path.join(BASE_UPLOADS_DIR, 'employees');

// Ensure base employees directory exists
try {
  if (!fs.existsSync(EMPLOYEES_UPLOADS_DIR)) {
    fs.mkdirSync(EMPLOYEES_UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create employees uploads directory:', err);
}

/**
 * Clean ID for safe directory naming (e.g. VTE0001 or UUID)
 */
function sanitizeId(id) {
  if (!id) return 'temp_' + Date.now();
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Get or create employee folder: uploads/employees/{empId}/
 */
function getEmployeeDir(empId) {
  const safeId = sanitizeId(empId);
  const dir = path.join(EMPLOYEES_UPLOADS_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { dir, safeId };
}

/**
 * Remove an existing file from disk given its /uploads/... URL
 */
function deleteFileFromDisk(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return false;
  try {
    const cleanUrl = fileUrl.split('?')[0].trim();
    if (!cleanUrl) return false;

    let targetPath = null;
    if (cleanUrl.includes('/uploads/employees/') || cleanUrl.includes('\\uploads\\employees\\')) {
      const rel = cleanUrl.includes('/uploads/employees/')
        ? cleanUrl.split('/uploads/employees/').pop()
        : cleanUrl.split('\\uploads\\employees\\').pop();
      targetPath = path.join(EMPLOYEES_UPLOADS_DIR, rel);
    } else if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('\\uploads\\')) {
      targetPath = path.join(BASE_UPLOADS_DIR, cleanUrl.replace(/^[/\\]uploads[/\\]/, ''));
    }

    if (targetPath && fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        fs.unlinkSync(targetPath);
        console.log(`[Storage] Deleted employee file: ${targetPath}`);
        return true;
      }
    }
  } catch (err) {
    console.warn(`[Storage Warning] Failed to delete file ${fileUrl}:`, err.message);
  }
  return false;
}

/**
 * Save a single base64 data string (image or document) to the employee's folder.
 * If data is already a URL (/uploads/...), returns it directly.
 */
function saveBase64File(base64DataUrl, empId, filePrefix = 'file', originalName = '') {
  if (!base64DataUrl || typeof base64DataUrl !== 'string') return null;

  const trimmed = base64DataUrl.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const matches = trimmed.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return trimmed; // Not a base64 string
  }

  const mimeType = matches[1].toLowerCase();
  const base64Content = matches[2];

  let ext = 'png';
  if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('pdf')) ext = 'pdf';
  else if (mimeType.includes('csv')) ext = 'csv';
  else if (mimeType.includes('sheet') || mimeType.includes('excel')) ext = 'xlsx';
  else if (mimeType.includes('msword') || mimeType.includes('wordprocessing')) ext = 'docx';
  else if (mimeType.includes('text/plain')) ext = 'txt';

  const { dir, safeId } = getEmployeeDir(empId);

  const cleanOriginal = originalName ? sanitizeId(path.parse(originalName).name) + '_' : '';
  const filename = `${filePrefix}_${cleanOriginal}${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
  const targetPath = path.join(dir, filename);

  const buffer = Buffer.from(base64Content, 'base64');
  fs.writeFileSync(targetPath, buffer);

  return `/uploads/employees/${safeId}/${filename}`;
}

/**
 * Process a single document/image file upload with automatic cleanup of replaced files
 */
function processSingleFile(newFile, empId, filePrefix = 'doc', oldFile = null) {
  if (!newFile) {
    if (oldFile) deleteFileFromDisk(oldFile);
    return null;
  }

  if (typeof newFile === 'string' && newFile.startsWith('data:')) {
    if (oldFile) deleteFileFromDisk(oldFile);
    return saveBase64File(newFile, empId, filePrefix);
  }

  return newFile;
}

/**
 * Process Employee Profile Photo
 */
function processProfilePhoto(newPhoto, empId, oldPhoto = null) {
  return processSingleFile(newPhoto, empId, 'photo', oldPhoto);
}

/**
 * Process Family Photos array
 * Can be array of URLs or array of { url, name, caption }
 */
function processFamilyPhotos(newPhotos, empId, oldPhotos = []) {
  if (!newPhotos) return [];
  const list = Array.isArray(newPhotos) ? newPhotos : [];
  const oldList = Array.isArray(oldPhotos) ? oldPhotos : [];

  const oldUrls = oldList.map(item => (typeof item === 'string' ? item : item?.url)).filter(Boolean);

  const processed = list.map((item, index) => {
    if (!item) return null;
    let url = typeof item === 'string' ? item : item.url;
    let name = item.name || `Family Photo ${index + 1}`;

    if (url && url.startsWith('data:')) {
      url = saveBase64File(url, empId, `family_${index + 1}`, name);
    }

    return typeof item === 'string' ? url : { ...item, url };
  }).filter(Boolean);

  // Prune deleted photos
  const newUrls = processed.map(item => (typeof item === 'string' ? item : item?.url)).filter(Boolean);
  oldUrls.forEach(oldUrl => {
    if (!newUrls.includes(oldUrl)) {
      deleteFileFromDisk(oldUrl);
    }
  });

  return processed;
}

/**
 * Process Document Attachments array
 * Each item: { name, url, type, size, uploadedAt }
 */
function processAttachments(newAttachments, empId, oldAttachments = []) {
  if (!newAttachments) return [];
  const list = Array.isArray(newAttachments) ? newAttachments : [];
  const oldList = Array.isArray(oldAttachments) ? oldAttachments : [];

  const oldUrls = oldList.map(item => (typeof item === 'string' ? item : item?.url)).filter(Boolean);

  const processed = list.map((item, index) => {
    if (!item) return null;
    let url = typeof item === 'string' ? item : item.url;
    let name = item.name || `document_${index + 1}`;
    let type = item.type || '';
    let size = item.size || 0;

    if (url && url.startsWith('data:')) {
      url = saveBase64File(url, empId, 'doc', name);
    }

    return {
      name,
      url,
      type,
      size,
      uploadedAt: item.uploadedAt || new Date().toISOString()
    };
  }).filter(Boolean);

  // Prune deleted attachments
  const newUrls = processed.map(item => item.url).filter(Boolean);
  oldUrls.forEach(oldUrl => {
    if (!newUrls.includes(oldUrl)) {
      deleteFileFromDisk(oldUrl);
    }
  });

  return processed;
}

/**
 * Delete entire folder for an employee when deleted
 */
function deleteEmployeeFolder(empId) {
  if (!empId) return false;
  try {
    const safeId = sanitizeId(empId);
    const targetDir = path.join(EMPLOYEES_UPLOADS_DIR, safeId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log(`[Storage] Deleted folder for employee ${empId}: ${targetDir}`);
      return true;
    }
  } catch (err) {
    console.warn(`[Storage Warning] Failed to delete folder for employee ${empId}:`, err.message);
  }
  return false;
}

module.exports = {
  EMPLOYEES_UPLOADS_DIR,
  BASE_UPLOADS_DIR,
  getEmployeeDir,
  deleteFileFromDisk,
  saveBase64File,
  processSingleFile,
  processProfilePhoto,
  processFamilyPhotos,
  processAttachments,
  deleteEmployeeFolder
};
