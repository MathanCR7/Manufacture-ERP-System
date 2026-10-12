/**
 * Resolves any relative URL (/uploads/invoices/...) to the full backend URL
 */
export function resolveInvoiceFileUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const backendBase = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${cleanPath}`;
}

/**
 * Checks whether the URL or data URL is a PDF document
 */
export function isPdfDocument(url) {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf') || url.startsWith('data:application/pdf');
}

/**
 * Normalizes any single string, JSON array, or object into a uniform array of file items
 */
export function parseInvoiceFiles(raw, defaultPoRef = 'PO') {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item, idx) => ({
            id: item.id || `file_${idx}_${Date.now()}`,
            name: item.name || `Invoice_Document_${idx + 1}`,
            url: item.url || null,
            dataUrl: item.dataUrl || null,
            size: item.size || 'Stored file',
            type: item.type || (item.url && item.url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg'),
            uploadedAt: item.uploadedAt || null,
          }));
        }
      } catch (e) {
        console.warn('Could not parse supplierInvoiceFile JSON:', e);
      }
    }
    // Single legacy URL string
    const isPdf = isPdfDocument(trimmed);
    const cleanFileName = trimmed.split('/').pop()?.split('?')[0] || `Supplier_Invoice_${defaultPoRef}.${isPdf ? 'pdf' : 'jpg'}`;
    return [
      {
        id: 'legacy_file_1',
        name: cleanFileName,
        url: trimmed,
        dataUrl: null,
        size: 'Attached file',
        type: isPdf ? 'application/pdf' : 'image/jpeg',
        uploadedAt: null
      }
    ];
  }
  return [];
}

/**
 * Returns true if the PO has at least one attached invoice document
 */
export function hasInvoiceFiles(raw) {
  return parseInvoiceFiles(raw).length > 0;
}

/**
 * Downloads a single invoice file safely to the client with custom filename
 */
export async function downloadInvoiceFile(fileItem, poReference = 'PO') {
  try {
    if (!fileItem) return;
    const url = typeof fileItem === 'string' ? fileItem : (fileItem.url || fileItem.dataUrl);
    if (!url) return;

    const cleanRef = String(poReference || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const isPdf = isPdfDocument(url);
    const fileName = (typeof fileItem === 'object' && fileItem.name) 
      ? fileItem.name 
      : `Supplier_Invoice_${cleanRef}.${isPdf ? 'pdf' : 'jpg'}`;

    // Direct download if base64 dataUrl
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const resolvedUrl = resolveInvoiceFileUrl(url);

    // Fetch as blob to guarantee cross-origin file download with custom name
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.warn('Blob download fallback:', err);
    // Fallback: direct window download trigger
    const a = document.createElement('a');
    a.href = resolveInvoiceFileUrl(typeof fileItem === 'string' ? fileItem : fileItem.url);
    a.target = '_blank';
    a.download = (typeof fileItem === 'object' ? fileItem.name : '') || `Invoice_${poReference}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
