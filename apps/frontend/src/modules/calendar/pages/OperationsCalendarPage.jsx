import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import OperationsCalendar from '../components/OperationsCalendar';

export default function OperationsCalendarPage() {
  const [milestones, setMilestones] = useState([]);

  useEffect(() => {
    // Optionally fetch milestones from comprehensive forecast if available
    api.get('/forecasting/comprehensive', { params: { horizonDays: 90 } })
      .then(res => {
        if (res.data?.calendarMilestones) {
          setMilestones(res.data.calendarMilestones);
        }
      })
      .catch(() => {
        // Safe fallback - calendar operates standalone with live holidays & PostgreSQL events
      });
  }, []);

  return (
    <div className="w-full h-full flex-1 flex flex-col p-0 m-0 overflow-hidden bg-[#f4f5f8] dark:bg-[#0f1318]">
      <OperationsCalendar operationalMilestones={milestones} fullScreen={true} />
    </div>
  );
}
