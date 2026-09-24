import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, AlertCircle, Copy, Check } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Validates and parses multiple date formats:
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - ISO string or Date object
 */
export function parseDateInput(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const str = String(input).trim();
  if (!str) return null;

  // Case 1: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (year < 1900 || year > 2150) return null;

    const testDate = new Date(year, month - 1, day, hours, mins, 0, 0);
    if (
      testDate.getFullYear() === year &&
      testDate.getMonth() === month - 1 &&
      testDate.getDate() === day
    ) {
      return testDate;
    }
    return null;
  }

  // Case 2: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.split('T')[0].match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (year < 1900 || year > 2150) return null;

    const testDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (
      testDate.getFullYear() === year &&
      testDate.getMonth() === month - 1 &&
      testDate.getDate() === day
    ) {
      return testDate;
    }
    return null;
  }

  // Case 3: Generic Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d;
  }

  return null;
}

export function formatDateToDisplay(date, showTime = false) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  if (showTime) {
    return format(d, 'dd-MM-yyyy HH:mm');
  }
  return format(d, 'dd-MM-yyyy');
}

export default function DatePicker({
  value,
  onChange,
  label,
  required = false,
  disabled,
  modalTitle = "Select Date",
  placeholder = "dd-mm-yyyy",
  className = "",
  triggerClassName = "",
  labelClassName = "",
  showTime = false,
}) {
  const dateValue = useMemo(() => {
    if (!value) return null;
    return parseDateInput(value);
  }, [value]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [textVal, setTextVal] = useState(() => formatDateToDisplay(dateValue, showTime));
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Local hours & minutes states
  const [hours, setHours] = useState(dateValue ? dateValue.getHours() : new Date().getHours());
  const [minutes, setMinutes] = useState(dateValue ? dateValue.getMinutes() : new Date().getMinutes());

  // Keep display in sync with external value
  useEffect(() => {
    if (dateValue) {
      setTextVal(formatDateToDisplay(dateValue, showTime));
      setHours(dateValue.getHours());
      setMinutes(dateValue.getMinutes());
      setError(null);
    } else if (!value) {
      setTextVal('');
      setError(null);
    }
  }, [dateValue, value, showTime]);

  const handleDateSelect = (date) => {
    if (!date) return;
    const newDate = new Date(date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    if (typeof disabled === 'function' && disabled(newDate)) {
      setError('Selected date is not permitted');
      return;
    }

    setError(null);
    setTextVal(formatDateToDisplay(newDate, showTime));
    if (onChange) {
      onChange(newDate);
    }
    if (!showTime) {
      setPopoverOpen(false);
    }
  };

  const handleTimeChange = (newHours, newMinutes) => {
    const baseDate = dateValue || new Date();
    const newDate = new Date(baseDate);
    newDate.setHours(newHours);
    newDate.setMinutes(newMinutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    if (typeof disabled === 'function' && disabled(newDate)) {
      setError('Selected date/time is not permitted');
      return;
    }

    setError(null);
    setTextVal(formatDateToDisplay(newDate, showTime));
    if (onChange) {
      onChange(newDate);
    }
  };

  const handleHoursChange = (e) => {
    let h = parseInt(e.target.value, 10);
    if (isNaN(h)) h = 0;
    if (h < 0) h = 23;
    if (h > 23) h = 0;
    setHours(h);
    handleTimeChange(h, minutes);
  };

  const handleMinutesChange = (e) => {
    let m = parseInt(e.target.value, 10);
    if (isNaN(m)) m = 0;
    if (m < 0) m = 59;
    if (m > 59) m = 0;
    setMinutes(m);
    handleTimeChange(hours, m);
  };

  // Direct paste handler: accepts dd-mm-yyyy, yyyy-mm-dd, etc.
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) {
      setTextVal('');
      setError(null);
      onChange?.(null);
      return;
    }

    const parsed = parseDateInput(pasted);
    if (parsed) {
      if (typeof disabled === 'function' && disabled(parsed)) {
        setError('This date is not permitted (check date restrictions)');
        setTextVal(formatDateToDisplay(parsed, showTime));
        return;
      }
      setError(null);
      setTextVal(formatDateToDisplay(parsed, showTime));
      onChange?.(parsed);
    } else {
      setTextVal(pasted);
      setError('Invalid date format. Use dd-mm-yyyy (e.g. 24-09-2026)');
    }
  };

  // Manual typing change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setTextVal(val);

    if (!val.trim()) {
      setError(null);
      onChange?.(null);
      return;
    }

    // Attempt auto-parsing when minimum full date format is completed
    if (val.trim().length >= 10) {
      const parsed = parseDateInput(val);
      if (parsed) {
        if (typeof disabled === 'function' && disabled(parsed)) {
          setError('This date is not permitted (check date restrictions)');
          return;
        }
        setError(null);
        onChange?.(parsed);
      }
    }
  };

  // Validate on blur
  const handleBlur = () => {
    if (!textVal.trim()) {
      setError(null);
      onChange?.(null);
      return;
    }

    const parsed = parseDateInput(textVal);
    if (parsed) {
      if (typeof disabled === 'function' && disabled(parsed)) {
        setError('This date is not permitted');
        return;
      }
      setError(null);
      setTextVal(formatDateToDisplay(parsed, showTime));
      onChange?.(parsed);
    } else {
      setError('Invalid date format. Use dd-mm-yyyy (e.g. 24-09-2026)');
    }
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    if (textVal) {
      navigator.clipboard.writeText(textVal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const isDisabled = disabled === true;

  return (
    <div className={twMerge("space-y-1 flex flex-col relative group/date w-full", className)}>
      {label && (
        <Label className={twMerge("text-xs font-semibold text-slate-700 dark:text-slate-300", labelClassName)}>
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
      )}

      <div
        className={twMerge(
          "relative flex items-center w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all shadow-2xs group/picker focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20",
          error ? "border-rose-400 ring-2 ring-rose-500/20" : "hover:border-indigo-400",
          isDisabled ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800" : "",
          triggerClassName
        )}
      >
        {/* Left Calendar Icon */}
        <div className="pl-2.5 pr-1 flex items-center pointer-events-none shrink-0">
          <CalendarIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        </div>

        {/* Text Input for Typing & Copy-Paste */}
        <input
          type="text"
          value={textVal}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={placeholder || (showTime ? 'dd-mm-yyyy hh:mm' : 'dd-mm-yyyy')}
          disabled={isDisabled}
          className="w-full h-full bg-transparent px-1.5 py-1 text-xs font-semibold font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none tracking-wide"
          title="Type or paste date in dd-mm-yyyy format"
        />

        {/* Copy Quick Button (if has date) */}
        {textVal && (
          <button
            type="button"
            onClick={handleCopy}
            disabled={isDisabled}
            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors shrink-0"
            title={copied ? "Copied!" : "Copy date (dd-mm-yyyy)"}
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        )}

        {/* Popover Calendar Trigger Button */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isDisabled}
              className="p-1.5 mr-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Open calendar picker"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden z-50" 
            align="start"
            sideOffset={8}
          >
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-3.5 border-b border-indigo-700/50 flex flex-col gap-1 shadow-inner">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200/80">{modalTitle}</span>
              <span className="text-xl font-black tracking-tight leading-none drop-shadow-sm">
                {dateValue ? format(dateValue, showTime ? "MMM d, yyyy p" : "MMM d, yyyy") : "Select Date"}
              </span>
            </div>
            
            <Calendar
              mode="single"
              selected={dateValue || undefined}
              onSelect={handleDateSelect}
              initialFocus
              disabled={disabled}
              className="p-3 bg-transparent"
              classNames={{
                day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-600 focus:text-white rounded-full font-bold shadow-md shadow-indigo-600/30",
                day_today: "bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100 rounded-full font-bold ring-1 ring-inset ring-indigo-500/30",
                day: "h-8 w-8 p-0 font-medium text-sm aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200",
                head_cell: "text-slate-550 dark:text-slate-400 font-medium text-[0.7rem] uppercase tracking-wider pb-1.5",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all",
                caption: "flex justify-center pt-1 relative items-center mb-2",
                caption_label: "text-sm font-bold text-slate-900 dark:text-slate-100",
              }}
            />

            {showTime && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Time
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={String(hours).padStart(2, '0')}
                      onChange={handleHoursChange}
                      className="w-12 h-8 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="font-bold text-slate-400">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(minutes).padStart(2, '0')}
                      onChange={handleMinutesChange}
                      className="w-12 h-8 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => setPopoverOpen(false)}
                    className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-bold ml-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 px-1 animate-in fade-in duration-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
