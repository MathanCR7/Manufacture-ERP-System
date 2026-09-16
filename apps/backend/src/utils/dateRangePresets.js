/**
 * Universal Date Range Preset Resolver for Reports
 * Computes start and end timestamps in the server's local timezone.
 */

function resolveDateRange(presetKey, customStartDate, customEndDate) {
  const now = new Date();

  // If custom dates are explicitly provided, use them
  if (presetKey === 'custom' || (!presetKey && customStartDate && customEndDate)) {
    const start = customStartDate ? new Date(customStartDate) : new Date(0);
    start.setHours(0, 0, 0, 0);

    const end = customEndDate ? new Date(customEndDate) : new Date();
    end.setHours(23, 59, 59, 999);

    return {
      startDate: start,
      endDate: end,
      preset: 'custom',
      label: 'Custom Range'
    };
  }

  const key = (presetKey || 'this_month').toLowerCase().trim();

  let start = new Date(now);
  let end = new Date(now);

  switch (key) {
    case 'today': {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'Today' };
    }

    case 'yesterday': {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'Yesterday' };
    }

    case 'this_week': {
      // Monday of current week
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start.setDate(now.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'This Week' };
    }

    case 'last_week': {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start.setDate(now.getDate() + diffToMonday - 7);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'Last Week' };
    }

    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'This Month' };
    }

    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'Last Month' };
    }

    case 'this_quarter': {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarterIndex * 3, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'This Quarter' };
    }

    case 'this_year': {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: key, label: 'This Year' };
    }

    default: {
      // Default fallback to this month
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end, preset: 'this_month', label: 'This Month' };
    }
  }
}

module.exports = {
  resolveDateRange
};
