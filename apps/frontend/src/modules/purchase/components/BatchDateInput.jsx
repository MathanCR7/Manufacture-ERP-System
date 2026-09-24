import React, { useState, useEffect, useRef } from 'react';
import { Calendar, AlertCircle, Copy, Check } from 'lucide-react';

/**
 * Validates and parses multiple date formats:
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - ISO string
 * 
 * Returns { valid: true, display: 'DD-MM-YYYY', iso: 'YYYY-MM-DD' } or { valid: false, error: string }
 */
export function validateAndParseDate(input) {
  if (!input) return { valid: true, empty: true, display: '', iso: '' };
  const str = String(input).trim();
  if (!str) return { valid: true, empty: true, display: '', iso: '' };

  // Case 1: DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: 'Month must be between 01 and 12' };
    }
    if (day < 1 || day > 31) {
      return { valid: false, error: 'Day must be between 01 and 31' };
    }
    if (year < 1900 || year > 2100) {
      return { valid: false, error: 'Year must be a 4-digit year (e.g. 2026)' };
    }

    const testDate = new Date(year, month - 1, day);
    if (
      testDate.getFullYear() !== year ||
      testDate.getMonth() !== month - 1 ||
      testDate.getDate() !== day
    ) {
      return { valid: false, error: 'Invalid calendar date (check month days)' };
    }

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return {
      valid: true,
      display: `${dd}-${mm}-${year}`,
      iso: `${year}-${mm}-${dd}`,
    };
  }

  // Case 2: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const ymdMatch = str.split('T')[0].match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: 'Month must be between 01 and 12' };
    }
    if (day < 1 || day > 31) {
      return { valid: false, error: 'Day must be between 01 and 31' };
    }
    if (year < 1900 || year > 2100) {
      return { valid: false, error: 'Year must be a 4-digit year (e.g. 2026)' };
    }

    const testDate = new Date(year, month - 1, day);
    if (
      testDate.getFullYear() !== year ||
      testDate.getMonth() !== month - 1 ||
      testDate.getDate() !== day
    ) {
      return { valid: false, error: 'Invalid calendar date (check month days)' };
    }

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return {
      valid: true,
      display: `${dd}-${mm}-${year}`,
      iso: `${year}-${mm}-${dd}`,
    };
  }

  // Case 3: Try parsing as generic Date string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return {
      valid: true,
      display: `${dd}-${mm}-${year}`,
      iso: `${year}-${mm}-${dd}`,
    };
  }

  return { valid: false, error: 'Format must be dd-mm-yyyy (e.g. 23-09-2026)' };
}

/**
 * Format any incoming value (ISO, timestamp, etc.) to DD-MM-YYYY for display
 */
export function formatToDisplay(val) {
  if (!val) return '';
  const parsed = validateAndParseDate(val);
  return parsed.valid ? parsed.display : String(val);
}

/**
 * BatchDateInput:
 * - Supports direct copy-pasting of DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
 * - Validates date format & real calendar dates (leap years, 28/30/31 day limits)
 * - Offers a built-in calendar picker button
 * - Quick copy button and click-to-select-all
 * - Stores ISO YYYY-MM-DD for backend/Prisma safety
 */
export default function BatchDateInput({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  title = 'Date',
  className = '',
  disabled = false,
}) {
  const [textVal, setTextVal] = useState(() => formatToDisplay(value));
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const hiddenDateRef = useRef(null);

  // Sync state if external value changes (and not currently focused on input)
  useEffect(() => {
    const formatted = formatToDisplay(value);
    setTextVal(formatted);
    if (!value) {
      setError(null);
    }
  }, [value]);

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) {
      setTextVal('');
      setError(null);
      onChange?.('');
      return;
    }

    const res = validateAndParseDate(pasted);
    if (res.valid && !res.empty) {
      setTextVal(res.display);
      setError(null);
      onChange?.(res.iso);
    } else {
      setTextVal(pasted);
      setError(res.error || 'Invalid date format. Use dd-mm-yyyy');
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setTextVal(val);

    if (!val.trim()) {
      setError(null);
      onChange?.('');
      return;
    }

    // If 8-10 chars entered (e.g. 15-09-2026), validate immediately
    if (val.length >= 8) {
      const res = validateAndParseDate(val);
      if (res.valid && !res.empty) {
        setError(null);
        onChange?.(res.iso);
      }
    }
  };

  const handleBlur = () => {
    if (!textVal.trim()) {
      setError(null);
      onChange?.('');
      return;
    }

    const res = validateAndParseDate(textVal);
    if (res.valid && !res.empty) {
      setTextVal(res.display);
      setError(null);
      onChange?.(res.iso);
    } else {
      setError(res.error || 'Invalid format: expected dd-mm-yyyy');
    }
  };

  const handleNativePickerChange = (e) => {
    const pickedIso = e.target.value; // YYYY-MM-DD
    if (!pickedIso) {
      setTextVal('');
      setError(null);
      onChange?.('');
      return;
    }
    const res = validateAndParseDate(pickedIso);
    if (res.valid && !res.empty) {
      setTextVal(res.display);
      setError(null);
      onChange?.(res.iso);
    }
  };

  const openCalendar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === 'function') {
        hiddenDateRef.current.showPicker();
      } else {
        hiddenDateRef.current.focus();
      }
    }
  };

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (textVal) {
      navigator.clipboard.writeText(textVal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const currentIso = value ? (validateAndParseDate(value).iso || '') : '';

  return (
    <div className={`relative flex items-center w-full min-w-[115px] ${className}`}>
      <input
        type="text"
        value={textVal}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        disabled={disabled}
        title={error ? `${title}: ${error}` : `${title} (format: dd-mm-yyyy, click or Ctrl+C to copy)`}
        className={`w-full h-full min-h-[26px] text-xs font-mono font-medium pl-2.5 pr-9 rounded-lg border transition-colors ${
          error
            ? 'border-rose-400 bg-rose-50/70 text-rose-700 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300 focus:ring-1 focus:ring-rose-500'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
        }`}
      />

      {/* Hidden Native Date Input for Visual Calendar Picker */}
      <input
        ref={hiddenDateRef}
        type="date"
        value={currentIso}
        onChange={handleNativePickerChange}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
      />

      <div className="absolute right-1 flex items-center gap-0.5">
        {/* Quick Copy Button */}
        {textVal && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleCopy}
            disabled={disabled}
            title={copied ? "Copied!" : "Copy date (Ctrl+C)"}
            className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
          </button>
        )}

        {/* Calendar Icon Button / Error Indicator */}
        <button
          type="button"
          tabIndex={-1}
          onClick={openCalendar}
          disabled={disabled}
          title={error ? error : 'Click to pick from calendar'}
          className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {error ? (
            <AlertCircle className="w-3 h-3 text-rose-500" />
          ) : (
            <Calendar className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
}
