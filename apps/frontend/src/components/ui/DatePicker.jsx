import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function DatePicker({
  value,
  onChange,
  label,
  required = false,
  disabled,
  modalTitle = "Select Date",
  placeholder = "Select a date",
  className = "",
  triggerClassName = "",
  labelClassName = "",
  showTime = false,
}) {
  const dateValue = value ? new Date(value) : null;

  // Local hours & minutes states
  const [hours, setHours] = useState(dateValue ? dateValue.getHours() : new Date().getHours());
  const [minutes, setMinutes] = useState(dateValue ? dateValue.getMinutes() : new Date().getMinutes());

  // Keep state in sync with external value
  useEffect(() => {
    if (dateValue) {
      setHours(dateValue.getHours());
      setMinutes(dateValue.getMinutes());
    }
  }, [value]);

  const handleDateSelect = (date) => {
    if (!date) return;
    const newDate = new Date(date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    if (onChange) {
      onChange(newDate);
    }
    if (!showTime) {
      // Direct close for standard date-only pickers
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  };

  const handleTimeChange = (newHours, newMinutes) => {
    const baseDate = dateValue || new Date();
    const newDate = new Date(baseDate);
    newDate.setHours(newHours);
    newDate.setMinutes(newMinutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
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

  const handleDone = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  };

  // Safe formatting
  const displayValue = dateValue 
    ? format(dateValue, showTime ? "dd MMM yyyy, h:mm a" : "PPP")
    : placeholder;

  return (
    <div className={twMerge("space-y-2 flex flex-col relative group/date w-full", className)}>
      {label && (
        <Label className={twMerge("text-slate-705 dark:text-slate-300 font-medium transition-colors group-hover/date:text-indigo-600 dark:group-hover/date:text-indigo-400", labelClassName)}>
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
      )}
      <Popover>
        <PopoverTrigger
          className={twMerge(
            "flex h-[48px] w-full items-center justify-between rounded-t-xl rounded-b-md border-b-2 border-indigo-500/30 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 text-left text-sm font-medium transition-all hover:bg-slate-200/50 dark:hover:bg-slate-700/50 focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:bg-indigo-50/50 dark:focus-visible:bg-slate-900 shadow-sm relative overflow-hidden group/trigger",
            !value ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white",
            triggerClassName
          )}
        >
          <div className="flex items-center min-w-0">
            <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500 group-hover/trigger:text-indigo-600 dark:group-hover/trigger:text-indigo-400 transition-colors flex-shrink-0" />
            <span className={twMerge(
              "tracking-tight truncate font-medium",
              showTime ? "text-xs sm:text-sm" : "text-sm"
            )}>
              {displayValue}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] bg-indigo-600 w-0 group-hover/trigger:w-full focus-visible:w-full transition-all duration-300 ease-out"></div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden" 
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
            selected={dateValue}
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
                  onClick={handleDone}
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
  );
}
