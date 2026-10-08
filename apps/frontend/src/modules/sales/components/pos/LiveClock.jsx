import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * LiveClock - High-legibility live clock with date and shift duration
 * @param {Object} props
 * @param {string|Date} [props.shiftStart] - ISO date string of shift initiation
 */
export const LiveClock = React.memo(function LiveClock({ shiftStart = null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Format Time (HH:MM:SS)
  const timeString = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Format Date (e.g. "Thu, 08 Oct 2026")
  const dateString = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Calculate elapsed shift duration if shiftStart is available
  let shiftElapsed = null;
  if (shiftStart) {
    const startMs = new Date(shiftStart).getTime();
    const currentMs = now.getTime();
    if (!isNaN(startMs) && currentMs >= startMs) {
      const diffSecs = Math.floor((currentMs - startMs) / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      shiftElapsed = `${hours}h ${minutes}m`;
    }
  }

  return (
    <div className="pos-live-clock">
      <div className="pos-live-clock__main">
        <Clock className="pos-live-clock__icon" aria-hidden="true" />
        <time
          className="pos-live-clock__time"
          dateTime={now.toISOString()}
          aria-live="off"
        >
          {timeString}
        </time>
      </div>
      <div className="pos-live-clock__meta">
        <span className="pos-live-clock__date">{dateString}</span>
        {shiftElapsed && (
          <span className="pos-live-clock__shift" title="Current shift duration">
            Shift: {shiftElapsed}
          </span>
        )}
      </div>
    </div>
  );
});

export default LiveClock;
