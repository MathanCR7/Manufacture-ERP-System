import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, Flag, Moon, ExternalLink, Plus, Sparkles, Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Zero-drift date formatter
const formatLocalDate = (y, m, d) => {
  const ys = String(y);
  const ms = String(m + 1).padStart(2, '0');
  const ds = String(d).padStart(2, '0');
  return `${ys}-${ms}-${ds}`;
};

export default function MiniOperationsCalendar({ className = '' }) {
  const navigate = useNavigate();

  const now = new Date();
  const todayStr = useMemo(() => {
    return formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [holidays, setHolidays] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Compute viewed date
  const viewedDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth();

  // Fetch holidays & user events
  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, eRes] = await Promise.allSettled([
        api.get('/forecasting/calendar/holidays', { params: { year: viewedYear } }),
        api.get('/forecasting/calendar/events')
      ]);

      if (hRes.status === 'fulfilled' && hRes.value.data?.holidays) {
        setHolidays(hRes.value.data.holidays);
      }
      if (eRes.status === 'fulfilled' && eRes.value.data?.events) {
        setUserEvents(eRes.value.data.events);
      }
    } catch (err) {
      console.warn('Mini calendar load warning:', err);
    } finally {
      setLoading(false);
    }
  }, [viewedYear]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Build mini grid
  const daysGrid = useMemo(() => {
    const firstDay = new Date(viewedYear, viewedMonth, 1);
    const lastDay = new Date(viewedYear, viewedMonth + 1, 0);
    const startWeekday = firstDay.getDay();

    const days = [];

    // Prev month padding
    for (let i = 0; i < startWeekday; i++) {
      const p = new Date(viewedYear, viewedMonth, -startWeekday + i + 1);
      days.push({
        dateStr: formatLocalDate(p.getFullYear(), p.getMonth(), p.getDate()),
        dayNum: p.getDate(),
        isCurrentMonth: false,
        holidays: [],
        events: []
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = formatLocalDate(viewedYear, viewedMonth, d);
      const dayHolidays = holidays.filter(h => h.date === dateStr);
      const dayEvents = userEvents.filter(e => e.date === dateStr);

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        holidays: dayHolidays,
        events: dayEvents
      });
    }

    return days;
  }, [viewedYear, viewedMonth, holidays, userEvents, todayStr]);

  // Items on selected date
  const selectedDayItems = useMemo(() => {
    const dayHolidays = holidays.filter(h => h.date === selectedDate);
    const dayEvents = userEvents.filter(e => e.date === selectedDate);
    return {
      holidays: dayHolidays,
      events: dayEvents,
      total: dayHolidays.length + dayEvents.length
    };
  }, [selectedDate, holidays, userEvents]);

  // Navigate to full calendar
  const handleGoToFullCalendar = (date = null) => {
    const target = date || selectedDate || todayStr;
    navigate(`/forecasting/calendar?date=${target}`);
  };

  return (
    <Card className={`border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-900 ${className}`}>
      {/* Header */}
      <CardHeader className="p-3.5 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <CardTitle className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Operations Calendar
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live sync" />
              </CardTitle>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {viewedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMonthOffset(prev => prev - 1)}
              className="h-6 w-6 p-0 rounded-lg text-slate-500 hover:text-slate-900"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMonthOffset(0);
                setSelectedDate(todayStr);
              }}
              className="h-6 px-1.5 text-[10px] font-bold rounded-lg border-slate-200 dark:border-slate-700"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMonthOffset(prev => prev + 1)}
              className="h-6 w-6 p-0 rounded-lg text-slate-500 hover:text-slate-900"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {/* 7-Day Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 dark:text-slate-500 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className={`py-0.5 ${i === 0 ? 'text-rose-500' : ''}`}>{d}</div>
          ))}
        </div>

        {/* 7-Day Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysGrid.map((d, idx) => {
            const isSelected = selectedDate === d.dateStr;
            const hasHoliday = d.holidays.length > 0;
            const hasEvents = d.events.length > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDate(d.dateStr)}
                onDoubleClick={() => handleGoToFullCalendar(d.dateStr)}
                className={`h-8 rounded-lg flex flex-col items-center justify-center relative transition-all text-xs select-none ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/30 ring-1 ring-indigo-500'
                    : d.isToday
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 font-extrabold border border-amber-300 dark:border-amber-700'
                    : d.isCurrentMonth
                    ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-300 dark:text-slate-700 opacity-40'
                }`}
              >
                <span className="text-[11px] leading-none">{d.dayNum}</span>

                {/* Dot markers */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  {hasHoliday && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-purple-200' : 'bg-purple-500'}`} />
                  )}
                  {hasEvents && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-rose-500'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Date Summary Preview */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {selectedDate === todayStr ? 'Today' : selectedDate}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {selectedDayItems.total} scheduled
            </span>
          </div>

          <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-0.5">
            {selectedDayItems.total === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-1 text-center">
                No events or holidays scheduled.
              </p>
            ) : (
              <>
                {/* Holiday Chip */}
                {selectedDayItems.holidays.map((h, i) => (
                  <div
                    key={`h-${i}`}
                    className="flex items-center justify-between px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-900/60 text-[10px] text-purple-900 dark:text-purple-200"
                  >
                    <span className="font-semibold flex items-center gap-1 truncate">
                      {h.isTentative ? <Moon className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" /> : <Flag className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />}
                      {h.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-200/80 dark:bg-purple-900 font-bold">
                      Holiday
                    </span>
                  </div>
                ))}

                {/* User Event Chip */}
                {selectedDayItems.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-800 dark:text-slate-200"
                  >
                    <span className="font-medium truncate">
                      {e.time ? `${e.time} ` : ''}{e.title}
                    </span>
                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded ${
                      e.priority === 'Critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                      e.priority === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {e.priority}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Action button redirecting to /forecasting/calendar */}
          <Button
            size="sm"
            onClick={() => handleGoToFullCalendar()}
            className="w-full mt-2.5 h-7 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>View Full Operations Calendar</span>
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
